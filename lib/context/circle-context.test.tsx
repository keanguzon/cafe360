// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig, unstable_serialize, type Cache } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CircleSummary } from "@/lib/types/social";
import { fetchJson, HttpResponseError } from "@/components/providers/swr-provider";
import { CircleProvider, useCircle } from "./circle-context";
import { circleDataKey } from "@/lib/hooks/use-circle-data";

const actions = vi.hoisted(() => ({
  memberships: vi.fn(),
  snapshot: vi.fn(),
}));

vi.mock("@/lib/actions/circle-memberships-actions", () => ({
  getAccountCirclesAction: actions.memberships,
}));
vi.mock("@/lib/actions/circle-data-actions", () => ({ getCircleDataAction: actions.snapshot }));

type Context = ReturnType<typeof useCircle>;
const circle = (id: string): CircleSummary => ({
  id, name: id, description: null, avatar_url: null, invite_code: id,
  member_count: 1, role: "owner", preview_avatars: [],
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

let root: Root | null;
let container: HTMLDivElement;
let latest: Context;
let cache: Cache;

function Probe() {
  const context = useCircle();
  useEffect(() => { latest = context; }, [context]);
  return null;
}

function render(accountId: string) {
  act(() => root?.render(
    <SWRConfig value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false, revalidateOnFocus: false }}>
      <CircleProvider accountId={accountId}><Probe /></CircleProvider>
    </SWRConfig>,
  ));
}

async function settle() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  vi.clearAllMocks();
  actions.memberships.mockResolvedValue({ ok: true, data: [circle("A"), circle("B")] });
  actions.snapshot.mockImplementation(async (id: string) => ({ ok: true, data: {
    members: [{ userId: id, displayName: id, role: "owner", avatarUrl: null }],
    visits: [], savedCafes: [], cafeSummaries: [],
  } }));
  cache = new Map();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container.remove();
});

describe("CircleProvider cache boundaries", () => {
  it("never shows A members after switching to B while A resolves late", async () => {
    const slowA = deferred<Awaited<ReturnType<typeof actions.snapshot>>>();
    actions.snapshot.mockImplementation((id: string) => id === "A" ? slowA.promise : Promise.resolve({ ok: true, data: { members: [{ userId: "B", displayName: "B", role: "owner", avatarUrl: null }], visits: [], savedCafes: [], cafeSummaries: [] } }));
    render("account-1");
    await settle();
    expect(latest.activeCircle?.id).toBe("A");
    act(() => latest.setActiveCircleId("B"));
    expect(latest.circleMembers).toEqual([]);
    await settle();
    expect(latest.activeCircle?.id).toBe("B");
    expect(latest.circleMembers.map((member) => member.userId)).toEqual(["B"]);
    await act(async () => { slowA.resolve({ ok: true, data: { members: [{ userId: "A", displayName: "A", role: "owner", avatarUrl: null }], visits: [], savedCafes: [], cafeSummaries: [] } }); await slowA.promise; });
    expect(latest.circleMembers.map((member) => member.userId)).toEqual(["B"]);
  });

  it("does not reuse previous account data and selects only a current membership", async () => {
    render("account-1");
    await settle();
    expect(latest.circleMembers[0]?.userId).toBe("A");
    const next = deferred<{ ok: true; data: CircleSummary[] }>();
    actions.memberships.mockReturnValueOnce(next.promise);
    render("account-2");
    expect(latest.accountId).toBe("account-2");
    expect(latest.activeCircle).toBeNull();
    expect(latest.circleMembers).toEqual([]);
    expect(cache.get(unstable_serialize(circleDataKey("account-1", "A")))).toBeUndefined();
    await act(async () => { next.resolve({ ok: true, data: [circle("C")] }); await next.promise; });
    await settle();
    expect(latest.activeCircle?.id).toBe("C");
  });

  it("refreshes memberships before selecting a newly created Circle", async () => {
    render("account-1");
    await settle();
    const selectFromOriginalDialog = latest.setActiveCircleId;
    actions.memberships.mockResolvedValueOnce({ ok: true, data: [circle("A"), circle("B"), circle("C")] });
    let fresh: CircleSummary[] = [];
    await act(async () => { fresh = await latest.refreshMemberships(); });
    expect(fresh.map((item) => item.id)).toContain("C");
    act(() => selectFromOriginalDialog("C"));
    await settle();
    expect(latest.activeCircle?.id).toBe("C");
  });

  it("renders warm Circle data immediately on return", async () => {
    render("account-1");
    await settle();
    expect(latest.circleMembers[0]?.userId).toBe("A");
    act(() => latest.setActiveCircleId("B"));
    await settle();
    act(() => latest.setActiveCircleId("A"));
    expect(latest.circleMembers[0]?.userId).toBe("A");
    expect(latest.isLoading).toBe(false);
  });

  it("keeps persisted selection separate for each account", async () => {
    render("account-1");
    await settle();
    act(() => latest.setActiveCircleId("B"));
    render("account-2");
    await settle();
    expect(latest.activeCircle?.id).toBe("A");
    render("account-1");
    await settle();
    expect(latest.activeCircle?.id).toBe("B");
  });

  it.each([401, 403])("hides cached Circle data after a %i response", async (status) => {
    render("account-1");
    await settle();
    expect(latest.circleMembers[0]?.userId).toBe("A");
    actions.snapshot.mockResolvedValueOnce({ ok: false, status, error: "Access revoked" });
    await act(async () => { await latest.refreshCircleData(); });
    expect(latest.error).toBe("Access revoked");
    expect(latest.circleMembers).toEqual([]);
    expect(cache.get(unstable_serialize(circleDataKey("account-1", "A")))).toBeUndefined();
  });

  it("invalidates the active Circle after a mutation", async () => {
    render("account-1");
    await settle();
    actions.snapshot.mockResolvedValueOnce({ ok: true, data: { members: [{ userId: "new-member", displayName: "New", role: "member", avatarUrl: null }], visits: [], savedCafes: [], cafeSummaries: [] } });
    await act(async () => { await latest.invalidateCircle(); });
    expect(latest.circleMembers[0]?.userId).toBe("new-member");
  });

  it("drops a Circle resource and its cached memory photos when membership is revoked", async () => {
    render("account-1");
    await settle();
    act(() => latest.setActiveCircleId("A"));
    const key = unstable_serialize(circleDataKey("account-1", "A"));
    const photoKeyA = unstable_serialize(["memory-photo", "account-1", "A", "user/photo-a.jpg"]);
    const photoKeyB = unstable_serialize(["memory-photo", "account-1", "B", "user/photo-b.jpg"]);
    cache.set(photoKeyA, { data: { url: "https://example.test/a.jpg" }, _k: ["memory-photo", "account-1", "A", "user/photo-a.jpg"] } as never);
    cache.set(photoKeyB, { data: { url: "https://example.test/b.jpg" }, _k: ["memory-photo", "account-1", "B", "user/photo-b.jpg"] } as never);
    expect(cache.get(key)).toBeDefined();
    actions.memberships.mockResolvedValueOnce({ ok: true, data: [circle("B")] });
    await act(async () => { await latest.refreshMemberships(); });
    expect(latest.activeCircle?.id).toBe("B");
    expect(latest.circleMembers[0]?.userId).toBe("B");
    expect(cache.get(key)).toBeUndefined();
    expect(cache.get(photoKeyA)).toBeUndefined();
    expect(cache.get(photoKeyB)).toBeDefined();
  });

  it("rechecks membership when the app resumes", async () => {
    render("account-1");
    await settle();
    actions.memberships.mockResolvedValueOnce({ ok: true, data: [circle("B")] });
    await act(async () => { window.dispatchEvent(new Event("pageshow")); await Promise.resolve(); });
    expect(latest.activeCircle?.id).toBe("B");
  });

  it("surfaces a failed membership refresh", async () => {
    render("account-1");
    await settle();
    actions.memberships.mockRejectedValueOnce(new Error("Membership unavailable"));
    await act(async () => { await latest.refreshMemberships().catch(() => undefined); });
    expect(latest.error).toBe("Membership unavailable");
  });

  it.each([401, 403])("hides warm private data and clears account cache on membership %i", async (status) => {
    render("account-1");
    await settle();
    const circleKey = unstable_serialize(circleDataKey("account-1", "A"));
    expect(cache.get(circleKey)).toBeDefined();
    actions.memberships.mockResolvedValueOnce({ ok: false, status, error: "Access expired" });
    await act(async () => { await latest.refreshMemberships().catch(() => undefined); });
    expect(latest.error).toBe("Access expired");
    expect(latest.activeCircle).toBeNull();
    expect(latest.userCircles).toEqual([]);
    expect(latest.circleMembers).toEqual([]);
    expect(cache.get(circleKey)).toBeUndefined();
    expect(cache.get(unstable_serialize(["circle-memberships", "account-1"]))).toBeUndefined();
  });

  it("keeps warm private data on transient membership failure", async () => {
    render("account-1");
    await settle();
    actions.memberships.mockResolvedValueOnce({ ok: false, status: 503, error: "Membership unavailable" });
    await act(async () => { await latest.refreshMemberships().catch(() => undefined); });
    expect(latest.error).toBe("Membership unavailable");
    expect(latest.activeCircle?.id).toBe("A");
    expect(latest.circleMembers[0]?.userId).toBe("A");
  });

  it("throws a typed HTTP error for non-2xx JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "Access denied" }),
    }));
    await expect(fetchJson("/api/private")).rejects.toMatchObject({
      name: "HttpResponseError", status: 403, message: "Access denied",
    } satisfies Partial<HttpResponseError>);
    vi.unstubAllGlobals();
  });
});

describe("confirmed Circle departure", () => {
  it("does not revive a departed Circle from an older membership request or late snapshot", async () => {
    const snapshot = deferred<{ok:true;data:{members:{userId:string;displayName:string;role:"owner";avatarUrl:null}[];visits:[];savedCafes:[];cafeSummaries:[]}}>();
    actions.snapshot.mockReturnValueOnce(snapshot.promise);
    render("account-1"); await settle();
    const membership = deferred<{ok:true;data:CircleSummary[]}>();
    actions.memberships.mockReturnValueOnce(membership.promise);
    let pending!: Promise<CircleSummary[]>;
    act(() => { pending = latest.refreshMemberships(); });
    act(() => latest.evictMembership("A"));
    await act(async () => {
      membership.resolve({ok:true,data:[circle("A"),circle("B")]});
      snapshot.resolve({ok:true,data:{members:[{userId:"SECRET",displayName:"SECRET",role:"owner",avatarUrl:null}],visits:[],savedCafes:[],cafeSummaries:[]}});
      await pending; await snapshot.promise;
    });
    expect(latest.userCircles.map((item)=>item.id)).toEqual(["B"]);
    expect(latest.activeCircle?.id).toBe("B");
    expect(latest.circleMembers.some((member)=>member.userId==="SECRET")).toBe(false);
  });

  it("allows a later verified rejoin after departure was acknowledged", async () => {
    render("account-1"); await settle();
    act(() => latest.evictMembership("A"));
    actions.memberships.mockResolvedValueOnce({ok:true,data:[circle("B")]});
    await act(async()=>{await latest.refreshMemberships();});
    actions.memberships.mockResolvedValueOnce({ok:true,data:[circle("A"),circle("B")]});
    await act(async()=>{await latest.refreshMemberships();});
    expect(latest.userCircles.map((item)=>item.id)).toContain("A");
  });
});

describe("sheet resource departure eviction",()=>{
  it("evicts only the departed account and Circle sheet entries",async()=>{
    render("account-1");await settle();
    const own=["sheet-memory","account-1","A","visit"];
    const profile=["sheet-profile","account-1","A","person"];
    const other=["sheet-memory","account-1","B","visit"];
    const account=["sheet-memory","account-2","A","visit"];
    for(const key of [own,profile,other,account]){const entry={_k:key,data:{private:true}};cache.set(unstable_serialize(key),entry);}
    act(()=>latest.evictMembership("A"));await settle();
    expect(cache.get(unstable_serialize(own))).toBeUndefined();
    expect(cache.get(unstable_serialize(profile))).toBeUndefined();
    expect(cache.get(unstable_serialize(other))).toBeDefined();
    expect(cache.get(unstable_serialize(account))).toBeDefined();
  });
});

