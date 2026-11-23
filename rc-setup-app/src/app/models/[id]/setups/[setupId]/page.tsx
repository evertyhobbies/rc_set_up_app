import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { carModels, setups, sheetPages, sheetWidgets, setupValues } from "@/db/schema";
import { isUuid } from "@/lib/rows";
import { templateForModel } from "@/lib/templates";
import { getSetupData } from "@/lib/getSetupData";
import { summaryItems } from "@/lib/summaryData";
import { valueKey, type SheetValues } from "@/lib/sheetValues";
import { PageHeader } from "@/components/PageHeader";
import { SheetView, type SheetWidget } from "@/components/SheetView";
import { SummaryView } from "@/components/SummaryView";
import { AllFields } from "@/components/AllFields";
import { VersionActions } from "@/components/VersionActions";

export const dynamic = "force-dynamic";

type View = "summary" | "sheet" | "fields";

/** Master or a saved version of a model/year: Summary (drawing) · Sheet (the PDF) · All fields. */
export default async function ModelSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; setupId: string }>;
  searchParams: Promise<{ view?: string; tier?: string }>;
}) {
  const { id, setupId } = await params;
  const sp = await searchParams;
  if (!isUuid(id) || !isUuid(setupId)) notFound();
  const [model] = await db.select().from(carModels).where(eq(carModels.id, id));
  const [setup] = await db.select().from(setups).where(and(eq(setups.id, setupId), eq(setups.carModelId, id)));
  if (!model || !setup) notFound();

  const template = await templateForModel(model.id);
  const view: View = sp.view === "sheet" || sp.view === "fields" ? sp.view : "summary";
  const tier = sp.tier === "all" ? "all" : "main";
  const path = `/models/${id}/setups/${setupId}`;
  const readOnly = !setup.isMaster;

  const values = await db.select().from(setupValues).where(eq(setupValues.setupId, setupId));
  const initial: SheetValues = {};
  for (const v of values) if (v.value !== null) initial[valueKey(v.fieldId, v.corner)] = v.value;

  const title = setup.isMaster ? "Master" : `v${setup.versionNo} · ${setup.name}`;
  const sub = setup.isMaster
    ? "Working setup: edits save as you go"
    : [setup.track, setup.eventDate?.toISOString().slice(0, 10)].filter(Boolean).join(" · ") || "Saved version (read-only)";

  return (
    <main className={`mx-auto min-h-screen bg-surface-0 px-4 py-6 ${view === "sheet" ? "max-w-[1500px]" : "max-w-3xl"}`}>
      <PageHeader back={`/models/${id}`} eyebrow={`${model.manufacturer} ${model.name}`} title={title} sub={sub} />

      <nav className="mb-4 inline-flex rounded-md border border-line bg-surface-1 p-0.5 text-sm">
        {(["summary", "sheet", "fields"] as const).map((v) => (
          <Link
            key={v}
            href={`${path}?view=${v}`}
            className={`rounded px-3.5 py-1.5 font-medium ${view === v ? "bg-surface-2 text-ink-primary" : "text-ink-muted hover:text-ink-secondary"}`}
          >
            {v === "summary" ? "Summary" : v === "sheet" ? (readOnly ? "Sheet" : "Edit sheet") : "All fields"}
          </Link>
        ))}
      </nav>

      {!setup.isMaster && (
        <div className="mb-4">
          <VersionActions carModelId={id} versionId={setupId} versionNo={setup.versionNo ?? 0} />
          {setup.notes && <p className="mt-2 text-sm text-ink-secondary">{setup.notes}</p>}
        </div>
      )}

      {!template.sheetName ? (
        <p className="text-sm text-ink-secondary">
          No setup sheet yet. <Link href={`/admin/models/${id}`} className="text-accent">Upload it in Admin</Link>.
        </p>
      ) : view === "summary" ? (
        <SummaryView items={await summaryItems(template.id)} values={initial} adminHref={`/admin/models/${id}`} />
      ) : view === "sheet" ? (
        <SheetSection templateId={template.id} setupId={setupId} path={path} initial={initial} readOnly={readOnly} />
      ) : (
        <FieldsSection setupId={setupId} path={path} tier={tier} readOnly={readOnly} />
      )}
    </main>
  );
}

async function SheetSection(props: { templateId: string; setupId: string; path: string; initial: SheetValues; readOnly: boolean }) {
  const [pages, widgets] = await Promise.all([
    db
      .select({ pageIndex: sheetPages.pageIndex, width: sheetPages.width, height: sheetPages.height })
      .from(sheetPages)
      .where(eq(sheetPages.templateId, props.templateId))
      .orderBy(asc(sheetPages.pageIndex)),
    db.select().from(sheetWidgets).where(eq(sheetWidgets.templateId, props.templateId)),
  ]);
  return (
    <SheetView
      templateId={props.templateId}
      pages={pages}
      widgets={widgets as SheetWidget[]}
      initialValues={props.initial}
      setupId={props.setupId}
      path={props.path}
      readOnly={props.readOnly}
    />
  );
}

async function FieldsSection({ setupId, path, tier, readOnly }: { setupId: string; path: string; tier: "main" | "all"; readOnly: boolean }) {
  const data = await getSetupData(setupId);
  if (!data) return null;
  return (
    <div className={readOnly ? "pointer-events-none opacity-90" : ""}>
      <AllFields sections={data.sections} setupId={setupId} path={path} tier={tier} hrefFor={(t) => `${path}?view=fields${t === "all" ? "&tier=all" : ""}`} />
    </div>
  );
}
