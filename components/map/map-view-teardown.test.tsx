// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({events:{} as Record<string,()=>void>,removed:false,source:vi.fn(),update:vi.fn()}));
vi.mock('mapbox-gl',()=>({default:{Map:class {
 on(name:string,callback:()=>void){state.events[name]=callback;}
 getSource(){if(state.removed)throw new Error("Cannot read properties of undefined (reading 'getOwnSource')");state.source();return {setData:vi.fn()};}
 setStyle(){}
 getCenter(){return {lng:121,lat:14};} getZoom(){return 15;}
 unproject(){return {lng:121,lat:14};} easeTo(){} remove(){state.removed=true;}
}}}));
vi.mock('@/lib/services/map-service',()=>({DEFAULT_MAP_CENTER:[121,14],DEFAULT_ZOOM:15,hasMapboxConfig:()=>true,getMapboxToken:()=> 'test',MAPBOX_STYLES:{satellite:'test'},createFlyToOptions:()=>({})}));
vi.mock('@/lib/context/circle-context',()=>({useCircle:()=>({accountId:'a',circleVisits:[],circleCafeSummaries:[]})}));
vi.mock('@/lib/context/navigation-state',()=>({useNavigationState:()=>({map:{style:'satellite',query:'',searchCoordinates:null},update:state.update,getSnapshot:()=>({map:{}})})}));
vi.mock('@/lib/hooks/use-local-location',()=>({useLocalLocation:()=>({coordinates:null,status:'idle',accuracyMeters:null,requestLocation:vi.fn()})}));
vi.mock('@/lib/hooks/use-cafes',()=>({useCafes:()=>({cafes:[],fetchCafes:vi.fn(),completedSearch:null})}));
vi.mock('@/components/layout/circle-top-bar',()=>({CircleTopBar:()=>null}));
vi.mock('@/components/discover/nearby-list-link',()=>({NearbyListLink:()=>null}));
import { MapView } from './map-view';
it('cancels queued radius work and ignores a late callback after Mapbox teardown',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});let queued:FrameRequestCallback=()=>{};
 const cancel=vi.fn();vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{queued=callback;return 42;});vi.stubGlobal('cancelAnimationFrame',cancel);
 const element=document.createElement('div');const root=createRoot(element);state.removed=false;
 try{
  act(()=>root.render(<MapView shellMode/>));act(()=>state.events.move());
  const late=queued;act(()=>root.unmount());
  expect(()=>late(0)).not.toThrow();expect(cancel).toHaveBeenCalledWith(42);
 }finally{vi.unstubAllGlobals();}
});

it('shows recovery for a stuck style load and clears it when the style finishes',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();state.removed=false;
 vi.stubGlobal('requestAnimationFrame',vi.fn());vi.stubGlobal('cancelAnimationFrame',vi.fn());
 const element=document.createElement('div');const controls=document.createElement('div');const root=createRoot(element);
 try{
  await act(async()=>root.render(<MapView shellMode floatingActionsTarget={controls}/>));
  await act(async()=>state.events.load());
  act(()=>controls.querySelector<HTMLButtonElement>('[aria-label="Toggle Map Style"]')!.click());
  expect(element.textContent).toContain('Loading map style');
  act(()=>vi.advanceTimersByTime(10_000));expect(element.textContent).toContain('taking too long');
  act(()=>state.events['style.load']());expect(element.textContent).not.toContain('taking too long');
 }finally{act(()=>root.unmount());vi.useRealTimers();vi.unstubAllGlobals();}
});
