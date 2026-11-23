/** "fieldId|corner" → value; the same setup_values the summary view uses */
export type SheetValues = Record<string, string>;
export const valueKey = (fieldId: string, corner: string | null) => `${fieldId}|${corner ?? ""}`;

type Corner = "FL" | "FR" | "RL" | "RR";
type Target = { fieldId: string | null; corner: Corner | null; axle?: string | null };

/** Corners a box writes to: an axle-wide box fills both wheels on that axle. */
export function cornersFor(t: Target): (Corner | null)[] {
  if (t.axle === "front") return ["FL", "FR"];
  if (t.axle === "rear") return ["RL", "RR"];
  return [t.corner];
}

/** The value a box shows (for an axle-wide box: the left wheel's, or "L / R" if they differ). */
export function displayValue(values: SheetValues, t: Target): string {
  if (!t.fieldId) return "";
  const cs = cornersFor(t);
  const vs = cs.map((c) => values[valueKey(t.fieldId!, c)] ?? "");
  return vs.every((v) => v === vs[0]) ? vs[0] : vs.join(" / ");
}
