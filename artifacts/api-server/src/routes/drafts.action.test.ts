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

  it("deletes stale draft_send_failed activity when send_failed draft is sent via web action", async () => {
    const res = await request(app)
      .patch("/api/drafts/55/action")
      .send({ action: "send" });

    expect(res.status).toBe(200);
    expect(mocks.dbDeleteWheres).toHaveLength(1);
  });

  it("inserts draft_sent (not draft_send_failed) activity after successful web-action retry", async () => {
    await request(app)
      .patch("/api/drafts/55/action")
      .send({ action: "send" });

    const insertedTypes = mocks.dbInsertValues
      .map((v) => (v as { type?: string }).type)
      .filter(Boolean);

    expect(insertedTypes).toContain("draft_sent");
    expect(insertedTypes).not.toContain("draft_send_failed");
  });

  it("scopes the delete to the correct draftId and type", async () => {
    await request(app)
      .patch("/api/drafts/55/action")
      .send({ action: "send" });

    type DeleteCondition = { _and: Array<{ _val: unknown }> };
    const condition = mocks.dbDeleteWheres[0] as DeleteCondition;
    const vals = condition._and.map((a) => a._val);

    expect(vals).toContain(55);
    expect(vals).toContain("draft_send_failed");
  });

  it("activity feed ends up with exactly one draft_sent and no draft_send_failed after web retry", async () => {
    await request(app)
      .patch("/api/drafts/55/action")
      .send({ action: "send" });

    // Exactly one delete for the stale failure entry
    expect(mocks.dbDeleteWheres).toHaveLength(1);

    const activityInserts = mocks.dbInsertValues.filter(
      (v) =>
        (v as { type?: string }).type === "draft_sent" ||
        (v as { type?: string }).type === "draft_send_failed",
    );

    const sentInserts = activityInserts.filter(
      (v) => (v as { type?: string }).type === "draft_sent",
    );
    expect(sentInserts).toHaveLength(1);
    expect((sentInserts[0] as { draftId?: number }).draftId).toBe(55);

    const failedInserts = activityInserts.filter(
      (v) => (v as { type?: string }).type === "draft_send_failed",
    );
    expect(failedInserts).toHaveLength(0);
  });

  it("does NOT delete any activity entry when a plain pending draft is sent (no prior failure)", async () => {
    mocks.draftRow.status = "pending";

    await request(app)
      .patch("/api/drafts/55/action")
      .send({ action: "send" });

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
