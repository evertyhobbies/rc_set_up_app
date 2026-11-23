import Link from "next/link";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/rows";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  nickname: string;
  manufacturer: string;
  model: string;
  car_class: string;
  scale: string | null;
  has_sheet: boolean;
  setup_count: number;
};

// Model Select: your garage. (This was the old "/" Garage page.)
export default async function ModelsPage() {
  const cars = await rows<Row>(sql`
    SELECT c.id, c.nickname, m.manufacturer, m.name AS model, m.car_class, m.scale,
           (t.sheet_name IS NOT NULL) AS has_sheet,
           (SELECT count(*)::int FROM setups s WHERE s.car_id = c.id) AS setup_count
      FROM cars c
      JOIN setup_templates t ON t.id = c.template_id
      JOIN car_models m      ON m.id = t.car_model_id
     ORDER BY c.created_at DESC`);

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface-0 px-5 py-8">
      <PageHeader title="Model Select" sub="Your cars" back="/" />

      <Link
        href="/models/new"
        className="mb-4 flex items-center justify-center gap-2 rounded-md border border-dashed border-accent/50 px-4 py-4 text-sm font-medium text-accent hover:bg-accent/5"
      >
        + Create new model
      </Link>

      <div className="flex flex-col gap-2">
        {cars.map((car) => (
          <Link
            key={car.id}
            href={`/cars/${car.id}`}
            className="flex items-center justify-between rounded-md border border-line bg-surface-1 px-4 py-3 transition-colors hover:border-accent/40"
          >
            <div>
              <div className="text-sm font-medium text-ink-primary">{car.nickname}</div>
              <div className="text-xs text-ink-secondary">
                {car.manufacturer} {car.model} · {car.car_class}
                {car.scale ? ` · ${car.scale}` : ""}
              </div>
              {!car.has_sheet && <div className="mt-1 text-[11px] text-warn">No PDF setup sheet yet</div>}
            </div>
            <span className="font-mono text-xs text-ink-muted">
              {car.setup_count} setup{car.setup_count === 1 ? "" : "s"} →
            </span>
          </Link>
        ))}
        {cars.length === 0 && <p className="text-sm text-ink-muted">No cars yet. Create your first one above.</p>}
      </div>
    </main>
  );
}
