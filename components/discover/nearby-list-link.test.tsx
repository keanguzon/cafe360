// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { NearbyListLink } from "./nearby-list-link";
import { NavigationStateProvider, useNavigationState } from "@/lib/context/navigation-state";

it("hands off only a completed request and clears it when the account changes", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const node = document.createElement('div'); const root = createRoot(node);
  let current: ReturnType<typeof useNavigationState>;
  function Probe() { current = useNavigationState(); return null; }
  const search = { query:'coffee', coordinates:[121,14] as [number,number], radiusMeters:1500, limit:50 };
  const render = (accountId:string, ready:boolean) => act(()=>root.render(<NavigationStateProvider accountId={accountId}><Probe/><NearbyListLink search={ready ? search : null} filterTopRated/></NavigationStateProvider>));
  render('A',false);expect(node.querySelector('button')?.disabled).toBe(true);expect(node.querySelector('a')).toBeNull();
  render('A',true);const link=node.querySelector('a')!;expect(link.getAttribute('href')).toBe('/discover?from=map');
  link.addEventListener('click',event=>event.preventDefault());act(()=>link.click());
  expect(current!.nearbyList).toEqual({...search,filterTopRated:true});
  render('B',true);expect(current!.nearbyList).toBeNull();act(()=>root.unmount());
});
