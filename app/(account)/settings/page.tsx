"use client";
import { useRouter } from "@/components/navigation/router";
import { SettingsContent } from "@/components/sheet/settings-content";
import { useCircle } from "@/lib/context/circle-context";
import { sheetHref } from "@/lib/navigation/sheet-routes";

export default function SettingsPage() {
  const router = useRouter();
  const { accountId, userCircles, membershipsResolved } = useCircle();
  const returnHref = membershipsResolved && userCircles.length === 0 ? "/onboarding" : "/map";
  return (
    <SettingsContent
      presentation="page"
      accountId={accountId}
      returnHref={returnHref}
      onOpen={route => router.push(sheetHref(route))}
      onBack={() => router.push(returnHref)}
    />
  );
}
