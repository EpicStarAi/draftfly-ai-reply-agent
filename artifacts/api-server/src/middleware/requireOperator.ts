import type { Request, Response, NextFunction } from "express";
import { getWorkspaceStatus } from "../lib/slack";
import { logger } from "../lib/logger";

/**
 * Operator authorization for internal DraftFly surfaces.
 *
 * Reuses the SAME session the production Slack OAuth login populates
 * (`req.session.user`, set in routes/auth.ts) — this is NOT a separate auth
 * scheme. Two gates:
 *   1. No active operator session          -> 401
 *   2. Session belongs to another Slack team -> 403
 *
 * The allowed team is `SLACK_TEAM_ID` when set, otherwise it is derived once
 * from the bot token's own workspace (auth.test) and cached, so cross-workspace
 * requests are rejected out of the box even before the env var is configured.
 */

// undefined = not yet resolved; null = resolved but unknown (fail-open on team,
// still auth-gated). A real string means we can enforce the workspace match.
let cachedBotTeamId: string | null | undefined;

async function resolveAllowedTeamId(): Promise<string | null> {
  const envTeam = process.env.SLACK_TEAM_ID?.trim();
  if (envTeam) return envTeam;
  if (cachedBotTeamId !== undefined) return cachedBotTeamId;
  try {
    const ws = await getWorkspaceStatus();
    cachedBotTeamId = ws.connected ? (ws.teamId ?? null) : null;
  } catch (err) {
    logger.warn({ err }, "requireOperator: could not resolve bot team id");
    cachedBotTeamId = null;
  }
  return cachedBotTeamId;
}

/** Test hook — clear the memoised bot team id between cases. */
export function __resetOperatorTeamCache(): void {
  cachedBotTeamId = undefined;
}

export async function requireOperator(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.session?.user;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const allowedTeam = await resolveAllowedTeamId();
  if (allowedTeam && user.teamId !== allowedTeam) {
    logger.warn(
      { userId: user.id, userTeam: user.teamId, allowedTeam },
      "requireOperator: rejecting operator from a different Slack workspace",
    );
    res.status(403).json({
      error: "Forbidden: your Slack workspace is not authorized for this DraftFly workspace",
    });
    return;
  }

  next();
}
