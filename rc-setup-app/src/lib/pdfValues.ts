// Browser-only: read the values out of a FILLED setup sheet, for a template whose
// box layout we already know.
//
//  - Fillable PDF (form fields still present): read each field's value by name.
//  - Flattened PDF (values printed into the page, e.g. after "print to PDF"):
//    match every piece of text to the box it sits in, by position. Ticks are
//    any glyph inside a tick box.
//
// Telling the sheet's own printed labels from filled-in values: label fonts are
// the ones whose text mostly sits OUTSIDE the boxes; value fonts sit inside them.
// No manufacturer-specific font names are needed.

export type TemplateBox = {
  pdf_field: string;
  kind: string; // text | checkbox | radio | choice
  export_value: string | null;
  options: { value: string; label: string }[] | null;
  page_index: number;
  x: number; // 0..1, top-left origin
  y: number;
  w: number;
  h: number;
};

export type Extracted = {
  mode: "fillable" | "flattened";
  values: Record<string, string>; // pdf_field -> value (checkbox/radio: its on-value)
  unplaced: string[]; // value text that didn't land in any box
  pageMismatch: boolean; // page size differs from the template
};

type Item = { page: number; text: string; x0: number; y0: number; x1: number; y1: number; font: string };

const PAD = 0.004; // ~2.4 pt of slack around a box

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function extractFilledValues(
  file: File,
  boxes: TemplateBox[],
  templatePages: { page_index: number; width: number; height: number }[]
): Promise<Extracted> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const known = new Set(boxes.map((b) => b.pdf_field));

  let pageMismatch = doc.numPages < templatePages.length;
  const formValues: Record<string, string> = {};
  const items: Item[] = [];

  for (let i = 1; i <= Math.min(doc.numPages, Math.max(1, templatePages.length)); i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tp = templatePages.find((p) => p.page_index === i - 1);
    if (tp && (Math.abs(tp.width - vp.width) > 2 || Math.abs(tp.height - vp.height) > 2)) pageMismatch = true;

    // 1) Live form fields?
    for (const a of (await page.getAnnotations()) as any[]) {
      if (a.subtype !== "Widget" || !a.fieldName || !known.has(a.fieldName)) continue;
      const v = Array.isArray(a.fieldValue) ? a.fieldValue[0] : a.fieldValue;
      if (v == null || v === "" || v === "Off") continue;
      if (a.checkBox) { if (String(v) === String(a.exportValue)) formValues[a.fieldName] = String(a.exportValue); }
      else if (a.radioButton) { if (String(v) === String(a.buttonValue)) formValues[a.fieldName] = String(a.buttonValue); }
      else formValues[a.fieldName] = String(v);
    }

    // 2) Printed text, with page-space boxes in 0..1 top-left coordinates
    const tc = await page.getTextContent();
    for (const it of tc.items as any[]) {
      const text = String(it.str ?? "");
      if (!text.trim()) continue;
      const [a, b, c, d, e, f] = it.transform as number[];
      const size = Math.hypot(c, d) || Math.abs(it.height) || 8;
      const width = it.width || size * 0.5 * text.length;
      const run = Math.hypot(a, b) ? [a / Math.hypot(a, b), b / Math.hypot(a, b)] : [1, 0];
      // corners of the run in PDF space: baseline start, baseline end, and the same raised by ~0.8 em
      const up = [-run[1] * size * 0.8, run[0] * size * 0.8];
      const pts = [
        [e, f],
        [e + run[0] * width, f + run[1] * width],
        [e + up[0], f + up[1]],
        [e + run[0] * width + up[0], f + run[1] * width + up[1]],
      ].map(([px, py]) => vp.convertToViewportPoint(px, py));
      const xs = pts.map((p) => p[0] / vp.width), ys = pts.map((p) => p[1] / vp.height);
      items.push({ page: i - 1, text, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), font: it.fontName });
    }
  }

  if (Object.keys(formValues).length) {
    return { mode: "fillable", values: formValues, unplaced: [], pageMismatch };
  }

  // --- Flattened: decide which fonts are filled-in values -----------------
  const inside = (it: Item, bx: TemplateBox) => {
    const cx = (it.x0 + it.x1) / 2, cy = (it.y0 + it.y1) / 2;
    return it.page === bx.page_index && cx >= bx.x - PAD && cx <= bx.x + bx.w + PAD && cy >= bx.y - PAD && cy <= bx.y + bx.h + PAD;
  };
  const boxFor = (it: Item) => {
    const hits = boxes.filter((bx) => inside(it, bx));
    return hits.sort((p, q) => p.w * p.h - q.w * q.h)[0]; // smallest box wins
  };
  const fontStats = new Map<string, { inBox: number; total: number }>();
  for (const it of items) {
    const s = fontStats.get(it.font) ?? { inBox: 0, total: 0 };
    s.total++;
    if (boxFor(it)) s.inBox++;
    fontStats.set(it.font, s);
  }
  const isValueFont = (font: string) => {
    const s = fontStats.get(font)!;
    return s.inBox / s.total >= 0.5;
  };

  // --- Collect value text per box -----------------------------------------
  const perBox = new Map<string, { box: TemplateBox; parts: Item[] }[]>();
  const unplaced: string[] = [];
  for (const it of items) {
    if (!isValueFont(it.font)) continue;
    const bx = boxFor(it);
    if (!bx) {
      unplaced.push(it.text.trim());
      continue;
    }
    const list = perBox.get(bx.pdf_field) ?? [];
    let entry = list.find((e) => e.box === bx);
    if (!entry) list.push((entry = { box: bx, parts: [] }));
    entry.parts.push(it);
    perBox.set(bx.pdf_field, list);
  }

  const values: Record<string, string> = {};
  for (const [name, entries] of perBox) {
    const kind = entries[0].box.kind;
    if (kind === "checkbox" || kind === "radio") {
      // A mark in one of the group's boxes: that box's on-value
      const ticked = entries.find((e) => e.parts.some((p) => p.text.trim()));
      if (ticked) values[name] = ticked.box.export_value ?? "Yes";
      continue;
    }
    // Text: reading order, lines joined with newlines
    const parts = entries.flatMap((e) => e.parts).sort((p, q) => (Math.abs(p.y0 - q.y0) > 0.004 ? p.y0 - q.y0 : p.x0 - q.x0));
    const lines: string[][] = [];
    let lastY = -1;
    for (const p of parts) {
      if (lastY < 0 || Math.abs(p.y0 - lastY) > 0.004) lines.push([]);
      lines[lines.length - 1].push(p.text.trim());
      lastY = p.y0;
    }
    let text = lines.map((l) => l.join(" ")).join("\n").trim();
    if (kind === "choice") {
      const opt = entries[0].box.options?.find((o) => o.label === text || o.value === text);
      if (opt) text = opt.value;
    }
    if (text) values[name] = text;
  }

  return { mode: "flattened", values, unplaced, pageMismatch };
}

/** "9/26/2026", "26.9.26", "2026-09-26" → "2026-09-26" (or "" if unrecognised). */
export function toIsoDate(s: string) {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!m) return "";
  const [, a, b, y] = m;
  const year = y.length === 2 ? `20${y}` : y;
  const [mm, dd] = Number(a) > 12 ? [b, a] : [a, b];
  return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}
