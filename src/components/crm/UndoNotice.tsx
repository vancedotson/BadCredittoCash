"use client";

import { useEffect, useState } from "react";

export type UndoNoticeState = {
  id: number;
  message: string;
  undo: () => Promise<void> | void;
};

export function UndoNotice({ notice, onDismiss }: { notice: UndoNoticeState | null; onDismiss: () => void }) {
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;

  async function runUndo() {
    const current = notice;
    if (!current) return;
    setUndoing(true);
    try {
      await current.undo();
    } finally {
      onDismiss();
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl bg-navy px-4 py-3 text-sm text-white shadow-card"
    >
      <span>{notice.message}</span>
      <button type="button" disabled={undoing} onClick={runUndo} className="font-semibold text-gold underline underline-offset-2 disabled:opacity-60">
        {undoing ? "Undoing…" : "Undo"}
      </button>
      <button type="button" onClick={onDismiss} className="px-1 text-white/70 hover:text-white" aria-label="Dismiss undo message">×</button>
    </div>
  );
}
