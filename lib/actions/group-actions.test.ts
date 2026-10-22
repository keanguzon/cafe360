import { beforeEach, describe, expect, it, vi } from "vitest";

const testSupabase = vi.hoisted(() => ({
  configured: false,
  user: { id: "user-1" } as { id: string } | null,
  rpc: vi.fn(),
  from: vi.fn(),
  profile: {username:'coffee',display_name:'Coffee'} as {username:string;display_name:string}|null,
  profileError: null as {message:string}|null,
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => testSupabase.configured }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: testSupabase.user } }) },
    rpc: testSupabase.rpc,
    from: testSupabase.from,
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: testSupabase.revalidatePath }));
import {
  createGroupAction,
  getUserGroupsAction,
  getGroupDetailsAction,
  getGroupByInviteCodeAction,
  joinGroupViaInviteAction,
  leaveGroupAction,
  deleteGroupAction,
  getGroupSavedCafesAction,
  getCircleMembersAction,
  getUserCirclesSummaryAction,
} from "./group-actions";

describe("group-actions (demo mode)", () => {
  beforeEach(() => { testSupabase.configured = false; });
  let createdGroupId: string;
  let createdInviteCode: string;

  it("creates a group in demo mode", async () => {
    const result = await createGroupAction({
      name: "Coffee Crawl Crew",
      description: "Weekend café exploration",
    });
    expect(result.success).toBe(true);
    expect(result.groupId).toBeDefined();
    expect(result.inviteCode).toBeDefined();
    createdGroupId = result.groupId!;
    createdInviteCode = result.inviteCode!;
  });

  it("validates empty group name", async () => {
    const result = await createGroupAction({ name: "   " });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Group name is required");
  });

  it("lists user groups in demo mode", async () => {
    const groups = await getUserGroupsAction();
    expect(groups.length).toBeGreaterThan(0);
    const found = groups.find((g) => g.id === createdGroupId);
    expect(found).toBeDefined();
    expect(found?.name).toBe("Coffee Crawl Crew");
    expect(found?.member_count).toBe(1); // creator is auto-added as owner
    createdInviteCode = found!.invite_code;
  });

  it("gets group details in demo mode", async () => {
    const group = await getGroupDetailsAction(createdGroupId);
    expect(group).not.toBeNull();
    expect(group?.name).toBe("Coffee Crawl Crew");
    expect(group?.members.length).toBe(1);
    expect(group?.members[0].role).toBe("owner");
  });

  it("returns null for non-existent group", async () => {
    const group = await getGroupDetailsAction("non-existent-id");
    expect(group).toBeNull();
  });

  it("joins a group via invite code in demo mode", async () => {
    const result = await joinGroupViaInviteAction(createdInviteCode);
    expect(result.success).toBe(true);
    expect(result.groupId).toBe(createdGroupId);
  });

  it("rejects invalid invite code", async () => {
    const result = await joinGroupViaInviteAction("invalid-code");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid invite code");
  });

  it("leaves a group in demo mode", async () => {
    const result = await leaveGroupAction(createdGroupId);
    expect(result.success).toBe(true);
  });
});

describe("group-actions (configured Supabase)", () => {
  beforeEach(() => {
    testSupabase.configured = true;
    testSupabase.user = { id: "user-1" };
    testSupabase.rpc.mockReset();
    testSupabase.from.mockReset();
    testSupabase.profile={username:'coffee',display_name:'Coffee'};
    testSupabase.profileError=null;
    testSupabase.from.mockImplementation((table:string)=>table==='profiles'?{select:()=>({eq:()=>({maybeSingle:async()=>({data:testSupabase.profile,error:testSupabase.profileError})})})}:undefined);
    testSupabase.revalidatePath.mockReset();
  });

  it("keeps membership query failure distinct from a verified empty Circle list", async () => {
    testSupabase.from.mockReturnValue({ select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: "Membership unavailable" } }) }) });
    await expect(getUserCirclesSummaryAction()).rejects.toThrow("Membership unavailable");
    testSupabase.from.mockReturnValue({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) });
    await expect(getUserCirclesSummaryAction()).resolves.toEqual([]);
  });

  it("does not turn member or shared-save query errors into empty arrays", async () => {
    testSupabase.from.mockImplementation((table: string) => table === "group_members"
      ? { select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: "Members unavailable" } }) }) }
      : { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: "Saves unavailable" } }) }) }) });
    await expect(getCircleMembersAction("circle-1")).rejects.toThrow("Members unavailable");
    await expect(getGroupSavedCafesAction("circle-1")).rejects.toThrow("Saves unavailable");
  });

  it("creates the Circle through one RPC with trimmed details", async () => {
    testSupabase.rpc.mockResolvedValue({ data: { groupId: "circle-1", inviteCode: "ABC123" }, error: null });
    expect(await createGroupAction({ name: "  Coffee  ", description: "  Friends  " })).toEqual({ success: true, groupId: "circle-1", inviteCode: "ABC123" });
    expect(testSupabase.rpc).toHaveBeenCalledWith("create_circle", { p_name: "Coffee", p_description: "Friends" });
    expect(testSupabase.from).not.toHaveBeenCalled();
  });

  it("rejects a name over the schema limit before calling Supabase", async () => {
    expect((await createGroupAction({ name: "x".repeat(81) })).success).toBe(false);
    expect(testSupabase.rpc).not.toHaveBeenCalled();
  });

  it("does not call lifecycle RPCs without a user", async () => {
    testSupabase.user = null;
    expect(await createGroupAction({ name: "Coffee" })).toMatchObject({ success: false, error: "Not authenticated" });
    expect(await joinGroupViaInviteAction("ABC123")).toMatchObject({ success: false, error: "Not authenticated" });
    expect(await getGroupByInviteCodeAction("ABC123")).toBeNull();
    expect(await leaveGroupAction("circle-1")).toMatchObject({ success: false, error: "Not authenticated" });
    expect(await deleteGroupAction("circle-1")).toMatchObject({ success: false, error: "Not authenticated" });
    expect(testSupabase.rpc).not.toHaveBeenCalled();
  });

  it("previews only name and count from a normalized exact code", async () => {
    testSupabase.rpc.mockResolvedValue({ data: { name: "Coffee", memberCount: 2 }, error: null });
    expect(await getGroupByInviteCodeAction(" ab12cd ")).toEqual({ name: "Coffee", member_count: 2 });
    expect(testSupabase.rpc).toHaveBeenCalledWith("preview_circle_invite", { p_code: "AB12CD" });
    expect(testSupabase.from).not.toHaveBeenCalled();
  });

  it("rejects malformed invite codes before Supabase access", async () => {
    expect(await getGroupByInviteCodeAction("ABC-12")).toBeNull();
    expect(await joinGroupViaInviteAction("ABC-12")).toMatchObject({ success: false });
    expect(testSupabase.rpc).not.toHaveBeenCalled();
  });

  it("joins only through join_circle and never falls back to table writes", async () => {
    testSupabase.rpc.mockResolvedValue({ data: { groupId: "circle-1" }, error: null });
    expect(await joinGroupViaInviteAction(" ab12cd ")).toEqual({ success: true, groupId: "circle-1" });
    expect(testSupabase.rpc).toHaveBeenCalledWith("join_circle", { p_code: "AB12CD" });
    expect(testSupabase.from).toHaveBeenCalledWith('profiles');
  });

  it("returns an RPC error without direct join fallback", async () => {
    testSupabase.rpc.mockResolvedValue({ data: null, error: { message: "Invalid invite code" } });
    expect(await joinGroupViaInviteAction("ABC123")).toEqual({ success: false, error: "Invalid invite code" });
    expect(testSupabase.from).toHaveBeenCalledWith('profiles');
  });

  it('blocks fresh accounts before the join RPC until their profile is chosen',async()=>{
    testSupabase.user={id:'83aa43f1-e1f4-4733-8977-dda4bb28e3d2'};
    testSupabase.profile={username:'user_83aa43f1e1f44733',display_name:'Cafe explorer'};
    testSupabase.rpc.mockResolvedValue({data:{groupId:'circle-1'},error:null});
    expect(await joinGroupViaInviteAction('ABC123')).toMatchObject({success:false,requiresProfileSetup:true});
    expect(testSupabase.rpc).not.toHaveBeenCalled();
  });
  it('fails closed when the profile lookup fails',async()=>{
    testSupabase.profileError={message:'Profile unavailable'};
    testSupabase.rpc.mockResolvedValue({data:{groupId:'circle-1'},error:null});
    expect((await joinGroupViaInviteAction('ABC123')).success).toBe(false);
    expect(testSupabase.rpc).not.toHaveBeenCalled();
  });

  it("does not accept malformed create or join RPC payloads", async () => {
    testSupabase.rpc.mockResolvedValueOnce({ data: { groupId: "circle-1", inviteCode: "bad" }, error: null });
    testSupabase.rpc.mockResolvedValueOnce({ data: { groupId: 23 }, error: null });
    expect((await createGroupAction({ name: "Coffee" })).success).toBe(false);
    expect((await joinGroupViaInviteAction("ABC123")).success).toBe(false);
  });

  it("returns create errors and rejects malformed invite previews", async () => {
    testSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "Invalid Circle details" } });
    testSupabase.rpc.mockResolvedValueOnce({ data: { name: "Coffee", memberCount: "2", id: "secret" }, error: null });
    expect(await createGroupAction({ name: "Coffee" })).toEqual({ success: false, error: "Invalid Circle details" });
    expect(await getGroupByInviteCodeAction("ABC123")).toBeNull();
    expect(testSupabase.from).not.toHaveBeenCalled();
  });

  it("confirms leave only when the RPC reports a removed membership", async () => {
    testSupabase.rpc.mockResolvedValueOnce({ data: { left: true }, error: null });
    testSupabase.rpc.mockResolvedValueOnce({ data: { left: false }, error: null });
    expect(await leaveGroupAction("circle-1")).toEqual({ success: true });
    expect((await leaveGroupAction("circle-1")).success).toBe(false);
  });

  it("preserves the owner-leave RPC error", async () => {
    testSupabase.rpc.mockResolvedValue({ data: null, error: { message: "Circle owner must delete the Circle" } });
    expect(await leaveGroupAction("circle-1")).toEqual({ success: false, error: "Circle owner must delete the Circle" });
    expect(testSupabase.rpc).toHaveBeenCalledWith("leave_circle", { p_group_id: "circle-1" });
    expect(testSupabase.from).not.toHaveBeenCalled();
  });

  it("requires confirmed deletion from delete_circle", async () => {
    testSupabase.rpc.mockResolvedValue({ data: { deleted: false }, error: null });
    expect((await deleteGroupAction("circle-1")).success).toBe(false);
    expect(testSupabase.rpc).toHaveBeenCalledWith("delete_circle", { p_group_id: "circle-1" });
    expect(testSupabase.from).not.toHaveBeenCalled();
  });

  it("propagates delete permission errors and succeeds only on deleted true", async () => {
    testSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "Circle owner required" } });
    testSupabase.rpc.mockResolvedValueOnce({ data: { deleted: true }, error: null });
    expect(await deleteGroupAction("circle-1")).toEqual({ success: false, error: "Circle owner required" });
    expect(await deleteGroupAction("circle-1")).toEqual({ success: true });
    expect(testSupabase.from).not.toHaveBeenCalled();
  });
});
