import { describe, expect, it, vi } from "vitest";
import { readAllPages } from "./read-all-pages";

describe("readAllPages", () => {
  it("continues after an exactly full page until an empty page confirms completion", async () => {
    const data = Array.from({ length: 2000 }, (_, id) => ({ id }));
    const fetchPage = vi.fn(async (from: number, to: number) => ({ data: data.slice(from, to + 1), error: null }));
    expect(await readAllPages(fetchPage)).toEqual(data);
    expect(fetchPage.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("rejects instead of returning a partial result when the network fails midstream", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null }).mockRejectedValueOnce(new Error("Network unavailable"));
    await expect(readAllPages(fetchPage)).rejects.toThrow("Network unavailable");
  });
});
