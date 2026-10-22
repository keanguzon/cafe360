// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCafes } from "./use-cafes";

type Options = Parameters<typeof useCafes>[0];
type Value = ReturnType<typeof useCafes>;
const cafe = (id: string) => ({ id, name: id, address: "Street", coordinates: [121, 14] });
let root: Root;
let node: HTMLDivElement;
let value: Value;
let options: Options;
let cache: Map<string, never>;
const fetchMock = vi.fn();

function Probe() {
  const current = useCafes(options);
  useEffect(() => { value = current; }, [current]);
  return null;
}

function render() {
  act(() => root.render(<SWRConfig value={{ provider: () => cache, shouldRetryOnError: false, revalidateOnFocus: false }}><Probe /></SWRConfig>));
}

async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  cache = new Map<string, never>();
  options = { accountId: "a", initialCoords: [121, 14] };
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  act(() => root.unmount());
  node.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useCafes", () => {
  it("reuses_matching_map_request_key for a separate nearby list mount", async () => {
    fetchMock.mockResolvedValue({ok:true,json:async()=>({results:[cafe('map-result')]})});
    options={accountId:'a',initialQuery:' coffee ',initialCoords:[121,14],radiusMeters:1500,limit:50};
    render();await settle();const completed=value.completedSearch!;
    act(()=>root.unmount());root=createRoot(node);
    options={accountId:'a',initialQuery:completed.query,initialCoords:completed.coordinates,radiusMeters:completed.radiusMeters,limit:completed.limit};
    render();await settle();expect(fetchMock).toHaveBeenCalledTimes(1);expect(value.cafes[0]?.id).toBe('map-result');
  });
  it("retries an unchanged failed request", async () => {
    fetchMock.mockResolvedValueOnce({ok:false,status:503,json:async()=>({error:'Unavailable'})})
      .mockResolvedValue({ok:true,json:async()=>({results:[cafe('retry')]})});
    options={accountId:'a',initialQuery:'coffee',initialCoords:[121,14]};
    render();await settle();expect(value.error).toBe('Unavailable');
    await act(async()=>{await value.fetchCafes('coffee',[121,14]);});await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);expect(value.cafes[0]?.id).toBe('retry');
  });
  it("exposes only a completed request, not a pending input draft", async () => {
    fetchMock.mockResolvedValue({ ok:true, json:async()=>({results:[]}) });
    options={accountId:'a',initialQuery:'coffee',initialCoords:[121,14],radiusMeters:1500,limit:50};
    render();await settle();
    expect(value.completedSearch).toEqual({query:'coffee',coordinates:[121,14],radiusMeters:1500,limit:50});
    act(()=>value.setQuery('unsubmitted draft'));
    expect(value.completedSearch?.query).toBe('coffee');
    fetchMock.mockReturnValue(new Promise(()=>{}));
    await act(async()=>{await value.fetchCafes('tea',[122,15]);});
    expect(value.completedSearch).toBeNull();
  });
  it("hides warm results when background refresh reports an expired session", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [cafe("warm")] }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "Session expired" }) });
    await act(async () => { render(); });
    expect(value.cafes).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_001); });
    expect(value.error).toBe("Session expired");
    expect(value.cafes).toEqual([]);
  });
  it("revalidates warm results after sixty seconds without requiring remount", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: [cafe("first")] }) });
    await act(async () => { render(); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_001); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(value.isLoading).toBe(false);
  });
  it("keeps warm same-account results on remount without another skeleton", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: [cafe("first")] }) });
    render(); await settle();
    expect(value.cafes.map((item) => item.id)).toEqual(["first"]);
    act(() => root.unmount());
    root = createRoot(node);
    render();
    expect(value.cafes.map((item) => item.id)).toEqual(["first"]);
    expect(value.isLoading).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not display prior-account results during a new account request", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [cafe("private-a")] }) });
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    render(); await settle();
    options = { ...options, accountId: "b" };
    render();
    expect(value.cafes).toEqual([]);
    expect(value.isLoading).toBe(true);
  });

  it("surfaces a non-2xx response as an error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: "Quota reached" }) });
    render(); await settle();
    expect(value.error).toContain("Quota reached");
    expect(value.cafes).toEqual([]);
  });

  it("rejects a malformed successful response", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: null }) });
    render(); await settle();
    expect(value.error).toContain("Invalid café search response");
    expect(value.cafes).toEqual([]);
  });

  it("starts a manual request while autoFetch is false", async () => {
    options = { accountId: "a", autoFetch: false };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: [cafe("manual")] }) });
    render();
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => { void value.fetchCafes("tea", [120, 15]); });
    await settle();
    expect(value.cafes.map((item) => item.id)).toEqual(["manual"]);
    const url = new URL(fetchMock.mock.calls[0][0], "https://example.test");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ q: "tea", lng: "120", lat: "15", radius: "1500", limit: "50" });
  });

  it("changes effective coordinates with props without retaining old results", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [cafe("old-area")] }) });
    fetchMock.mockReturnValueOnce(new Promise(() => {}));
    render(); await settle();
    options = { ...options, initialCoords: [122, 15] };
    render();
    expect(value.coords).toEqual([122, 15]);
    expect(value.cafes).toEqual([]);
    expect(value.isLoading).toBe(true);
  });
});
