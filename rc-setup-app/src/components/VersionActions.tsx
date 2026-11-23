"use client";

import { useState, useTransition } from "react";
import { loadIntoMaster, deleteVersion } from "@/app/models/[id]/actions";
import { btnGhost, btnDanger } from "./PageHeader";

/** A saved version is read-only: load it into the master to change it, or delete it. */
export function VersionActions({ carModelId, versionId, versionNo }: { carModelId: string; versionId: string; versionNo: number }) {
  const [confirm, setConfirm] = useState<null | "load" | "delete">(null);
  const [pending, start] = useTransition();

  if (confirm)
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-1 px-3 py-2 text-sm">
        <span className="text-ink-secondary">
          {confirm === "load"
            ? `Replace the master's values with v${versionNo}'s? Save the master as a version first if you want to keep it.`
            : `Delete v${versionNo}? This can't be undone.`}
        </span>
        <button
          disabled={pending}
          className={confirm === "load" ? btnGhost : btnDanger}
          onClick={() => start(() => (confirm === "load" ? loadIntoMaster(carModelId, versionId) : deleteVersion(carModelId, versionId)))}
        >
          {pending ? "Working…" : confirm === "load" ? "Yes, load into master" : "Yes, delete"}
        </button>
        <button onClick={() => setConfirm(null)} className={btnGhost}>Cancel</button>
      </div>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded border border-line px-2 py-1 font-mono text-[11px] text-ink-muted">Read-only version</span>
      <button onClick={() => setConfirm("load")} className={btnGhost}>Load into master</button>
      <button onClick={() => setConfirm("delete")} className={btnDanger}>Delete</button>
    </div>
  );
}
