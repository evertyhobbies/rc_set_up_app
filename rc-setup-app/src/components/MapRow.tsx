"use client";

import { useState, useTransition } from "react";
import { linkPdfField, updateSheetField } from "@/app/templates/[templateId]/map/actions";
import { input } from "./PageHeader";

export type Choice = { value: string; label: string };

type Box = { pdfField: string; kind: string; pageIndex: number; x: number; y: number; w: number; h: number; pageW: number; pageH: number };

export function MapRow({
  templateId,
  path,
  box,
  current,
  ownField,
  choices,
}: {
  templateId: string;
  path: string;
  box: Box;
  current: string;
  ownField: { id: string; label: string; tier: "main" | "detail" } | null;
  choices: Choice[];
}) {
  const [target, setTarget] = useState(current);
  const [label, setLabel] = useState(ownField?.label ?? "");
  const [pending, start] = useTransition();

  return (
    <div className="grid items-center gap-3 rounded-md border border-line bg-surface-1 p-3 sm:grid-cols-[200px_1fr]">
      <Crop templateId={templateId} box={box} />
      <div className="min-w-0 space-y-2" style={{ opacity: pending ? 0.6 : 1 }}>
        <div className="truncate font-mono text-[11px] text-ink-muted">
          {box.pdfField} · {box.kind} · p{box.pageIndex + 1}
        </div>
        <select
          className={input}
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            start(() => linkPdfField(templateId, box.pdfField, e.target.value, path));
          }}
        >
          <option value="own">Sheet only (its own field)</option>
          {choices.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {target === "own" && ownField && (
          <div className="flex gap-2">
            <input
              className={input}
              value={label}
              placeholder="Field name, e.g. Front toe"
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => label !== ownField.label && start(() => updateSheetField(ownField.id, { label }, path))}
            />
            <select
              className={`${input} w-32`}
              defaultValue={ownField.tier}
              onChange={(e) => start(() => updateSheetField(ownField.id, { tier: e.target.value as "main" | "detail" }, path))}
            >
              <option value="detail">Detail</option>
              <option value="main">Main</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

/** A crop of the sheet image around this box, so generic names like "Text12" are easy to identify. */
function Crop({ templateId, box }: { templateId: string; box: Box }) {
  // Labels usually sit left of their box, so show more on that side
  const padLeft = 0.2, padRight = 0.05, padY = 0.03;
  const rx = Math.max(0, box.x - padLeft);
  const ry = Math.max(0, box.y - padY);
  const rw = Math.min(1 - rx, box.x - rx + box.w + padRight);
  const rh = Math.min(1 - ry, box.h + padY * 2);
  return (
    <div
      className="relative w-full overflow-hidden rounded bg-white"
      style={{
        aspectRatio: `${rw * box.pageW} / ${rh * box.pageH}`,
        backgroundImage: `url(/api/templates/${templateId}/sheet/pages/${box.pageIndex})`,
        backgroundSize: `${100 / rw}% ${100 / rh}%`,
        backgroundPosition: `${rw < 1 ? (rx / (1 - rw)) * 100 : 0}% ${rh < 1 ? (ry / (1 - rh)) * 100 : 0}%`,
      }}
    >
      <div
        className="absolute rounded-sm ring-2 ring-accent"
        style={{
          left: `${((box.x - rx) / rw) * 100}%`,
          top: `${((box.y - ry) / rh) * 100}%`,
          width: `${(box.w / rw) * 100}%`,
          height: `${(box.h / rh) * 100}%`,
        }}
      />
    </div>
  );
}
