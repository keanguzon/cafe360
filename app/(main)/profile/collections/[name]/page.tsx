import type { Metadata } from "next";
import { CollectionView } from "@/components/cafe/collection-view";

type PageProps = {
  params: Promise<{ name: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  return {
    title: `${decodedName} Collection — Cafe360`,
    description: `Browse saved cafés in your ${decodedName} collection.`,
  };
}

export default async function CollectionDetailPage({ params }: PageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  return (
    <CollectionView collectionName={decodedName} />
  );
}
