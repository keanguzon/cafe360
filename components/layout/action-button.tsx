"use client";

import { useState } from "react";
import { Plus, Coffee, Heart } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function ActionButton() {
  const [open, setOpen] = useState(false);

  const handleAction = (actionName: string) => {
    toast(`${actionName} clicked`, {
      description: "Navigate to a Cafe to log a visit or save it.",
    });
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center justify-center w-12 h-12 -mt-6 transition-transform rounded-full shadow-lg bg-accent text-accent-foreground hover:scale-105 focus:outline-none focus:ring-4 focus:ring-accent/20 cursor-pointer"
          aria-label="Actions"
        >
          <Plus className={`w-6 h-6 transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" sideOffset={16} className="w-48">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleAction("Log Visit")} className="cursor-pointer">
          <Coffee className="w-4 h-4 mr-2" />
          <span>Log a Visit</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAction("Save Cafe")} className="cursor-pointer">
          <Heart className="w-4 h-4 mr-2" />
          <span>Save a Cafe</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
