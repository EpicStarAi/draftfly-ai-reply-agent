/**
 * (b) Inbound reply idempotency.
 *
 * A redelivered Lemlist webhook must not produce a second draft, a second
 * Claude call or a second approval card.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: new Set<string>(),
  inserts: [] as Record<string, unknown>[],
  deletes: [] as unknown[],
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_c: unknown, v: unknown) => ({ _v: v })),
}));

vi.mock("@workspace/db", () => {
  const inboundRepliesTable = { _name: "inbound_replies", idempotencyKey: { _col: "idempotency_key" } };
  return {
    inboundRepliesTable,
    db: {
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          onConflictDoNothing: () => ({
            returning: () => {
              const key = String(values.idempotencyKey);
              if (mocks.rows.has(key)) return Promise.resolve([]);
              mocks.rows.add(key);
              mocks.inserts.push(values);
              return Promise.resolve([{ id: mocks.rows.size }]);
            },
          }),
        }),
      }),
      update: () => ({ set: () => ({ where: () => Promise.resolve(undefined) }) }),
      delete: () => ({
        where: (cond: { _v?: unknown }) => {
          mocks.deletes.push(cond);
          if (typeof cond?._v === "string") mocks.rows.delete(cond._v);
          return Promise.resolve(undefined);
        },
      }),
    },
  };
});

import {
  buildInboundIdempotencyKey,
  claimInboundReply,
  releaseInboundClaim,
} from "./idempotency";
import type { LemlistWebhookPayload } from "./lemlist";

function reply(overrides: Partial<LemlistWebhookPayload> = {}): LemlistWebhookPayload {
  return {
    type: "emailsReplied",
    campaignId: "cam_abc",
    leadId: "lead_123",
    leadEmail: "lead@example.com",
    replyText: "Yes, interested — send details.",
    ...overrides,
  };
}

describe("buildInboundIdempotencyKey", () => {
  beforeEach(() => {
    mocks.rows.clear();
    mocks.inserts.length = 0;
    mocks.deletes.length = 0;
  });

  it("is stable for identical payloads", () => {
    expect(buildInboundIdempotencyKey(reply())).toBe(buildInboundIdempotencyKey(reply()));
  });

  it("uses the Lemlist message id when present", () => {
    const key = buildInboundIdempotencyKey(reply({ messageId: "msg_999" }));
    expect(key).toBe("cam_abc:lead_123:msg_999");
  });

  it("separates different leads in the same campaign", () => {
    expect(buildInboundIdempotencyKey(reply({ leadId: "lead_1" }))).not.toBe(
      buildInboundIdempotencyKey(reply({ leadId: "lead_2" })),
    );
  });

  it("separates the same lead across campaigns", () => {
    expect(buildInboundIdempotencyKey(reply({ campaignId: "cam_a" }))).not.toBe(
      buildInboundIdempotencyKey(reply({ campaignId: "cam_b" })),
    );
  });

  it("separates two genuinely different replies from the same lead", () => {
    expect(buildInboundIdempotencyKey(reply({ replyText: "first" }))).not.toBe(
      buildInboundIdempotencyKey(reply({ replyText: "second" })),
    );
  });

  it("still produces a key when the payload carries no identifiers at all", () => {
    const key = buildInboundIdempotencyKey({ type: "emailsReplied" } as LemlistWebhookPayload);
    expect(key).toMatch(/^unknown:unknown-lead:/);
  });
});

describe("claimInboundReply", () => {
  beforeEach(() => {
    mocks.rows.clear();
    mocks.inserts.length = 0;
    mocks.deletes.length = 0;
  });

  it("claims a first-time reply", async () => {
    const claim = await claimInboundReply(reply());
    expect(claim.claimed).toBe(true);
  });

  it("refuses a redelivery of the same reply", async () => {
    await claimInboundReply(reply());
    const second = await claimInboundReply(reply());

    expect(second.claimed).toBe(false);
    expect(mocks.inserts).toHaveLength(1);
  });

  it("refuses every attempt in a retry storm after the first", async () => {
    const claims = await Promise.all(Array.from({ length: 6 }, () => claimInboundReply(reply())));
    expect(claims.filter((c) => c.claimed)).toHaveLength(1);
    expect(mocks.inserts).toHaveLength(1);
  });

  it("still claims a genuinely new reply from the same lead", async () => {
    await claimInboundReply(reply({ replyText: "first message" }));
    const second = await claimInboundReply(reply({ replyText: "follow-up message" }));
    expect(second.claimed).toBe(true);
  });

  it("allows a retry once the claim is released", async () => {
    const first = await claimInboundReply(reply());
    await releaseInboundClaim(first.idempotencyKey);

    const retry = await claimInboundReply(reply());
    expect(retry.claimed).toBe(true);
  });
});
