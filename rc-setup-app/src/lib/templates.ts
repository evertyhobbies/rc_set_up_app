import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { carModels, setupTemplates, templateSections, templateFields } from "@/db/schema";

/**
 * The template a new car of this model should use: the model's latest
 * template if it has one. Otherwise a new v1 template is created, and if
 * another year of the same model already has a template (e.g. X4 '22 when
 * adding an X4 '26), its sections and fields are copied so the summary
 * layout and calculations carry over. The imported PDF sheet is not copied;
 * each year gets its own sheet.
 */
export async function templateForModel(carModelId: string) {
  const [existing] = await db
    .select()
    .from(setupTemplates)
    .where(eq(setupTemplates.carModelId, carModelId))
    .orderBy(desc(setupTemplates.version))
    .limit(1);
  if (existing) return existing;

  const [model] = await db.select().from(carModels).where(eq(carModels.id, carModelId));
  if (!model) throw new Error("Car model not found");

  const [template] = await db
    .insert(setupTemplates)
    .values({ carModelId, version: 1, name: `${model.manufacturer} ${model.name} — standard` })
    .returning();

  // Find a sibling year's template to copy from
  if (model.modelName) {
    const siblings = await db
      .select({ id: carModels.id })
      .from(carModels)
      .where(
        and(
          eq(carModels.manufacturer, model.manufacturer),
          eq(carModels.modelName, model.modelName),
          ne(carModels.id, model.id)
        )
      )
      .orderBy(desc(carModels.year));
    if (siblings.length) {
      const [source] = await db
        .select()
        .from(setupTemplates)
        .where(inArray(setupTemplates.carModelId, siblings.map((s) => s.id)))
        .orderBy(desc(setupTemplates.createdAt))
        .limit(1);
      if (source) await copyLayout(source.id, template.id);
    }
  }
  return template;
}

/** Copy hand-built sections and fields (not the imported "sheet" section). */
async function copyLayout(fromTemplateId: string, toTemplateId: string) {
  const sections = await db
    .select()
    .from(templateSections)
    .where(and(eq(templateSections.templateId, fromTemplateId), ne(templateSections.key, SHEET_SECTION_KEY)));
  for (const s of sections) {
    const [copy] = await db
      .insert(templateSections)
      .values({ templateId: toTemplateId, key: s.key, label: s.label, sortOrder: s.sortOrder })
      .returning();
    const fields = await db.select().from(templateFields).where(eq(templateFields.sectionId, s.id));
    if (fields.length) {
      await db.insert(templateFields).values(
        fields.map(({ id: _id, sectionId: _sid, ...f }) => ({ ...f, sectionId: copy.id }))
      );
    }
  }
}

export const SHEET_SECTION_KEY = "sheet";

/** Body icon to start with, based on the car type */
export function defaultBodyStyle(carClass: string) {
  const c = carClass.toLowerCase();
  if (c.includes("f1") || c.includes("formula")) return "f1";
  if (c.includes("nascar") || c.includes("oval")) return "nascar";
  if (c.includes("buggy")) return "buggy";
  if (c.includes("truck") || c.includes("truggy") || c.includes("short course") || c.includes("crawler")) return "truck";
  return "sports";
}
