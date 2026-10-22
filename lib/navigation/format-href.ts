import type { UrlObject } from "url";

export function formatHref(href: string | UrlObject): string {
  if (typeof href === "string") return href;
  const query = new URLSearchParams(typeof href.query === "string" ? href.query : undefined);
  for (const [key, value] of Object.entries(typeof href.query === "object" ? href.query ?? {} : {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) query.append(key, item === null ? "" : String(item));
    }
  }
  const rawSearch = href.search ?? (query.size ? `?${query}` : "");
  const search = rawSearch && !rawSearch.startsWith("?") ? `?${rawSearch}` : rawSearch;
  const hash = href.hash ? (href.hash.startsWith("#") ? href.hash : `#${href.hash}`) : "";
  return `${href.pathname ?? "/"}${search}${hash}`;
}
