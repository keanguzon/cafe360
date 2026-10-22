import { beforeEach, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({profile:null as {username:string;display_name:string}|null,error:null as {message:string}|null}));
vi.mock('@/lib/supabase/config',()=>({hasSupabaseConfig:()=>true}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({
 auth:{getUser:async()=>({data:{user:{id:'83aa43f1-e1f4-4733-8977-dda4bb28e3d2',email:'mika.santos@example.com',user_metadata:{full_name:'Provider Name'}}}})},
 from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:state.profile,error:state.error})})})})
})}));
import { checkUsernameSetAction } from './username-actions';
beforeEach(()=>{state.error=null;state.profile={username:'user_83aa43f1e1f44733',display_name:'Cafe explorer'};});
it('returns a blank username and email display suggestion for fresh OAuth accounts',async()=>{
 expect(await checkUsernameSetAction()).toEqual({hasUsername:false,username:'',displayName:'mika.santos'});
});
it('does not overwrite an established account name or chosen username',async()=>{
 state.profile={username:'coffee_mika',display_name:'Mika S.'};
 expect(await checkUsernameSetAction()).toEqual({hasUsername:true,username:'coffee_mika',displayName:'Mika S.'});
});
it('keeps the username blank if the signup profile has not appeared yet',async()=>{
 state.profile=null;
 expect(await checkUsernameSetAction()).toEqual({hasUsername:false,username:'',displayName:'mika.santos'});
});
it('reports a lookup failure without suggesting replacement fields for an existing user',async()=>{
 state.profile=null;state.error={message:'Database unavailable'};
 const result=await checkUsernameSetAction();
 expect(result.error).toBeTruthy();expect(result.username).toBeUndefined();expect(result.displayName).toBeUndefined();
});
