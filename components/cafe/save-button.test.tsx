// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { SaveButton } from "./save-button";
import { GET as readSaveStatus } from "@/app/api/personal/cafe-save-status/route";
const m = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), account: "A", success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/context/circle-context", () => ({ useCircle: () => ({ accountId: m.account }) }));
vi.mock("@/lib/actions/personal-collection-actions", () => ({ getAccountCafeSaveStatusAction: m.read }));
vi.mock("@/lib/actions/cafe-actions", () => ({ toggleSaveCafeAction: m.write, isCafeSavedAction: m.read }));
vi.mock("sonner", () => ({ toast: { success: m.success, error: m.error } }));
vi.mock("./collection-picker", () => ({ CollectionPicker: () => null }));
let root: Root, container: HTMLDivElement, cache: Map<string, never>;
const cafe = { id: "cafe", name: "Coffee", address: "Road", coordinates: [1, 2] as [number, number] };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); m.account = "A";
  m.read.mockResolvedValue({ ok: true, data: { isSaved: false, collections: [] } });
  m.write.mockResolvedValue({ success: true });
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input, "https://cafe.test");
    return readSaveStatus(new Request(url));
  }));
  cache = new Map<string, never>(); container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); Reflect.deleteProperty(navigator, "onLine"); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function render(id = "cafe", show = true) { await act(async () => root.render(<SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}>{show && <SaveButton cafe={{ ...cafe, id }} variant="sheet-action" />}</SWRConfig>)); }
it("identifies the initial lookup as a read and offers recovery without enabling a write", async () => {
  vi.useFakeTimers();
  m.read.mockImplementation(() => new Promise(() => {})); await render();
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Checking saved status");
  expect(container.textContent).not.toContain("Updating saved café");
  expect(container.querySelector("button")!.disabled).toBe(true);
  act(() => vi.advanceTimersByTime(10_000));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("taking too long");
  expect(container.querySelector("button")!.disabled).toBe(true);
  expect(m.write).not.toHaveBeenCalled();
});
it("keeps a cached save mutation guarded after ten seconds and accepts its late success without repeating it", async () => {
  await render();
  vi.useFakeTimers();
  let settle!: (value: { success: boolean }) => void;
  m.write.mockReturnValue(new Promise(resolve => { settle = resolve; }));
  const save = container.querySelector("button")!;
  await act(async () => save.click());
  expect(container.querySelector('[role="status"]')?.textContent).toContain("Updating saved café");
  expect(save.disabled).toBe(true);
  act(() => vi.advanceTimersByTime(10_000));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("not confirmed");
  expect(container.querySelector(".animate-spin")).toBeNull();
  act(() => save.click());
  expect(m.write).toHaveBeenCalledOnce();
  await act(async () => settle({ success: true }));
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(m.write).toHaveBeenCalledOnce();
});
it("reuses a warm status on actual remount", async () => {
  await render(); await render("cafe", false); await render();
  expect(m.read).toHaveBeenCalledTimes(1);
});
it("refreshes only the saved cafe status while another cafe is mounted", async () => {
  await act(async () => root.render(<SWRConfig value={{ provider: () => cache }}>
    <SaveButton cafe={cafe} variant="sheet-action" />
    <SaveButton cafe={{ ...cafe, id: "other" }} variant="sheet-action" />
  </SWRConfig>));
  expect(m.read.mock.calls.map((call) => call[1])).toEqual(["cafe", "other"]);
  m.read.mockClear();
  m.read.mockResolvedValue({ ok: true, data: { isSaved: true, collections: ["Favorites"] } });
  await act(async () => container.querySelector("button")!.click());
  expect(m.read.mock.calls.map((call) => call[1])).toEqual(["cafe"]);
  expect(container.querySelectorAll("button")[1].textContent).toBe("Save");
});
it("reads saved status through a private GET outside the Server Action queue", async () => {
  await render("mapbox:place+123");
  expect(fetch).toHaveBeenCalledWith(
    "/api/personal/cafe-save-status?accountId=A&cafeId=mapbox%3Aplace%2B123",
    { cache: "no-store", credentials: "same-origin" },
  );
});
it("resets a saved café when the café or account changes", async () => {
  m.read.mockResolvedValueOnce({ ok: true, data: { isSaved: true, collections: ["Trips"] } });
  await render(); expect(container.textContent).toContain("Trips");
  await render("other"); expect(container.textContent).toContain("Save");
  m.account = "B"; await render(); expect(container.textContent).toContain("Save");
});
it("offers retry and disables mutation when status fails", async () => {
  m.read.mockResolvedValue({ ok: false, status: 503, error: "Unavailable" }); await render();
  expect(container.textContent).toContain("Try again");
  expect(container.querySelector("button")!.disabled).toBe(true);
});
it("rolls back a rejected write and handles offline clicks", async () => {
  await render(); m.write.mockRejectedValue(new Error("Network"));
  await act(async () => container.querySelector("button")!.click());
  expect(container.textContent).toContain("Save"); expect(m.error).toHaveBeenCalled();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  await act(async () => container.querySelector("button")!.click()); expect(m.write).toHaveBeenCalledTimes(1);
});
it("suppresses late write feedback after changing scope", async () => {
  let resolve!: (value: { success: boolean }) => void;
  m.write.mockImplementation(() => new Promise((done) => { resolve = done; }));
  await render(); await act(async () => container.querySelector("button")!.click()); await render("other");
  await act(async () => resolve({ success: true }));
  expect(m.success).not.toHaveBeenCalled(); expect(container.textContent).toContain("Save");
});
it("keeps a committed save when the server cannot refresh its views", async () => {
  await render();
  m.write.mockResolvedValue({ success: true, refreshFailed: true });
  m.read.mockResolvedValue({ ok: true, data: { isSaved: true, collections: ["Favorites"] } });
  await act(async () => container.querySelector("button")!.click());
  expect(container.textContent).toContain("Favorites");
  expect(m.error).toHaveBeenCalledWith(expect.stringContaining("refresh"));
});
it("updates the original café cache after navigating during its write", async () => {
  let resolve!: (value: { success: boolean }) => void;
  let saved = false;
  m.read.mockImplementation(async (_account: string, id: string) => ({ ok: true, data: { isSaved: saved && id === "cafe", collections: saved && id === "cafe" ? ["Favorites"] : [] } }));
  m.write.mockImplementation(() => new Promise((done) => { resolve = done; }));
  await render();
  await act(async () => container.querySelector("button")!.click());
  await render("other"); saved = true;
  await act(async () => resolve({ success: true }));
  await render();
  expect(container.textContent).toContain("Favorites");
  expect(m.success).not.toHaveBeenCalled();
});
it("keeps the other collection saved after removing one membership", async () => {
  m.read.mockResolvedValue({ ok: true, data: { isSaved: true, collections: ["Trips", "Favorites"] } });
  await render();
  m.read.mockResolvedValue({ ok: true, data: { isSaved: true, collections: ["Favorites"] } });
  await act(async () => container.querySelector("button")!.click());
  expect(container.textContent).toContain("Favorites");
  expect(m.write).toHaveBeenCalledWith(expect.objectContaining({ collection: "Trips", isSaving: false, expectedAccountId: "A" }));
});
it("discards an older lookup that resolves after saving", async () => {
  vi.useFakeTimers();
  try {
    await render();
    let resolve!: (value: unknown) => void;
    m.read.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    await act(async () => { vi.advanceTimersByTime(60_001); });
    m.read.mockResolvedValue({ ok: true, data: { isSaved: true, collections: ["Favorites"] } });
    await act(async () => container.querySelector("button")!.click());
    await act(async () => resolve({ ok: true, data: { isSaved: false, collections: [] } }));
    expect(container.textContent).toContain("Favorites");
  } finally { vi.useRealTimers(); }
});
it("does not issue a read for a supplied card status but still writes its collection", async () => {
  await act(async () => root.render(<SWRConfig value={{ provider: () => cache }}><SaveButton cafe={cafe} variant="card" initialIsSaved collection="Trips" /></SWRConfig>));
  expect(m.read).not.toHaveBeenCalled();
  await act(async () => container.querySelector("button")!.click());
  expect(m.write).toHaveBeenCalledWith(expect.objectContaining({ collection: "Trips", isSaving: false }));
});
it("uses complete cached membership ahead of a card fallback", async () => {
  m.read.mockResolvedValue({ ok: true, data: { isSaved: true, collections: ["Favorites"] } });
  await render();
  await act(async () => root.render(<SWRConfig value={{ provider: () => cache }}><SaveButton cafe={cafe} variant="card" initialIsSaved={false} /></SWRConfig>));
  expect(container.querySelector("button")!.getAttribute("aria-label")).toBe("Unsave café");
});
it("retains cached membership while revalidating after sixty seconds", async () => {
  vi.useFakeTimers();
  try {
    m.read.mockResolvedValueOnce({ ok: true, data: { isSaved: true, collections: ["Trips"] } });
    await render(); m.read.mockImplementation(() => new Promise(() => {}));
    await act(async () => { vi.advanceTimersByTime(60_001); });
    expect(m.read).toHaveBeenCalledTimes(2); expect(container.textContent).toContain("Trips");
    expect(container.querySelector(".animate-spin")).toBeNull();
  } finally { vi.useRealTimers(); }
});
it("hides a warm saved membership after authentication expires", async () => {
  vi.useFakeTimers();
  try {
    m.read.mockResolvedValueOnce({ ok: true, data: { isSaved: true, collections: ["Trips"] } });
    await render();
    m.read.mockResolvedValue({ ok: false, status: 401, error: "Session expired" });
    await act(async () => { vi.advanceTimersByTime(60_001); });
    expect(container.textContent).not.toContain("Trips");
    expect(container.querySelector("button")!.disabled).toBe(true);
    expect(container.textContent).toContain("Try again");
  } finally { vi.useRealTimers(); }
});
