// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { isOnline, useOnlineStatus } from "./use-online-status";

function Status() { return <span>{useOnlineStatus() ? "online" : "offline"}</span>; }

it("uses a stable online server snapshot and responds to client connectivity changes", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    expect(renderToString(<Status />)).toContain("online");
    expect(isOnline()).toBe(false);
    await act(async () => root.render(<Status />));
    expect(container.textContent).toBe("offline");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(container.textContent).toBe("online");
  } finally {
    act(() => root.unmount());
    Reflect.deleteProperty(navigator, "onLine");
  }
});
