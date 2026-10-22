// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CafePhotos } from "./cafe-photos";

const { context, sign } = vi.hoisted(() => ({ context: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/context/circle-context", () => ({ useCircle: context }));
vi.mock("@/lib/actions/photo-actions", () => ({ signVisitPhotoAction: sign }));

describe("CafePhotos Circle cover", () => {
  let container: HTMLDivElement;
  let root: Root;
  let state: ReturnType<typeof makeState>;
  const cache = () => new Map();
  const makeState = () => ({
    userCircles: [{ id: "circle-a" }, { id: "circle-b" }],
    accountId: "account-a", activeCircle: { id: "circle-a" }, isLoading: false, error: null as string | null,
    circleCafeSummaries: [{ internalId: "internal-cafe", providerId: "provider-cafe" }],
    circleVisits: [
      { group_id: "circle-a", cafe_id: "internal-cafe", photos: [{ id: "photo", storage_path: "private/path.jpg" }] },
      { group_id: "circle-b", cafe_id: "internal-cafe", photos: [{ id: "other-circle", storage_path: "wrong-circle.jpg" }] },
      { group_id: "circle-a", cafe_id: "other-cafe", photos: [{ id: "other-cafe", storage_path: "wrong-cafe.jpg" }] },
    ],
  });
  async function render(cafeId = "provider-cafe", photos: string[] = []) {
    await act(async () => {
      root.render(<SWRConfig value={{ provider: cache, dedupingInterval: 0 }}><CafePhotos cafeId={cafeId} cafeName="Cafe" photos={photos} /></SWRConfig>);
      await Promise.resolve();
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    state = makeState();
    context.mockImplementation(() => state);
    sign.mockImplementation(async () => ({ success: true, url: `https://signed.test/${state.accountId}.jpg`, expiresAt: Date.now() + 60_000 }));
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it.each(["provider-cafe", "internal-cafe"])("signs only matching Circle paths for %s instead of using a raw private path", async (id) => {
    await render(id, ["https://provider.test/photo.jpg"]);
    expect(sign.mock.calls).toEqual([["private/path.jpg"]]);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://signed.test/account-a.jpg");
    expect(container.textContent).not.toContain("No photos uploaded yet");
  });

  it("matches provider identity carried by the visit when no summary is available", async () => {
    state.circleCafeSummaries = [];
    Object.assign(state.circleVisits[0], { cafe: { provider_place_id: "provider-cafe" } });
    await render();
    expect(sign).toHaveBeenCalledWith("private/path.jpg");
  });

  it("removes old private covers immediately on Circle, cafe and no-Circle transitions", async () => {
    await render();
    state.activeCircle = { id: "circle-b" };
    state.circleVisits = [];
    await render();
    expect(container.querySelector("img")).toBeNull();
    state = makeState();
    await render();
    await render("different-cafe");
    expect(container.querySelector("img")).toBeNull();
    Object.assign(state, { activeCircle: null });
    await render();
    expect(container.querySelector("img")).toBeNull();
  });

  it("does not retain a signed URL while the next account's cover is loading", async () => {
    await render();
    sign.mockImplementation(() => new Promise(() => {}));
    state.accountId = "account-b";
    await render();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[role="status"]')?.getAttribute("aria-label")).toContain("Loading photo");
  });

  it("does not sign stale visit paths without an account or active Circle", async () => {
    state.accountId = "";
    await render();
    expect(sign).not.toHaveBeenCalled();
    state = makeState();
    Object.assign(state, { activeCircle: null });
    await render();
    expect(sign).not.toHaveBeenCalled();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows a retry when a private photo cannot be signed", async () => {
    sign.mockResolvedValue({ success: false, error: "Access denied" });
    await render();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("button")?.textContent).toBe("Retry");
    expect(container.querySelector("button")?.getAttribute("aria-label")).toContain("Photo unavailable");
    expect(container.textContent).not.toContain("No cover photo available");
  });

  it("signs at most five unique cover paths in supplied visit order", async () => {
    state.circleVisits = [
      { group_id: "circle-a", cafe_id: "internal-cafe", photos: [
        { id: "first", storage_path: "first.jpg" },
        { id: "duplicate", storage_path: "first.jpg" },
        ...Array.from({ length: 8 }, (_, index) => ({ id: `photo-${index}`, storage_path: `photo-${index}.jpg` })),
      ] },
    ];
    await render();
    expect(sign.mock.calls).toEqual([
      ["first.jpg"], ["photo-0.jpg"], ["photo-1.jpg"], ["photo-2.jpg"], ["photo-3.jpg"],
    ]);
    expect(container.querySelectorAll("img")).toHaveLength(5);
  });

  it("uses provider fallback and truthful empty, loading and error states", async () => {
    state.circleVisits = [];
    await render(undefined, ["https://provider.test/photo.jpg"]);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://provider.test/photo.jpg");
    await render();
    expect(container.textContent).toContain("No cover photo available");
    state.isLoading = true;
    await render();
    expect(container.textContent).toContain("Loading Circle photos");
    state.isLoading = false;
    state.error = "unavailable";
    await render();
    expect(container.textContent).toContain("Circle photos unavailable");
  });
});
