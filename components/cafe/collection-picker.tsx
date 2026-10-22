"use client";

import { ActionFeedback } from "@/components/ui/action-feedback";
import { ReadFeedback } from "@/components/ui/read-feedback";

import { useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, FolderPlus, Plus, Sparkles, X } from "lucide-react";
import { useCircle } from "@/lib/context/circle-context";
import { usePersonalCollections } from "@/lib/hooks/use-saved-cafes";
import { useModalFocus } from "@/lib/hooks/use-modal-focus";
import { isOnline, OFFLINE_MUTATION_MESSAGE, useOnlineStatus } from "@/lib/hooks/use-online-status";

type CollectionPickerProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedCollection: string;
  onSelectCollection: (collection: string, notes?: string) => void | Promise<void>;
  cafeName: string;
  initialNotes?: string;
};

const SUGGESTED_COLLECTIONS = [
  "Favorites",
  "To Visit",
  "Work & Study",
  "Aesthetic Vibes",
  "Best Coffee",
  "Late Night",
];

const emptySubscribe = () => () => {};

export function CollectionPicker({
  isOpen,
  onClose,
  selectedCollection,
  onSelectCollection,
  cafeName,
  initialNotes = "",
}: CollectionPickerProps) {
  const online = useOnlineStatus();
  const titleId = useId();
  const { accountId } = useCircle();
  const { collections, initialLoading: isPending, error: collectionsError, refresh } = usePersonalCollections(accountId, isOpen);
  const [wasOpen, setWasOpen] = useState(false);
  const [activeCollection, setActiveCollection] = useState(selectedCollection || "Favorites");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [refreshingCollections, setRefreshingCollections] = useState(false);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const requestClose = () => { if (!isSaving) onClose(); };
  const { ref: dialogRef, layer } = useModalFocus<HTMLDivElement>(isOpen && mounted, requestClose);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setActiveCollection(selectedCollection || "Favorites");
      setNotes(initialNotes);
    }
  }

  // Combine user collections and suggestions without duplicates
  const existingNames = new Set(collections.map((c) => c.name.toLowerCase()));
  const availableSuggestions = SUGGESTED_COLLECTIONS.filter(
    (s) => !existingNames.has(s.toLowerCase()),
  );

  const handleSave = async () => {
    if (!isOnline()) { setSaveError(OFFLINE_MUTATION_MESSAGE); return; }
    if (isSaving) return;
    const finalCollection = isCreatingNew && newCollectionName.trim()
      ? newCollectionName.trim()
      : activeCollection;
    setSaveError(null);
    setIsSaving(true);
    try {
      await onSelectCollection(finalCollection, notes.trim() || undefined);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save café");
    } finally {
      setIsSaving(false);
    }
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div style={{ zIndex: 60 + layer * 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/65 backdrop-blur-xs"
            onClick={requestClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div 
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-surface p-6 shadow-2xl"
          >
            <ActionFeedback pending={isSaving} operationKey={`collection-save:${accountId}:${cafeName}`} label="Saving café…" />
            <ReadFeedback pending={isPending || refreshingCollections} operationKey={`collection-list:${accountId}`} label="Loading collections…" retry={refresh} />
            {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
              <FolderPlus className="size-3.5" />
              Save to Collection
            </span>
            <h3 id={titleId} className="mt-1.5 text-lg font-bold tracking-tight text-foreground line-clamp-1">
              {cafeName}
            </h3>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={isSaving}
            aria-label="Close dialog"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Collection Selector */}
        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Choose Collection
            </label>

            {/* List of existing collections */}
            {collectionsError && <p role="alert" className="mt-2 text-xs text-destructive">{collectionsError} <button type="button" disabled={refreshingCollections} onClick={() => { setRefreshingCollections(true); void refresh().catch(() => undefined).finally(() => setRefreshingCollections(false)); }} className="underline">Try again</button></p>}
            <div className="mt-2 grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto pr-1">
              {collections.map((col) => {
                const isSelected = !isCreatingNew && activeCollection.toLowerCase() === col.name.toLowerCase();
                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setActiveCollection(col.name);
                    }}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-all ${
                      isSelected
                        ? "border border-accent/40 bg-accent/15 text-accent shadow-xs"
                        : "border border-transparent hover:bg-background/80 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="truncate">{col.name}</span>
                      <span className="text-xs text-muted-foreground">({col.count})</span>
                    </div>
                    {isSelected && <Check className="size-4 shrink-0 text-accent" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick suggestions if user has few collections */}
          {availableSuggestions.length > 0 && !isCreatingNew && (
            <div>
              <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground mb-1.5">
                <Sparkles className="size-3 text-accent" />
                Suggestions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {availableSuggestions.slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setActiveCollection(suggestion);
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                      activeCollection.toLowerCase() === suggestion.toLowerCase()
                        ? "border-accent bg-accent/20 text-accent font-semibold"
                        : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Create new collection toggle */}
          {isCreatingNew ? (
            <div className="space-y-2 rounded-2xl border border-accent/30 bg-accent/5 p-3">
              <label className="text-xs font-semibold text-accent">
                New Collection Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="e.g. Weekend Brunch"
                  autoFocus
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-hidden"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSave();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-background"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:border-accent/60 hover:text-accent transition-colors"
            >
              <Plus className="size-3.5" />
              Create new collection
            </button>
          )}

          {/* Personal Note / Tip */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Personal Note (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Best iced latte, fast wifi on 2nd floor..."
              rows={2}
              className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-hidden"
            />
          </div>
        </div>

        {/* Footer Actions */}
        {!online && <p role="status" className="mt-4 text-xs text-muted-foreground">{OFFLINE_MUTATION_MESSAGE}</p>}
        {saveError && <p role="alert" className="mt-4 text-xs text-rose-400">{saveError}</p>}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/40 pt-4">
          <button
            type="button"
            onClick={requestClose}
            disabled={isSaving}
            className="rounded-xl px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-background transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            data-save-collection
            disabled={!online || isPending || isSaving || (isCreatingNew && !newCollectionName.trim())}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-accent-foreground shadow-md transition-all hover:brightness-110 active:scale-98 disabled:opacity-50"
          >
            {(isPending || isSaving) && <span aria-hidden="true">…</span>}
            Save Café
          </button>
        </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;

  return createPortal(content, document.body);
}
