import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { carModels } from "@/db/schema";
import { isUuid } from "@/lib/rows";
import { templateForModel } from "@/lib/templates";
import { createVersion, writeSheetValues } from "@/lib/modelSetups";

export const dynamic = "force-dynamic";

/**
 * POST /api/models/:id/import-version { name, track, eventDate, notes, values: { pdfField: value } }
 * Creates the next version from a filled-in sheet. The master is not touched.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Bad model" }, { status: 400 });
    const [model] = await db.select().from(carModels).where(eq(carModels.id, id));
    if (!model) return NextResponse.json({ error: "Model not found" }, { status: 404 });
    const b = await req.json();
    const values = b.values && typeof b.values === "object" ? (b.values as Record<string, string>) : {};
    if (!Object.keys(values).length) return NextResponse.json({ error: "No values to import" }, { status: 400 });
    const eventDate = typeof b.eventDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.eventDate) ? b.eventDate : null;

    const template = await templateForModel(model.id);
    const version = await createVersion(model.id, {
      name: String(b.name ?? ""),
      track: b.track ? String(b.track) : null,
      eventDate,
      notes: b.notes ? String(b.notes) : null,
    });
    const written = await writeSheetValues(template.id, version.id, values);
    return NextResponse.json({ id: version.id, versionNo: version.versionNo, written }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
