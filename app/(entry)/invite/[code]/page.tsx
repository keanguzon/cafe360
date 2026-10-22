"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { ReadFeedback } from "@/components/ui/read-feedback";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "@/components/navigation/router";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { Coffee, Users } from "lucide-react";
import { joinGroupViaInviteAction, getGroupByInviteCodeAction, getUserGroupsAction } from "@/lib/actions/group-actions";
import { use } from "react";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";
import { checkUsernameSetAction } from "@/lib/actions/username-actions";
import { inviteSetupPath } from "@/lib/auth/profile-setup";

export default function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const online = useOnlineStatus();
  const router = useRouter();
  const navigate = router.push;
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ code: string; info: { name: string; member_count?: number } | null; joinedId?: string; failed?: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const current = preview?.code === code ? preview : null;
  const circleInfo = current?.info;
  const joinedId = current?.joinedId;
  const isLoadingPreview = !current;
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;
    Promise.all([getGroupByInviteCodeAction(code), getUserGroupsAction(), checkUsernameSetAction()]).then(([info, groups, profile]) => {
      if (isMounted) {
        if (profile.error) {
          setPreview({code, info:null, failed:true});
          return;
        }
        if (!profile.hasUsername) {
          navigate(inviteSetupPath(code));
          return;
        }
        const joined = groups.find(group => group.invite_code === code.trim().toUpperCase());
        setPreview({ code, info: info ?? (joined ? { name: joined.name, member_count: joined.member_count } : null), joinedId: joined?.id, failed: !info && !joined });
      }
    }).catch(() => {
      if (isMounted) setPreview({ code, info: null, failed: true });
    });
    return () => {
      isMounted = false;
    };
  }, [code, retry, navigate]);

  const handleJoin = () => {
    if (isPending || !circleInfo || joinedId || isLoadingPreview || current?.failed) return;
    if (!isOnline()) { setError(OFFLINE_MUTATION_MESSAGE); return; }
    setError(null);
    startTransition(async () => {
      try {
        const result = await joinGroupViaInviteAction(code);
        if (result.requiresProfileSetup) {
          router.push(inviteSetupPath(code));
        } else if (result.success && result.groupId) {
          router.push(`/circles/${encodeURIComponent(result.groupId)}`);
        } else {
          setError(result.error || "Failed to join group");
        }
      } catch {
        setError("Could not join circle. Please reconnect and retry.");
      }
    });
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-border/80 bg-surface p-8 text-center shadow-2xl backdrop-blur-md">
      <ActionFeedback pending={isPending} operationKey={`join-invite:${code}`} label="Joining Circle…" />
      <ReadFeedback pending={isLoadingPreview} operationKey={`invite-preview:${code}:${retry}`} label="Loading Circle…" retry={() => setRetry(value => value + 1)} />
        <div className="flex size-16 items-center justify-center rounded-full bg-accent/20 text-accent font-bold text-xl">
          {circleInfo?.name ? circleInfo.name.substring(0, 2).toUpperCase() : <Users className="size-7" />}
        </div>
        
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">
            {isLoadingPreview ? (
              <span className="flex items-center justify-center gap-2">
                <span aria-hidden="true">…</span> Loading circle...
              </span>
            ) : circleInfo ? (
              <>{joinedId ? "Open" : "Join"} &quot;{circleInfo.name}&quot;</>
            ) : (
              <>You&apos;ve been invited!</>
            )}
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {joinedId ? "You're already a member of this Circle." : circleInfo
              ? `Join this circle on Cafe360 to explore cafés and share visits, ratings, and memories.`
              : `Join this Cafe360 circle (Code: ${code.toUpperCase()}) to explore cafés together.`}
          </p>
        </div>

        {!online && <p role="status" className="text-xs text-muted-foreground">{OFFLINE_MUTATION_MESSAGE}</p>}
        {current?.failed && <div className="text-sm">
          <p role="alert">Could not load this invite. Please try again.</p>
          <button type="button" className="min-h-11 text-sm font-medium underline" onClick={() => { setPreview(null); setRetry(value => value + 1); }}>Try again</button>
        </div>}
        {error && (
          <div role="alert" className="w-full rounded-xl bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-400 font-medium">
            {error}
          </div>
        )}

        {joinedId ? <Link href={`/circles/${encodeURIComponent(joinedId)}`} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-semibold text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">Open Circle</Link> : <button
          onClick={handleJoin}
          disabled={!online || isPending || isLoadingPreview || !circleInfo || current?.failed}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-semibold text-accent-foreground shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {isPending ? (
            <>
              <span aria-hidden="true">…</span>
              <span>Joining Circle...</span>
            </>
          ) : (
            <>
              <Coffee className="size-4" />
              <span>Join Circle</span>
            </>
          )}
        </button>}
      </div>
    </div>
  );
}

