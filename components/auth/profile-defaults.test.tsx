// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({push:vi.fn(),save:vi.fn(),setup:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:mocks.push,refresh:vi.fn()})}));
vi.mock('@/lib/actions/username-actions',()=>({checkUsernameSetAction:mocks.setup,setUsernameAction:mocks.save}));
vi.mock('@/lib/actions/group-actions',()=>({createGroupAction:vi.fn(),joinGroupViaInviteAction:vi.fn()}));
vi.mock('@/lib/actions/auth-actions',()=>({signupAction:vi.fn()}));
vi.mock('./oauth-button',()=>({OAuthButton:()=>null}));
vi.mock('@/components/social/circle-invite-modal',()=>({CircleInviteModal:()=>null}));
import { SignUpForm } from './signup-form';
import OnboardingPage from '@/app/(onboarding)/onboarding/page';
let node:HTMLDivElement;let root:Root;
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 Object.defineProperty(navigator,'onLine',{configurable:true,value:true});
 history.replaceState(null,'','/');vi.clearAllMocks();
 mocks.setup.mockResolvedValue({hasUsername:false,displayName:'mika',username:''});
 mocks.save.mockResolvedValue({success:true});
 node=document.createElement('div');document.body.append(node);root=createRoot(node);
});
afterEach(()=>{act(()=>root.unmount());node.remove();history.replaceState(null,'','/');});
async function input(selector:string,value:string){await act(async()=>{
 const e=node.querySelector<HTMLInputElement>(selector)!;
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(e,value);
 e.dispatchEvent(new Event('input',{bubbles:true}));
});}
it('suggests an email display name while leaving username blank and preserving name edits',async()=>{
 await act(async()=>root.render(<SignUpForm/>));
 await input('#email','mika@example.com');
 expect(node.querySelector<HTMLInputElement>('#displayName')!.value).toBe('mika');
 expect(node.querySelector<HTMLInputElement>('#username')!.value).toBe('');
 await input('#displayName','Mika S.');await input('#email','other@example.com');
 expect(node.querySelector<HTMLInputElement>('#displayName')!.value).toBe('Mika S.');
});
it('returns a fresh user to the original invitation only after profile save succeeds',async()=>{
 history.replaceState(null,'','/onboarding?invite=abc123');
 await act(async()=>root.render(<OnboardingPage/>));
 expect(node.querySelector<HTMLInputElement>('#displayName')!.value).toBe('mika');
 expect(node.querySelector<HTMLInputElement>('#username')!.value).toBe('');
 expect(mocks.push).not.toHaveBeenCalled();
 await input('#username','mika_coffee');
 mocks.save.mockResolvedValueOnce({success:false,error:'Username taken'});
 await act(async()=>node.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(mocks.push).not.toHaveBeenCalled();expect(node.textContent).toContain('Username taken');
 await act(async()=>node.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(mocks.save).toHaveBeenCalledWith({displayName:'mika',username:'mika_coffee'});
 expect(mocks.push).toHaveBeenCalledWith('/invite/ABC123');
});
it('does not repeat profile setup for an established account returning to an invite',async()=>{
 mocks.setup.mockResolvedValue({hasUsername:true,displayName:'Mika S.',username:'coffee_mika'});
 history.replaceState(null,'','/onboarding?invite=ABC123');
 await act(async()=>root.render(<OnboardingPage/>));
 expect(mocks.push).toHaveBeenCalledWith('/invite/ABC123');expect(mocks.save).not.toHaveBeenCalled();
});
it('does not expose editable replacement fields after a profile lookup failure',async()=>{
 mocks.setup.mockResolvedValueOnce({hasUsername:false,error:'Could not load your profile.'});
 history.replaceState(null,'','/onboarding?invite=ABC123');
 await act(async()=>root.render(<OnboardingPage/>));
 expect(node.querySelector('[role="alert"]')?.textContent).toContain('Could not load');
 expect(node.querySelector('#username')).toBeNull();expect(mocks.save).not.toHaveBeenCalled();
 mocks.setup.mockResolvedValue({hasUsername:true,displayName:'Mika',username:'coffee_mika'});
 await act(async()=>[...node.querySelectorAll('button')].find(b=>b.textContent==='Try again')!.click());
 expect(mocks.push).toHaveBeenCalledWith('/invite/ABC123');
});
