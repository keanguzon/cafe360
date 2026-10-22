// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CafeSearchResult } from "@/lib/types/places";
import type { CafeHoursEntry } from "@/lib/utils/cafe-hours";
import { CafeHoursSection } from "./cafe-hours-section";

const {
  useCircleMock,
  getCircleCafeHoursActionMock,
  saveCircleCafeHoursActionMock,
  toastMock,
} = vi.hoisted(() => ({
  useCircleMock: vi.fn(),
  getCircleCafeHoursActionMock: vi.fn(),
  saveCircleCafeHoursActionMock: vi.fn(),
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/context/circle-context", () => ({
  useCircle: useCircleMock,
}));

vi.mock("@/lib/actions/cafe-hours-actions", () => ({
  getCircleCafeHoursAction: (...args: unknown[]) => getCircleCafeHoursActionMock(...args),
  saveCircleCafeHoursAction: (...args: unknown[]) => saveCircleCafeHoursActionMock(...args),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

describe("CafeHoursSection", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  const mockCafe: CafeSearchResult = {
    id: "cafe-1",
    name: "Yardstick Coffee",
    address: "Legazpi Village, Makati",
    coordinates: [121.018, 14.554],
  };

  const mockCircle = {
    id: "circle-1",
    name: "Coffee Explorers",
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
  });

  it("keeps the hours editor open and rejects an offline form submission", async () => {
    useCircleMock.mockReturnValue({ activeCircle: mockCircle });
    getCircleCafeHoursActionMock.mockResolvedValue([]);
    await act(async () => root?.render(<CafeHoursSection cafe={mockCafe} />));
    act(() => [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Add for Circle"))!.click());
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    try {
      await act(async () => { window.dispatchEvent(new Event("offline")); });
      expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
      await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
      expect(saveCircleCafeHoursActionMock).not.toHaveBeenCalled();
      expect(container.querySelector("form")).not.toBeNull();
    } finally {
      Reflect.deleteProperty(navigator, "onLine");
    }
  });

  it("loads and renders Circle hours for the active Circle and calls onHoursChange with the loaded entries", async () => {
    useCircleMock.mockReturnValue({ activeCircle: mockCircle });
    const mockHours: CafeHoursEntry[] = [
      { id: "h-1", day_of_week: 1, open_time: "08:00:00", close_time: "17:00:00", is_closed: false, timezone: "Asia/Manila" },
      { id: "h-2", day_of_week: 2, open_time: "08:00:00", close_time: "17:00:00", is_closed: false, timezone: "Asia/Manila" },
      { id: "h-3", day_of_week: 3, open_time: "08:00:00", close_time: "17:00:00", is_closed: false, timezone: "Asia/Manila" },
      { id: "h-4", day_of_week: 4, open_time: "08:00:00", close_time: "17:00:00", is_closed: false, timezone: "Asia/Manila" },
      { id: "h-5", day_of_week: 5, open_time: "08:00:00", close_time: "17:00:00", is_closed: false, timezone: "Asia/Manila" },
      { id: "h-6", day_of_week: 6, open_time: "09:00:00", close_time: "18:00:00", is_closed: false, timezone: "Asia/Manila" },
      { id: "h-0", day_of_week: 0, open_time: null, close_time: null, is_closed: true, timezone: "Asia/Manila" },
    ];
    getCircleCafeHoursActionMock.mockResolvedValueOnce(mockHours);

    const onHoursChange = vi.fn();

    await act(async () => {
      root?.render(<CafeHoursSection cafe={mockCafe} onHoursChange={onHoursChange} />);
    });

    expect(getCircleCafeHoursActionMock).toHaveBeenCalledWith(mockCircle.id, mockCafe.id);
    expect(onHoursChange).toHaveBeenCalledWith(mockHours);

    expect(container.textContent).toContain("Hours & Information");
    expect(container.textContent).toContain("Monday");
    expect(container.textContent).toContain("8:00 AM – 5:00 PM");
    expect(container.textContent).toContain("Saturday");
    expect(container.textContent).toContain("9:00 AM – 6:00 PM");
    expect(container.textContent).toContain("Sunday");
    expect(container.textContent).toContain("Closed");
    expect(container.textContent).toContain(`Added by ${mockCircle.name} members`);

    const editButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Edit")
    );
    expect(editButton).toBeDefined();
  });

  it("ignores stale getCircleCafeHoursAction responses if activeCircle.id or cafe.id changes before the previous request resolves", async () => {
    useCircleMock.mockReturnValue({ activeCircle: { id: "circle-1", name: "Circle One" } });

    const cafeA: CafeSearchResult = { ...mockCafe, id: "cafe-a" };
    const cafeB: CafeSearchResult = { ...mockCafe, id: "cafe-b" };

    let resolveA!: (data: CafeHoursEntry[]) => void;
    const promiseA = new Promise<CafeHoursEntry[]>((resolve) => {
      resolveA = resolve;
    });

    let resolveB!: (data: CafeHoursEntry[]) => void;
    const promiseB = new Promise<CafeHoursEntry[]>((resolve) => {
      resolveB = resolve;
    });

    getCircleCafeHoursActionMock.mockImplementation((circleId: string, cafeId: string) => {
      if (circleId === "circle-1" && cafeId === "cafe-a") return promiseA;
      if (circleId === "circle-2" && cafeId === "cafe-b") return promiseB;
      return Promise.resolve([]);
    });

    const onHoursChange = vi.fn();

    act(() => {
      root?.render(<CafeHoursSection cafe={cafeA} onHoursChange={onHoursChange} />);
    });

    expect(getCircleCafeHoursActionMock).toHaveBeenCalledWith("circle-1", "cafe-a");

    useCircleMock.mockReturnValue({ activeCircle: { id: "circle-2", name: "Circle Two" } });
    act(() => {
      root?.render(<CafeHoursSection cafe={cafeB} onHoursChange={onHoursChange} />);
    });

    expect(getCircleCafeHoursActionMock).toHaveBeenCalledWith("circle-2", "cafe-b");

    const staleHours: CafeHoursEntry[] = [
      { id: "stale-1", day_of_week: 1, open_time: "06:00:00", close_time: "14:00:00", is_closed: false, timezone: "Asia/Manila" },
    ];

    await act(async () => {
      resolveA(staleHours);
    });

    expect(onHoursChange).not.toHaveBeenCalledWith(staleHours);
    expect(container.textContent).not.toContain("6:00 AM – 2:00 PM");

    const freshHours: CafeHoursEntry[] = [
      { id: "fresh-1", day_of_week: 1, open_time: "10:00:00", close_time: "22:00:00", is_closed: false, timezone: "Asia/Manila" },
    ];

    await act(async () => {
      resolveB(freshHours);
    });

    expect(onHoursChange).toHaveBeenCalledWith(freshHours);
    expect(container.textContent).toContain("10:00 AM – 10:00 PM");
    expect(container.textContent).toContain("Added by Circle Two members");
  });

  it("opens the editor ('Add for Circle' / 'Edit'), toggles a closed day, submits the 7-day form via saveCircleCafeHoursAction, and refreshes Circle hours", async () => {
    useCircleMock.mockReturnValue({ activeCircle: mockCircle });
    getCircleCafeHoursActionMock.mockResolvedValueOnce([]);

    const onHoursChange = vi.fn();

    await act(async () => {
      root?.render(<CafeHoursSection cafe={mockCafe} onHoursChange={onHoursChange} />);
    });

    expect(container.textContent).toContain("No hours listed yet for this café.");

    const addButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Add for Circle")
    );
    expect(addButton).toBeDefined();

    act(() => {
      addButton?.click();
    });

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(container.textContent).toContain(`Set operating hours for ${mockCircle.name}:`);

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes.length).toBe(7);

    // Toggle the Sunday row (index 6, day_of_week 0) to closed
    expect(checkboxes[6].checked).toBe(false);
    act(() => {
      checkboxes[6].click();
    });
    expect(checkboxes[6].checked).toBe(true);

    saveCircleCafeHoursActionMock.mockResolvedValueOnce({ success: true });
    const refreshedHours: CafeHoursEntry[] = [
      { id: "h-saved-1", day_of_week: 1, open_time: "09:00:00", close_time: "18:00:00", is_closed: false, timezone: "Asia/Manila" },
      { id: "h-saved-2", day_of_week: 2, open_time: "", close_time: "", is_closed: false, timezone: "Asia/Manila" },
      { id: "h-saved-3", day_of_week: 3, open_time: "", close_time: "", is_closed: false, timezone: "Asia/Manila" },
      { id: "h-saved-4", day_of_week: 4, open_time: "", close_time: "", is_closed: false, timezone: "Asia/Manila" },
      { id: "h-saved-5", day_of_week: 5, open_time: "", close_time: "", is_closed: false, timezone: "Asia/Manila" },
      { id: "h-saved-6", day_of_week: 6, open_time: "", close_time: "", is_closed: false, timezone: "Asia/Manila" },
      { id: "h-saved-0", day_of_week: 0, open_time: null, close_time: null, is_closed: true, timezone: "Asia/Manila" },
    ];
    getCircleCafeHoursActionMock.mockResolvedValueOnce(refreshedHours);

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(saveCircleCafeHoursActionMock).toHaveBeenCalledTimes(1);
    expect(saveCircleCafeHoursActionMock).toHaveBeenCalledWith(
      mockCircle.id,
      mockCafe,
      expect.arrayContaining([
        expect.objectContaining({ day_of_week: 0, is_closed: true }),
      ])
    );
    expect(saveCircleCafeHoursActionMock.mock.calls[0][2]).toHaveLength(7);

    expect(toastMock.success).toHaveBeenCalledWith(`Hours saved for ${mockCircle.name}!`);
    expect(getCircleCafeHoursActionMock).toHaveBeenLastCalledWith(mockCircle.id, mockCafe.id);
    expect(onHoursChange).toHaveBeenCalledWith(refreshedHours);

    // Form should close and Edit button should now be available
    expect(container.querySelector("form")).toBeNull();
    const editButton = Array.from(container.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Edit")
    );
    expect(editButton).toBeDefined();

    // Verify reopening the editor via the Edit button
    act(() => {
      editButton?.click();
    });
    expect(container.querySelector("form")).not.toBeNull();
  });

  it("does not fetch Circle hours while closed and reports load failures through onHoursError", async () => {
    useCircleMock.mockReturnValue({ activeCircle: mockCircle });
    getCircleCafeHoursActionMock.mockRejectedValueOnce(new Error("Network failure"));
    const onHoursError = vi.fn();

    await act(async () => {
      root?.render(<CafeHoursSection cafe={mockCafe} isOpen={false} onHoursError={onHoursError} />);
    });
    expect(getCircleCafeHoursActionMock).not.toHaveBeenCalled();

    await act(async () => {
      root?.render(<CafeHoursSection cafe={mockCafe} isOpen={true} onHoursError={onHoursError} />);
    });
    expect(getCircleCafeHoursActionMock).toHaveBeenCalledTimes(1);
    expect(onHoursError).toHaveBeenCalledWith("Hours unavailable");
  });
});

