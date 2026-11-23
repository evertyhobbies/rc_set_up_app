import Link from "next/link";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/rows";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  manufacturer: string;
  name: string;
  car_class: string;
  scale: string | null;
  has_sheet: boolean;
  files: number;
  versions: number;
  slots: number;
  downloads_url: string | null;
};

/** Admin: the model database. One row per model/year. */
export default async function AdminPage() {
  const models = await rows<Row>(sql`
    SELECT m.id, m.manufacturer, m.name, m.car_class, m.scale, m.downloads_url,
           EXISTS (SELECT 1 FROM setup_templates t WHERE t.car_model_id = m.id AND t.sheet_name IS NOT NULL) AS has_sheet,
           (SELECT count(*)::int FROM model_files f WHERE f.car_model_id = m.id) AS files,
           (SELECT count(*)::int FROM setups s WHERE s.car_model_id = m.id AND s.version_no IS NOT NULL) AS versions,
           (SELECT count(*)::int FROM summary_slots ss JOIN setup_templates t ON t.id = ss.template_id WHERE t.car_model_id = m.id) AS slots
      FROM car_models m
     ORDER BY m.manufacturer, m.model_name, m.year DESC NULLS LAST`);

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface-0 px-5 py-8">
      <PageHeader title="Admin · Model database" sub="Setup sheets, files and summary layouts per model/year" back="/" />
      <Link
        href="/models/new?admin=1"
        className="mb-4 flex items-center justify-center rounded-md border border-dashed border-accent/50 px-4 py-4 text-sm font-medium text-accent hover:bg-accent/5"
      >
        + Add model
      </Link>
      <div className="flex flex-col gap-2">
        {models.map((m) => (
          <Link
            key={m.id}
            href={`/admin/models/${m.id}`}
            className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-1 px-4 py-3 transition-colors hover:border-accent/40"
          >
            <div>
              <div className="text-sm font-medium text-ink-primary">{m.manufacturer} {m.name}</div>
              <div className="text-xs text-ink-secondary">{m.car_class}{m.scale ? ` · ${m.scale}` : ""}</div>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5 font-mono text-[10px]">
              <span className={`rounded border px-1.5 py-0.5 ${m.has_sheet ? "border-accent/40 text-accent" : "border-line text-ink-muted"}`}>
                {m.has_sheet ? "sheet ✓" : "no sheet"}
              </span>
              <span className="rounded border border-line px-1.5 py-0.5 text-ink-muted">{m.files} files</span>
              {m.downloads_url && <span className="rounded border border-line px-1.5 py-0.5 text-ink-muted">link ✓</span>}
              <span className="rounded border border-line px-1.5 py-0.5 text-ink-muted">{m.slots} summary</span>
              <span className="rounded border border-line px-1.5 py-0.5 text-ink-muted">v{m.versions}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
