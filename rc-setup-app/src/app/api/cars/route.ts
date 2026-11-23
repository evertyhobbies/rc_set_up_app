import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cars, carModels, setups } from "@/db/schema";
import { isUuid } from "@/lib/rows";
import { templateForModel, defaultBodyStyle } from "@/lib/templates";

export const dynamic = "force-dynamic";

/** POST /api/cars { nickname, carModelId } — creates the car plus an empty "Base" setup */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const nickname = String(b.nickname ?? "").trim();
    if (!nickname) return NextResponse.json({ error: "Give the car a name" }, { status: 400 });
    if (!isUuid(b.carModelId)) return NextResponse.json({ error: "Pick a model year" }, { status: 400 });

    const [model] = await db.select().from(carModels).where(eq(carModels.id, b.carModelId));
    if (!model) return NextResponse.json({ error: "Model not found" }, { status: 404 });

    const template = await templateForModel(model.id);
    const [car] = await db
      .insert(cars)
      .values({ templateId: template.id, nickname, bodyStyle: defaultBodyStyle(model.carClass) })
      .returning();
    await db.insert(setups).values({ carId: car.id, kind: "base", name: "Base" });
    return NextResponse.json({ id: car.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
