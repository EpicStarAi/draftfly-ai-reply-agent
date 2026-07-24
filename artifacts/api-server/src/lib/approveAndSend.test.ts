/**
 * Approval gate tests — approveAndSend()
 *
 * Proves:
 *  (a) sending with approved=false throws and never touches Lemlist
 *  (b) a second dispatch for the same draft is refused by the idempotency claim
 *  ... plus the provenance checks: an `approved` flag with no legitimate source
 *      or no named approver is treated as no approval at all.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const draftRow = {
    id: 7,
    status: "pending" as string,
    clientId: 1,
    campaignId: 1,
    prospectEmail: "lead@example.com",
    prospectName: "Test Lead",
    replyText: "AI generated reply",
    editedReplyText: null as string | null,
    approved: false,
    approvedBy: null as string | null,
    approvedAt: null as Date | null,
    approvalSource: null as string | null,
    approvalRef: null as string | null,
  };

  return {
    draftRow,
    /** Rows already present in reply_sends — drives the ON CONFLICT behaviour. */
    existingSendKeys: new Set<string>(),
    sendReply: vi.fn<() => Promise<{ ok: boolean; error?: string }>>(),
    deletedSendKeys: [] as unknown[],
    updatedSendRows: [] as object[],
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ _col, _val })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  inArray: vi.fn((_col: unknown, vals: unknown[]) => ({ _in: vals })),
}));

vi.mock("./lemlist", () => ({
  sendReply: mocks.sendReply,
  isLemlistConfigured: () => true,
}));

vi.mock("@workspace/db", () => {
  const draftsTable = { _name: "drafts" };
  const replySendsTable = { _name: "reply_sends", sendKey: { _col: "send_key" } };

  return {
    draftsTable,
    replySendsTable,
    db: {
      select: () => ({
        from: (table: object) => ({
          where: () =>
            table === draftsTable ? Promise.resolve([{ ...mocks.draftRow }]) : Promise.resolve([]),
        }),
      }),
      insert: (table: object) => ({
        values: (values: Record<string, unknown>) => ({
          onConflictDoNothing: () => ({
            returning: () => {
              if (table === replySendsTable) {
                const key = String(values.sendKey);
                if (mocks.existingSendKeys.has(key)) return Promise.resolve([]);
                mocks.existingSendKeys.add(key);
                return Promise.resolve([{ id: 1 }]);
              }
              return Promise.resolve([{ id: 1 }]);
            },
          }),
        }),
      }),
      update: () => ({
        set: (values: object) => {
          mocks.updatedSendRows.push(values);
          return { where: () => Promise.resolve(undefined) };
        },
      }),
      delete: () => ({
        where: (cond: unknown) => {
          mocks.deletedSendKeys.push(cond);
          return Promise.resolve(undefined);
        },
      }),
    },
  };
});

import { approveAndSend } from "./approveAndSend";
import { ApprovalRequiredError } from "./approvalGate";

const SLACK_CTX = {
  source: "slack" as const,
  userId: "U_OPERATOR",
  teamId: "T_WORKSPACE",
  signatureVerified: true,
  interactionRef: "draft_send",
};

function approvedDraft() {
  mocks.draftRow.approved = true;
  mocks.draftRow.approvedBy = "U_OPERATOR";
  mocks.draftRow.approvalSource = "slack";
  mocks.draftRow.status = "pending";
}

describe("approveAndSend — approval is mandatory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.existingSendKeys.clear();
    mocks.deletedSendKeys.length = 0;
    mocks.updatedSendRows.length = 0;
    mocks.draftRow.approved = false;
    mocks.draftRow.approvedBy = null;
    mocks.draftRow.approvalSource = null;
    mocks.draftRow.status = "pending";
    mocks.sendReply.mockResolvedValue({ ok: true });
    process.env.APPROVAL_REQUIRED = "true";
    delete process.env.NODE_ENV;
  });

  // ── (a) approved=false must throw, and must not send ────────────────────────

  it("throws 'Reply requires approval' when the draft is not approved", async () => {
    await expect(
      approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" }),
    ).rejects.toThrow("Reply requires approval");
  });

  it("does NOT call Lemlist when the draft is not approved", async () => {
    await approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" }).catch(() => undefined);
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  it("throws ApprovalRequiredError specifically (not a generic Error)", async () => {
    await expect(
      approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" }),
    ).rejects.toBeInstanceOf(ApprovalRequiredError);
  });

  // ── Approval provenance must be legitimate ─────────────────────────────────

  it("refuses an approved flag with no approval source (e.g. set by a stray UPDATE)", async () => {
    mocks.draftRow.approved = true;
    mocks.draftRow.approvedBy = "U_OPERATOR";
    mocks.draftRow.approvalSource = null;

    await expect(
      approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" }),
    ).rejects.toThrow(/did not come from Slack or Telegram/);
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  it("refuses an approval source a background job might invent", async () => {
    mocks.draftRow.approved = true;
    mocks.draftRow.approvedBy = "auto-sweep";
    mocks.draftRow.approvalSource = "system";

    await expect(
      approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" }),
    ).rejects.toThrow(/did not come from Slack or Telegram/);
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  it("refuses an approval with no named approver", async () => {
    mocks.draftRow.approved = true;
    mocks.draftRow.approvedBy = "  ";
    mocks.draftRow.approvalSource = "slack";

    await expect(
      approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" }),
    ).rejects.toThrow(/names no approver/);
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  // ── The approver context must be a verified interaction ────────────────────

  it("refuses an unverified request signature even on an approved draft", async () => {
    approvedDraft();
    await expect(
      approveAndSend(7, { ...SLACK_CTX, signatureVerified: false }, { lemlistCampaignId: "cam_1" }),
    ).rejects.toThrow(/signature was not verified/);
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  it("refuses a non-interactive approval surface", async () => {
    approvedDraft();
    await expect(
      approveAndSend(
        7,
        { ...SLACK_CTX, source: "cron" as unknown as "slack" },
        { lemlistCampaignId: "cam_1" },
      ),
    ).rejects.toThrow(/is not an approval surface/);
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  it("refuses an anonymous approver", async () => {
    approvedDraft();
    await expect(
      approveAndSend(7, { ...SLACK_CTX, userId: "unknown" }, { lemlistCampaignId: "cam_1" }),
    ).rejects.toThrow(/approver identity is unknown/);
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it("sends exactly once when the draft is properly approved", async () => {
    approvedDraft();
    const outcome = await approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" });

    expect(outcome).toEqual({ status: "sent", draftId: 7 });
    expect(mocks.sendReply).toHaveBeenCalledOnce();
    expect(mocks.sendReply).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead@example.com",
        campaignId: "cam_1",
        replyText: "AI generated reply",
        draftId: 7,
      }),
      expect.objectContaining({ draftId: 7, approvalSource: "slack", approvedBy: "U_OPERATOR" }),
    );
  });

  it("prefers edited text over the AI draft", async () => {
    approvedDraft();
    mocks.draftRow.editedReplyText = "Operator rewrote this";

    await approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" });

    expect(mocks.sendReply).toHaveBeenCalledWith(
      expect.objectContaining({ replyText: "Operator rewrote this" }),
      expect.anything(),
    );
    mocks.draftRow.editedReplyText = null;
  });
});

// ── (b) idempotency ──────────────────────────────────────────────────────────

describe("approveAndSend — idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.existingSendKeys.clear();
    mocks.deletedSendKeys.length = 0;
    mocks.sendReply.mockResolvedValue({ ok: true });
    process.env.APPROVAL_REQUIRED = "true";
    approvedDraft();
  });

  it("does not send twice for the same draft", async () => {
    const first = await approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" });
    const second = await approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" });

    expect(first.status).toBe("sent");
    expect(second.status).toBe("already_sent");
    expect(mocks.sendReply).toHaveBeenCalledOnce();
  });

  it("survives a burst of concurrent approvals with a single dispatch", async () => {
    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" })),
    );

    expect(mocks.sendReply).toHaveBeenCalledOnce();
    expect(outcomes.filter((o) => o.status === "sent")).toHaveLength(1);
    expect(outcomes.filter((o) => o.status === "already_sent")).toHaveLength(4);
  });

  it("claims the idempotency row BEFORE contacting Lemlist", async () => {
    const order: string[] = [];
    mocks.sendReply.mockImplementation(() => {
      order.push("lemlist");
      return Promise.resolve({ ok: true });
    });
    // The claim is observable through existingSendKeys being populated.
    await approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" });

    expect(mocks.existingSendKeys.has("draft:7")).toBe(true);
    expect(order).toEqual(["lemlist"]);
  });

  it("releases the claim when Lemlist fails, so an operator can retry", async () => {
    mocks.sendReply.mockResolvedValue({ ok: false, error: "rate_limited" });

    const outcome = await approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" });

    expect(outcome).toEqual({ status: "send_failed", draftId: 7, error: "rate_limited" });
    expect(mocks.deletedSendKeys).toHaveLength(1);
  });

  it("never sends when the draft is already in a terminal state", async () => {
    mocks.draftRow.status = "sent";

    const outcome = await approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" });

    expect(outcome.status).toBe("already_sent");
    expect(mocks.sendReply).not.toHaveBeenCalled();
  });
});

// ── Runtime fuse ─────────────────────────────────────────────────────────────

describe("approveAndSend — APPROVAL_REQUIRED fuse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.existingSendKeys.clear();
    mocks.sendReply.mockResolvedValue({ ok: true });
    approvedDraft();
  });

  it("refuses to send when APPROVAL_REQUIRED is disabled — the flag is not a send switch", async () => {
    process.env.APPROVAL_REQUIRED = "false";
    delete process.env.NODE_ENV;

    await expect(
      approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" }),
    ).rejects.toThrow(/APPROVAL_REQUIRED/);
    expect(mocks.sendReply).not.toHaveBeenCalled();

    process.env.APPROVAL_REQUIRED = "true";
  });

  it("ignores APPROVAL_REQUIRED=false entirely in production", async () => {
    process.env.APPROVAL_REQUIRED = "false";
    process.env.NODE_ENV = "production";

    const outcome = await approveAndSend(7, SLACK_CTX, { lemlistCampaignId: "cam_1" });

    expect(outcome.status).toBe("sent");

    delete process.env.NODE_ENV;
    process.env.APPROVAL_REQUIRED = "true";
  });
});
