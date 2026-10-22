"use client";
import { BottomSheet } from "@/components/layout/bottom-sheet";
import { CafeDetailContent, type CafeDetailContentProps } from "./cafe-detail-content";
export function CafeDetailSheet({ isOpen, onClose, ...props }: Omit<CafeDetailContentProps, "onOpen" | "active"> & { isOpen: boolean; onClose(): void }) {
 return <BottomSheet isOpen={isOpen} onClose={onClose} title={props.cafe?.name ?? "Café"} snapPoint="half"><CafeDetailContent {...props} active={isOpen}/></BottomSheet>;
}
