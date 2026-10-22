import { describe, expect, it } from "vitest";
import { parsePlacesSearch, PlacesValidationError } from "./places";

describe("parsePlacesSearch", () => {
  it("normalizes a bounded search", () => {
    expect(parsePlacesSearch(new URLSearchParams("q=%20coffee%20&lat=14.4&lng=120.9&radius=1000&limit=20"))).toEqual({
      query: "coffee", coordinates: [120.9, 14.4], radiusMeters: 1000, limit: 20,
    });
  });

  it("defaults the limit to 50", () => {
    expect(parsePlacesSearch(new URLSearchParams("q=cafe"))).toEqual({ query: "cafe", limit: 50 });
  });

  it("defaults missing and blank nearby queries to coffee cafe", () => {
    expect(parsePlacesSearch(new URLSearchParams())).toMatchObject({ query: "coffee cafe" });
    expect(parsePlacesSearch(new URLSearchParams("q=%20"))).toMatchObject({ query: "coffee cafe" });
  });

  it.each(["a", "x".repeat(201)])("rejects invalid queries", (q) => {
    expect(() => parsePlacesSearch(new URLSearchParams({ q }))).toThrow(PlacesValidationError);
  });

  it.each([
    "q=cafe&lat=14", "q=cafe&lng=120", "q=cafe&lat=91&lng=120", "q=cafe&lat=14&lng=-181",
    "q=cafe&lat=14abc&lng=120", "q=cafe&lat=Infinity&lng=120", "q=cafe&lat=&lng=120",
  ])("rejects invalid coordinates: %s", (query) => {
    expect(() => parsePlacesSearch(new URLSearchParams(query))).toThrow(PlacesValidationError);
  });

  it.each(["99", "10001", "100.5", "100abc", "", "Infinity"])("rejects invalid radius %s", (radius) => {
    expect(() => parsePlacesSearch(new URLSearchParams({ q: "cafe", radius }))).toThrow(PlacesValidationError);
  });

  it.each(["0", "51", "1.5", "2abc", "", "Infinity"])("rejects invalid limit %s", (limit) => {
    expect(() => parsePlacesSearch(new URLSearchParams({ q: "cafe", limit }))).toThrow(PlacesValidationError);
  });
});
