"use client";

import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { ModalFocusScope, useModalFocus } from "@/lib/hooks/use-modal-focus";

export type BottomSheetSnap = "collapsed" | "half" | "full";

type BottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  snapPoint?: BottomSheetSnap;
  onSnapChange?: (snap: BottomSheetSnap) => void;
  children: ReactNode;
};

export function BottomSheet({
  isOpen,
  onClose,
  title,
  snapPoint = "half",
  onSnapChange,
  children,
}: BottomSheetProps) {
  const titleId = useId();
  const [currentSnap, setCurrentSnap] = useState<BottomSheetSnap>(snapPoint);
  const [prevSnapPoint, setPrevSnapPoint] = useState(snapPoint);
  if (snapPoint !== prevSnapPoint) {
    setPrevSnapPoint(snapPoint);
    setCurrentSnap(snapPoint);
  }
  const [windowHeight, setWindowHeight] = useState(800);
  const [bottomInset, setBottomInset] = useState(0);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const { ref: dialogRef, scopeId, layer } = useModalFocus<HTMLDivElement>(isOpen && mounted, onClose);

  useEffect(() => {
    const viewport = window.visualViewport;
    const handleResize = () => {
      const height = viewport?.height ?? window.innerHeight;
      setWindowHeight(height);
      setBottomInset(Math.max(0, window.innerHeight - height - (viewport?.offsetTop ?? 0)));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    viewport?.addEventListener("resize", handleResize);
    viewport?.addEventListener("scroll", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      viewport?.removeEventListener("resize", handleResize);
      viewport?.removeEventListener("scroll", handleResize);
    };
  }, []);

  // Lock body scroll when modal sheet is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Calculate snap Y coordinates (0 = top of sheet at max height)
  const maxSheetHeight = Math.round(windowHeight * 0.92);
  const halfSheetHeight = Math.round(windowHeight * 0.55);
  const collapsedSheetHeight = Math.round(windowHeight * 0.26);

  const fullY = 0;
  const halfY = maxSheetHeight - halfSheetHeight;
  const collapsedY = maxSheetHeight - collapsedSheetHeight;

  const targetY =
    currentSnap === "full" ? fullY : currentSnap === "collapsed" ? collapsedY : halfY;

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const currentY = targetY + info.offset.y;
    const velocityY = info.velocity.y;

    // Fling down hard -> Close
    if (velocityY > 450 || info.offset.y > 180) {
      onClose();
      return;
    }

    // Fling up hard -> Full
    if (velocityY < -350 || info.offset.y < -150) {
      setCurrentSnap("full");
      onSnapChange?.("full");
      return;
    }

    // Snap to nearest position
    const distToFull = Math.abs(currentY - fullY);
    const distToHalf = Math.abs(currentY - halfY);
    const distToCollapsed = Math.abs(currentY - collapsedY);

    const min = Math.min(distToFull, distToHalf, distToCollapsed);
    if (min === distToFull) {
      setCurrentSnap("full");
      onSnapChange?.("full");
    } else if (min === distToHalf) {
      setCurrentSnap("half");
      onSnapChange?.("half");
    } else {
      setCurrentSnap("collapsed");
      onSnapChange?.("collapsed");
    }
  };

  const toggleSnap = () => {
    const nextSnap: BottomSheetSnap = currentSnap === "full" ? "half" : "full";
    setCurrentSnap(nextSnap);
    onSnapChange?.(nextSnap);
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bottom-sheet-backdrop"
            style={{ zIndex: 40 + layer * 20 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Draggable Sheet Container */}
          <div
            key="bottom-sheet-wrapper"
            style={{ zIndex: 50 + layer * 20, bottom: bottomInset }}
            className="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none"
          >
            <motion.div
              key="bottom-sheet-content"
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              drag="y"
              dragConstraints={{ top: fullY, bottom: collapsedY + 80 }}
              dragElastic={0.12}
              dragMomentum={false}
              style={{
                height: `${maxSheetHeight}px`,
              }}
              initial={{ y: maxSheetHeight }}
              animate={{
                y: targetY,
                transition: { type: "spring", damping: 28, stiffness: 320, mass: 0.8 },
              }}
              exit={{
                y: maxSheetHeight,
                transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] },
              }}
              onDragEnd={handleDragEnd}
              className="pointer-events-auto w-full md:max-w-lg relative flex flex-col will-change-transform select-none touch-pan-y"
            >
              {/* Main Card */}
              <div style={{ height: maxSheetHeight - targetY }} className="w-full bg-surface border-t border-x border-border/80 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden">
                {/* Drag Handle & Tap Header */}
                <div
                  onClick={toggleSnap}
                  className="w-full pt-3 pb-2 flex flex-col items-center cursor-grab active:cursor-grabbing select-none group shrink-0 hover:bg-surface-elevated/30 transition-colors"
                >
                  <div className="w-12 h-1.5 rounded-full bg-muted-foreground/35 group-hover:bg-muted-foreground/60 transition-colors" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3 border-b border-border/40 shrink-0">
                  <h3 id={titleId} className="text-base font-bold tracking-tight text-foreground truncate">
                    {title || "Café Details"}
                  </h3>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground active:scale-95 cursor-pointer"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Scrollable Content Area */}
                <div
                  onPointerDown={(e) => {
                    // Prevent outer drag from intercepting scrolling inside content
                    e.stopPropagation();
                  }}
                  className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] overscroll-contain"
                >
                  <ModalFocusScope id={scopeId} depth={layer}>{children}</ModalFocusScope>
                </div>
              </div>

              {/* Solid bottom overdrag skirt: fills all space below the sheet when dragged upwards */}
              <div className="absolute top-[calc(100%-2px)] inset-x-0 h-[120vh] bg-surface border-x border-border/80 pointer-events-none" />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;

  return createPortal(content, document.body);
}
