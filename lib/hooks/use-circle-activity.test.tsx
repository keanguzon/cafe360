// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig, type Cache } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCircleActivity } from "./use-circle-activity";
const mocks = vi.hoisted(() => ({ page: vi.fn() }));
vi.mock("@/lib/actions/circle-activity-actions", () => ({ getCircleActivityPageAction: mocks.page }));
let root: Root;
let container: HTMLDivElement;
let latest: ReturnType<typeof useCircleActivity>;
let items: { id: string; group_id: string; created_at: string }[];
let cache: Cache;
function Probe({ account, circle }: { account: string; circle: string | null }) {
  const data = useCircleActivity(account, circle);
  useEffect(() => { latest = data; }, [data]);
  return <span>{data.activities.map((item) => item.id).join(",")}</span>;
}
async function render(account = "owner", circle: string | null = "A") {
  await act(async () => { root.render(<SWRConfig value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false }}><Probe account={account} circle={circle} /></SWRConfig>); });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); cache = new Map();
  items = Array.from({ length: 5 }, (_, i) => ({ id: `event-${i}`, group_id: "A", created_at: "2026-10-16T00:00:00Z" }));
  mocks.page.mockImplementation(async (_group, cursor) => {
    const offset = cursor ? items.findIndex((item) => item.id === cursor.id) + 1 : 0;
    const page = items.slice(offset, offset + 2);
    return { ok: true, data: { items: page, nextCursor: offset + 2 < items.length ? { id: page.at(-1)!.id, createdAt: page.at(-1)!.created_at } : null } };
  });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
it("revalidates all loaded cursor pages after a new visit without gaps or duplicates", async () => {
  await render();
  await act(async () => { await latest.loadMore(); });
  expect(latest.activities.map((item) => item.id)).toEqual(["event-0", "event-1", "event-2", "event-3"]);
  items.unshift({ id: "new-visit", group_id: "A", created_at: "2026-10-16T00:01:00Z" });
  await act(async () => { await latest.refresh(); });
  expect(latest.activities.map((item) => item.id)).toEqual(["new-visit", "event-0", "event-1", "event-2"]);
});
it("waits for a Circle and never falls back to an all-Circle feed", async () => {
  await render("owner", null);
  expect(mocks.page).not.toHaveBeenCalled();
  expect(latest.activities).toEqual([]);
});
it("hides cached activities after access is revoked", async () => {
  await render(); expect(latest.activities).toHaveLength(2);
  mocks.page.mockResolvedValue({ ok: false, status: 403, error: "Circle membership required" });
  await act(async () => { await latest.refresh(); });
  expect(latest.activities).toEqual([]);
  expect(latest.error).toContain("membership");
});
it("does not reuse another account's cached feed", async () => {
  await render();
  mocks.page.mockImplementation(() => new Promise(() => {}));
  await render("second-account");
  expect(latest.activities).toEqual([]);
  expect(container.textContent).not.toContain("event-0");
});
