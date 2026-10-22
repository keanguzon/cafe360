// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const oauth=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/supabase/config',()=>({hasSupabaseConfig:()=>true}));
vi.mock('@/lib/supabase/client',()=>({createClient:()=>({auth:{signInWithOAuth:oauth}})}));
import { OAuthButton } from './oauth-button';
let node:HTMLDivElement;let root:Root;
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});oauth.mockReset();oauth.mockResolvedValue({error:null});
 node=document.createElement('div');document.body.append(node);root=createRoot(node);
});
afterEach(()=>{act(()=>root.unmount());node.remove();vi.useRealTimers();vi.restoreAllMocks();});
it('requests Google account selection and retains the invitation callback',async()=>{
 await act(async()=>root.render(<OAuthButton nextPath="/invite/ABC123"/>));
 await act(async()=>node.querySelector('button')!.click());
 const request=oauth.mock.calls[0][0];
 expect(request.provider).toBe('google');
 expect(request.options.queryParams).toEqual({prompt:'select_account'});
 const callback=new URL(request.options.redirectTo);
 expect(callback.origin).toBe(window.location.origin);expect(callback.pathname).toBe('/callback');
 expect(callback.searchParams.get('next')).toBe('/invite/ABC123');
});
it('keeps the button retryable when starting Google sign-in fails',async()=>{
 oauth.mockResolvedValue({error:{message:'Google unavailable'}});
 await act(async()=>root.render(<OAuthButton/>));
 await act(async()=>node.querySelector('button')!.click());
 expect(node.querySelector('[role="alert"]')?.textContent).toBe('Google unavailable');
 expect(node.querySelector('button')!.disabled).toBe(false);
});
it('shows initiation recovery while preserving the unresolved request and clears it after late completion',async()=>{
 vi.useFakeTimers();
 let settle!:(value:{error:null})=>void;
 oauth.mockReturnValue(new Promise(resolve=>{settle=resolve;}));
 vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 await act(async()=>root.render(<OAuthButton/>));
 await act(async()=>node.querySelector('button')!.click());
 expect(node.querySelector('[role="status"]')?.textContent).toContain('Connecting to Google');
 act(()=>vi.advanceTimersByTime(10_000));
 expect(node.querySelector('[role="alert"]')?.textContent).toContain('not confirmed');
 expect(oauth).toHaveBeenCalledOnce();
 expect(Array.from(node.querySelectorAll('button')).find(button=>button.textContent?.includes('Connecting'))?.disabled).toBe(true);
 await act(async()=>settle({error:null}));
 expect(node.querySelector('[role="alert"]')).toBeNull();
});
it('stops the recovery clock when Google takes the user away from the visible app',async()=>{
 vi.useFakeTimers();
 let settle!:(value:{error:null})=>void;
 oauth.mockReturnValue(new Promise(resolve=>{settle=resolve;}));
 const visible=vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 await act(async()=>root.render(<OAuthButton/>));
 await act(async()=>node.querySelector('button')!.click());
 visible.mockReturnValue('hidden');
 act(()=>document.dispatchEvent(new Event('visibilitychange')));
 act(()=>vi.advanceTimersByTime(30_000));
 expect(node.querySelector('[role="alert"]')).toBeNull();
 expect(node.querySelector('[role="status"]')).toBeNull();
 expect(oauth).toHaveBeenCalledOnce();
 await act(async()=>settle({error:null}));
});
