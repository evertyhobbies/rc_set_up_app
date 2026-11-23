"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { saveValue } from "@/app/cars/[carId]/setups/[setupId]/actions";
import { valueKey, type SheetValues } from "@/lib/sheetValues";

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
};

export type SheetPage = { pageIndex: number; width: number; height: number };


export function SheetView({
  templateId,
  pages,
  widgets,
  initialValues,
  setupId,
  path,
}: {
  templateId: string;
  pages: SheetPage[];
  widgets: SheetWidget[];
  initialValues: SheetValues;
  setupId: string;
  path: string;
}) {
  const [values, setValues] = useState(initialValues);
  const [locked, setLocked] = useState(false);
  const [pending, start] = useTransition();

  function save(w: SheetWidget, value: string) {
    if (!w.fieldId) return;
    const key = valueKey(w.fieldId, w.corner);
    setValues((v) => ({ ...v, [key]: value }));
    start(() => saveValue(setupId, w.fieldId!, w.corner, value, path));
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
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
                    value={values[valueKey(w.fieldId!, w.corner)] ?? ""}
                    onSave={(v) => save(w, v)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Box({ w, page, value, onSave }: { w: SheetWidget; page: SheetPage; value: string; onSave: (v: string) => void }) {
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
        style={{ ...style, fontSize: `${((heightPts * 0.9) / page.width) * 100}cqw`, padding: 0 }}
        onClick={() => onSave(on ? "" : onValue)}
      >
        {on ? (w.kind === "radio" ? "●" : "✓") : ""}
      </button>
    );
  }
  if (w.kind === "choice") {
    return (
      <select title={title} className={cls} style={style} value={value} onChange={(e) => onSave(e.target.value)}>
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
    value: focused ? draft : value,
    onFocus: () => {
      setDraft(value);
      setFocused(true);
    },
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: () => {
      setFocused(false);
      if (draft !== value) onSave(draft);
    },
  };
  return w.multiline ? <textarea {...common} /> : <input {...common} />;
}
