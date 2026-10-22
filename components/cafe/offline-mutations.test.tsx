// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SaveButton } from "./save-button";
import { InterestButton } from "./interest-button";

const mocks = vi.hoisted(() => ({ save: vi.fn(), interest: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/context/circle-context", () => ({ useCircle: () => ({ accountId: "owner", activeCircle: { id: "circle" }, circleCafeSummaries: [] }) }));
vi.mock("@/lib/actions/cafe-actions", () => ({ toggleSaveCafeAction: mocks.save, toggleInterestAction: mocks.interest }));
vi.mock("./collection-picker", () => ({ CollectionPicker: () => null }));
vi.mock("sonner", () => ({ toast: { error: mocks.notify, success: vi.fn() } }));

it("disables save and interest offline and guards a click before the offline event renders", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.save.mockResolvedValue({ success: false });
  mocks.interest.mockResolvedValue({ success: false });
  const container = document.createElement("div");
  const root = createRoot(container);
  const cafe = { id: "cafe", name: "Coffee", address: "", coordinates: [120, 14] as [number, number] };
  try {
    await act(async () => root.render(<><SaveButton cafe={cafe} initialIsSaved={false} /><InterestButton cafe={cafe} /></>));
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    await act(async () => { container.querySelectorAll("button").forEach((button) => button.click()); });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.interest).not.toHaveBeenCalled();
    await act(async () => { window.dispatchEvent(new Event("offline")); });
    expect([...container.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
    expect(mocks.notify).toHaveBeenCalledWith(expect.stringContaining("reconnect and retry"));
  } finally {
    act(() => root.unmount());
    Reflect.deleteProperty(navigator, "onLine");
  }
});
