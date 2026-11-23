"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, btnGhost, input } from "./PageHeader";

type Widget = {
  pdf_field: string;
  kind: string;
  export_value: string | null;
  options: { value: string; label: string }[] | null;
  page_index: number;
  x: number;
  y: number;
  w: number;
  h: number;
};
type Existing = { key: string; label: string; unit: string | null; scope: string };
type Context = { pages: { page_index: number; width: number; height: number }[]; widgets: Widget[]; existing: Existing[]; aiConfigured: boolean };
type Rect = { page: number; x: number; y: number; w: number; h: number };
type Layout = Rect & { key: string; label: string };
type Link = { field_key: string; corner: "FL" | "FR" | "RL" | "RR" | null; axle: "front" | "rear" | null } | null;
type Field = {
  pdf_field: string;
  label: string;
  unit: string | null;
  tier: "main" | "detail";
  order: number;
  link: Link;
  choices: { export_value: string; label: string }[];
};
type Proposal = Layout & { fields: Field[]; error?: string };

const MAX_EDGE = 2400; // stays under the model's native 2,576 px long edge
const CONCURRENCY = 4;

async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the sheet image"));
    img.src = src;
  });
}

/** Assign each box to the section containing its center (smallest wins), else the nearest section on its page. */
function assign(widgets: Widget[], sections: Layout[]) {
  const out = new Map<string, Widget[]>(sections.map((s) => [s.key, []]));
  for (const w of widgets) {
    const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    const onPage = sections.filter((s) => s.page === w.page_index);
    if (!onPage.length) continue;
    const inside = onPage.filter((s) => cx >= s.x && cx <= s.x + s.w && cy >= s.y && cy <= s.y + s.h).sort((a, b) => a.w * a.h - b.w * b.h);
    const dist = (s: Layout) => Math.hypot(Math.max(s.x - cx, 0, cx - s.x - s.w), Math.max(s.y - cy, 0, cy - s.y - s.h));
    const target = inside[0] ?? [...onPage].sort((a, b) => dist(a) - dist(b))[0];
    out.get(target.key)!.push(w);
  }
  return out;
}

/** Close-up of one section with every box outlined and numbered, plus box positions relative to the crop. */
function closeUp(img: HTMLImageElement, s: Layout, boxes: Widget[]) {
  // Grow the crop so every assigned box is fully inside it
  const x0 = Math.max(0, Math.min(s.x, ...boxes.map((b) => b.x)) - 0.01);
  const y0 = Math.max(0, Math.min(s.y, ...boxes.map((b) => b.y)) - 0.01);
  const x1 = Math.min(1, Math.max(s.x + s.w, ...boxes.map((b) => b.x + b.w)) + 0.01);
  const y1 = Math.min(1, Math.max(s.y + s.h, ...boxes.map((b) => b.y + b.h)) + 0.01);
  const sw = (x1 - x0) * img.naturalWidth, sh = (y1 - y0) * img.naturalHeight;
  const scale = Math.min(MAX_EDGE / Math.max(sw, sh), 1.5);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, x0 * img.naturalWidth, y0 * img.naturalHeight, sw, sh, 0, 0, canvas.width, canvas.height);

  const rel = boxes.map((b, i) => ({
    n: i + 1,
    name: b.pdf_field,
    kind: b.kind,
    exportValues: b.export_value ? [b.export_value] : [],
    options: (b.options ?? []).map((o) => o.label),
    x: (b.x - x0) / (x1 - x0),
    y: (b.y - y0) / (y1 - y0),
    w: b.w / (x1 - x0),
    h: b.h / (y1 - y0),
  }));
  const font = Math.max(11, Math.round(canvas.width / 110));
  ctx.lineWidth = Math.max(2, canvas.width / 900);
  ctx.font = `bold ${font}px sans-serif`;
  for (const b of rel) {
    const bx = b.x * canvas.width, by = b.y * canvas.height;
    ctx.strokeStyle = "#e0119d";
    ctx.strokeRect(bx, by, b.w * canvas.width, b.h * canvas.height);
    const tag = `#${b.n}`;
    const tw = ctx.measureText(tag).width + 4;
    ctx.fillStyle = "#e0119d";
    ctx.fillRect(bx, by - font - 2, tw, font + 2);
    ctx.fillStyle = "#fff";
    ctx.fillText(tag, bx + 2, by - 3);
  }
  const b64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
  return { b64, boxes: rel, rect: { page: s.page, x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}

export function AiBuilder({ templateId, doneHref }: { templateId: string; doneHref: string }) {
  const router = useRouter();
  const [ctx, setCtx] = useState<Context | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Context>(`/api/templates/${templateId}/ai/context`).then(setCtx).catch((e) => setError(e.message));
  }, [templateId]);

  async function run() {
    if (!ctx) return;
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      setStatus("Reading the whole sheet and finding its sections…");
      const { sections } = await api<{ sections: Layout[] }>(`/api/templates/${templateId}/ai/layout`, {});
      if (!sections.length) throw new Error("The AI didn't find any sections");
      const images = new Map<number, HTMLImageElement>();
      for (const p of ctx.pages) images.set(p.page_index, await loadImage(`/api/templates/${templateId}/sheet/pages/${p.page_index}`));
      const groups = assign(ctx.widgets, sections);
      const todo = sections.filter((s) => (groups.get(s.key) ?? []).length && images.has(s.page));

      const results: Proposal[] = [];
      let done = 0;
      setStatus(`Reading ${todo.length} sections up close… (0/${todo.length})`);
      const queue = [...todo];
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
          for (let s = queue.shift(); s; s = queue.shift()) {
            const shot = closeUp(images.get(s.page)!, s, groups.get(s.key)!);
            try {
              const { fields } = await api<{ fields: Field[] }>(`/api/templates/${templateId}/ai/section`, {
                section: { key: s.key, label: s.label },
                image: shot.b64,
                boxes: shot.boxes,
              });
              results.push({ ...s, ...shot.rect, fields });
            } catch (e) {
              results.push({ ...s, ...shot.rect, fields: [], error: (e as Error).message });
            }
            setStatus(`Reading ${todo.length} sections up close… (${++done}/${todo.length})`);
          }
        })
      );
      const order = new Map(sections.map((s, i) => [s.key, i]));
      results.sort((a, b) => order.get(a.key)! - order.get(b.key)!);
      setProposal(results);
      setStatus(null);
    } catch (e) {
      setError((e as Error).message);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!proposal) return;
    setBusy(true);
    setError(null);
    try {
      setStatus("Saving the setup layout…");
      await api(`/api/templates/${templateId}/ai/apply`, { sections: proposal.map(({ error: _e, ...p }) => p) });
      router.push(doneHref);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setStatus(null);
      setBusy(false);
    }
  }

  const edit = (si: number, fi: number, patch: Partial<Field>) =>
    setProposal((p) => p && p.map((s, i) => (i !== si ? s : { ...s, fields: s.fields.map((f, j) => (j === fi ? { ...f, ...patch } : f)) })));

  if (!ctx && !error) return <p className="text-sm text-ink-muted">Loading sheet…</p>;

  const failed = proposal?.filter((p) => p.error) ?? [];
  const fieldCount = proposal?.reduce((n, s) => n + s.fields.length, 0) ?? 0;
  const linkCount = proposal?.reduce((n, s) => n + s.fields.filter((f) => f.link).length, 0) ?? 0;

  return (
    <div className="space-y-4">
      {ctx && !ctx.aiConfigured && (
        <div className="rounded-md border border-warn/50 bg-warn/5 p-4 text-sm text-ink-secondary">
          <div className="font-medium text-warn">AI isn&apos;t set up yet</div>
          Add an <span className="font-mono text-ink-primary">ANTHROPIC_API_KEY</span> environment variable in Vercel (Project → Settings →
          Environment Variables, for Production and Preview), then redeploy. You can create a key in the Anthropic Console.
        </div>
      )}

      {ctx && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={run} disabled={busy || !ctx.aiConfigured} className={btnPrimary}>
            {proposal ? "Run again" : "Build setup with AI"}
          </button>
          <span className="font-mono text-xs text-ink-muted">
            {ctx.pages.length} page{ctx.pages.length === 1 ? "" : "s"} · {new Set(ctx.widgets.map((w) => w.pdf_field)).size} boxes · {ctx.existing.length} summary fields
          </span>
        </div>
      )}
      {status && <p className="text-sm text-accent">{status}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {proposal && (
        <>
          <div className="sticky top-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-b border-line bg-surface-0/95 px-5 py-3 backdrop-blur">
            <span className="text-sm text-ink-primary">
              {proposal.length} sections · {fieldCount} fields · {linkCount} linked to summary
            </span>
            {failed.length > 0 && <span className="text-sm text-warn">{failed.length} section(s) failed: run again or apply the rest</span>}
            <div className="flex-1" />
            <button onClick={apply} disabled={busy} className={btnPrimary}>Apply</button>
          </div>
          {proposal.map((s, si) => (
            <ReviewCard key={s.key} templateId={templateId} pages={ctx!.pages} section={s} existing={ctx!.existing} onEdit={(fi, patch) => edit(si, fi, patch)}
              onRename={(label) => setProposal((p) => p && p.map((x, i) => (i === si ? { ...x, label } : x)))} />
          ))}
          <div className="flex justify-end gap-2">
            <button onClick={run} disabled={busy} className={btnGhost}>Run again</button>
            <button onClick={apply} disabled={busy} className={btnPrimary}>Apply</button>
          </div>
        </>
      )}
    </div>
  );
}

function linkValue(l: Link) {
  if (!l) return "";
  return `${l.field_key}|${l.axle ? `axle:${l.axle}` : l.corner ?? ""}`;
}
function parseLink(v: string): Link {
  if (!v) return null;
  const [field_key, where] = v.split("|");
  if (where?.startsWith("axle:")) return { field_key, corner: null, axle: where.slice(5) as "front" | "rear" };
  return { field_key, corner: (where || null) as "FL" | "FR" | "RL" | "RR" | null, axle: null };
}

function ReviewCard({
  templateId,
  pages,
  section: s,
  existing,
  onEdit,
  onRename,
}: {
  templateId: string;
  pages: Context["pages"];
  section: Proposal;
  existing: Existing[];
  onEdit: (fi: number, patch: Partial<Field>) => void;
  onRename: (label: string) => void;
}) {
  const page = pages.find((p) => p.page_index === s.page);
  const linkOptions = existing.flatMap((e) =>
    e.scope === "corner"
      ? [
          { value: `${e.key}|axle:front`, label: `${e.label} · front axle (FL+FR)` },
          { value: `${e.key}|axle:rear`, label: `${e.label} · rear axle (RL+RR)` },
          ...(["FL", "FR", "RL", "RR"] as const).map((c) => ({ value: `${e.key}|${c}`, label: `${e.label} · ${c}` })),
        ]
      : [{ value: `${e.key}|`, label: e.label }]
  );
  return (
    <section className="rounded-md border border-line bg-surface-1">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <input className={`${input} max-w-xs py-1`} value={s.label} onChange={(e) => onRename(e.target.value)} aria-label="Section name" />
        <span className="font-mono text-[11px] text-ink-muted">{s.fields.length} fields</span>
        {s.error && <span className="text-xs text-red-300">{s.error}</span>}
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        {page && (
          <div
            className="self-start rounded border border-line bg-white"
            style={{
              aspectRatio: `${s.w * page.width} / ${s.h * page.height}`,
              backgroundImage: `url(/api/templates/${templateId}/sheet/pages/${s.page})`,
              backgroundSize: `${100 / s.w}% ${100 / s.h}%`,
              backgroundPosition: `${s.w < 1 ? (s.x / (1 - s.w)) * 100 : 0}% ${s.h < 1 ? (s.y / (1 - s.h)) * 100 : 0}%`,
            }}
          />
        )}
        <div className="space-y-1.5">
          <div className="hidden grid-cols-[1.4fr_0.5fr_0.6fr_1.4fr] gap-1.5 px-0.5 font-mono text-[10px] uppercase text-ink-muted md:grid">
            <span>Label</span><span>Unit</span><span>Tier</span><span>Stored in</span>
          </div>
          {s.fields
            .map((f, fi) => ({ f, fi }))
            .sort((a, b) => a.f.order - b.f.order)
            .map(({ f, fi }) => (
              <div key={f.pdf_field} className="rounded border border-line/60 p-1.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[10px] text-ink-muted">{f.pdf_field}</span>
                  {f.choices.length > 0 && (
                    <span className="truncate text-[10px] text-ink-secondary">{f.choices.map((c) => c.label).join(" · ")}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 md:grid-cols-[1.4fr_0.5fr_0.6fr_1.4fr]">
                  <input className={`${input} py-1 text-xs`} value={f.label} onChange={(e) => onEdit(fi, { label: e.target.value })} aria-label="Label" />
                  <input className={`${input} py-1 text-xs`} value={f.unit ?? ""} placeholder="unit" onChange={(e) => onEdit(fi, { unit: e.target.value || null })} aria-label="Unit" />
                  <select className={`${input} py-1 text-xs`} value={f.tier} onChange={(e) => onEdit(fi, { tier: e.target.value as Field["tier"] })} aria-label="Tier">
                    <option value="main">Main</option>
                    <option value="detail">Detail</option>
                  </select>
                  <select
                    className={`${input} py-1 text-xs ${f.link ? "border-accent/60 text-accent" : ""}`}
                    value={linkValue(f.link)}
                    onChange={(e) => onEdit(fi, { link: parseLink(e.target.value) })}
                    aria-label="Stored in"
                  >
                    <option value="">Its own field</option>
                    {linkOptions.map((o) => (
                      <option key={o.value} value={o.value}>Summary: {o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
