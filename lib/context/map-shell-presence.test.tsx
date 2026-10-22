// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { MapShellPresenceProvider, MapShellMount, useMapShellPresence } from './map-shell-presence';
let root: Root; let container: HTMLDivElement;
function Nav(){const {active}=useMapShellPresence();return <p>{active?'shell':'standalone'}</p>;}
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();});
it('retains presence through shell children changes and cleans up on departure',()=>{
 function Frame({shell,label}:{shell:boolean;label:string}){return <MapShellPresenceProvider><Nav/>{shell&&<MapShellMount><p>{label}</p></MapShellMount>}</MapShellPresenceProvider>;}
 act(()=>root.render(<Frame shell label="Nearby"/>));expect(container.textContent).toBe('shellNearby');
 act(()=>root.render(<Frame shell label="Saved"/>));expect(container.textContent).toBe('shellSaved');
 act(()=>root.render(<Frame shell={false} label=""/>));expect(container.textContent).toBe('standalone');
});
