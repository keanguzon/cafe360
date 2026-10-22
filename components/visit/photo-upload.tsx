"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";

import { useState, useRef, useEffect } from "react";
import { Camera, X } from "lucide-react";
import { deleteTemporaryPhotoAction, uploadPhotoAction } from "@/lib/actions/photo-actions";
import { prepareMemoryPhoto } from "@/lib/utils/prepare-photo";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";

type Preview = { id: string; url: string; file: File; path?: string; loading: boolean; failed?: boolean };
interface PhotoUploadProps {
  onUploadSuccess: (paths: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  operationKey?: string;
}

export function PhotoUpload({ onUploadSuccess, onBusyChange, disabled = false, operationKey = "visit-photo" }: PhotoUploadProps) {
  const online = useOnlineStatus();
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const items = useRef<Preview[]>([]);
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const callbacks = useRef({ onUploadSuccess, onBusyChange, disabled });
  useEffect(() => { callbacks.current = { onUploadSuccess, onBusyChange, disabled }; }, [onUploadSuccess, onBusyChange, disabled]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const item of items.current) {
        URL.revokeObjectURL(item.url);
        if (item.path && !callbacks.current.disabled && isOnline()) void deleteTemporaryPhotoAction(item.path);
      }
    };
  }, []);

  function update(next: Preview[]) {
    items.current = next;
    if (!mounted.current) return;
    setPreviews(next);
    callbacks.current.onUploadSuccess(next.flatMap((item) => item.path ? [item.path] : []));
    callbacks.current.onBusyChange?.(next.some((item) => !item.path));
  }

  async function upload(item: Preview) {
    try {
      if (!isOnline()) throw new Error(OFFLINE_MUTATION_MESSAGE);
      const prepared = await prepareMemoryPhoto(item.file);
      if (!mounted.current) return;
      if (!isOnline()) throw new Error(OFFLINE_MUTATION_MESSAGE);
      const form = new FormData(); form.set("file", prepared);
      const result = await uploadPhotoAction(form);
      if (!mounted.current) {
        if (result.path && isOnline()) void deleteTemporaryPhotoAction(result.path);
        return;
      }
      if (!result.success || !result.path) throw new Error(result.error || "Photo upload failed");
      update(items.current.map((current) => current.id === item.id ? { ...current, path: result.path, loading: false, failed: false } : current));
    } catch (cause) {
      if (mounted.current) {
        update(items.current.map((current) => current.id === item.id ? { ...current, loading: false, failed: true } : current));
        setError(cause instanceof Error ? cause.message : "Photo upload failed. Please retry.");
      }
    }
  }

  async function retry(item: Preview) {
    if (!isOnline()) { setError(OFFLINE_MUTATION_MESSAGE); return; }
    if (busy || disabled || !item.failed) return;
    setError(null);
    setBusy(true);
    update(items.current.map((current) => current.id === item.id ? { ...current, loading: true, failed: false } : current));
    try { await upload(item); }
    finally { if (mounted.current) setBusy(false); }
  }

  async function selectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    if (!isOnline()) { setError(OFFLINE_MUTATION_MESSAGE); return; }
    if (busy || disabled) return;
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const available = 5 - items.current.length;
    setError(files.length > available ? "You can attach up to five photos." : null);
    setBusy(true);
    callbacks.current.onBusyChange?.(true);
    try {
      for (const file of files.slice(0, available)) {
        if (!mounted.current) break;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
          setError("Choose JPEG, PNG or WebP photos up to 5 MB each.");
          continue;
        }
        const item: Preview = { id: crypto.randomUUID(), url: URL.createObjectURL(file), file, loading: true };
        update([...items.current, item]);
        await upload(item);
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
        callbacks.current.onBusyChange?.(items.current.some((item) => !item.path));
      }
    }
  }

  async function remove(item: Preview) {
    if (!isOnline()) { setError(OFFLINE_MUTATION_MESSAGE); return; }
    if (disabled || busy) return;
    setBusy(true);
    callbacks.current.onBusyChange?.(true);
    try {
      if (item.path) {
        const result = await deleteTemporaryPhotoAction(item.path);
        if (!result.success) { setError(result.error || "Could not remove photo. Please retry."); return; }
      }
      URL.revokeObjectURL(item.url);
      update(items.current.filter((current) => current.id !== item.id));
    } catch {
      setError("Could not remove photo. Please retry.");
    } finally {
      if (mounted.current) {
        setBusy(false);
        callbacks.current.onBusyChange?.(items.current.some(current => !current.path));
      }
    }
  }

  return <div className="space-y-3">
      <ActionFeedback pending={busy} operationKey={operationKey} label="Updating photos…" />
    <div className="flex flex-wrap gap-3">
      {previews.map((item) => <div key={item.id} className="relative h-24 w-24 overflow-hidden rounded-xl border border-border bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt="Selected memory photo" className="h-full w-full object-cover" />
        {item.loading ? <div role="status" aria-label="Uploading photo" className="absolute inset-0 flex items-center justify-center bg-background/60"><span aria-hidden="true">…</span></div> :
          <button type="button" aria-label="Remove photo" disabled={!online || disabled || busy} onClick={() => void remove(item)} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-bl-xl bg-black/70 text-white focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"><X className="h-4 w-4" /></button>}
        {item.failed && <button type="button" aria-label="Retry photo upload" disabled={!online || disabled || busy} onClick={() => void retry(item)} className="absolute inset-x-0 bottom-0 min-h-11 bg-background/95 px-2 text-xs font-medium text-foreground focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50">Retry upload</button>}
      </div>)}
      {previews.length < 5 && <button type="button" disabled={!online || disabled || busy} onClick={() => input.current?.click()} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"><Camera className="h-6 w-6" /><span className="text-xs">Add photo</span></button>}
    </div>
    <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden ref={input} disabled={!online || disabled || busy} onChange={(event) => void selectFiles(event)} />
    {!online && <p role="status" className="text-xs text-muted-foreground">{OFFLINE_MUTATION_MESSAGE}</p>}
    <p className="text-xs text-muted-foreground">Up to five photos, 5 MB each. Visible to this Circle.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
