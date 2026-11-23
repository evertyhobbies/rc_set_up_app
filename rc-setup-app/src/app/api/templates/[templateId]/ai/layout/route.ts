import { sql } from "drizzle-orm";
import { rows, isUuid } from "@/lib/rows";
import { aiLayout } from "@/lib/ai";
import { aiError, sheetWidgetsFor } from "@/lib/aiData";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Step 1: the AI splits the sheet into named sections with bounding boxes. */
export async function POST(_req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  if (!isUuid(templateId)) return Response.json({ error: "Bad id" }, { status: 400 });
  try {
    const pages = await rows<{ page_index: number; mime: string | null; image_b64: string | null }>(
      sql`SELECT page_index, mime, image_b64 FROM sheet_pages WHERE template_id = ${templateId} ORDER BY page_index`
    );
    if (!pages.length || pages.some((p) => !p.image_b64)) return Response.json({ error: "Sheet images are missing; re-upload the PDF" }, { status: 400 });
    const widgets = await sheetWidgetsFor(templateId);
    const boxes = widgets.map((w) => ({ name: w.pdf_field, page: w.page_index, cx: w.x + w.w / 2, cy: w.y + w.h / 2 }));
    const sections = await aiLayout({
      pages: pages.map((p) => ({ index: p.page_index, mime: (p.mime ?? "image/jpeg") as "image/jpeg", b64: p.image_b64! })),
      boxes,
    });
    return Response.json({ sections });
  } catch (err) {
    return aiError(err);
  }
}
