// @vitest-environment jsdom
import Link from 'next/link';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it, vi } from 'vitest';
import { CircleContent } from './circle-content';
const selection=vi.hoisted(()=>({set:vi.fn(), snapshot:vi.fn(), context:{} as Record<string,unknown>}));
vi.mock('@/lib/context/circle-context', () => ({ useCircle: () => selection.context }));
vi.mock('@/lib/hooks/use-circle-data', () => ({ useCircleData: (...args:unknown[]) => { selection.snapshot(...args); return { hasData: false, initialLoading: false, accessRevoked: false, members: [], savedCafes: [], visits:[] }; } }));
vi.mock('@/components/social/activity-feed',()=>({ActivityFeed:({groupId}:{groupId:string})=><p>Private activity {groupId}</p>}));
vi.mock('@/components/visit/visit-timeline',()=>({VisitTimeline:()=><p>Private memories</p>}));
vi.mock('@/app/(main)/circles/friends-hub-client', () => ({ FriendsHubClient: () => <Link href="/circles/groups/new">Create Circle</Link> }));
beforeEach(()=>{
 vi.clearAllMocks();
 selection.context={accountId:'A',setActiveCircleId:selection.set,activeCircle:{id:'circle-a'},userCircles:[{id:'circle-a',name:'Morning coffee'},{id:'circle-b',name:'Weekend coffee'}],membershipsResolved:true};
});
it('keeps the real Circle link while routing a primary sheet click through its callback', () => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); const node = document.createElement('div'); const root = createRoot(node); const open = vi.fn(); act(() => root.render(<CircleContent accountId="A" presentation="sheet" onOpen={open} onBack={() => { }}/>)); const link = node.querySelector('a')!; expect(link.getAttribute('href')).toBe('/circles/groups/new'); act(() => link.click()); expect(open).toHaveBeenCalledWith({ kind: 'circle-create', root: 'nearby' }); act(() => root.unmount()); });

it('denies another member Circle until it is explicitly selected', () => {
 Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
 const node=document.createElement('div');const root=createRoot(node);
 act(()=>root.render(<CircleContent accountId="A" circleId="circle-b" view="memories" presentation="sheet" onOpen={()=>{}} onBack={()=>{}}/>));
 expect(node.textContent).toContain('This Circle is unavailable.');
 act(()=>root.unmount());
});

it('selects the explicitly managed Circle before opening its route',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const node=document.createElement('div');const root=createRoot(node);const order:string[]=[];
 selection.set.mockImplementation((id:string)=>order.push(`select:${id}`));
 const open=vi.fn((route:{entityId?:string})=>order.push(`open:${route.entityId}`));
 act(()=>root.render(<CircleContent accountId="A" presentation="sheet" onOpen={open} onBack={()=>{}}/>));
 act(()=>Array.from(node.querySelectorAll('button')).filter(button=>button.textContent==='Manage')[1].click());
 expect(order).toEqual(['select:circle-b','open:circle-b']);act(()=>root.unmount());
});
it('offers the canonical Memories destination from activity',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const node=document.createElement('div');const root=createRoot(node);const open=vi.fn();
 act(()=>root.render(<CircleContent accountId="A" circleId="circle-a" view="activity" presentation="sheet" onOpen={open} onBack={()=>{}}/>));
 const link=Array.from(node.querySelectorAll('a')).find(anchor=>anchor.textContent==='Memories');expect(link?.getAttribute('href')).toBe('/circles/circle-a/timeline?view=memories');
 act(()=>link?.click());expect(open).toHaveBeenCalledWith({kind:'memories',root:'nearby',entityId:'circle-a'});act(()=>root.unmount());
});

it('shows_requested_timeline_identity_and_requires_explicit_selection_on_pages',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const node=document.createElement('div');const root=createRoot(node);
 const render=()=>act(()=>root.render(<CircleContent accountId="A" circleId="circle-b" view="activity" presentation="page" onOpen={()=>{}} onBack={()=>{}}/>));
 render();expect(node.textContent).toContain('Weekend coffee');expect(node.textContent).toContain('Select this Circle');expect(node.textContent).not.toContain('Private activity');
 expect(selection.set).not.toHaveBeenCalled();expect(selection.snapshot).toHaveBeenLastCalledWith('A',null);
 act(()=>node.querySelector('button')!.click());expect(selection.set).toHaveBeenCalledWith('circle-b');
 selection.context.activeCircle={id:'circle-b'};render();expect(node.querySelector('h1')?.textContent).toBe('Activity');expect(node.textContent).toContain('Private activity circle-b');
 expect(node.querySelector('a[href="/map"]')?.textContent).toContain('Return to map');
 selection.context.userCircles=[];render();expect(node.textContent).not.toContain('Weekend coffee');expect(node.textContent).not.toContain('Private activity');
 act(()=>root.unmount());
});
it('hides_timeline_on_unresolved_membership_or_captured_account_mismatch',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const node=document.createElement('div');const root=createRoot(node);
 const render=()=>act(()=>root.render(<CircleContent accountId="A" circleId="circle-a" view="memories" presentation="page" onOpen={()=>{}} onBack={()=>{}}/>));
 selection.context.membershipsResolved=false;render();expect(node.textContent).not.toContain('Morning coffee');expect(node.textContent).not.toContain('Private memories');
 selection.context.membershipsResolved=true;selection.context.accountId='B';render();expect(node.textContent).not.toContain('Morning coffee');expect(node.textContent).not.toContain('Private memories');
 expect(selection.snapshot).toHaveBeenLastCalledWith('A',null);act(()=>root.unmount());
});
