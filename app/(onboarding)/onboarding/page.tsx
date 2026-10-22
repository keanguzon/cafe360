"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { ReadFeedback } from "@/components/ui/read-feedback";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "@/components/navigation/router";
import { createGroupAction, joinGroupViaInviteAction } from "@/lib/actions/group-actions";
import { checkUsernameSetAction, setUsernameAction } from "@/lib/actions/username-actions";
import { CircleInviteModal } from "@/components/social/circle-invite-modal";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, ArrowRight, UserCheck } from "lucide-react";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";

export default function OnboardingPage() {
  const online = useOnlineStatus();
  const router = useRouter();
  const navigate = router.push;
  const [step, setStep] = useState<"profile" | "circle">("profile");
  const [tab, setTab] = useState<"create" | "join">("create");
  const [isPending, startTransition] = useTransition();
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [profileCheckError, setProfileCheckError] = useState<string | null>(null);
  const [profileRetry, setProfileRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Profile setup states
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);

  // Circle states
  const [circleName, setCircleName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  // Created circle for post-create invite modal
  const [createdCircle, setCreatedCircle] = useState<{
    name: string;
    inviteCode: string;
    groupId: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const candidate = new URLSearchParams(window.location.search).get('invite')?.trim().toUpperCase();
    const invite = candidate && /^[A-Z0-9]{6}$/.test(candidate) ? candidate : null;
    checkUsernameSetAction().then((res) => {
      if (!isMounted) return;
      if (res.error) {
        setProfileCheckError(res.error);
        setIsCheckingProfile(false);
        return;
      }
      setPendingInvite(invite);
      if (invite && res.hasUsername) {
        navigate(`/invite/${invite}`);
        return;
      }
      if (res.displayName) setDisplayName(res.displayName);
      if (res.username) setUsername(res.username);
      setIsCheckingProfile(false);
    }).catch(() => {
      if (isMounted) {
        setProfileCheckError('Could not load your profile. Please try again.');
        setIsCheckingProfile(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [navigate, profileRetry]);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    if (!isOnline()) { setError(OFFLINE_MUTATION_MESSAGE); return; }
    setError(null);
    startTransition(async () => {
      try {
        const res = await setUsernameAction({ displayName, username });
        if (res.success) {
          if (pendingInvite) router.push(`/invite/${pendingInvite}`);
          else setStep("circle");
        } else {
          setError(res.error || "Failed to update profile");
        }
      } catch {
        setError("Could not update profile. Please reconnect and retry.");
      }
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    if (!isOnline()) { setError(OFFLINE_MUTATION_MESSAGE); return; }
    setError(null);
    startTransition(async () => {
      try {
        const result = await createGroupAction({ name: circleName, description: "" });
        if (result.success && result.groupId) {
          if (typeof window !== "undefined") {
            localStorage.setItem("cafe360_active_circle_id", result.groupId);
          }
          // Open the invite modal so user gets their code immediately
          setCreatedCircle({
            name: circleName,
            inviteCode: result.inviteCode || "ABCDEF",
            groupId: result.groupId,
          });
        } else {
          setError(result.error || "Failed to create circle");
        }
      } catch {
        setError("Could not create circle. Please reconnect and retry.");
      }
    });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    if (!isOnline()) { setError(OFFLINE_MUTATION_MESSAGE); return; }
    setError(null);
    startTransition(async () => {
      try {
        const result = await joinGroupViaInviteAction(inviteCode);
        if (result.success && result.groupId) {
          if (typeof window !== "undefined") {
            localStorage.setItem("cafe360_active_circle_id", result.groupId);
          }
          router.push("/map");
          router.refresh();
        } else {
          setError(result.error || "Failed to join circle");
        }
      } catch {
        setError("Could not join circle. Please reconnect and retry.");
      }
    });
  };

  const handleDismissInviteModal = () => {
    setCreatedCircle(null);
    router.push("/map");
    router.refresh();
  };

  if (profileCheckError) {
    return <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-12">
      <p role="alert" className="text-sm text-foreground">{profileCheckError}</p>
      <Button onClick={() => {setProfileCheckError(null);setIsCheckingProfile(true);setProfileRetry(value => value + 1);}} disabled={!online}>Try again</Button>
    </div>;
  }

  if (isCheckingProfile) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center flex-1 px-4 py-12">
        <ReadFeedback pending operationKey={`onboarding-profile:${profileRetry}`} label="Checking profile…" retry={() => setProfileRetry(value => value + 1)} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center flex-1 px-4 py-12">
      {!online && <p role="status" className="mb-4 text-xs text-muted-foreground">{OFFLINE_MUTATION_MESSAGE}</p>}
      {/* Progress pill indicator */}
      <div className="flex items-center gap-2 mb-8 bg-surface-elevated/70 border border-border/80 px-3.5 py-1.5 rounded-full text-xs font-semibold text-muted-foreground">
        <span
          className={`flex items-center gap-1.5 ${
            step === "profile" ? "text-accent font-bold" : "text-foreground"
          }`}
        >
          <span className="flex size-4 items-center justify-center rounded-full bg-accent/20 text-[10px]">
            1
          </span>
          Profile
        </span>
        <span className="text-border">/</span>
        <span
          className={`flex items-center gap-1.5 ${
            step === "circle" ? "text-accent font-bold" : "text-muted-foreground"
          }`}
        >
          <span className="flex size-4 items-center justify-center rounded-full bg-accent/20 text-[10px]">
            2
          </span>
          Circle
        </span>
      </div>

      {step === "profile" ? (
        /* STEP 1: Set Username & Display Name */
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="w-full text-center space-y-2 mb-6">
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              What should we call you?
            </h1>
            <p className="text-muted-foreground text-sm">
              Set your display name and unique handle so your friends recognize you on the map.
            </p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="displayName"
                className="text-xs font-medium text-muted-foreground"
              >
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Mika Santos"
                maxLength={80}
                required
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="text-xs font-medium text-muted-foreground"
              >
                Username / Handle
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-sm font-semibold text-muted-foreground">
                  @
                </span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, "")
                        .slice(0, 24)
                    )
                  }
                  placeholder="mika_santos"
                  minLength={3}
                  maxLength={24}
                  required
                  className="w-full rounded-xl border border-border bg-background pl-8 pr-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                3–24 characters: letters, numbers, or underscores.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-xs text-red-400 font-medium">{error}</p>
            )}

            <Button
              type="submit"
              variant="pill"
              size="lg"
              className="w-full gap-2 mt-4"
              disabled={!online || isPending || !displayName.trim() || !username.trim()}
            >
              <UserCheck className="size-4" />
              {isPending ? "Saving Profile..." : "Continue"}
              {!isPending && <ArrowRight className="size-4 ml-1" />}
            </Button>
          <ActionFeedback pending={isPending} operationKey={`onboarding:${step}:${tab}`} label="Saving…" />
      </form>
        </div>
      ) : (
        /* STEP 2: Create or Join Circle */
        <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="w-full text-center space-y-3 mb-8">
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              You&apos;re flying solo.
            </h1>
            <p className="text-muted-foreground text-sm">
              Cafe360 is built for circles. Join or create a circle to access the map and discover cafés together.
            </p>
          </div>

          <div className="w-full bg-surface/50 border border-border rounded-2xl p-1.5 mb-6 flex gap-1.5">
            <button
              onClick={() => {
                setTab("create");
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                tab === "create"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create Circle
            </button>
            <button
              onClick={() => {
                setTab("join");
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                tab === "join"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Join Circle
            </button>
          </div>

          {tab === "create" ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="group-name"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Circle Name
                </label>
                <input
                  id="group-name"
                  type="text"
                  value={circleName}
                  onChange={(e) => setCircleName(e.target.value)}
                  placeholder="e.g. Coffee Crawl Crew"
                  maxLength={100}
                  required
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
              </div>
              {error && (
                <p role="alert" className="text-xs text-red-400 font-medium">{error}</p>
              )}
              <Button
                type="submit"
                variant="pill"
                size="lg"
                className="w-full gap-2 mt-4"
                disabled={!online || isPending || !circleName.trim()}
              >
                <Users className="size-4" />
                {isPending ? "Creating..." : "Create Circle"}
              </Button>
            <ActionFeedback pending={isPending} operationKey={`onboarding:${step}:${tab}`} label="Saving…" />
      </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="invite-code"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Invite Code
                </label>
                <input
                  id="invite-code"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter the 6-character code"
                  maxLength={12}
                  required
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base font-mono uppercase tracking-widest text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
              </div>
              {error && (
                <p role="alert" className="text-xs text-red-400 font-medium">{error}</p>
              )}
              <Button
                type="submit"
                variant="pill"
                size="lg"
                className="w-full gap-2 mt-4"
                disabled={!online || isPending || !inviteCode.trim()}
              >
                <UserPlus className="size-4" />
                {isPending ? "Joining..." : "Join Circle"}
              </Button>
            <ActionFeedback pending={isPending} operationKey={`onboarding:${step}:${tab}`} label="Saving…" />
      </form>
          )}

          <div className="text-center mt-6">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep("profile");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              ← Edit Profile Details
            </button>
          </div>
        </div>
      )}

      {/* Post-Create Invite Code Modal */}
      {createdCircle && (
        <CircleInviteModal
          isOpen={true}
          circleName={createdCircle.name}
          inviteCode={createdCircle.inviteCode}
          onDismiss={handleDismissInviteModal}
        />
      )}
    </div>
  );
}
