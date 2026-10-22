// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CafeContent } from "./cafe-content";
const read=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/actions/cafe-details-actions",()=>({getCafeByReferenceAction:read}));
vi.mock("@/lib/context/circle-context",()=>({useCircle:()=>({accountId:"account",activeCircle:{id:"circle-a"},membershipsResolved:true})}));
vi.mock("@/lib/hooks/use-sheet-resource",()=>({useSheetResource:(key:unknown)=>{if(key)read();return {data:undefined,error:null,initialLoading:false,refresh:vi.fn()};}}));
vi.mock("@/components/cafe/cafe-detail-content",()=>({CafeDetailContent:()=>null}));
vi.mock("@/components/visit/visit-timeline-fetcher",()=>({VisitTimelineFetcher:()=>null}));
vi.mock("@/components/visit/log-visit-form",()=>({LogVisitForm:()=>null}));
let clean=()=>{};afterEach(()=>{clean();vi.clearAllMocks();});
it("rejects another Circle route before starting a café read or rendering its visit form",()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const el=document.createElement("div");const root=createRoot(el);clean=()=>act(()=>root.unmount());act(()=>root.render(<CafeContent accountId="account" circleId="circle-b" cafeId="cafe" view="visit" presentation="sheet" onOpen={()=>{}} onBack={()=>{}}/>));expect(read).not.toHaveBeenCalled();expect(el.textContent).toContain("unavailable in the selected Circle");expect(el.querySelector("form")).toBeNull();});
