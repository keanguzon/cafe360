"use client";

import { useState } from "react";
import { Plus, Users, KeyRound } from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { ActivityFeed } from "@/components/social/activity-feed";
import { GroupCard } from "@/components/social/group-card";
import { CircleSwitcherDialog } from "@/components/social/circle-switcher-dialog";
import { useCircle } from "@/lib/context/circle-context";
import { ReadFeedback } from "@/components/ui/read-feedback";
import type { GroupWithMembers } from "@/lib/types/social";

type FriendsHubClientProps = {
  initialGroups: GroupWithMembers[];
};

type TabId = "groups" | "activity";

export function FriendsHubClient({}: FriendsHubClientProps) {
  const { accountId, activeCircle, userCircles, membershipsResolved, error, refreshMemberships } = useCircle();
  const [activeTab, setActiveTab] = useState<TabId>("groups");
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const retryMemberships = async () => {
    setRetrying(true);
    try {
      await refreshMemberships();
    } catch {
      // The provider retains the failure for the next explicit retry.
    } finally {
      setRetrying(false);
    }
  };

  const visibleGroups = userCircles;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "groups", label: "My Circles", count: visibleGroups.length },
    { id: "activity", label: "Circle Activity" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-28 sm:px-6 sm:pb-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Your Circles</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Private café maps and memories with your close friends</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsJoinModalOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:border-accent/40 cursor-pointer"
          >
            <KeyRound className="size-3.5 text-accent" />
            <span>Join / Switch</span>
          </button>
          <Link
            href="/circles/groups/new"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>New Circle</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-surface p-1 border border-border/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-surface-elevated text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 inline-flex size-4.5 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "groups" && (
        <div className="space-y-3">
          {!membershipsResolved ? (
            <div>
              <ReadFeedback pending={retrying || !error} error={retrying ? null : error ? "Circles unavailable. Please retry." : null} operationKey={`hub-memberships:${accountId}`} label="Loading Circles…" />
              {error && <button type="button" disabled={retrying} onClick={() => { void retryMemberships(); }} className="mt-3 min-h-11 rounded-lg border border-border px-4 text-sm disabled:opacity-50">Retry Circles</button>}
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center border border-dashed border-border rounded-2xl bg-surface/40 p-6">
              <div className="size-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <Users className="size-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">No Circles Yet</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Create a private circle for your squad or join an existing one using an invite code.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-4 text-xs font-medium text-foreground transition-colors hover:border-accent/40 cursor-pointer"
                >
                  <KeyRound className="size-3.5 text-accent" />
                  <span>Enter Code</span>
                </button>
                <Link
                  href="/circles/groups/new"
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Create Squad</span>
                </Link>
              </div>
            </div>
          ) : (
            visibleGroups.map((group) => <GroupCard key={group.id} group={group} />)
          )}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="space-y-3">
          {activeCircle && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted-foreground">
                Showing activity for <span className="font-semibold text-foreground">{activeCircle.name}</span>
              </span>
            </div>
          )}
          <ActivityFeed groupId={activeCircle?.id} />
        </div>
      )}

      {/* Circle Switcher / Join Modal */}
      <CircleSwitcherDialog
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </div>
  );
}
