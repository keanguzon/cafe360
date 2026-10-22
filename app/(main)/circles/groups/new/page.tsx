"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";

import { useState, useTransition } from "react";
import { useRouter } from "@/components/navigation/router";
import { ArrowLeft, Users } from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { createGroupAction } from "@/lib/actions/group-actions";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";

export default function CreateGroupPage() {
  const online = useOnlineStatus();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    if (!isOnline()) { setError(OFFLINE_MUTATION_MESSAGE); return; }
    setError(null);
    startTransition(async () => {
      try {
        const result = await createGroupAction({ name, description });
        if (result.success && result.groupId) {
          router.push(`/circles/${result.groupId}`);
        } else {
          setError(result.error || "Failed to create group");
        }
      } catch {
        setError("Could not create group. Please reconnect and retry.");
      }
    });
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-28 sm:px-6 sm:pb-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/circles"
          className="flex size-11 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Create Group</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5">
            <Users className="size-8 text-accent" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="group-name" className="text-xs font-medium text-muted-foreground">
            Group Name *
          </label>
          <input
            id="group-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Coffee Crawl Crew"
            maxLength={100}
            required
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="group-description" className="text-xs font-medium text-muted-foreground">
            Description (optional)
          </label>
          <textarea
            id="group-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this group about?"
            maxLength={500}
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        </div>

        {!online && <p role="status" className="text-xs text-muted-foreground">{OFFLINE_MUTATION_MESSAGE}</p>}
        {error && (
          <p role="alert" className="text-xs text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={!online || isPending || !name.trim()}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {isPending ? "Creating..." : "Create Group"}
        </button>
      <ActionFeedback pending={isPending} operationKey={"create-circle"} label="Creating Circle…" />
      </form>
    </div>
  );
}
