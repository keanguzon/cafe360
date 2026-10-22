// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AvatarUploader } from "./avatar-uploader";

const mocks = vi.hoisted(() => ({
  updateProfileAction: vi.fn(),
  uploadAvatarAction: vi.fn(),
}));

vi.mock("@/lib/actions/profile-actions", () => ({
  updateProfileAction: mocks.updateProfileAction,
  uploadAvatarAction: mocks.uploadAvatarAction,
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <div role="img" aria-label={alt} data-src={src} />,
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.updateProfileAction.mockReset();
  mocks.uploadAvatarAction.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Reflect.deleteProperty(navigator, "onLine");
});

it("keeps an offline or failed avatar file for a manual retry after reconnecting", async () => {
  const file = new File(["avatar bytes"], "profile.png", { type: "image/png" });
  mocks.uploadAvatarAction
    .mockResolvedValueOnce({ error: "Temporary upload failure" })
    .mockResolvedValueOnce({ success: true, avatarUrl: "/updated-avatar.png" });

  await act(async () => root.render(<AvatarUploader currentAvatarUrl="/current-avatar.png" displayName="Coffee Fan" />));

  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  await act(async () => window.dispatchEvent(new Event("offline")));

  const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(fileInput, "files", { configurable: true, value: [file] });
  await act(async () => fileInput.dispatchEvent(new Event("change", { bubbles: true })));

  expect(mocks.uploadAvatarAction).not.toHaveBeenCalled();
  expect(container.textContent).toContain("You're offline.");
  const retryButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("Retry upload"))!;
  expect(retryButton).toBeDefined();
  expect(retryButton.disabled).toBe(true);

  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  await act(async () => window.dispatchEvent(new Event("online")));

  expect(mocks.uploadAvatarAction).not.toHaveBeenCalled();
  expect(retryButton.disabled).toBe(false);

  await act(async () => {
    retryButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(mocks.uploadAvatarAction).toHaveBeenCalledTimes(1);
  expect((mocks.uploadAvatarAction.mock.calls[0][0] as FormData).get("avatar")).toBe(file);
  expect(container.textContent).toContain("Temporary upload failure");
  expect(container.querySelector('[data-src]')?.getAttribute("data-src")).toBe("/current-avatar.png");

  const secondRetryButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("Retry upload"))!;
  await act(async () => {
    secondRetryButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(mocks.uploadAvatarAction).toHaveBeenCalledTimes(2);
  expect((mocks.uploadAvatarAction.mock.calls[1][0] as FormData).get("avatar")).toBe(file);
  expect(container.querySelector('[data-src]')?.getAttribute("data-src")).toBe("/updated-avatar.png");
  expect(container.textContent).not.toContain("Retry upload");
});
