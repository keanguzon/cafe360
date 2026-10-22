import { expect, it } from "vitest";
import { formatHref } from "./format-href";

it("retains query arrays and hash when retrying object links", () => {
  expect(formatHref({ pathname: "/circles/qa/timeline", query: { view: "memories", tag: ["a", "b"] }, hash: "recent" }))
    .toBe("/circles/qa/timeline?view=memories&tag=a&tag=b#recent");
});

it("retains a query string and explicit search", () => {
  expect(formatHref({ pathname: "/invite/ABC123", query: "next=%2Fmap" })).toBe("/invite/ABC123?next=%2Fmap");
  expect(formatHref({ pathname: "/map", search: "q=coffee" })).toBe("/map?q=coffee");
});
