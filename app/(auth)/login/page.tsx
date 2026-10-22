import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Cafe360 account",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const resolvedParams = await searchParams;
  const nextPath = resolvedParams.next || "/profile";

  return <LoginForm nextPath={nextPath} />;
}
