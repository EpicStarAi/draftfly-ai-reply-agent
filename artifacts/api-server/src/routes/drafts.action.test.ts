/**
 * applyDraftAction — activity cleanup tests for send_failed retry path
 *
 * Confirms that PATCH /api/drafts/:id/action, when called against a
 * send_failed draft, deletes the stale draft_send_failed activity entry
 * before inserting the success entry — leaving exactly one activity row
 * per draft, matching the same guarantee already provided by the Slack
 * action handler (slack.retry.test.ts).
 */

import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";

// ─── Hoisted shared state ─────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const draftRow = {
    id: 55,
    status: "send_failed" as string,
    clientId: 1,
    campaignId: 1,
    prospectEmail: "action@example.com",
    prospectName: "Action Lead",
    prospectCompany: "Action Corp",
    prospectCountry: "US",
    replyText: "AI draft",
    editedReplyText: null as string | null,
    slackMessageTs: null as string | null,
    actionedAt: null,
    createdAt: new Date("2026-07-21T10:00:00Z"),
  };

  const campaignRow = { id: 1, name: "Action Campaign" };

  return {
    draftRow,
    campaignRow,
    dbUpdateSets: [] as object[],
    dbInsertValues: [] as object[],
    dbDeleteWheres: [] as unknown[],
    dbReturningRows: [] as object[],
  };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ _col, _val })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
}));

vi.mock("../lib/slack", () => ({
  postApprovalCard: vi.fn(() => Promise.resolve("ts_new")),
  isSlackConfigured: vi.fn(() => false),
}));

vi.mock("@workspace/db", () => {
  const draftsTable = { _name: "drafts" };
  const campaignsTable = { _name: "campaigns" };
  const clientsTable = { _name: "clients" };
  const activityTable = { _name: "activity" };
  const personasTable = { _name: "personas" };

  return {
    draftsTable,
    campaignsTable,
    clientsTable,
    activityTable,
    personasTable,
    db: {
      select: () => ({
        from: (table: object) => ({
          where: () => {
            if (table === draftsTable) return Promise.resolve([{ ...mocks.draftRow }]);
            if (table === campaignsTable) return Promise.resolve([{ ...mocks.campaignRow }]);
            return Promise.resolve([]);
          },
        }),
      }),
      update: (_table: object) => ({
        set: (values: object) => {
          mocks.dbUpdateSets.push(values);
          return {
            where: () => ({
              returning: () => {
                const updated = { ...mocks.draftRow, ...values };
                return Promise.resolve([updated]);
              },
            }),
          };
        },
      }),
      insert: (_table: object) => ({
        values: (values: object) => {
          mocks.dbInsertValues.push(values);
          return Promise.resolve(undefined);
        },
      }),
      delete: (_table: object) => ({
        where: (condition: unknown) => {
          mocks.dbDeleteWheres.push(condition);
          return Promise.resolve(undefined);
        },
      }),
    },
  };
});

// ─── App import (after all vi.mock calls) ─────────────────────────────────────

import request from "supertest";
import app from "../app";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PATCH /api/drafts/:id/action — send_failed retry cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.draftRow.status = "send_failed";
    mocks.draftRow.editedReplyText = null;
    mocks.dbUpdateSets.length = 0;
    mocks.dbInsertValues.length = 0;
    mocks.dbDeleteWheres.length = 0;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  // ── The REST route may no longer send ──────────────────────────────────────
  //
  // This route used to mark a draft "sent" without approval and without ever
  // calling Lemlist. Sending now requires a verified Slack approval, so the
  // action is refused outright rather than silently lying about the outcome.

  it("refuses action=send with 403 — sending requires Slack approval", async () => {
    const res = await request(app)
      .patch("/api/drafts/55/action")
      .send({ action: "send" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("APPROVAL_REQUIRED");
  });

  it("does not touch the draft when action=send is refused", async () => {
    await request(app).patch("/api/drafts/55/action").send({ action: "send" });

    expect(mocks.dbUpdateSets).toHaveLength(0);
    expect(mocks.dbInsertValues).toHaveLength(0);
    expect(mocks.dbDeleteWheres).toHaveLength(0);
  });

  it("never writes a draft_sent activity entry from the REST route", async () => {
    await request(app).patch("/api/drafts/55/action").send({ action: "send" });

    const insertedTypes = mocks.dbInsertValues.map((v) => (v as { type?: string }).type);
    expect(insertedTypes).not.toContain("draft_sent");
  });

  it("refuses action=send on a plain pending draft too", async () => {
    mocks.draftRow.status = "pending";

    const res = await request(app).patch("/api/drafts/55/action").send({ action: "send" });

    expect(res.status).toBe(403);
    expect(mocks.dbUpdateSets).toHaveLength(0);
  });

  // ── Edit and discard still work, including activity cleanup ────────────────

  it("scopes the stale-failure delete to the correct draftId and type", async () => {
    await request(app)
      .patch("/api/drafts/55/action")
      .send({ action: "edit", editedText: "Operator rewrite" });

    type DeleteCondition = { _and: Array<{ _val: unknown }> };
    const condition = mocks.dbDeleteWheres[0] as DeleteCondition;
    const vals = condition._and.map((a) => a._val);

    expect(vals).toContain(55);
    expect(vals).toContain("draft_send_failed");
  });

  it("activity feed ends up with exactly one draft_edited and no draft_send_failed", async () => {
    await request(app)
      .patch("/api/drafts/55/action")
      .send({ action: "edit", editedText: "Operator rewrite" });

    expect(mocks.dbDeleteWheres).toHaveLength(1);

    const editedInserts = mocks.dbInsertValues.filter(
      (v) => (v as { type?: string }).type === "draft_edited",
    );
    expect(editedInserts).toHaveLength(1);
    expect((editedInserts[0] as { draftId?: number }).draftId).toBe(55);

    const failedInserts = mocks.dbInsertValues.filter(
      (v) => (v as { type?: string }).type === "draft_send_failed",
    );
    expect(failedInserts).toHaveLength(0);
  });

  it("does NOT delete any activity entry when editing a plain pending draft", async () => {
    mocks.draftRow.status = "pending";

    await request(app)
      .patch("/api/drafts/55/action")
      .send({ action: "edit", editedText: "Operator rewrite" });

    expect(mocks.dbDeleteWheres).toHaveLength(0);
  });

  it("does NOT delete activity when discarding a pending draft", async () => {
    mocks.draftRow.status = "pending";

    await request(app)
      .patch("/api/drafts/55/action")
      .send({ action: "discard" });

    expect(mocks.dbDeleteWheres).toHaveLength(0);
    const insertedTypes = mocks.dbInsertValues.map((v) => (v as { type?: string }).type).filter(Boolean);
    expect(insertedTypes).toContain("draft_discarded");
  });

  it("also cleans up activity when a send_failed draft is discarded via web action", async () => {
    // Operator gives up on a failed draft — still need clean activity feed
    await request(app)
      .patch("/api/drafts/55/action")
      .send({ action: "discard" });

    expect(mocks.dbDeleteWheres).toHaveLength(1);

    type DeleteCondition = { _and: Array<{ _val: unknown }> };
    const condition = mocks.dbDeleteWheres[0] as DeleteCondition;
    const vals = condition._and.map((a) => a._val);
    expect(vals).toContain(55);
    expect(vals).toContain("draft_send_failed");
  });
});
