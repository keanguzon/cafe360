import { describe, expect, it } from "vitest";
import { createNavigationStore } from "./navigation-state";

describe("session navigation store", () => {
  it("keeps nearby handoff in memory for one account only", () => {
    const store = createNavigationStore();
    expect(store.getSnapshot().nearbyList).toBeNull();
    store.update({ nearbyList: { query: "coffee", coordinates: [121,14], radiusMeters: 1500, limit: 50, filterTopRated: true } });
    expect(store.getSnapshot().nearbyList?.coordinates).toEqual([121,14]);
    expect(createNavigationStore().getSnapshot().nearbyList).toBeNull();
  });
  it("keeps Circle sheet positions separate and starts a new account empty", () => {
    const store=createNavigationStore();
    expect(store.getSnapshot().circleSheets).toEqual({});
    store.update({circleSheets:{A:{scrollTop:180,snap:"half"},B:{scrollTop:40,snap:"peek"}}});
    expect(store.getSnapshot().circleSheets.A).toEqual({scrollTop:180,snap:"half"});
    expect(createNavigationStore().getSnapshot().circleSheets).toEqual({});
  });
  it("retains a map view and last searched area for a warm page return", () => {
    const store = createNavigationStore();
    store.update({ map: { center: [121, 14], zoom: 16, style: "dark", query: "coffee", searchCoordinates: [121, 14] } });
    expect(store.getSnapshot().map).toMatchObject({ center: [121, 14], zoom: 16, query: "coffee" });
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("does not share snapshots between account provider instances", () => {
    const first = createNavigationStore();
    const second = createNavigationStore();
    first.update({ discover: { query: "matcha", filters: ["nearby"], scrollTop: 320 } });
    expect(second.getSnapshot().discover.query).toBe("");
    expect(second.getSnapshot().discover.scrollTop).toBe(0);
  });
});
