"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import type { SheetContentProps } from "./profile-content";
import { useTheme } from "next-themes";
import { ArrowLeft, Moon, Sun, Monitor, LogOut } from "lucide-react";
import { SignOutModal } from "@/components/auth/sign-out-modal";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { Button } from "@/components/ui/button";
import { ReadFeedback } from "@/components/ui/read-feedback";
export function SettingsContent({ accountId, presentation, onOpen, onBack, returnHref = "/map" }: SheetContentProps & { returnHref?: "/map" | "/onboarding" }) {
    const { theme, setTheme } = useTheme();
    const mounted = useSyncExternalStore(() => () => { }, () => true, () => false);
    const [isSignOutOpen, setIsSignOutOpen] = useState(false);
    const [accountEmail, setAccountEmail] = useState<{accountId:string;email:string}|null>(null);
    const [emailFailure, setEmailFailure] = useState<{accountId:string;message:string}|null>(null);
    const [emailAttempt, setEmailAttempt] = useState(0);
    const email = accountEmail?.accountId === accountId ? accountEmail.email : null;
    const emailError = emailFailure?.accountId === accountId ? emailFailure.message : null;
    useEffect(() => {
        let cancelled=false;
        if (hasSupabaseConfig()) {
            void createClient().auth.getUser().then(({data,error})=>{
                if(cancelled) return;
                if(error || data.user?.id!==accountId) setEmailFailure({accountId,message:"Account information unavailable. Please try again."});
                else setAccountEmail({accountId,email:data.user.email??""});
            }).catch(()=>{ if(!cancelled) setEmailFailure({accountId,message:"Account information unavailable. Please try again."}); });
        }
        return ()=>{cancelled=true;};
    }, [accountId,emailAttempt]);    return (<div className="flex min-h-full flex-col bg-background text-foreground">
      {presentation === "page" && <Link href={returnHref} className="p-4 text-sm font-medium">{returnHref === "/onboarding" ? "Return to onboarding" : "Return to map"}</Link>}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 sm:px-6">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-3 size-9">
            <ArrowLeft className="size-5"/>
            <span className="sr-only">Go back</span>
          </Button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-lg px-4 pt-6 pb-28 sm:px-6 sm:py-8 space-y-8">
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">App settings</h2>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-medium text-foreground">Email Address</p>
            {email !== null ? <p className="text-sm text-muted-foreground mt-1">{email || "No email available"}</p> : hasSupabaseConfig() ? <ReadFeedback pending={!emailError} error={emailError} operationKey={`settings-email:${accountId}:${emailAttempt}`} label="Loading account…" retry={() => {setEmailFailure(null);setEmailAttempt(value=>value+1);}}/> : <p className="text-sm text-muted-foreground mt-1">Preview account</p>}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Appearance</h2>
          <div className="rounded-xl border border-border bg-surface p-2 flex flex-col gap-1">
            {mounted && (<>
                <button onClick={() => setTheme("light")} className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors ${theme === "light" ? "bg-background text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:bg-background/50 hover:text-foreground"}`}>
                  <div className="flex items-center gap-3">
                    <Sun className="size-4"/>
                    <span>Light Mode</span>
                  </div>
                  {theme === "light" && <div className="size-2 rounded-full bg-accent"/>}
                </button>
                <button onClick={() => setTheme("dark")} className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors ${theme === "dark" ? "bg-background text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:bg-background/50 hover:text-foreground"}`}>
                  <div className="flex items-center gap-3">
                    <Moon className="size-4"/>
                    <span>Dark Mode</span>
                  </div>
                  {theme === "dark" && <div className="size-2 rounded-full bg-accent"/>}
                </button>
                <button onClick={() => setTheme("system")} className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors ${theme === "system" ? "bg-background text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:bg-background/50 hover:text-foreground"}`}>
                  <div className="flex items-center gap-3">
                    <Monitor className="size-4"/>
                    <span>System Default</span>
                  </div>
                  {theme === "system" && <div className="size-2 rounded-full bg-accent"/>}
                </button>
              </>)}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Circle</h2>
          <Link href="/circles" className="inline-flex min-h-11 items-center text-sm underline font-medium" onClick={e => { if (presentation === "sheet" && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onOpen({ kind: "circles", root: "you" });
    } }}>Switch or manage Circles</Link>
        </section>
        <section className="pt-4">
          <Button variant="outline" className="w-full gap-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => setIsSignOutOpen(true)}>
            <LogOut className="size-4"/>
            Sign Out
          </Button>
        </section>
      </div>
      <SignOutModal isOpen={isSignOutOpen} onClose={() => setIsSignOutOpen(false)}/>
    </div>);
}
