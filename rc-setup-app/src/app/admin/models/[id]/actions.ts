"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { summarySlots } from "@/db/schema";
import { ZONES, type Slot } from "@/lib/summarySlots";

/** Replace the summary layout for a template. */
export async function saveSlots(templateId: string, slots: Slot[], path: string) {
  const clean = slots
    .filter((s) => ZONES.includes(s.zone) && s.pdfField && s.label.trim())
    .map((s, i) => ({
      templateId,
      zone: s.zone,
      pdfField: s.pdfField,
      label: s.label.trim().slice(0, 40),
      unit: s.unit?.trim().slice(0, 10) || null,
      sortOrder: i,
    }));
  await db.delete(summarySlots).where(eq(summarySlots.templateId, templateId));
  if (clean.length) await db.insert(summarySlots).values(clean);
  revalidatePath(path);
}
