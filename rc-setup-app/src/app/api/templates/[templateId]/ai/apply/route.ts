import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { templateSections, templateFields, sheetWidgets, setupValues } from "@/db/schema";
import { isUuid } from "@/lib/rows";
import type { AiField } from "@/lib/ai";
import { SHEET_SECTION_KEY } from "@/lib/templates";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Corner = "FL" | "FR" | "RL" | "RR";
type InSection = { key: string; label: string; page: number; x: number; y: number; w: number; h: number; fields: AiField[] };

const AXLE_CORNERS: Record<string, [Corner, Corner]> = { front: ["FL", "FR"], rear: ["RL", "RR"] };
const clamp01 = (n: number) => Math.min(1, Math.max(0, Number(n) || 0));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "section";

/**
 * POST /api/templates/:templateId/ai/apply { sections: InSection[] }
 * Turns the reviewed AI proposal into section cards + fields. Re-runnable:
 * existing sheet fields are reused (values kept), links move values across.
 */
export async function POST(req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  if (!isUuid(templateId)) return Response.json({ error: "Bad id" }, { status: 400 });
  try {
    const body = await req.json();
    const incoming: InSection[] = Array.isArray(body.sections) ? body.sections : [];
    if (!incoming.length) return Response.json({ error: "Nothing to apply" }, { status: 400 });

    const sections = await db.select().from(templateSections).where(eq(templateSections.templateId, templateId));
    const sectionIds = sections.map((s) => s.id);
    const fields = sectionIds.length ? await db.select().from(templateFields).where(inArray(templateFields.sectionId, sectionIds)) : [];
    const widgets = await db.select().from(sheetWidgets).where(eq(sheetWidgets.templateId, templateId));

    const sectionById = new Map(sections.map((s) => [s.id, s]));
    const fieldById = new Map(fields.map((f) => [f.id, f]));
    const isOwnSection = (sid: string) => {
      const s = sectionById.get(sid);
      return !!s && (s.key === SHEET_SECTION_KEY || s.source === "ai");
    };
    const isOwn = (fieldId: string | null) => !!fieldId && !!fieldById.get(fieldId) && isOwnSection(fieldById.get(fieldId)!.sectionId);
    const linkable = new Map(
      fields.filter((f) => !isOwnSection(f.sectionId) && f.type !== "computed").map((f) => [f.key, f])
    );
    const takenKeys = new Set(fields.map((f) => f.key));
    const widgetsByName = new Map<string, typeof widgets>();
    for (const w of widgets) widgetsByName.set(w.pdfField, [...(widgetsByName.get(w.pdfField) ?? []), w]);

    // 1. Upsert the AI section cards
    const usedSectionKeys = new Set<string>();
    const keepSectionIds = new Set<string>();
    const handled = new Set<string>();
    const ownToCheck = new Set<string>();

    for (let i = 0; i < incoming.length; i++) {
      const s = incoming[i];
      let key = `ai_${slug(s.key || s.label)}`;
      for (let n = 2; usedSectionKeys.has(key); n++) key = `ai_${slug(s.key || s.label)}_${n}`;
      usedSectionKeys.add(key);
      const crop = { cropPage: Math.max(0, Math.trunc(s.page) || 0), cropX: clamp01(s.x), cropY: clamp01(s.y), cropW: clamp01(s.w), cropH: clamp01(s.h) };
      const existing = sections.find((x) => x.key === key);
      const [row] = existing
        ? await db.update(templateSections).set({ label: s.label, sortOrder: 200 + i, source: "ai", ...crop }).where(eq(templateSections.id, existing.id)).returning()
        : await db.insert(templateSections).values({ templateId, key, label: s.label, sortOrder: 200 + i, source: "ai", ...crop }).returning();
      keepSectionIds.add(row.id);

      // 2. Each box in the section
      for (const f of s.fields ?? []) {
        const ws = widgetsByName.get(f.pdf_field);
        if (!ws?.length || handled.has(f.pdf_field)) continue;
        handled.add(f.pdf_field);
        const prev = { fieldId: ws[0].fieldId, corner: ws[0].corner, axle: ws[0].axle };
        const label = String(f.label || f.pdf_field).slice(0, 80);
        const unit = f.unit ? String(f.unit).slice(0, 12) : null;
        const tier = f.tier === "main" ? "main" : "detail";

        let target: { fieldId: string; corner: Corner | null; axle: string | null } | null = null;
        const linked = f.link ? linkable.get(f.link.field_key) : undefined;
        if (linked) {
          if (linked.scope === "corner") {
            if (f.link!.axle === "front" || f.link!.axle === "rear") target = { fieldId: linked.id, corner: null, axle: f.link!.axle };
            else if (f.link!.corner && ["FL", "FR", "RL", "RR"].includes(f.link!.corner)) target = { fieldId: linked.id, corner: f.link!.corner, axle: null };
          } else {
            target = { fieldId: linked.id, corner: null, axle: null };
          }
        }

        if (target) {
          if (prev.fieldId && isOwn(prev.fieldId) && prev.fieldId !== target.fieldId) {
            await carryValues(prev.fieldId, target);
            ownToCheck.add(prev.fieldId);
          }
        } else if (isOwn(prev.fieldId)) {
          await db.update(templateFields).set({ label, unit, tier, sectionId: row.id, sortOrder: f.order ?? 0 }).where(eq(templateFields.id, prev.fieldId!));
          target = { fieldId: prev.fieldId!, corner: null, axle: null };
        } else {
          const kind = ws[0].kind;
          const exports = [...new Set(ws.map((w) => w.exportValue).filter(Boolean) as string[])];
          let fkey = `sheet_${slug(f.pdf_field)}`;
          for (let n = 2; takenKeys.has(fkey); n++) fkey = `sheet_${slug(f.pdf_field)}_${n}`;
          takenKeys.add(fkey);
          const type = kind === "checkbox" && exports.length <= 1 ? "checkbox" : kind === "text" ? "text" : "select";
          const [created] = await db
            .insert(templateFields)
            .values({
              sectionId: row.id,
              key: fkey,
              label,
              unit,
              type,
              scope: "car",
              tier,
              options: kind === "choice" ? ((ws[0].options as { value: string }[] | null) ?? []).map((o) => o.value) : exports.length ? exports : null,
              sortOrder: f.order ?? 0,
            })
            .returning();
          target = { fieldId: created.id, corner: null, axle: null };
        }

        const choiceFor = new Map((f.choices ?? []).map((c) => [c.export_value, String(c.label).slice(0, 40)]));
        for (const w of ws) {
          await db
            .update(sheetWidgets)
            .set({
              fieldId: target.fieldId,
              corner: target.corner,
              axle: target.axle,
              sectionId: row.id,
              label,
              unit,
              sortOrder: f.order ?? 0,
              choiceLabel: w.exportValue ? choiceFor.get(w.exportValue) ?? null : null,
            })
            .where(eq(sheetWidgets.id, w.id));
        }
      }
    }

    // 3. Boxes the AI didn't place go in an "Other" card cropped around them
    const leftovers = widgets.filter((w) => !handled.has(w.pdfField));
    if (leftovers.length) {
      const page = leftovers[0].pageIndex;
      const onPage = leftovers.filter((w) => w.pageIndex === page);
      const x0 = Math.min(...onPage.map((w) => w.x)), y0 = Math.min(...onPage.map((w) => w.y));
      const x1 = Math.max(...onPage.map((w) => w.x + w.w)), y1 = Math.max(...onPage.map((w) => w.y + w.h));
      const existing = sections.find((s) => s.key === "ai_other");
      const crop = { cropPage: page, cropX: clamp01(x0 - 0.05), cropY: clamp01(y0 - 0.02), cropW: clamp01(x1 - x0 + 0.1), cropH: clamp01(y1 - y0 + 0.04) };
      const [other] = existing
        ? await db.update(templateSections).set({ label: "Other", sortOrder: 999, source: "ai", ...crop }).where(eq(templateSections.id, existing.id)).returning()
        : await db.insert(templateSections).values({ templateId, key: "ai_other", label: "Other", sortOrder: 999, source: "ai", ...crop }).returning();
      keepSectionIds.add(other.id);
      await db.update(sheetWidgets).set({ sectionId: other.id }).where(inArray(sheetWidgets.id, leftovers.map((w) => w.id)));
      const ownIds = [...new Set(leftovers.map((w) => w.fieldId).filter((id): id is string => isOwn(id)))];
      if (ownIds.length) await db.update(templateFields).set({ sectionId: other.id }).where(inArray(templateFields.id, ownIds));
    }

    // 4. Tidy up: own fields nothing points at, then empty sheet/AI sections
    await pruneOwnFields(templateId, ownToCheck);
    const after = await db.select().from(templateSections).where(eq(templateSections.templateId, templateId));
    for (const s of after) {
      if (!(s.key === SHEET_SECTION_KEY || s.source === "ai") || keepSectionIds.has(s.id)) continue;
      const [hasField] = await db.select({ id: templateFields.id }).from(templateFields).where(eq(templateFields.sectionId, s.id)).limit(1);
      if (!hasField) await db.delete(templateSections).where(eq(templateSections.id, s.id));
    }

    return Response.json({ ok: true, sections: keepSectionIds.size, boxes: handled.size + leftovers.length });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** Copy a field's values to its new home without overwriting values already there. */
async function carryValues(fromFieldId: string, to: { fieldId: string; corner: Corner | null; axle: string | null }) {
  const corners: (Corner | null)[] = to.axle ? AXLE_CORNERS[to.axle] : [to.corner];
  for (const corner of corners) {
    await db.execute(sql`
      INSERT INTO setup_values (setup_id, field_id, corner, value)
      SELECT v.setup_id, ${to.fieldId}, ${corner}::corner, v.value
        FROM setup_values v
       WHERE v.field_id = ${fromFieldId} AND v.corner IS NULL AND v.value IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM setup_values t
                          WHERE t.setup_id = v.setup_id AND t.field_id = ${to.fieldId}
                            AND t.corner IS NOT DISTINCT FROM ${corner}::corner AND t.value IS NOT NULL)`);
  }
}

async function pruneOwnFields(templateId: string, candidates: Set<string>) {
  for (const id of candidates) {
    const [used] = await db
      .select({ id: sheetWidgets.id })
      .from(sheetWidgets)
      .where(and(eq(sheetWidgets.templateId, templateId), eq(sheetWidgets.fieldId, id)))
      .limit(1);
    if (used) continue;
    await db.delete(setupValues).where(eq(setupValues.fieldId, id));
    await db.delete(templateFields).where(eq(templateFields.id, id));
  }
}
