"use client";

import { Check, Copy, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { ActionFeedback } from "@/components/ui/action-feedback";

type InviteLinkProps = {
  inviteCode: string;
};

export function InviteLink({ inviteCode }: InviteLinkProps) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/invite/${inviteCode}`
    : `/invite/${inviteCode}`;

  const handleCopy = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the invite link. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3">
      <ActionFeedback pending={pending} operationKey={`copy-invite:${inviteCode}`} label="Copying invite…" />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <LinkIcon className="size-4 shrink-0 text-accent" />
      <p className="flex-1 truncate text-xs text-muted-foreground font-mono">{inviteUrl}</p>
      <button
        onClick={handleCopy}
        disabled={pending}
        className="flex size-11 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent cursor-pointer"
        aria-label="Copy invite link"
      >
        {copied ? <Check className="size-4 text-green-400" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
