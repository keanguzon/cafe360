// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const circle = vi.hoisted(() => ({ activeCircle: { name: 'QA' } as { name: string } | null, membershipsResolved: true }));
vi.mock('@/lib/context/circle-context',()=>({useCircle:()=>circle}));
vi.mock('@/components/social/circle-switcher-dialog',()=>({CircleSwitcherDialog:()=>null}));
import { CircleTopBar } from './circle-top-bar';
it('replaces Activity Feed with the supplied nearby action',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const node=document.createElement('div');const root=createRoot(node);
 act(()=>root.render(<CircleTopBar rightAction={<a href="/discover?from=map" aria-label="List nearby">Nearby</a>}/>));
 expect(node.querySelector('[aria-label="Activity Feed"]')).toBeNull();expect(node.querySelector('[aria-label="List nearby"]')).not.toBeNull();act(()=>root.unmount());
});
it('shows loading instead of an empty selection until memberships resolve',()=>{
 circle.activeCircle=null;circle.membershipsResolved=false;
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const node=document.createElement('div');const root=createRoot(node);
 act(()=>root.render(<CircleTopBar/>));
 expect(node.textContent).toContain('Loading Circle');expect(node.textContent).not.toContain('Select Circle');
 act(()=>{circle.membershipsResolved=true;root.render(<CircleTopBar/>);});
 expect(node.textContent).toContain('Select Circle');act(()=>root.unmount());circle.activeCircle={name:'QA'};
});
