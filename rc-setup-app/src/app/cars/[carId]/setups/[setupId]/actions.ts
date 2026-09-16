"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { setupValues } from "@/db/schema";

export async function saveValue(
  setupId: string,
  fieldId: string,
  corner: "FL" | "FR" | "RL" | "RR" | null,
  value: string,
  path: string
) {
  const cornerCondition = corner ? eq(setupValues.corner, corner) : isNull(setupValues.corner);

  const [existing] = await db
    .select()
    .from(setupValues)
    .where(and(eq(setupValues.setupId, setupId), eq(setupValues.fieldId, fieldId), cornerCondition));

  if (existing) {
    await db
      .update(setupValues)
      .set({ value: value === "" ? null : value })
      .where(eq(setupValues.id, existing.id));
  } else if (value !== "") {
    await db.insert(setupValues).values({ setupId, fieldId, corner: corner ?? undefined, value });
  }

  revalidatePath(path);
}
