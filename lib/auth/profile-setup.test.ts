import { expect, it } from 'vitest';
import { emailDisplayName, isProfileSetupComplete, inviteSetupPath } from './profile-setup';

it('suggests the email local part without inventing a username',()=>{
 expect(emailDisplayName(' mika.santos@example.com ')).toBe('mika.santos');
 expect(emailDisplayName(null)).toBe('');
 expect(emailDisplayName('invalid')).toBe('');
 expect(emailDisplayName('x'.repeat(100)+'@example.com')).toHaveLength(80);
});
it('distinguishes the exact generated handle from a chosen username',()=>{
 const id='83aa43f1-e1f4-4733-8977-dda4bb28e3d2';
 expect(isProfileSetupComplete({username:'user_83aa43f1e1f44733',display_name:'Cafe explorer'},id)).toBe(false);
 expect(isProfileSetupComplete(null,id)).toBe(false);
 expect(isProfileSetupComplete({username:'mika',display_name:'Mika'},id)).toBe(true);
 expect(isProfileSetupComplete({username:'user_coffee',display_name:'Mika'},id)).toBe(true);
 expect(isProfileSetupComplete({username:'mika',display_name:' '},id)).toBe(false);
});
it('keeps only a valid invite code across profile setup',()=>{
 expect(inviteSetupPath(' abc123 ')).toBe('/onboarding?invite=ABC123');
 expect(inviteSetupPath('//elsewhere')).toBe('/onboarding');
});
