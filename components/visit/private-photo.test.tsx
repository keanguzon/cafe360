// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivatePhoto } from "./private-photo";

const { signVisitPhotoActionMock, useCircleMock } = vi.hoisted(() => ({
  signVisitPhotoActionMock: vi.fn(),
  useCircleMock: vi.fn(),
}));

vi.mock("@/lib/actions/photo-actions", () => ({
  signVisitPhotoAction: signVisitPhotoActionMock,
}));

vi.mock("@/lib/context/circle-context", () => ({
  useCircle: useCircleMock,
}));

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("PrivatePhoto", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    useCircleMock.mockReturnValue({
      accountId: "account-1",
      userCircles: [{ id: "circle-1" }, { id: "circle-2" }],
      activeCircle: { id: "circle-1", name: "Circle 1" },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("renders signed photo and hides expired URLs with an explicit retry button", async () => {
    signVisitPhotoActionMock.mockResolvedValueOnce({
      success: true,
      url: "https://example.test/signed-expired.jpg",
      expiresAt: Date.now() - 1_000,
    });

    act(() => {
      root?.render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
          <PrivatePhoto path="user-1/photo.jpg" />
        </SWRConfig>,
      );
    });
    await settle();

    const retryBtn = container.querySelector("button");
    expect(retryBtn?.textContent).toBe("Retry");
    expect(retryBtn?.getAttribute("aria-label")).toContain("Photo unavailable");

    signVisitPhotoActionMock.mockResolvedValueOnce({
      success: true,
      url: "https://example.test/signed-fresh.jpg",
      expiresAt: Date.now() + 60_000,
    });

    await act(async () => {
      retryBtn?.click();
    });
    await settle();

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.test/signed-fresh.jpg");
  });

  it("scopes its SWR cache key to an explicit groupId instead of activeCircle", async () => {
    const cache = new Map();
    signVisitPhotoActionMock.mockResolvedValueOnce({
      success: true,
      url: "https://example.test/circle-2-photo.jpg",
      expiresAt: Date.now() + 60_000,
    });

    act(() => {
      root?.render(
        <SWRConfig value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false }}>
          <PrivatePhoto path="user-2/photo.jpg" groupId="circle-2" />
        </SWRConfig>,
      );
    });
    await settle();

    const keys = Array.from(cache.keys()).map((key) => String(key));
    expect(keys.some((key) => key.includes("circle-2"))).toBe(true);
    expect(keys.some((key) => key.includes("circle-1"))).toBe(false);
  });

  it("keeps thumbnail recovery compact and restarts its deadline on retry and scope change", async () => {
    vi.useFakeTimers();
    signVisitPhotoActionMock.mockImplementation(() => new Promise(() => {}));
    const cache = new Map();
    const render = (path: string) => act(() => root?.render(<SWRConfig value={{ provider: () => cache }}><PrivatePhoto path={path}/></SWRConfig>));
    render("first.jpg"); await settle();
    expect(container.querySelector('[role="status"]')?.getAttribute("aria-label")).toBe("Loading photo…");
    expect(container.querySelector("button")).toBeNull();
    act(() => vi.advanceTimersByTime(9_999)); expect(container.querySelector("button")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    const retry = container.querySelector("button")!;
    expect(retry.textContent).toBe("Retry");
    expect(retry.getAttribute("aria-label")).toContain("taking too long");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("taking too long");
    expect(container.querySelectorAll("button")).toHaveLength(1);
    await act(async () => retry.click());
    expect(container.querySelector("button")).toBeNull();
    act(() => vi.advanceTimersByTime(10_000)); expect(container.querySelector("button")).not.toBeNull();
    render("second.jpg"); await settle();
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});
