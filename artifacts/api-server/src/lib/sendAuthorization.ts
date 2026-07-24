/**
 * Send authorization — an unforgeable capability token for the Lemlist send path.
 *
 * `lemlist.sendReply()` refuses to run without one of these. The only function
 * that can mint one is `mintSendAuthorization()` below, and the only module
 * allowed to import it is `approveAndSend.ts` (enforced at runtime by the
 * one-shot binding below and in CI by sendPathExclusivity.test.ts).
 *
 * Why a capability object rather than "just don't call sendReply elsewhere":
 * a future contributor — or a Replit Agent checkpoint — adding
 * `await sendReply(...)` to a cron job, a retry worker or a REST route now gets
 * a *type error* and, if they cast past it, a *runtime throw*. Sending without
 * approval stops being a discipline question and becomes a mechanical one.
 */

const SEND_AUTHORIZATION = Symbol("draftfly.sendAuthorization");

/** Authorizations older than this are refused — a token cannot be stockpiled. */
export const SEND_AUTHORIZATION_TTL_MS = 60_000;

export type ApprovalSource = "slack" | "telegram";

export interface SendAuthorization {
  readonly [SEND_AUTHORIZATION]: true;
  /** Draft this authorization is scoped to — it is valid for no other draft. */
  readonly draftId: number;
  /** Interactive surface the human approval arrived on. */
  readonly approvalSource: ApprovalSource;
  /** Slack/Telegram user id of the approver. */
  readonly approvedBy: string;
  readonly issuedAt: number;
}

/**
 * Guard flag: only the first module to claim minting rights may mint. The
 * approval gate claims it at import time, so a second module trying to obtain
 * the minter fails loudly at startup rather than silently gaining send rights.
 */
let minterClaimed = false;

export interface MintGrant {
  draftId: number;
  approvalSource: ApprovalSource;
  approvedBy: string;
}

export type Minter = (grant: MintGrant) => SendAuthorization;

/**
 * Claim the exclusive right to mint send authorizations.
 *
 * Called exactly once, by `approveAndSend.ts`. Any second caller throws.
 * `claimant` is recorded for diagnostics only.
 */
export function claimSendAuthorizationMinter(claimant: string): Minter {
  if (minterClaimed) {
    throw new Error(
      `Send authorization minter already claimed — "${claimant}" may not mint send authorizations. ` +
        "approveAndSend() is the only sanctioned send path.",
    );
  }
  minterClaimed = true;

  return function mintSendAuthorization(grant: MintGrant): SendAuthorization {
    if (!Number.isInteger(grant.draftId) || grant.draftId <= 0) {
      throw new Error("Send authorization requires a positive integer draftId");
    }
    if (grant.approvalSource !== "slack" && grant.approvalSource !== "telegram") {
      throw new Error(`Send authorization refused — illegitimate approval source "${grant.approvalSource}"`);
    }
    if (!grant.approvedBy || !grant.approvedBy.trim()) {
      throw new Error("Send authorization requires a non-empty approvedBy");
    }
    return Object.freeze({
      [SEND_AUTHORIZATION]: true as const,
      draftId: grant.draftId,
      approvalSource: grant.approvalSource,
      approvedBy: grant.approvedBy,
      issuedAt: Date.now(),
    });
  };
}

/**
 * Verify a token before it is honoured. Throws on anything that is not a fresh,
 * correctly-scoped authorization minted by the approval gate.
 */
export function assertSendAuthorization(auth: unknown, expectedDraftId: number): asserts auth is SendAuthorization {
  if (!auth || typeof auth !== "object" || (auth as Record<symbol, unknown>)[SEND_AUTHORIZATION] !== true) {
    throw new Error(
      "Refusing to send: no valid send authorization. Replies may only be dispatched through approveAndSend().",
    );
  }
  const token = auth as SendAuthorization;
  if (token.draftId !== expectedDraftId) {
    throw new Error(
      `Refusing to send: authorization is scoped to draft ${token.draftId}, not draft ${expectedDraftId}`,
    );
  }
  if (Date.now() - token.issuedAt > SEND_AUTHORIZATION_TTL_MS) {
    throw new Error("Refusing to send: send authorization has expired");
  }
}

/** Test-only reset so each suite can exercise the one-shot claim. */
export function __resetMinterClaimForTests(): void {
  minterClaimed = false;
}
