/**
 * Webhook channel-routing tests
 *
 * Verifies that processLemlistReply routes the Slack approval card to the
 * per-client slackChannel when it is a real Slack ID (C/G prefix), and falls
 * back to the global SLACK_CHANNEL_ID env var when the client channel is
 * absent or looks like a placeholder.
 *
 * The primary integration test goes through the full save-then-fire path:
 *   1. PATCH /api/clients/:id  — saves a real Slack channel ID
 *   2. POST /api/webhooks/lemlist/simulate — fires a simulated webhook
 *   3. assert postApprovalCard received the saved channel, not the global env var
 *
 * Additional isolated tests cover the fallback branches directly.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ─── Hoisted mutable state ────────────────────────────────────────────────────
// vi.mock factories are hoisted above all imports, so any shared state they
// reference must also be hoisted via vi.hoisted().

const { clientRowRef, mockPostApprovalCard, mockGenerateDraftReply } = vi.hoisted(() => ({
  clientRowRef: {
    value: {
      id: 1,
      name: "Acme Corp",
      company: "Acme",
      slackChannel: "" as string,          // start empty; tests set as needed
      slackBotToken: null as string | null,
      slackWorkspaceId: null as string | null,
      mode: "draft" as const,
      lemlistApiKey: null as string | null,
      n8nWebhookUrl: null as string | null,
      isActive: true,
      createdAt: new Date(),
    },
  },
  mockPostApprovalCard: vi.fn<() => Promise<string | null>>().mockResolvedValue("ts_abc123"),
  mockGenerateDraftReply: vi.fn(),
}));

// ─── Module mocks (hoisted by vitest) ────────────────────────────────────────

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ _col, _val })),
  or: vi.fn((...args: unknown[]) => ({ args })),
}));

vi.mock("../lib/claude", () => ({
  generateDraftReply: mockGenerateDraftReply,
  isValidDraftText: vi.fn(() => true),
  extractDraftText: vi.fn((t: string) => t),
}));

vi.mock("../lib/slack", () => ({
  postApprovalCard: mockPostApprovalCard,
  isSlackConfigured: vi.fn(() => true),
  postUnmatchedCampaignAlert: vi.fn(() => Promise.resolve()),
  updateMessageAfterAction: vi.fn(() => Promise.resolve()),
  openEditModal: vi.fn(() => Promise.resolve()),
  postTestMessage: vi.fn(() => Promise.resolve({ ok: true })),
  verifyIncomingRequest: vi.fn(() => true),
}));

// ─── DB mock ──────────────────────────────────────────────────────────────────
//
// The `update` handler simulates persistence: when clientsTable is updated the
// mock applies the patch to clientRowRef.value in-memory so that a subsequent
// select() on the same table returns the updated row — matching what a real DB
// would do. This lets the PATCH → simulate integration test work end-to-end
// without a real database.

vi.mock("@workspace/db", () => {
  const draftsTable = { _name: "drafts" };
  const campaignsTable = { _name: "campaigns" };
  const clientsTable = { _name: "clients" };
  const logsTable = { _name: "logs" };
  const activityTable = { _name: "activity" };
  const personasTable = { _name: "personas" };

  const campaignRow = {
    id: 1,
    name: "Test Campaign",
    lemlistCampaignId: "1",
    clientId: 1,
    personaId: null,
    regionRules: null,
    replyRules: null,
  };

  const draftRow = { id: 42, slackMessageTs: null };

  // rowsByTable uses getter functions so clientRowRef.value is evaluated at
  // query time (not mock-factory time), picking up any mutations from PATCH.
  const rowsByTable = new Map<object, () => unknown[]>([
    [campaignsTable, () => [campaignRow]],
    [clientsTable, () => [{ ...clientRowRef.value }]],
    [personasTable, () => []],
    [logsTable, () => []],
    [activityTable, () => []],
  ]);

  // These tests are about Slack channel routing, not idempotency (that has its
  // own suite), so the inbound claim is always granted.
  const inboundRepliesTable = { _name: "inbound_replies", idempotencyKey: {} };
  const replySendsTable = { _name: "reply_sends", sendKey: {} };
  let claimId = 0;

  return {
    draftsTable,
    campaignsTable,
    clientsTable,
    logsTable,
    activityTable,
    personasTable,
    inboundRepliesTable,
    replySendsTable,
    db: {
      select: () => ({
        from: (table: object) => ({
          where: () => Promise.resolve((rowsByTable.get(table) ?? (() => []))()),
          // GET /api/clients (no where clause) — not exercised in these tests
          orderBy: () => Promise.resolve((rowsByTable.get(table) ?? (() => []))()),
        }),
      }),

      // update(table).set(data).where(condition) — returns a plain object so
      // processLemlistReply's fire-and-forget `await db.update(...).where(...)` works
      // (awaiting a non-Promise resolves to the object itself, result discarded).
      // For clientsTable the chain also exposes .returning() for the PATCH route.
      update: (table: object) => ({
        set: (data: Record<string, unknown>) => ({
          where: () => {
            // Return a dual-use object: awaitable as-is (resolves to itself) AND
            // chainable with .returning() for the PATCH clients route.
            const returningFn = () => {
              if (table === clientsTable) {
                // Apply the patch so subsequent selects see the new values
                Object.assign(clientRowRef.value, data);
                return Promise.resolve([{ ...clientRowRef.value }]);
              }
              return Promise.resolve([]);
            };
            // Attach .returning() to the resolved value so both usages work:
            //   await db.update(...).set(...).where(...)            — ignored
            //   await db.update(...).set(...).where(...).returning() — used
            return Object.assign(Promise.resolve(undefined as unknown), { returning: returningFn });
          },
        }),
      }),

      insert: (table: object) => ({
        values: () => {
          if (table === inboundRepliesTable || table === replySendsTable) {
            return {
              onConflictDoNothing: () => ({ returning: () => Promise.resolve([{ id: ++claimId }]) }),
            };
          }
          if (table === draftsTable) {
            return { returning: () => Promise.resolve([draftRow]) };
          }
          if (table === clientsTable) {
            // POST /api/clients — not exercised in these tests but guard for safety
            return { returning: () => Promise.resolve([{ ...clientRowRef.value }]) };
          }
          return { returning: () => Promise.resolve([]) };
        },
      }),
    },
  };
});

// ─── Lemlist mock — let simulate bypass the webhook-secret middleware ─────────

vi.mock("../lib/lemlist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/lemlist")>();
  return {
    ...actual,
    isLemlistConfigured: () => false,
    requireWebhookSecret: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

// ─── App import (must come after all vi.mock calls) ───────────────────────────

import request from "supertest";
import app from "../app";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FAKE_DRAFT = {
  draft: "Thanks for your reply! Can we jump on a quick call?",
  detectedIntent: "interested",
  suggestedNextAction: "book_call",
  confidenceScore: 0.92,
};

const DEFAULT_CLIENT = {
  id: 1,
  name: "Acme Corp",
  company: "Acme",
  slackChannel: "" as string,
  slackBotToken: null as string | null,
  slackWorkspaceId: null as string | null,
  mode: "draft" as const,
  lemlistApiKey: null as string | null,
  n8nWebhookUrl: null as string | null,
  isActive: true,
  createdAt: new Date(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Slack channel routing — save via PATCH, verify on webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostApprovalCard.mockResolvedValue("ts_abc123");
    mockGenerateDraftReply.mockResolvedValue(FAKE_DRAFT);
    // Reset the in-memory client row to a clean state before each test
    Object.assign(clientRowRef.value, { ...DEFAULT_CLIENT, createdAt: new Date() });
  });

  afterEach(() => {
    delete process.env.SLACK_CHANNEL_ID;
  });

  // ── Integration: PATCH saves → webhook uses saved channel ─────────────────

  it("uses the saved channel after PATCH /api/clients/:id sets a real Slack ID", async () => {
    // Global env var is set so a regression (using fallback) would produce a
    // distinct wrong value, making the assertion meaningful.
    process.env.SLACK_CHANNEL_ID = "C1GLOBALCHN1"; // valid-format: C + 11 alphanums

    // Step 1 — save a real Slack channel ID via the clients PATCH endpoint
    const patchRes = await request(app)
      .patch("/api/clients/1")
      .send({ slackChannel: "C0BK6NPBHKJ" });

    expect(patchRes.status).toBe(200);

    // Step 2 — simulate a Lemlist webhook (same campaign → same client)
    const simRes = await request(app)
      .post("/api/webhooks/lemlist/simulate")
      .send({ campaignId: 1 });

    expect(simRes.status).toBe(200);

    // Step 3 — assert postApprovalCard was called with the saved channel, not
    // the global env var or the original empty value
    expect(mockPostApprovalCard).toHaveBeenCalledOnce();
    const callArgs = (mockPostApprovalCard.mock.calls as unknown as [[{ channelId: string }]])[0][0];
    expect(callArgs.channelId).toBe("C0BK6NPBHKJ");
    expect(callArgs.channelId).not.toBe("C1GLOBALCHN1");
    expect(callArgs.channelId).not.toBe("");
  });

  // ── Isolated: per-client channel takes priority over global env var ────────

  it("prefers client.slackChannel over SLACK_CHANNEL_ID when client has a real Slack ID", async () => {
    Object.assign(clientRowRef.value, { slackChannel: "C0BK6NPBHKJ" });
    process.env.SLACK_CHANNEL_ID = "C1GLOBALCHN1";

    const res = await request(app)
      .post("/api/webhooks/lemlist/simulate")
      .send({ campaignId: 1 });

    expect(res.status).toBe(200);
    expect(mockPostApprovalCard).toHaveBeenCalledOnce();
    const callArgs = (mockPostApprovalCard.mock.calls as unknown as [[{ channelId: string }]])[0][0];
    expect(callArgs.channelId).toBe("C0BK6NPBHKJ");
    expect(callArgs.channelId).not.toBe("C1GLOBALCHN1");
  });

  // ── Isolated: fallback to global env var when client channel is placeholder ─

  it("falls back to global SLACK_CHANNEL_ID when client.slackChannel is a #name placeholder", async () => {
    Object.assign(clientRowRef.value, { slackChannel: "#general" });
    process.env.SLACK_CHANNEL_ID = "C1GLOBALCHN1"; // C + 11 alphanums ✓

    const res = await request(app)
      .post("/api/webhooks/lemlist/simulate")
      .send({ campaignId: 1 });

    expect(res.status).toBe(200);
    expect(mockPostApprovalCard).toHaveBeenCalledOnce();
    const callArgs = (mockPostApprovalCard.mock.calls as unknown as [[{ channelId: string }]])[0][0];
    expect(callArgs.channelId).toBe("C1GLOBALCHN1");
    expect(callArgs.channelId).not.toBe("#general");
  });

  it("falls back to global SLACK_CHANNEL_ID when client.slackChannel is empty", async () => {
    // clientRowRef.value.slackChannel is already "" from DEFAULT_CLIENT reset
    process.env.SLACK_CHANNEL_ID = "C1GLOBALCHN1";

    const res = await request(app)
      .post("/api/webhooks/lemlist/simulate")
      .send({ campaignId: 1 });

    expect(res.status).toBe(200);
    expect(mockPostApprovalCard).toHaveBeenCalledOnce();
    const callArgs = (mockPostApprovalCard.mock.calls as unknown as [[{ channelId: string }]])[0][0];
    expect(callArgs.channelId).toBe("C1GLOBALCHN1");
  });

  it("uses the per-client channel even when SLACK_CHANNEL_ID env var is not set", async () => {
    Object.assign(clientRowRef.value, { slackChannel: "C0BK6NPBHKJ" });
    delete process.env.SLACK_CHANNEL_ID;

    const res = await request(app)
      .post("/api/webhooks/lemlist/simulate")
      .send({ campaignId: 1 });

    expect(res.status).toBe(200);
    expect(mockPostApprovalCard).toHaveBeenCalledOnce();
    const callArgs = (mockPostApprovalCard.mock.calls as unknown as [[{ channelId: string }]])[0][0];
    expect(callArgs.channelId).toBe("C0BK6NPBHKJ");
  });
});
