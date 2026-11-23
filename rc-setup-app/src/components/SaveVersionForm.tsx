"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveVersionAction } from "@/app/models/[id]/actions";
import { btnPrimary, btnGhost, input } from "./PageHeader";

/** "Save as vN": snapshot the master with event, track and date (prefilled from the sheet's event boxes). */
export function SaveVersionForm({
  carModelId,
  nextVersion,
  defaults,
  versionsBase,
}: {
  carModelId: string;
  nextVersion: number;
  defaults: { name: string; track: string; eventDate: string };
  versionsBase: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaults.name);
  const [track, setTrack] = useState(defaults.track);
  const [eventDate, setEventDate] = useState(defaults.eventDate);
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className={btnPrimary}>
        Save master as v{nextVersion}
      </button>
    );

  return (
    <div className="space-y-2">
      <div className="text-sm text-ink-primary">Save master as <span className="font-mono text-accent">v{nextVersion}</span></div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Event, e.g. HTO club race" />
        <input className={input} value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Track" />
        <input className={input} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} aria-label="Date" />
      </div>
      <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional): what changed, how it felt" />
      <p className="text-xs text-ink-muted">Event, track and date are filled in from the sheet&apos;s event boxes when it has them.</p>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={pending}
          className={btnPrimary}
          onClick={() =>
            start(async () => {
              try {
                const v = await saveVersionAction(carModelId, { name, track, eventDate, notes });
                router.push(`${versionsBase}/${v.id}?view=summary`);
              } catch (e) {
                setError((e as Error).message);
              }
            })
          }
        >
          {pending ? "Saving…" : `Save v${nextVersion}`}
        </button>
        <button onClick={() => setOpen(false)} className={btnGhost}>Cancel</button>
      </div>
    </div>
  );
}
