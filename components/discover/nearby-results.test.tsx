// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ search: null as unknown, options: vi.fn(), retry: vi.fn(), error: null as string|null, cafes: [{id:'near',name:'Nearby coffee',coordinates:[121,14],address:'Here'}], top: false }));
vi.mock('@/lib/context/navigation-state',()=>({useNavigationState:()=>({nearbyList:state.search})}));
vi.mock('@/lib/context/circle-context',()=>({useCircle:()=>({accountId:'a',circleCafeSummaries:[{providerId:'far',name:'Distant Circle café',rating:5},{providerId:'near',rating:5,ratingCount:1,internalId:'internal'}]})}));
vi.mock('@/lib/hooks/use-cafes',()=>({useCafes:(options:unknown)=>{state.options(options);return {cafes:state.cafes,isLoading:false,error:state.error,fetchCafes:state.retry};}}));
vi.mock('@/components/cafe/cafe-card',()=>({CafeCard:({cafe}:{cafe:{name:string}})=><div>{cafe.name}</div>}));
vi.mock('@/components/cafe/cafe-detail-sheet',()=>({CafeDetailSheet:()=>null}));
import { NearbyFromMap, NearbyResults } from './nearby-results';
let root:Root;let node:HTMLDivElement;
const search={query:'coffee',coordinates:[121,14] as [number,number],radiusMeters:1500,limit:50,filterTopRated:true};
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});node=document.createElement('div');document.body.append(node);root=createRoot(node);state.options.mockClear();state.retry.mockClear();state.search=null;state.error=null;});
afterEach(()=>{act(()=>root.unmount());node.remove();});
it('uses_searched_area_not_device_location and does_not_inject_distant_circle_saves',()=>{
 const gps=vi.fn();Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:gps}});
 act(()=>root.render(<NearbyResults search={search}/>));
 expect(state.options).toHaveBeenCalledWith(expect.objectContaining({accountId:'a',initialCoords:[121,14],initialQuery:'coffee',radiusMeters:1500,limit:50}));
 expect(gps).not.toHaveBeenCalled();expect(node.textContent).toContain('Nearby coffee');expect(node.textContent).not.toContain('Distant Circle café');
 expect(node.querySelector('a[href*="lng"]')).toBeNull();
});
it('fresh_from_map_entry_has_honest_guidance',()=>{
 act(()=>root.render(<NearbyFromMap/>));expect(node.textContent).toContain('Return to map');expect(state.options).not.toHaveBeenCalled();expect(node.textContent).not.toContain('Cavite');
});
it('offers retry for the exact searched area',()=>{
 state.error='Search unavailable';act(()=>root.render(<NearbyResults search={search}/>));expect(node.textContent).toContain('Search unavailable');
 act(()=>node.querySelector<HTMLButtonElement>('button')!.click());expect(state.retry).toHaveBeenCalledWith('coffee',[121,14]);
});
it('shows usable zero-results guidance',()=>{
 const previous=state.cafes;state.cafes=[];
 act(()=>root.render(<NearbyResults search={search}/>));
 expect(node.textContent).toContain('No cafés match this search');expect(node.querySelector('a[href="/map"]')).not.toBeNull();
 state.cafes=previous;
});
