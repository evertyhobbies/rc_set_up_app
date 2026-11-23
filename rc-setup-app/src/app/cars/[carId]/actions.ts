"use server";

import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { cars, setups, setupValues } from "@/db/schema";

/** New base or race setup. Copying takes every value from the source setup (full values, not diffs). */
export async function createSetup(
  carId: string,
  input: { name: string; kind: "base" | "race"; track?: string; eventDate?: string; copyFromId?: string }
) {
  const name = input.name.trim();
  if (!name) return { error: "Give the setup a name" };

  const [setup] = await db
    .insert(setups)
    .values({
      carId,
      kind: input.kind === "race" ? "race" : "base",
      name,
      track: input.track?.trim() || null,
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
    })
    .returning();

  if (input.copyFromId) {
    const source = await db.select().from(setupValues).where(eq(setupValues.setupId, input.copyFromId));
    if (source.length) {
      await db.insert(setupValues).values(
        source.map((v) => ({ setupId: setup.id, fieldId: v.fieldId, corner: v.corner, value: v.value }))
      );
    }
  }
  redirect(`/cars/${carId}/setups/${setup.id}`);
}

export async function deleteCar(carId: string) {
  const ids = (await db.select({ id: setups.id }).from(setups).where(eq(setups.carId, carId))).map((s) => s.id);
  if (ids.length) {
    await db.delete(setupValues).where(inArray(setupValues.setupId, ids));
    await db.delete(setups).where(inArray(setups.id, ids));
  }
  await db.delete(cars).where(eq(cars.id, carId));
  redirect("/models");
}

export async function deleteSetup(carId: string, setupId: string) {
  await db.delete(setupValues).where(eq(setupValues.setupId, setupId));
  await db.delete(setups).where(eq(setups.id, setupId));
  redirect(`/cars/${carId}`);
}
