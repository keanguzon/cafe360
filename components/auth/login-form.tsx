"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";

import { useActionState } from "react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { AlertCircle } from "lucide-react";

import { loginAction, type AuthActionState } from "@/lib/actions/auth-actions";
import { OAuthButton } from "./oauth-button";

const initialState: AuthActionState = {
  error: null,
  message: null,
};

export function LoginForm({ nextPath = "/profile" }: { nextPath?: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-xs text-muted-foreground">
          Enter your credentials to access your cafe map & circle
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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-foreground"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
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
              <span>Signing in...</span>
            </>
          ) : (
            <span>Sign in</span>
          )}
        </button>
      <ActionFeedback pending={isPending} operationKey={`login:${nextPath}`} label="Signing in…" />
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(nextPath)}`}
          className="font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
