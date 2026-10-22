export type RootView = "nearby" | "saved" | "you";
export type SheetRoute = {
  kind: "nearby" | "saved" | "collection" | "you" | "member" | "settings" | "circles" | "circle" | "circle-create" | "circle-join" | "activity" | "memories" | "cafe" | "cafe-memories" | "visit" | "memory";
  root: RootView;
  entityId?: string;
  circleId?: string;
  edit?: boolean;
};

function validId(value: string | undefined): value is string {
  return !!value?.trim() && value !== "." && value !== ".." && !/[\u0000-\u001f\u007f]/.test(value);
}
export function sheetRoot(route: SheetRoute): RootView | null {
  if (route.kind === "nearby" || route.kind === "saved") return route.kind;
  return route.kind === "you" && !route.edit ? "you" : null;
}
export function parseSheetRoute(pathname: string, search: URLSearchParams): SheetRoute | null {
  const keys = [...search.keys()];
  if (keys.some((key) => !["circle", "view", "edit", "join"].includes(key) || search.getAll(key).length !== 1)) return null;
  let parts: string[];
  try { parts = pathname.split("/").slice(1).map(decodeURIComponent); } catch { return null; }
  if (!pathname.startsWith("/") || parts.some((part) => !validId(part))) return null;
  const [base, id, sub, extra] = parts;
  if (extra !== undefined) return null;
  const circleId = search.get("circle") ?? undefined;
  if (circleId !== undefined && !validId(circleId)) return null;
  const matches = (...allowed: string[]) => keys.every((key) => allowed.includes(key));
  const make = (kind: SheetRoute["kind"], root: RootView = "nearby", entityId?: string): SheetRoute => ({ kind, root, ...(entityId ? { entityId } : {}), ...(circleId ? { circleId } : {}) });
  if (base === "map" && !id && matches()) return make("nearby");
  if (base === "settings" && !id && matches()) return make("settings");
  if (base === "profile") {
    if (!id && matches("edit") && (!search.has("edit") || search.get("edit") === "1")) return { kind: "you", root: "you", ...(search.has("edit") ? { edit: true } : {}) };
    if (id === "collections" && matches()) return make(sub ? "collection" : "saved", "saved", sub);
    if (id && !sub && circleId && matches("circle")) return make("member", "nearby", id);
  }
  if (base === "circles") {
    if (!id && matches("join") && (!search.has("join") || search.get("join") === "1")) return make(search.has("join") ? "circle-join" : "circles");
    if (id === "groups" && sub === "new" && matches()) return make("circle-create");
    if (id && !sub && matches()) return make("circle", "nearby", id);
    if (id && sub === "timeline" && matches("view") && ["activity", "memories"].includes(search.get("view") ?? "activity")) return make((search.get("view") ?? "activity") as "activity" | "memories", "nearby", id);
  }
  if (base === "cafes" && id && circleId && matches("circle")) {
    if (!sub) return make("cafe", "nearby", id);
    if (sub === "memories" || sub === "visit") return make(sub === "visit" ? "visit" : "cafe-memories", "nearby", id);
  }
  if (base === "memories" && id && !sub && circleId && matches("circle")) return make("memory", "nearby", id);
  return null;
}
export function sheetHref(route: SheetRoute): string {
  const segment = (value?: string) => { if (!validId(value)) throw new Error("Sheet route requires a valid ID"); return encodeURIComponent(value); };
  const query = (key: string, value: string) => `?${new URLSearchParams({ [key]: value })}`;
  const circle = () => { segment(route.circleId); return query("circle", route.circleId!); };
  switch (route.kind) {
    case "nearby": return "/map";
    case "saved": return "/profile/collections";
    case "collection": return `/profile/collections/${segment(route.entityId)}`;
    case "you": return `/profile${route.edit ? "?edit=1" : ""}`;
    case "member": return `/profile/${segment(route.entityId)}${circle()}`;
    case "settings": return "/settings";
    case "circles": return "/circles";
    case "circle-join": return "/circles?join=1";
    case "circle-create": return "/circles/groups/new";
    case "circle": return `/circles/${segment(route.entityId)}`;
    case "activity": case "memories": return `/circles/${segment(route.entityId)}/timeline${query("view", route.kind)}`;
    case "cafe": case "cafe-memories": case "visit": return `/cafes/${segment(route.entityId)}${route.kind === "cafe" ? "" : route.kind === "visit" ? "/visit" : "/memories"}${circle()}`;
    case "memory": return `/memories/${segment(route.entityId)}${circle()}`;
  }
}
export function sheetParentHref(route: SheetRoute): string {
  switch (route.kind) {
    case "collection": return "/profile/collections";
    case "you": return route.edit ? "/profile" : "/map";
    case "member": return sheetHref({ kind: "circle", root: "nearby", entityId: route.circleId });
    case "circle": case "circle-create": case "circle-join": return "/circles";
    case "activity": case "memories": return sheetHref({ ...route, kind: "circle" });
    case "cafe-memories": case "visit": return sheetHref({ ...route, kind: "cafe" });
    case "memory": return sheetHref({ kind: "memories", root: "nearby", entityId: route.circleId });
    default: return "/map";
  }
}

