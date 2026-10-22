// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { InstallPrompt } from "./install-prompt";

it("removes the consumed install prompt when native installation is dismissed", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  sessionStorage.clear();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<InstallPrompt />));
    const prompt = vi.fn(async () => {});
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    await act(async () => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    const install = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Install")!;
    expect(install).toBeDefined();
    await act(async () => { install.click(); });
    expect(prompt).toHaveBeenCalledOnce();
    expect(container.querySelector("aside")).toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
    sessionStorage.clear();
  }
});
