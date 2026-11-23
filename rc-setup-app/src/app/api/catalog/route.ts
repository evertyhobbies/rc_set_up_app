import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/rows";

export const dynamic = "force-dynamic";

/**
 * GET /api/catalog?step=types|manufacturers|scales|models|years&type=&manufacturer=&scale=&model=
 * Choices for each wizard step, filtered by the choices before it.
 * Every option is { id, name }; counts float the relevant ones to the top.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const type = p.get("type") ?? "";
  const manufacturer = p.get("manufacturer") ?? "";
  const scale = p.get("scale") ?? "";
  const model = p.get("model") ?? "";

  try {
    switch (p.get("step")) {
      case "types":
        return NextResponse.json(
          await rows(sql`SELECT name AS id, name FROM car_types ORDER BY sort_order, name`)
        );
      case "manufacturers":
        return NextResponse.json(
          await rows(sql`
            SELECT m.name AS id, m.name,
                   (SELECT count(DISTINCT cm.model_name)::int FROM car_models cm
                     WHERE cm.manufacturer = m.name AND cm.car_class = ${type}) AS count
              FROM manufacturers m
             ORDER BY count DESC, m.name`)
        );
      case "scales":
        return NextResponse.json(
          await rows(sql`
            SELECT s.label AS id, s.label AS name,
                   (SELECT count(DISTINCT cm.model_name)::int FROM car_models cm
                     WHERE cm.scale = s.label AND cm.car_class = ${type} AND cm.manufacturer = ${manufacturer}) AS count
              FROM scales s
             ORDER BY count DESC, s.sort_order, s.label`)
        );
      case "models":
        return NextResponse.json(
          await rows(sql`
            SELECT DISTINCT model_name AS id, model_name AS name FROM car_models
             WHERE car_class = ${type} AND manufacturer = ${manufacturer} AND scale = ${scale} AND model_name IS NOT NULL
             ORDER BY model_name`)
        );
      case "years":
        return NextResponse.json(
          await rows(sql`
            SELECT cm.id, cm.year::text AS name,
                   EXISTS (SELECT 1 FROM setup_templates t WHERE t.car_model_id = cm.id AND t.sheet_name IS NOT NULL) AS has_sheet
              FROM car_models cm
             WHERE cm.car_class = ${type} AND cm.manufacturer = ${manufacturer}
               AND cm.scale = ${scale} AND cm.model_name = ${model}
             ORDER BY cm.year DESC`)
        );
      default:
        return NextResponse.json({ error: "Unknown step" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/**
 * POST /api/catalog { step, name, type?, manufacturer?, scale?, model? } — add a new choice.
 * Adding a model just returns it (a model row needs a year); adding a year creates the car_models row.
 */
export async function POST(req: NextRequest) {
  const b = await req.json();
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  try {
    switch (b.step) {
      case "types":
        await rows(sql`INSERT INTO car_types (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`);
        return NextResponse.json({ id: name, name });
      case "manufacturers":
        await rows(sql`INSERT INTO manufacturers (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`);
        return NextResponse.json({ id: name, name });
      case "scales":
        await rows(sql`INSERT INTO scales (label) VALUES (${name}) ON CONFLICT (label) DO NOTHING`);
        return NextResponse.json({ id: name, name });
      case "models":
        return NextResponse.json({ id: name, name });
      case "years": {
        const year = Number(name);
        if (!Number.isInteger(year) || year < 1970 || year > 2100)
          return NextResponse.json({ error: "Enter a 4-digit year" }, { status: 400 });
        const { type, manufacturer, scale, model } = b;
        if (!type || !manufacturer || !scale || !model)
          return NextResponse.json({ error: "Pick type, manufacturer, scale and model first" }, { status: 400 });
        const [dupe] = await rows<{ id: string }>(sql`
          SELECT id FROM car_models WHERE manufacturer = ${manufacturer} AND model_name = ${model}
             AND scale = ${scale} AND car_class = ${type} AND year = ${year}`);
        if (dupe) return NextResponse.json({ id: dupe.id, name: String(year) });
        // Carry model constants (e.g. internal_ratio) over from another year of the same model
        const [created] = await rows<{ id: string }>(sql`
          INSERT INTO car_models (manufacturer, name, car_class, constants, model_name, year, scale)
          VALUES (${manufacturer}, ${`${model} '${String(year).slice(-2)}`}, ${type},
                  COALESCE((SELECT constants FROM car_models WHERE manufacturer = ${manufacturer} AND model_name = ${model}
                            ORDER BY year DESC NULLS LAST LIMIT 1), '{}'::jsonb),
                  ${model}, ${year}, ${scale})
          RETURNING id`);
        return NextResponse.json({ id: created.id, name: String(year) });
      }
      default:
        return NextResponse.json({ error: "Unknown step" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
