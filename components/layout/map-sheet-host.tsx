"use client";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import type { CircleSheetState } from "@/lib/context/navigation-state";
export type MapSheetSnap = CircleSheetState['snap'];
const SNAP_GESTURE_THRESHOLD=40;
const NORMAL_TO_PEEK_THRESHOLD=112;
function adjacentSnap(snap:MapSheetSnap,direction:'expand'|'collapse',nested:boolean):MapSheetSnap {
 if(nested)return direction==='expand'?'full':'half';
 if(direction==='expand')return snap==='peek'?'half':'full';
 return snap==='full'?'half':snap==='half'?'peek':'peek';
}
function dragSnap(snap:MapSheetSnap,distance:number,nested:boolean):MapSheetSnap {
 if(nested){if(snap==='full')return distance>=SNAP_GESTURE_THRESHOLD?'half':'full';return distance<=-SNAP_GESTURE_THRESHOLD?'full':'half';}
 if(snap==='peek')return distance<=-SNAP_GESTURE_THRESHOLD?'half':'peek';
 if(snap==='half'){
  if(distance<=-SNAP_GESTURE_THRESHOLD)return 'full';
  if(distance>=NORMAL_TO_PEEK_THRESHOLD)return 'peek';
  return 'half';
 }
 return distance>=SNAP_GESTURE_THRESHOLD?'half':'full';
}
export function MapSheetHost({children,nested,onBack,floatingActions,onSnapChange,circleName,circleLoading=false,memberCount=0,contentKey='overview',initialScrollTop=0,initialSnap='half',onViewStateChange}: {
 children:ReactNode;nested:boolean;onBack():void;floatingActions?:ReactNode;onSnapChange?(snap:MapSheetSnap):void;circleName?:string;circleLoading?:boolean;memberCount?:number;contentKey?:string;initialScrollTop?:number;initialSnap?:MapSheetSnap;onViewStateChange?(state:CircleSheetState):void;
}) {
 const scroller=useRef<HTMLDivElement>(null);
 const host=useRef<HTMLElement>(null);
 const content=useRef<HTMLDivElement>(null);
 const pendingScroll=useRef<number|null>(null);
 const positions=useRef<Record<string,number>>({overview:initialScrollTop});
 const [rootSnap,setRootSnap]=useState(initialSnap);
 const [nestedSnap,setNestedSnap]=useState<MapSheetSnap>('half');
 const snap=nested?nestedSnap:rootSnap;
 const key=nested?contentKey:'overview';
 const [viewport,setViewport]=useState({height:800,inset:0,containerHeight:800,peekHeight:122,normalHeight:122});
 const reduced=useReducedMotion();
 const [ready,setReady]=useState(false);
 useEffect(()=>{const frame=requestAnimationFrame(()=>setReady(true));return()=>cancelAnimationFrame(frame);},[]);
 const [dragHeight,setDragHeight]=useState<number|null>(null);
 const drag=useRef<{pointer:number;y:number;height:number;snap:MapSheetSnap;moved:boolean}|null>(null);
 const skipClick=useRef(false);
 const suppressTouchClickUntil=useRef(0);
 useLayoutEffect(()=>{
  const v=window.visualViewport;
  const update=()=>{
   const headerHeight=host.current?.querySelector<HTMLElement>('[data-sheet-header]')?.offsetHeight||72;
   const navHeight=host.current?.querySelector<HTMLElement>('nav[aria-label="Circle sections"]')?.offsetHeight||48;
   const previewTarget=content.current?.querySelector<HTMLElement>('[data-testid="circle-member-preview"]')??content.current?.querySelector<HTMLElement>('[data-circle-section="members"]');
   const previewBottom=previewTarget&&content.current?previewTarget.getBoundingClientRect().bottom-content.current.getBoundingClientRect().top:0;
   const bottomPadding=host.current?parseFloat(getComputedStyle(host.current).paddingBottom)||0:0;
   setViewport({height:v?.height??window.innerHeight,inset:Math.max(0,window.innerHeight-(v?.height??window.innerHeight)-(v?.offsetTop??0)),containerHeight:host.current?.parentElement?.clientHeight||window.innerHeight,peekHeight:headerHeight+navHeight+bottomPadding+2,normalHeight:headerHeight+Math.max(navHeight,previewBottom)+bottomPadding+2});
  };
  update();window.addEventListener('resize',update);v?.addEventListener('resize',update);v?.addEventListener('scroll',update);
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(update):null;
  const mutation=typeof MutationObserver!=='undefined'?new MutationObserver(update):null;
  if(content.current){observer?.observe(content.current);mutation?.observe(content.current,{childList:true,subtree:true});}
  const header=host.current?.querySelector('[data-sheet-header]');if(header)observer?.observe(header);
  const member=content.current?.querySelector('[data-testid="circle-member-preview"]');if(member)observer?.observe(member);
  const section=content.current?.querySelector('[data-circle-section="members"]');if(section)observer?.observe(section);
  return()=>{mutation?.disconnect();observer?.disconnect();window.removeEventListener('resize',update);v?.removeEventListener('resize',update);v?.removeEventListener('scroll',update);};
 },[key,circleLoading,memberCount,children]);
 useLayoutEffect(()=>{
  const element=scroller.current;const saved=positions.current;
  pendingScroll.current=!nested&&rootSnap!=='full'?0:saved[key]??0;
  const restore=()=>{if(element&&pendingScroll.current!==null){element.scrollTop=pendingScroll.current;if(Math.abs(element.scrollTop-pendingScroll.current)<1)pendingScroll.current=null;}};
  restore();
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(restore):null;
  if(content.current)observer?.observe(content.current);
  if(element)observer?.observe(element);
  return()=>{observer?.disconnect();};
  // Snap changes are handled by `change`; restoring here on each snap would cancel section-nav scrolling.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key,nested]);
 useEffect(()=>{onSnapChange?.(snap);},[snap,onSnapChange]);
 const change=(next:MapSheetSnap)=>{
  if(!nested&&next!=='full'&&scroller.current){pendingScroll.current=null;scroller.current.scrollTop=0;}
  if(nested)setNestedSnap(next);else {setRootSnap(next);onViewStateChange?.({scrollTop:scroller.current?.scrollTop??0,snap:next});}
 };
 const usableHeight=Math.max(120,Math.min(viewport.height,viewport.containerHeight-viewport.inset));
 const collapsedHeight=Math.min(viewport.peekHeight,usableHeight);
 const expandedHeight=Math.round(usableHeight*.92);
 const normalHeight=Math.min(viewport.normalHeight,expandedHeight);
 const nestedHalfHeight=Math.round(usableHeight*.56);
 const minimumHeight=nested?nestedHalfHeight:collapsedHeight;
 const height=nested?(snap==='full'?expandedHeight:nestedHalfHeight):snap==='peek'?collapsedHeight:snap==='half'?normalHeight:expandedHeight;
 const startDrag=(event:PointerEvent<HTMLElement>)=>{
  skipClick.current=false;
  if(event.button!==0||(event.target as HTMLElement).closest('button:not([data-sheet-handle]),a,input,textarea,select'))return;
  drag.current={pointer:event.pointerId,y:event.clientY,height,snap,moved:false};
  const capture=(event.target as HTMLElement).closest<HTMLElement>('[data-sheet-handle]')??event.currentTarget;
  capture.setPointerCapture?.(event.pointerId);
 };
 const moveDrag=(event:PointerEvent<HTMLElement>)=>{
  const current=drag.current;if(!current||current.pointer!==event.pointerId)return;
  current.moved ||= Math.abs(event.clientY-current.y)>5;
  setDragHeight(Math.max(minimumHeight,Math.min(expandedHeight,current.height+current.y-event.clientY)));
 };
 const endDrag=(event:PointerEvent<HTMLElement>,cancelled=false)=>{
  const current=drag.current;if(!current||current.pointer!==event.pointerId)return;
  skipClick.current=!cancelled&&current.moved;
  if(!cancelled&&current.moved)change(dragSnap(current.snap,event.clientY-current.y,nested));
  drag.current=null;setDragHeight(null);
 };
 useEffect(()=>{
  const element=host.current;if(!element)return;
  let start:{y:number;height:number;snap:MapSheetSnap;moving:boolean}|null=null;
  const begin=(event:TouchEvent)=>{
   if(event.touches.length!==1||((nested||snap==='full')&&(scroller.current?.scrollTop??0)>0)||(event.target as HTMLElement).closest('[data-sheet-header],input,textarea,select'))return;
   suppressTouchClickUntil.current=0;
   start={y:event.touches[0].clientY,height,snap,moving:false};
  };
  const move=(event:TouchEvent)=>{
   if(!start||event.touches.length!==1)return;
   const distance=event.touches[0].clientY-start.y;
   if(!start.moving&&(Math.abs(distance)<=8||(snap==='full'&&distance<0)))return;
   start.moving=true;event.preventDefault();
   setDragHeight(Math.max(minimumHeight,Math.min(expandedHeight,start.height-distance)));
  };
  const finish=(event:TouchEvent)=>{
   if(start?.moving){
    suppressTouchClickUntil.current=performance.now()+500;
    const distance=(event.changedTouches[0]?.clientY??start.y)-start.y;
    change(dragSnap(start.snap,distance,nested));
   }
   start=null;setDragHeight(null);
  };
  const cancel=()=>{if(start?.moving)suppressTouchClickUntil.current=performance.now()+500;start=null;setDragHeight(null);};
  const wheel=(event:WheelEvent)=>{if(event.deltaY>0&&(nested?snap==='half':snap!=='full')){event.preventDefault();change(nested?'full':adjacentSnap(snap,'expand',false));}};
  element.addEventListener('wheel',wheel,{passive:false});
  element.addEventListener('touchstart',begin,{passive:true});element.addEventListener('touchmove',move,{passive:false});
  element.addEventListener('touchend',finish);element.addEventListener('touchcancel',cancel);
  return()=>{element.removeEventListener('wheel',wheel);element.removeEventListener('touchstart',begin);element.removeEventListener('touchmove',move);element.removeEventListener('touchend',finish);element.removeEventListener('touchcancel',cancel);};
  // Gesture listeners retain their starting height throughout each drag.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[height,minimumHeight,expandedHeight,nested,key,snap]);
 return <section ref={host} data-map-sheet data-snap={snap} onClickCapture={event=>{if(performance.now()<suppressTouchClickUntil.current&&(event.target as HTMLElement).closest('[data-sheet-scroll]')){event.preventDefault();event.stopPropagation();}}} aria-label="Circle map sheet" className="absolute inset-x-0 z-30 mx-auto flex max-w-2xl flex-col rounded-t-3xl border border-border bg-surface text-foreground shadow-xl" style={{bottom:viewport.inset,height:dragHeight??height,maxHeight:expandedHeight,transition:!ready||dragHeight!==null||reduced?'none':'height 240ms cubic-bezier(0.2, 0.8, 0.2, 1)'}}>
  {floatingActions&&snap!=='full'&&<div className="pointer-events-none absolute inset-x-3 bottom-full mb-3">{floatingActions}</div>}
  <div data-sheet-header className="shrink-0 cursor-grab select-none active:cursor-grabbing" style={{touchAction:'none'}} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={event=>endDrag(event)} onPointerCancel={event=>endDrag(event,true)} onClickCapture={event=>{if(skipClick.current){event.preventDefault();event.stopPropagation();skipClick.current=false;}}}>
  <div className="flex shrink-0 justify-center">
   <button data-sheet-handle type="button" aria-label={snap==='full'?'Collapse sheet':'Expand sheet'} aria-expanded={snap==='full'}
    onClick={()=>{if(skipClick.current){skipClick.current=false;return;}change(snap==='full'?adjacentSnap(snap,'collapse',nested):adjacentSnap(snap,'expand',nested));}}
    onKeyDown={event=>{if(event.key==='ArrowUp'){event.preventDefault();change(adjacentSnap(snap,'expand',nested));}else if(event.key==='ArrowDown'){event.preventDefault();change(adjacentSnap(snap,'collapse',nested));}else if(event.key==='Home'){event.preventDefault();change(nested?'half':'peek');}else if(event.key==='End'){event.preventDefault();change('full');}}}
    style={{touchAction:'none'}} className="flex min-h-11 min-w-20 cursor-grab items-center justify-center rounded-lg active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-accent"><span className="h-1 w-10 rounded-full bg-muted-foreground/50"/></button>
  </div>
  <div className="flex shrink-0 items-center gap-2 px-4 pb-2">
   {nested&&<button type="button" aria-label="Back" onClick={onBack} className="flex size-11 shrink-0 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-accent"><ArrowLeft className="size-4"/></button>}
   <p aria-busy={circleLoading} className="min-w-0 flex-1 truncate text-sm font-semibold">{circleLoading?'Loading Circle…':circleName??'Your Circle'} {!circleLoading&&<span className="ml-2 text-xs font-normal text-muted-foreground">{memberCount} {memberCount===1?'member':'members'}</span>}</p>
  </div>
  </div>
  <div data-sheet-scroll ref={scroller} tabIndex={0} style={{overflowY:nested||snap==='full'?'auto':'hidden'}} onClick={event=>{if(!nested&&snap!=='full'&&(event.target as HTMLElement).closest('nav[aria-label="Circle sections"]'))change('full');}} onWheel={()=>{pendingScroll.current=null;}} onTouchStart={()=>{pendingScroll.current=null;}} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(!nested&&snap!=='full'&&['ArrowDown','ArrowUp','PageDown','PageUp',' '].includes(event.key)){event.preventDefault();change(adjacentSnap(snap,'expand',false));}if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))pendingScroll.current=null;}} onScroll={event=>{if(pendingScroll.current!==null)return;positions.current[key]=event.currentTarget.scrollTop;if(!nested)onViewStateChange?.({scrollTop:event.currentTarget.scrollTop,snap:rootSnap});}} className="min-h-0 flex-1 overscroll-contain px-4 pb-4"><div ref={content}>{children}</div></div>
 </section>;
}
