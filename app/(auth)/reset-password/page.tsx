"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";

import { useState } from "react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { updatePasswordAction } from "@/lib/actions/auth-actions";

export default function ResetPasswordPage() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const result = await updatePasswordAction(new FormData(event.currentTarget));
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || "Could not update your password. Please try again.");
      }
    } catch {
      setError("Could not update your password. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Set a new password</h1>
        <p className="text-sm text-muted-foreground">Choose a password with at least 8 characters.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300" role="alert">
          <AlertCircle className="size-4 shrink-0 text-rose-400" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {success ? (
        <div className="space-y-5 text-center">
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-300" role="status">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <p>Password updated.</p>
          </div>
          <Link href="/map" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            Go to the map
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">New password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required disabled={isPending} className="w-full min-h-11 rounded-lg border border-border bg-background px-3.5 py-2.5 text-base text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">Confirm new password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required disabled={isPending} className="w-full min-h-11 rounded-lg border border-border bg-background px-3.5 py-2.5 text-base text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>
          <button type="submit" disabled={isPending} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-background transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50">
            {isPending ? <><span aria-hidden="true">…</span>Updating...</> : "Update password"}
          </button>
        <ActionFeedback pending={isPending} operationKey={"password-reset"} label="Updating password…" />
      </form>
      )}
    </div>
  );
}
