// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PwaStatus, ServiceWorkerRegistration } from "./service-worker-registration";

it("keeps offline guidance visible alongside a waiting update without activating it", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const registration = Object.assign(new EventTarget(), { waiting: { postMessage: vi.fn() }, installing: null, update: vi.fn(async () => {}) });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register: vi.fn(async () => registration), controller: {} } });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<><ServiceWorkerRegistration /><PwaStatus /></>));
    expect(container.textContent).toContain("offline");
    expect(container.textContent).toContain("close all Cafe360 tabs");
    expect(container.textContent).toContain("retry");
    expect(registration.waiting.postMessage).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(container.textContent).not.toContain("You're offline");
    expect(container.textContent).toContain("close all Cafe360 tabs");
  } finally {
    act(() => root.unmount());
    Reflect.deleteProperty(navigator, "onLine");
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
});

it("does not attach listeners if registration resolves after unmount", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let resolve!: (value: ServiceWorkerRegistration) => void;
  const registration = Object.assign(new EventTarget(), { update: vi.fn(async () => {}) });
  const add = vi.spyOn(registration, "addEventListener");
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register: () => new Promise<ServiceWorkerRegistration>((done) => { resolve = done; }) } });
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<ServiceWorkerRegistration />));
    act(() => root.unmount());
    await act(async () => { resolve(registration as unknown as ServiceWorkerRegistration); });
    expect(add).not.toHaveBeenCalled();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(registration.update).not.toHaveBeenCalled();
  } finally {
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
});

it("detects a newly installed waiting worker and removes its listeners on unmount", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const installing = new EventTarget();
  const postMessage = vi.fn();
  const registration = Object.assign(new EventTarget(), {
    waiting: null as { postMessage: typeof postMessage } | null,
    installing,
    update: vi.fn(async () => {}),
  });
  const removed = vi.spyOn(registration, "removeEventListener");
  const stopped = vi.spyOn(installing, "removeEventListener");
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register: async () => registration, controller: {} } });
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<><ServiceWorkerRegistration /><PwaStatus /></>));
    expect(container.textContent).not.toContain("Update ready");
    await act(async () => {
      registration.waiting = { postMessage };
      installing.dispatchEvent(new Event("statechange"));
    });
    expect(container.textContent).toContain("Update ready");
    expect(postMessage).not.toHaveBeenCalled();
    act(() => root.unmount());
    expect(removed).toHaveBeenCalledWith("updatefound", expect.any(Function));
    expect(stopped).toHaveBeenCalledWith("statechange", expect.any(Function));
  } finally {
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
});
