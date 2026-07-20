/**
 * Slack 3-second timeout tests
 *
 * Slack requires a 200 OK within 3 seconds of a button click.
 * These tests confirm the /api/slack/actions handler acks immediately
 * (well under 1 second) even when downstream work (Lemlist, DB) is slow.
 *
 * Strategy: mock sendReply with a 5-second artificial delay, then assert
 * the HTTP response arrives in under 1 second — proving the ack is not
 * blocked by the Lemlist call.
 */

import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";

// ─── Hoisted mock variables ───────────────────────────────────────────────────
// vi.mock factories are hoisted above all imports/declarations, so any variables
// they reference must also be hoisted via vi.hoisted().

const { mockSendReply, mockVerifyIncomingRequest } = vi.hoisted(() => ({
  mockSendReply: vi.fn<() => Promise<{ ok: boolean; error?: string }>>(),
  mockVerifyIncomingRequest: vi.fn(() => true),
}));

// ─── Module mocks (hoisted above all imports by vitest) ───────────────────────

// Mock drizzle-orm so eq() never throws on our fake table objects
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ _col, _val })),
}));

vi.mock("../lib/lemlist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/lemlist")>();
  return {
    ...actual,
    sendReply: mockSendReply,
    isLemlistConfigured: () => true,
  };
});

vi.mock("../lib/slack", () => ({
  verifyIncomingRequest: mockVerifyIncomingRequest,
  updateMessageAfterAction: vi.fn(() => Promise.resolve()),
  openEditModal: vi.fn(() => Promise.resolve()),
  isSlackConfigured: vi.fn(() => false),
  postApprovalCard: vi.fn(() => Promise.resolve("ts123")),
  postTestMessage: vi.fn(() => Promise.resolve({ ok: true })),
}));

// ─── DB mock ─────────────────────────────────────────────────────────────────
// Tables are plain objects; the db mock uses identity (Map) to return the right
// rows for each table. where() ignores the drizzle condition; we only care about
// which table was queried.

vi.mock("@workspace/db", () => {
  const draftsTable = { _name: "drafts" };
  const campaignsTable = { _name: "campaigns" };
  const clientsTable = { _name: "clients" };
  const logsTable = { _name: "logs" };
  const activityTable = { _name: "activity" };

  const draftRow = {
    id: 1,
    status: "pending",
    clientId: 1,
    campaignId: 1,
    prospectEmail: "lead@example.com",
    prospectName: "Test Lead",
    prospectCompany: "Acme Corp",
    prospectCountry: "US",
    replyText: "Hi there, thanks for reaching out!",
    editedReplyText: null,
    slackMessageTs: null,
    actionedAt: null,
  };

  const campaignRow = {
    id: 1,
    name: "Test Campaign",
    lemlistCampaignId: "cam_abc123",
  };

  const clientRow = {
    id: 1,
    slackBotToken: null,
  };

  const rowsByTable = new Map<object, unknown[]>([
    [draftsTable, [draftRow]],
    [campaignsTable, [campaignRow]],
    [clientsTable, [clientRow]],
    [logsTable, []],
    [activityTable, []],
  ]);

  return {
    draftsTable,
    campaignsTable,
    clientsTable,
    logsTable,
    activityTable,
    db: {
      select: () => ({
        from: (table: object) => ({
          where: () => Promise.resolve(rowsByTable.get(table) ?? []),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(undefined),
        }),
      }),
      insert: () => ({
        values: () => Promise.resolve(undefined),
      }),
    },
  };
});

// ─── App import (must come after vi.mock calls) ───────────────────────────────

import request from "supertest";
import app from "../app";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function blockActionBody(actionId: "draft_send" | "draft_discard" | "draft_edit", draftId = 1) {
  const payload = {
    type: "block_actions",
    user: { id: "U_OPERATOR" },
    team: { id: "T_WORKSPACE" },
    trigger_id: "trigger.abc.123",
    actions: [{ action_id: actionId, value: String(draftId) }],
  };
  return { payload: JSON.stringify(payload) };
}

function viewSubmissionBody(draftId = 1, text = "Updated reply text") {
  const payload = {
    type: "view_submission",
    user: { id: "U_OPERATOR" },
    team: { id: "T_WORKSPACE" },
    view: {
      callback_id: "draft_edit_modal",
      private_metadata: String(draftId),
      state: {
        values: {
          reply_text_block: {
            reply_text: { value: text },
          },
        },
      },
    },
  };
  return { payload: JSON.stringify(payload) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const MAX_ACK_MS = 1_000; // Must be < 3 000 ms (Slack's hard limit)

describe("POST /api/slack/actions — 3-second timeout guarantee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyIncomingRequest.mockReturnValue(true);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  // ── Send action ────────────────────────────────────────────────────────────

  it("acks draft_send within 1 s even when Lemlist takes 5 s", async () => {
    mockSendReply.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 5_000)),
    );

    const start = Date.now();
    const res = await request(app)
      .post("/api/slack/actions")
      .type("form")
      .send(blockActionBody("draft_send"));
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(MAX_ACK_MS);
  });

  it("acks draft_send within 1 s when Lemlist returns an error after 5 s", async () => {
    mockSendReply.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: false, error: "rate limited" }), 5_000),
        ),
    );

    const start = Date.now();
    const res = await request(app)
      .post("/api/slack/actions")
      .type("form")
      .send(blockActionBody("draft_send"));
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(MAX_ACK_MS);
  });

  it("acks draft_send within 1 s when Lemlist throws after 5 s", async () => {
    mockSendReply.mockImplementation(
      () =>
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error("network timeout")), 5_000),
        ),
    );

    const start = Date.now();
    const res = await request(app)
      .post("/api/slack/actions")
      .type("form")
      .send(blockActionBody("draft_send"));
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(MAX_ACK_MS);
  });

  // ── Discard action (no Lemlist call — baseline check) ─────────────────────

  it("acks draft_discard within 1 s", async () => {
    const start = Date.now();
    const res = await request(app)
      .post("/api/slack/actions")
      .type("form")
      .send(blockActionBody("draft_discard"));
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(MAX_ACK_MS);
    expect(mockSendReply).not.toHaveBeenCalled();
  });

  // ── Edit modal submit ──────────────────────────────────────────────────────

  it("acks view_submission (edit modal) within 1 s even when Lemlist takes 5 s", async () => {
    mockSendReply.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 5_000)),
    );

    const start = Date.now();
    const res = await request(app)
      .post("/api/slack/actions")
      .type("form")
      .send(viewSubmissionBody());
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(MAX_ACK_MS);
  });

  it("acks view_submission within 1 s when Lemlist throws after 5 s", async () => {
    mockSendReply.mockImplementation(
      () =>
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error("connection refused")), 5_000),
        ),
    );

    const start = Date.now();
    const res = await request(app)
      .post("/api/slack/actions")
      .type("form")
      .send(viewSubmissionBody());
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(MAX_ACK_MS);
  });

  // ── Signature verification (safety check) ─────────────────────────────────

  it("returns 401 when Slack signature is invalid", async () => {
    mockVerifyIncomingRequest.mockReturnValue(false);

    const res = await request(app)
      .post("/api/slack/actions")
      .type("form")
      .send(blockActionBody("draft_send"));

    expect(res.status).toBe(401);
  });

  // ── Unknown action ─────────────────────────────────────────────────────────

  it("returns 400 for an unknown action_id", async () => {
    const payload = {
      type: "block_actions",
      user: { id: "U_OPERATOR" },
      team: { id: "T_WORKSPACE" },
      actions: [{ action_id: "draft_unknown_action", value: "1" }],
    };

    const res = await request(app)
      .post("/api/slack/actions")
      .type("form")
      .send({ payload: JSON.stringify(payload) });

    expect(res.status).toBe(400);
  });
});
