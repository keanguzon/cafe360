// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CafeDetailSheet } from "./cafe-detail-sheet";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  mutate: vi.fn(),
  completed: vi.fn(),
  failure: vi.fn(),
  getHours: vi.fn(),
  saveButtonProps: vi.fn(),
  hoursSectionProps: vi.fn(),
  shareError: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.shareError } }));
vi.mock("swr", () => ({ useSWRConfig: () => ({ mutate: mocks.mutate }) }));
vi.mock("@/lib/context/circle-context", () => ({ useCircle: () => ({ accountId: "owner", activeCircle: { id: "circle-1", name: "QA Circle" }, circleCafeSummaries: [] }) }));
vi.mock("@/lib/actions/cafe-actions", () => ({ toggleSaveCafeAction: mocks.save }));
vi.mock("@/lib/actions/cafe-hours-actions", () => ({ getCircleCafeHoursAction: (...args: unknown[]) => mocks.getHours(...args) }));
vi.mock("@/components/layout/bottom-sheet", () => ({ BottomSheet: ({ isOpen, children, title, onClose }: { isOpen: boolean; children: React.ReactNode; title?: string; onClose():void }) => isOpen ? <div>{title === "Log Visit" && <button onClick={onClose}>Close Log Visit</button>}{children}</div> : null }));
vi.mock("./collection-picker", () => ({ CollectionPicker: ({ isOpen, onSelectCollection }: { isOpen: boolean; onSelectCollection: (name: string) => Promise<void> }) => isOpen ? <button onClick={() => { void onSelectCollection("Favorites").catch(mocks.failure); }}>Choose collection</button> : null }));
vi.mock("./cafe-hours-section", () => ({
  CafeHoursSection: (props: unknown) => {
    mocks.hoursSectionProps(props);
    return null;
  },
}));
vi.mock("./group-relationship", () => ({ GroupRelationship: () => null }));
vi.mock("./cafe-photos", () => ({ CafePhotos: () => null }));
vi.mock("./interest-button", () => ({ InterestButton: () => null }));
vi.mock("./save-button", () => ({
  SaveButton: (props: unknown) => {
    mocks.saveButtonProps(props);
    return null;
  },
}));
vi.mock("./circle-save-button", () => ({ CircleSaveButton: () => null }));
vi.mock("@/components/visit/visit-timeline-fetcher", () => ({ VisitTimelineFetcher: () => null }));
vi.mock("@/components/visit/log-visit-form", () => ({ LogVisitForm: ({onDirtyChange,onSuccess}:{onDirtyChange?(dirty:boolean):void;onSuccess():void}) => <><button onClick={()=>onDirtyChange?.(true)}>Make visit dirty</button><button onClick={onSuccess}>Finish visit</button></> }));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.save.mockResolvedValue({ success: true });
  mocks.mutate.mockResolvedValue(undefined);
  mocks.getHours.mockResolvedValue([]);
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
it("treats a dismissed native share sheet as cancellation without copying or reporting failure", async () => {
  const share = vi.fn().mockRejectedValue(new DOMException("Dismissed", "AbortError"));
  const copy = vi.fn();
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
  try {
    await act(async () => root.render(<CafeDetailSheet isOpen cafe={{ id: "provider", name: "Cafe", address: "", coordinates: [120, 14] }} onClose={() => {}} />));
    await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === "Share")!.click());
    expect(share).toHaveBeenCalledOnce();
    expect(copy).not.toHaveBeenCalled();
    expect(mocks.shareError).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')).toBeNull();
  } finally { Reflect.deleteProperty(navigator, "share"); Reflect.deleteProperty(navigator, "clipboard"); }
});
it("shows clipboard pending only until the actual copy settles", async () => {
  let finish!: () => void;
  const copy = vi.fn().mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
  try {
    await act(async () => root.render(<CafeDetailSheet isOpen cafe={{ id: "provider", name: "Cafe", address: "", coordinates: [120, 14] }} onClose={() => {}} />));
    const share = [...container.querySelectorAll("button")].find(button => button.textContent === "Share")!;
    await act(async () => share.click());
    expect(share.disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Sharing café");
    await act(async () => finish());
    expect(share.disabled).toBe(false);
    expect(container.querySelector('[role="status"]')).toBeNull();
  } finally { Reflect.deleteProperty(navigator, "clipboard"); }
});
it("keeps_an_unsaved_standalone_visit_open_until_discard_is_confirmed", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  try {
    await act(async () => root.render(<CafeDetailSheet isOpen cafe={{ id: "provider", name: "Cafe", address: "", coordinates: [120, 14] }} onClose={() => {}}/>));
    const click = async (text:string) => act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === text)!.click());
    await click("Log"); await click("Make visit dirty"); await click("Close Log Visit");
    expect(confirm).toHaveBeenCalledWith("Discard your unsaved changes?");
    expect(container.textContent).toContain("Make visit dirty");
    const unload = new Event("beforeunload", {cancelable:true});
    window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
    confirm.mockReturnValue(true); await click("Close Log Visit");
    expect(container.textContent).not.toContain("Make visit dirty");
  } finally { confirm.mockRestore(); }
});
async function save() {
  await act(async () => { root.render(<CafeDetailSheet isOpen cafe={{ id: "provider", name: "Cafe", address: "", coordinates: [120, 14] }} onClose={() => {}} onSave={mocks.completed} />); });
  await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Organize"))!.click(); });
  await act(async () => { [...container.querySelectorAll("button")].find((button) => button.textContent === "Choose collection")!.click(); });
}
it("does not announce a successful save or invalidate collections after a failed mutation", async () => {
  mocks.save.mockResolvedValue({ success: false, error: "Storage unavailable" });
  await save();
  expect(mocks.completed).not.toHaveBeenCalled();
  expect(mocks.mutate).not.toHaveBeenCalled();
  expect(mocks.failure).toHaveBeenCalledWith(expect.objectContaining({ message: "Storage unavailable" }));
});
it("rejects a collection callback offline without saving or clearing its draft", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  try {
    await save();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.completed).not.toHaveBeenCalled();
    expect(mocks.failure).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("reconnect and retry") }));
  } finally {
    Reflect.deleteProperty(navigator, "onLine");
  }
});
it("invalidates only the current account's collection cache after confirmation", async () => {
  await save();
  expect(mocks.completed).toHaveBeenCalledOnce();
  const filter = mocks.mutate.mock.calls[0][0];
  expect(filter(["personal-collections", "owner"])).toBe(true);
  expect(filter(["personal-saved-cafes", "owner", "Trips"])).toBe(true);
  expect(filter(["personal-cafe-save-status", "owner", "provider"])).toBe(true);
  expect(filter(["personal-cafe-save-status", "owner", "other"])).toBe(false);
  expect(filter(["personal-saved-cafes", "another-account", "Favorites"])).toBe(false);
});
it("does not show a global rating as the active Circle rating", async () => {
  await act(async () => { root.render(<CafeDetailSheet isOpen cafe={{ id: "provider", name: "Cafe", address: "", coordinates: [120, 14], rating: 4.9, ratingCount: 500 }} onClose={() => {}} />); });
  expect(container.textContent).not.toContain("4.9");
  expect(container.textContent).toContain("No reviews yet");
});
it("does not duplicate getCircleCafeHoursAction in CafeDetailSheet and forwards warm saved collection props to SaveButton", async () => {
  const onSaveStateChange = vi.fn();
  await act(async () => {
    root.render(
      <CafeDetailSheet
        isOpen
        cafe={{ id: "provider", name: "But First Coffee", address: "", coordinates: [120, 14] }}
        initialIsSaved={true}
        initialCollection="Favorites"
        onSaveStateChange={onSaveStateChange}
        onClose={() => {}}
      />,
    );
  });
  expect(mocks.getHours).not.toHaveBeenCalled();
  expect(mocks.saveButtonProps).toHaveBeenCalledWith(
    expect.objectContaining({
      initialIsSaved: true,
      collection: "Favorites",
      variant: "sheet-action",
    }),
  );
  expect(mocks.hoursSectionProps).toHaveBeenCalledWith(
    expect.objectContaining({
      isOpen: true,
    }),
  );
});

