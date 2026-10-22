// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatManilaDate } from "@/lib/utils/visit-date";
import type { CafeSearchResult } from "@/lib/types/places";
import { CheckInModal } from "./check-in-modal";

const mockActiveCircle = {
  id: "circle-123",
  name: "Coffee Explorers",
  role: "admin",
  member_count: 4,
};

const mockInvalidateCircle = vi.fn().mockResolvedValue(undefined);
const mockCreateVisitAction = vi.fn().mockResolvedValue({ success: true, visitId: "visit-1" });

vi.mock("@/lib/context/circle-context", () => ({
  useCircle: () => ({
    activeCircle: mockActiveCircle,
    invalidateCircle: mockInvalidateCircle,
  }),
}));

vi.mock("@/lib/actions/visit-actions", () => ({
  createVisitAction: (...args: unknown[]) => mockCreateVisitAction(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CheckInModal", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockInvalidateCircle.mockClear();
    mockCreateVisitAction.mockClear();
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const mockNearbyCafes: CafeSearchResult[] = [
    {
      id: "cafe-1",
      name: "Yardstick Coffee",
      address: "Legazpi Village, Makati",
      coordinates: [121.018, 14.554],
    },
    {
      id: "cafe-2",
      name: "Habitual Coffee",
      address: "Salcedo Village, Makati",
      coordinates: [121.025, 14.560],
    },
  ];

  it("uses shell mode only as a chooser without creating a visit", () => {
    const onChooseCafe = vi.fn(); const onClose = vi.fn();
    act(() => root?.render(<CheckInModal isOpen onClose={onClose} onChooseCafe={onChooseCafe} nearbyCafes={mockNearbyCafes} userCoordinates={null}/>));
    const choice = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes("Yardstick Coffee"));
    act(() => choice?.click());
    expect(onChooseCafe).toHaveBeenCalledWith(mockNearbyCafes[0]);
    expect(onClose).toHaveBeenCalled();
    expect(mockCreateVisitAction).not.toHaveBeenCalled();
  });

  it("renders role dialog with aria-modal when open, renders nearby cafes as buttons, and closes on Escape", () => {
    const onClose = vi.fn();

    act(() => {
      root?.render(
        <CheckInModal
          isOpen={true}
          onClose={onClose}
          nearbyCafes={mockNearbyCafes}
          userCoordinates={[121.018, 14.554]}
        />
      );
    });

    const dialog = container.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-labelledby")).toBe("check-in-modal-title");

    const title = container.querySelector("#check-in-modal-title");
    expect(title?.textContent?.trim()).toBe("Circle Check-in");

    const closeButton = container.querySelector<HTMLButtonElement>('button[aria-label="Close check-in"]');
    expect(closeButton).not.toBeNull();
    expect(closeButton?.getAttribute("type")).toBe("button");

    const cafeButtons = container.querySelectorAll<HTMLButtonElement>("button.w-full.text-left");
    expect(cafeButtons.length).toBe(2);
    expect(cafeButtons[0].getAttribute("type")).toBe("button");
    expect(cafeButtons[0].textContent).toContain("Yardstick Coffee");
    expect(cafeButtons[1].getAttribute("type")).toBe("button");
    expect(cafeButtons[1].textContent).toContain("Habitual Coffee");

    act(() => {
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the selected cafe when an offline submit bypasses the disabled button", async () => {
    const onClose = vi.fn();
    await act(async () => root?.render(<CheckInModal isOpen onClose={onClose} nearbyCafes={mockNearbyCafes} userCoordinates={null} />));
    act(() => container.querySelector<HTMLButtonElement>("button.w-full.text-left")!.click());
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    try {
      await act(async () => { window.dispatchEvent(new Event("offline")); });
      expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
      await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
      expect(mockCreateVisitAction).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(container.textContent).toContain("Yardstick Coffee");
    } finally {
      Reflect.deleteProperty(navigator, "onLine");
    }
  });

  it("selects a nearby cafe on click and calls createVisitAction and invalidateCircle on submit", async () => {
    const onClose = vi.fn();

    act(() => {
      root?.render(
        <CheckInModal
          isOpen={true}
          onClose={onClose}
          nearbyCafes={mockNearbyCafes}
          userCoordinates={[121.018, 14.554]}
        />
      );
    });

    const cafeButtons = container.querySelectorAll<HTMLButtonElement>("button.w-full.text-left");
    expect(cafeButtons.length).toBeGreaterThan(0);

    act(() => {
      cafeButtons[0].click();
    });

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(container.textContent).toContain("Yardstick Coffee");

    const starButtons = container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Rate "]');
    expect(starButtons.length).toBe(5);
    expect(starButtons[4].getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const expectedDate = formatManilaDate(new Date());

    expect(mockCreateVisitAction).toHaveBeenCalledWith({
      cafe_id: "cafe-1",
      cafe: mockNearbyCafes[0],
      group_id: "circle-123",
      visited_at: expectedDate,
      rating: 5,
      notes: undefined,
    });

    expect(mockInvalidateCircle).toHaveBeenCalledWith("circle-123");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
