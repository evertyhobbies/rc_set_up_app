import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sheetPages, sheetWidgets, setupValues, templateSections } from "@/db/schema";
import { getSetupData } from "@/lib/getSetupData";
import { isUuid } from "@/lib/rows";
import { ChassisSummary } from "@/components/ChassisSummary";
import { SheetView, type SheetWidget } from "@/components/SheetView";
import { valueKey, type SheetValues } from "@/lib/sheetValues";
import { AllFields } from "@/components/AllFields";
import { SetupCards, type CardSection } from "@/components/SetupCards";
import { DeleteButton } from "@/components/CarActions";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

type View = "summary" | "setup" | "sheet" | "fields";

export default async function SetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ carId: string; setupId: string }>;
  searchParams: Promise<{ view?: string; tier?: string }>;
}) {
  const { carId, setupId } = await params;
  const sp = await searchParams;
  if (!isUuid(carId) || !isUuid(setupId)) notFound();
  const data = await getSetupData(setupId);
  if (!data || data.car.id !== carId) notFound();

  const { car, model, setup, sections, template } = data;
  const section = (key: string) => sections.find((s) => s.key === key);
  const path = `/cars/${carId}/setups/${setupId}`;

  const hasSummary = !!section("corners");
  const hasSheet = !!template.sheetName;
  const [aiSection] = await db
    .select({ id: templateSections.id })
    .from(templateSections)
    .where(and(eq(templateSections.templateId, template.id), eq(templateSections.source, "ai")))
    .limit(1);
  const hasCards = hasSheet && !!aiSection;
  const views: { key: View; label: string }[] = [
    ...(hasSummary ? [{ key: "summary" as const, label: "Summary" }] : []),
    ...(hasCards ? [{ key: "setup" as const, label: "Setup" }] : []),
    ...(hasSheet ? [{ key: "sheet" as const, label: "Sheet" }] : []),
    { key: "fields", label: "All fields" },
  ];
  const view: View = views.some((v) => v.key === sp.view) ? (sp.view as View) : views[0].key;
  const tier = sp.tier === "all" ? "all" : "main";
  const href = (v: View, t: string = tier) => `${path}?view=${v}${v === "fields" && t === "all" ? "&tier=all" : ""}`;

  return (
    <main className={`mx-auto min-h-screen bg-surface-0 px-4 py-6 ${view === "sheet" ? "max-w-[1500px]" : view === "setup" ? "max-w-6xl" : "max-w-3xl"}`}>
      <PageHeader
        back={`/cars/${carId}`}
        eyebrow={`${model.manufacturer} ${model.name} · ${car.nickname}`}
        title={setup.name}
        sub={
          <>
            {setup.kind === "race" ? "Race-day setup" : "Base setup"}
            {setup.track ? ` · ${setup.track}` : ""}
            {setup.eventDate ? ` · ${setup.eventDate.toISOString().slice(0, 10)}` : ""}
          </>
        }
      />

      {views.length > 1 && (
        <nav className="mb-4 inline-flex rounded-md border border-line bg-surface-1 p-0.5 text-sm">
          {views.map((v) => (
            <Link
              key={v.key}
              href={href(v.key)}
              className={`rounded px-3.5 py-1.5 font-medium ${view === v.key ? "bg-surface-2 text-ink-primary" : "text-ink-muted hover:text-ink-secondary"}`}
            >
              {v.label}
            </Link>
          ))}
        </nav>
      )}

      {view === "summary" && (
        <ChassisSummary
          corners={section("corners")?.fields ?? []}
          frontAxle={section("front_axle")?.fields ?? []}
          rearAxle={section("rear_axle")?.fields ?? []}
          transmission={section("transmission")?.fields ?? []}
          cornerWeightGrams={section("corner_weight")?.fields.find((f) => f.type === "number")}
          cornerWeightComputed={section("corner_weight")?.fields.filter((f) => f.type === "computed") ?? []}
          raceWeight={section("race_weight")?.fields ?? []}
          carId={carId}
          bodyStyle={car.bodyStyle}
          setupId={setupId}
          path={path}
        />
      )}

      {view === "setup" && <Cards templateId={template.id} setupId={setupId} path={path} />}

      {view === "sheet" && <Sheet templateId={template.id} setupId={setupId} path={path} />}

      {view === "fields" && (
        <AllFields sections={sections} setupId={setupId} path={path} tier={tier} hrefFor={(t) => href("fields", t)} />
      )}

      {hasSheet && !hasCards && (
        <p className="mt-6 text-sm text-ink-secondary">
          Want this sheet laid out as section cards with XRAY&apos;s drawings?{" "}
          <Link href={`/templates/${template.id}/ai?car=${carId}`} className="text-accent">Build setup with AI</Link>.
        </p>
      )}

      {!hasSheet && (
        <p className="mt-6 text-sm text-ink-secondary">
          No PDF setup sheet for this model yet.{" "}
          <Link href={`/cars/${carId}`} className="text-accent">Upload it on the car page</Link>.
        </p>
      )}

      <div className="mt-10 border-t border-line pt-5">
        <DeleteButton kind="setup" carId={carId} setupId={setupId} label="Delete setup" confirmText={`Delete "${setup.name}"?`} />
      </div>
    </main>
  );
}

async function Sheet({ templateId, setupId, path }: { templateId: string; setupId: string; path: string }) {
  const [pages, widgets, values] = await Promise.all([
    db
      .select({ pageIndex: sheetPages.pageIndex, width: sheetPages.width, height: sheetPages.height })
      .from(sheetPages)
      .where(eq(sheetPages.templateId, templateId))
      .orderBy(asc(sheetPages.pageIndex)),
    db.select().from(sheetWidgets).where(eq(sheetWidgets.templateId, templateId)),
    db.select().from(setupValues).where(eq(setupValues.setupId, setupId)),
  ]);
  const initial: SheetValues = {};
  for (const v of values) if (v.value !== null) initial[valueKey(v.fieldId, v.corner)] = v.value;

  return (
    <SheetView
      templateId={templateId}
      pages={pages}
      widgets={widgets as SheetWidget[]}
      initialValues={initial}
      setupId={setupId}
      path={path}
    />
  );
}

async function Cards({ templateId, setupId, path }: { templateId: string; setupId: string; path: string }) {
  const [sections, pages, widgets, values] = await Promise.all([
    db
      .select()
      .from(templateSections)
      .where(and(eq(templateSections.templateId, templateId), eq(templateSections.source, "ai")))
      .orderBy(asc(templateSections.sortOrder)),
    db
      .select({ pageIndex: sheetPages.pageIndex, width: sheetPages.width, height: sheetPages.height })
      .from(sheetPages)
      .where(eq(sheetPages.templateId, templateId)),
    db.select().from(sheetWidgets).where(eq(sheetWidgets.templateId, templateId)),
    db.select().from(setupValues).where(eq(setupValues.setupId, setupId)),
  ]);
  const initial: SheetValues = {};
  for (const v of values) if (v.value !== null) initial[valueKey(v.fieldId, v.corner)] = v.value;
  const cards: CardSection[] = sections
    .filter((s) => s.cropPage !== null)
    .map((s) => ({ id: s.id, label: s.label, cropPage: s.cropPage!, cropX: s.cropX ?? 0, cropY: s.cropY ?? 0, cropW: s.cropW ?? 1, cropH: s.cropH ?? 1 }));
  return (
    <SetupCards
      templateId={templateId}
      sections={cards}
      pages={pages}
      widgets={widgets as SheetWidget[]}
      initialValues={initial}
      setupId={setupId}
      path={path}
    />
  );
}
