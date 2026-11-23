"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extractFilledValues, toIsoDate, type Extracted, type TemplateBox } from "@/lib/pdfValues";
import { btnGhost, btnPrimary, input } from "./PageHeader";

type Context = { pages: { page_index: number; width: number; height: number }[]; widgets: TemplateBox[] };

const pretty = (s: string) => {
  const t = s.replace(/[_.\-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const pick = (values: Record<string, string>, re: RegExp) =>
  Object.entries(values).find(([k]) => re.test(k.toLowerCase()))?.[1] ?? "";

/** Read a filled-in setup sheet (fillable or flattened) and save it as the next version. */
export function ImportFilledSheet({ carModelId, templateId, nextVersion }: { carModelId: string; templateId: string; nextVersion: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [ctx, setCtx] = useState<Context | null>(null);
  const [result, setResult] = useState<Extracted | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [name, setName] = useState("");
  const [track, setTrack] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(f?: File) {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setBusy(true);
    try {
      const c: Context =
        ctx ??
        (await fetch(`/api/templates/${templateId}/ai/context`).then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error ?? "Couldn't load the sheet layout");
          return d as Context;
        }));
      setCtx(c);
      const res = await extractFilledValues(f, c.widgets, c.pages);
      setResult(res);
      const v = res.values;
      setName(pick(v, /^(race|event|event[-_ ]?name)$/) || f.name.replace(/\.pdf$/i, "").replace(/[_]+/g, " "));
      setTrack(pick(v, /^track$/));
      setEventDate(toIsoDate(pick(v, /^(date|event[-_ ]?date)$/)));
    } catch (e) {
      setError(`Couldn't read that PDF: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/models/${carModelId}/import-version`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, track, eventDate, notes, values: result.values }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Import failed");
      router.push(`/models/${carModelId}/setups/${d.id}?view=summary`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!open) return <button onClick={() => setOpen(true)} className={btnGhost}>Import filled sheet as v{nextVersion}</button>;

  const entries = result ? Object.entries(result.values) : [];
  const boxCount = ctx ? new Set(ctx.widgets.map((w) => w.pdf_field)).size : 0;
  const kindOf = new Map(ctx?.widgets.map((w) => [w.pdf_field, w.kind]) ?? []);

  return (
    <div className="space-y-3 rounded-md border border-line bg-surface-2 p-3">
      <div className="text-sm text-ink-primary">
        Import a filled-in setup sheet as <span className="font-mono text-accent">v{nextVersion}</span>
      </div>
      <p className="text-xs text-ink-secondary">
        Works with fillable PDFs and with flattened ones (filled in, then printed or saved as PDF). The master isn&apos;t changed.
      </p>
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-line px-4 py-5 text-center hover:border-accent/50">
        <span className="text-sm font-medium text-ink-primary">{file ? file.name : "Choose filled-in sheet (PDF)"}</span>
        <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={busy} onChange={(e) => choose(e.target.files?.[0])} />
      </label>
      {busy && !result && <p className="text-sm text-ink-secondary">Reading the sheet…</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {result && (
        <>
          {result.pageMismatch && (
            <p className="text-sm text-warn">This PDF&apos;s page size differs from the template&apos;s, so values may land in the wrong boxes. Check the list below.</p>
          )}
          <div className="font-mono text-xs text-ink-secondary">
            {result.mode === "fillable" ? "Fillable PDF" : "Flattened PDF"} · {entries.length} of {boxCount} boxes filled
            {result.unplaced.length > 0 && ` · ${result.unplaced.length} text pieces not placed`}
          </div>
          {entries.length === 0 ? (
            <p className="text-sm text-warn">No values found. Is this a filled-in copy of this model&apos;s setup sheet?</p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded border border-line">
              <table className="w-full text-xs">
                <tbody>
                  {(showAll ? entries : entries.slice(0, 14)).map(([k, v]) => (
                    <tr key={k} className="border-b border-line/50 last:border-0">
                      <td className="px-2 py-1 text-ink-secondary">{pretty(k)}</td>
                      <td className="px-2 py-1 text-right font-mono text-ink-primary">
                        {kindOf.get(k) === "checkbox" || kindOf.get(k) === "radio" ? `✓ ${v === "Yes" ? "" : v}` : v.split("\n").join(" / ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {entries.length > 14 && (
                <button onClick={() => setShowAll(!showAll)} className="w-full py-1.5 text-xs text-accent">
                  {showAll ? "Show fewer" : `Show all ${entries.length}`}
                </button>
              )}
            </div>
          )}
          {result.unplaced.length > 0 && (
            <details className="text-xs text-ink-muted">
              <summary className="cursor-pointer">Text that didn&apos;t land in a box</summary>
              <div className="mt-1">{result.unplaced.join(" · ")}</div>
            </details>
          )}
          {entries.length > 0 && (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Event" aria-label="Event" />
                <input className={input} value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Track" aria-label="Track" />
                <input className={input} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} aria-label="Date" />
              </div>
              <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional), e.g. whose setup this is" />
            </>
          )}
        </>
      )}
      <div className="flex gap-2">
        {result && entries.length > 0 && (
          <button onClick={create} disabled={busy} className={btnPrimary}>{busy ? "Saving…" : `Create v${nextVersion}`}</button>
        )}
        <button onClick={() => { setOpen(false); setResult(null); setFile(null); }} className={btnGhost}>Cancel</button>
      </div>
    </div>
  );
}
