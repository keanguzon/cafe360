// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CafeCard } from "./cafe-card";
vi.mock('./save-button',()=>({SaveButton:()=> <button>Save café</button>}));
it('opens details from the keyboard without activating nested save controls',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const node=document.createElement('div');const root=createRoot(node);const open=vi.fn();
 act(()=>root.render(<CafeCard cafe={{id:'a',name:'Coffee',address:'Here',coordinates:[1,2]}} onSelect={open}/>));
 const card=node.querySelector<HTMLElement>('[tabindex="0"]');expect(card).not.toBeNull();
 act(()=>card!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));expect(open).toHaveBeenCalledTimes(1);
 act(()=>node.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));expect(open).toHaveBeenCalledTimes(1);
 act(()=>root.unmount());
});
