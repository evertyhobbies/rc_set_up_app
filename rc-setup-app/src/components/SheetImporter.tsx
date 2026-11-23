"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseSetupPdf, type ParsedSheet } from "@/lib/pdfImport";
import { btnPrimary, input } from "./PageHeader";

/** Upload an editable setup-sheet PDF; parsing and page rendering happen in the browser. */
export function SheetImporter({
  templateId,
  defaultName,
  setups,
  doneHref,
}: {
  templateId: string;
  defaultName: string;
  setups: { id: string; name: string }[];
  doneHref: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState(defaultName);
  const [valuesInto, setValuesInto] = useState(setups[0]?.id ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function choose(f?: File) {
    if (!f) return;
    setError(null);
    setParsed(null);
    setFile(f);
    setBusy(true);
    try {
      const p = await parseSetupPdf(f, setStatus);
      setParsed(p);
      setPreview(URL.createObjectURL(p.pages[0].image));
    } catch (e) {
      setError(`Couldn't read that PDF: ${(e as Error).message}`);
    } finally {
      setStatus(null);
      setBusy(false);
    }
  }

  async function save() {
    if (!parsed || !file) return;
    setBusy(true);
    setError(null);
    try {
      setStatus("Saving sheet layout…");
      const res = await fetch(`/api/templates/${templateId}/sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetName,
          filename: file.name,
          pages: parsed.pages.map(({ width, height }) => ({ width, height })),
          widgets: parsed.widgets,
          values: valuesInto ? parsed.values : undefined,
          setupId: valuesInto || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      for (let i = 0; i < parsed.pages.length; i++) {
        setStatus(`Uploading page ${i + 1} of ${parsed.pages.length}…`);
        const up = await fetch(`/api/templates/${templateId}/sheet/pages/${i}`, {
          method: "PUT",
          headers: { "Content-Type": "image/jpeg" },
          body: parsed.pages[i].image,
        });
        if (!up.ok) throw new Error((await up.json().catch(() => ({}))).error ?? "Image upload failed");
      }
      router.push(doneHref);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setStatus(null);
      setBusy(false);
    }
  }

  const valueCount = parsed ? Object.keys(parsed.values).length : 0;

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-line bg-surface-2 px-4 py-7 text-center hover:border-accent/50">
        <span className="text-sm font-medium text-ink-primary">{file ? file.name : "Choose setup sheet PDF"}</span>
        <span className="text-xs text-ink-muted">Use the editable (fillable) version</span>
        <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={busy} onChange={(e) => choose(e.target.files?.[0])} />
      </label>

      {status && <p className="text-sm text-ink-secondary">{status}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}
      {parsed && parsed.fieldCount === 0 && (
        <p className="text-sm text-warn">
          This PDF has no fillable boxes. Download the &quot;Editable&quot; setup sheet and upload that one.
        </p>
      )}

      {parsed && parsed.fieldCount > 0 && (
        <div className="space-y-3 rounded-md border border-line bg-surface-2 p-4">
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-ink-secondary">
            <span>{parsed.pages.length} page{parsed.pages.length === 1 ? "" : "s"}</span>
            <span>{parsed.fieldCount} fillable boxes</span>
            <span>{valueCount} already filled</span>
          </div>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Sheet preview" className="max-h-60 w-full rounded bg-white object-contain" />
          )}
          <input className={input} value={sheetName} onChange={(e) => setSheetName(e.target.value)} aria-label="Sheet name" />
          {valueCount > 0 && setups.length > 0 && (
            <select className={input} value={valuesInto} onChange={(e) => setValuesInto(e.target.value)}>
              <option value="">Don&apos;t import the filled-in values</option>
              {setups.map((s) => (
                <option key={s.id} value={s.id}>Put the {valueCount} filled-in values into “{s.name}”</option>
              ))}
            </select>
          )}
          <button onClick={save} disabled={busy || !sheetName.trim()} className={btnPrimary}>
            {busy ? "Saving…" : "Save setup sheet"}
          </button>
        </div>
      )}
    </div>
  );
}
