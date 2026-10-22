// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CollectionView } from "./collection-view";
import { CollectionCard } from "./collection-card";
import { CafeDetailSheet } from "./cafe-detail-sheet";
import { usePersonalCollections } from "@/lib/hooks/use-saved-cafes";

const m = vi.hoisted(() => ({ accountId: "A", saved: vi.fn(), summaries: vi.fn(), write: vi.fn(), deleteCollection: vi.fn(), memberships: new Set<string>() }));
vi.mock("@/lib/context/circle-context", () => ({ useCircle: () => ({ accountId: m.accountId, activeCircle: {id:"circle-a"}, circleCafeSummaries: [] }) }));
vi.mock("@/lib/actions/personal-collection-actions", () => ({ getAccountSavedCafesAction: m.saved, getAccountCollectionsAction: m.summaries, getAccountCafeSaveStatusAction: vi.fn() }));
vi.mock("@/lib/actions/cafe-actions", () => ({ toggleSaveCafeAction: m.write, deleteCollectionAction: m.deleteCollection }));
vi.mock("./collection-picker", () => ({ CollectionPicker: ({ isOpen, onSelectCollection }: { isOpen: boolean; onSelectCollection: (name: string) => Promise<void> }) => isOpen ? <button onClick={() => { void onSelectCollection("Work"); }}>Choose Work</button> : null }));
vi.mock("@/components/layout/bottom-sheet", () => ({ BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) => isOpen ? <div>{children}</div> : null }));
vi.mock("./group-relationship", () => ({ GroupRelationship: () => null }));
vi.mock("./cafe-photos", () => ({ CafePhotos: () => null }));
vi.mock("./interest-button", () => ({ InterestButton: () => null }));
vi.mock("./circle-save-button", () => ({ CircleSaveButton: () => null }));
vi.mock("./cafe-hours-section", () => ({ CafeHoursSection: () => null }));
vi.mock("@/components/visit/visit-timeline-fetcher", () => ({ VisitTimelineFetcher: () => null }));
vi.mock("@/components/visit/log-visit-form", () => ({ LogVisitForm: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let root: Root, container: HTMLDivElement;
const cafe = { id: "cafe", name: "Coffee", address: "Road", coordinates: [1, 2] as [number, number] };
const row = { id: "save", cafe_id: "internal", cafe, collection: "Favorites", notes: null };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks(); m.accountId = "A"; m.memberships = new Set(["Favorites"]);
  m.saved.mockImplementation(async (_account: string, collection: string) => ({ ok: true, data: m.memberships.has(collection) ? [{ ...row, collection }] : [] }));
  m.summaries.mockImplementation(async () => ({ ok: true, data: [...m.memberships].map((name) => ({ name, count: 1, lastSavedAt: "2026-10-19", sampleCafes: ["Coffee"] })) }));
  m.write.mockImplementation(async ({ collection, isSaving }: { collection: string; isSaving: boolean }) => { if (isSaving) m.memberships.add(collection); else m.memberships.delete(collection); return { success: true }; });
  m.deleteCollection.mockImplementation(async (name: string) => { m.memberships.delete(name); return { success: true }; });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function render() { const cache = new Map(); await act(async () => root.render(<SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}><section data-collection="Favorites"><CollectionView collectionName="Favorites" /></section><section data-collection="Work"><CollectionView collectionName="Work" /></section></SWRConfig>)); }
const favorites = () => container.querySelector('[data-collection="Favorites"]')!;
const work = () => container.querySelector('[data-collection="Work"]')!;

it("keeps Favorites visible after Organize adds Work", async () => {
  await render();
  act(() => favorites().querySelector("h4")!.click());
  act(() => Array.from(favorites().querySelectorAll("button")).find((button) => button.textContent === "Organize")!.click());
  await act(async () => Array.from(favorites().querySelectorAll("button")).find((button) => button.textContent === "Choose Work")!.click());
  expect(favorites().textContent).toContain("Saved in Favorites");
  expect(work().textContent).toContain("Saved in Work");
  expect(m.write).toHaveBeenCalledWith(expect.objectContaining({ collection: "Work", isSaving: true, expectedAccountId: "A" }));
});

it("removes only the Favorites row after its successful removal", async () => {
  await render();
  m.memberships.add("Work");
  await act(async () => favorites().querySelector<HTMLButtonElement>('button[aria-label="Unsave café"]')!.click());
  expect(favorites().textContent).not.toContain("Saved in Favorites");
  expect(favorites().textContent).toContain("This collection is empty");
  expect(work().textContent).toContain("Saved in Work");
});

it("keeps the original row and retry control when removal is rejected", async () => {
  await render();
  m.write.mockResolvedValue({ success: false, error: "Try later" });
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Unsave café"]')!.click());
  expect(container.textContent).toContain("Saved in Favorites");
  expect(container.querySelector<HTMLButtonElement>('button[aria-label="Unsave café"]')?.disabled).toBe(false);
});

function Overview({ accountId = "A" }: { accountId?: string }) {
  const { collections, initialLoading } = usePersonalCollections(accountId);
  return <div data-overview={accountId}>{initialLoading ? "Loading" : collections.map((item) => <p key={item.name}>{item.name}: {item.count}</p>)}</div>;
}

it("does not revive a removed collection summary when its inactive overview remounts", async () => {
  m.memberships.add("Work");
  const cache = new Map();
  const renderRoute = async (overview: boolean) => { await act(async () => root.render(<SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}>{overview ? <Overview /> : <CollectionView collectionName="Work" />}</SWRConfig>)); };
  await renderRoute(true);
  expect(container.textContent).toContain("Work: 1");
  await renderRoute(false);
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Unsave café"]')!.click());
  expect(container.textContent).toContain("This collection is empty");
  let resolveSummaries!: (value: { ok: true; data: { name: string; count: number; lastSavedAt: string; sampleCafes: string[] }[] }) => void;
  m.summaries.mockImplementationOnce(() => new Promise((resolve) => { resolveSummaries = resolve; }));
  await renderRoute(true);
  expect(container.textContent).not.toContain("Work: 1");
  await act(async () => resolveSummaries({ ok: true, data: [{ name: "Favorites", count: 1, lastSavedAt: "2026-10-19", sampleCafes: ["Coffee"] }] }));
  expect(container.textContent).toContain("Favorites: 1");
});

it("refreshes an inactive overview after Organize adds a collection", async () => {
  const cache = new Map();
  const renderRoute = async (overview: boolean) => { await act(async () => root.render(<SWRConfig value={{ provider: () => cache }}>{overview ? <Overview /> : <CollectionView collectionName="Favorites" />}</SWRConfig>)); };
  await renderRoute(true);
  await renderRoute(false);
  act(() => container.querySelector("h4")!.click());
  act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Organize")!.click());
  await act(async () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Choose Work")!.click());
  await renderRoute(true);
  expect(container.textContent).toContain("Work: 1");
  expect(container.textContent).toContain("Favorites: 1");
});

it("refreshes an inactive overview after deleting a collection", async () => {
  m.memberships.add("Work");
  vi.stubGlobal("confirm", () => true);
  const cache = new Map();
  const renderRoute = async (overview: boolean) => { await act(async () => root.render(<SWRConfig value={{ provider: () => cache }}>{overview ? <Overview /> : <CollectionCard collection={{ name: "Work", count: 1, lastSavedAt: "2026-10-19", sampleCafes: ["Coffee"] }} />}</SWRConfig>)); };
  await renderRoute(true);
  await renderRoute(false);
  act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Collection options"]')!.click());
  await act(async () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Delete"))!.click());
  await renderRoute(true);
  expect(container.textContent).not.toContain("Work: 1");
  expect(container.textContent).toContain("Favorites: 1");
});

it("keeps inactive cache for other accounts and rejected writes", async () => {
  m.summaries.mockImplementation(async (accountId: string) => ({ ok: true, data: [{ name: accountId === "A" ? "Favorites" : "B private", count: 1, lastSavedAt: "2026-10-19", sampleCafes: [] }] }));
  const cache = new Map();
  const renderRoute = async (route: "overview" | "card") => { await act(async () => root.render(<SWRConfig value={{ provider: () => cache }}>{route === "overview" ? <><Overview /><Overview accountId="B" /></> : <CollectionView collectionName="Favorites" />}</SWRConfig>)); };
  await renderRoute("overview");
  await renderRoute("card");
  m.write.mockResolvedValueOnce({ success: false, error: "Try later" });
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Unsave café"]')!.click());
  await renderRoute("overview");
  expect(container.textContent).toContain("Favorites: 1");
  expect(container.textContent).toContain("B private: 1");
  expect(m.summaries).toHaveBeenCalledTimes(2);
  await renderRoute("card");
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Unsave café"]')!.click());
  await renderRoute("overview");
  expect(container.textContent).toContain("B private: 1");
  expect(m.summaries.mock.calls.filter(([account]) => account === "B")).toHaveLength(1);
});

it.each([false, true])("ignores an Organize completion after the account changes (switch back: %s)", async (switchBack) => {
  const cache = new Map();
  const onSaveStateChange = vi.fn();
  let completeSave!: (value: { success: true }) => void;
  m.write.mockImplementationOnce(() => new Promise((resolve) => { completeSave = resolve; }));
  const renderSheet = async () => { await act(async () => root.render(<SWRConfig value={{ provider: () => cache }}><CafeDetailSheet cafe={cafe} isOpen onClose={vi.fn()} initialIsSaved initialCollection="Favorites" onSaveStateChange={onSaveStateChange} /></SWRConfig>)); };
  await renderSheet();
  act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Organize")!.click());
  act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Choose Work")!.click());
  m.accountId = "B";
  await renderSheet();
  if (switchBack) { m.accountId = "A"; await renderSheet(); }
  await act(async () => completeSave({ success: true }));
  expect(onSaveStateChange).not.toHaveBeenCalled();
  expect(Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Favorites")).toBeDefined();
});

it("opens café through sheet navigation without creating a detail surface", async () => {
 const open=vi.fn();const back=vi.fn();
 await act(async()=>root.render(<SWRConfig value={{provider:()=>new Map()}}><CollectionView collectionName="Favorites" presentation="sheet" onOpen={open} onBack={back}/></SWRConfig>));
 act(()=>container.querySelector("h4")!.click());
 expect(open).toHaveBeenCalledWith({kind:"cafe",root:"saved",entityId:"cafe",circleId:"circle-a"});
 expect(container.querySelector('a[href="/cafes/cafe"]')).not.toBeNull();
 expect(Array.from(container.querySelectorAll("button")).some(b=>b.textContent==="Organize")).toBe(false);
});
