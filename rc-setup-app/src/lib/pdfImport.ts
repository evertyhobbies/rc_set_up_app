// Browser-only: turns an editable setup-sheet PDF into
//   1) one clean background image per page (form fields not drawn), and
//   2) a list of form-field widgets with positions as 0..1 fractions of the page,
//   3) any values already filled in the PDF.

export type ParsedWidget = {
  page_index: number;
  field_name: string;
  kind: "text" | "checkbox" | "radio" | "choice";
  export_value: string | null;
  options: { value: string; label: string }[] | null;
  x: number;
  y: number;
  w: number;
  h: number;
  font_size: number | null;
  multiline: boolean;
  align: number;
};

export type ParsedSheet = {
  pages: { width: number; height: number; image: Blob }[];
  widgets: ParsedWidget[];
  values: Record<string, string>;
  fieldCount: number;
};

const TARGET_WIDTH_PX = 2000; // sharp on iPad, still small enough to store
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function parseSetupPdf(file: File, onProgress?: (msg: string) => void): Promise<ParsedSheet> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: ParsedSheet["pages"] = [];
  const widgets: ParsedWidget[] = [];
  const values: Record<string, string> = {};

  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.(`Reading page ${i} of ${doc.numPages}…`);
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 }); // PDF points, rotation applied
    const scale = Math.min(TARGET_WIDTH_PX / base.width, 4);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
      annotationMode: pdfjs.AnnotationMode.DISABLE, // background only; fields become live inputs
    } as any).promise;
    pages.push({ width: base.width, height: base.height, image: await toJpeg(canvas) });

    const annots: any[] = await page.getAnnotations();
    for (const a of annots) {
      if (a.subtype !== "Widget" || !a.fieldName || a.hidden || a.pushButton) continue;
      const kind =
        a.fieldType === "Tx" ? "text"
        : a.fieldType === "Ch" ? "choice"
        : a.fieldType === "Btn" ? (a.radioButton ? "radio" : "checkbox")
        : null;
      if (!kind) continue;

      const [x1, y1] = base.convertToViewportPoint(a.rect[0], a.rect[1]);
      const [x2, y2] = base.convertToViewportPoint(a.rect[2], a.rect[3]);
      const left = Math.min(x1, x2), top = Math.min(y1, y2);
      const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
      if (w < 1 || h < 1) continue;

      const export_value = kind === "checkbox" ? a.exportValue ?? "Yes" : kind === "radio" ? a.buttonValue ?? null : null;
      widgets.push({
        page_index: i - 1,
        field_name: a.fieldName,
        kind,
        export_value,
        options:
          kind === "choice"
            ? (a.options ?? []).map((o: any) => ({ value: String(o.exportValue ?? o.displayValue), label: String(o.displayValue ?? o.exportValue) }))
            : null,
        x: left / base.width,
        y: top / base.height,
        w: w / base.width,
        h: h / base.height,
        font_size: a.defaultAppearanceData?.fontSize || null,
        multiline: !!a.multiLine,
        align: a.textAlignment ?? 0,
      });

      // Pick up anything already filled in
      const fv = Array.isArray(a.fieldValue) ? a.fieldValue[0] : a.fieldValue;
      if (fv == null || fv === "" || fv === "Off") continue;
      if (kind === "text" || kind === "choice") values[a.fieldName] = String(fv);
      else if (String(fv) === String(export_value)) values[a.fieldName] = String(export_value);
    }
  }

  return { pages, widgets, values, fieldCount: new Set(widgets.map((w) => w.field_name)).size };
}

async function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  for (const q of [0.85, 0.75, 0.6, 0.45]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= MAX_IMAGE_BYTES) return blob;
  }
  throw new Error("Page image is too large to store");
}
