import { StandaloneMemoryContent } from "@/components/sheet/memory-content";
export default async function Page({params,searchParams}:{params:Promise<{visitId:string;segments?:string[]}>;searchParams:Promise<{circle?:string|string[]}>}) {
 const route=await params;const search=await searchParams;
 const circleId=typeof search.circle==="string"?search.circle:undefined;
 
 return <StandaloneMemoryContent visitId={route.visitId} circleId={circleId}/>;
}
