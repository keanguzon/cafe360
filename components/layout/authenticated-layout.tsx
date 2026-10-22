import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { BottomNav, MainNav } from "@/components/layout/main-nav";

import { CircleProvider } from "@/lib/context/circle-context";
import { NavigationStateProvider } from "@/lib/context/navigation-state";
import { MapShellPresenceProvider } from "@/lib/context/map-shell-presence";
import { AuthenticatedBoundary } from "@/components/providers/authenticated-boundary";
import { PwaStatus } from "@/components/pwa/service-worker-registration";

export async function AuthenticatedLayout({
  children,
  requireCircle = true,
}: Readonly<{
  children: React.ReactNode;
  requireCircle?: boolean;
}>) {
  let userEmail: string | null = null;
  let accountId = "development-preview";
  let shouldRedirectLogin = false;
  let shouldRedirectOnboarding = false;
  let hasNoCircles = false;

  if (hasSupabaseConfig()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        shouldRedirectLogin = true;
      } else {
        accountId = user.id;
        const { count, error: groupError } = await supabase
          .from("group_members")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        // Redirect to onboarding only if user has definitively 0 groups and no error
        if (!groupError && count === 0) {
          hasNoCircles = true;
          shouldRedirectOnboarding = requireCircle;
        } else {
          userEmail = user.email || null;
        }
      }
    } catch {
      shouldRedirectLogin = true;
    }
  }

  // Redirects MUST be outside try-catch because redirect() throws
  // a special NEXT_REDIRECT error that try-catch would swallow
  if (shouldRedirectLogin) {
    redirect("/login");
  }
  if (shouldRedirectOnboarding) {
    redirect("/onboarding");
  }

  return (
    <AuthenticatedBoundary accountId={accountId} enabled={hasSupabaseConfig()}>
    <CircleProvider accountId={accountId}>
      <NavigationStateProvider accountId={accountId}>
      <MapShellPresenceProvider>
      <div className={`fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground ${hasNoCircles ? "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" : ""}`}>
        <PwaStatus />
        {!hasNoCircles && <MainNav userEmail={userEmail} />}
        <main className="flex-1 min-h-0 relative overflow-y-auto">{children}</main>
        {!hasNoCircles && <BottomNav />}
      </div>
      </MapShellPresenceProvider>
      </NavigationStateProvider>
    </CircleProvider>
    </AuthenticatedBoundary>
  );
}
