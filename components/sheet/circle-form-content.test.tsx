// @vitest-environment jsdom
import {act} from "react";
import {createRoot} from "react-dom/client";
import {expect,it,vi} from "vitest";
import {CircleFormContent} from "./circle-form-content";
const m=vi.hoisted(()=>({create:vi.fn().mockResolvedValue({success:true,groupId:"new-circle"}),refresh:vi.fn().mockRejectedValue(new Error("offline"))}));
vi.mock("@/lib/actions/group-actions",()=>({createGroupAction:m.create,joinGroupViaInviteAction:vi.fn()}));
vi.mock("@/lib/context/circle-context",()=>({useCircle:()=>({refreshMemberships:m.refresh,setActiveCircleId:vi.fn()})}));
vi.mock("@/lib/hooks/use-online-status",()=>({isOnline:()=>true,useOnlineStatus:()=>true}));
it("retries only membership refresh after a committed create",async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const el=document.createElement("div");const root=createRoot(el);
 await act(async()=>root.render(<CircleFormContent view="circle-create" accountId="account" presentation="sheet" onOpen={()=>{}} onBack={()=>{}}/>));
 await act(async()=>el.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
 expect(el.textContent).toContain("Circle saved");expect(m.create).toHaveBeenCalledTimes(1);
 await act(async()=>el.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
 expect(m.create).toHaveBeenCalledTimes(1);expect(m.refresh).toHaveBeenCalledTimes(2);
 act(()=>root.unmount());
});
