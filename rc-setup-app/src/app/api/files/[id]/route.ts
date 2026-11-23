import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { get, del } from "@vercel/blob";
import { db } from "@/db";
import { modelFiles } from "@/db/schema";
import { isUuid } from "@/lib/rows";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Stream a private file from Blob. ?download=1 saves instead of opening inline. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const [file] = await db.select().from(modelFiles).where(eq(modelFiles.id, id));
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const res = await get(file.pathname, { access: "private" });
  if (!res || res.statusCode !== 200 || !res.stream) return NextResponse.json({ error: "File missing from storage" }, { status: 404 });
  const disposition = req.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  return new Response(res.stream, {
    headers: {
      "Content-Type": file.contentType ?? "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${file.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const [file] = await db.select().from(modelFiles).where(eq(modelFiles.id, id));
  if (!file) return NextResponse.json({ ok: true });
  try {
    await del(file.pathname);
  } catch {
    // already gone from storage; still remove the record
  }
  await db.delete(modelFiles).where(eq(modelFiles.id, id));
  return NextResponse.json({ ok: true });
}
