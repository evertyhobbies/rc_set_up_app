import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Reads an imported setup sheet with Claude and proposes how the app should
 * present it. Two steps, so each request stays short and every image stays sharp:
 *   1. layout  — the whole page → named sections with bounding boxes
 *   2. section — a close-up of one section, its boxes outlined and numbered →
 *                a label, unit, tier and storage choice for every box
 * Output is forced through a tool schema, so it's always structured JSON.
 * Set AI_MOCK=1 to get canned answers (for local tests without an API key).
 */

export const AI_MODEL = process.env.AI_MODEL || "claude-opus-5-5";

export class AiNotConfigured extends Error {}

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiNotConfigured("ANTHROPIC_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.");
  }
  return new Anthropic();
}

type Img = { mime: "image/jpeg" | "image/png" | "image/webp"; b64: string };

/** Structured outputs require additionalProperties: false on every object. */
function strict(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(strict);
  if (!schema || typeof schema !== "object") return schema;
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) o[k] = strict(v);
  const t = o.type;
  if (t === "object" || (Array.isArray(t) && t.includes("object"))) o.additionalProperties = false;
  return o;
}

/** One request whose answer is JSON matching `schema` (Messages API structured outputs). */
async function askJson<T>(opts: {
  system: string;
  images: Img[];
  text: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}): Promise<T> {
  const msg = await client().messages.create({
    model: AI_MODEL,
    max_tokens: opts.maxTokens,
    system: opts.system,
    output_config: { format: { type: "json_schema", schema: strict(opts.schema) as Record<string, unknown> } },
    messages: [
      {
        role: "user",
        content: [
          ...opts.images.map((i) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: i.mime, data: i.b64 },
          })),
          { type: "text" as const, text: opts.text },
        ],
      },
    ],
  });
  if (msg.stop_reason === "max_tokens") throw new Error("The AI's answer was cut off. Try again.");
  if (msg.stop_reason === "refusal") throw new Error("The AI declined this request.");
  const text = msg.content.find((c) => c.type === "text");
  if (!text || text.type !== "text") throw new Error("The AI didn't return a result. Try again.");
  return JSON.parse(text.text) as T;
}

const SYSTEM = `You help an RC racer digitize manufacturer setup sheets (touring cars, buggies, F1, etc.) into a setup app.
You know RC setup terminology: ride height, camber, toe, caster, droop/downstop, roll center/shims, anti-roll bars,
springs, shock oil (cSt), pistons, diff oil, spool/solid axle, pinion/spur/final drive ratio, steering/ackermann,
bump steer, flex, tires/additive, electronics (motor, ESC, timing), weight balance.
Read printed labels carefully. Abbreviations on sheets: fr/F = front, re/rr/R = rear, ff = front-front, rf = rear-front.
Be faithful to what is printed; never invent settings that aren't on the sheet.`;

// ---------------------------------------------------------------------------
export type LayoutSection = { key: string; label: string; page: number; x: number; y: number; w: number; h: number };

export async function aiLayout(input: {
  pages: (Img & { index: number })[];
  boxes: { name: string; page: number; cx: number; cy: number }[];
}): Promise<LayoutSection[]> {
  if (process.env.AI_MOCK) return mockLayout(input.pages.length);
  const boxList = input.boxes.map((b) => `${b.name}@p${b.page}(${b.cx.toFixed(3)},${b.cy.toFixed(3)})`).join(" ");
  const res = await askJson<{ sections: LayoutSection[] }>({
    system: SYSTEM,
    images: input.pages,
    maxTokens: 4000,
    text: `These are the pages of a setup sheet (in order, page index starting at 0).
Divide the sheet into the sections a racer would recognize, usually 6 to 16, for example:
event info, track conditions, front suspension, rear suspension, front shocks, rear shocks,
transmission/differentials, steering, chassis/flex, electronics, tires, weight, notes.
Follow the sheet's own headings and boxed panels where they exist.

For each section give a snake_case key, a short label, the page index, and a bounding box as fractions
of the page (x, y = top-left corner, w, h; 0..1). The box must enclose the section's heading, its drawings
and all of its input boxes, without large overlaps with other sections.

Every fillable input box must fall inside exactly one section. Box centers (name@page(x,y)):
${boxList}`,
    schema: {
        type: "object",
        properties: {
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: { type: "string" },
                label: { type: "string" },
                page: { type: "integer" },
                x: { type: "number" },
                y: { type: "number" },
                w: { type: "number" },
                h: { type: "number" },
              },
              required: ["key", "label", "page", "x", "y", "w", "h"],
            },
          },
        },
        required: ["sections"],
    },
  });
  return res.sections;
}

// ---------------------------------------------------------------------------
export type SectionBox = {
  n: number;
  name: string;
  kind: string;
  exportValues: string[];
  options: string[];
  x: number;
  y: number;
  w: number;
  h: number;
};
export type ExistingField = { key: string; label: string; unit: string | null; scope: string };

export type AiField = {
  pdf_field: string;
  label: string;
  unit: string | null;
  tier: "main" | "detail";
  order: number;
  link: { field_key: string; corner: "FL" | "FR" | "RL" | "RR" | null; axle: "front" | "rear" | null } | null;
  choices: { export_value: string; label: string }[];
};

export async function aiSection(input: {
  section: { key: string; label: string };
  image: Img;
  boxes: SectionBox[];
  existing: ExistingField[];
}): Promise<AiField[]> {
  if (process.env.AI_MOCK) return mockSection(input.boxes, input.existing);
  const boxes = input.boxes
    .map(
      (b) =>
        `#${b.n} name="${b.name}" kind=${b.kind} at (${b.x.toFixed(2)},${b.y.toFixed(2)}) size ${b.w.toFixed(2)}x${b.h.toFixed(2)}` +
        (b.exportValues.length ? ` on-values=${JSON.stringify(b.exportValues)}` : "") +
        (b.options.length ? ` options=${JSON.stringify(b.options)}` : "")
    )
    .join("\n");
  const existing = input.existing.map((f) => `${f.key}: "${f.label}"${f.unit ? ` (${f.unit})` : ""} scope=${f.scope}`).join("\n");

  const res = await askJson<{ fields: AiField[] }>({
    system: SYSTEM,
    images: [input.image],
    maxTokens: 12000,
    text: `This is the "${input.section.label}" section of a setup sheet. Every fillable box is outlined in magenta
and tagged with its #number. Positions below are fractions of this image (x, y = top-left).

Boxes:
${boxes}

The app already has these summary fields (shown on a top-down car diagram):
${existing || "(none)"}

For every distinct box name, return:
- label: what a racer would call this setting, from the printed text next to/above the box
  (e.g. "Front ride height", "Shock oil", "Pinion"). Add Front/Rear when it isn't obvious from the section.
  For a checkbox that is one option of a group (e.g. "Carpet"), name the setting, e.g. "Track surface".
- unit: the printed unit (mm, °, cSt, T, g, %, …) or null.
- tier: "main" for settings racers check at a glance and change often (ride height, camber, toe, droop/downstop,
  caster, springs, shock oil, pistons, diff oil, anti-roll bars, gearing, tires/additive, weight);
  "detail" for everything else (event info, shims, flex options, part choices, electronics details).
- order: reading order within this section, starting at 1.
- link: ONLY if the box clearly records the same setting as one of the summary fields, give its field_key.
  For a summary field with scope=corner: if the box holds one value for a whole axle set axle "front" or "rear";
  if it is for one wheel set corner (FL/FR/RL/RR). Otherwise both null. Do not link event info. If unsure, null.
- choices: for checkbox/radio boxes, give the printed label of each on-value (e.g. "4°", "Carpet", "1.3 mm").
  Empty list for text boxes.`,
    schema: {
        type: "object",
        properties: {
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                pdf_field: { type: "string", description: "The box name exactly as given" },
                label: { type: "string" },
                unit: { type: ["string", "null"] },
                tier: { type: "string", enum: ["main", "detail"] },
                order: { type: "integer" },
                link: {
                  type: ["object", "null"],
                  properties: {
                    field_key: { type: "string" },
                    corner: { anyOf: [{ type: "string", enum: ["FL", "FR", "RL", "RR"] }, { type: "null" }] },
                    axle: { anyOf: [{ type: "string", enum: ["front", "rear"] }, { type: "null" }] },
                  },
                  required: ["field_key", "corner", "axle"],
                },
                choices: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { export_value: { type: "string" }, label: { type: "string" } },
                    required: ["export_value", "label"],
                  },
                },
              },
              required: ["pdf_field", "label", "unit", "tier", "order", "link", "choices"],
            },
          },
        },
        required: ["fields"],
    },
  });
  return res.fields;
}

// ---------------------------------------------------------------------------
// Canned answers for AI_MOCK=1: a 2x3 grid of sections, labels from box names.
function mockLayout(pageCount: number): LayoutSection[] {
  const out: LayoutSection[] = [];
  for (let p = 0; p < pageCount; p++)
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 2; c++)
        out.push({ key: `p${p}_r${r}_c${c}`, label: `Area ${p + 1}.${r * 2 + c + 1}`, page: p, x: c / 2, y: r / 3, w: 0.5, h: 1 / 3 });
  return out;
}

function mockSection(boxes: SectionBox[], existing: ExistingField[]): AiField[] {
  const seen = new Set<string>();
  const out: AiField[] = [];
  for (const b of boxes) {
    if (seen.has(b.name)) continue;
    seen.add(b.name);
    const label = b.name.replace(/[_\-]+/g, " ").replace(/^fr /, "Front ").replace(/^re /, "Rear ");
    const match = existing.find((e) => e.key === b.name.replace(/-/g, "_"));
    out.push({
      pdf_field: b.name,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      unit: null,
      tier: /ride|camber|toe|pinion|spur/.test(b.name) ? "main" : "detail",
      order: out.length + 1,
      link: match ? { field_key: match.key, corner: null, axle: null } : null,
      choices: boxes.filter((x) => x.name === b.name).flatMap((x) => x.exportValues.map((v) => ({ export_value: v, label: v }))),
    });
  }
  return out;
}
