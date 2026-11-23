import "server-only";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/rows";
import type { ExistingField } from "@/lib/ai";

/** Summary fields a sheet box may link to (hand-built sections only, no computed fields). */
export async function existingFields(templateId: string) {
  return rows<ExistingField & { id: string }>(sql`
    SELECT f.id, f.key, f.label, f.unit, f.scope
      FROM template_fields f JOIN template_sections s ON s.id = f.section_id
     WHERE s.template_id = ${templateId} AND s.key <> 'sheet' AND s.source IS DISTINCT FROM 'ai'
       AND f.type <> 'computed'
     ORDER BY s.sort_order, f.sort_order`);
}

export type ContextWidget = {
  pdf_field: string;
  kind: string;
  export_value: string | null;
  options: { value: string; label: string }[] | null;
  page_index: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export async function sheetWidgetsFor(templateId: string) {
  return rows<ContextWidget>(sql`
    SELECT pdf_field, kind, export_value, options, page_index, x, y, w, h
      FROM sheet_widgets WHERE template_id = ${templateId}
     ORDER BY page_index, y, x`);
}

export function aiError(err: unknown) {
  const e = err as { name?: string; status?: number; message?: string };
  const status = e.name === "AiNotConfigured" || e.constructor?.name === "AiNotConfigured" ? 412 : e.status && e.status < 600 ? e.status : 500;
  return Response.json({ error: e.message ?? String(err) }, { status });
}
