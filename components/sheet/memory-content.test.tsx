// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { SWRConfig } from 'swr';
import { MemoryContent } from './memory-content';
const m = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/lib/actions/sheet-read-actions', () => ({ readSheetMemoryAction: m.read }));
vi.mock('@/lib/context/circle-context', () => ({ useCircle: () => ({ accountId: 'A', membershipsResolved: true, userCircles: [{ id: 'circleA' }] }) }));
vi.mock('@/components/visit/memory-card', () => ({ MemoryCard: () => <div>Private photo signing consumer</div> }));
it('does not mount a private photo consumer for another Circles memory', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    m.read.mockResolvedValue({ ok: true, data: { id: 'visit', group_id: 'circleB' } });
    const node = document.createElement('div');
    const root = createRoot(node);
    await act(async () => root.render(<SWRConfig value={{ provider: () => new Map() }}><MemoryContent accountId="A" circleId="circleA" visitId="visit" presentation="sheet" onOpen={() => { }} onBack={() => { }}/></SWRConfig>));
    expect(node.textContent).not.toContain('Private photo signing consumer');
    expect(node.textContent).toContain('unavailable');
    act(() => root.unmount());
});
