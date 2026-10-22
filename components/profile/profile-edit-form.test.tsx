// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/types/profile";
import { ProfileEditForm } from "./profile-edit-form";

const mocks = vi.hoisted(() => ({
  updateProfileAction: vi.fn(),
  uploadAvatarAction: vi.fn(),
}));

vi.mock("@/lib/actions/profile-actions", () => ({
  updateProfileAction: mocks.updateProfileAction,
  uploadAvatarAction: mocks.uploadAvatarAction,
}));

const profile: Profile = {
  id: "user-1",
  username: "coffee_fan",
  display_name: "Coffee Fan",
  avatar_url: null,
  bio: "Original bio",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

let container: HTMLDivElement;
let root: Root;

function setFieldValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")!.set!.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.updateProfileAction.mockReset().mockResolvedValue({ success: true, message: "Saved" });
  mocks.uploadAvatarAction.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Reflect.deleteProperty(navigator, "onLine");
});

it("keeps profile edits when offline and submits them only after a manual retry", async () => {
  await act(async () => root.render(<ProfileEditForm profile={profile} />));

  const displayName = container.querySelector<HTMLInputElement>("#displayName")!;
  const bio = container.querySelector<HTMLTextAreaElement>("#bio")!;
  await act(async () => {
    setFieldValue(displayName, "Draft name");
    setFieldValue(bio, "Draft bio");
  });

  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  await act(async () => window.dispatchEvent(new Event("offline")));

  const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(submitButton.disabled).toBe(true);
  expect(container.textContent).toContain("You're offline.");

  const offlineSubmit = new Event("submit", { bubbles: true, cancelable: true });
  await act(async () => container.querySelector("form")!.dispatchEvent(offlineSubmit));

  expect(offlineSubmit.defaultPrevented).toBe(true);
  expect(mocks.updateProfileAction).not.toHaveBeenCalled();
  expect(displayName.value).toBe("Draft name");
  expect(bio.value).toBe("Draft bio");

  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  await act(async () => window.dispatchEvent(new Event("online")));
  expect(mocks.updateProfileAction).not.toHaveBeenCalled();
  expect(submitButton.disabled).toBe(false);

  await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

  expect(mocks.updateProfileAction).toHaveBeenCalledTimes(1);
  const submittedFormData = mocks.updateProfileAction.mock.calls[0][1] as FormData;
  expect(submittedFormData.get("displayName")).toBe("Draft name");
  expect(submittedFormData.get("bio")).toBe("Draft bio");
});

it("keeps profile drafts and shows a safe message when a save request rejects", async () => {
  mocks.updateProfileAction.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await act(async () => root.render(<ProfileEditForm profile={profile} />));

  const displayName = container.querySelector<HTMLInputElement>("#displayName")!;
  const bio = container.querySelector<HTMLTextAreaElement>("#bio")!;
  await act(async () => {
    setFieldValue(displayName, "Draft name");
    setFieldValue(bio, "Draft bio");
  });

  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(mocks.updateProfileAction).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("Could not save your profile. Please retry.");
  expect(displayName.value).toBe("Draft name");
  expect(bio.value).toBe("Draft bio");
});

it("keeps profile drafts when the save action returns a validation error", async () => {
  mocks.updateProfileAction.mockResolvedValueOnce({ error: "This username is already taken." });
  await act(async () => root.render(<ProfileEditForm profile={profile} />));

  const displayName = container.querySelector<HTMLInputElement>("#displayName")!;
  const bio = container.querySelector<HTMLTextAreaElement>("#bio")!;
  await act(async () => {
    setFieldValue(displayName, "Draft name");
    setFieldValue(bio, "Draft bio");
  });

  await act(async () => {
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  expect(container.textContent).toContain("This username is already taken.");
  expect(displayName.value).toBe("Draft name");
  expect(bio.value).toBe("Draft bio");
});
