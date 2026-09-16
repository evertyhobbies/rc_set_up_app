import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  setups,
  cars,
  setupTemplates,
  carModels,
  templateSections,
  templateFields,
  setupValues,
} from "@/db/schema";
import { evaluateFormula, ComputeContext } from "./compute";

export type RenderField = {
  id: string;
  key: string;
  label: string;
  unit: string | null;
  type: "number" | "text" | "select" | "computed";
  scope: "car" | "axle_front" | "axle_rear" | "corner";
  tier: "main" | "detail";
  options: string[] | null;
  // For scope="corner": one entry per corner. Otherwise a single "value" key.
  values: Partial<Record<"value" | "FL" | "FR" | "RL" | "RR", string | number | null>>;
};

export type RenderSection = {
  key: string;
  label: string;
  fields: RenderField[];
};

export async function getSetupData(setupId: string) {
  const [setup] = await db.select().from(setups).where(eq(setups.id, setupId));
  if (!setup) return null;

  const [car] = await db.select().from(cars).where(eq(cars.id, setup.carId));
  const [template] = await db
    .select()
    .from(setupTemplates)
    .where(eq(setupTemplates.id, car.templateId));
  const [model] = await db
    .select()
    .from(carModels)
    .where(eq(carModels.id, template.carModelId));

  const sections = await db
    .select()
    .from(templateSections)
    .where(eq(templateSections.templateId, template.id))
    .orderBy(templateSections.sortOrder);

  const fields = await db
    .select()
    .from(templateFields)
    .where(eq(templateFields.sectionId, sections[0]?.id ?? ""));
  // (fetched per-section below instead — see loop)

  const values = await db
    .select()
    .from(setupValues)
    .where(eq(setupValues.setupId, setupId));

  const renderSections: RenderSection[] = [];
  const numericValues: Record<string, number> = {};
  const cornerNumericValues: Record<string, Partial<Record<"FL" | "FR" | "RL" | "RR", number>>> = {};

  for (const section of sections) {
    const sectionFields = await db
      .select()
      .from(templateFields)
      .where(eq(templateFields.sectionId, section.id))
      .orderBy(templateFields.sortOrder);

    const renderFields: RenderField[] = [];

    for (const field of sectionFields) {
      const fieldValues = values.filter((v) => v.fieldId === field.id);
      const entry: RenderField["values"] = {};

      if (field.scope === "corner") {
        for (const corner of ["FL", "FR", "RL", "RR"] as const) {
          const v = fieldValues.find((fv) => fv.corner === corner)?.value ?? null;
          entry[corner] = v;
          const num = v !== null ? Number(v) : NaN;
          if (!Number.isNaN(num)) {
            cornerNumericValues[field.key] = { ...cornerNumericValues[field.key], [corner]: num };
          }
        }
      } else {
        const v = fieldValues[0]?.value ?? null;
        entry.value = v;
        const num = v !== null ? Number(v) : NaN;
        if (!Number.isNaN(num)) numericValues[field.key] = num;
      }

      renderFields.push({
        id: field.id,
        key: field.key,
        label: field.label,
        unit: field.unit,
        type: field.type,
        scope: field.scope,
        tier: field.tier,
        options: (field.options as string[]) ?? null,
        values: entry,
      });
    }

    renderSections.push({ key: section.key, label: section.label, fields: renderFields });
  }

  // Second pass: resolve computed fields now that all inputs are gathered.
  const ctx: ComputeContext = {
    values: numericValues,
    cornerValues: cornerNumericValues,
    constants: (model.constants as Record<string, number>) ?? {},
  };
  for (const section of renderSections) {
    for (const field of section.fields) {
      if (field.type === "computed") {
        const fieldDef = (await db
          .select()
          .from(templateFields)
          .where(eq(templateFields.id, field.id)))[0];
        const result = fieldDef?.formula
          ? evaluateFormula(fieldDef.formula, ctx)
          : null;
        field.values.value = result;
      }
    }
  }

  return {
    setup,
    car,
    template,
    model,
    sections: renderSections,
  };
}
