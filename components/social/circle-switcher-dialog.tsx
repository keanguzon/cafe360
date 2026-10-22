"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { ReadFeedback } from "@/components/ui/read-feedback";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCircle } from "@/lib/context/circle-context";
import { Check, Copy, Plus, UserPlus, X, Trash2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { createGroupAction, joinGroupViaInviteAction, leaveGroupAction, deleteGroupAction } from "@/lib/actions/group-actions";
import { CircleInviteModal } from "./circle-invite-modal";
import { ModalFocusScope, useModalFocus } from "@/lib/hooks/use-modal-focus";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";

interface CircleSwitcherDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CircleSwitcherDialog({ isOpen, onClose }: CircleSwitcherDialogProps) {
  const online = useOnlineStatus();
  const titleId = useId();
  const { ref: dialogRef, scopeId, layer } = useModalFocus<HTMLDivElement>(isOpen, onClose);
  const { accountId, userCircles, activeCircle, setActiveCircleId, refreshMemberships, evictMembership, error: circlesError, isLoading } = useCircle();
  const [tab, setTab] = useState<"list" | "create" | "join">("list");
  const [newCircleName, setNewCircleName] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const [actionCircleId, setActionCircleId] = useState<string | null>(null);
  const [retryingMemberships, setRetryingMemberships] = useState(false);
  const [committed, setCommitted] = useState<{ kind: "create" | "join"; groupId: string; inviteCode?: string } | null>(null);
  const [createdCircleInfo, setCreatedCircleInfo] = useState<{
    name: string;
    inviteCode: string;
  } | null>(null);

  const handleCopyLink = async (circleName: string, code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (copying) return;
    setCopying(code);
    const url = `${window.location.origin}/invite/${code}`;
    const text = [
      `☕ Join my circle "${circleName}" on Cafe360!`,
      ``,
      `🔑 Invite Code: ${code}`,
      `🔗 Direct Link: ${url}`,
      ``,
      `Let's explore cafés and share coffee memories together!`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Invite link & code for "${circleName}" copied to clipboard!`);
    } catch {
      toast.error("Could not copy the invite. Please try again.");
    } finally { setCopying(null); }
  };

  const handleAction = async (circleId: string, role: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSubmitting) return;
    if (!isOnline()) { toast.error(OFFLINE_MUTATION_MESSAGE); return; }
    
    if (role === "owner") {
      if (!confirm("Are you sure you want to delete this circle? This action cannot be undone.")) return;
    } else {
      if (!confirm("Are you sure you want to leave this circle?")) return;
    }

    setIsSubmitting(true);
    setActionCircleId(circleId);
    try {
      const res = role === "owner" 
        ? await deleteGroupAction(circleId)
        : await leaveGroupAction(circleId);
        
      if (res.success) {
        evictMembership(circleId);
        toast.success(role === "owner" ? "Circle deleted" : "Left circle");
        await refreshMemberships();
      } else {
        toast.error(res.error || "Action failed");
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not refresh circles");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!isOnline()) { setError(OFFLINE_MUTATION_MESSAGE); return; }
    if (!newCircleName.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = committed?.kind === "create"
        ? { success: true, groupId: committed.groupId, inviteCode: committed.inviteCode }
        : await createGroupAction({ name: newCircleName.trim() });
      if (res.success && res.groupId) {
        setCommitted({ kind: "create", groupId: res.groupId, inviteCode: res.inviteCode });
        toast.success(`Circle "${newCircleName}" created!`);
        const fresh = await refreshMemberships();
        if (!fresh.some((circle) => circle.id === res.groupId)) throw new Error("Created circle is not in your memberships yet");
        setActiveCircleId(res.groupId);
        setCommitted(null);
        setCreatedCircleInfo({
          name: newCircleName.trim(),
          inviteCode: res.inviteCode || "ABCDEF",
        });
        setNewCircleName("");
        setTab("list");
      } else {
        setError(res.error || "Failed to create circle");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not refresh circles");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!isOnline()) { setError(OFFLINE_MUTATION_MESSAGE); return; }
    if (!inviteCodeInput.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = committed?.kind === "join"
        ? { success: true, groupId: committed.groupId }
        : await joinGroupViaInviteAction(inviteCodeInput.trim());
      if (res.success && res.groupId) {
        setCommitted({ kind: "join", groupId: res.groupId });
        toast.success("Joined circle successfully!");
        const fresh = await refreshMemberships();
        if (!fresh.some((circle) => circle.id === res.groupId)) throw new Error("Joined circle is not in your memberships yet");
        setActiveCircleId(res.groupId);
        setCommitted(null);
        setInviteCodeInput("");
        setTab("list");
        onClose();
      } else {
        setError(res.error || "Invalid invite code");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not refresh circles");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-md bg-surface border border-border/80 rounded-3xl p-6 shadow-2xl space-y-5"
          >
        <div className="flex items-center justify-between">
          <div>
            <h2 id={titleId} className="text-xl font-display font-bold text-foreground">
              {tab === "list" ? "Your Circles" : tab === "create" ? "Create New Circle" : "Join a Circle"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {tab === "list" ? "Switch Circle to view shared cafés and memories" : "Connect with your friends"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Circle selector"
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-all active:scale-95 cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        <ActionFeedback pending={isSubmitting && tab === "list"} operationKey={`circle-action:${accountId}:${actionCircleId}`} label="Updating Circle…" />
        <ActionFeedback pending={copying !== null} operationKey={`circle-copy:${accountId}:${copying}`} label="Copying invite…" />
        <ReadFeedback pending={retryingMemberships} operationKey={`membership-refresh:${accountId}`} label="Refreshing Circles…" />
        {!online && <p role="status" className="text-xs text-muted-foreground">{OFFLINE_MUTATION_MESSAGE}</p>}
        {tab === "list" && (
          <>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {circlesError ? (
                <div className="text-center py-6 text-sm text-red-400" role="alert">
                  {circlesError}
                  <button disabled={retryingMemberships} className="block mx-auto mt-2 underline" onClick={() => { setRetryingMemberships(true); void refreshMemberships().catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : "Could not refresh circles")).finally(() => setRetryingMemberships(false)); }}>Retry</button>
                </div>
              ) : isLoading && userCircles.length === 0 ? (
                <ReadFeedback pending operationKey={`membership-list:${accountId}`} label="Loading Circles…" retry={refreshMemberships} />
              ) : userCircles.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  You haven&apos;t joined any circles yet.
                </div>
              ) : (
                userCircles.map((circle) => {
                  const isActive = circle.id === activeCircle?.id;
                  return (
                    <div
                      key={circle.id}
                      onClick={() => {
                        setActiveCircleId(circle.id);
                        onClose();
                      }}
                      className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border ${
                        isActive
                          ? "bg-accent/15 border-accent/60 shadow-sm"
                          : "bg-surface-elevated/40 border-border/40 hover:border-border hover:bg-surface-elevated"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm shrink-0">
                          {circle.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground truncate">{circle.name}</span>
                            {isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/30 text-accent font-medium shrink-0">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {circle.member_count} {circle.member_count === 1 ? "member" : "members"}
                            </span>
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-surface border border-border/80 text-foreground/80">
                              {circle.invite_code}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => handleCopyLink(circle.name, circle.invite_code, e)}
                          disabled={copying !== null}
                          title="Copy Full Invite Link"
                          className="p-2 rounded-xl text-muted-foreground hover:text-accent hover:bg-background/80 transition-all active:scale-95 cursor-pointer"
                        >
                          <Copy className="size-4" />
                        </button>
                        
                        {circle.role === "owner" ? (
                          <button
                            onClick={(e) => handleAction(circle.id, circle.role, e)}
                            title="Delete Circle"
                            disabled={!online || isSubmitting}
                            className="p-2 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => handleAction(circle.id, circle.role, e)}
                            title="Leave Circle"
                            disabled={!online || isSubmitting}
                            className="p-2 rounded-xl text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            <LogOut className="size-4" />
                          </button>
                        )}
                        
                        {isActive && <Check className="size-5 text-accent stroke-[2.5] ml-1" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
              <button
                onClick={() => setTab("create")}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-surface-elevated border border-border text-xs font-semibold text-foreground hover:border-accent/40 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="size-4 text-accent" />
                Create Circle
              </button>
              <button
                onClick={() => setTab("join")}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-surface-elevated border border-border text-xs font-semibold text-foreground hover:border-accent/40 transition-all active:scale-95 cursor-pointer"
              >
                <UserPlus className="size-4 text-accent" />
                Join Circle
              </button>
            </div>
          </>
        )}

        {tab === "create" && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor={`${titleId}-name`} className="text-xs font-medium text-muted-foreground">Circle Name</label>
              <input
                id={`${titleId}-name`}
                type="text"
                value={newCircleName}
                disabled={isSubmitting || committed?.kind === "create"}
                onChange={(e) => setNewCircleName(e.target.value)}
                placeholder="e.g. The Boys, Family, Coffee Crawl"
                maxLength={80}
                required
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </div>
            {error && <p role="alert" className="text-xs text-red-400 font-medium">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setTab("list"); setError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-border bg-surface-elevated text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!online || isSubmitting || !newCircleName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
              >
                {isSubmitting ? "Saving…" : committed?.kind === "create" ? "Refresh membership" : "Create"}
              </button>
            </div>
          <ActionFeedback pending={isSubmitting} operationKey={`circle-management:${activeCircle?.id}:${tab}`} label="Updating Circle…" />
      </form>
        )}

        {tab === "join" && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor={`${titleId}-code`} className="text-xs font-medium text-muted-foreground">Invite Code</label>
              <input
                id={`${titleId}-code`}
                type="text"
                value={inviteCodeInput}
                disabled={isSubmitting || committed?.kind === "join"}
                onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. A8F92D"
                maxLength={6}
                required
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-mono uppercase tracking-widest text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </div>
            {error && <p role="alert" className="text-xs text-red-400 font-medium">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setTab("list"); setError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-border bg-surface-elevated text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!online || isSubmitting || !inviteCodeInput.trim()}
                className="flex-1 py-2.5 rounded-xl bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
              >
                {isSubmitting ? "Saving…" : committed?.kind === "join" ? "Refresh membership" : "Join"}
              </button>
            </div>
          <ActionFeedback pending={isSubmitting} operationKey={`circle-management:${activeCircle?.id}:${tab}`} label="Updating Circle…" />
      </form>
        )}
          </motion.div>

          <ModalFocusScope id={scopeId} depth={layer}>{createdCircleInfo && (
            <CircleInviteModal
              isOpen={true}
              circleName={createdCircleInfo.name}
              inviteCode={createdCircleInfo.inviteCode}
              onDismiss={() => {
                setCreatedCircleInfo(null);
                onClose();
              }}
            />
          )}</ModalFocusScope>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
