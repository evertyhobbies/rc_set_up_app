import { isUuid } from "@/lib/rows";
import { aiSection, type SectionBox } from "@/lib/ai";
import { aiError, existingFields, sheetWidgetsFor } from "@/lib/aiData";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Step 2 (one call per section, run in parallel by the page):
 * { section: {key,label}, image: base64 JPEG close-up with boxes outlined, boxes: SectionBox[] }
 */
export async function POST(req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  if (!isUuid(templateId)) return Response.json({ error: "Bad id" }, { status: 400 });
  try {
    const b = await req.json();
    const boxes: SectionBox[] = Array.isArray(b.boxes) ? b.boxes : [];
    if (!boxes.length) return Response.json({ fields: [] });
    if (typeof b.image !== "string" || b.image.length < 100) return Response.json({ error: "Missing section image" }, { status: 400 });

    // Only accept box names that really exist on this sheet
    const known = new Set((await sheetWidgetsFor(templateId)).map((w) => w.pdf_field));
    const valid = boxes.filter((x) => known.has(x.name));
    const existing = await existingFields(templateId);

    const fields = await aiSection({
      section: { key: String(b.section?.key ?? "section"), label: String(b.section?.label ?? "Section") },
      image: { mime: "image/jpeg", b64: b.image },
      boxes: valid,
      existing,
    });
    const names = new Set(valid.map((x) => x.name));
    const keys = new Set(existing.map((e) => e.key));
    return Response.json({
      fields: fields
        .filter((f) => names.has(f.pdf_field))
        .map((f) => ({ ...f, link: f.link && keys.has(f.link.field_key) ? f.link : null })),
    });
  } catch (err) {
    return aiError(err);
  }
}
