// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig, unstable_serialize } from 'swr';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CafeContent } from './cafe-content';
const read=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/actions/cafe-details-actions',()=>({getCafeByReferenceAction:read}));
vi.mock('@/lib/context/circle-context',()=>({useCircle:()=>({accountId:'account',activeCircle:{id:'circle-a'},membershipsResolved:true})}));
vi.mock('@/components/cafe/cafe-detail-content',()=>({CafeDetailContent:({cafe}:{cafe:{name:string}})=><p>{cafe.name}</p>}));
vi.mock('@/components/visit/visit-timeline-fetcher',()=>({VisitTimelineFetcher:()=>null}));
vi.mock('@/components/visit/log-visit-form',()=>({LogVisitForm:({cafe}:{cafe:{name:string}})=><form>{cafe.name}</form>}));
let root:Root;let node:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});node=document.createElement('div');root=createRoot(node);read.mockResolvedValue(null);});
afterEach(()=>{act(()=>root.unmount());vi.clearAllMocks();});
async function renderSearch(owner='account',circle='circle-a',view:'cafe'|'visit'='cafe',error?:Error){
 const key=[owner,'/api/places/search?q=coffee'];
 const cache=new Map([[unstable_serialize(key),{_k:key,error,data:{results:[{id:'provider-cafe',name:'Fresh search café',address:'Address',coordinates:[121,14]}],fetchedAt:Date.now()}}]]);
 await act(async()=>{root.render(<SWRConfig value={{provider:()=>cache,dedupingInterval:0}}><CafeContent accountId="account" circleId={circle} cafeId="provider-cafe" view={view} presentation="sheet" onOpen={()=>{}} onBack={()=>{}}/></SWRConfig>);});
}
it('opens an unpersisted café from the current account search without a database waterfall',async()=>{
 await renderSearch();expect(node.textContent).toContain('Fresh search café');expect(read).not.toHaveBeenCalled();
});
it('uses the same selected search result for logging a visit',async()=>{
 await renderSearch('account','circle-a','visit');expect(node.querySelector('form')?.textContent).toBe('Fresh search café');
});
it('does not reuse another account search results',async()=>{
 await renderSearch('other');expect(node.textContent).not.toContain('Fresh search café');expect(read).toHaveBeenCalled();
});
it('denies a different Circle before rendering cached search data',async()=>{
 await renderSearch('account','circle-b');expect(node.textContent).not.toContain('Fresh search café');expect(read).not.toHaveBeenCalled();
});
it('falls back to the canonical reader when cached search has an error',async()=>{
 read.mockResolvedValue({id:'provider-cafe',name:'Canonical café',address:'Address',coordinates:[121,14]});
 await renderSearch('account','circle-a','cafe',new Error('Search failed'));
 expect(node.textContent).toContain('Canonical café');expect(node.textContent).not.toContain('Fresh search café');expect(read).toHaveBeenCalled();
});
