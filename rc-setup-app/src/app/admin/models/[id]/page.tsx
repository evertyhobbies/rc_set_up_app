import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { carModels, modelFiles, summarySlots } from "@/db/schema";
import { rows, isUuid } from "@/lib/rows";
import { templateForModel } from "@/lib/templates";
import { ensureMaster } from "@/lib/modelSetups";
import { suggestSlots, type Slot, type Zone } from "@/lib/summarySlots";
import { PageHeader, btnGhost, btnPrimary } from "@/components/PageHeader";
import { SheetImporter } from "@/components/SheetImporter";
import { SlotEditor } from "@/components/SlotEditor";
import { FileManager } from "@/components/FileManager";

export const dynamic = "force-dynamic";

/** Admin page for one model/year: its setup sheet (the template), files and summary layout. */
export default async function AdminModelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sheet?: string }>;
}) {
  const { id } = await params;
  const { sheet } = await searchParams;
  if (!isUuid(id)) notFound();
  const [model] = await db.select().from(carModels).where(eq(carModels.id, id));
  if (!model) notFound();

  const template = await templateForModel(model.id);
  const master = await ensureMaster(model.id);
  const path = `/admin/models/${id}`;

  const [boxes, slots, files] = await Promise.all([
    rows<{ pdf_field: string; label: string | null; kind: string }>(sql`
      SELECT DISTINCT ON (pdf_field) pdf_field, label, kind FROM sheet_widgets
       WHERE template_id = ${template.id} ORDER BY pdf_field, page_index, y, x`),
    db.select().from(summarySlots).where(eq(summarySlots.templateId, template.id)).orderBy(summarySlots.sortOrder),
    db.select().from(modelFiles).where(eq(modelFiles.carModelId, model.id)).orderBy(desc(modelFiles.createdAt)),
  ]);
  const hasSheet = !!template.sheetName && boxes.length > 0;
  const current: Slot[] = slots.map((s) => ({ zone: s.zone as Zone, pdfField: s.pdfField, label: s.label, unit: s.unit }));

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-surface-0 px-5 py-8">
      <PageHeader
        back="/admin"
        eyebrow={`${model.carClass}${model.scale ? ` · ${model.scale}` : ""}`}
        title={`${model.manufacturer} ${model.name}`}
        right={<Link href={`/models/${model.id}`} className={btnPrimary}>Open master setup</Link>}
      />

      {/* 1. Setup sheet = the template */}
      <section className="mb-6 rounded-md border border-line bg-surface-1 p-4">
        <h2 className="text-sm font-medium text-ink-primary">1 · Setup sheet</h2>
        {hasSheet && sheet !== "replace" ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-ink-primary">{template.sheetName}</div>
              <div className="font-mono text-[11px] text-ink-muted">
                {template.sheetFilename} · {boxes.length} fillable boxes · the master is edited on this sheet
              </div>
            </div>
            <Link href={`${path}?sheet=replace`} className={btnGhost}>Replace with newer PDF</Link>
          </div>
        ) : (
          <>
            <p className="mb-4 mt-1 text-sm text-ink-secondary">
              Upload the manufacturer&apos;s <b>editable</b> PDF setup sheet. It becomes the template for this model/year, and the master
              setup is edited directly on it.{hasSheet && " Replacing keeps every value already entered."}
            </p>
            <SheetImporter
              templateId={template.id}
              defaultName={`${model.manufacturer} ${model.name} setup sheet`}
              setups={[{ id: master.id, name: "Master" }]}
              doneHref={path}
            />
            {hasSheet && <Link href={path} className={`${btnGhost} mt-3 inline-block`}>Cancel</Link>}
          </>
        )}
      </section>

      {/* 2. Summary layout */}
      <section className="mb-6 rounded-md border border-line bg-surface-1 p-4">
        <h2 className="text-sm font-medium text-ink-primary">2 · Summary layout</h2>
        <p className="mb-3 mt-1 text-sm text-ink-secondary">
          Choose which sheet boxes show on the Summary drawing, and where. Values are read-only there and always match the sheet.
        </p>
        {hasSheet ? (
          <SlotEditor
            templateId={template.id}
            path={path}
            boxes={boxes.map((b) => ({ name: b.pdf_field, label: b.label }))}
            initial={current}
            suggested={suggestSlots(boxes.map((b) => b.pdf_field))}
          />
        ) : (
          <p className="text-sm text-ink-muted">Upload the setup sheet first.</p>
        )}
      </section>

      {/* 3. Files */}
      <section className="mb-6 rounded-md border border-line bg-surface-1 p-4">
        <h2 className="text-sm font-medium text-ink-primary">3 · Files</h2>
        <p className="mb-3 mt-1 text-sm text-ink-secondary">Manual, parts list, exploded view and anything else for this model/year.</p>
        <FileManager
          carModelId={model.id}
          files={files.map((f) => ({ id: f.id, kind: f.kind, title: f.title, filename: f.filename, size: f.size, createdAt: f.createdAt.toISOString() }))}
        />
      </section>
    </main>
  );
}
