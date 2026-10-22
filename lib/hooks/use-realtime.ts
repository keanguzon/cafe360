"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";

type UseRealtimeOptions = {
  userId?: string | null;
  onActivity?: () => void;
  onFriendRequest?: () => void;
};

/**
 * Subscribes to realtime updates for activities and friend requests
 */
export function useRealtime({ userId, onActivity, onFriendRequest }: UseRealtimeOptions = {}) {
  const router = useRouter();

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    // Get current authenticated user if not passed in
    async function setupSubscriptions() {
      let activeUserId = userId;

      if (!activeUserId) {
        const { data } = await supabase.auth.getUser();
        activeUserId = data.user?.id || null;
      }

      if (!activeUserId || !isMounted) return;

      // Channel for live circle activities (silent UI refresh)
      const activityChannel = supabase
        .channel("realtime-activities-feed")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "activities",
          },
          () => {
            onActivity?.();
            router.refresh();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(activityChannel);
      };
    }

    const cleanupPromise = setupSubscriptions();

    return () => {
      isMounted = false;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [userId, onActivity, onFriendRequest, router]);
}
