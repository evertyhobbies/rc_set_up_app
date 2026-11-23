"use client";

import { useState, useTransition } from "react";
import { createSetup, deleteCar, deleteSetup } from "@/app/cars/[carId]/actions";
import { btnPrimary, btnGhost, btnDanger, input } from "./PageHeader";

export function NewSetupForm({
  carId,
  setups,
  defaultCopyFrom,
}: {
  carId: string;
  setups: { id: string; name: string }[];
  defaultCopyFrom?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"base" | "race">("race");
  const [track, setTrack] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [copyFromId, setCopyFromId] = useState(defaultCopyFrom ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) return <button onClick={() => setOpen(true)} className={btnPrimary}>+ New setup</button>;

  return (
    <section className="rounded-md border border-line bg-surface-1 p-4">
      <h2 className="mb-3 text-sm font-medium text-ink-primary">New setup</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={input} placeholder="Name, e.g. HTO club race" value={name} onChange={(e) => setName(e.target.value)} />
        <select className={input} value={kind} onChange={(e) => setKind(e.target.value as "base" | "race")}>
          <option value="race">Race-day setup</option>
          <option value="base">Base setup</option>
        </select>
        <input className={input} placeholder="Track (optional)" value={track} onChange={(e) => setTrack(e.target.value)} />
        <input className={input} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        <select className={`${input} sm:col-span-2`} value={copyFromId} onChange={(e) => setCopyFromId(e.target.value)}>
          <option value="">Start blank</option>
          {setups.map((s) => (
            <option key={s.id} value={s.id}>Copy all values from {s.name}</option>
          ))}
        </select>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending || !name.trim()}
          className={btnPrimary}
          onClick={() =>
            start(async () => {
              const res = await createSetup(carId, { name, kind, track, eventDate, copyFromId: copyFromId || undefined });
              if (res?.error) setError(res.error);
            })
          }
        >
          {pending ? "Creating…" : "Create setup"}
        </button>
        <button onClick={() => setOpen(false)} className={btnGhost}>Cancel</button>
      </div>
    </section>
  );
}

export function DeleteButton({
  kind,
  carId,
  setupId,
  label,
  confirmText,
}: {
  kind: "car" | "setup";
  carId: string;
  setupId?: string;
  label: string;
  confirmText: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  // Two-step button instead of window.confirm()
  if (!armed) return <button onClick={() => setArmed(true)} className={btnDanger}>{label}</button>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-secondary">{confirmText} This can&apos;t be undone.</span>
      <button
        disabled={pending}
        className={btnDanger}
        onClick={() => start(() => (kind === "car" ? deleteCar(carId) : deleteSetup(carId, setupId!)))}
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button onClick={() => setArmed(false)} className={btnGhost}>Keep</button>
    </div>
  );
}
