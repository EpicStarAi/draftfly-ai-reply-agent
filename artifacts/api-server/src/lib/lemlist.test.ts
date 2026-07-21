/**
 * Unit tests for sendReply — timeout behaviour
 *
 * Strategy: stub global `fetch` with a mock that honours the AbortSignal, then
 * pass a short `timeoutMs` override so tests complete in milliseconds rather
 * than waiting the full 30 s production timeout.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", mockFetch);

import { sendReply, testConnection, getCampaigns } from "./lemlist";

/** Builds a fetch mock that never resolves but rejects with AbortError when the
 * request's AbortSignal fires. */
function makeHangingFetchMock() {
  return (_url: string, options?: RequestInit): Promise<Response> =>
    new Promise<Response>((_resolve, reject) => {
      const signal = options?.signal;
      if (signal) {
        if (signal.aborted) {
          reject(new DOMException("The operation was aborted.", "AbortError"));
          return;
        }
        signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      }
    });
}

/** Builds a fetch mock that resolves after `delayMs` but rejects with AbortError
 * if the signal fires first. */
function makeDelayedFetchMock(delayMs: number, status = 200) {
  return (_url: string, options?: RequestInit): Promise<Response> =>
    new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response(null, { status })), delayMs);
      const signal = options?.signal;
      if (signal) {
        if (signal.aborted) {
          clearTimeout(timer);
          reject(new DOMException("The operation was aborted.", "AbortError"));
          return;
        }
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      }
    });
}

describe("sendReply — AbortSignal timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEMLIST_API_KEY = "test-key-for-timeout-tests";
  });

  afterEach(() => {
    delete process.env.LEMLIST_API_KEY;
  });

  it("returns { ok: false, error: 'timeout' } when fetch hangs beyond timeoutMs", async () => {
    mockFetch.mockImplementation(makeHangingFetchMock());

    const result = await sendReply({
      leadId: "lead@example.com",
      campaignId: "cam_abc123",
      replyText: "Hi there",
      timeoutMs: 50,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
  });

  it("does NOT return 'timeout' when fetch resolves before timeoutMs", async () => {
    mockFetch.mockImplementation(makeDelayedFetchMock(0));

    const result = await sendReply({
      leadId: "lead@example.com",
      campaignId: "cam_abc123",
      replyText: "Hi there",
      timeoutMs: 5_000,
    });

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns { ok: false, error: 'timeout' } when fetch resolves only after timeoutMs", async () => {
    mockFetch.mockImplementation(makeDelayedFetchMock(300));

    const result = await sendReply({
      leadId: "lead@example.com",
      campaignId: "cam_abc123",
      replyText: "Hi there",
      timeoutMs: 50,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
  });

  it("still throws non-abort errors rather than swallowing them", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      sendReply({
        leadId: "lead@example.com",
        campaignId: "cam_abc123",
        replyText: "Hi there",
        timeoutMs: 5_000,
      }),
    ).rejects.toThrow("ECONNREFUSED");
  });
});

describe("testConnection — AbortSignal timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEMLIST_API_KEY = "test-key-for-timeout-tests";
  });

  afterEach(() => {
    delete process.env.LEMLIST_API_KEY;
  });

  it("returns { ok: false, error: 'timeout' } when fetch hangs beyond timeoutMs", async () => {
    mockFetch.mockImplementation(makeHangingFetchMock());

    const result = await testConnection({ timeoutMs: 50 });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
  });

  it("returns { ok: true } when fetch resolves before timeoutMs", async () => {
    mockFetch.mockImplementation(makeDelayedFetchMock(0, 200));

    const result = await testConnection({ timeoutMs: 5_000 });

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns { ok: false, error: 'timeout' } when fetch resolves only after timeoutMs", async () => {
    mockFetch.mockImplementation(makeDelayedFetchMock(300, 200));

    const result = await testConnection({ timeoutMs: 50 });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
  });

  it("returns { ok: false } with HTTP error text on non-OK response", async () => {
    mockFetch.mockImplementation(makeDelayedFetchMock(0, 401));

    const result = await testConnection({ timeoutMs: 5_000 });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/401/);
  });
});

describe("getCampaigns — AbortSignal timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEMLIST_API_KEY = "test-key-for-timeout-tests";
  });

  afterEach(() => {
    delete process.env.LEMLIST_API_KEY;
  });

  it("throws 'timeout' when fetch hangs beyond timeoutMs", async () => {
    mockFetch.mockImplementation(makeHangingFetchMock());

    await expect(getCampaigns({ timeoutMs: 50 })).rejects.toThrow("timeout");
  });

  it("returns campaign array when fetch resolves before timeoutMs", async () => {
    const campaigns = [{ _id: "cam_1", name: "Q3 Outreach", status: "active" }];
    mockFetch.mockResolvedValue(new Response(JSON.stringify(campaigns), { status: 200 }));

    const result = await getCampaigns({ timeoutMs: 5_000 });

    expect(result).toEqual(campaigns);
  });

  it("throws 'timeout' when fetch resolves only after timeoutMs", async () => {
    mockFetch.mockImplementation(makeDelayedFetchMock(300, 200));

    await expect(getCampaigns({ timeoutMs: 50 })).rejects.toThrow("timeout");
  });

  it("still throws non-abort errors rather than swallowing them", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(getCampaigns({ timeoutMs: 5_000 })).rejects.toThrow("ECONNREFUSED");
  });
});
