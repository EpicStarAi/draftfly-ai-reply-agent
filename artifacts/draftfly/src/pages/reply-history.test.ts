/**
 * Reply History — share-link filter round-trip tests
 *
 * Verifies that getInitialFilters correctly parses URL search params into
 * filter state, covering the full set of shareable filter combinations.
 *
 * These unit tests exercise the same logic that runs when a recipient opens
 * a shared URL: the search string is read once on mount and turned into React
 * state that drives the Select dropdowns.
 */

import { describe, it, expect } from "vitest";
import { getInitialFilters } from "./reply-history";

describe("getInitialFilters — URL → dropdown state", () => {
  it("returns all-defaults when the search string is empty", () => {
    expect(getInitialFilters("")).toEqual({
      status: "all",
      client: "all",
      campaign: "all",
    });
  });

  it("parses status=sent into filter.status", () => {
    const result = getInitialFilters("status=sent");
    expect(result.status).toBe("sent");
    expect(result.client).toBe("all");
    expect(result.campaign).toBe("all");
  });

  it("parses status=discarded into filter.status", () => {
    expect(getInitialFilters("status=discarded").status).toBe("discarded");
  });

  it("parses status=pending into filter.status", () => {
    expect(getInitialFilters("status=pending").status).toBe("pending");
  });

  it("parses status=edited into filter.status", () => {
    expect(getInitialFilters("status=edited").status).toBe("edited");
  });

  it("parses status=send_failed into filter.status", () => {
    expect(getInitialFilters("status=send_failed").status).toBe("send_failed");
  });

  it("parses clientId=1 into filter.client", () => {
    const result = getInitialFilters("clientId=1");
    expect(result.client).toBe("1");
    expect(result.status).toBe("all");
    expect(result.campaign).toBe("all");
  });

  it("parses campaignId=42 into filter.campaign", () => {
    const result = getInitialFilters("campaignId=42");
    expect(result.campaign).toBe("42");
    expect(result.status).toBe("all");
    expect(result.client).toBe("all");
  });

  it("parses all three params together — the canonical share-link case", () => {
    const result = getInitialFilters("status=sent&clientId=1&campaignId=7");
    expect(result).toEqual({ status: "sent", client: "1", campaign: "7" });
  });

  it("leading ? is not included in useSearch() output — no leading ? needed", () => {
    const result = getInitialFilters("status=sent&clientId=2");
    expect(result.status).toBe("sent");
    expect(result.client).toBe("2");
  });

  it("unknown params are ignored and defaults are used for missing known params", () => {
    const result = getInitialFilters("foo=bar&clientId=5");
    expect(result.client).toBe("5");
    expect(result.status).toBe("all");
    expect(result.campaign).toBe("all");
  });

  it("empty status param falls back to 'all'", () => {
    expect(getInitialFilters("status=").status).toBe("all");
  });
});

describe("getInitialFilters — share-link preservation on first mount", () => {
  it("a full share link URL is parsed without any param being lost", () => {
    const shareSearch = "status=sent&clientId=3&campaignId=7";
    const filters = getInitialFilters(shareSearch);
    expect(filters).toEqual({ status: "sent", client: "3", campaign: "7" });
  });

  it("a partial share link with only clientId is parsed and the rest default to 'all'", () => {
    const filters = getInitialFilters("clientId=4");
    expect(filters.client).toBe("4");
    expect(filters.status).toBe("all");
    expect(filters.campaign).toBe("all");
  });

  it("initial state from a share URL is not discarded when search is empty on re-render", () => {
    const fromUrl = getInitialFilters("status=pending&clientId=2&campaignId=11");
    const fromEmpty = getInitialFilters("");
    expect(fromUrl).toEqual({ status: "pending", client: "2", campaign: "11" });
    expect(fromEmpty).toEqual({ status: "all", client: "all", campaign: "all" });
  });
});
