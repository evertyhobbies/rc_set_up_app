"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { setups, setupValues } from "@/db/schema";
import { copyValues, ensureMaster, saveVersion } from "@/lib/modelSetups";

export async function saveVersionAction(
  carModelId: string,
  input: { name: string; track: string; eventDate: string; notes: string }
) {
  const v = await saveVersion(carModelId, input);
  revalidatePath(`/models/${carModelId}`);
  return { id: v.id, versionNo: v.versionNo };
}

/** Replace the master's values with a saved version's, to work on from there. */
export async function loadIntoMaster(carModelId: string, versionId: string) {
  const [v] = await db.select().from(setups).where(and(eq(setups.id, versionId), eq(setups.carModelId, carModelId)));
  if (!v) throw new Error("Version not found");
  const master = await ensureMaster(carModelId);
  await copyValues(v.id, master.id);
  redirect(`/models/${carModelId}/setups/${master.id}?view=sheet`);
}

export async function deleteVersion(carModelId: string, versionId: string) {
  const [v] = await db.select().from(setups).where(and(eq(setups.id, versionId), eq(setups.carModelId, carModelId)));
  if (!v || v.isMaster) return;
  await db.delete(setupValues).where(eq(setupValues.setupId, v.id));
  await db.delete(setups).where(eq(setups.id, v.id));
  redirect(`/models/${carModelId}`);
}
