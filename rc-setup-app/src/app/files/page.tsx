import Link from "next/link";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/rows";
import { PageHeader } from "@/components/PageHeader";
import { FILE_KINDS } from "@/lib/fileKinds";

export const dynamic = "force-dynamic";

type Row = { id: string; kind: string; title: string; size: number | null; model_id: string; model: string };
type ModelRow = { id: string; model: string; manufacturer: string; downloads_url: string | null };

/** Every model/year's reference files: manuals, parts lists, exploded views. */
export default async function FilesPage() {
  const files = await rows<Row>(sql`
    SELECT f.id, f.kind, f.title, f.size, m.id AS model_id, m.manufacturer || ' ' || m.name AS model
      FROM model_files f JOIN car_models m ON m.id = f.car_model_id
     ORDER BY m.manufacturer, m.model_name, m.year DESC NULLS LAST, f.kind, f.title`);
  const models = await rows<ModelRow>(sql`
    SELECT m.id, m.manufacturer || ' ' || m.name AS model, m.manufacturer, m.downloads_url
      FROM car_models m
     WHERE m.downloads_url IS NOT NULL OR EXISTS (SELECT 1 FROM model_files f WHERE f.car_model_id = m.id)
     ORDER BY m.manufacturer, m.model_name, m.year DESC NULLS LAST`);
  const byModel = new Map<string, Row[]>(models.map((m) => [m.id, []]));
  for (const f of files) byModel.set(f.model_id, [...(byModel.get(f.model_id) ?? []), f]);
  const info = new Map(models.map((m) => [m.id, m]));

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface-0 px-5 py-8">
      <PageHeader title="Files" sub="Manuals, parts lists and exploded views" back="/" />
      {byModel.size === 0 && (
        <p className="text-sm text-ink-muted">
          No files yet. Add them per model in <Link href="/admin" className="text-accent">Admin</Link>.
        </p>
      )}
      <div className="space-y-5">
        {[...byModel.entries()].map(([modelId, list]) => (
          <section key={modelId}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium text-ink-primary">{info.get(modelId)?.model}</h2>
              <div className="flex gap-3">
                {info.get(modelId)?.downloads_url && (
                  <a href={info.get(modelId)!.downloads_url!} target="_blank" rel="noreferrer" className="text-xs font-medium text-accent">
                    {info.get(modelId)!.manufacturer} downloads ↗
                  </a>
                )}
                <Link href={`/admin/models/${modelId}`} className="text-xs text-ink-muted hover:text-accent">Manage</Link>
              </div>
            </div>
            {list.length === 0 && <p className="text-sm text-ink-muted">No uploaded files yet.</p>}
            <ul className={`divide-y divide-line/60 rounded-md border border-line bg-surface-1 ${list.length ? "" : "hidden"}`}>
              {list.map((f) => (
                <li key={f.id}>
                  <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <span className="w-24 shrink-0 font-mono text-[10px] uppercase text-ink-muted">{FILE_KINDS[f.kind] ?? f.kind}</span>
                    <span className="flex-1 truncate text-sm text-ink-primary">{f.title}</span>
                    <span className="font-mono text-[11px] text-ink-muted">{f.size ? `${(f.size / 1048576).toFixed(1)} MB` : ""}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
