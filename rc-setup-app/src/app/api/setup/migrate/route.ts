import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { NextResponse } from "next/server";

// Visit /api/setup/migrate once after deploying, with DATABASE_URL set in
// Vercel's project env vars, to apply the schema. Safe to re-visit — Drizzle
// tracks which migrations already ran and skips them.
export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    return NextResponse.json({ ok: true, message: "Schema applied." });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
