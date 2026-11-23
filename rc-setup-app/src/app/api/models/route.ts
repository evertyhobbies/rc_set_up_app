import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { carModels } from "@/db/schema";
import { isUuid } from "@/lib/rows";
import { templateForModel } from "@/lib/templates";
import { ensureMaster } from "@/lib/modelSetups";

export const dynamic = "force-dynamic";

/** POST /api/models { carModelId } — make sure the model/year has a template and a Master setup */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!isUuid(b.carModelId)) return NextResponse.json({ error: "Pick a model year" }, { status: 400 });
    const [model] = await db.select().from(carModels).where(eq(carModels.id, b.carModelId));
    if (!model) return NextResponse.json({ error: "Model not found" }, { status: 404 });
    await templateForModel(model.id);
    await ensureMaster(model.id);
    return NextResponse.json({ id: model.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
