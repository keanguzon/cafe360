// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import useSWR from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HttpResponseError, SWRProvider } from "./swr-provider";

let root: Root;
let container: HTMLDivElement;
let latest: { privateValue: string | undefined; authError: string | null; trigger: () => Promise<unknown> };

function Probe({ fetchForbidden }: { fetchForbidden: () => Promise<string> }) {
  const privateResource = useSWR("private-resource", async () => "cached private data");
  const authResource = useSWR("auth-resource", fetchForbidden);
  useEffect(() => { latest = { privateValue: privateResource.data, authError: authResource.error?.message ?? null, trigger: () => authResource.mutate() }; });
  return null;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

it("notifies mounted sibling resources when a 401 clears the cache", async () => {
  const fetchForbidden = vi.fn().mockResolvedValueOnce("initial data").mockRejectedValue(new HttpResponseError("Session expired", 401));
  act(() => root.render(<SWRProvider><Probe fetchForbidden={fetchForbidden} /></SWRProvider>));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(latest.privateValue).toBe("cached private data");
  await act(async () => { await latest.trigger(); });
  expect(latest.privateValue).toBeUndefined();
  expect(latest.authError).toBe("Session expired");
});
it("keeps unrelated cached data when one Circle resource returns 403", async () => {
  const fetchForbidden = vi.fn().mockResolvedValueOnce("initial data").mockRejectedValue(new HttpResponseError("Circle unavailable", 403));
  act(() => root.render(<SWRProvider><Probe fetchForbidden={fetchForbidden} /></SWRProvider>));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(latest.privateValue).toBe("cached private data");
  await act(async () => { await latest.trigger(); });
  expect(latest.privateValue).toBe("cached private data");
  expect(latest.authError).toBe("Circle unavailable");
});
