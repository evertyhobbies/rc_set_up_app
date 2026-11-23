"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { saveValue } from "@/app/cars/[carId]/setups/[setupId]/actions";
import { valueKey, cornersFor, displayValue, type SheetValues } from "@/lib/sheetValues";

export type SheetWidget = {
  id: string;
  pageIndex: number;
  pdfField: string;
  kind: string;
  exportValue: string | null;
  options: { value: string; label: string }[] | null;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number | null;
  multiline: boolean;
  align: number;
  fieldId: string | null;
  corner: "FL" | "FR" | "RL" | "RR" | null;
  axle: string | null;
  sectionId: string | null;
  label: string | null;
  unit: string | null;
  choiceLabel: string | null;
  sortOrder: number | null;
};

export type SheetPage = { pageIndex: number; width: number; height: number };


export function SheetView({
  templateId,
  pages,
  widgets,
  initialValues,
  setupId,
  path,
  readOnly = false,
}: {
  templateId: string;
  pages: SheetPage[];
  widgets: SheetWidget[];
  initialValues: SheetValues;
  setupId: string;
  path: string;
  readOnly?: boolean;
}) {
  const [values, setValues] = useState(initialValues);
  const [lockedByUser, setLocked] = useState(false);
  const locked = readOnly || lockedByUser;
  const [pending, start] = useTransition();

  const save = useSaver(setupId, path, setValues, start);

  return (
    <div>
      <div className={`mb-3 flex items-center gap-3 ${readOnly ? "hidden" : ""}`}>
        <button
          onClick={() => setLocked(!locked)}
          className="rounded-md border border-line bg-surface-1 px-3 py-1.5 text-xs font-medium text-ink-primary hover:border-accent/40"
        >
          {locked ? "🔒 Locked" : "✏️ Editing"}
        </button>
        <span className="font-mono text-[11px] text-ink-muted">{pending ? "Saving…" : "Saved"}</span>
      </div>
      <div className="space-y-4">
        {pages.map((p) => (
          <div key={p.pageIndex} className="overflow-x-auto rounded-md border border-line bg-white">
            <div
              className={`sheet-page relative min-w-[900px] ${locked ? "sheet-locked" : ""}`}
              style={{ aspectRatio: `${p.width} / ${p.height}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/templates/${templateId}/sheet/pages/${p.pageIndex}`}
                alt={`Setup sheet page ${p.pageIndex + 1}`}
                className="absolute inset-0 h-full w-full select-none"
                draggable={false}
              />
              {widgets
                .filter((w) => w.pageIndex === p.pageIndex && w.fieldId)
                .map((w) => (
                  <Box
                    key={w.id}
                    w={w}
                    page={p}
                    value={displayValue(values, w)}
                    onSave={(v) => save(w, v)}
                    readOnly={locked}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Save a box's value to every corner it covers, updating local state first. */
export function useSaver(
  setupId: string,
  path: string,
  setValues: (fn: (v: SheetValues) => SheetValues) => void,
  start: (fn: () => Promise<void>) => void
) {
  return (w: Pick<SheetWidget, "fieldId" | "corner" | "axle">, value: string) => {
    if (!w.fieldId) return;
    const corners = cornersFor(w);
    setValues((v) => {
      const next = { ...v };
      for (const c of corners) next[valueKey(w.fieldId!, c)] = value;
      return next;
    });
    start(async () => {
      for (const c of corners) await saveValue(setupId, w.fieldId!, c, value, path);
    });
  };
}

export function Box({
  w,
  page,
  value,
  onSave,
  readOnly = false,
}: {
  w: SheetWidget;
  page: SheetPage;
  value: string;
  onSave: (v: string) => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const heightPts = w.h * page.height;
  const fontPts = w.fontSize && w.fontSize > 0 ? Math.min(w.fontSize, heightPts * 0.85) : Math.min(heightPts * 0.68, 11);
  const style: CSSProperties = {
    left: `${w.x * 100}%`,
    top: `${w.y * 100}%`,
    width: `${w.w * 100}%`,
    height: `${w.h * 100}%`,
    fontSize: `${(fontPts / page.width) * 100}cqw`,
    textAlign: (["left", "center", "right"] as const)[w.align] ?? "left",
  };
  const cls = `sheet-field ${value ? "filled" : ""}`;
  const title = `${w.pdfField}${w.corner ? ` (${w.corner})` : ""}`;

  if (w.kind === "checkbox" || w.kind === "radio") {
    const onValue = w.exportValue ?? "Yes";
    const on = value !== "" && value === onValue;
    return (
      <button
        type="button"
        title={title}
        className={`${cls} sheet-mark`}
        disabled={readOnly}
        style={{ ...style, fontSize: `${((heightPts * 0.9) / page.width) * 100}cqw`, padding: 0 }}
        onClick={() => onSave(on ? "" : onValue)}
      >
        {on ? (w.kind === "radio" ? "●" : "✓") : ""}
      </button>
    );
  }
  if (w.kind === "choice") {
    return (
      <select title={title} className={cls} style={style} value={value} disabled={readOnly} onChange={(e) => onSave(e.target.value)}>
        <option value="" />
        {w.options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        {value && !w.options?.some((o) => o.value === value) && <option value={value}>{value}</option>}
      </select>
    );
  }
  const common = {
    title,
    className: cls,
    style,
    readOnly,
    tabIndex: readOnly ? -1 : undefined,
    value: focused ? draft : value,
    onFocus: () => {
      setDraft(value);
      setFocused(true);
    },
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: () => {
      setFocused(false);
      if (!readOnly && draft !== value) onSave(draft);
    },
  };
  return w.multiline ? <textarea {...common} /> : <input {...common} />;
}
