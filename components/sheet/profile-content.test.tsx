// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { expect, it, vi } from 'vitest';
import { ProfileContent } from './profile-content';
const m = vi.hoisted(() => ({ read: vi.fn(), selectedCircle: 'circleA' }));
vi.mock('@/lib/supabase/config', () => ({ hasSupabaseConfig: () => true }));
vi.mock('@/lib/actions/sheet-read-actions', () => ({ readSheetProfileAction: m.read }));
vi.mock('@/lib/context/circle-context', () => ({ useCircle: () => ({ accountId: 'A', activeCircle: { id: m.selectedCircle }, membershipsResolved: true, userCircles: [{ id: 'circleA' }] }) }));
vi.mock('@/components/profile/profile-edit-form', () => ({ ProfileEditForm: () => <div>Edit profile</div> }));
it('shows a scoped member without a global friend request or private collection counts', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    m.read.mockResolvedValue({ ok: true, data: { id: 'member', display_name: 'Circle Member', username: 'member', created_at: '2026-01-01' } });
    const node = document.createElement('div');
    const root = createRoot(node);
    await act(async () => root.render(<ProfileContent accountId="A" userId="member" circleId="circleA" presentation="sheet" onOpen={() => { }} onBack={() => { }}/>));
    expect(node.textContent).toContain('Circle Member');
    expect(node.textContent).not.toContain('Friend Request');
    expect(node.textContent).not.toContain('Favorites');
    act(() => root.unmount());
});

it('hides a warm member and stops reads when its Circle is no longer selected', async () => {
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});m.selectedCircle='circleA';m.read.mockClear();
 m.read.mockResolvedValue({ok:true,data:{id:'member',display_name:'Warm Member',username:'member',created_at:'2026-01-01'}});
 const node=document.createElement('div');const root=createRoot(node);const cache=new Map();
 const render=()=>root.render(<SWRConfig value={{provider:()=>cache}}><ProfileContent accountId="A" userId="member" circleId="circleA" presentation="sheet" onOpen={()=>{}} onBack={()=>{}}/></SWRConfig>);
 await act(async()=>render());expect(node.textContent).toContain('Warm Member');
 const reads=m.read.mock.calls.length;m.selectedCircle='circleB';await act(async()=>render());
 expect(node.textContent).not.toContain('Warm Member');expect(node.textContent).toContain('unavailable');expect(m.read).toHaveBeenCalledTimes(reads);
 act(()=>root.unmount());m.selectedCircle='circleA';
});

it('renders the own profile without a Friend Connection or Send Friend Request action',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});m.selectedCircle='circleA';m.read.mockResolvedValue({ok:true,data:{id:'A',display_name:'My Profile',username:'self',created_at:'2026-01-01'}});
 const node=document.createElement('div');const root=createRoot(node);
 await act(async()=>root.render(<SWRConfig value={{provider:()=>new Map()}}><ProfileContent accountId="A" presentation="sheet" onOpen={()=>{}} onBack={()=>{}}/></SWRConfig>));
 expect(node.textContent).toContain('My Profile');expect(node.textContent).toContain('Edit profile');expect(node.textContent).not.toContain('Friend Connection');expect(node.textContent).not.toContain('Send Friend Request');act(()=>root.unmount());
});
