import type { SQL } from "drizzle-orm";
import { db } from "@/db";

/** Run a raw `sql` query and return its rows (works with both the Neon and node-postgres drivers). */
export async function rows<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
  const result = (await db.execute(query)) as unknown as { rows: T[] };
  return result.rows;
}

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
