import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";
import { seedX4 } from "@/db/seedData";
import { NextResponse } from "next/server";

// Visit /api/setup/seed once, after /api/setup/migrate has succeeded, to
// load the Xray X4 '22 template and a demo car. Re-visiting adds a second
// copy rather than erroring — this is a one-time bootstrap route, not
// meant to stay in the app long-term.
export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql, { schema });
    const result = await seedX4(db);
    return NextResponse.json({
      ok: true,
      demoUrl: `/cars/${result.demoCarId}/setups/${result.baseSetupId}`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
