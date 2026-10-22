"use server";
import { isProfileSetupComplete } from "@/lib/auth/profile-setup";

import { revalidatePath } from "next/cache";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type {
  Group,
  GroupMember,
  GroupSavedCafe,
  GroupWithMembers,
  FriendProfile,
  GroupRole,
} from "@/lib/types/social";

type JoinedMember = Omit<GroupMember, "profile"> & { profile?: FriendProfile | FriendProfile[] | null };
type JoinedGroup = Group & { group_members?: JoinedMember[] | null };
type JoinedCafe = { name: string; address: string | null };
type JoinedSave = GroupSavedCafe & { cafes?: JoinedCafe | JoinedCafe[] | null };
type MemberProfileRow = { user_id: string; role: GroupRole; profile?: FriendProfile | FriendProfile[] | null };

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function mapMembers(members: JoinedMember[] | null | undefined): GroupMember[] {
  return (members || []).map((member) => ({
    group_id: member.group_id,
    user_id: member.user_id,
    role: member.role,
    joined_at: member.joined_at,
    profile: firstRelation(member.profile),
  }));
}

function normalizedInviteCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

// ---------- Demo fallback store ----------
const demoGroups: Map<string, Group> = new Map();
const demoGroupMembers: Map<string, GroupMember[]> = new Map();
const demoGroupSaves: Map<string, GroupSavedCafe[]> = new Map();

// ---------- Actions ----------

export async function createGroupAction(params: {
  name: string;
  description?: string;
}): Promise<{ success: boolean; groupId?: string; inviteCode?: string; error?: string }> {
  const name = params.name.trim();
  const description = params.description?.trim() || null;
  if (!name) return { success: false, error: "Group name is required" };
  if (name.length > 80 || (description?.length ?? 0) > 500) {
    return { success: false, error: "Invalid Circle details" };
  }

  if (!hasSupabaseConfig()) {
    const id = `demo-group-${Date.now()}`;
    const invite_code = Math.random().toString(36).slice(2).padEnd(6, "0").slice(0, 6).toUpperCase();
    const group: Group = {
      id,
      name,
      description,
      avatar_url: null,
      created_by: "preview-user",
      invite_code,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    demoGroups.set(id, group);
    demoGroupMembers.set(id, [
      { group_id: id, user_id: "preview-user", role: "owner", joined_at: new Date().toISOString() },
    ]);
    return { success: true, groupId: id, inviteCode: invite_code };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase.rpc("create_circle", { p_name: name, p_description: description });
    if (error) return { success: false, error: error.message };
    const result = record(data);
    if (typeof result?.groupId !== "string" || !result.groupId ||
        typeof result.inviteCode !== "string" || !/^[A-Z0-9]{6}$/.test(result.inviteCode)) {
      return { success: false, error: "Invalid Circle creation response" };
    }

    revalidatePath("/circles");
    revalidatePath("/map", "layout");
    return { success: true, groupId: result.groupId, inviteCode: result.inviteCode };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create group" };
  }
}

export async function getUserGroupsAction(): Promise<GroupWithMembers[]> {
  if (!hasSupabaseConfig()) {
    return Array.from(demoGroups.values()).map((g) => ({
      ...g,
      members: demoGroupMembers.get(g.id) || [],
      member_count: (demoGroupMembers.get(g.id) || []).length,
    }));
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

    // Get groups user is a member of
    const { data: memberships, error: memError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (memError) throw new Error(memError.message);
    if (!memberships) throw new Error("Could not load Circle memberships");
    if (memberships.length === 0) return [];

    const groupIds = memberships.map((m) => m.group_id);

    const { data: groups, error: groupError } = await supabase
      .from("groups")
      .select(`
        id, name, description, avatar_url, created_by, invite_code, created_at, updated_at,
        group_members ( group_id, user_id, role, joined_at,
          profile:user_id ( id, username, display_name, avatar_url )
        )
      `)
      .in("id", groupIds)
      .order("created_at", { ascending: false });

    if (groupError) throw new Error(groupError.message);
    if (!groups) throw new Error("Could not load Circles");

    return (groups as JoinedGroup[]).map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      avatar_url: g.avatar_url,
      created_by: g.created_by,
      invite_code: g.invite_code,
      created_at: g.created_at,
      updated_at: g.updated_at,
      members: mapMembers(g.group_members),
      member_count: (g.group_members || []).length,
    }));
}

export async function getGroupDetailsAction(
  groupId: string,
): Promise<GroupWithMembers | null> {
  if (!hasSupabaseConfig()) {
    const g = demoGroups.get(groupId);
    if (!g) return null;
    return {
      ...g,
      members: demoGroupMembers.get(groupId) || [],
      member_count: (demoGroupMembers.get(groupId) || []).length,
    };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("groups")
      .select(`
        id, name, description, avatar_url, created_by, invite_code, created_at, updated_at,
        group_members ( group_id, user_id, role, joined_at,
          profile:user_id ( id, username, display_name, avatar_url )
        )
      `)
      .eq("id", groupId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      avatar_url: data.avatar_url,
      created_by: data.created_by,
      invite_code: data.invite_code,
      created_at: data.created_at,
      updated_at: data.updated_at,
      members: mapMembers((data as unknown as JoinedGroup).group_members),
      member_count: ((data as unknown as JoinedGroup).group_members || []).length,
    };
  } catch {
    return null;
  }
}

export async function getGroupByInviteCodeAction(
  inviteCode: string,
): Promise<{ id?: string; name: string; member_count?: number } | null> {
  const code = normalizedInviteCode(inviteCode);
  if (!code) return null;

  if (!hasSupabaseConfig()) {
    const group = Array.from(demoGroups.values()).find(
      (g) => g.invite_code === code,
    );
    if (!group) return null;
    return { id: group.id, name: group.name, member_count: (demoGroupMembers.get(group.id) || []).length };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.rpc("preview_circle_invite", { p_code: code });
    if (error) return null;
    const result = record(data);
    if (typeof result?.name !== "string" || typeof result.memberCount !== "number" ||
        !Number.isSafeInteger(result.memberCount) || result.memberCount < 0) return null;
    return { name: result.name, member_count: result.memberCount };
  } catch {
    return null;
  }
}

export async function joinGroupViaInviteAction(
  inviteCode: string,
): Promise<{ success: boolean; groupId?: string; error?: string; requiresProfileSetup?: boolean }> {
  const code = normalizedInviteCode(inviteCode);
  if (!code) return { success: false, error: inviteCode.trim() ? "Invalid invite code" : "Invite code is required" };

  if (!hasSupabaseConfig()) {
    // Find demo group by invite code (case insensitive)
    const group = Array.from(demoGroups.values()).find(
      (g) => g.invite_code === code,
    );
    if (!group) return { success: false, error: "Invalid invite code" };
    const members = demoGroupMembers.get(group.id) || [];
    if (!members.some((m) => m.user_id === "preview-user")) {
      members.push({
        group_id: group.id,
        user_id: "preview-user",
        role: "member",
        joined_at: new Date().toISOString(),
      });
      demoGroupMembers.set(group.id, members);
    }
    return { success: true, groupId: group.id };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('username, display_name').eq('id', user.id).maybeSingle();
    if (profileError) return { success: false, error: 'Could not verify your profile. Please try again.' };
    if (!isProfileSetupComplete(profile, user.id)) {
      return { success: false, requiresProfileSetup: true, error: 'Choose your display name and username before joining a Circle.' };
    }

    const { data, error } = await supabase.rpc("join_circle", { p_code: code });
    if (error) return { success: false, error: error.message };
    const result = record(data);
    if (typeof result?.groupId !== "string" || !result.groupId) {
      return { success: false, error: "Invalid Circle join response" };
    }

    revalidatePath("/circles");
    revalidatePath(`/circles/${result.groupId}`);
    revalidatePath("/map", "layout");
    return { success: true, groupId: result.groupId };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to join group" };
  }
}

export async function leaveGroupAction(
  groupId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!hasSupabaseConfig()) {
    const members = demoGroupMembers.get(groupId) || [];
    demoGroupMembers.set(groupId, members.filter((m) => m.user_id !== "preview-user"));
    return { success: true };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase.rpc("leave_circle", { p_group_id: groupId });
    if (error) return { success: false, error: error.message };
    if (record(data)?.left !== true) return { success: false, error: "Circle leave was not confirmed" };
    revalidatePath("/circles");
    revalidatePath("/map", "layout");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to leave group" };
  }
}

export async function deleteGroupAction(
  groupId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!hasSupabaseConfig()) {
    demoGroups.delete(groupId);
    demoGroupMembers.delete(groupId);
    return { success: true };
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { data, error } = await supabase.rpc("delete_circle", { p_group_id: groupId });
    if (error) return { success: false, error: error.message };
    if (record(data)?.deleted !== true) return { success: false, error: "Circle deletion was not confirmed" };
    revalidatePath("/circles");
    revalidatePath("/map", "layout");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete group" };
  }
}

export async function getGroupSavedCafesAction(
  groupId: string,
): Promise<GroupSavedCafe[]> {
  if (!hasSupabaseConfig()) {
    return demoGroupSaves.get(groupId) || [];
  }

  const supabase = await createClient();

    const { data, error } = await supabase
      .from("group_saved_cafes")
      .select(`
        id, group_id, cafe_id, saved_by, created_at,
        cafes:cafe_id ( name, address )
      `)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Could not load Circle saves");

    return (data as unknown as JoinedSave[]).map((row) => ({
      id: row.id,
      group_id: row.group_id,
      cafe_id: row.cafe_id,
      saved_by: row.saved_by,
      created_at: row.created_at,
      cafe_name: firstRelation(row.cafes)?.name,
      cafe_address: firstRelation(row.cafes)?.address ?? undefined,
    }));
}

export async function getUserCirclesSummaryAction(): Promise<import("@/lib/types/social").CircleSummary[]> {
  const groups = await getUserGroupsAction();
  
  let currentUserId: string | null = null;
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error("Not authenticated");
    currentUserId = user.id;
  } else {
    currentUserId = "preview-user";
  }

  return groups.map((g) => {
    const userMember = g.members.find((m) => m.user_id === currentUserId);
    const isOwner = g.created_by === currentUserId || userMember?.role === "owner";
    
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      avatar_url: g.avatar_url,
      invite_code: g.invite_code || "CODE",
      member_count: g.member_count,
      role: (isOwner ? "owner" : (userMember?.role || "member")) as import("@/lib/types/social").GroupRole,
      preview_avatars: g.members.map((m) => m.profile?.avatar_url || null).slice(0, 4),
    };
  });
}

export async function getCircleMembersAction(
  groupId: string,
): Promise<import("@/lib/types/social").CircleMemberInfo[]> {
  if (!hasSupabaseConfig()) {
    const members = demoGroupMembers.get(groupId) || [];
    return members.map((m) => ({
      userId: m.user_id,
      role: m.role,
      displayName: m.user_id === "preview-user" ? "You" : "Circle Friend",
      avatarUrl: null,
    }));
  }

  const supabase = await createClient();
    const { data: members, error } = await supabase
      .from("group_members")
      .select(`
        user_id,
        role,
        profile:user_id(id, username, display_name, avatar_url)
      `)
      .eq("group_id", groupId);

    if (error) throw new Error(error.message);
    if (!members) throw new Error("Could not load Circle members");

    return (members as unknown as MemberProfileRow[]).map((m) => ({
      userId: m.user_id,
      role: m.role,
      displayName: firstRelation(m.profile)?.display_name || firstRelation(m.profile)?.username || "Circle Member",
      avatarUrl: firstRelation(m.profile)?.avatar_url || null,
    }));
}
