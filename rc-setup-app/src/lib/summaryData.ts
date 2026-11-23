import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { summarySlots, sheetWidgets } from "@/db/schema";
import type { SummaryItem } from "@/components/SummaryView";
import type { Zone } from "@/lib/summarySlots";

/** Summary slots for a template, each with the sheet widgets that hold its value. */
export async function summaryItems(templateId: string): Promise<SummaryItem[]> {
  const [slots, widgets] = await Promise.all([
    db.select().from(summarySlots).where(eq(summarySlots.templateId, templateId)).orderBy(asc(summarySlots.sortOrder)),
    db.select().from(sheetWidgets).where(eq(sheetWidgets.templateId, templateId)),
  ]);
  return slots.map((s) => ({
    zone: s.zone as Zone,
    label: s.label,
    unit: s.unit,
    widgets: widgets
      .filter((w) => w.pdfField === s.pdfField)
      .map((w) => ({ fieldId: w.fieldId, corner: w.corner, axle: w.axle, kind: w.kind, exportValue: w.exportValue, choiceLabel: w.choiceLabel })),
  }));
}
