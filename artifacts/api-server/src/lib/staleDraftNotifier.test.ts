/**
 * (c) The former auto-sweep can no longer reach the send path.
 *
 * The old module exported `startStaleDraftSweeper()`, which ran `sweepStaleDrafts`
 * on a setInterval and rewrote draft status without any human involvement. This
 * suite pins the new contract:
 *   - no exported scheduler
 *   - notifyStaleDrafts() writes nothing to drafts
 *   - notifyStaleDrafts() never calls Lemlist, even when timers are advanced
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  sendReply: vi.fn<() => Promise<{ ok: boolean; error?: string }>>(),
  draftUpdates: [] as object[],
  draftInserts: [] as object[],
  postMessage: vi.fn<(args: { text?: string; blocks?: Array<{ text?: { text?: string } }> }) => Promise<{ ok: boolean }>>(
    () => Promise.resolve({ ok: true }),
  ),
  staleRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((..._a: unknown[]) => ({})),
  and: vi.fn((..._a: unknown[]) => ({})),
  or: vi.fn((..._a: unknown[]) => ({})),
  lt: vi.fn((..._a: unknown[]) => ({})),
  isNull: vi.fn((..._a: unknown[]) => ({})),
  isNotNull: vi.fn((..._a: unknown[]) => ({})),
}));

vi.mock("./lemlist", () => ({
  sendReply: mocks.sendReply,
  isLemlistConfigured: () => true,
}));

vi.mock("./slack", () => ({
  isSlackConfigured: () => true,
}));

vi.mock("@slack/web-api", () => ({
  WebClient: class {
    chat = { postMessage: mocks.postMessage };
  },
}));

vi.mock("@workspace/db", () => {
  const draftsTable = { _name: "drafts" };
  const clientsTable = { _name: "clients" };
  const campaignsTable = { _name: "campaigns" };
  return {
    draftsTable,
    clientsTable,
    campaignsTable,
    db: {
      select: (_cols?: unknown) => ({
        from: (table: object) => ({
          where: () => {
            if (table === draftsTable) return Promise.resolve(mocks.staleRows);
            if (table === clientsTable) return Promise.resolve([{ id: 1, name: "Acme" }]);
            if (table === campaignsTable) return Promise.resolve([{ id: 1, name: "Q3 Outreach" }]);
            return Promise.resolve([]);
          },
        }),
      }),
      update: (_t: object) => ({
        set: (values: object) => {
          mocks.draftUpdates.push(values);
          return { where: () => Promise.resolve(undefined) };
        },
      }),
      insert: (_t: object) => ({
        values: (values: object) => {
          mocks.draftInserts.push(values);
          return Promise.resolve(undefined);
        },
      }),
    },
  };
});

import * as sweeperModule from "./staleDraftSweeper";
import { notifyStaleDrafts, findStaleDrafts } from "./staleDraftSweeper";

function staleDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    clientId: 1,
    campaignId: 1,
    prospectEmail: "stale@example.com",
    prospectName: "Stale Lead",
    slackMessageTs: "C_APPROVALS|111.222",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    ...overrides,
  };
}

describe("stale draft handling — the auto-sweep cannot send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.draftUpdates.length = 0;
    mocks.draftInserts.length = 0;
    mocks.staleRows = [staleDraft()];
    process.env.SLACK_ALERT_CHANNEL = "C_ALERTS";
  });

  afterEach(() => {
    delete process.env.SLACK_ALERT_CHANNEL;
    vi.useRealTimers();
  });

  // ── No scheduler exists at all ──────────────────────────────────────────────

  it("no longer exports a scheduler", () => {
    expect((sweeperModule as Record<string, unknown>).startStaleDraftSweeper).toBeUndefined();
    expect((sweeperModule as Record<string, unknown>).sweepStaleDrafts).toBeUndefined();
  });

  it("registers no recurring timer when the module is used", async () => {
    const spy = vi.spyOn(globalThis, "setInterval");
    try {
      await notifyStaleDrafts();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  // ── The notify pass sends nothing ───────────────────────────────────────────

  it("does not call Lemlist when a stale draft is found", async () => {
    await notifyStaleDrafts();
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  it("does not call Lemlist even after a long simulated idle period", async () => {
    vi.useFakeTimers();
    await notifyStaleDrafts();
    // Advance well past every historical sweep interval (5 min) and threshold.
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  // ── It mutates nothing ──────────────────────────────────────────────────────

  it("does not write to the drafts table — a stale draft stays pending and approvable", async () => {
    await notifyStaleDrafts();
    expect(mocks.draftUpdates).toHaveLength(0);
  });

  it("never marks a draft send_failed on a timer", async () => {
    await notifyStaleDrafts();
    const statuses = mocks.draftUpdates.map((u) => (u as { status?: string }).status);
    expect(statuses).not.toContain("send_failed");
  });

  it("never sets the approval flag", async () => {
    await notifyStaleDrafts();
    const approvedWrites = mocks.draftUpdates.filter((u) => "approved" in (u as object));
    expect(approvedWrites).toHaveLength(0);
  });

  it("findStaleDrafts is read-only", async () => {
    await findStaleDrafts();
    expect(mocks.draftUpdates).toHaveLength(0);
    expect(mocks.draftInserts).toHaveLength(0);
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  // ── It still does its useful job ────────────────────────────────────────────

  it("still notifies operators about a stale draft", async () => {
    const reports = await notifyStaleDrafts();

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ draftId: 101, prospectEmail: "stale@example.com" });
    expect(mocks.postMessage).toHaveBeenCalledOnce();
  });

  it("says explicitly that no action was taken", async () => {
    await notifyStaleDrafts();
    const call = mocks.postMessage.mock.calls[0]?.[0];
    const body = call?.blocks?.[0]?.text?.text ?? "";
    expect(body).toMatch(/No action has been taken/i);
    expect(body).not.toMatch(/send_failed/);
  });

  it("reports nothing when there are no stale drafts", async () => {
    mocks.staleRows = [];
    const reports = await notifyStaleDrafts();
    expect(reports).toHaveLength(0);
    expect(mocks.postMessage).not.toHaveBeenCalled();
  });
});
