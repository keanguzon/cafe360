"use client";

import { refreshPage } from "@/lib/navigation/browser-recovery";
import { ActionFeedback } from "@/components/ui/action-feedback";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { updateProfileAction, type ProfileActionState } from "@/lib/actions/profile-actions";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";
import type { Profile } from "@/lib/types/profile";
import { AvatarUploader } from "./avatar-uploader";

const initialState: ProfileActionState = {
  error: null,
  message: null,
};
type SavedProfileState = ProfileActionState & { savedValues?: { displayName: string; username: string; bio: string } };

async function saveProfileSafely(
  previousState: ProfileActionState,
  formData: FormData,
): Promise<SavedProfileState> {
  if (!isOnline()) {
    return { error: OFFLINE_MUTATION_MESSAGE };
  }

  try {
    const result = await updateProfileAction(previousState, formData);
    return result.error || !result.message ? result : { ...result, savedValues: {
      displayName: String(formData.get("displayName") ?? ""),
      username: String(formData.get("username") ?? ""),
      bio: String(formData.get("bio") ?? ""),
    } };
  } catch {
    return {
      error: isOnline() ? "Could not save your profile. Please retry." : OFFLINE_MUTATION_MESSAGE,
    };
  }
}

export function ProfileEditForm({ profile, onDirtyChange }: { profile: Profile; onDirtyChange?(dirty: boolean): void }) {
  const online = useOnlineStatus();
  const [state, formAction, isPending] = useActionState(saveProfileSafely, initialState);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio || "");
  const [offlineSubmitBlocked, setOfflineSubmitBlocked] = useState(false);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const baseline = (state as SavedProfileState)?.savedValues ?? { displayName: profile.display_name, username: profile.username, bio: profile.bio || "" };
  const dirty = avatarDirty || displayName !== baseline.displayName || username !== baseline.username || bio !== baseline.bio;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!isOnline()) {
      event.preventDefault();
      setOfflineSubmitBlocked(true);
      return;
    }

    setOfflineSubmitBlocked(false);
  }

  return (
    <div className="space-y-6 rounded-xl border border-border bg-surface p-6 sm:p-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Edit Profile</h2>
        <p className="text-xs text-muted-foreground">
          Update your public details and photo across your circles.
        </p>
      </div>

      <div className="border-b border-border pb-6">
        <label className="block text-xs font-medium text-muted-foreground mb-3">
          Profile Photo
        </label>
        <AvatarUploader
          operationKey={`avatar:${profile.id}`}
          currentAvatarUrl={profile.avatar_url}
          displayName={profile.display_name}
          onDirtyChange={setAvatarDirty}
        />
      </div>

      <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
        {(!online || (offlineSubmitBlocked && !isOnline())) && (
          <p role="status" className="text-xs text-muted-foreground">
            {OFFLINE_MUTATION_MESSAGE}
          </p>
        )}

        {state?.error && (
          <div
            className="flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
            role="alert"
          >
            <AlertCircle className="size-4 shrink-0 text-rose-400" />
            <p>{state.error}</p>
          </div>
        )}

        {state?.message && (
          <div
            className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300"
            role="status"
          >
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            <p>{state.message}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="displayName"
            className="block text-xs font-medium text-foreground"
          >
            Display Name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={80}
            placeholder="Your name"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="username"
            className="block text-xs font-medium text-foreground"
          >
            Username
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-sm text-muted-foreground select-none">
              @
            </span>
            <input
              id="username"
              name="username"
              type="text"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              pattern="^[a-zA-Z0-9_]{3,24}$"
              maxLength={24}
              placeholder="username"
              className="w-full rounded-lg border border-border bg-background pl-8 pr-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            3–24 characters: lowercase letters, numbers, and underscores.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="bio"
              className="block text-xs font-medium text-foreground"
            >
              Bio
            </label>
            <span className="text-[11px] text-muted-foreground">
              {bio.length}/240
            </span>
          </div>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            maxLength={240}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Espresso enthusiast, pour-over collector, favorite cafe in Tagaytay..."
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending || !online}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <>
                <span aria-hidden="true">…</span>
                <span>Saving changes...</span>
              </>
            ) : (
              <span>Save changes</span>
            )}
          </button>
        </div>
    <ActionFeedback onRefresh={onDirtyChange ? refreshPage : undefined} pending={isPending} operationKey={`profile:${profile.id}`} label="Saving profile…" />
      </form>
    </div>
  );
}
