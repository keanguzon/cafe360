import { StandaloneCafeContent } from "@/components/sheet/cafe-content";
export default async function Page({params,searchParams}:{params:Promise<{cafeId:string;segments?:string[]}>;searchParams:Promise<{circle?:string|string[]}>}) {
 const route=await params;const search=await searchParams;
 const circleId=typeof search.circle==="string"?search.circle:undefined;
 if(route.segments && (route.segments.length!==1 || !["memories","visit"].includes(route.segments[0]))) return <p>This café view is unavailable.</p>;
 return <StandaloneCafeContent cafeId={route.cafeId} circleId={circleId} view={route.segments?.[0]==="visit"?"visit":route.segments?.[0]==="memories"?"cafe-memories":"cafe"}/>;
}
