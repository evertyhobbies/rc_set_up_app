import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { rows, isUuid } from "@/lib/rows";
import { PageHeader } from "@/components/PageHeader";
import { MapRow, type Choice } from "@/components/MapRow";

export const dynamic = "force-dynamic";

type Box = {
  pdf_field: string;
  kind: string;
  page_index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  page_w: number;
  page_h: number;
  field_id: string | null;
  corner: string | null;
  field_label: string | null;
  field_tier: "main" | "detail" | null;
  is_sheet_field: boolean;
};

/**
 * Link each box on the imported PDF to the matching summary field, e.g. the
 * sheet's front-left ride height box → Ride height · FL. Linked boxes and the
 * summary view then share one value. Unlinked boxes keep their own field.
 */
export default async function MapPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ car?: string }>;
}) {
  const { templateId } = await params;
  const { car } = await searchParams;
  if (!isUuid(templateId)) notFound();

  const [template] = await rows<{ name: string; sheet_name: string | null }>(
    sql`SELECT name, sheet_name FROM setup_templates WHERE id = ${templateId}`
  );
  if (!template?.sheet_name) notFound();

  // One row per PDF field (first widget gives the preview position)
  const boxes = await rows<Box>(sql`
    SELECT DISTINCT ON (w.pdf_field)
           w.pdf_field, w.kind, w.page_index, w.x, w.y, w.w, w.h, p.width AS page_w, p.height AS page_h,
           w.field_id, w.corner, f.label AS field_label, f.tier AS field_tier,
           (s.key = 'sheet') AS is_sheet_field
      FROM sheet_widgets w
      JOIN sheet_pages p ON p.template_id = w.template_id AND p.page_index = w.page_index
      LEFT JOIN template_fields f ON f.id = w.field_id
      LEFT JOIN template_sections s ON s.id = f.section_id
     WHERE w.template_id = ${templateId}
     ORDER BY w.pdf_field, w.page_index, w.y, w.x`);
  boxes.sort((a, b) => a.page_index - b.page_index || a.y - b.y || a.x - b.x);

  const fields = await rows<{ id: string; label: string; unit: string | null; scope: string; section: string }>(sql`
    SELECT f.id, f.label, f.unit, f.scope, s.label AS section
      FROM template_fields f JOIN template_sections s ON s.id = f.section_id
     WHERE s.template_id = ${templateId} AND s.key <> 'sheet' AND f.type <> 'computed'
     ORDER BY s.sort_order, f.sort_order`);

  const choices: Choice[] = fields.flatMap((f) =>
    f.scope === "corner"
      ? (["FL", "FR", "RL", "RR"] as const).map((c) => ({ value: `${f.id}|${c}`, label: `${f.section} · ${f.label} · ${c}` }))
      : [{ value: f.id, label: `${f.section} · ${f.label}${f.unit ? ` (${f.unit})` : ""}` }]
  );

  const linked = boxes.filter((b) => !b.is_sheet_field && b.field_id).length;
  const path = `/templates/${templateId}/map`;

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-surface-0 px-5 py-8">
      <PageHeader
        back={car && isUuid(car) ? `/cars/${car}` : "/models"}
        eyebrow={template.sheet_name}
        title="Link sheet fields"
        sub={`${boxes.length} boxes · ${linked} linked to summary fields`}
      />
      <p className="mb-5 text-sm text-ink-secondary">
        Pick the summary field each box means. Linked boxes share one value with the Summary view. Boxes left on
        <span className="text-ink-primary"> Sheet only</span> keep their own field; rename it and mark it Main to show it in the main list.
      </p>
      <div className="flex flex-col gap-2">
        {boxes.map((b) => (
          <MapRow
            key={b.pdf_field}
            templateId={templateId}
            path={path}
            box={{
              pdfField: b.pdf_field,
              kind: b.kind,
              pageIndex: b.page_index,
              x: b.x,
              y: b.y,
              w: b.w,
              h: b.h,
              pageW: b.page_w,
              pageH: b.page_h,
            }}
            current={b.is_sheet_field || !b.field_id ? "own" : b.corner ? `${b.field_id}|${b.corner}` : b.field_id}
            ownField={b.is_sheet_field && b.field_id ? { id: b.field_id, label: b.field_label ?? "", tier: b.field_tier ?? "detail" } : null}
            choices={choices}
          />
        ))}
      </div>
    </main>
  );
}
