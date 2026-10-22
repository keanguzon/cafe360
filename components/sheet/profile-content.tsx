"use client";
import { ReadFeedback } from "@/components/ui/read-feedback";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { useRouter } from "@/components/navigation/router";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { readSheetProfileAction } from "@/lib/actions/sheet-read-actions";
import { useSheetResource, unwrapSheetRead } from "@/lib/hooks/use-sheet-resource";
import { useCircle } from "@/lib/context/circle-context";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { HttpResponseError } from "@/components/providers/swr-provider";
import type { Profile } from "@/lib/types/profile";
import type { SheetRoute } from "@/lib/navigation/sheet-routes";
export type SheetContentProps = {
    presentation: "sheet" | "page";
    accountId: string;
    circleId?: string;
    onOpen(route: SheetRoute): void;
    onBack(): void;
};
export function ProfileContent({ accountId, userId, circleId, presentation, onOpen, onBack, active = true, initialProfile, preview = false, edit = false, onDirtyChange }: SheetContentProps & {
    userId?: string;
    active?: boolean;
    initialProfile?: Profile;
    preview?: boolean;
    edit?: boolean;
    onDirtyChange?(dirty: boolean): void;
}) {
    const circle = useCircle();
    const own = !userId || userId === accountId;
    const isPreview = preview || (!hasSupabaseConfig() && own);
    const previewProfile: Profile = initialProfile ?? { id: accountId, username: "cafe_explorer", display_name: "Coffee Explorer", avatar_url: null, bio: "Preview profile", created_at: "2026-01-01", updated_at: "2026-01-01" };
    const allowed = circle.accountId === accountId && (own || (!!circleId && circle.membershipsResolved && circle.activeCircle?.id === circleId && circle.userCircles.some(c => c.id === circleId)));
    const resource = useSheetResource<Profile>(!isPreview && allowed ? ["sheet-profile", accountId, circleId ?? "", userId ?? accountId] : null, async () => unwrapSheetRead(await readSheetProfileAction({ expectedAccountId: accountId, userId, circleId })), active);
    const denied = resource.error instanceof HttpResponseError && (resource.error.status === 401 || resource.error.status === 403);
    const profile = isPreview ? previewProfile : allowed && !denied ? resource.data ?? initialProfile : undefined;
    if (!profile)
        return allowed ? <ReadFeedback pending={active && resource.initialLoading} error={resource.error} operationKey={`profile:${accountId}:${circleId ?? ""}:${userId ?? accountId}`} label="Loading profile…" retry={resource.refresh} className="p-6"/> : <p role="status" className="p-6">This Circle profile is unavailable.</p>;
    return <div className="mx-auto max-w-4xl space-y-8 px-4 pt-6 pb-28 sm:px-6 sm:py-10">
    {presentation === "page" && <Link href="/map" className="inline-flex min-h-11 items-center text-sm font-medium">Return to map</Link>}
    {isPreview && <p role="status" className="text-sm text-muted-foreground">Preview profile — connect an account to save changes.</p>}
    {presentation === "sheet" && <button onClick={onBack} className="min-h-11 text-sm font-medium">Back</button>}
    {own && <div className="flex justify-end"><Link href="/settings" onClick={e => { if (presentation === "sheet" && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onOpen({ kind: "settings", root: "you" });
    } }} className="min-h-11 inline-flex items-center" aria-label="Settings">Settings</Link></div>}
    <section className="rounded-xl border border-border bg-surface/50 p-6 sm:p-8 backdrop-blur-xs"><ProfileHeader profile={profile} isOwnProfile={own}/></section>
    {own && (presentation === "page" || edit ? <ProfileEditForm profile={profile} onDirtyChange={onDirtyChange}/> : <button onClick={() => onOpen({ kind: "you", root: "you", edit: true })} className="min-h-11 rounded-lg border border-border px-4">Edit profile</button>)}
  </div>;
}
export function StandaloneProfileContent(props: {
    accountId: string;
    userId?: string;
    circleId?: string;
    initialProfile?: Profile;
    preview?: boolean;
    edit?: boolean;
}) {
    const router = useRouter();
    return <ProfileContent {...props} presentation="page" onOpen={route => { void import("@/lib/navigation/sheet-routes").then(({ sheetHref }) => router.push(sheetHref(route))); }} onBack={() => router.push("/map")}/>;
}
