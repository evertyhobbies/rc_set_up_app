import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — check .env.local");
}

const url = process.env.DATABASE_URL;

// Neon (production) uses the HTTP driver. Any other Postgres URL — e.g. a
// local database for development — uses node-postgres. Same query API.
export const db: NeonHttpDatabase<typeof schema> = /neon\.tech/.test(url)
  ? drizzleNeon(neon(url), { schema })
  : (drizzlePg(new pg.Pool({ connectionString: url, max: 5 }), { schema }) as unknown as NeonHttpDatabase<typeof schema>);
