"use server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/profile";
import type { VisitWithDetails } from "@/lib/types/visit";
function denied(status: number, message: string): never {
    throw Object.assign(new Error(message), { name: "SheetReadError", status });
}
async function session(expectedAccountId: string) {
    if (!hasSupabaseConfig())
        denied(503, "This content requires a connected account.");
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user || data.user.id !== expectedAccountId)
        denied(401, "Your account changed. Please reopen this content.");
    return { client, user: data.user };
}
async function requireMember(client: Awaited<ReturnType<typeof createClient>>, circleId: string, userId: string) {
    const { data, error } = await client.from("group_members").select("user_id").eq("group_id", circleId).eq("user_id", userId).maybeSingle();
    if (error)
        denied(503, "Could not verify Circle access. Please retry.");
    if (!data)
        denied(403, "This Circle content is unavailable.");
}
async function readProfile(input: {
    expectedAccountId: string;
    userId?: string;
    circleId?: string;
}): Promise<Profile> {
    const { client, user } = await session(input.expectedAccountId);
    const userId = input.userId ?? user.id;
    if (userId !== user.id) {
        if (!input.circleId)
            denied(403, "A shared Circle is required.");
        await requireMember(client, input.circleId, user.id);
        await requireMember(client, input.circleId, userId);
    }
    const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error)
        denied(503, "Could not load profile. Please retry.");
    if (!data && userId === user.id) {
        const metadata = user.user_metadata ?? {};
        const text = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
        return {
            id: user.id,
            username: text(metadata.username) ?? user.email?.split("@")[0]?.replace(/[^a-z0-9_]/gi, "_").toLowerCase() ?? "user_" + user.id.slice(0, 8),
            display_name: text(metadata.display_name) ?? text(metadata.full_name) ?? text(metadata.name) ?? "Cafe Explorer",
            avatar_url: text(metadata.avatar_url) ?? text(metadata.picture),
            bio: null,
            created_at: user.created_at ?? new Date().toISOString(),
            updated_at: user.created_at ?? new Date().toISOString(),
        };
    }
    if (!data)
        denied(404, "Profile unavailable.");
    return data as Profile;
}
async function readMemory(input: {
    expectedAccountId: string;
    visitId: string;
    circleId: string;
}): Promise<VisitWithDetails> {
    const { client, user } = await session(input.expectedAccountId);
    if (!input.circleId)
        denied(403, "A Circle is required.");
    await requireMember(client, input.circleId, user.id);
    const { data, error } = await client.from("visits").select(`*, cafe:cafes(*), creator:profiles!created_by(*), participants:visit_participants(user:profiles(*)), photos:visit_photos(*)`).eq("id", input.visitId).eq("group_id", input.circleId).maybeSingle();
    if (error)
        denied(503, "Could not load memory. Please retry.");
    if (!data || data.group_id !== input.circleId)
        denied(403, "This Circle memory is unavailable.");
    // PrivatePhoto authorizes each path again before creating its short-lived URL.
    return data as VisitWithDetails;
}
export type SheetReadResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    status: number;
    error: string;
};
async function result<T>(read: () => Promise<T>): Promise<SheetReadResult<T>> {
    try {
        return { ok: true, data: await read() };
    }
    catch (cause) {
        const status = cause && typeof cause === "object" && "status" in cause && typeof cause.status === "number" ? cause.status : 503;
        return { ok: false, status, error: cause instanceof Error ? cause.message : "Content unavailable. Please retry." };
    }
}
export async function readSheetProfileAction(input: {
    expectedAccountId: string;
    userId?: string;
    circleId?: string;
}): Promise<SheetReadResult<Profile>> {
    return result(() => readProfile(input));
}
export async function readSheetMemoryAction(input: {
    expectedAccountId: string;
    visitId: string;
    circleId: string;
}): Promise<SheetReadResult<VisitWithDetails>> {
    return result(() => readMemory(input));
}
export async function readSheetCircleAction(input: {
    expectedAccountId: string;
    circleId: string;
}) {
    return result(async () => {
        const { client, user } = await session(input.expectedAccountId);
        await requireMember(client, input.circleId, user.id);
        const { getGroupDetailsAction } = await import("./group-actions");
        const group = await getGroupDetailsAction(input.circleId);
        if (!group || group.id !== input.circleId)
            denied(403, "This Circle is unavailable.");
        return group;
    });
}
