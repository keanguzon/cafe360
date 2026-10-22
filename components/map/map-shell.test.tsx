// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({mounts:0,route:{kind:"nearby",root:"nearby"} as Record<string,string>,open:vi.fn(),update:vi.fn(),sheets:{} as Record<string,unknown>}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock("@/lib/actions/cafe-details-actions",()=>({getCafeByReferenceAction:vi.fn().mockResolvedValue({id:"cafe",coordinates:[1,2]})}));
vi.mock("@/lib/context/sheet-navigation",()=>({useSheetNavigation:()=>({activeRoot:"nearby",activeRoute:state.route,open:state.open,back:vi.fn()})}));
vi.mock("@/lib/context/circle-context",()=>({useCircle:()=>({accountId:"account",activeCircle:{id:"circle",name:"Our Circle",member_count:3},circleMembers:[],membershipsResolved:true,userCircles:[{id:"circle"}]})}));
vi.mock("@/lib/context/navigation-state",()=>({useNavigationState:()=>({circleSheets:state.sheets,update:state.update,getSnapshot:()=>({circleSheets:state.sheets})})}));
vi.mock("@/components/circle/circle-overview",()=>({CircleOverview:({onOpenCafe}:{onOpenCafe:(id:string)=>void})=><button data-testid="circle-member-preview" onClick={()=>onOpenCafe("cafe")}>You and members</button>}));
vi.mock("./map-view",()=>({MapView:()=>{useEffect(()=>{state.mounts++;},[]);return <p>Map</p>;}}));
vi.mock("@/components/sheet/sheet-route-content",()=>({SheetRouteContent:()=> <p>Nested content</p>}));
import { MapShell } from "./map-shell";
import { getCafeByReferenceAction } from "@/lib/actions/cafe-details-actions";
import { SWRConfig, unstable_serialize } from "swr";
it("renders Circle members first and retains one map across cafe nesting",async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const node=document.createElement("div");document.body.append(node);const root=createRoot(node);
 const render=()=>act(()=>root.render(<MapShell accountId="account" userAvatarUrl={null}/>));
 render();expect(node.textContent).toContain("You and members");expect(node.querySelector('[aria-label="Map views"]')).toBeNull();
 const trigger=node.querySelector<HTMLButtonElement>('[data-testid="circle-member-preview"]')!;trigger.focus();
 await act(async()=>trigger.click());expect(state.open).toHaveBeenCalledWith({kind:"cafe",root:"nearby",entityId:"cafe",circleId:"circle"});
 state.route={kind:"cafe",root:"nearby",entityId:"cafe",circleId:"circle"};render();expect(node.textContent).toContain("Nested content");expect(state.mounts).toBe(1);
 document.body.focus();state.route={kind:'nearby',root:'nearby'};render();expect(document.activeElement).toBe(trigger);
 act(()=>root.unmount());node.remove();
});
it("restores the Circle overview after the map page unmounts",()=>{
 state.route={kind:'nearby',root:'nearby'};state.sheets={};
 state.update.mockImplementation(({circleSheets}:{circleSheets:Record<string,unknown>})=>{state.sheets=circleSheets;});
 const node=document.createElement('div');let root=createRoot(node);
 const render=()=>act(()=>root.render(<MapShell accountId="account" userAvatarUrl={null}/>));
 render();const scroll=node.querySelector<HTMLElement>('[data-sheet-scroll]')!;
 act(()=>node.querySelector<HTMLButtonElement>('[aria-label="Expand sheet"]')!.click());
 scroll.scrollTop=140;act(()=>scroll.dispatchEvent(new Event('scroll')));
 expect(state.sheets.circle).toEqual({scrollTop:140,snap:'full'});
 act(()=>root.unmount());root=createRoot(node);render();
 expect(node.querySelector<HTMLElement>('[data-sheet-scroll]')!.scrollTop).toBe(140);
 expect(node.querySelector('[data-snap="full"]')).not.toBeNull();act(()=>root.unmount());
});

it("shows recovery for an unresolved preview and ignores its completion after navigation", async () => {
 vi.useFakeTimers(); state.route={kind:"nearby",root:"nearby"}; state.open.mockClear();
 let resolve!: (value: never) => void;
 vi.mocked(getCafeByReferenceAction).mockImplementationOnce(() => new Promise(done => { resolve=done; }));
 const node=document.createElement("div"); const root=createRoot(node);
 const render=()=>act(()=>root.render(<MapShell accountId="account" userAvatarUrl={null}/>));
 render(); await act(async()=>node.querySelector<HTMLButtonElement>('[data-testid="circle-member-preview"]')!.click());
 expect(node.textContent).toContain("Loading café"); act(()=>vi.advanceTimersByTime(10_000));
 expect(node.textContent).toContain("taking too long");
 state.route={kind:"cafe",root:"nearby",entityId:"different",circleId:"circle"}; render();
 expect(node.textContent).not.toContain("taking too long");
 await act(async()=>resolve({id:"cafe",coordinates:[1,2]} as never));
 expect(state.open).not.toHaveBeenCalled();
 act(()=>root.unmount()); vi.useRealTimers();
});

it("opens an already cached café without fetching or showing loading feedback", async () => {
 state.route={kind:"nearby",root:"nearby"}; state.open.mockClear(); vi.mocked(getCafeByReferenceAction).mockClear();
 const cache=new Map(); cache.set(unstable_serialize(["sheet-cafe","account","circle","cafe"]),{data:{id:"cafe",name:"Cached café",address:"",coordinates:[1,2]}});
 const node=document.createElement("div"); const root=createRoot(node);
 await act(async()=>root.render(<SWRConfig value={{provider:()=>cache}}><MapShell accountId="account" userAvatarUrl={null}/></SWRConfig>));
 await act(async()=>node.querySelector<HTMLButtonElement>('[data-testid="circle-member-preview"]')!.click());
 expect(getCafeByReferenceAction).not.toHaveBeenCalled();
 expect(state.open).toHaveBeenCalledWith({kind:"cafe",root:"nearby",entityId:"cafe",circleId:"circle"});
 expect(node.textContent).not.toContain("Loading café");
 act(()=>root.unmount());
});
