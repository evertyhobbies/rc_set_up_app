"use server";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { sheetWidgets, templateFields, templateSections, setupValues } from "@/db/schema";
import { SHEET_SECTION_KEY } from "@/lib/templates";

type Corner = "FL" | "FR" | "RL" | "RR";

async function sheetSection(templateId: string) {
  const [s] = await db
    .select()
    .from(templateSections)
    .where(and(eq(templateSections.templateId, templateId), eq(templateSections.key, SHEET_SECTION_KEY)));
  return s;
}

/**
 * Point a PDF box at a summary field (+ corner), or back at its own sheet-only field.
 * target = "own" | "<fieldId>" | "<fieldId>|<corner>"
 */
export async function linkPdfField(templateId: string, pdfField: string, target: string, path: string) {
  let fieldId: string;
  let corner: Corner | null = null;
  let axle: "front" | "rear" | null = null;

  if (target === "own") {
    const [current] = await db
      .select({ sectionId: sheetWidgets.sectionId })
      .from(sheetWidgets)
      .where(and(eq(sheetWidgets.templateId, templateId), eq(sheetWidgets.pdfField, pdfField)))
      .limit(1);
    const section = current?.sectionId
      ? (await db.select().from(templateSections).where(eq(templateSections.id, current.sectionId)))[0]
      : await sheetSection(templateId);
    if (!section) throw new Error("Import a sheet first");
    const label = pdfField.replace(/[_.\-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
    const [widget] = await db
      .select()
      .from(sheetWidgets)
      .where(and(eq(sheetWidgets.templateId, templateId), eq(sheetWidgets.pdfField, pdfField)));
    const kind = widget?.kind ?? "text";
    const keyBase = "sheet_" + pdfField.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);
    const [existing] = await db
      .select()
      .from(templateFields)
      .where(and(eq(templateFields.sectionId, section.id), eq(templateFields.key, keyBase)));
    if (existing) {
      fieldId = existing.id;
    } else {
      const [created] = await db
        .insert(templateFields)
        .values({
          sectionId: section.id,
          key: `${keyBase}_${Date.now().toString(36)}`,
          label: label.charAt(0).toUpperCase() + label.slice(1),
          type: kind === "checkbox" ? "checkbox" : kind === "text" ? "text" : "select",
          scope: "car",
          tier: "detail",
          options:
            kind === "choice"
              ? ((widget?.options as { value: string }[] | null) ?? []).map((o) => o.value)
              : widget?.exportValue
                ? [widget.exportValue]
                : null,
          sortOrder: 999,
        })
        .returning();
      fieldId = created.id;
    }
  } else {
    const [id, c] = target.split("|");
    fieldId = id;
    if (c === "axle:front" || c === "axle:rear") axle = c.slice(5) as "front" | "rear";
    else corner = (c as Corner) || null;
  }

  // Where this box's values live right now
  const [before] = await db
    .select({ fieldId: sheetWidgets.fieldId, corner: sheetWidgets.corner, axle: sheetWidgets.axle, sectionId: sheetWidgets.sectionId })
    .from(sheetWidgets)
    .where(and(eq(sheetWidgets.templateId, templateId), eq(sheetWidgets.pdfField, pdfField)))
    .limit(1);

  await db
    .update(sheetWidgets)
    .set({ fieldId, corner, axle })
    .where(and(eq(sheetWidgets.templateId, templateId), eq(sheetWidgets.pdfField, pdfField)));

  // Carry values over to the new target, without overwriting anything already there
  if (before?.fieldId && (before.fieldId !== fieldId || before.corner !== corner || before.axle !== axle)) {
    // Read from the box's old spot (an axle-wide box reads its left wheel) into every new spot
    const fromCorner = before.axle === "front" ? "FL" : before.axle === "rear" ? "RL" : before.corner;
    const toCorners: (Corner | null)[] = axle === "front" ? ["FL", "FR"] : axle === "rear" ? ["RL", "RR"] : [corner];
    for (const to of toCorners) {
      await db.execute(sql`
        INSERT INTO setup_values (setup_id, field_id, corner, value)
        SELECT v.setup_id, ${fieldId}, ${to}::corner, v.value
          FROM setup_values v
         WHERE v.field_id = ${before.fieldId}
           AND v.corner IS NOT DISTINCT FROM ${fromCorner}::corner
           AND v.value IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM setup_values t
              WHERE t.setup_id = v.setup_id AND t.field_id = ${fieldId}
                AND t.corner IS NOT DISTINCT FROM ${to}::corner AND t.value IS NOT NULL)`);
    }

    // The box's old sheet-only field is now unused and its values have moved: remove it
    const [old] = await db.select().from(templateFields).where(eq(templateFields.id, before.fieldId));
    const [oldSection] = old ? await db.select().from(templateSections).where(eq(templateSections.id, old.sectionId)) : [];
    const [stillUsed] = await db
      .select({ id: sheetWidgets.id })
      .from(sheetWidgets)
      .where(eq(sheetWidgets.fieldId, before.fieldId))
      .limit(1);
    if (old && oldSection && (oldSection.key === SHEET_SECTION_KEY || oldSection.source === "ai") && !stillUsed) {
      await db.delete(setupValues).where(eq(setupValues.fieldId, before.fieldId));
      await db.delete(templateFields).where(eq(templateFields.id, before.fieldId));
    }
  }

  await pruneSheetFields(templateId);
  revalidatePath(path);
}

/** Remove sheet-only fields nothing points at any more (and that hold no values). */
async function pruneSheetFields(templateId: string) {
  const section = await sheetSection(templateId);
  if (!section) return;
  const used = await db
    .selectDistinct({ id: sheetWidgets.fieldId })
    .from(sheetWidgets)
    .where(and(eq(sheetWidgets.templateId, templateId), sql`${sheetWidgets.fieldId} IS NOT NULL`));
  const usedIds = used.map((u) => u.id!);
  const orphans = await db
    .select({ id: templateFields.id })
    .from(templateFields)
    .where(
      usedIds.length
        ? and(eq(templateFields.sectionId, section.id), notInArray(templateFields.id, usedIds))
        : eq(templateFields.sectionId, section.id)
    );
  if (!orphans.length) return;
  const withValues = await db
    .selectDistinct({ id: setupValues.fieldId })
    .from(setupValues)
    .where(inArray(setupValues.fieldId, orphans.map((o) => o.id)));
  const keep = new Set(withValues.map((v) => v.id));
  const drop = orphans.map((o) => o.id).filter((id) => !keep.has(id));
  if (drop.length) await db.delete(templateFields).where(inArray(templateFields.id, drop));
}

export async function updateSheetField(fieldId: string, patch: { label?: string; tier?: "main" | "detail" }, path: string) {
  const set: { label?: string; tier?: "main" | "detail" } = {};
  if (patch.label?.trim()) set.label = patch.label.trim();
  if (patch.tier === "main" || patch.tier === "detail") set.tier = patch.tier;
  if (Object.keys(set).length) await db.update(templateFields).set(set).where(eq(templateFields.id, fieldId));
  revalidatePath(path);
}
