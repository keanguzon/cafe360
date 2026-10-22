// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig, unstable_serialize, type Cache } from 'swr';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HttpResponseError, SWRProvider } from '@/components/providers/swr-provider';
import { useSheetResource, unwrapSheetRead } from './use-sheet-resource';
let root: Root;
let node: HTMLDivElement;
let cache: Cache;
let latest: ReturnType<typeof useSheetResource<string>>;
const read = vi.fn();
function Probe({ account, active }: {
    account: string;
    active: boolean;
}) { const resource = useSheetResource<string>(['sheet-profile', account], () => read(account), active); useEffect(() => { latest = resource; }); return <span>{resource.data}</span>; }
function render(account: string, active = true) { act(() => root.render(<SWRConfig value={{ provider: () => cache, shouldRetryOnError: false }}><Probe account={account} active={active}/></SWRConfig>)); }
async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); cache = new Map(); node = document.createElement('div'); root = createRoot(node); read.mockReset(); read.mockImplementation(async (a) => a); });
afterEach(() => { act(() => root.unmount()); vi.useRealTimers(); });
it.each([401, 403])('hides shared cached data with a %s error before its own fetcher runs', async (status) => {
    const key = ['sheet-profile', 'A'];
    cache.set(unstable_serialize(key), { data: 'Private memory', error: new HttpResponseError('Access denied', status) });
    render('A', false);
    await settle();
    expect(read).not.toHaveBeenCalled();
    expect(latest.data).toBeUndefined();
    expect(node.textContent).not.toContain('Private memory');
});
it('keeps a denied warm resource hidden after its hook remounts', async () => {
    render('A'); await settle();
    read.mockRejectedValueOnce(new HttpResponseError('Membership revoked', 403));
    await act(async () => { await latest.refresh().catch(() => undefined); });
    expect(latest.data).toBeUndefined();
    act(() => root.render(null));
    render('A', false); await settle();
    expect(latest.error?.message).toBe('Membership revoked');
    expect(latest.data).toBeUndefined();
    expect(node.textContent).not.toBe('A');
});
it('returns warm A immediately after A to B to A without mixing account keys', async () => { render('A'); await settle(); expect(latest.data).toBe('A'); render('B'); expect(latest.data).toBeUndefined(); await settle(); expect(latest.data).toBe('B'); render('A'); expect(latest.data).toBe('A'); });
it('never caches a failed captured-account read as another account payload', async () => { read.mockImplementationOnce(async () => unwrapSheetRead(JSON.parse(JSON.stringify({ ok: false, status: 401, error: 'Account changed' })))); render('A'); await settle(); expect(latest.data).toBeUndefined(); render('B'); await settle(); expect(latest.data).toBe('B'); render('A'); expect(latest.data).toBeUndefined(); });
it('does not poll an inactive warm resource', async () => { vi.useFakeTimers(); render('A'); await settle(); render('A', false); const calls = read.mock.calls.length; await act(async () => { await vi.advanceTimersByTimeAsync(120000); }); expect(read).toHaveBeenCalledTimes(calls); expect(latest.data).toBe('A'); });
it('hides a warm resource after a serialized access denial', async () => { render('A'); await settle(); expect(latest.data).toBe('A'); read.mockImplementationOnce(async () => unwrapSheetRead(JSON.parse(JSON.stringify({ ok: false, status: 403, error: 'Membership revoked' })))); await act(async () => { await latest.refresh().catch(() => undefined); }); expect(latest.data).toBeUndefined(); expect(latest.error?.message).toBe('Membership revoked'); });
it('retains the access denial after the shared provider evicts warm data', async () => { act(() => root.render(<SWRProvider><Probe account="A" active/></SWRProvider>)); await settle(); expect(latest.data).toBe('A'); read.mockImplementationOnce(async () => unwrapSheetRead({ ok: false, status: 403, error: 'Revoked' })); await act(async () => { await latest.refresh().catch(() => undefined); }); expect(latest.data).toBeUndefined(); expect(latest.error?.message).toBe('Revoked'); });
