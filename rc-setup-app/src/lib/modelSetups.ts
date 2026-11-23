import "server-only";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { setups, setupValues, sheetWidgets } from "@/db/schema";

/**
 * Model/year setups: one editable Master (edited on the PDF sheet) plus
 * numbered Versions v1, v2, … Each version is a full snapshot of the master's
 * values at the time it was saved, with its own event, track and date.
 */

export async function ensureMaster(carModelId: string) {
  const [existing] = await db
    .select()
    .from(setups)
    .where(and(eq(setups.carModelId, carModelId), eq(setups.isMaster, true)));
  if (existing) return existing;
  const [created] = await db
    .insert(setups)
    .values({ carModelId, isMaster: true, kind: "base", name: "Master" })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // Lost a race with another request: read the winner
  const [again] = await db.select().from(setups).where(and(eq(setups.carModelId, carModelId), eq(setups.isMaster, true)));
  return again;
}

export async function listVersions(carModelId: string) {
  return db
    .select()
    .from(setups)
    .where(and(eq(setups.carModelId, carModelId), isNotNull(setups.versionNo)))
    .orderBy(desc(setups.versionNo));
}

/** Copy every value from one setup into another, replacing what's there. */
export async function copyValues(fromSetupId: string, toSetupId: string) {
  await db.delete(setupValues).where(eq(setupValues.setupId, toSetupId));
  await db.execute(sql`
    INSERT INTO setup_values (setup_id, field_id, corner, value)
    SELECT ${toSetupId}, field_id, corner, value FROM setup_values
     WHERE setup_id = ${fromSetupId} AND value IS NOT NULL`);
}

export async function saveVersion(
  carModelId: string,
  input: { name: string; track?: string | null; eventDate?: string | null; notes?: string | null }
) {
  const master = await ensureMaster(carModelId);
  const [{ next }] = (
    await db.execute(sql`SELECT COALESCE(MAX(version_no), 0) + 1 AS next FROM setups WHERE car_model_id = ${carModelId}`)
  ).rows as { next: number }[];
  const [version] = await db
    .insert(setups)
    .values({
      carModelId,
      isMaster: false,
      versionNo: Number(next),
      kind: "race",
      name: input.name.trim() || `Version ${next}`,
      track: input.track?.trim() || null,
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
      notes: input.notes?.trim() || null,
    })
    .returning();
  await copyValues(master.id, version.id);
  return version;
}

/**
 * Event info for the "Save version" form, read from the master's own sheet
 * boxes (XRAY-style names: race / event, track, date).
 */
export async function eventDefaults(templateId: string, masterId: string) {
  const rows = (
    await db.execute(sql`
      SELECT DISTINCT ON (w.pdf_field) lower(w.pdf_field) AS name, v.value
        FROM sheet_widgets w
        JOIN setup_values v ON v.field_id = w.field_id AND v.setup_id = ${masterId} AND v.corner IS NULL
       WHERE w.template_id = ${templateId} AND v.value IS NOT NULL`)
  ).rows as { name: string; value: string }[];
  const find = (re: RegExp) => rows.find((r) => re.test(r.name))?.value ?? "";
  const rawDate = find(/^(date|event[-_ ]?date)$/);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : toIso(rawDate);
  return { name: find(/^(race|event|event[-_ ]?name)$/), track: find(/^track$/), eventDate: iso };
}

function toIso(s: string) {
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/); // 11/21/2026 or 21.11.26
  if (!m) return "";
  const [, a, b, y] = m;
  const year = y.length === 2 ? `20${y}` : y;
  const [mm, dd] = Number(a) > 12 ? [b, a] : [a, b];
  return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

export async function hasSheetWidgets(templateId: string) {
  const [w] = await db.select({ id: sheetWidgets.id }).from(sheetWidgets).where(eq(sheetWidgets.templateId, templateId)).limit(1);
  return !!w;
}
