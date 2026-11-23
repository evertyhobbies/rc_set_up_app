import Link from "next/link";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/rows";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

type ModelRow = {
  id: string;
  manufacturer: string;
  name: string;
  car_class: string;
  scale: string | null;
  has_sheet: boolean;
  versions: number;
  latest: string | null;
  latest_date: string | null;
};
type LegacyCar = { id: string; nickname: string; manufacturer: string; model: string };

/** Model Select: the model/years you run, each with a master setup and version history. */
export default async function ModelsPage() {
  const models = await rows<ModelRow>(sql`
    SELECT m.id, m.manufacturer, m.name, m.car_class, m.scale,
           EXISTS (SELECT 1 FROM setup_templates t WHERE t.car_model_id = m.id AND t.sheet_name IS NOT NULL) AS has_sheet,
           (SELECT count(*)::int FROM setups s WHERE s.car_model_id = m.id AND s.version_no IS NOT NULL) AS versions,
           (SELECT 'v' || s.version_no || ' · ' || s.name FROM setups s WHERE s.car_model_id = m.id AND s.version_no IS NOT NULL ORDER BY s.version_no DESC LIMIT 1) AS latest,
           (SELECT to_char(s.event_date, 'YYYY-MM-DD') FROM setups s WHERE s.car_model_id = m.id AND s.version_no IS NOT NULL ORDER BY s.version_no DESC LIMIT 1) AS latest_date
      FROM car_models m
     WHERE EXISTS (SELECT 1 FROM setups s WHERE s.car_model_id = m.id AND s.is_master)
     ORDER BY m.manufacturer, m.model_name, m.year DESC NULLS LAST`);
  const legacy = await rows<LegacyCar>(sql`
    SELECT c.id, c.nickname, m.manufacturer, m.name AS model
      FROM cars c JOIN setup_templates t ON t.id = c.template_id JOIN car_models m ON m.id = t.car_model_id
     ORDER BY c.created_at DESC`);

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface-0 px-5 py-8">
      <PageHeader title="Model Select" sub="Your models: a master setup plus saved versions" back="/" />
      <Link
        href="/models/new"
        className="mb-4 flex items-center justify-center rounded-md border border-dashed border-accent/50 px-4 py-4 text-sm font-medium text-accent hover:bg-accent/5"
      >
        + Create new model
      </Link>

      <div className="flex flex-col gap-2">
        {models.map((m) => (
          <Link
            key={m.id}
            href={`/models/${m.id}`}
            className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-1 px-4 py-3 transition-colors hover:border-accent/40"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink-primary">{m.manufacturer} {m.name}</div>
              <div className="truncate text-xs text-ink-secondary">
                {m.latest ? `${m.latest}${m.latest_date ? ` · ${m.latest_date}` : ""}` : "Master only, no versions yet"}
              </div>
              {!m.has_sheet && <div className="mt-1 text-[11px] text-warn">No setup sheet yet: add it in Admin</div>}
            </div>
            <span className="shrink-0 font-mono text-xs text-ink-muted">{m.versions} version{m.versions === 1 ? "" : "s"} →</span>
          </Link>
        ))}
        {models.length === 0 && <p className="text-sm text-ink-muted">No models yet. Create one above.</p>}
      </div>

      {legacy.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-muted">Earlier cars (September layout)</h2>
          <div className="flex flex-col gap-2">
            {legacy.map((c) => (
              <Link key={c.id} href={`/cars/${c.id}`} className="rounded-md border border-line bg-surface-1 px-4 py-2.5 text-sm text-ink-secondary hover:border-accent/40">
                {c.nickname} <span className="text-ink-muted">· {c.manufacturer} {c.model}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
