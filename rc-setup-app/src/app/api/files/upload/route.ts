import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** Issues short-lived tokens so the browser can upload straight to the private Blob store (no 4.5 MB limit). */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("models/")) throw new Error("Bad upload path");
        return { allowedContentTypes: ALLOWED, maximumSizeInBytes: 200 * 1024 * 1024, addRandomSuffix: true };
      },
      // The file is recorded by a follow-up POST /api/files from the browser instead of this callback,
      // so uploads also work on protected preview deployments and locally.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
