/**
 * Webhook credential handling.
 *
 * The secret moved out of the URL query string and into headers. The query
 * path survives behind ALLOW_QUERY_WEBHOOK_SECRET purely so the currently
 * registered Lemlist webhook keeps working until it is re-registered; these
 * tests pin both the new behaviour and the kill switch.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireWebhookSecret, isQuerySecretAllowed } from "./lemlist";

const SECRET = "s3cr3t-value";

function makeReq(opts: {
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
}): Request {
  return {
    path: "/webhooks/lemlist",
    headers: opts.headers ?? {},
    query: opts.query ?? {},
  } as unknown as Request;
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("requireWebhookSecret", () => {
  let next: NextFunction & ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
    process.env.LEMLIST_WEBHOOK_SECRET = SECRET;
    delete process.env.ALLOW_QUERY_WEBHOOK_SECRET;
  });

  afterEach(() => {
    delete process.env.LEMLIST_WEBHOOK_SECRET;
    delete process.env.ALLOW_QUERY_WEBHOOK_SECRET;
  });

  // ── Accepted header forms ──────────────────────────────────────────────────

  it("accepts Authorization: Bearer <secret>", () => {
    const res = makeRes();
    requireWebhookSecret(makeReq({ headers: { authorization: `Bearer ${SECRET}` } }), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("accepts X-DraftFly-Signature", () => {
    const res = makeRes();
    requireWebhookSecret(makeReq({ headers: { "x-draftfly-signature": SECRET } }), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("accepts the existing X-Webhook-Secret header (n8n path)", () => {
    const res = makeRes();
    requireWebhookSecret(makeReq({ headers: { "x-webhook-secret": SECRET } }), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  // ── Rejections ─────────────────────────────────────────────────────────────

  it("rejects a request with no credential", () => {
    const res = makeRes();
    requireWebhookSecret(makeReq({}), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("rejects a wrong secret", () => {
    const res = makeRes();
    requireWebhookSecret(makeReq({ headers: { authorization: "Bearer nope" } }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("rejects a secret that is a prefix of the real one", () => {
    const res = makeRes();
    requireWebhookSecret(
      makeReq({ headers: { "x-draftfly-signature": SECRET.slice(0, -1) } }),
      res,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("disables the endpoint entirely when no secret is configured", () => {
    delete process.env.LEMLIST_WEBHOOK_SECRET;
    const res = makeRes();
    requireWebhookSecret(makeReq({ headers: { authorization: `Bearer ${SECRET}` } }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
  });

  it("never echoes the expected secret in the error body", () => {
    const res = makeRes();
    requireWebhookSecret(makeReq({ headers: { authorization: "Bearer nope" } }), res, next);
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });

  // ── Legacy query path ──────────────────────────────────────────────────────

  it("still accepts ?secret= while the compatibility flag is on (default)", () => {
    const res = makeRes();
    requireWebhookSecret(makeReq({ query: { secret: SECRET } }), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(isQuerySecretAllowed()).toBe(true);
  });

  it("rejects ?secret= once ALLOW_QUERY_WEBHOOK_SECRET=false", () => {
    process.env.ALLOW_QUERY_WEBHOOK_SECRET = "false";
    const res = makeRes();
    requireWebhookSecret(makeReq({ query: { secret: SECRET } }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(isQuerySecretAllowed()).toBe(false);
  });

  it("header auth keeps working after the query path is switched off", () => {
    process.env.ALLOW_QUERY_WEBHOOK_SECRET = "false";
    const res = makeRes();
    requireWebhookSecret(makeReq({ headers: { authorization: `Bearer ${SECRET}` } }), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("prefers the header when both a header and a query secret are present", () => {
    process.env.ALLOW_QUERY_WEBHOOK_SECRET = "false";
    const res = makeRes();
    requireWebhookSecret(
      makeReq({ headers: { authorization: `Bearer ${SECRET}` }, query: { secret: "stale" } }),
      res,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
