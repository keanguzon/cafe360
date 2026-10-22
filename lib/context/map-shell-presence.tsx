"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
const Presence = createContext({active:false,register:()=>()=>{}});
export function MapShellPresenceProvider({children}:{children:ReactNode}){
 const [count,setCount]=useState(0);
 const register=useCallback(()=>{setCount(value=>value+1);let released=false;return()=>{if(!released){released=true;setCount(value=>Math.max(0,value-1));}};},[]);
 const value=useMemo(()=>({active:count>0,register}),[count,register]);
 return <Presence.Provider value={value}>{children}</Presence.Provider>;
}
export function useMapShellPresence(){return useContext(Presence);}
export function MapShellMount({children}:{children:ReactNode}){const {register}=useMapShellPresence();useEffect(()=>register(),[register]);return children;}
