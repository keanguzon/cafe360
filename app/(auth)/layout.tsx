import { Coffee } from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Coffee className="size-8 text-accent" strokeWidth={1.75} aria-hidden="true" />
            <span className="text-2xl font-bold tracking-tight">Cafe360</span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Shared cafe maps & memories for your circle.
          </p>
        </div>

        <div className="border border-border bg-surface p-6 sm:p-8 shadow-2xl rounded-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
