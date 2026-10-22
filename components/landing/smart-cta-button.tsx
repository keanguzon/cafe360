"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { NavigationLink as Link } from "@/components/navigation/navigation-feedback";
import { useRouter } from "@/components/navigation/router";
import { ArrowRight, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function getClientDeviceType(): "android" | "ios" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const userAgent = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || "";
  if (/android/i.test(userAgent)) {
    return "android";
  } else if (/iPad|iPhone|iPod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream) {
    return "ios";
  }
  return "desktop";
}

function getIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function SmartCtaButton() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const deviceType = useSyncExternalStore(
    () => () => {},
    getClientDeviceType,
    () => "desktop" as const
  );
  const isStandalone = useSyncExternalStore(
    () => () => {},
    getIsStandalone,
    () => false
  );
  const [installedAfterPrompt, setInstalledAfterPrompt] = useState(false);
  const isInstalled = isStandalone || installedAfterPrompt;

  useEffect(() => {
    // Capture Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleMobileInstallClick = async (e: React.MouseEvent) => {
    if (deferredPrompt) {
      e.preventDefault();
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setInstalledAfterPrompt(true);
        }
        setDeferredPrompt(null);
      } catch {
        router.push("/signup");
      }
    }
  };

  // On Android with install prompt available
  if (deviceType === "android" && deferredPrompt && !isInstalled) {
    return (
      <Button
        onClick={handleMobileInstallClick}
        variant="pill"
        size="lg"
        className="w-full sm:w-auto h-12 px-7 rounded-full bg-[#382215] text-[#FCFBF9] font-semibold hover:bg-[#4D301E] shadow-md flex items-center justify-center gap-2 text-sm"
      >
        <Download className="size-4" />
        <span>Add to Home Screen</span>
        <ArrowRight className="size-4" />
      </Button>
    );
  }

  // On Mobile (iOS or installed Android) or Desktop
  return (
    <Button
      asChild
      variant="pill"
      size="lg"
      className="w-full sm:w-auto h-12 px-7 rounded-full bg-[#382215] text-[#FCFBF9] font-semibold hover:bg-[#4D301E] shadow-md flex items-center justify-center gap-2 text-sm"
    >
      <Link href={deviceType !== "desktop" ? "/signup" : "/login"}>
        <Sparkles className="size-4" />
        <span>Try Cafe360 for Free</span>
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  );
}

