// @vitest-environment jsdom
import type { GroupWithMembers, GroupSavedCafe } from "@/lib/types/social";
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, expect, it, vi } from "vitest";
import { CircleProvider, CircleAccessBoundary, useCircle } from "@/lib/context/circle-context";
import { FriendsHubClient } from "./friends-hub-client";
import { PrivatePhoto } from "@/components/visit/private-photo";
import { GroupDetailClient } from "./[groupId]/group-detail-client";
import { CircleFullList } from "@/components/circle/circle-full-list";
const mocks = vi.hoisted(() => ({ memberships: vi.fn(), leave: vi.fn(), push: vi.fn(), photo: vi.fn(), snapshot: vi.fn().mockResolvedValue({ok:true,data:{members:[],visits:[],savedCafes:[],cafeSummaries:[]}}) }));
vi.mock("@/lib/actions/circle-memberships-actions", () => ({getAccountCirclesAction: mocks.memberships}));
vi.mock("@/lib/actions/circle-data-actions", () => ({getCircleDataAction: mocks.snapshot}));
vi.mock("@/lib/actions/group-actions", () => ({leaveGroupAction:mocks.leave}));
vi.mock("next/navigation", () => ({useRouter:()=>({push:mocks.push})}));
vi.mock("@/components/social/activity-feed",()=>({ActivityFeed:()=>null}));
vi.mock("@/components/social/circle-switcher-dialog",()=>({CircleSwitcherDialog:()=>null}));
vi.mock("@/components/social/invite-link",()=>({InviteLink:()=> <div>SECRET INVITE</div>}));
vi.mock("@/components/social/group-saved-cafes",()=>({GroupSavedCafesList:({saves}:{saves:GroupSavedCafe[]})=> <div>SECRET SAVES {saves.map(save=>save.cafe_name).join(", ")}</div>}));
vi.mock("@/lib/actions/photo-actions",()=>({signVisitPhotoAction:mocks.photo}));
const summary = (id:string) => ({id,name:`Circle ${id}`,description:null,avatar_url:null,invite_code:id,member_count:1,role:"member" as const,preview_avatars:[]});
const group = {...summary("A"),created_by:null,created_at:"",updated_at:"",members:[]};
let latest: ReturnType<typeof useCircle>;
function Probe(){ const context = useCircle(); useEffect(() => { latest = context; }, [context]); return null; }
let dispose = () => {};
afterEach(()=>{dispose();vi.clearAllMocks();localStorage.clear();});
it("full_list_waits_for_selected_circle_snapshot_without_previous_members_flash",async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 mocks.memberships.mockResolvedValue({ok:true,data:[summary("A"),summary("B")]});
 let resolveB!:(value:unknown)=>void;
 mocks.snapshot.mockImplementation((id:string)=>id==="A"?Promise.resolve({ok:true,data:{members:[{userId:"a-member",displayName:"Private A member",role:"member",avatarUrl:null}],visits:[],savedCafes:[],cafeSummaries:[]}}):new Promise(resolve=>{resolveB=resolve;}));
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 dispose=()=>{act(()=>root.unmount());host.remove();mocks.snapshot.mockReset().mockResolvedValue({ok:true,data:{members:[],visits:[],savedCafes:[],cafeSummaries:[]}});};
 await act(async()=>root.render(<SWRConfig value={{provider:()=>new Map(),shouldRetryOnError:false,revalidateOnFocus:false}}><CircleProvider accountId="account"><Probe/><CircleFullList accountId="account" circleId="B" view="members"/></CircleProvider></SWRConfig>));
 expect(host.textContent).toContain("Circle B");expect(host.textContent).toContain("Select this Circle");expect(host.textContent).not.toContain("Private A member");
 expect(mocks.snapshot).not.toHaveBeenCalledWith("B");
 await act(async()=>host.querySelector("button")!.click());
 expect(host.textContent).not.toContain("Private A member");expect(host.querySelector("li")).toBeNull();
 await act(async()=>resolveB({ok:true,data:{members:[{userId:"b-member",displayName:"Private B member",role:"member",avatarUrl:null}],visits:[],savedCafes:[],cafeSummaries:[]}}));
 expect(host.textContent).toContain("Private B member");expect(host.querySelector('a[href="/profile/b-member?circle=B"]')).not.toBeNull();
 await act(async()=>latest.evictMembership("B"));
 expect(host.textContent).not.toContain("Private B member");expect(host.textContent).not.toContain("Circle B");
});
async function mount(detail=false, initialFailure=false, detailGroup: GroupWithMembers=group, circles=[summary("A")], saves: GroupSavedCafe[]=[]){
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 mocks.memberships.mockResolvedValue(initialFailure?{ok:false,status:503,error:"Unavailable"}:{ok:true,data:circles});
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);const cache=new Map();
 dispose=()=>{act(()=>root.unmount());host.remove();};
 await act(async()=>{root.render(<SWRConfig value={{provider:()=>cache,shouldRetryOnError:false,revalidateOnFocus:false}}><CircleProvider accountId="account"><Probe/><CircleAccessBoundary groupId="A"><span>PRIVATE TIMELINE</span></CircleAccessBoundary><PrivatePhoto path="photo.jpg" groupId="A"/>{detail?<GroupDetailClient group={detailGroup} saves={saves}/>:<FriendsHubClient initialGroups={[group]}/>}</CircleProvider></SWRConfig>);});
 return host;
}
it.each(["empty","denied"])("hides stale hub names after %s memberships",async(mode)=>{
 const host=await mount();expect(host.textContent).toContain("Circle A");
 mocks.memberships.mockResolvedValueOnce(mode==="empty"?{ok:true,data:[]}:{ok:false,status:403,error:"Denied"});
 await act(async()=>{await latest.refreshMemberships().catch(()=>{});});expect(host.querySelector('a[href="/circles/A"]')).toBeNull();
});
it("renders a newly joined Circle absent from initial server props",async()=>{
 const host=await mount();mocks.memberships.mockResolvedValueOnce({ok:true,data:[summary("A"),summary("B")]});
 await act(async()=>{await latest.refreshMemberships();});expect(host.textContent).toContain("Circle B");
});
it("hides detail invites and saves after access denial",async()=>{
 const host=await mount(true);expect(host.textContent).toContain("SECRET INVITE");
 mocks.memberships.mockResolvedValueOnce({ok:false,status:403,error:"Denied"});await act(async()=>{await latest.refreshMemberships().catch(()=>{});});
 expect(host.textContent).not.toContain("SECRET INVITE");expect(host.textContent).not.toContain("SECRET SAVES");expect(host.textContent).not.toContain("PRIVATE TIMELINE");expect(host.querySelector('a[href="/circles/A"]')).toBeNull();
});
it("evicts a successful departure even when membership refresh fails",async()=>{
 const host=await mount(true);vi.stubGlobal("confirm",()=>true);mocks.leave.mockResolvedValueOnce({success:true});mocks.memberships.mockResolvedValueOnce({ok:false,status:503,error:"Unavailable"});
 await act(async()=>{(host.querySelector('[aria-label="Leave group"]') as HTMLButtonElement).click();});
 expect(latest.userCircles).toEqual([]);expect(host.textContent).not.toContain("SECRET INVITE");expect(mocks.push).toHaveBeenCalledWith("/circles");vi.unstubAllGlobals();
});
it("a late signed photo cannot reappear after membership eviction",async()=>{
 let resolve!: (value:unknown)=>void;mocks.photo.mockReturnValueOnce(new Promise(done=>{resolve=done;}));
 const host=await mount();mocks.memberships.mockResolvedValueOnce({ok:true,data:[]});await act(async()=>{await latest.refreshMemberships();});
 await act(async()=>{resolve({success:true,url:"https://example.test/late.jpg",expiresAt:Date.now()+60000});});
 expect(host.querySelector("img")).toBeNull();
});


it("keeps verified warm detail on a genuine temporary membership failure",async()=>{
 const host=await mount(true);mocks.memberships.mockResolvedValueOnce({ok:false,status:503,error:"Unavailable"});
 await act(async()=>{await latest.refreshMemberships().catch(()=>{});});
 expect(host.textContent).toContain("SECRET INVITE");expect(host.textContent).toContain("PRIVATE TIMELINE");
});
it("retains membership when leaving is rejected",async()=>{
 const host=await mount(true);vi.stubGlobal("confirm",()=>true);mocks.leave.mockResolvedValueOnce({success:false,error:"Cannot leave"});
 await act(async()=>{(host.querySelector('[aria-label="Leave group"]') as HTMLButtonElement).click();});
 expect(latest.userCircles.map(circle=>circle.id)).toEqual(["A"]);expect(host.textContent).toContain("SECRET INVITE");vi.unstubAllGlobals();
});
it("retries an initial unavailable membership request from the hub",async()=>{
 const host=await mount(false,true);expect(host.textContent).toContain("Circles unavailable");
 expect(host.textContent).not.toContain("No Circles Yet");mocks.memberships.mockResolvedValueOnce({ok:true,data:[summary("B")]});
 const retry=[...host.querySelectorAll("button")].find(button=>button.textContent?.trim()==="Retry Circles");expect(retry).toBeDefined();
 await act(async()=>{retry!.click();});expect(host.textContent).toContain("Circle B");
});
it("refreshes viewed Circle members and count instead of retaining initial server members",async()=>{
 const staleGroup={...group,member_count:2,members:[{group_id:"A",user_id:"owner",role:"owner" as const,joined_at:"",profile:{id:"owner",display_name:"Owner",username:"owner",avatar_url:null}},{group_id:"A",user_id:"departed",role:"member" as const,joined_at:"",profile:{id:"departed",display_name:"Departed Friend",username:"departed",avatar_url:null}}]};
 mocks.snapshot.mockResolvedValueOnce({ok:true,data:{members:[{userId:"owner",displayName:"Owner",role:"owner",avatarUrl:null},{userId:"departed",displayName:"Departed Friend",role:"member",avatarUrl:null}],visits:[],savedCafes:[],cafeSummaries:[]}});
 const host=await mount(true,false,staleGroup,[{...summary("A"),member_count:2}]);expect(host.textContent).toContain("Departed Friend");expect(host.textContent).toContain("2 members");
 mocks.snapshot.mockResolvedValueOnce({ok:true,data:{members:[{userId:"owner",displayName:"Owner",role:"owner",avatarUrl:null}],visits:[],savedCafes:[],cafeSummaries:[]}});
 await act(async()=>{await latest.refreshCircleData();});expect(host.textContent).not.toContain("Departed Friend");expect(host.textContent).toContain("1 member");
 mocks.snapshot.mockResolvedValueOnce({ok:false,status:503,error:"Unavailable"});await act(async()=>{await latest.refreshCircleData();});expect(host.textContent).toContain("Owner");
 mocks.snapshot.mockResolvedValueOnce({ok:false,status:403,error:"Denied"});await act(async()=>{await latest.refreshCircleData();});expect(host.textContent).not.toContain("SECRET INVITE");expect(host.textContent).not.toContain("Owner");
});
it("loads the viewed Circle snapshot without changing the active Circle",async()=>{
 mocks.snapshot.mockImplementation(async(id:string)=>({ok:true,data:{members:[{userId:id,displayName:`Member of ${id}`,role:"member",avatarUrl:null}],visits:[],savedCafes:[],cafeSummaries:[]}}));
 const other={...group,id:"B",name:"Circle B"};const host=await mount(true,false,other,[summary("A"),summary("B")]);
 expect(latest.activeCircle?.id).toBe("A");expect(host.textContent).toContain("Member of B");
 mocks.snapshot.mockResolvedValue({ok:true,data:{members:[],visits:[],savedCafes:[],cafeSummaries:[]}});
});
it("preserves authorized initial members and saves on an initial snapshot503 but never403",async()=>{
 const initialGroup={...group,members:[{group_id:"A",user_id:"owner",role:"owner" as const,joined_at:"",profile:{id:"owner",display_name:"SSR Owner",username:"owner",avatar_url:null}}]};
 const initialSaves=[{id:"saved",group_id:"A",cafe_id:"cafe",saved_by:"owner",created_at:"",cafe_name:"SSR Cafe"}];
 mocks.snapshot.mockResolvedValueOnce({ok:false,status:503,error:"Unavailable"});
 const host=await mount(true,false,initialGroup,[summary("A")],initialSaves);expect(host.textContent).toContain("SSR Owner");expect(host.textContent).toContain("SSR Cafe");expect(host.textContent).toContain("1 member");
 mocks.snapshot.mockResolvedValueOnce({ok:false,status:403,error:"Denied"});await act(async()=>{await latest.refreshCircleData();});expect(host.textContent).not.toContain("SSR Owner");expect(host.textContent).not.toContain("SSR Cafe");expect(host.textContent).not.toContain("SECRET INVITE");
});

it("provides own and Circle-scoped member profile links in Circle detail",async()=>{
 mocks.snapshot.mockResolvedValueOnce({ok:true,data:{members:[{userId:"account",displayName:"Me",role:"owner",avatarUrl:null},{userId:"member / two",displayName:"Member",role:"member",avatarUrl:null}],visits:[],savedCafes:[],cafeSummaries:[]}});
 const host=await mount(true);
 const links=Array.from(host.querySelectorAll('a')).filter(link=>link.textContent==='Profile');
 expect(links.map(link=>link.getAttribute('href'))).toEqual(['/profile','/profile/member%20%2F%20two?circle=A']);
});
