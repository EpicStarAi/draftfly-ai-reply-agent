/**
 * (d) There is exactly one path to a Lemlist send.
 *
 * This suite is a structural guard, not a behavioural one. It reads the source
 * tree and fails the build if anyone re-introduces a second send path — a retry
 * worker, a cron job, a REST route, a "quick fix" in a webhook handler.
 *
 * If this test fails, do not add an exception. Route the new caller through
 * approveAndSend() instead.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** The only module allowed to call sendReply() or mint a send authorization. */
const SEND_OWNER = join("lib", "approveAndSend.ts");
/** Defines the capability; naturally contains the identifiers being policed. */
const AUTH_MODULE = join("lib", "sendAuthorization.ts");
/** The Lemlist transport itself — it declares sendReply. */
const LEMLIST_MODULE = join("lib", "lemlist.ts");

/** Test files legitimately exercise the guard itself. */
const isTestFile = (p: string) => /\.test\.ts$/.test(p);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

/**
 * Strip comments before scanning.
 *
 * Without this the guard trips on its own documentation — the files that
 * explain why sending is centralised naturally mention `sendReply()` and
 * `setInterval` in prose. We police executable code, not commentary.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments
    .replace(/(^|[^:])\/\/.*$/gm, "$1 "); // line comments ([^:] avoids https://)
}

/** Additionally blank out string/template literals, for call-site checks. */
function stripLiterals(source: string): string {
  return source
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

const sourceFiles = walk(SRC_ROOT).map((f) => {
  const raw = readFileSync(f, "utf8");
  const code = stripComments(raw);
  return {
    path: relative(SRC_ROOT, f),
    raw,
    /** Comments removed; string literals intact (import paths still visible). */
    code,
    /** Comments and literals removed — for identifier/call-site checks. */
    text: stripLiterals(code),
  };
});

describe("send path exclusivity", () => {
  it("finds source files to scan (guard against a silently empty sweep)", () => {
    expect(sourceFiles.length).toBeGreaterThan(15);
  });

  it("only approveAndSend.ts imports sendReply from the Lemlist client", () => {
    const offenders = sourceFiles
      .filter((f) => f.path !== SEND_OWNER && f.path !== LEMLIST_MODULE)
      .filter((f) => !isTestFile(f.path))
      .filter((f) => /import\s*\{[^}]*\bsendReply\b[^}]*\}\s*from\s*["'][^"']*lemlist["']/.test(f.code))
      .map((f) => f.path);

    expect(offenders, `sendReply may only be imported by ${SEND_OWNER}`).toEqual([]);
  });

  it("no module outside approveAndSend.ts calls sendReply(", () => {
    const offenders = sourceFiles
      .filter((f) => f.path !== SEND_OWNER && f.path !== LEMLIST_MODULE)
      .filter((f) => !isTestFile(f.path))
      .filter((f) => /\bsendReply\s*\(/.test(f.text))
      .map((f) => f.path);

    expect(offenders, "route every send through approveAndSend()").toEqual([]);
  });

  it("only approveAndSend.ts claims the send authorization minter", () => {
    const offenders = sourceFiles
      .filter((f) => f.path !== SEND_OWNER && f.path !== AUTH_MODULE)
      .filter((f) => !isTestFile(f.path))
      .filter((f) => /claimSendAuthorizationMinter\s*\(/.test(f.text))
      .map((f) => f.path);

    expect(offenders, "the minter is claimed once, by approveAndSend()").toEqual([]);
  });

  it("api.lemlist.com is referenced from exactly one module", () => {
    const referencing = sourceFiles
      .filter((f) => !isTestFile(f.path))
      .filter((f) => f.code.includes("api.lemlist.com"))
      .map((f) => f.path);

    expect(referencing).toEqual([LEMLIST_MODULE]);
  });

  it("no background scheduler exists anywhere in the service", () => {
    // setTimeout is fine — it backs AbortSignal timeouts. A *recurring* job is not.
    const schedulerPattern = /\b(setInterval|node-cron|new CronJob|new Queue|new Worker|new Agenda)\b/;
    const offenders = sourceFiles
      .filter((f) => !isTestFile(f.path))
      .filter((f) => schedulerPattern.test(f.text))
      .map((f) => f.path);

    expect(
      offenders,
      "a recurring job must not exist in a service where sending requires human approval",
    ).toEqual([]);
  });

  it("the stale-draft module does not import any send capability", () => {
    const sweeper = sourceFiles.find((f) => f.path === join("lib", "staleDraftSweeper.ts"));
    expect(sweeper).toBeDefined();
    expect(sweeper!.code).not.toMatch(/from\s+["']\.\/lemlist["']/);
    expect(sweeper!.code).not.toMatch(/from\s+["']\.\/approveAndSend["']/);
    expect(sweeper!.text).not.toMatch(/\bsendReply\b/);
  });

  it("only the approval gate writes the approved flag", () => {
    const gate = join("lib", "approvalGate.ts");
    // drafts.ts is allowed to CLEAR approval when a card is reposted.
    const allowed = new Set([gate, join("routes", "drafts.ts")]);
    const offenders = sourceFiles
      .filter((f) => !isTestFile(f.path) && !allowed.has(f.path))
      .filter((f) => /\bapproved:\s*true\b/.test(f.text))
      .map((f) => f.path);

    expect(offenders, `approved: true may only be written by ${gate}`).toEqual([]);
  });
});

describe("send path exclusivity — path separator sanity", () => {
  it("uses platform-correct paths so the scan works on Windows and Linux", () => {
    expect(SEND_OWNER).toBe(["lib", "approveAndSend.ts"].join(sep));
  });
});
