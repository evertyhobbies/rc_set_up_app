"use client";

import { useState, useTransition } from "react";
import { saveSlots } from "@/app/admin/models/[id]/actions";
import { ZONES, ZONE_LABEL, type Slot, type Zone } from "@/lib/summarySlots";
import { btnGhost, btnPrimary, input } from "./PageHeader";

/** Edit which sheet boxes appear on the Summary, grouped by where they sit around the car. */
export function SlotEditor({
  templateId,
  path,
  boxes,
  initial,
  suggested,
}: {
  templateId: string;
  path: string;
  boxes: { name: string; label: string | null }[];
  initial: Slot[];
  suggested: Slot[];
}) {
  const [slots, setSlots] = useState<Slot[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const update = (next: Slot[]) => {
    setSlots(next);
    setDirty(true);
    setSaved(false);
  };
  const edit = (i: number, patch: Partial<Slot>) => update(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const sorted = [...boxes].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => update(suggested)}
          disabled={!suggested.length}
          className={btnGhost}
          title="Ride height, camber, toe, downstop, springs, oils, anti-roll bars, gearing, diffs and weight"
        >
          {slots.length ? "Reset to suggested layout" : "Fill suggested layout"} ({suggested.length})
        </button>
        <div className="flex-1" />
        {saved && !dirty && <span className="font-mono text-[11px] text-accent">Saved</span>}
        <button
          onClick={() => start(async () => { await saveSlots(templateId, slots, path); setDirty(false); setSaved(true); })}
          disabled={!dirty || pending}
          className={btnPrimary}
        >
          {pending ? "Saving…" : "Save layout"}
        </button>
      </div>

      {ZONES.map((zone) => {
        const rowsInZone = slots.map((s, i) => ({ s, i })).filter(({ s }) => s.zone === zone);
        return (
          <div key={zone}>
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-muted">{ZONE_LABEL[zone]}</div>
            <div className="space-y-1.5">
              {rowsInZone.map(({ s, i }) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_70px_auto_auto] items-center gap-1.5">
                  <select className={`${input} py-1.5 text-xs`} value={s.pdfField} onChange={(e) => edit(i, { pdfField: e.target.value })} aria-label="Sheet box">
                    {sorted.map((b) => (
                      <option key={b.name} value={b.name}>{b.name}{b.label ? ` · ${b.label}` : ""}</option>
                    ))}
                  </select>
                  <input className={`${input} py-1.5 text-xs`} value={s.label} onChange={(e) => edit(i, { label: e.target.value })} placeholder="Label" aria-label="Label" />
                  <input className={`${input} py-1.5 text-xs`} value={s.unit ?? ""} onChange={(e) => edit(i, { unit: e.target.value || null })} placeholder="unit" aria-label="Unit" />
                  <select className={`${input} py-1.5 text-xs`} value={s.zone} onChange={(e) => edit(i, { zone: e.target.value as Zone })} aria-label="Move to">
                    {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                  <button onClick={() => update(slots.filter((_, j) => j !== i))} className="px-2 text-ink-muted hover:text-red-300" aria-label="Remove">✕</button>
                </div>
              ))}
              <button
                onClick={() => update([...slots, { zone, pdfField: sorted[0]?.name ?? "", label: "", unit: null }])}
                className="text-xs font-medium text-accent"
              >
                + Add to {ZONE_LABEL[zone].toLowerCase()}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
