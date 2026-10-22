// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig, unstable_serialize, useSWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionPicker } from "./collection-picker";
import { personalCollectionsKey } from "@/lib/hooks/use-saved-cafes";
import type { CollectionSummary } from "@/lib/types/saved-cafe";

const { getUserCollectionsActionMock, accountCollections, identity } = vi.hoisted(() => ({
  getUserCollectionsActionMock: vi.fn<() => Promise<CollectionSummary[]>>(async () => []),
  accountCollections: vi.fn(),
  identity: { accountId: "account-1" },
}));

vi.mock("@/lib/actions/cafe-actions", () => ({
  getUserCollectionsAction: getUserCollectionsActionMock,
}));

vi.mock("@/lib/context/circle-context", () => ({
  useCircle: () => identity,
}));
vi.mock("@/lib/actions/personal-collection-actions", () => ({ getAccountCollectionsAction: accountCollections }));

function ClearCollections() {
  const { mutate } = useSWRConfig();
  return <button onClick={() => { void mutate(personalCollectionsKey("account-1"), undefined, { revalidate: false }); }}>Clear collections</button>;
}

describe("CollectionPicker", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    getUserCollectionsActionMock.mockResolvedValue([]);
    identity.accountId = "account-1";
    accountCollections.mockResolvedValue({ ok: true, data: [] });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("disables saving offline and permits a manual retry after reconnecting", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    try {
      await act(async () => root.render(<CollectionPicker isOpen onClose={onClose} selectedCollection="Favorites" onSelectCollection={onSelect} cafeName="Test Café" initialNotes="Keep my draft" />));
      const save = () => document.querySelector<HTMLButtonElement>("button[data-save-collection]")!;
      expect(save().disabled).toBe(true);
      expect(document.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("Keep my draft");
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      await act(async () => { window.dispatchEvent(new Event("online")); });
      expect(onSelect).not.toHaveBeenCalled();
      expect(save().disabled).toBe(false);
      await act(async () => save().click());
      expect(onSelect).toHaveBeenCalledWith("Favorites", "Keep my draft");
    } finally {
      Reflect.deleteProperty(navigator, "onLine");
    }
  });

  it("awaits a save, stays open on failure, and closes only after a successful retry", async () => {
    let rejectSave!: (error: Error) => void;
    const onSelect = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectSave = reject; }))
      .mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    await act(async () => root.render(<CollectionPicker
      isOpen onClose={onClose} selectedCollection="Favorites"
      onSelectCollection={onSelect} cafeName="Test Café"
    />));
    const save = () => document.querySelector<HTMLButtonElement>("button[data-save-collection]")!;
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => save().click());
    expect(save().disabled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => rejectSave(new Error("Could not save")));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Could not save");
    expect(onClose).not.toHaveBeenCalled();
    expect(save().disabled).toBe(false);
    await act(async () => save().click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("uses warm personal collections cache without calling getUserCollectionsAction on open", async () => {
    const cache = new Map();
    cache.set(unstable_serialize(personalCollectionsKey("account-1")), {
      data: {
        items: [{ name: "Favorites", count: 2, coverImage: null }],
        fetchedAt: Date.now(),
      },
    });

    await act(async () =>
      root.render(
        <SWRConfig value={{ provider: () => cache }}>
          <CollectionPicker
            isOpen
            onClose={vi.fn()}
            selectedCollection="Favorites"
            onSelectCollection={vi.fn()}
            cafeName="Test Café"
          />
        </SWRConfig>,
      ),
    );

    expect(getUserCollectionsActionMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Favorites");
    expect(document.body.textContent).toContain("(2)");
  });

  it("never renders a late response from a previous account", async () => {
    let resolveOld!: (value: CollectionSummary[]) => void;
    const old = new Promise<CollectionSummary[]>((resolve) => { resolveOld = resolve; });
    getUserCollectionsActionMock.mockImplementationOnce(() => old);
    accountCollections.mockImplementationOnce(async () => ({ ok: true, data: await old }));
    const cache = new Map();
    const render = () => root.render(<SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}><CollectionPicker isOpen onClose={vi.fn()} selectedCollection="Favorites" onSelectCollection={vi.fn()} cafeName="Coffee" /></SWRConfig>);
    await act(async () => render());
    identity.accountId = "account-2";
    await act(async () => render());
    await act(async () => resolveOld([{ name: "A private list", count: 1, lastSavedAt: "2026-10-19", sampleCafes: [] }]));
    expect(document.body.textContent).not.toContain("A private list");
  });

  it("waits until the picker opens before reading collections", async () => {
    const cache = new Map();
    const render = (isOpen: boolean) => root.render(<SWRConfig value={{ provider: () => cache }}><CollectionPicker isOpen={isOpen} onClose={vi.fn()} selectedCollection="Favorites" onSelectCollection={vi.fn()} cafeName="Coffee" /></SWRConfig>);
    await act(async () => render(false));
    expect(accountCollections).not.toHaveBeenCalled();
    await act(async () => render(true));
    expect(accountCollections).toHaveBeenCalledWith("account-1");
  });

  it("hides expired warm names and retries the account read", async () => {
    const cache = new Map();
    cache.set(unstable_serialize(personalCollectionsKey("account-1")), { data: { items: [{ name: "Expired list", count: 1, coverImage: null }], fetchedAt: 0 } });
    accountCollections.mockResolvedValueOnce({ ok: false, status: 403, error: "Access expired" });
    await act(async () => root.render(<SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}><CollectionPicker isOpen onClose={vi.fn()} selectedCollection="Favorites" onSelectCollection={vi.fn()} cafeName="Coffee" /></SWRConfig>));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(document.body.textContent).not.toContain("Expired list");
    expect(document.body.textContent).toContain("Access expired");
    accountCollections.mockResolvedValueOnce({ ok: true, data: [{ name: "Recovered list", count: 1, coverImage: null }] });
    await act(async () => Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "Try again")!.click());
    expect(document.body.textContent).toContain("Recovered list");
  });

  it("reacts immediately when the account collections cache is cleared", async () => {
    const cache = new Map();
    cache.set(unstable_serialize(personalCollectionsKey("account-1")), { data: { items: [{ name: "Private cached list", count: 1, lastSavedAt: "2026-10-19", sampleCafes: [] }], fetchedAt: Date.now() } });
    await act(async () => root.render(<SWRConfig value={{ provider: () => cache }}><ClearCollections /><CollectionPicker isOpen onClose={vi.fn()} selectedCollection="Favorites" onSelectCollection={vi.fn()} cafeName="Coffee" /></SWRConfig>));
    expect(document.body.textContent).toContain("Private cached list");
    await act(async () => Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "Clear collections")!.click());
    expect(document.body.textContent).not.toContain("Private cached list");
  });
});


