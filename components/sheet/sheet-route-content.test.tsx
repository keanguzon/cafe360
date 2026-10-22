// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { SheetRouteContent } from "./sheet-route-content";
const open=vi.fn();
vi.mock("@/lib/context/sheet-navigation",()=>({useSheetNavigation:()=>({open,back:vi.fn(),registerDirty:()=>()=>{}})}));
vi.mock("@/lib/context/circle-context",()=>({useCircle:()=>({accountId:"account",activeCircle:{id:"circle-a"},membershipsResolved:true,userCircles:[]})}));
vi.mock("./circle-content",()=>({CircleContent:({circleId}:{circleId?:string})=><div data-circle={circleId}>Circle content</div>}));
vi.mock("./cafe-content",()=>({CafeContent:()=>null}));
vi.mock("./memory-content",()=>({MemoryContent:()=>null}));
vi.mock("./profile-content",()=>({ProfileContent:()=>null}));
vi.mock("./settings-content",()=>({SettingsContent:()=>null}));
vi.mock("./circle-form-content",()=>({CircleFormContent:()=>null}));
vi.mock("@/components/cafe/collection-view",()=>({CollectionView:()=>null}));
let clean=()=>{};afterEach(()=>clean());
it("uses the canonical Circle path context for activity and memories",()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const el=document.createElement("div");const root=createRoot(el);clean=()=>act(()=>root.unmount());act(()=>root.render(<SheetRouteContent route={{kind:"activity",root:"nearby",entityId:"circle-a"}} active/>));expect(el.querySelector("[data-circle]")?.getAttribute("data-circle")).toBe("circle-a");});
