"use client";

import { PendingFeedback } from "./pending-feedback";

export function ActionFeedback({ pending, operationKey, label = "Saving changes…", onRefresh }: {
  pending: boolean;
  operationKey: string;
  label?: string;
  onRefresh?: () => void;
}) {
  return <PendingFeedback pending={pending} operationKey={operationKey} kind="mutation" label={label} onRefresh={onRefresh ?? (() => {
    if (window.confirm("Refresh this page? Your action may still complete. Unsaved changes will be lost.")) window.location.reload();
  })} />;
}
