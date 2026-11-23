"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { btnPrimary, input } from "./PageHeader";

export const FILE_KINDS: Record<string, string> = {
  manual: "Manual",
  parts_list: "Parts list",
  exploded_view: "Exploded view",
  setup_sheet: "Setup sheet (PDF copy)",
  other: "Other",
};

type FileRow = { id: string; kind: string; title: string; filename: string; size: number | null; createdAt: string };

const mb = (n: number | null) => (n ? `${(n / 1024 / 1024).toFixed(1)} MB` : "");

/** Upload and list a model/year's reference files (private Vercel Blob). */
export function FileManager({ carModelId, files, readOnly = false }: { carModelId: string; files: FileRow[]; readOnly?: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState("manual");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function send() {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const blob = await upload(`models/${carModelId}/${safe}`, file, {
        access: "private",
        handleUploadUrl: "/api/files/upload",
        contentType: file.type || "application/pdf",
        multipart: file.size > 20 * 1024 * 1024,
        onUploadProgress: (p) => setProgress(Math.round(p.percentage)),
      });
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carModelId,
          kind,
          title: title.trim() || FILE_KINDS[kind],
          filename: file.name,
          pathname: blob.pathname,
          contentType: blob.contentType,
          size: file.size,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save the file record");
      setFile(null);
      setTitle("");
      setProgress(null);
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      setError(/token|BLOB_|store/i.test(msg) ? `File storage isn't connected yet (${msg}). Connect a Vercel Blob store to this project.` : msg);
      setProgress(null);
    }
  }

  async function remove(id: string) {
    setRemoving(id);
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    setRemoving(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {files.length > 0 ? (
        <ul className="divide-y divide-line/60 rounded-md border border-line">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-24 shrink-0 font-mono text-[10px] uppercase text-ink-muted">{FILE_KINDS[f.kind] ?? f.kind}</span>
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-ink-primary hover:text-accent">
                {f.title}
              </a>
              <span className="font-mono text-[11px] text-ink-muted">{mb(f.size)}</span>
              <a href={`/api/files/${f.id}?download=1`} className="text-xs text-accent">Download</a>
              {!readOnly &&
                (removing === f.id ? (
                  <span className="text-xs text-ink-muted">Removing…</span>
                ) : (
                  <button onClick={() => remove(f.id)} className="text-xs text-ink-muted hover:text-red-300">Remove</button>
                ))}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No files yet.</p>
      )}

      {!readOnly && (
        <div className="grid gap-2 rounded-md border border-dashed border-line p-3 sm:grid-cols-[150px_1fr_1fr_auto]">
          <select className={input} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="File type">
            {Object.entries(FILE_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Title (default: ${FILE_KINDS[kind]})`} />
          <input
            className={`${input} py-1.5 file:mr-2 file:rounded file:border-0 file:bg-surface-1 file:px-2 file:py-1 file:text-xs file:text-ink-primary`}
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button onClick={send} disabled={!file || progress !== null} className={btnPrimary}>
            {progress !== null ? `${progress}%` : "Upload"}
          </button>
          {error && <p className="text-sm text-red-300 sm:col-span-4">{error}</p>}
        </div>
      )}
    </div>
  );
}
