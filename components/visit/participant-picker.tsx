"use client";

import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { FriendProfile } from "@/lib/types/social";

interface ParticipantPickerProps {
  friends: FriendProfile[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function ParticipantPicker({ friends, selectedIds, onChange }: ParticipantPickerProps) {
  const [open, setOpen] = useState(false);

  const selectedFriends = friends.filter((f) => selectedIds.includes(f.id));

  const toggleFriend = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {selectedFriends.map((friend) => (
          <Badge key={friend.id} variant="secondary" className="px-3 py-1 text-sm bg-accent/20 border-accent/30 text-foreground">
            <UserAvatar src={friend.avatar_url} name={friend.display_name} decorative className="mr-2 size-6 text-[10px]"/>
            {friend.display_name}
            <button
              type="button"
              className="ml-2 hover:text-destructive focus:outline-none"
              onClick={() => toggleFriend(friend.id)}
            >
              ×
            </button>
          </Badge>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between w-full h-12 text-muted-foreground"
          >
            <span className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Tag friends...
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search friends..." />
            <CommandList>
              <CommandEmpty>No friends found.</CommandEmpty>
              <CommandGroup>
                {friends.map((friend) => (
                  <CommandItem
                    key={friend.id}
                    value={friend.username}
                    onSelect={() => toggleFriend(friend.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedIds.includes(friend.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <UserAvatar src={friend.avatar_url} name={friend.display_name} decorative className="mr-2 size-8"/>
                    <div className="flex flex-col">
                      <span>{friend.display_name}</span>
                      <span className="text-xs text-muted-foreground">@{friend.username}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
