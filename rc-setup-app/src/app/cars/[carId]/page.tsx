import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { rows, isUuid } from "@/lib/rows";
import { PageHeader, btnGhost } from "@/components/PageHeader";
import { NewSetupForm, DeleteButton } from "@/components/CarActions";
import { SheetImporter } from "@/components/SheetImporter";

export const dynamic = "force-dynamic";

type Car = {
  id: string;
  nickname: string;
  template_id: string;
  sheet_name: string | null;
  sheet_filename: string | null;
  manufacturer: string;
  model: string;
  car_class: string;
  scale: string | null;
  field_count: number;
  sheet_field_count: number;
};
type Setup = { id: string; name: string; kind: "base" | "race"; track: string | null; event_date: string | null; value_count: number };

export default async function CarPage({
  params,
  searchParams,
}: {
  params: Promise<{ carId: string }>;
  searchParams: Promise<{ sheet?: string }>;
}) {
  const { carId } = await params;
  const { sheet } = await searchParams;
  if (!isUuid(carId)) notFound();

  const [car] = await rows<Car>(sql`
    SELECT c.id, c.nickname, c.template_id, t.sheet_name, t.sheet_filename,
           m.manufacturer, m.name AS model, m.car_class, m.scale,
           (SELECT count(*)::int FROM template_fields f JOIN template_sections s ON s.id = f.section_id
             WHERE s.template_id = t.id AND s.key <> 'sheet') AS field_count,
           (SELECT count(DISTINCT pdf_field)::int FROM sheet_widgets w WHERE w.template_id = t.id) AS sheet_field_count
      FROM cars c
      JOIN setup_templates t ON t.id = c.template_id
      JOIN car_models m      ON m.id = t.car_model_id
     WHERE c.id = ${carId}`);
  if (!car) notFound();

  const setupList = await rows<Setup>(sql`
    SELECT s.id, s.name, s.kind, s.track, to_char(s.event_date, 'YYYY-MM-DD') AS event_date,
           (SELECT count(*)::int FROM setup_values v WHERE v.setup_id = s.id AND v.value IS NOT NULL) AS value_count
      FROM setups s WHERE s.car_id = ${carId}
     ORDER BY s.kind, s.event_date DESC NULLS LAST, s.created_at DESC`);

  const base = setupList.filter((s) => s.kind === "base");
  const race = setupList.filter((s) => s.kind === "race");
  const showImporter = !car.sheet_name || sheet === "replace";
  const firstBase = base[0];

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface-0 px-5 py-8">
      <PageHeader
        back="/models"
        eyebrow={`${car.manufacturer} ${car.model} · ${car.car_class}${car.scale ? ` · ${car.scale}` : ""}`}
        title={car.nickname}
      />

      {showImporter ? (
        <section className="mb-6 rounded-md border border-line bg-surface-1 p-4">
          <h2 className="text-sm font-medium text-ink-primary">{car.sheet_name ? "Replace setup sheet" : "Add the setup sheet"}</h2>
          <p className="mb-4 mt-1 text-sm text-ink-secondary">
            Upload the manufacturer&apos;s editable PDF. Its artwork becomes the Sheet view and each fillable box becomes a setup field,
            shared by every {car.manufacturer} {car.model} in your garage.
            {car.sheet_name && " Links you've made between sheet boxes and summary fields are kept."}
          </p>
          <SheetImporter
            templateId={car.template_id}
            defaultName={`${car.manufacturer} ${car.model} setup sheet`}
            setups={setupList.map((s) => ({ id: s.id, name: s.name }))}
            doneHref={`/cars/${car.id}`}
          />
          {car.sheet_name && (
            <Link href={`/cars/${car.id}`} className={`${btnGhost} mt-3 inline-block`}>Cancel</Link>
          )}
        </section>
      ) : (
        <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-1 px-4 py-3">
          <div>
            <div className="text-sm text-ink-primary">{car.sheet_name}</div>
            <div className="font-mono text-[11px] text-ink-muted">
              {car.sheet_field_count} sheet boxes · {car.field_count} summary fields
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/templates/${car.template_id}/map?car=${car.id}`} className={btnGhost}>Link fields</Link>
            <Link href={`/cars/${car.id}?sheet=replace`} className={btnGhost}>Replace sheet</Link>
          </div>
        </section>
      )}

      <SetupGroup title="Base setups" carId={car.id} setups={base} />
      <SetupGroup title="Race setups" carId={car.id} setups={race} />

      <NewSetupForm carId={car.id} setups={setupList.map((s) => ({ id: s.id, name: s.name }))} defaultCopyFrom={firstBase?.id} />

      <div className="mt-10 border-t border-line pt-5">
        <DeleteButton kind="car" carId={car.id} label={`Delete ${car.nickname}`} confirmText={`Delete "${car.nickname}" and all ${setupList.length} of its setups?`} />
      </div>
    </main>
  );
}

function SetupGroup({ title, carId, setups }: { title: string; carId: string; setups: Setup[] }) {
  if (!setups.length) return null;
  return (
    <section className="mb-5">
      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-muted">{title}</h2>
      <div className="flex flex-col gap-2">
        {setups.map((s) => (
          <Link
            key={s.id}
            href={`/cars/${carId}/setups/${s.id}`}
            className="flex items-center justify-between rounded-md border border-line bg-surface-1 px-4 py-3 transition-colors hover:border-accent/40"
          >
            <div>
              <div className="text-sm font-medium text-ink-primary">{s.name}</div>
              <div className="text-xs text-ink-secondary">{[s.track, s.event_date].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <span className="font-mono text-xs text-ink-muted">{s.value_count} values →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
