import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  setupTemplates,
  templateSections,
  templateFields,
  sheetPages,
  sheetWidgets,
  setupValues,
  setups,
  cars,
} from "@/db/schema";
import { isUuid } from "@/lib/rows";
import { SHEET_SECTION_KEY } from "@/lib/templates";

export const dynamic = "force-dynamic";

type Widget = {
  page_index: number;
  field_name: string;
  kind: "text" | "checkbox" | "radio" | "choice";
  export_value: string | null;
  options: { value: string; label: string }[] | null;
  x: number;
  y: number;
  w: number;
  h: number;
  font_size: number | null;
  multiline: boolean;
  align: number;
};

/** A formula-safe field key: compute.ts passes every numeric field key in as a JS parameter name. */
function keyFor(pdfField: string, taken: Set<string>) {
  const base = "sheet_" + pdfField.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);
  let key = base || "sheet_field";
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
  taken.add(key);
  return key;
}

function labelFor(pdfField: string) {
  const s = pdfField.replace(/[_.\-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * POST /api/templates/:templateId/sheet
 * { sheetName, filename, pages: [{width,height}], widgets: Widget[], values?: {pdfField: value}, setupId? }
 * Replaces this template's sheet. Page images follow via PUT .../sheet/pages/:n.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const { templateId } = await params;
    if (!isUuid(templateId)) return NextResponse.json({ error: "Bad template id" }, { status: 400 });
    const b = await req.json();
    const pages: { width: number; height: number }[] = b.pages ?? [];
    const widgets: Widget[] = b.widgets ?? [];
    if (!pages.length || !widgets.length)
      return NextResponse.json({ error: "No fillable fields found in that PDF" }, { status: 400 });

    const [template] = await db.select().from(setupTemplates).where(eq(setupTemplates.id, templateId));
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    // Keep links from a previous import (pdf field -> template field + corner)
    const previous = await db.select().from(sheetWidgets).where(eq(sheetWidgets.templateId, templateId));
    const links = new Map(previous.filter((w) => w.fieldId).map((w) => [w.pdfField, { fieldId: w.fieldId!, corner: w.corner }]));

    await db.delete(sheetWidgets).where(eq(sheetWidgets.templateId, templateId));
    await db.delete(sheetPages).where(eq(sheetPages.templateId, templateId));

    // Section that holds fields which only exist on the PDF
    let [section] = await db
      .select()
      .from(templateSections)
      .where(and(eq(templateSections.templateId, templateId), eq(templateSections.key, SHEET_SECTION_KEY)));
    if (!section) {
      [section] = await db
        .insert(templateSections)
        .values({ templateId, key: SHEET_SECTION_KEY, label: "Setup sheet", sortOrder: 100 })
        .returning();
    }

    const allSections = await db.select({ id: templateSections.id }).from(templateSections).where(eq(templateSections.templateId, templateId));
    const existingFields = await db
      .select()
      .from(templateFields)
      .where(inArray(templateFields.sectionId, allSections.map((s) => s.id)));
    const taken = new Set(existingFields.map((f) => f.key));
    const sheetFieldByKey = new Map(existingFields.filter((f) => f.sectionId === section.id).map((f) => [f.key, f]));

    // Group widgets by PDF field (radio groups and repeated fields share one value)
    const groups = new Map<string, Widget[]>();
    for (const w of widgets) groups.set(w.field_name, [...(groups.get(w.field_name) ?? []), w]);

    let order = existingFields.filter((f) => f.sectionId === section.id).length;
    const fieldFor = new Map<string, { fieldId: string; corner: "FL" | "FR" | "RL" | "RR" | null }>();

    for (const [pdfField, ws] of groups) {
      const linked = links.get(pdfField);
      if (linked && existingFields.some((f) => f.id === linked.fieldId)) {
        fieldFor.set(pdfField, { fieldId: linked.fieldId, corner: linked.corner });
        continue;
      }
      const first = ws[0];
      const exports = [...new Set(ws.map((w) => w.export_value).filter(Boolean) as string[])];
      const type =
        first.kind === "checkbox" && exports.length <= 1 ? "checkbox"
        : first.kind === "text" ? "text"
        : "select";
      const options =
        first.kind === "choice" ? (first.options ?? []).map((o) => o.value)
        : type === "select" ? exports
        : type === "checkbox" ? exports
        : null;

      // Re-use the field from an earlier import of the same PDF field name
      const candidateKey = "sheet_" + pdfField.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);
      const reuse = sheetFieldByKey.get(candidateKey);
      if (reuse) {
        await db.update(templateFields).set({ type, options }).where(eq(templateFields.id, reuse.id));
        fieldFor.set(pdfField, { fieldId: reuse.id, corner: null });
        continue;
      }
      const [created] = await db
        .insert(templateFields)
        .values({
          sectionId: section.id,
          key: keyFor(pdfField, taken),
          label: labelFor(pdfField),
          unit: null,
          type,
          scope: "car",
          tier: "detail",
          options,
          sortOrder: order++,
        })
        .returning();
      fieldFor.set(pdfField, { fieldId: created.id, corner: null });
    }

    await db.insert(sheetPages).values(
      pages.map((p, i) => ({ templateId, pageIndex: i, width: p.width, height: p.height }))
    );
    for (let i = 0; i < widgets.length; i += 500) {
      await db.insert(sheetWidgets).values(
        widgets.slice(i, i + 500).map((w) => ({
          templateId,
          pageIndex: w.page_index,
          pdfField: w.field_name,
          kind: w.kind,
          exportValue: w.export_value,
          options: w.options,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          fontSize: w.font_size,
          multiline: w.multiline,
          align: w.align,
          fieldId: fieldFor.get(w.field_name)!.fieldId,
          corner: fieldFor.get(w.field_name)!.corner,
        }))
      );
    }

    await db
      .update(setupTemplates)
      .set({ sheetName: String(b.sheetName || "Setup sheet"), sheetFilename: b.filename ?? null })
      .where(eq(setupTemplates.id, templateId));

    // Optionally store values that were already filled in the PDF
    let valuesSaved = 0;
    if (isUuid(b.setupId) && b.values && typeof b.values === "object") {
      const [ok] = await db
        .select({ id: setups.id })
        .from(setups)
        .innerJoin(cars, eq(cars.id, setups.carId))
        .where(and(eq(setups.id, b.setupId), eq(cars.templateId, templateId)));
      if (ok) {
        for (const [pdfField, value] of Object.entries(b.values as Record<string, string>)) {
          const target = fieldFor.get(pdfField);
          if (!target || value === "") continue;
          const cornerCond = target.corner ? eq(setupValues.corner, target.corner) : isNull(setupValues.corner);
          await db
            .delete(setupValues)
            .where(and(eq(setupValues.setupId, b.setupId), eq(setupValues.fieldId, target.fieldId), cornerCond));
          await db.insert(setupValues).values({
            setupId: b.setupId,
            fieldId: target.fieldId,
            corner: target.corner ?? undefined,
            value: String(value),
          });
          valuesSaved++;
        }
      }
    }

    return NextResponse.json({ ok: true, fields: groups.size, valuesSaved });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
