import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type Listener = (event: { request?: Request; waitUntil: (work: Promise<unknown>) => void; respondWith: (work: Promise<Response>) => void }) => void;

function worker() {
  const listeners = new Map<string, Listener>();
  const stored = new Map<string, Response>();
  const cache = { addAll: vi.fn(async (urls: string[]) => { for (const url of urls) stored.set(url, new Response(url)); }),
    match: vi.fn(async (request: Request | string) => stored.get(typeof request === "string" ? request : new URL(request.url).pathname)),
    put: vi.fn(async (request: Request, response: Response) => { stored.set(new URL(request.url).pathname, response); }) };
  const caches = { open: vi.fn(async () => cache), match: cache.match, keys: vi.fn(async () => ["foreign-cache", "cafe360-v1"]), delete: vi.fn(async () => true) };
  const fetcher = vi.fn(async () => new Response("network", { status: 200 }));
  const self = { location: { origin: "https://cafe.test" }, addEventListener: (name: string, listener: Listener) => listeners.set(name, listener),
    skipWaiting: vi.fn(), clients: { claim: vi.fn() } };
  runInNewContext(readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8"), { self, caches, fetch: fetcher, URL, Promise, Response });
  async function dispatch(name: string, request?: Request) {
    let response: Promise<Response> | undefined;
    let task: Promise<unknown> | undefined;
    listeners.get(name)?.({ request, respondWith: (work) => { response = work; }, waitUntil: (work) => { task = work; } });
    if (task) await task;
    if (response) return response;
  }
  return { dispatch, cache, caches, fetcher, self };
}

describe("service worker cache boundary", () => {
  it("preloads only public assets and leaves activation of a new worker to the browser", async () => {
    const sw = worker();
    await sw.dispatch("install");
    const assets = sw.cache.addAll.mock.calls[0][0];
    expect(assets).toContain("/offline.html");
    expect(assets).not.toContain("/");
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    await sw.dispatch("activate");
    expect(sw.caches.delete).not.toHaveBeenCalledWith("foreign-cache");
    expect(sw.caches.delete).toHaveBeenCalledWith("cafe360-v1");
    expect(sw.self.clients.claim).not.toHaveBeenCalled();
  });

  it("caches a listed icon but bypasses an unlisted same-origin image", async () => {
    const sw = worker();
    const icon = await sw.dispatch("fetch", new Request("https://cafe.test/icon-192.png"));
    expect(await icon?.text()).toBe("network");
    expect(sw.cache.put).toHaveBeenCalledTimes(1);
    expect(await sw.dispatch("fetch", new Request("https://cafe.test/uploads/cafe.png"))).toBeUndefined();
    expect(sw.cache.put).toHaveBeenCalledTimes(1);
  });

  it("does not cache a public icon request redirected to another origin", async () => {
    const sw = worker();
    const redirected = new Response("remote image", { status: 200 });
    Object.defineProperty(redirected, "redirected", { value: true });
    Object.defineProperty(redirected, "url", { value: "https://storage.test/private.png" });
    sw.fetcher.mockResolvedValue(redirected);
    await sw.dispatch("fetch", new Request("https://cafe.test/icon-192.png"));
    expect(sw.cache.put).not.toHaveBeenCalled();
  });

  it.each([
    "https://cafe.test/api/places/search?q=tea",
    "https://cafe.test/profile?_rsc=secret",
    "https://cafe.test/photo.png?token=private",
    "https://supabase.test/storage/photo.png",
  ])("never intercepts private or cross-origin resource %s", async (url) => {
    const sw = worker();
    const response = await sw.dispatch("fetch", new Request(url));
    expect(response).toBeUndefined();
    expect(sw.cache.put).not.toHaveBeenCalled();
  });

  it("returns a generic offline page for navigation without storing visited HTML", async () => {
    const sw = worker();
    await sw.dispatch("install");
    sw.fetcher.mockRejectedValue(new Error("offline"));
    const navigation = new Request("https://cafe.test/profile");
    Object.defineProperty(navigation, "mode", { value: "navigate" });
    const response = await sw.dispatch("fetch", navigation);
    expect(await response?.text()).toBe("/offline.html");
    expect(sw.cache.put).not.toHaveBeenCalled();
  });
});
