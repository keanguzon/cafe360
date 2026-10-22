import { beforeEach, expect, it, vi } from 'vitest';
import { readSheetProfileAction, readSheetMemoryAction, readSheetCircleAction } from './sheet-read-actions';
const m = vi.hoisted(() => ({ account: 'A', profileExists: true, member: true, target: true, visitCircle: 'circleA', from: vi.fn() }));
vi.mock('@/lib/supabase/config', () => ({ hasSupabaseConfig: () => true }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: m.account } } }) }, from: m.from }) }));
beforeEach(() => {
    m.account = 'A';
    m.profileExists = true;
    m.member = true;
    m.target = true;
    m.visitCircle = 'circleA';
    m.from.mockReset();
    m.from.mockImplementation((table: string) => {
        const filters: Record<string, string> = {};
        const q = { select: () => q, eq: (k: string, v: string) => { filters[k] = v; return q; }, maybeSingle: async () => ({ data: table === 'group_members' ? ((filters.user_id === 'A' ? m.member : m.target) ? { user_id: filters.user_id } : null) : table === 'profiles' ? (m.profileExists ? { id: filters.id, display_name: 'Name' } : null) : { id: 'visit', group_id: m.visitCircle, photos: [] }, error: null }) };
        return q;
    });
});
it('reads own profile', async () => { expect(await readSheetProfileAction({ expectedAccountId: 'A' })).toMatchObject({ ok: true, data: { id: 'A' } }); });
it.each([false, true])('requires both current Circle memberships (caller=%s)', async (caller) => {
    m.member = caller;
    m.target = !caller;
    await expect(readSheetProfileAction({ expectedAccountId: 'A', userId: 'target', circleId: 'circleA' })).resolves.toMatchObject({ ok: false, status: 403 });
    expect(m.from.mock.calls.filter(([table]) => table === 'profiles')).toHaveLength(0);
});
it('returns a member only in the requested shared Circle', async () => { expect(await readSheetProfileAction({ expectedAccountId: 'A', userId: 'target', circleId: 'circleA' })).toMatchObject({ ok: true, data: { id: 'target' } }); });
it('denies a visit from a different Circle', async () => { m.visitCircle = 'circleB'; await expect(readSheetMemoryAction({ expectedAccountId: 'A', visitId: 'visit', circleId: 'circleA' })).resolves.toMatchObject({ ok: false, status: 403 }); });
it('rechecks revoked memory membership', async () => { await readSheetMemoryAction({ expectedAccountId: 'A', visitId: 'visit', circleId: 'circleA' }); m.member = false; await expect(readSheetMemoryAction({ expectedAccountId: 'A', visitId: 'visit', circleId: 'circleA' })).resolves.toMatchObject({ ok: false, status: 403 }); });
it.each(['profile', 'memory'])('rejects a captured %s read before any protected query after account change', async (kind) => {
    m.account = 'B';
    const read = kind === 'profile' ? readSheetProfileAction({ expectedAccountId: 'A' }) : readSheetMemoryAction({ expectedAccountId: 'A', visitId: 'visit', circleId: 'circleA' });
    await expect(read).resolves.toMatchObject({ ok: false, status: 401 });
    expect(m.from).not.toHaveBeenCalled();
});
it('rejects a Circle detail read captured under the previous account', async () => { m.account = 'B'; await expect(readSheetCircleAction({ expectedAccountId: 'A', circleId: 'circleA' })).resolves.toMatchObject({ ok: false, status: 401 }); expect(m.from).not.toHaveBeenCalled(); });
it('preserves the authenticated own-profile fallback before a profile row is created', async () => { m.profileExists = false; await expect(readSheetProfileAction({ expectedAccountId: 'A' })).resolves.toMatchObject({ ok: true, data: { id: 'A', display_name: 'Cafe Explorer' } }); });
