// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({account:"A",circle:"one",members:["one","two"],resolved:true,route:{kind:"memory",root:"nearby",entityId:"memory",circleId:"one"},mounts:0,stops:0,sheets:{one:{scrollTop:90,snap:'half'},two:{scrollTop:20,snap:'peek'}} as Record<string,unknown>}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock("@/lib/context/navigation-state",()=>({useNavigationState:()=>({circleSheets:state.sheets,update:({circleSheets}:{circleSheets:Record<string,unknown>})=>{state.sheets=circleSheets;},getSnapshot:()=>({circleSheets:state.sheets})})}));
vi.mock("@/components/circle/circle-overview",()=>({CircleOverview:()=> <p>Circle overview</p>}));
vi.mock("@/lib/context/circle-context",()=>({useCircle:()=>({accountId:state.account,activeCircle:{id:state.circle,name:state.circle},circleMembers:[],membershipsResolved:state.resolved,userCircles:state.members.map(id=>({id}))})}));
vi.mock("@/lib/context/sheet-navigation",()=>({useSheetNavigation:()=>({activeRoot:"nearby",activeRoute:state.route,open:vi.fn(),back:vi.fn()})}));
vi.mock("./map-view",()=>({MapView:()=>{useEffect(()=>{state.mounts++;return()=>{state.stops++;};},[]);return <p>Map</p>;}}));
vi.mock("@/components/profile/collections-content",()=>({CollectionsContent:()=> <p>Saved</p>}));
vi.mock("@/components/sheet/profile-content",()=>({ProfileContent:()=> <p>Profile</p>}));
vi.mock("@/components/sheet/sheet-route-content",()=>({SheetRouteContent:()=> <p>Private memory</p>}));
import { MapShell } from "./map-shell";
it("removes scoped nested content immediately on Circle switch, unresolved access and revocation",()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const element=document.createElement("div");document.body.append(element);const root=createRoot(element);
 const render=()=>act(()=>root.render(<MapShell accountId={state.account} userAvatarUrl={null}/>));
 render();expect(element.textContent).toContain("Private memory");
 state.circle="two";render();expect(element.textContent).not.toContain("Private memory");expect(state.mounts).toBe(1);
 state.circle="one";state.resolved=false;render();expect(element.textContent).not.toContain("Private memory");
 state.resolved=true;state.members=[];render();expect(element.textContent).not.toContain("Private memory");expect(state.sheets).toEqual({});
 state.account="B";render();expect(state.stops).toBe(1);expect(state.mounts).toBe(2);
 act(()=>root.unmount());expect(state.stops).toBe(2);element.remove();
});
