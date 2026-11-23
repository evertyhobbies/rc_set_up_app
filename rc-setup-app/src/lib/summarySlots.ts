// Where sheet values show on the Summary drawing, plus sensible defaults for
// XRAY-style sheets (fr-/re- prefixed box names). Shared by server and client.

export const ZONES = ["front", "rear", "FL", "FR", "RL", "RR", "center"] as const;
export type Zone = (typeof ZONES)[number];
export const ZONE_LABEL: Record<Zone, string> = {
  front: "Front (above car)",
  rear: "Rear (below car)",
  FL: "Beside front-left wheel",
  FR: "Beside front-right wheel",
  RL: "Beside rear-left wheel",
  RR: "Beside rear-right wheel",
  center: "Bottom strip",
};

export type Slot = { zone: Zone; pdfField: string; label: string; unit: string | null };

// [zone, label, unit, pattern matched against the PDF box name]
const RULES: [Zone, string, string | null, RegExp][] = [
  ["front", "Ride height", "mm", /^fr-?ride-?height$/i],
  ["front", "Camber", "°", /^fr-?camber$/i],
  ["front", "Toe", "°", /^fr-?toe/i],
  ["front", "Downstop", "mm", /^fr-?(downstop|droop)$/i],
  ["front", "Spring", null, /^fr-?spring$/i],
  ["front", "Shock oil", "cSt", /^fr-?shock-?oil$/i],
  ["front", "Anti-roll bar", null, /^fr-?roll-?bar$/i],
  ["rear", "Ride height", "mm", /^re-?ride-?height$/i],
  ["rear", "Camber", "°", /^re-?camber$/i],
  ["rear", "Toe", "°", /^re-?toe/i],
  ["rear", "Downstop", "mm", /^re-?(downstop|droop)$/i],
  ["rear", "Spring", null, /^re-?spring$/i],
  ["rear", "Shock oil", "cSt", /^re-?shock-?oil$/i],
  ["rear", "Anti-roll bar", null, /^re-?roll-?bar$/i],
  ["center", "Pinion", "T", /^pinion$/i],
  ["center", "Spur", "T", /^spur-?gear$|^spur$/i],
  ["center", "FDR", null, /^fdr$/i],
  ["center", "Front diff", "cSt", /^fr-?gear-?diff$/i],
  ["center", "Rear diff", "cSt", /^re-?gear-?diff$/i],
  ["center", "Weight", "g", /^total-?weight$/i],
];

/** Default summary layout from the sheet's box names (first match per rule). */
export function suggestSlots(pdfFields: string[]): Slot[] {
  const out: Slot[] = [];
  const used = new Set<string>();
  for (const [zone, label, unit, re] of RULES) {
    const hit = pdfFields.find((f) => !used.has(f) && re.test(f));
    if (hit) {
      used.add(hit);
      out.push({ zone, pdfField: hit, label, unit });
    }
  }
  return out;
}
