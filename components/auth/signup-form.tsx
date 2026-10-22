"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";

import { useActionState, useState } from "react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { signupAction, type AuthActionState } from "@/lib/actions/auth-actions";
import { OAuthButton } from "./oauth-button";
import { emailDisplayName } from "@/lib/auth/profile-setup";

const initialState: AuthActionState = {
  error: null,
  message: null,
};

export function SignUpForm({ nextPath = "/profile" }: { nextPath?: string }) {
  const [state, formAction, isPending] = useActionState(signupAction, initialState);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Create an account
        </h1>
        <p className="text-xs text-muted-foreground">
          Join Cafe360 to map visits and share memories with friends
        </p>
      </div>

      <OAuthButton provider="google" nextPath={nextPath} />

      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-border" />
        <span className="bg-surface px-3 text-xs uppercase tracking-wider text-muted-foreground">
          Or with email
        </span>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={nextPath} />
        {state?.error && (
          <div
            className="flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
            role="alert"
          >
            <AlertCircle className="size-4 shrink-0 text-rose-400" />
            <p>{state.error}</p>
          </div>
        )}

        {state?.message && (
          <div
            className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300"
            role="status"
          >
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            <p>{state.message}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="displayName"
            className="block text-xs font-medium text-foreground"
          >
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            value={displayName ?? emailDisplayName(email)}
            onChange={event => setDisplayName(event.target.value)}
            maxLength={80}
            required
            placeholder="e.g. Mika Santos"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="username"
            className="block text-xs font-medium text-foreground"
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            placeholder="e.g. mika_santos"
            pattern="^[a-zA-Z0-9_]{3,24}$"
            title="3-24 characters, letters, numbers, or underscores"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <p className="text-[11px] text-muted-foreground">
            3–24 characters: letters, numbers, underscores only.
          </p>
        </div>

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
            value={email}
            onChange={event => setEmail(event.target.value)}
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-xs font-medium text-foreground"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Minimum 8 characters"
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
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create account</span>
          )}
        </button>
      <ActionFeedback pending={isPending} operationKey={`signup:${nextPath}`} label="Creating account…" />
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(nextPath)}`}
          className="font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
