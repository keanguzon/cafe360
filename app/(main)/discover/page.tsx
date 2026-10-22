import DiscoverPage from "@/components/discover/discover-page";
import { NearbyFromMap } from "@/components/discover/nearby-results";

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return from === "map" ? <NearbyFromMap /> : <DiscoverPage />;
}
