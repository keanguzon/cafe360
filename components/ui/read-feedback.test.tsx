// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ReadFeedback } from "./read-feedback";

afterEach(() => { document.body.innerHTML = ""; vi.useRealTimers(); });
it("shows known read failures immediately and retains rejected retries", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<ReadFeedback pending error="Offline" operationKey="account:circle" retry={async () => { throw new Error("Still offline"); }}/>));
  expect(host.textContent).toContain("Offline");
  expect(host.textContent).not.toContain("Loading…");
  await act(async () => host.querySelector("button")!.click());
  expect(host.textContent).toContain("Still offline");
  await act(async () => root.render(<ReadFeedback pending operationKey="account:other-circle"/>));
  expect(host.textContent).not.toContain("Still offline");
  await act(async () => root.unmount());
});

it("does not carry a late rejected retry into a different resource", async () => {
  let reject!: (error: Error) => void;
  const retry = new Promise<void>((_resolve, fail) => { reject = fail; });
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<ReadFeedback pending={false} error="Offline" operationKey="A" retry={() => retry}/>));
  await act(async () => host.querySelector("button")!.click());
  expect(host.textContent).toContain("Loading");
  await act(async () => root.render(<ReadFeedback pending operationKey="B"/>));
  await act(async () => reject(new Error("Private A failure")));
  expect(host.textContent).not.toContain("Private A failure");
  expect(host.textContent).toContain("Loading");
  await act(async () => root.unmount());
});
