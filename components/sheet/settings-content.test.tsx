// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {SettingsContent} from './settings-content';
const m=vi.hoisted(()=>({getUser:vi.fn()}));
vi.mock('@/lib/supabase/config',()=>({hasSupabaseConfig:()=>true}));
vi.mock('@/lib/supabase/client',()=>({createClient:()=>({auth:{getUser:m.getUser}})}));
vi.mock('next-themes',()=>({useTheme:()=>({theme:'light',setTheme:vi.fn()})}));
vi.mock('@/components/auth/sign-out-modal',()=>({SignOutModal:()=>null}));
let root:Root,container:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});m.getUser.mockReset();container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();});
function render(id:string){act(()=>root.render(<SettingsContent accountId={id} presentation="sheet" onOpen={vi.fn()} onBack={vi.fn()}/>));}
it('does not show account A email after switching to B or resolving A late',async()=>{
 let finishA!:(value:unknown)=>void;
 m.getUser.mockReturnValueOnce(new Promise(resolve=>{finishA=resolve;})).mockResolvedValueOnce({data:{user:{id:'B',email:'b@example.test'}}});
 render('A');render('B');await act(async()=>{});
 await act(async()=>finishA({data:{user:{id:'A',email:'a@example.test'}}}));
 expect(container.textContent).toContain('b@example.test');expect(container.textContent).not.toContain('a@example.test');
});
