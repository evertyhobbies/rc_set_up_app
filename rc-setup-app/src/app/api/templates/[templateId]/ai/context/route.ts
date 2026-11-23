import { sql } from "drizzle-orm";
import { rows, isUuid } from "@/lib/rows";
import { existingFields, sheetWidgetsFor } from "@/lib/aiData";

export const dynamic = "force-dynamic";

/** Everything the AI build page needs: pages, every sheet box, and the summary fields boxes can link to. */
export async function GET(_req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  if (!isUuid(templateId)) return Response.json({ error: "Bad id" }, { status: 400 });
  const pages = await rows<{ page_index: number; width: number; height: number }>(
    sql`SELECT page_index, width, height FROM sheet_pages WHERE template_id = ${templateId} ORDER BY page_index`
  );
  if (!pages.length) return Response.json({ error: "Import a setup sheet first" }, { status: 404 });
  const [widgets, existing] = await Promise.all([sheetWidgetsFor(templateId), existingFields(templateId)]);
  return Response.json({ pages, widgets, existing, aiConfigured: !!process.env.ANTHROPIC_API_KEY || !!process.env.AI_MOCK });
}
