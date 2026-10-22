"use client";

import { useId, useState } from "react";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Share2, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useModalFocus } from "@/lib/hooks/use-modal-focus";

interface CircleInviteModalProps {
  isOpen: boolean;
  circleName: string;
  inviteCode: string;
  onDismiss: () => void;
}

export function CircleInviteModal({
  isOpen,
  circleName,
  inviteCode,
  onDismiss,
}: CircleInviteModalProps) {
  const titleId = useId();
  const { ref: dialogRef } = useModalFocus<HTMLDivElement>(isOpen, onDismiss);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [pending, setPending] = useState(false);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/invite/${inviteCode}`
      : `https://cafe360.app/invite/${inviteCode}`;

  const shareText = [
    `☕ Join my circle "${circleName}" on Cafe360!`,
    ``,
    `🔑 Invite Code: ${inviteCode}`,
    `🔗 Direct Link: ${inviteUrl}`,
    ``,
    `Let's explore cafés and share coffee memories together!`,
  ].join("\n");

  const handleCopyCode = async () => {
    if (pending) return;
    setPending(true);
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCodeCopied(true);
      toast.success(`Invite code "${inviteCode}" copied to clipboard!`);
      setTimeout(() => setCodeCopied(false), 2500);
    } catch {
      toast.error("Failed to copy code");
    } finally {
      setPending(false);
    }
  };

  const handleShareOrCopy = async () => {
    if (pending) return;
    setPending(true);
    try {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Join "${circleName}" on Cafe360`,
          text: shareText,
          url: inviteUrl,
        });
        toast.success("Shared invite successfully!");
        return;
      } catch (cause) {
        if (typeof cause === "object" && cause !== null && "name" in cause && cause.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setLinkCopied(true);
      toast.success("Invite message & link copied to clipboard!");
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      toast.error("Failed to copy invite message");
    }
    } finally {
      setPending(false);
    }
  };

  const handleCopyAndGo = async () => {
    if (pending) return;
    setPending(true);
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Invite message copied! Taking you to the map...");
    } catch {
      // ignore
    } finally {
      setPending(false);
    }
    onDismiss();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
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
            className="w-full max-w-sm bg-surface border border-border/80 rounded-3xl p-6 shadow-2xl space-y-5 text-center"
          >
        <ActionFeedback pending={pending} operationKey={`invite-browser:${inviteCode}`} label="Preparing invite…" />
        {/* Celebration badge & icon */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="size-14 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shadow-sm">
            <Sparkles className="size-7 animate-pulse text-accent" />
          </div>
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-accent/10 text-accent text-[11px] font-semibold tracking-wide uppercase mb-1">
              Circle Created
            </span>
            <h2 id={titleId} className="text-xl font-display font-bold text-foreground">
              {circleName}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 px-2">
              Share your invite code with friends so they can join your Circle and share café memories.
            </p>
          </div>
        </div>

        {/* Big invite code container */}
        <div
          onClick={handleCopyCode}
          className="group relative rounded-2xl border border-dashed border-accent/40 bg-background/80 hover:bg-background hover:border-accent p-4.5 cursor-pointer transition-all active:scale-[0.99]"
        >
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Circle Invite Code
          </p>
          <p className="text-3xl font-mono font-bold tracking-[0.25em] text-foreground select-all">
            {inviteCode}
          </p>
          <span className="text-[11px] text-accent/80 font-medium inline-flex items-center gap-1 mt-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {codeCopied ? (
              <>
                <Check className="size-3.5 text-emerald-500" /> Copied!
              </>
            ) : (
              <>
                <Copy className="size-3.5" /> Tap to copy code
              </>
            )}
          </span>
        </div>

        {/* Quick action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleCopyCode}
            disabled={pending}
            className="flex items-center justify-center gap-2 py-3 px-2 rounded-xl border border-border bg-surface-elevated text-xs font-semibold text-foreground hover:border-accent/50 hover:bg-surface transition-all active:scale-95 cursor-pointer"
          >
            {codeCopied ? (
              <Check className="size-4 text-emerald-500" />
            ) : (
              <Copy className="size-4 text-accent" />
            )}
            <span>{codeCopied ? "Copied Code" : "Copy Code"}</span>
          </button>

          <button
            type="button"
            onClick={handleShareOrCopy}
            disabled={pending}
            className="flex items-center justify-center gap-2 py-3 px-2 rounded-xl border border-border bg-surface-elevated text-xs font-semibold text-foreground hover:border-accent/50 hover:bg-surface transition-all active:scale-95 cursor-pointer"
          >
            {linkCopied ? (
              <Check className="size-4 text-emerald-500" />
            ) : (
              <Share2 className="size-4 text-accent" />
            )}
            <span>{linkCopied ? "Copied Invite" : "Share Invite"}</span>
          </button>
        </div>

        {/* Primary CTA */}
        <div className="space-y-2 pt-1 border-t border-border/50">
          <button
            type="button"
            onClick={handleCopyAndGo}
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 py-3.5 rounded-xl bg-accent text-sm font-semibold text-background hover:opacity-90 active:scale-95 shadow-md transition-all cursor-pointer"
          >
            <span>Copy &amp; Go to Map</span>
            <ArrowRight className="size-4" />
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Skip to Map
          </button>
        </div>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
