import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { Coffee, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center p-6 text-center space-y-5 bg-background">
      <div className="flex size-20 items-center justify-center rounded-3xl bg-accent/10 text-accent shadow-xl border border-accent/20">
        <Coffee className="size-10" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold text-foreground">Page unavailable</h1>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          This page does not exist or is not available to your account.
        </p>
      </div>
        <Button asChild className="h-11 px-6 text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 flex items-center gap-2 cursor-pointer">
          <Link href="/map">
          <Home className="size-4" />
          <span>Return to map</span>
          </Link>
        </Button>
    </div>
  );
}
