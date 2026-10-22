"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";

import { useEffect, useRef, useState, useTransition } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Camera, User } from "lucide-react";

import { uploadAvatarAction } from "@/lib/actions/profile-actions";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";

export function AvatarUploader({
  currentAvatarUrl,
  displayName,
  onDirtyChange,
  operationKey = "avatar-upload",
}: {
  currentAvatarUrl: string | null;
  displayName: string;
  onDirtyChange?(dirty: boolean): void;
  operationKey?: string;
}) {
  const online = useOnlineStatus();
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { onDirtyChange?.(isPending || selectedFile !== null); }, [isPending, selectedFile, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  function uploadSelectedFile(file: File) {
    if (!isOnline()) {
      setError(OFFLINE_MUTATION_MESSAGE);
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.append("avatar", file);

    startTransition(async () => {
      if (!isOnline()) {
        setError(OFFLINE_MUTATION_MESSAGE);
        return;
      }

      try {
        const result = await uploadAvatarAction(formData);
        if (result.error) {
          setError(result.error);
        } else if (result.avatarUrl) {
          setAvatarUrl(result.avatarUrl);
          setSelectedFile(null);
          setError(null);
        } else {
          setError("Could not upload avatar. Please retry.");
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not upload avatar. Please retry.");
      }
    });
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    event.currentTarget.value = "";
    setSelectedFile(file);
    uploadSelectedFile(file);
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">

      <div className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-accent/40 bg-surface shadow-md">
        <UserAvatar src={avatarUrl} name={displayName} className="size-full bg-surface" fallback={<User className="size-10" aria-hidden="true" strokeWidth={1.5}/>}/>

        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-xs">
            <span aria-hidden="true">…</span>
          </div>
        )}
      </div>

      <div className="space-y-1.5 text-center sm:text-left">
        <ActionFeedback pending={isPending} operationKey={operationKey} label="Uploading avatar…" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
          disabled={isPending}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50 cursor-pointer"
        >
          <Camera className="size-3.5" aria-hidden="true" />
          <span>{avatarUrl ? "Change avatar" : "Upload avatar"}</span>
        </button>
        <p className="text-[11px] text-muted-foreground">
          JPG, PNG or WebP, max 5 MB
        </p>

        {!online && (
          <p className="text-xs text-muted-foreground" role="status">
            {OFFLINE_MUTATION_MESSAGE}
          </p>
        )}

        {online && error && error !== OFFLINE_MUTATION_MESSAGE && (
          <p className="text-xs text-rose-400" role="alert">
            {error}
          </p>
        )}

        {selectedFile && error && (
          <button
            type="button"
            onClick={() => uploadSelectedFile(selectedFile)}
            disabled={!online || isPending}
            className="inline-flex min-h-11 items-center text-xs font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
          >
            Retry upload
          </button>
        )}
      </div>
    </div>
  );
}
