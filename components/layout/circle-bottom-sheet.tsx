"use client";
import { UserAvatar } from "@/components/ui/user-avatar";

import { useState, useEffect } from "react";
import { useCircle } from "@/lib/context/circle-context";
import {
  Activity as ActivityIcon,
  ChevronUp,
  Users,
} from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { sheetHref } from "@/lib/navigation/sheet-routes";
import { ActivityFeed } from "@/components/social/activity-feed";
import { motion, useMotionValue, useTransform, useAnimation, type PanInfo } from "framer-motion";

interface CircleBottomSheetProps {
  floatingActions?: React.ReactNode;
}

export function CircleBottomSheet({ floatingActions }: CircleBottomSheetProps = {}) {
  const {
    accountId,
    activeCircle,
    circleMembers,
  } = useCircle();

  const [tab, setTab] = useState<"members" | "activity">("members");
  const [snap, setSnap] = useState<"peek" | "half" | "full">("peek");
  const [windowHeight, setWindowHeight] = useState(800);

  const controls = useAnimation();
  const y = useMotionValue(0);

  // Calculate snap offsets based on window height
  // Total panel height is 75vh.
  // "full": y = 0
  // "half": y = ~35% of panel
  // "peek": y = panelHeight - 190px (so only ~190px is visible)
  const panelHeight = Math.round(windowHeight * 0.75);
  const peekVisibleHeight = 190;
  const peekY = Math.max(0, panelHeight - peekVisibleHeight);
  const halfY = Math.round(peekY * 0.55);
  const fullY = 0;

  // Real-time drag transform: buttons track sheet and smoothly fade & scale out when dragged up
  const fadeThresholdY = Math.max(halfY + 30, peekY - 70);
  const floatingOpacity = useTransform(
    y,
    [fullY, halfY, fadeThresholdY, peekY],
    [0, 0, 0.75, 1]
  );
  const floatingScale = useTransform(
    y,
    [fullY, halfY, fadeThresholdY, peekY],
    [0.9, 0.9, 0.98, 1]
  );
  const floatingPointerEvents = useTransform(y, (latestY) =>
    latestY < fadeThresholdY ? "none" : "auto"
  );

  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sync animation when snap state changes
  useEffect(() => {
    const targetY = snap === "peek" ? peekY : snap === "half" ? halfY : fullY;
    controls.start({
      y: targetY,
      transition: { type: "spring", damping: 28, stiffness: 300, mass: 0.8 },
    });
  }, [snap, peekY, halfY, fullY, controls]);

  const isExpanded = snap !== "peek";

  // Toggle between peek and full on header click / tap
  const toggleExpand = () => {
    setSnap((prev) => (prev === "peek" ? "full" : "peek"));
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const currentY = y.get();
    const velocityY = info.velocity.y;

    // Velocity-based fling
    if (velocityY < -400) {
      // Flicked UP fast
      if (currentY > halfY) {
        setSnap("half");
      } else {
        setSnap("full");
      }
      return;
    }

    if (velocityY > 400) {
      // Flicked DOWN fast
      if (currentY < halfY) {
        setSnap("half");
      } else {
        setSnap("peek");
      }
      return;
    }

    // Proximity to nearest snap point
    const distToFull = Math.abs(currentY - fullY);
    const distToHalf = Math.abs(currentY - halfY);
    const distToPeek = Math.abs(currentY - peekY);

    const min = Math.min(distToFull, distToHalf, distToPeek);
    if (min === distToFull) {
      setSnap("full");
    } else if (min === distToHalf) {
      setSnap("half");
    } else {
      setSnap("peek");
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-14 md:bottom-0 z-30 flex justify-center pointer-events-none">
      <motion.div
        drag="y"
        dragConstraints={{ top: fullY, bottom: peekY }}
        dragElastic={0.12}
        dragMomentum={false}
        style={{
          y,
          height: `${panelHeight}px`,
        }}
        animate={controls}
        onDragEnd={handleDragEnd}
        className="pointer-events-auto w-full max-w-lg flex flex-col will-change-transform touch-pan-y select-none relative"
      >
        {floatingActions && (
          <motion.div
            style={{
              opacity: floatingOpacity,
              scale: floatingScale,
              pointerEvents: floatingPointerEvents,
            }}
            className="absolute bottom-full left-0 right-0 mb-3 px-3 sm:px-4 z-40"
          >
            {floatingActions}
          </motion.div>
        )}
        <div className="w-full h-full flex flex-col overflow-hidden bg-surface/98 border-t border-x border-border/80 rounded-t-3xl shadow-2xl backdrop-blur-xl">
          {/* Drag Handle & Tap Header (Drag Target) */}
          <div
            onClick={toggleExpand}
            className="w-full pt-3 pb-2 flex flex-col items-center cursor-grab active:cursor-grabbing select-none group shrink-0 hover:bg-surface-elevated/40 transition-colors"
          >
            {/* Visual Drag Handle Pill */}
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/35 group-hover:bg-muted-foreground/60 transition-colors mb-2" />

          {/* Quick Stats & Circle header preview */}
          <div className="w-full px-4 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display font-bold text-sm text-foreground truncate">
                {activeCircle?.name || "Active Circle"}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground bg-surface-elevated px-2 py-0.5 rounded-full border border-border/60 shrink-0">
                {circleMembers.length} {circleMembers.length === 1 ? "member" : "members"}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand();
              }}
              className="text-xs font-semibold text-accent flex items-center gap-1 shrink-0 cursor-pointer p-1 -mr-1 hover:opacity-80 transition-opacity"
            >
              <span>{isExpanded ? "Collapse" : "View All"}</span>
              <ChevronUp
                className={`size-3.5 transition-transform duration-300 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Category Pill Tabs */}
        <div className="px-4 py-1.5 flex items-center gap-2 border-b border-border/50 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTab("members");
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
              tab === "members"
                ? "bg-accent text-accent-foreground shadow-md shadow-accent/20"
                : "bg-surface-elevated text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="size-3.5" />
            Members ({circleMembers.length})
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTab("activity");
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
              tab === "activity"
                ? "bg-accent text-accent-foreground shadow-md shadow-accent/20"
                : "bg-surface-elevated text-muted-foreground hover:text-foreground"
            }`}
          >
            <ActivityIcon className="size-3.5" />
            Activity
          </button>
        </div>

        {/* Tab Content List */}
        <div
          onPointerDown={(e) => {
            // Allow vertical scrolling inside list when expanded without triggering sheet drag
            e.stopPropagation();
          }}
          className="flex-1 overflow-y-auto px-4 py-2 space-y-2.5 divide-y divide-border/30 overscroll-contain select-text"
        >
          {tab === "members" && (
            <>
              {circleMembers.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No members found in this circle yet.
                </div>
              ) : (
                circleMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="pt-2 flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <UserAvatar src={member.avatarUrl} name={member.displayName} className="border border-border"/>
                      </div>

                      {/* Member Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-foreground truncate">
                            {member.displayName}
                          </h4>
                          {member.role === "owner" ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400">
                              Admin
                            </span>
                          ) : (
                            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-surface-elevated text-muted-foreground border border-border/50">
                              Member
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Circle Member
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {activeCircle && <Link
                        href={member.userId === accountId ? "/profile" : sheetHref({ kind: "member", root: "nearby", entityId: member.userId, circleId: activeCircle.id })}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-surface-elevated hover:bg-accent hover:text-accent-foreground transition-colors border border-border/60"
                      >
                        Profile
                      </Link>}
                    </div>
                  </div>
                ))
              )}
              {/* Manage Friends & Circle Settings */}
              <div className="pt-4 pb-2 text-center border-t border-border/30 mt-2">
                <Link
                  href="/circles"
                  className="text-xs font-semibold text-accent underline underline-offset-2"
                >
                  Manage Circles & Settings
                </Link>
              </div>
            </>
          )}

          {tab === "activity" && (
            <div className="pt-2">
              <div className="mb-3 text-xs text-muted-foreground">
                Activity and discovered cafés for {activeCircle?.name || "your circle"}.
              </div>
              <ActivityFeed groupId={activeCircle?.id} />
            </div>
          )}
        </div>
        </div>

        {/* Solid bottom overdrag skirt: prevents map showing underneath during upward dragging/rubber-banding */}
        <div className="absolute top-[calc(100%-2px)] inset-x-0 h-[120vh] bg-surface/98 border-x border-border/80 pointer-events-none" />
      </motion.div>
    </div>
  );
}

