// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { expect, it, vi } from "vitest";
import { AuthenticatedBoundary } from "./authenticated-boundary";
const m=vi.hoisted(()=>({listener:null as null|((event:string,session:{user:{id:string}}|null)=>void),unsubscribe:vi.fn(),refresh:vi.fn(),replace:vi.fn(),stops:0}));
vi.mock("@/lib/supabase/client",()=>({createClient:()=>({auth:{onAuthStateChange:(listener:typeof m.listener)=>{m.listener=listener;return {data:{subscription:{unsubscribe:m.unsubscribe}}};}}})}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:m.refresh,replace:m.replace})}));
function Private(){useEffect(()=>()=>{m.stops++;},[]);return <p>Private account A</p>;}
it("immediately unmounts and clears private cache on an auth account switch, retaining same-account refreshes",()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const node=document.createElement("div");const root=createRoot(node);const cache=new Map();cache.set("private",{data:"A"});
 act(()=>root.render(<SWRConfig value={{provider:()=>cache}}><AuthenticatedBoundary accountId="A" enabled><Private/></AuthenticatedBoundary></SWRConfig>));
 act(()=>m.listener!("TOKEN_REFRESHED",{user:{id:"A"}}));expect(node.textContent).toContain("Private account A");expect(cache.size).toBe(1);
 act(()=>m.listener!("SIGNED_IN",{user:{id:"B"}}));expect(node.textContent).not.toContain("Private account A");expect(cache.size).toBe(0);expect(m.stops).toBe(1);expect(m.refresh).toHaveBeenCalledOnce();
 act(()=>root.unmount());expect(m.unsubscribe).toHaveBeenCalledOnce();
});
it("removes private content and redirects to login on signed out event",()=>{
 const node=document.createElement("div");const root=createRoot(node);
 act(()=>root.render(<AuthenticatedBoundary accountId="A" enabled><p>Private</p></AuthenticatedBoundary>));
 act(()=>m.listener!("SIGNED_OUT",null));expect(node.textContent).not.toContain("Private");expect(m.replace).toHaveBeenCalledWith("/login");
 act(()=>root.unmount());
});
