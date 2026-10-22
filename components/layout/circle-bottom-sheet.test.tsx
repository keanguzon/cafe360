// @vitest-environment jsdom
import {act} from "react";
import {createRoot} from "react-dom/client";
import {afterEach,expect,it,vi} from "vitest";
import {CircleBottomSheet} from "./circle-bottom-sheet";
const m=vi.hoisted(()=>({circle:'circle / one'}));
vi.mock('@/lib/context/circle-context',()=>({useCircle:()=>({accountId:'self',activeCircle:m.circle?{id:m.circle,name:'Circle'}:null,circleMembers:[{userId:'self',displayName:'Self',role:'owner'},{userId:'member / two',displayName:'Other',role:'member'}]})}));
vi.mock('@/components/social/activity-feed',()=>({ActivityFeed:()=>null}));
let clean=()=>{};afterEach(()=>{clean();m.circle='circle / one';});
function render(){Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const node=document.createElement('div');const root=createRoot(node);clean=()=>act(()=>root.unmount());act(()=>root.render(<CircleBottomSheet/>));return node;}
it('routes self to the own profile and other members to the encoded Circle profile',()=>{const node=render();const profiles=Array.from(node.querySelectorAll('a')).filter(link=>link.textContent==='Profile');expect(profiles.map(link=>link.getAttribute('href'))).toEqual(['/profile','/profile/member%20%2F%20two?circle=circle+%2F+one']);});
it('does not expose member profile links without a selected Circle',()=>{m.circle='';const node=render();expect(Array.from(node.querySelectorAll('a')).filter(link=>link.textContent==='Profile')).toHaveLength(0);});
