"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";

import { useState } from "react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";

import { forgotPasswordAction } from "@/lib/actions/auth-actions";

export default function ForgotPasswordPage() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const result = await forgotPasswordAction(formData);

    setIsPending(false);

    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(true);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Reset Password
        </h1>
        <p className="text-xs text-muted-foreground">
          Enter your email and we&apos;ll send you instructions to reset your password.
        </p>
      </div>

      {error && (
        <div
          className="flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
          role="alert"
        >
          <AlertCircle className="size-4 shrink-0 text-rose-400" />
          <p>{error}</p>
        </div>
      )}

      {success ? (
        <div className="space-y-6">
          <div
            className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300"
            role="status"
          >
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-emerald-200">Reset link sent</p>
              <p className="text-emerald-300/90">
                Check your inbox for a reset link.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <ArrowLeft className="size-3.5" />
              Back to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-medium text-foreground"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <>
                <span aria-hidden="true">…</span>
                <span>Sending...</span>
              </>
            ) : (
              <span>Send Reset Link</span>
            )}
          </button>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <ArrowLeft className="size-3.5" />
              Back to Sign In
            </Link>
          </div>
        <ActionFeedback pending={isPending} operationKey={"password-recovery"} label="Sending recovery email…" />
      </form>
      )}
    </div>
  );
}
