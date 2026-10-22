"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";

import { useActionState, useEffect } from "react";
import { LogOut, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { logoutAction } from "@/lib/actions/auth-actions";

interface SignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignOutModal({ isOpen, onClose }: SignOutModalProps) {
  const [result, signOut, isLoggingOut] = useActionState(logoutAction, null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoggingOut) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoggingOut, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => {
            if (!isLoggingOut) onClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 select-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4"
          >
            <div className="flex justify-end -mt-2 -mr-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoggingOut}
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-all active:scale-95 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col items-center text-center space-y-2 -mt-2">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent/15 text-accent shadow-inner">
                <LogOut className="size-5" />
              </div>
              <h3 className="text-base font-bold font-display text-foreground">
                Sign out of Cafe360?
              </h3>
              <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                You will need to sign back in to access your circles, saved cafés, and memories.
              </p>
            </div>

            <ActionFeedback pending={isLoggingOut} operationKey={"sign-out"} label="Signing out…" />
            {result?.error && <p role="alert" className="text-sm text-destructive">{result.error}</p>}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoggingOut}
                className="flex-1 h-10 rounded-xl border border-border bg-surface-elevated text-xs font-semibold text-foreground hover:bg-surface transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <form
                action={signOut}
                className="flex-1"
              >
                <button
                  type="submit"
                  disabled={isLoggingOut}
                  className="w-full h-10 rounded-xl bg-accent text-accent-foreground text-xs font-bold shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isLoggingOut ? (
                    <span aria-hidden="true">…</span>
                  ) : (
                    <LogOut className="size-3.5" />
                  )}
                  <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
                </button>

      </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
