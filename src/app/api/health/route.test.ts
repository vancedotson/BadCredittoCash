import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: mocks.select }),
  }),
}));

import { GET } from "./route";

describe("public health endpoint", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reports healthy without exposing dependency details", async () => {
    mocks.select.mockResolvedValue({ error: null });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns a retryable failure without exposing the database error", async () => {
    mocks.select.mockResolvedValue({ error: { message: "private database detail" } });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
  });
});
