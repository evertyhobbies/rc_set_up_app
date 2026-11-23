import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sheetPages } from "@/db/schema";
import { isUuid } from "@/lib/rows";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string; page: string }> };
const MAX_BYTES = 3.2 * 1024 * 1024; // base64 grows ~33%; stays under Vercel's 4.5 MB request cap

async function target(params: Ctx["params"]) {
  const { templateId, page } = await params;
  const pageIndex = Number(page);
  if (!isUuid(templateId) || !Number.isInteger(pageIndex) || pageIndex < 0) return null;
  return and(eq(sheetPages.templateId, templateId), eq(sheetPages.pageIndex, pageIndex));
}

/** The sheet artwork for one page (no form values drawn) */
export async function GET(req: NextRequest, { params }: Ctx) {
  const where = await target(params);
  if (!where) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const [row] = await db.select({ mime: sheetPages.mime, b64: sheetPages.imageB64 }).from(sheetPages).where(where);
  if (!row?.b64) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const etag = `"${createHash("sha1").update(row.b64).digest("hex").slice(0, 16)}"`;
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
  return new Response(Buffer.from(row.b64, "base64"), {
    headers: { "Content-Type": row.mime ?? "image/jpeg", ETag: etag, "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}

/** PUT raw image bytes (image/jpeg | image/png | image/webp) */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const where = await target(params);
  if (!where) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const mime = req.headers.get("content-type") ?? "";
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return NextResponse.json({ error: "Upload a JPEG, PNG or WebP" }, { status: 400 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) return NextResponse.json({ error: "Empty image" }, { status: 400 });
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: "Image too large" }, { status: 413 });
  const updated = await db.update(sheetPages).set({ mime, imageB64: buf.toString("base64") }).where(where).returning({ i: sheetPages.pageIndex });
  if (!updated.length) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  return NextResponse.json({ ok: true, bytes: buf.length });
}
