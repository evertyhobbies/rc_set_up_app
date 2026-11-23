import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { modelFiles } from "@/db/schema";
import { isUuid } from "@/lib/rows";

export const dynamic = "force-dynamic";
const KINDS = ["manual", "parts_list", "exploded_view", "setup_sheet", "other"];

/** POST /api/files { carModelId, kind, title, filename, pathname, contentType, size } — record an uploaded file */
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!isUuid(b.carModelId)) return NextResponse.json({ error: "Bad model" }, { status: 400 });
  if (typeof b.pathname !== "string" || !b.pathname.startsWith(`models/${b.carModelId}/`))
    return NextResponse.json({ error: "Bad file path" }, { status: 400 });
  const [row] = await db
    .insert(modelFiles)
    .values({
      carModelId: b.carModelId,
      kind: KINDS.includes(b.kind) ? b.kind : "other",
      title: String(b.title || b.filename || "File").slice(0, 120),
      filename: String(b.filename || "file").slice(0, 200),
      pathname: b.pathname,
      contentType: b.contentType ?? null,
      size: Number.isFinite(b.size) ? b.size : null,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
