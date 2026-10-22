// @vitest-environment jsdom

import { act } from "react";

import { createRoot, type Root } from "react-dom/client";

import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  context: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  invalidate: vi.fn()
}));

vi.mock("@/lib/context/circle-context", () => ({ useCircle: m.context }));

vi.mock("@/lib/actions/circle-save-actions", () => ({
  saveCafeToCircleAction: m.save,
  removeCafeFromCircleAction: m.remove
}));

vi.mock("sonner", () => ({ toast: {
    success: m.success,
    error: m.error
  } }));

import { CircleSaveButton } from "./circle-save-button";
let root: Root, container: HTMLDivElement;
let context: Record<string, unknown>;
const cafe = {
  id: "provider",
  name: "Coffee",
  address: "Road",
  coordinates: [1, 2] as [
    number,
    number
  ]
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  context = {
    accountId: "actor",
    activeCircle: {
      id: "circle",
      name: "Friends"
    },
    circleSavedCafes: [],
    circleCafeSummaries: [{
        providerId: "provider",
        internalId: "internal"
      }],
    isLoading: false,
    error: null,
    invalidateCircle: m.invalidate
  };
  m.context.mockImplementation(() => context);
  m.save.mockResolvedValue({ success: true });
  m.remove.mockResolvedValue({ success: true });
  m.invalidate.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Reflect.deleteProperty(navigator, "onLine");
});

async function render(next = cafe) {
  await act(async () => root.render(<CircleSaveButton cafe={next}/>));
}

it("names the Circle and allows only the saver to remove", async () => {
  await render();
  expect(container.textContent).toContain("Save to Friends");
  context.circleSavedCafes = [{
      cafe_id: "internal",
      saved_by: "other"
    }];
  await render();
  expect(container.querySelector("button")!.disabled).toBe(true);
  expect(container.textContent).toContain("Saved to Friends");
  expect(container.textContent).toContain("member who saved");
  context.circleSavedCafes = [{
      cafe_id: "internal",
      saved_by: "actor"
    }];
  await render();
  expect(container.textContent).toContain("Remove from Friends");
  await act(async () => container.querySelector("button")!.click());
  expect(m.remove).toHaveBeenCalled();
});

it("disables saves while loading, errored, without a Circle, or offline", async () => {
  for (const update of [{ isLoading: true }, {
      isLoading: false,
      error: "failed"
    }, {
      error: null,
      activeCircle: null
    }]) {
    Object.assign(context, update);
    await render();
    expect(container.querySelector("button")!.disabled).toBe(true);
  }
  context.activeCircle = {
    id: "circle",
    name: "Friends"
  };
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false
  });
  await render();
  expect(container.querySelector("button")!.disabled).toBe(true);
  expect(m.save).not.toHaveBeenCalled();
});

it("blocks repeated clicks until the save and refresh finish", async () => {
  let finish!: (x: unknown) => void;
  m.save.mockReturnValue(new Promise(resolve => {
    finish = resolve;
  }));
  await render();
  act(() => {
    container.querySelector("button")!.click();
    container.querySelector("button")!.click();
  });
  expect(m.save).toHaveBeenCalledTimes(1);
  expect(container.querySelector("button")!.disabled).toBe(true);
  await act(async () => finish({ success: true }));
  expect(m.invalidate).toHaveBeenCalledWith("circle");
});

it("confirms a committed save while Circle refresh is pending", async () => {
  let finishRefresh!: (reason: Error) => void;
  m.invalidate.mockReturnValue(new Promise((_, reject) => {
    finishRefresh = reject;
  }));
  await render();
  act(() => container.querySelector("button")!.click());
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  expect(m.invalidate).toHaveBeenCalledWith("circle");
  expect(m.success).toHaveBeenCalledWith("Saved to Friends", expect.objectContaining({
    id: expect.any(String),
  }));
  expect(container.textContent).toContain("Refreshing Circle…");
  expect(container.querySelector("button")!.disabled).toBe(true);
  act(() => container.querySelector("button")!.click());
  expect(m.save).toHaveBeenCalledTimes(1);

  await act(async () => finishRefresh(Error("refresh failed")));
  const successOptions = m.success.mock.calls[0][1];
  const [refreshMessage, refreshOptions] = m.error.mock.calls[0];
  expect(refreshMessage).toContain("Circle refresh failed");
  expect(refreshMessage).not.toMatch(/could not update|save failed/i);
  expect(refreshOptions.id).toBe(successOptions.id);
  expect(refreshOptions.description).toContain("Your change was saved");
});

it.each(["circle", "cafe", "account"])("suppresses stale toast after a %s switch", async (kind) => {
  let finish!: (x: unknown) => void;
  m.save.mockReturnValue(new Promise(resolve => {
    finish = resolve;
  }));
  await render();
  act(() => container.querySelector("button")!.click());
  if (kind === "circle")
    context.activeCircle = {
      id: "next",
      name: "Next"
    };
  if (kind === "account")
    context.accountId = "next";
  await render(kind === "cafe" ? {
    ...cafe,
    id: "next"
  } : cafe);
  await act(async () => finish({ success: true }));
  expect(m.success).not.toHaveBeenCalled();
  expect(m.error).not.toHaveBeenCalled();
  if (kind === "account")
    expect(m.invalidate).not.toHaveBeenCalled();
  else
    expect(m.invalidate).toHaveBeenCalledWith("circle");
});

it("explains that a save committed when refresh fails", async () => {
  m.invalidate.mockRejectedValue(Error("refresh"));
  await render();
  await act(async () => container.querySelector("button")!.click());
  expect(m.error).toHaveBeenCalledWith(expect.stringContaining("saved"), expect.anything());
  expect(m.save).toHaveBeenCalledTimes(1);
});

it("checks connectivity again before handling a click", async () => {
  await render();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: false
  });
  await act(async () => container.querySelector("button")!.click());
  expect(m.save).not.toHaveBeenCalled();
  expect(m.error).toHaveBeenCalled();
});

it("shows a rejected write without refreshing Circle data", async () => {
  m.save.mockResolvedValue({
    success: false,
    error: "Permission changed"
  });
  await render();
  await act(async () => container.querySelector("button")!.click());
  expect(m.error).toHaveBeenCalledWith("Permission changed");
  expect(m.invalidate).not.toHaveBeenCalled();
});
