export function emailDisplayName(email?: string | null): string {
  const value = email?.trim() ?? '';
  const at = value.indexOf('@');
  return at > 0 ? value.slice(0, at).slice(0, 80) : '';
}

export function isProfileSetupComplete(
  profile: { username?: string | null; display_name?: string | null } | null,
  accountId: string,
): boolean {
  const generated = `user_${accountId.replaceAll('-', '').slice(0, 16)}`;
  return !!profile?.display_name?.trim() && !!profile.username &&
    /^[a-z0-9_]{3,24}$/.test(profile.username) && profile.username !== generated;
}

export function inviteSetupPath(code: string): string {
  const normalized = code.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(normalized) ? `/onboarding?invite=${normalized}` : '/onboarding';
}
