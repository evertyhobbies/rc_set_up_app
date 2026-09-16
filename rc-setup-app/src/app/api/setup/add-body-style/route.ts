import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

// Visit /api/setup/add-body-style once to add the body_style column to an
// existing cars table (schema.ts already declares it — this brings the live
// database in sync without a full drizzle migration).
export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`ALTER TABLE cars ADD COLUMN IF NOT EXISTS body_style text NOT NULL DEFAULT 'sports'`;
    return NextResponse.json({ ok: true, message: "body_style column ready." });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
