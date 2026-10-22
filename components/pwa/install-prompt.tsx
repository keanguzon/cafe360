"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show if user hasn't dismissed in this session
      const dismissed = sessionStorage.getItem("cafe360_install_dismissed");
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("cafe360_install_dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <aside
      aria-label="Install Cafe360 App"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 max-w-md mx-auto animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-center justify-between p-3.5 bg-card/95 backdrop-blur border border-accent/40 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Download className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Install Cafe360</h2>
            <p className="text-xs text-muted-foreground">Add Cafe360 to your home screen</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleInstall}
            className="min-h-11 px-3 text-sm bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Install
          </Button>
          <button
            onClick={handleDismiss}
            className="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Dismiss install prompt"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
