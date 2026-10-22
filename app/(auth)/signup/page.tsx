import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Sign up for Cafe360 to share cafe maps and memories",
};

export default async function SignUpPage({ searchParams }: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <SignUpForm nextPath={next || "/profile"} />;
}
