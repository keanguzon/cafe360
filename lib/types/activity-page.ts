import type { Activity } from "./social";
export type ActivityCursor = { id: string; createdAt: string };
export type ActivityPage = { items: Activity[]; nextCursor: ActivityCursor | null };
export type ActivityPageResult = { ok: true; data: ActivityPage } | { ok: false; status: number; error: string };
