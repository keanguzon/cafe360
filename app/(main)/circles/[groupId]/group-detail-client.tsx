"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { UserAvatar } from "@/components/ui/user-avatar";

import { useTransition } from "react";
import { useRouter } from "@/components/navigation/router";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { ArrowLeft, Calendar, LogOut, MapPin, Users } from "lucide-react";
import { InviteLink } from "@/components/social/invite-link";
import { GroupSavedCafesList } from "@/components/social/group-saved-cafes";
import { leaveGroupAction } from "@/lib/actions/group-actions";
import { useCircle } from "@/lib/context/circle-context";
import type { GroupSavedCafe, GroupWithMembers } from "@/lib/types/social";
import { toast } from "sonner";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";
import { useCircleData } from "@/lib/hooks/use-circle-data";

import { sheetHref, type SheetRoute } from "@/lib/navigation/sheet-routes";

type GroupDetailClientProps = {
  presentation?: "sheet" | "page";
  onOpen?: (route: SheetRoute) => void;
  onBack?: () => void;
  group: GroupWithMembers;
  saves: GroupSavedCafe[];
};

export function GroupDetailClient({ group, saves, presentation = "page", onOpen, onBack }: GroupDetailClientProps) {
  const online = useOnlineStatus();
  const router = useRouter();
  const { accountId, refreshMemberships, setActiveCircleId, evictMembership, userCircles, membershipsResolved } = useCircle();
  const membership = userCircles.find((circle) => circle.id === group.id);
  const snapshot = useCircleData(accountId, membership ? group.id : null);
  const [isPending, startTransition] = useTransition();

  const handleLeave = () => {
    if (!isOnline()) { toast.error(OFFLINE_MUTATION_MESSAGE); return; }
    if (!confirm("Leave this group?")) return;
    startTransition(async () => {
      try {
        const result = await leaveGroupAction(group.id);
        if (!result.success) { toast.error(result.error || "Could not leave group. Please retry."); return; }
        evictMembership(group.id);
        await refreshMemberships().catch(() => undefined);
        if(presentation === "sheet" && onOpen) onOpen({kind:"circles",root:"nearby"}); else router.push("/circles");
      } catch {
        toast.error("Could not leave group. Please retry.");
      }
    });
  };

  if (!membershipsResolved) return <p role="status">Loading Circle…</p>;
  if (!membership || snapshot.accessRevoked) return <p role="status">This Circle is no longer available.</p>;

  const useInitialData = !snapshot.hasData && !snapshot.accessRevoked;
  const members = useInitialData ? group.members.map((member) => ({
    userId: member.user_id, displayName: member.profile?.display_name || "Member", avatarUrl: member.profile?.avatar_url ?? null, role: member.role,
  })) : snapshot.members;
  const visibleSaves = useInitialData ? saves : snapshot.savedCafes;
  const memberCount = snapshot.hasData ? members.length : membership.member_count;

  const initial = group.name.charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-28 sm:px-6 sm:pb-6">
      <ActionFeedback pending={isPending} operationKey={`leave-circle:${accountId}:${group.id}`} label="Leaving Circle…" />
      {presentation === "page" && <Link href="/map" className="mb-4 inline-flex min-h-11 items-center">Return to map</Link>}
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/circles"
          aria-label="Back to Circles"
          onClick={e=>{if(presentation === "sheet" && onBack){e.preventDefault();onBack();}}}
          className="flex size-11 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">{group.name}</h1>
          {group.description && (
            <p className="text-xs text-muted-foreground truncate">{group.description}</p>
          )}
        </div>
        <button
          onClick={handleLeave}
          disabled={!online || isPending}
          className="flex size-11 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50 cursor-pointer"
          aria-label="Leave group"
        >
          <LogOut className="size-4" />
        </button>
      </div>

      {!online && <p role="status" className="mb-4 text-xs text-muted-foreground">{OFFLINE_MUTATION_MESSAGE}</p>}
      {/* Group avatar + member count */}
      <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6">
        <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5 text-2xl font-bold text-accent">
          {initial}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" />
          <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/map"
            onClick={e => {setActiveCircleId(group.id);if(presentation === "sheet" && onOpen && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey){e.preventDefault();onOpen({kind:"nearby",root:"nearby"});}}}
            className="flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90 cursor-pointer"
          >
            <MapPin className="size-3.5" />
            <span>Open Map</span>
          </Link>
          <Link
            href={`/circles/${encodeURIComponent(group.id)}/timeline?view=memories`}
            onClick={e=>{if(presentation === "sheet" && onOpen && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey){e.preventDefault();onOpen({kind:"memories",root:"nearby",circleId:group.id,entityId:group.id});}}}
            className="flex h-10 items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 text-xs font-medium text-accent transition-colors hover:bg-accent/20 cursor-pointer"
          >
            <Calendar className="size-3.5" />
            <span>Memories</span>
          </Link>
        </div>
      </div>

      {/* Invite Link */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Invite Link</h2>
        <InviteLink inviteCode={group.invite_code} />
      </section>

      {/* Members */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Members</h2>
        <div className="space-y-2">
          {members.map((member) => {
            const username = group.members.find((initialMember) => initialMember.user_id === member.userId)?.profile?.username;
            const initials = member.displayName
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "??";

            return (
              <div key={member.userId} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                <UserAvatar src={member.avatarUrl} name={member.displayName} fallback={initials} className="size-9 font-semibold"/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{member.displayName}</p>
                  {username && <p className="text-xs text-muted-foreground">@{username}</p>}
                </div>
                <Link href={member.userId === accountId ? "/profile" : sheetHref({kind:"member",root:"nearby",entityId:member.userId,circleId:group.id})} className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground">Profile</Link>
                <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                  {member.role}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Group Saved Cafés */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Group Cafés</h2>
        <GroupSavedCafesList saves={visibleSaves} />
      </section>
    </div>
  );
}
