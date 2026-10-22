// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MapSheetHost } from "./map-sheet-host";
import { CircleSectionNav } from "./circle-section-nav";
let root:Root;let container:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement("div");document.body.append(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();});
function touch(target:Element,type:string,y:number){const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,{touches:[{clientY:y}],changedTouches:[{clientY:y}]});act(()=>target.dispatchEvent(event));return event;}
it("does not report zero members while Circle membership is loading",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()} circleLoading><p>Loading</p></MapSheetHost>));
 const header=container.querySelector('[data-sheet-header]')!;
 expect(header.textContent).toContain('Loading Circle');expect(header.textContent).not.toContain('0 members');
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()} circleName="QA" memberCount={4}><p>Ready</p></MapSheetHost>));
 expect(header.textContent).toContain('QA');expect(header.textContent).toContain('4 members');
});
it("starts a root Circle at the normal member preview with content locked",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><nav aria-label="Circle sections">Members Cafés Activity Memories</nav><div data-testid="circle-member-preview">Ada</div></MapSheetHost>));
 expect(container.querySelector<HTMLElement>("[data-map-sheet]")!.dataset.snap).toBe("half");
 expect(container.querySelector<HTMLElement>("[data-sheet-scroll]")!.style.overflowY).toBe("hidden");
});
it("measures root normal height through the first member row",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><nav aria-label="Circle sections">Members Cafés Activity Memories</nav><div data-testid="circle-member-preview">Ada</div></MapSheetHost>));
 const host=container.querySelector<HTMLElement>("[data-map-sheet]")!;const header=container.querySelector<HTMLElement>("[data-sheet-header]")!;
 const nav=container.querySelector<HTMLElement>('nav[aria-label="Circle sections"]')!;const content=container.querySelector<HTMLElement>("[data-sheet-scroll] > div")!;const member=container.querySelector<HTMLElement>('[data-testid="circle-member-preview"]')!;
 Object.defineProperty(header,"offsetHeight",{configurable:true,value:72});Object.defineProperty(nav,"offsetHeight",{configurable:true,value:48});
 content.getBoundingClientRect=()=>({top:0,bottom:400} as DOMRect);member.getBoundingClientRect=()=>({top:110,bottom:155} as DOMRect);
 act(()=>window.dispatchEvent(new Event("resize")));
 expect(host.style.height).toBe("229px");
});
it("keeps the normal preview within the expanded height on a short viewport",()=>{
 const descriptor=Object.getOwnPropertyDescriptor(window,"innerHeight");Object.defineProperty(window,"innerHeight",{configurable:true,value:200});
 try{
  act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><nav aria-label="Circle sections">Members Cafés Activity Memories</nav><div data-testid="circle-member-preview">Ada</div></MapSheetHost>));
  const host=container.querySelector<HTMLElement>("[data-map-sheet]")!;const header=container.querySelector<HTMLElement>("[data-sheet-header]")!;
  const nav=container.querySelector<HTMLElement>('nav[aria-label="Circle sections"]')!;const content=container.querySelector<HTMLElement>("[data-sheet-scroll] > div")!;const member=container.querySelector<HTMLElement>('[data-testid="circle-member-preview"]')!;
  Object.defineProperty(header,"offsetHeight",{configurable:true,value:72});Object.defineProperty(nav,"offsetHeight",{configurable:true,value:48});
  content.getBoundingClientRect=()=>({top:0,bottom:400} as DOMRect);member.getBoundingClientRect=()=>({top:110,bottom:155} as DOMRect);
  act(()=>window.dispatchEvent(new Event("resize")));
  expect(host.style.height).toBe("184px");expect(host.style.maxHeight).toBe("184px");
 }finally{if(descriptor)Object.defineProperty(window,"innerHeight",descriptor);}
});
it("measures peek through the section tabs without including a member row",()=>{
 act(()=>root.render(<MapSheetHost initialSnap="peek" nested={false} onBack={vi.fn()}><nav aria-label="Circle sections">Members Cafés Activity Memories</nav><div data-testid="circle-member-preview">Ada</div></MapSheetHost>));
 const host=container.querySelector<HTMLElement>("[data-map-sheet]")!;const header=container.querySelector<HTMLElement>("[data-sheet-header]")!;
 const nav=container.querySelector<HTMLElement>('nav[aria-label="Circle sections"]')!;const content=container.querySelector<HTMLElement>("[data-sheet-scroll] > div")!;const member=container.querySelector<HTMLElement>('[data-testid="circle-member-preview"]')!;
 Object.defineProperty(header,"offsetHeight",{configurable:true,value:72});Object.defineProperty(nav,"offsetHeight",{configurable:true,value:48});
 content.getBoundingClientRect=()=>({top:0,bottom:400} as DOMRect);member.getBoundingClientRect=()=>({top:110,bottom:155} as DOMRect);
 act(()=>window.dispatchEvent(new Event("resize")));
 expect(host.style.height).toBe("122px");expect(container.querySelector<HTMLElement>("[data-sheet-scroll]")!.style.overflowY).toBe("hidden");
});
it("moves down from full to normal in one snap",()=>{
 act(()=>root.render(<MapSheetHost initialSnap="full" nested={false} onBack={vi.fn()}><p>Members</p></MapSheetHost>));
 const scroll=container.querySelector<HTMLElement>("[data-sheet-scroll]")!;
 touch(scroll,"touchstart",200);touch(scroll,"touchmove",260);touch(scroll,"touchend",260);
 expect(container.querySelector<HTMLElement>("[data-map-sheet]")!.dataset.snap).toBe("half");
});
it("returns a scrolled full sheet to the top preview when dragged down from its header",()=>{
 act(()=>root.render(<MapSheetHost initialSnap="full" initialScrollTop={120} nested={false} onBack={vi.fn()}><p>Members</p></MapSheetHost>));
 const header=container.querySelector<HTMLElement>("[data-sheet-header]")!;const scroll=container.querySelector<HTMLElement>("[data-sheet-scroll]")!;
 const pointer=(type:string,y:number)=>{const event=new Event(type,{bubbles:true});Object.assign(event,{clientY:y,pointerId:9,button:0});act(()=>header.dispatchEvent(event));};
 expect(scroll.scrollTop).toBe(120);pointer("pointerdown",200);pointer("pointermove",260);pointer("pointerup",260);
 expect(container.querySelector<HTMLElement>("[data-map-sheet]")!.dataset.snap).toBe("half");expect(scroll.scrollTop).toBe(0);
});
it("keeps a shallow downward drag on the normal snap",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><p>Members</p></MapSheetHost>));
 const scroll=container.querySelector<HTMLElement>("[data-sheet-scroll]")!;
 touch(scroll,"touchstart",400);touch(scroll,"touchmove",460);touch(scroll,"touchend",460);
 expect(container.querySelector<HTMLElement>("[data-map-sheet]")!.dataset.snap).toBe("half");
});
it("collapses normal to peek only after a substantial downward drag",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><p>Members</p></MapSheetHost>));
 const scroll=container.querySelector<HTMLElement>("[data-sheet-scroll]")!;
 touch(scroll,"touchstart",300);touch(scroll,"touchmove",420);touch(scroll,"touchend",420);
 expect(container.querySelector<HTMLElement>("[data-map-sheet]")!.dataset.snap).toBe("peek");
});
it("moves up from peek to normal in one snap",()=>{
 act(()=>root.render(<MapSheetHost initialSnap="peek" nested={false} onBack={vi.fn()}><p>Members</p></MapSheetHost>));
 const scroll=container.querySelector<HTMLElement>("[data-sheet-scroll]")!;
 touch(scroll,"touchstart",400);touch(scroll,"touchmove",340);touch(scroll,"touchend",340);
 expect(container.querySelector<HTMLElement>("[data-map-sheet]")!.dataset.snap).toBe("half");
});
it("keeps nested half sheets at their full-height preview and scrollable",()=>{
 const descriptor=Object.getOwnPropertyDescriptor(window,"innerHeight");Object.defineProperty(window,"innerHeight",{configurable:true,value:800});
 try{
  act(()=>root.render(<MapSheetHost nested initialSnap="full" onBack={vi.fn()}><p>Café details</p></MapSheetHost>));
  const host=container.querySelector<HTMLElement>("[data-map-sheet]")!;
  expect(host.dataset.snap).toBe("half");expect(host.style.height).toBe("448px");
  expect(container.querySelector<HTMLElement>("[data-sheet-scroll]")!.style.overflowY).toBe("auto");
 }finally{if(descriptor)Object.defineProperty(window,"innerHeight",descriptor);}
});
it("starts a retained normal root at the top of its preview",()=>{
 act(()=>root.render(<MapSheetHost initialSnap="half" initialScrollTop={120} nested={false} onBack={vi.fn()}><p>Members</p></MapSheetHost>));
 expect(container.querySelector<HTMLElement>("[data-sheet-scroll]")!.scrollTop).toBe(0);
});
it("expands a section button without discarding its section scroll target",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><CircleSectionNav/><section data-circle-section="members"/><section data-circle-section="memories"/></MapSheetHost>));
 const scroll=container.querySelector<HTMLElement>("[data-sheet-scroll]")!;const nav=container.querySelector<HTMLElement>('nav[aria-label="Circle sections"]')!;const memories=container.querySelector<HTMLElement>('[data-circle-section="memories"]')!;
 nav.getBoundingClientRect=()=>({top:0,bottom:50} as DOMRect);memories.getBoundingClientRect=()=>({top:200,bottom:400} as DOMRect);
 scroll.scrollTo=options=>{if(typeof options!=="number")scroll.scrollTop=options?.top??0;};
 act(()=>Array.from(nav.querySelectorAll("button")).find(button=>button.textContent==="Memories")!.click());
 expect(container.querySelector<HTMLElement>("[data-map-sheet]")!.dataset.snap).toBe("full");expect(scroll.scrollTop).toBe(150);
});
it("locks normal content and expands from a swipe on a member button",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><button>Member profile</button></MapSheetHost>));
 const scroll=container.querySelector<HTMLElement>('[data-sheet-scroll]')!;
 expect(scroll.style.overflowY).toBe('hidden');
 const member=Array.from(container.querySelectorAll('button')).find(button=>button.textContent==='Member profile')!;
 const touch=(type:string,y:number)=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,{touches:[{clientY:y}],changedTouches:[{clientY:y}]});act(()=>member.dispatchEvent(event));return event;};
 touch('touchstart',650);expect(touch('touchmove',100).defaultPrevented).toBe(true);touch('touchend',100);
 expect(container.querySelector<HTMLElement>('[data-map-sheet]')!.dataset.snap).toBe('full');
 expect(scroll.style.overflowY).toBe('auto');
});
it("expands collapsed content with wheel input instead of scrolling its preview",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><p>Members</p></MapSheetHost>));
 const scroll=container.querySelector<HTMLElement>('[data-sheet-scroll]')!;
 act(()=>scroll.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:100})));
 expect(container.querySelector<HTMLElement>('[data-map-sheet]')!.dataset.snap).toBe('full');
});
it("drags from the Circle header and suppresses the profile tap after a swipe",()=>{
 const open=vi.fn();
 act(()=>root.render(<MapSheetHost circleName="Our Circle" nested={false} onBack={vi.fn()}><button onClick={open}>Member profile</button></MapSheetHost>));
 const host=container.querySelector<HTMLElement>('[data-map-sheet]')!;
 const header=Array.from(container.querySelectorAll('p')).find(node=>node.textContent?.includes('Our Circle'))!;
 const touch=(target:Element,type:string,y:number)=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,{touches:[{clientY:y}],changedTouches:[{clientY:y}]});act(()=>target.dispatchEvent(event));};
 for(const [type,y] of [['pointerdown',650],['pointermove',100],['pointerup',100]] as const){const event=new Event(type,{bubbles:true});Object.assign(event,{clientY:y,pointerId:2,button:0});act(()=>header.dispatchEvent(event));}
 expect(host.dataset.snap).toBe('full');
 const member=Array.from(container.querySelectorAll('button')).find(button=>button.textContent==='Member profile')!;
 touch(member,'touchstart',100);touch(member,'touchmove',650);touch(member,'touchend',650);
 act(()=>member.click());expect(open).not.toHaveBeenCalled();
 touch(member,'touchstart',200);touch(member,'touchend',200);act(()=>member.click());expect(open).toHaveBeenCalledOnce();
});
it("preserves keyboard activation on interactive content while collapsed",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><button>Member profile</button><input/></MapSheetHost>));
 const member=Array.from(container.querySelectorAll('button')).find(button=>button.textContent==='Member profile')!;
 const event=new KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true});act(()=>member.dispatchEvent(event));
 expect(event.defaultPrevented).toBe(false);expect(container.querySelector<HTMLElement>('[data-map-sheet]')!.dataset.snap).toBe('half');
});
it("expands with a short upward swipe instead of requiring a half-screen drag",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><p>Members</p></MapSheetHost>));
 const row=container.querySelector('[data-sheet-scroll] p')!;
 for(const [type,y] of [['touchstart',500],['touchmove',440],['touchend',440]] as const){const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,{touches:[{clientY:y}],changedTouches:[{clientY:y}]});act(()=>row.dispatchEvent(event));}
 expect(container.querySelector<HTMLElement>('[data-map-sheet]')!.dataset.snap).toBe('full');
});
it("accepts a mouse drag across the Circle title row",()=>{
 act(()=>root.render(<MapSheetHost circleName="Our Circle" nested={false} onBack={vi.fn()}><p>Members</p></MapSheetHost>));
 const title=Array.from(container.querySelectorAll('p')).find(node=>node.textContent?.includes('Our Circle'))!;
 for(const [type,y] of [['pointerdown',600],['pointermove',100],['pointerup',100]] as const){const event=new Event(type,{bubbles:true});Object.assign(event,{clientY:y,pointerId:2,button:0});act(()=>title.dispatchEvent(event));}
 expect(container.querySelector<HTMLElement>('[data-map-sheet]')!.dataset.snap).toBe('full');
});
it("keeps the collapsed preview short enough to show only its header and section tabs",()=>{
 act(()=>root.render(<MapSheetHost initialSnap="peek" nested={false} onBack={vi.fn()}><nav aria-label="Circle sections">Members Cafés Activity Memories</nav><p>Member rows</p></MapSheetHost>));
 expect(parseFloat(container.querySelector<HTMLElement>('[data-map-sheet]')!.style.height)).toBeLessThanOrEqual(130);
});
it("keeps pointer capture on the handle so an ordinary tap still targets its button",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><p>Members</p></MapSheetHost>));
 const handle=container.querySelector<HTMLButtonElement>('[data-sheet-handle]')!;
 const capture=vi.fn();handle.setPointerCapture=capture;
 const event=new Event('pointerdown',{bubbles:true});Object.assign(event,{clientY:500,pointerId:4,button:0});act(()=>handle.dispatchEvent(event));
 expect(capture).toHaveBeenCalledWith(4);
});
it("does not swallow Back after a cancelled header drag",()=>{
 const back=vi.fn();act(()=>root.render(<MapSheetHost nested onBack={back}><p>Content</p></MapSheetHost>));
 const header=container.querySelector<HTMLElement>('[data-sheet-header]')!;const capture=vi.fn();header.setPointerCapture=capture;
 for(const [type,y] of [['pointerdown',500],['pointermove',100],['pointercancel',100]] as const){const event=new Event(type,{bubbles:true});Object.assign(event,{clientY:y,pointerId:4,button:0});act(()=>header.dispatchEvent(event));}
 expect(capture).toHaveBeenCalledWith(4);act(()=>container.querySelector<HTMLButtonElement>('[aria-label="Back"]')!.click());expect(back).toHaveBeenCalledOnce();
});
it("keeps Back clickable after a cancelled content drag",()=>{
 const back=vi.fn();act(()=>root.render(<MapSheetHost nested onBack={back}><p>Content</p></MapSheetHost>));
 const scroll=container.querySelector<HTMLElement>("[data-sheet-scroll]")!;
 touch(scroll,"touchstart",500);touch(scroll,"touchmove",400);act(()=>scroll.dispatchEvent(new Event("touchcancel",{bubbles:true})));
 act(()=>container.querySelector<HTMLButtonElement>('[aria-label="Back"]')!.click());expect(back).toHaveBeenCalledOnce();
});
it("shows Circle identity and discreet size controls instead of page tabs",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()} circleName="Our Circle" memberCount={6}><p>Members</p></MapSheetHost>));
 expect(container.querySelectorAll('[data-map-sheet]')).toHaveLength(1);
 expect(container.textContent).toContain("Our Circle");expect(container.textContent).toContain("6 members");
 expect(container.querySelector('[aria-label="Map views"]')).toBeNull();
 expect(container.textContent).not.toContain("Half");
 expect(container.querySelector('[aria-label="Show half sheet"]')).toBeNull();
 expect(container.querySelector('[aria-label="Collapse sheet"]')).toBeNull();
 act(()=>container.querySelector<HTMLButtonElement>('[aria-label="Expand sheet"]')!.click());
 expect(container.querySelector('[data-map-sheet]')?.getAttribute('data-snap')).toBe('full');
 act(()=>container.querySelector<HTMLButtonElement>('[aria-label="Collapse sheet"]')!.click());
 expect(container.querySelector('[data-map-sheet]')?.getAttribute('data-snap')).toBe('half');
});
it("does not animate the initial viewport measurement on a new Circle host",()=>{
 let frame:FrameRequestCallback=()=>{};vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frame=callback;return 1;});vi.stubGlobal('cancelAnimationFrame',vi.fn());
 try{
  act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><p>Members</p></MapSheetHost>));
  const sheet=container.querySelector<HTMLElement>('[data-map-sheet]')!;
  expect(sheet.style.transition).toBe('none');act(()=>frame(0));expect(sheet.style.transition).toContain('height');
 }finally{vi.unstubAllGlobals();}
});
it("moves with pointer drag before release and settles to an endpoint",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><p>Content</p></MapSheetHost>));
 const handle=container.querySelector<HTMLButtonElement>('[aria-label="Expand sheet"]')!;
 const host=container.querySelector<HTMLElement>('[data-map-sheet]')!;
 const pointer=(type:string,y:number)=>{const event=new Event(type,{bubbles:true});Object.assign(event,{clientY:y,pointerId:1,button:0});act(()=>handle.dispatchEvent(event));};
 pointer('pointerdown',400);pointer('pointermove',200);
 expect(parseFloat(host.style.height)).toBeGreaterThan(300);
 pointer('pointerup',100);expect(host.dataset.snap).toBe('full');
});
it("settles a deliberate full-sheet drag at normal when held still",()=>{
 let now=0;const clock=vi.spyOn(performance,'now').mockImplementation(()=>now);
 try{
  act(()=>root.render(<MapSheetHost initialSnap="full" nested={false} onBack={vi.fn()}><p>Content</p></MapSheetHost>));
  const handle=container.querySelector<HTMLButtonElement>('[aria-label="Collapse sheet"]')!;
  const pointer=(type:string,y:number)=>{const event=new Event(type,{bubbles:true});Object.assign(event,{clientY:y,pointerId:1,button:0});act(()=>handle.dispatchEvent(event));};
  pointer('pointerdown',100);now=10;pointer('pointermove',230);now=2010;pointer('pointerup',230);
  expect(container.querySelector('[data-map-sheet]')?.getAttribute('data-snap')).toBe('half');
 }finally{clock.mockRestore();}
});
it("keeps an explicit bounded height after releasing back into the same expanded snap",()=>{
 act(()=>root.render(<MapSheetHost initialSnap="full" nested={false} onBack={vi.fn()}><p>Content</p></MapSheetHost>));
 const handle=container.querySelector<HTMLButtonElement>('[aria-label="Collapse sheet"]')!;
 const pointer=(type:string,y:number)=>{const event=new Event(type,{bubbles:true});Object.assign(event,{clientY:y,pointerId:1,button:0});act(()=>handle.dispatchEvent(event));};
 pointer('pointerdown',300);pointer('pointermove',100);pointer('pointerup',100);
 const sheet=container.querySelector<HTMLElement>('[data-map-sheet]')!;
 expect(sheet.style.height).not.toBe('');expect(parseFloat(sheet.style.height)).toBeLessThanOrEqual(window.innerHeight);
 expect(sheet.style.maxHeight).not.toBe('');
});
it("allows downward content drag only at the top and preserves ordinary content scrolling",()=>{
 act(()=>root.render(<MapSheetHost initialSnap="full" nested={false} onBack={vi.fn()}><p>Content</p></MapSheetHost>));
 const scroll=container.querySelector<HTMLElement>('[data-sheet-scroll]')!;
 const host=container.querySelector<HTMLElement>('[data-map-sheet]')!;
 const touch=(type:string,y:number)=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,{touches:[{clientY:y}],changedTouches:[{clientY:y}]});act(()=>scroll.dispatchEvent(event));return event;};
 scroll.scrollTop=90;touch('touchstart',100);expect(touch('touchmove',600).defaultPrevented).toBe(false);touch('touchend',600);expect(host.dataset.snap).toBe('full');
 scroll.scrollTop=0;touch('touchstart',100);expect(touch('touchmove',600).defaultPrevented).toBe(true);touch('touchend',600);expect(host.dataset.snap).toBe('half');
});
it("restores overview state across nested content and reports root scroll/snap",()=>{
 const change=vi.fn();const back=vi.fn();
 const render=(nested=false,key="overview")=>act(()=>root.render(<MapSheetHost initialScrollTop={120} initialSnap="full" contentKey={key} nested={nested} onBack={back} onViewStateChange={change}><p>Content</p></MapSheetHost>));
 render();const scroller=container.querySelector<HTMLElement>('[data-sheet-scroll]')!;
 expect(scroller.scrollTop).toBe(120);expect(container.querySelector('[data-snap="full"]')).not.toBeNull();
 scroller.scrollTop=210;act(()=>scroller.dispatchEvent(new Event('scroll')));
 expect(change).toHaveBeenLastCalledWith({scrollTop:210,snap:"full"});
 render(true,"cafe");expect(scroller.scrollTop).toBe(0);
 act(()=>container.querySelector<HTMLButtonElement>('[aria-label="Back"]')!.click());expect(back).toHaveBeenCalledOnce();
 render();expect(scroller.scrollTop).toBe(210);
});
it("waits for async content height before restoring saved scroll",()=>{
 let capacity=0;let resize=()=>{};const offsets=new WeakMap<HTMLElement,number>();
 const descriptor=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollTop');
 Object.defineProperty(HTMLElement.prototype,'scrollTop',{configurable:true,get(){return offsets.get(this)??0;},set(value:number){offsets.set(this,Math.min(value,capacity));}});
 vi.stubGlobal('ResizeObserver',class {constructor(callback:()=>void){resize=callback;}observe(){}disconnect(){}});
 try {
  act(()=>root.render(<MapSheetHost initialScrollTop={120} initialSnap="full" nested={false} onBack={vi.fn()}><p>Loading members</p></MapSheetHost>));
  const scroll=container.querySelector<HTMLElement>('[data-sheet-scroll]')!;expect(scroll.scrollTop).toBe(0);
  capacity=400;act(()=>resize());expect(scroll.scrollTop).toBe(120);
 }finally{if(descriptor)Object.defineProperty(HTMLElement.prototype,'scrollTop',descriptor);else Reflect.deleteProperty(HTMLElement.prototype,'scrollTop');vi.unstubAllGlobals();}
});
it("does not overwrite an overview position when shorter nested DOM clamps its scroll",()=>{
 const render=(nested=false)=>act(()=>root.render(<MapSheetHost initialSnap="full" nested={nested} contentKey={nested?'short-cafe':'overview'} onBack={vi.fn()}><p>{nested?'Short cafe':'Long members'}</p></MapSheetHost>));
 render();const scroll=container.querySelector<HTMLElement>('[data-sheet-scroll]')!;
 scroll.scrollTop=500;act(()=>scroll.dispatchEvent(new Event('scroll')));
 scroll.scrollTop=0;render(true);render();expect(scroll.scrollTop).toBe(500);
});
it("does not reserve bottom safe-area padding inside the map sheet above bottom navigation",()=>{
 act(()=>root.render(<MapSheetHost nested={false} onBack={vi.fn()}><nav aria-label="Circle sections">Members Cafés Activity Memories</nav><div data-testid="circle-member-preview">Ada</div></MapSheetHost>));
 const host=container.querySelector<HTMLElement>("[data-map-sheet]")!;
 expect(host.getAttribute("style")||"").not.toContain("safe-area-inset-bottom");
});
it("keeps the members section visible while loading and remeasures when the first member renders",()=>{
 let mutate:MutationCallback=()=>{};
 vi.stubGlobal("MutationObserver",class{constructor(callback:MutationCallback){mutate=callback;}observe(){}disconnect(){}});
 try{
  const Section=({loaded}:{loaded:boolean})=><section data-circle-section="members"><h3>Members</h3>{loaded?<div data-testid="circle-member-preview">Ada</div>:<p role="status">Loading members…</p>}</section>;
  const tree=<MapSheetHost nested={false} onBack={vi.fn()} memberCount={4}><nav aria-label="Circle sections">Members Cafés Activity Memories</nav><Section loaded={false}/></MapSheetHost>;
  act(()=>root.render(tree));
  const host=container.querySelector<HTMLElement>("[data-map-sheet]")!;const header=container.querySelector<HTMLElement>("[data-sheet-header]")!;
  const nav=container.querySelector<HTMLElement>('nav[aria-label="Circle sections"]')!;const content=container.querySelector<HTMLElement>("[data-sheet-scroll] > div")!;
  const section=container.querySelector<HTMLElement>('[data-circle-section="members"]')!;
  Object.defineProperty(header,"offsetHeight",{configurable:true,value:72});Object.defineProperty(nav,"offsetHeight",{configurable:true,value:48});
  content.getBoundingClientRect=()=>({top:0,bottom:320} as DOMRect);section.getBoundingClientRect=()=>({top:48,bottom:136} as DOMRect);
  act(()=>window.dispatchEvent(new Event("resize")));
  expect(host.style.height).toBe("210px");
  const member=document.createElement("div");member.dataset.testid="circle-member-preview";member.textContent="Ada";
  member.getBoundingClientRect=()=>({top:110,bottom:155} as DOMRect);
  section.append(member);
  act(()=>mutate([],{} as MutationObserver));
  expect(host.style.height).toBe("229px");
 }finally{vi.unstubAllGlobals();}
});
