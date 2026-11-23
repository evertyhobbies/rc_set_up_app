"use client";

import { useMemo, useState, useTransition } from "react";
import { Box, useSaver, type SheetPage, type SheetWidget } from "./SheetView";
import { displayValue, type SheetValues } from "@/lib/sheetValues";

export type CardSection = {
  id: string;
  label: string;
  cropPage: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
};

type Group = { name: string; label: string; unit: string | null; kind: string; widgets: SheetWidget[]; order: number };

/**
 * The AI-built setup: one card per sheet section. Each card shows that part
 * of the manufacturer's sheet (drawings included) with live, clickable boxes,
 * next to a clean list of the same settings. Both edit the same values.
 */
export function SetupCards({
  templateId,
  sections,
  pages,
  widgets,
  initialValues,
  setupId,
  path,
}: {
  templateId: string;
  sections: CardSection[];
  pages: SheetPage[];
  widgets: SheetWidget[];
  initialValues: SheetValues;
  setupId: string;
  path: string;
}) {
  const [values, setValues] = useState(initialValues);
  const [pending, start] = useTransition();
  const [filledOnly, setFilledOnly] = useState(false);
  const save = useSaver(setupId, path, setValues, start);

  const bySection = useMemo(() => {
    const m = new Map<string, Group[]>();
    for (const s of sections) {
      const groups = new Map<string, Group>();
      for (const w of widgets.filter((x) => x.sectionId === s.id && x.fieldId)) {
        const g = groups.get(w.pdfField);
        if (g) g.widgets.push(w);
        else
          groups.set(w.pdfField, {
            name: w.pdfField,
            label: w.label ?? w.pdfField,
            unit: w.unit,
            kind: w.kind,
            widgets: [w],
            order: w.sortOrder ?? 999,
          });
      }
      m.set(s.id, [...groups.values()].sort((a, b) => a.order - b.order));
    }
    return m;
  }, [sections, widgets]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-ink-secondary">
          <input type="checkbox" checked={filledOnly} onChange={(e) => setFilledOnly(e.target.checked)} />
          Filled-in only
        </label>
        <span className="font-mono text-[11px] text-ink-muted">{pending ? "Saving…" : "Saved"}</span>
      </div>
      <div className="flex flex-col gap-4">
        {sections.map((s) => {
          const groups = (bySection.get(s.id) ?? []).filter(
            (g) => !filledOnly || g.widgets.some((w) => displayValue(values, w) !== "")
          );
          if (!groups.length && filledOnly) return null;
          const page = pages.find((p) => p.pageIndex === s.cropPage);
          return (
            <section key={s.id} className="overflow-hidden rounded-md border border-line bg-surface-1">
              <h2 className="border-b border-line px-4 py-2.5 text-sm font-medium text-ink-primary">{s.label}</h2>
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                {page && (
                  <Drawing
                    templateId={templateId}
                    section={s}
                    page={page}
                    widgets={widgets.filter((w) => w.sectionId === s.id && w.fieldId && w.pageIndex === s.cropPage)}
                    values={values}
                    onSave={save}
                  />
                )}
                <div className="divide-y divide-line/60">
                  {groups.map((g) => (
                    <Row key={g.name} group={g} values={values} onSave={save} />
                  ))}
                  {!groups.length && <p className="py-2 text-sm text-ink-muted">No fields in this section.</p>}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** The section's piece of the sheet, with its boxes live on top. */
function Drawing({
  templateId,
  section: s,
  page,
  widgets,
  values,
  onSave,
}: {
  templateId: string;
  section: CardSection;
  page: SheetPage;
  widgets: SheetWidget[];
  values: SheetValues;
  onSave: (w: SheetWidget, v: string) => void;
}) {
  // The crop acts as a smaller "page": widget positions are re-expressed relative to it
  const crop: SheetPage = { pageIndex: page.pageIndex, width: s.cropW * page.width, height: s.cropH * page.height };
  return (
    <div className="self-start overflow-hidden rounded border border-line bg-white">
      <div
        className="sheet-page relative w-full"
        style={{
          aspectRatio: `${crop.width} / ${crop.height}`,
          backgroundImage: `url(/api/templates/${templateId}/sheet/pages/${page.pageIndex})`,
          backgroundSize: `${100 / s.cropW}% ${100 / s.cropH}%`,
          backgroundPosition: `${s.cropW < 1 ? (s.cropX / (1 - s.cropW)) * 100 : 0}% ${s.cropH < 1 ? (s.cropY / (1 - s.cropH)) * 100 : 0}%`,
        }}
      >
        {widgets.map((w) => {
          const local = { ...w, x: (w.x - s.cropX) / s.cropW, y: (w.y - s.cropY) / s.cropH, w: w.w / s.cropW, h: w.h / s.cropH };
          if (local.x + local.w < 0 || local.y + local.h < 0 || local.x > 1 || local.y > 1) return null;
          return <Box key={w.id} w={local} page={crop} value={displayValue(values, w)} onSave={(v) => onSave(w, v)} />;
        })}
      </div>
    </div>
  );
}

/** One setting as a clean, labelled control. */
function Row({ group: g, values, onSave }: { group: Group; values: SheetValues; onSave: (w: SheetWidget, v: string) => void }) {
  const w0 = g.widgets[0];
  const value = displayValue(values, w0);
  const [draft, setDraft] = useState<string | null>(null);
  const where = w0.axle ? ` (${w0.axle === "front" ? "FL+FR" : "RL+RR"})` : w0.corner ? ` (${w0.corner})` : "";

  let control: React.ReactNode;
  if ((g.kind === "checkbox" || g.kind === "radio") && g.widgets.length > 1) {
    control = (
      <div className="flex flex-wrap justify-end gap-1">
        {g.widgets.map((w) => {
          const on = value !== "" && value === w.exportValue;
          return (
            <button
              key={w.id}
              onClick={() => onSave(w, on ? "" : w.exportValue ?? "Yes")}
              className={`rounded px-2 py-0.5 font-mono text-xs ${on ? "bg-accent text-surface-0" : "border border-line text-ink-secondary"}`}
            >
              {w.choiceLabel || w.exportValue}
            </button>
          );
        })}
      </div>
    );
  } else if (g.kind === "checkbox" || g.kind === "radio") {
    const on = value !== "";
    control = (
      <button
        onClick={() => onSave(w0, on ? "" : w0.exportValue ?? "Yes")}
        className={`rounded px-2.5 py-0.5 font-mono text-xs ${on ? "bg-accent text-surface-0" : "border border-line text-ink-muted"}`}
      >
        {on ? `✓ ${w0.choiceLabel ?? ""}`.trim() : w0.choiceLabel || "—"}
      </button>
    );
  } else if (g.kind === "choice") {
    control = (
      <select
        value={value}
        onChange={(e) => onSave(w0, e.target.value)}
        className="rounded bg-ink-primary px-1.5 py-0.5 font-mono text-[14px] text-surface-0 outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">—</option>
        {w0.options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        value={draft ?? value}
        placeholder="—"
        onFocus={() => setDraft(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null && draft !== value) onSave(w0, draft);
          setDraft(null);
        }}
        className="w-24 rounded bg-ink-primary px-1.5 py-0.5 text-right font-mono text-[14px] text-surface-0 outline-none placeholder:text-surface-0/40 focus:ring-2 focus:ring-accent"
      />
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[13px] text-ink-secondary">
        {g.label}
        <span className="text-ink-muted">{where}</span>
      </span>
      <span className="flex items-center gap-1">
        {control}
        {g.unit && <span className="w-7 text-[11px] text-ink-muted">{g.unit}</span>}
      </span>
    </div>
  );
}
