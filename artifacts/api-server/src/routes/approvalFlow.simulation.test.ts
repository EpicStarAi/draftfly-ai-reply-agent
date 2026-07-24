/**
 * End-to-end approval flow simulation — no real network, no real email.
 *
 * Walks the production path with Lemlist, Claude and Slack mocked:
 *
 *   reply webhook → draft created → Slack card posted
 *     → [nothing sent]
 *     → operator clicks ✅ Send → sent exactly once → history written
 *
 * The point of this suite is the negative space: between the webhook arriving
 * and the Approve click, `sendReply` must have been called zero times, no matter
 * how much time passes or how many times the webhook is redelivered.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const draftRow = {
    id: 501,
    status: "pending" as string,
    clientId: 1,
    campaignId: 1,
    prospectEmail: "ana@momentumlabs.io",
    prospectName: "Ana Rivera",
    prospectCompany: "Momentum Labs",
    prospectCountry: "US",
    conversationSnippet: "Yes, interested. Can you send more details?",
    replyText: "Happy to share details — are you free for 15 minutes on Thursday?",
    editedReplyText: null as string | null,
    slackMessageTs: "C_APPROVALS|1730000000.000100" as string | null,
    actionedAt: null as Date | null,
    approved: false,
    approvedBy: null as string | null,
    approvedAt: null as Date | null,
    approvalSource: null as string | null,
    approvalRef: null as string | null,
  };

  return {
    draftRow,
    inboundKeys: new Set<string>(),
    sendKeys: new Set<string>(),
    sendReply: vi.fn<() => Promise<{ ok: boolean; error?: string }>>(),
    postApprovalCard: vi.fn(() => Promise.resolve("1730000000.000100")),
    updateMessageAfterAction: vi.fn(() => Promise.resolve()),
    verifyIncomingRequest: vi.fn(() => true),
    generateDraftReply: vi.fn(),
    activityInserts: [] as Record<string, unknown>[],
    logInserts: [] as Record<string, unknown>[],
    draftUpdates: [] as Record<string, unknown>[],
    draftInserts: [] as Record<string, unknown>[],
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: unknown, v: unknown) => ({ _v: v })),
  and: vi.fn((...a: unknown[]) => ({ _and: a })),
  or: vi.fn((...a: unknown[]) => ({ _or: a })),
  inArray: vi.fn((_c: unknown, v: unknown[]) => ({ _in: v })),
}));

// ── Lemlist: the real API is never reached ───────────────────────────────────
vi.mock("../lib/lemlist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/lemlist")>();
  return {
    ...actual,
    sendReply: mocks.sendReply,
    isLemlistConfigured: () => true,
  };
});

vi.mock("../lib/claude", () => ({
  generateDraftReply: mocks.generateDraftReply,
  isValidDraftText: (t: string) => t.trim().length > 10,
}));

vi.mock("../lib/slack", () => ({
  verifyIncomingRequest: mocks.verifyIncomingRequest,
  postApprovalCard: mocks.postApprovalCard,
  updateMessageAfterAction: mocks.updateMessageAfterAction,
  postFallbackFailureNotification: vi.fn(() => Promise.resolve()),
  openEditModal: vi.fn(() => Promise.resolve()),
  postEphemeral: vi.fn(() => Promise.resolve()),
  postEscalationAlert: vi.fn(() => Promise.resolve()),
  postTestMessage: vi.fn(() => Promise.resolve({ ok: true })),
  postUnmatchedCampaignAlert: vi.fn(() => Promise.resolve()),
  isSlackConfigured: () => true,
}));

vi.mock("@workspace/db", () => {
  const draftsTable = { _name: "drafts" };
  const campaignsTable = { _name: "campaigns" };
  const clientsTable = { _name: "clients" };
  const personasTable = { _name: "personas" };
  const logsTable = { _name: "logs" };
  const activityTable = { _name: "activity" };
  const inboundRepliesTable = { _name: "inbound_replies", idempotencyKey: {} };
  const replySendsTable = { _name: "reply_sends", sendKey: {} };

  return {
    draftsTable,
    campaignsTable,
    clientsTable,
    personasTable,
    logsTable,
    activityTable,
    inboundRepliesTable,
    replySendsTable,
    db: {
      select: (_c?: unknown) => ({
        from: (table: object) => ({
          where: () => {
            if (table === draftsTable) return Promise.resolve([{ ...mocks.draftRow }]);
            if (table === campaignsTable)
              return Promise.resolve([
                { id: 1, name: "Q3 Outreach", clientId: 1, lemlistCampaignId: "cam_q3", personaId: null },
              ]);
            if (table === clientsTable)
              return Promise.resolve([
                { id: 1, name: "Acme", slackChannel: "C_APPROVALS", slackBotToken: null },
              ]);
            return Promise.resolve([]);
          },
          orderBy: () => Promise.resolve([]),
        }),
      }),
      insert: (table: object) => ({
        values: (values: Record<string, unknown>) => {
          const claimReturning = (set: Set<string>, key: string) => () => {
            if (set.has(key)) return Promise.resolve([]);
            set.add(key);
            return Promise.resolve([{ id: set.size }]);
          };

          if (table === inboundRepliesTable) {
            return {
              onConflictDoNothing: () => ({
                returning: claimReturning(mocks.inboundKeys, String(values.idempotencyKey)),
              }),
            };
          }
          if (table === replySendsTable) {
            return {
              onConflictDoNothing: () => ({
                returning: claimReturning(mocks.sendKeys, String(values.sendKey)),
              }),
            };
          }
          if (table === activityTable) mocks.activityInserts.push(values);
          if (table === logsTable) mocks.logInserts.push(values);
          if (table === draftsTable) mocks.draftInserts.push(values);

          const p = Promise.resolve(undefined) as Promise<undefined> & { returning?: unknown };
          p.returning = () => Promise.resolve([{ ...mocks.draftRow }]);
          return p;
        },
      }),
      update: (table: object) => ({
        set: (values: Record<string, unknown>) => {
          if (table === draftsTable) {
            mocks.draftUpdates.push(values);
            // Reflect approval writes back onto the row, as Postgres would.
            Object.assign(mocks.draftRow, values);
          }
          const p = Promise.resolve(undefined) as Promise<undefined> & { returning?: unknown };
          p.returning = () => Promise.resolve([{ id: mocks.draftRow.id }]);
          return { where: () => p };
        },
      }),
      delete: () => ({ where: () => Promise.resolve(undefined) }),
    },
  };
});

import request from "supertest";
import app from "../app";

const WEBHOOK_SECRET = "simulation-secret";

function lemlistReplyPayload() {
  return {
    type: "emailsReplied",
    campaignId: "cam_q3",
    leadId: "lead_ana",
    leadEmail: "ana@momentumlabs.io",
    leadFirstName: "Ana",
    leadLastName: "Rivera",
    leadCompanyName: "Momentum Labs",
    country: "US",
    jobTitle: "VP Sales",
    replyText: "Yes, interested. Can you send more details?",
    messageId: "msg_sim_001",
  };
}

function approveClickBody(draftId = 501) {
  return {
    payload: JSON.stringify({
      type: "block_actions",
      user: { id: "U_OPERATOR" },
      team: { id: "T_ACME" },
      channel: { id: "C_APPROVALS" },
      actions: [{ action_id: "draft_send", value: String(draftId) }],
    }),
  };
}

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

function resetWorld() {
  vi.clearAllMocks();
  mocks.inboundKeys.clear();
  mocks.sendKeys.clear();
  mocks.activityInserts.length = 0;
  mocks.logInserts.length = 0;
  mocks.draftUpdates.length = 0;
  mocks.draftInserts.length = 0;

  Object.assign(mocks.draftRow, {
    status: "pending",
    approved: false,
    approvedBy: null,
    approvedAt: null,
    approvalSource: null,
    approvalRef: null,
    editedReplyText: null,
    actionedAt: null,
    slackMessageTs: "C_APPROVALS|1730000000.000100",
  });

  mocks.sendReply.mockResolvedValue({ ok: true });
  mocks.verifyIncomingRequest.mockReturnValue(true);
  mocks.postApprovalCard.mockResolvedValue("1730000000.000100");
  mocks.generateDraftReply.mockResolvedValue({
    draft: "Happy to share details — are you free for 15 minutes on Thursday?",
    detectedIntent: "interested",
    suggestedNextAction: "book_call",
    confidenceScore: 0.91,
  });

  process.env.LEMLIST_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.APPROVAL_REQUIRED = "true";
}

describe("full flow simulation — reply → draft → Slack → approve → send", () => {
  beforeEach(resetWorld);

  it("stage 1: the webhook is accepted with a header secret", async () => {
    const res = await request(app)
      .post("/api/webhooks/lemlist")
      .set("Authorization", `Bearer ${WEBHOOK_SECRET}`)
      .send(lemlistReplyPayload());

    expect(res.status).toBe(200);
  });

  it("stage 2: a draft is generated and an approval card is posted", async () => {
    await request(app)
      .post("/api/webhooks/lemlist")
      .set("Authorization", `Bearer ${WEBHOOK_SECRET}`)
      .send(lemlistReplyPayload());
    await settle();

    expect(mocks.generateDraftReply).toHaveBeenCalledOnce();
    expect(mocks.draftInserts.some((d) => d.status === "pending")).toBe(true);
    expect(mocks.postApprovalCard).toHaveBeenCalledOnce();
  });

  it("stage 3: NOTHING is sent before an approval — this is the whole point", async () => {
    await request(app)
      .post("/api/webhooks/lemlist")
      .set("Authorization", `Bearer ${WEBHOOK_SECRET}`)
      .send(lemlistReplyPayload());
    await settle();

    expect(mocks.sendReply).not.toHaveBeenCalled();
    expect(mocks.draftRow.approved).toBe(false);
  });

  it("stage 3b: still nothing is sent after a long wait with no approval", async () => {
    await request(app)
      .post("/api/webhooks/lemlist")
      .set("Authorization", `Bearer ${WEBHOOK_SECRET}`)
      .send(lemlistReplyPayload());
    await settle(250);

    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  it("stage 3c: redelivering the webhook does not create a second draft or card", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post("/api/webhooks/lemlist")
        .set("Authorization", `Bearer ${WEBHOOK_SECRET}`)
        .send(lemlistReplyPayload());
      await settle();
    }

    expect(mocks.generateDraftReply).toHaveBeenCalledOnce();
    expect(mocks.postApprovalCard).toHaveBeenCalledOnce();
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  it("stage 4: the operator's Approve click sends exactly once", async () => {
    const res = await request(app).post("/api/slack/actions").type("form").send(approveClickBody());
    await settle();

    expect(res.status).toBe(200);
    expect(mocks.sendReply).toHaveBeenCalledOnce();
    expect(mocks.sendReply).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: "cam_q3", leadId: "ana@momentumlabs.io", draftId: 501 }),
      expect.objectContaining({ approvalSource: "slack", approvedBy: "U_OPERATOR" }),
    );
  });

  it("stage 4b: the approval is recorded with provenance", async () => {
    await request(app).post("/api/slack/actions").type("form").send(approveClickBody());
    await settle();

    const approvalWrite = mocks.draftUpdates.find((u) => u.approved === true);
    expect(approvalWrite).toMatchObject({
      approved: true,
      approvedBy: "U_OPERATOR",
      approvalSource: "slack",
    });
  });

  it("stage 5: history is updated — draft marked sent and activity written", async () => {
    await request(app).post("/api/slack/actions").type("form").send(approveClickBody());
    await settle();

    expect(mocks.draftUpdates.some((u) => u.status === "sent")).toBe(true);
    expect(mocks.activityInserts.some((a) => a.type === "draft_sent")).toBe(true);
    expect(mocks.logInserts.some((l) => l.finalStatus === "sent")).toBe(true);
    expect(mocks.updateMessageAfterAction).toHaveBeenCalled();
  });

  it("stage 6: a double-click on Approve still sends only once", async () => {
    await Promise.all([
      request(app).post("/api/slack/actions").type("form").send(approveClickBody()),
      request(app).post("/api/slack/actions").type("form").send(approveClickBody()),
    ]);
    await settle(120);

    expect(mocks.sendReply).toHaveBeenCalledOnce();
  });
});

describe("full flow simulation — the ways a send must NOT happen", () => {
  beforeEach(resetWorld);

  it("an unsigned Slack payload cannot approve or send", async () => {
    mocks.verifyIncomingRequest.mockReturnValue(false);

    const res = await request(app).post("/api/slack/actions").type("form").send(approveClickBody());
    await settle();

    expect(res.status).toBe(401);
    expect(mocks.sendReply).not.toHaveBeenCalled();
    expect(mocks.draftRow.approved).toBe(false);
  });

  it("the dashboard REST route cannot send", async () => {
    const res = await request(app).patch("/api/drafts/501/action").send({ action: "send" });
    await settle();

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("APPROVAL_REQUIRED");
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  it("discarding a draft never sends", async () => {
    await request(app).patch("/api/drafts/501/action").send({ action: "discard" });
    await settle();

    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  it("a webhook with a wrong secret is rejected and generates nothing", async () => {
    const res = await request(app)
      .post("/api/webhooks/lemlist")
      .set("Authorization", "Bearer wrong-secret")
      .send(lemlistReplyPayload());
    await settle();

    expect(res.status).toBe(401);
    expect(mocks.generateDraftReply).not.toHaveBeenCalled();
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  it("a webhook with no credential at all is rejected", async () => {
    const res = await request(app).post("/api/webhooks/lemlist").send(lemlistReplyPayload());
    expect(res.status).toBe(401);
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });
});
