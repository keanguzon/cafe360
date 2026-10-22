// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig, type Cache } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isCafeSaveMutationKey, isPersonalCollectionKey, usePersonalCollections, useSavedCafes } from "./use-saved-cafes";
import { SWRProvider } from "@/components/providers/swr-provider";

const actions = vi.hoisted(() => ({ collections: vi.fn(), saved: vi.fn() }));
vi.mock("@/lib/actions/personal-collection-actions", () => ({ getAccountCollectionsAction: actions.collections, getAccountSavedCafesAction: actions.saved }));

let root: Root;
let container: HTMLDivElement;
let cache: Cache;
let latest: { names: string[]; savedIds: string[]; loading: boolean; collectionError: string | null; savedError: string | null; refreshCollections: () => Promise<void>; refreshSaved: () => Promise<void> };

function Probe({ accountId }: { accountId: string }) {
  const collections = usePersonalCollections(accountId);
  const saved = useSavedCafes(accountId, "Favorites");
  useEffect(() => { latest = {
    names: collections.collections.map((item) => item.name),
    savedIds: saved.savedCafes.map((item) => item.id),
    loading: collections.initialLoading || saved.initialLoading,
    collectionError: collections.error,
    savedError: saved.error,
    refreshCollections: collections.refresh,
    refreshSaved: saved.refresh,
  }; });
  return null;
}

function render(accountId: string) {
  act(() => root.render(<SWRConfig value={{ provider: () => cache, revalidateOnFocus: false, shouldRetryOnError: false }}><Probe accountId={accountId} /></SWRConfig>));
}
function renderWithRealProvider(accountId: string) {
  act(() => root.render(<SWRProvider><Probe accountId={accountId} /></SWRProvider>));
}
async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  actions.collections.mockResolvedValue({ ok: true, data: [{ name: "Favorites", count: 1, lastSavedAt: "today", sampleCafes: [] }] });
  actions.saved.mockResolvedValue({ ok: true, data: [{ id: "saved-A", user_id: "A", cafe_id: "cafe", collection: "Favorites", notes: null, created_at: "today" }] });
  cache = new Map();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("personal collection cache", () => {
  it.each([
    [["personal-collections", "A"], true],
    [["personal-saved-cafes", "A", "Favorites"], true],
    [["personal-saved-cafes", "A", "Trips"], true],
    [["personal-cafe-save-status", "A", "cafe"], true],
    [["personal-cafe-save-status", "A", "other"], false],
    [["personal-cafe-save-status", "B", "cafe"], false],
    [["personal-collections", "B"], false],
    [["circle-data", "A", "cafe"], false],
    [null, false],
  ])("scopes a cafe save refresh for key %j", (key, expected) => {
    expect(isCafeSaveMutationKey(key, "A", "cafe")).toBe(expected);
  });
  it("targets only the current account's personal resource keys", () => {
    expect(isPersonalCollectionKey(["personal-collections", "A"], "A")).toBe(true);
    expect(isPersonalCollectionKey(["personal-saved-cafes", "A", "Favorites"], "A")).toBe(true);
    expect(isPersonalCollectionKey(["personal-cafe-save-status", "A", "cafe"], "A")).toBe(true);
    expect(isPersonalCollectionKey(["personal-cafe-save-status", "B", "cafe"], "A")).toBe(false);
    expect(isPersonalCollectionKey(["personal-collections", "B"], "A")).toBe(false);
    expect(isPersonalCollectionKey(["circle-data", "A", "circle"], "A")).toBe(false);
  });
  it("shows a warm account resource on remount without a new read", async () => {
    render("A");
    await settle();
    expect(latest).toMatchObject({ names: ["Favorites"], savedIds: ["saved-A"], loading: false });
    render("A");
    expect(latest).toMatchObject({ names: ["Favorites"], savedIds: ["saved-A"], loading: false });
    expect(actions.saved).toHaveBeenCalledTimes(1);
  });

  it("never displays the previous account's collection on a switch", async () => {
    render("A");
    await settle();
    actions.collections.mockImplementation(() => new Promise(() => undefined));
    actions.saved.mockImplementation(() => new Promise(() => undefined));
    render("B");
    expect(latest).toMatchObject({ names: [], savedIds: [], loading: true });
  });

  it.each([401, 403])("hides both warm personal resources after a %i collection response", async (status) => {
    render("A");
    await settle();
    actions.collections.mockResolvedValueOnce({ ok: false, status, error: "Access expired" });
    await act(async () => { await latest.refreshCollections(); });
    expect(latest.names).toEqual([]);
    expect(latest.savedIds).toEqual([]);
  });

  it("keeps warm personal resources after a transient 503", async () => {
    render("A");
    await settle();
    actions.saved.mockResolvedValueOnce({ ok: false, status: 503, error: "Database unavailable" });
    await act(async () => { await latest.refreshSaved(); });
    expect(latest.names).toEqual(["Favorites"]);
    expect(latest.savedIds).toEqual(["saved-A"]);
    expect(latest.savedError).toBe("Database unavailable");
  });

  it("keeps auth denial distinguishable from an empty library under the real provider", async () => {
    renderWithRealProvider("A");
    await settle();
    actions.collections.mockResolvedValueOnce({ ok: false, status: 401, error: "Session expired" });
    await act(async () => { await latest.refreshCollections(); });
    await settle();
    expect(latest.names).toEqual([]);
    expect(latest.savedIds).toEqual([]);
    expect(latest.collectionError).toBe("Session expired");
    await act(async () => { await latest.refreshCollections(); });
    expect(latest.names).toEqual(["Favorites"]);
    expect(latest.collectionError).toBeNull();
  });
});
