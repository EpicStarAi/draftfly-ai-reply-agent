/**
 * Clients route tests
 *
 * Verifies the channel ID guard on POST /api/clients and PATCH /api/clients/:id:
 *  - Placeholder / malformed channel values → 422 with descriptive error
 *  - Valid Slack channel IDs (C… or G…) → 201/200 with the created/updated client
 */

import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";

// ─── Hoisted mock variables ────────────────────────────────────────────────────

const { mockInsertReturning, mockUpdateReturning } = vi.hoisted(() => {
  const clientRow = {
    id: 1,
    name: "Acme",
    company: "Acme Corp",
    slackChannel: "C012AB3CD45",
    slackWorkspaceId: null,
    slackBotToken: null,
    mode: "draft" as const,
    lemlistApiKey: null,
    n8nWebhookUrl: null,
    isActive: true,
    createdAt: new Date("2024-01-01"),
  };

  const mockInsertReturning = vi.fn(() => Promise.resolve([clientRow]));
  const mockUpdateReturning = vi.fn(() => Promise.resolve([clientRow]));

  return { mockInsertReturning, mockUpdateReturning };
});

// ─── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ _col, _val })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
}));

vi.mock("@workspace/db", () => {
  const clientsTable = { _name: "clients" };

  return {
    clientsTable,
    db: {
      select: () => ({
        from: (_table: object) => ({
          where: () => Promise.resolve([]),
          orderBy: () => Promise.resolve([]),
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: mockInsertReturning,
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: mockUpdateReturning,
          }),
        }),
      }),
      delete: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    },
  };
});

// ─── App import (must come after vi.mock calls) ────────────────────────────────

import request from "supertest";
import app from "../app";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/clients — Slack channel ID guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  const validBase = {
    name: "Acme",
    mode: "draft",
  };

  it("returns 422 when slackChannel is a placeholder name like #axiom-replies", async () => {
    const res = await request(app)
      .post("/api/clients")
      .send({ ...validBase, slackChannel: "#axiom-replies" });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "Validation failed" });
    expect(mockInsertReturning).not.toHaveBeenCalled();
  });

  it("returns 422 when slackChannel is a channel name without hash", async () => {
    const res = await request(app)
      .post("/api/clients")
      .send({ ...validBase, slackChannel: "general" });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "Validation failed" });
    expect(mockInsertReturning).not.toHaveBeenCalled();
  });

  it("returns 422 when slackChannel starts with lowercase c (must be uppercase)", async () => {
    const res = await request(app)
      .post("/api/clients")
      .send({ ...validBase, slackChannel: "c012AB3CD45" });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "Validation failed" });
    expect(mockInsertReturning).not.toHaveBeenCalled();
  });

  it("returns 422 when slackChannel is too short (fewer than 10 chars after C/G)", async () => {
    const res = await request(app)
      .post("/api/clients")
      .send({ ...validBase, slackChannel: "C012AB3" });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "Validation failed" });
    expect(mockInsertReturning).not.toHaveBeenCalled();
  });

  it("returns 422 when slackChannel is missing entirely", async () => {
    const res = await request(app)
      .post("/api/clients")
      .send({ ...validBase });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "Validation failed" });
    expect(mockInsertReturning).not.toHaveBeenCalled();
  });

  it("returns 201 and calls insert when slackChannel is a valid C… ID", async () => {
    const res = await request(app)
      .post("/api/clients")
      .send({ ...validBase, slackChannel: "C012AB3CD45" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ slackChannel: "C012AB3CD45" });
    expect(mockInsertReturning).toHaveBeenCalledTimes(1);
  });

  it("returns 201 and calls insert when slackChannel is a valid G… (group) ID", async () => {
    const mockRow = expect.objectContaining({ slackChannel: "G1234567890" });
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: 2,
        name: "Acme",
        company: null,
        slackChannel: "G1234567890",
        slackWorkspaceId: null,
        slackBotToken: null,
        mode: "draft" as const,
        lemlistApiKey: null,
        n8nWebhookUrl: null,
        isActive: true,
        createdAt: new Date("2024-01-01"),
      },
    ]);

    const res = await request(app)
      .post("/api/clients")
      .send({ ...validBase, slackChannel: "G1234567890" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(mockRow);
    expect(mockInsertReturning).toHaveBeenCalledTimes(1);
  });
});

describe("PATCH /api/clients/:id — Slack channel ID guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("returns 422 when patching with a placeholder channel name", async () => {
    const res = await request(app)
      .patch("/api/clients/1")
      .send({ slackChannel: "#my-channel" });

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "Validation failed" });
    expect(mockUpdateReturning).not.toHaveBeenCalled();
  });

  it("returns 200 when patching with a valid channel ID", async () => {
    const updatedRow = {
      id: 1,
      name: "Acme",
      company: null,
      slackChannel: "C0BK6NPBHKJ",
      slackWorkspaceId: null,
      slackBotToken: null,
      mode: "draft" as const,
      lemlistApiKey: null,
      n8nWebhookUrl: null,
      isActive: true,
      createdAt: new Date("2024-01-01"),
    };
    mockUpdateReturning.mockResolvedValueOnce([updatedRow]);

    const res = await request(app)
      .patch("/api/clients/1")
      .send({ slackChannel: "C0BK6NPBHKJ" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ slackChannel: "C0BK6NPBHKJ" });
    expect(mockUpdateReturning).toHaveBeenCalledTimes(1);
  });
});
