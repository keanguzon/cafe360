import { redirect } from "next/navigation";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { Settings } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (hasSupabaseConfig()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        redirect("/login");
      }
    } catch {
      redirect("/login");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link
            href="/settings"
            className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
          >
            <Settings className="size-5" />
            <span className="sr-only">Settings</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
