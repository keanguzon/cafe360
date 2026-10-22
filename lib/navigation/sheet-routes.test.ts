import { describe, expect, it } from "vitest";
import { parseSheetRoute, sheetHref, sheetParentHref } from "./sheet-routes";

const rows = [
  ["/map", "nearby"], ["/profile/collections", "saved"],
  ["/profile/collections/Weekend%20%2F%20coffee", "collection"],
  ["/profile", "you"], ["/profile?edit=1", "you"],
  ["/profile/person?circle=group", "member"], ["/settings", "settings"],
  ["/circles", "circles"], ["/circles/group", "circle"],
  ["/circles/groups/new", "circle-create"], ["/circles?join=1", "circle-join"],
  ["/circles/group/timeline?view=activity", "activity"],
  ["/circles/group/timeline?view=memories", "memories"],
  ["/cafes/google%3Aplace%2Fid?circle=group", "cafe"],
  ["/cafes/cafe/memories?circle=group", "cafe-memories"],
  ["/cafes/cafe/visit?circle=group", "visit"],
  ["/memories/visit?circle=group", "memory"],
];
function parse(href: string) { const url = new URL(href, "https://cafe.test"); return parseSheetRoute(url.pathname, url.searchParams); }
describe("sheet routes", () => {
  it("normalizes the existing timeline URL to activity", () => expect(sheetHref(parse("/circles/group/timeline")!)).toBe("/circles/group/timeline?view=activity"));
  it.each(rows)("round trips %s", (href, kind) => { const route = parse(href)!; expect(route?.kind).toBe(kind); expect(sheetHref(route)).toBe(href); });
  it.each(["/unknown", "/profile/member", "/profile/member?circle=", "/profile/member?circle=A&circle=B", "/profile?edit=0", "/profile?edit=1&edit=1", "/circles?join=yes", "/circles/A/timeline?view=no", "/cafes/%ZZ?circle=A", "/cafes/cafe?circle=A&circle=A", "/memories/id", "/profile?notes=private", "/cafes/%2E%2E?circle=A"])("rejects %s", (href) => expect(parse(href)).toBeNull());
  it.each([
    ["/memories/visit?circle=group", "/circles/group/timeline?view=memories"],
    ["/cafes/cafe/memories?circle=group", "/cafes/cafe?circle=group"],
    ["/cafes/cafe/visit?circle=group", "/cafes/cafe?circle=group"],
    ["/profile/collections/name", "/profile/collections"], ["/profile?edit=1", "/profile"],
    ["/profile/member?circle=group", "/circles/group"], ["/settings", "/map"],
  ])("safe parent %s", (href, parent) => expect(sheetParentHref(parse(href)!)).toBe(parent));
});

