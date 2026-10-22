import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAccountCafeSaveStatusAction } = vi.hoisted(() => ({
  getAccountCafeSaveStatusAction: vi.fn(),
}));

vi.mock("@/lib/actions/personal-collection-actions", () => ({
  getAccountCafeSaveStatusAction,
}));

import { GET } from "./route";

const request = (query: string) => new Request(`http://localhost/api/personal/cafe-save-status?${query}`);

function expectPrivateNoStore(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
}

describe("GET /api/personal/cafe-save-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the saved status and forwards trimmed, decoded identifiers", async () => {
    getAccountCafeSaveStatusAction.mockResolvedValue({
      ok: true,
      data: { isSaved: true, collections: ["Favorites"] },
    });

    const response = await GET(request("accountId=%20account-1%20&cafeId=place%2B123"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ isSaved: true, collections: ["Favorites"] });
    expect(getAccountCafeSaveStatusAction).toHaveBeenCalledExactlyOnceWith("account-1", "place+123");
    expectPrivateNoStore(response);
  });

  it("returns a successful unsaved status", async () => {
    getAccountCafeSaveStatusAction.mockResolvedValue({
      ok: true,
      data: { isSaved: false, collections: [] },
    });

    const response = await GET(request("accountId=account-1&cafeId=place-123"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ isSaved: false, collections: [] });
    expectPrivateNoStore(response);
  });

  it.each([
    ["missing accountId", "cafeId=place-123"],
    ["missing cafeId", "accountId=account-1"],
    ["empty accountId", "accountId=%20%20&cafeId=place-123"],
    ["empty cafeId", "accountId=account-1&cafeId=%20"],
    ["oversized accountId", `accountId=${"a".repeat(129)}&cafeId=place-123`],
    ["oversized cafeId", `accountId=account-1&cafeId=${"a".repeat(513)}`],
    ["accountId containing whitespace", "accountId=account%20one&cafeId=place-123"],
    ["cafeId containing a control character", "accountId=account-1&cafeId=place%0A123"],
  ])("rejects %s before calling the account action", async (_case, query) => {
    const response = await GET(request(query));

    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
    expect(getAccountCafeSaveStatusAction).not.toHaveBeenCalled();
    expectPrivateNoStore(response);
  });

  it.each([401, 403, 503] as const)("preserves the account action's %i failure", async (status) => {
    getAccountCafeSaveStatusAction.mockResolvedValue({
      ok: false,
      status,
      error: "Account read failed",
    });

    const response = await GET(request("accountId=account-1&cafeId=place-123"));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: "Account read failed" });
    expect(getAccountCafeSaveStatusAction).toHaveBeenCalledExactlyOnceWith("account-1", "place-123");
    expectPrivateNoStore(response);
  });

  it("hides unexpected action errors behind a generic 503", async () => {
    getAccountCafeSaveStatusAction.mockRejectedValue(new Error("sensitive database details"));

    const response = await GET(request("accountId=account-1&cafeId=place-123"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: expect.any(String) });
    expect(JSON.stringify(body)).not.toContain("sensitive database details");
    expectPrivateNoStore(response);
  });
});
