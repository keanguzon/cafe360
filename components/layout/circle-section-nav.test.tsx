// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CircleSectionNav } from "./circle-section-nav";

it("scrolls inside the sheet and tracks manually scrolled sections", () => {
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const element=document.createElement('div');document.body.append(element);const root=createRoot(element);
  act(()=>root.render(<div data-sheet-scroll><CircleSectionNav/><section data-circle-section="members"/><section data-circle-section="cafes"/><section data-circle-section="activity"/><section data-circle-section="memories"/></div>));
  const scroll=element.querySelector<HTMLElement>('[data-sheet-scroll]')!;
  const nav=element.querySelector('nav')!;const sections=[...element.querySelectorAll('section')];
  nav.getBoundingClientRect=()=>({bottom:44,top:0,height:44} as DOMRect);
  scroll.getBoundingClientRect=()=>({top:0} as DOMRect);
  sections.forEach((section,index)=>{section.getBoundingClientRect=()=>({top:44+index*200-scroll.scrollTop} as DOMRect);});
  scroll.scrollTo=vi.fn();
  act(()=>element.querySelectorAll<HTMLButtonElement>('nav button')[2].click());
  expect(scroll.scrollTo).toHaveBeenCalledWith({top:400,behavior:'smooth'});
  scroll.scrollTop=220;act(()=>scroll.dispatchEvent(new Event('scroll')));
  expect(element.querySelector('button[aria-current="location"]')?.textContent).toBe('Cafés');
  scroll.scrollTop=620;act(()=>scroll.dispatchEvent(new Event('scroll')));
  expect(element.querySelector('button[aria-current="location"]')?.textContent).toBe('Memories');
  act(()=>root.unmount());element.remove();
});
