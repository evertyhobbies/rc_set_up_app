"use client";

import { useState, useTransition } from "react";
import { RenderField } from "@/lib/getSetupData";
import { saveValue } from "@/app/cars/[carId]/setups/[setupId]/actions";

export function ValueInput({
  field,
  setupId,
  corner,
  path,
  stacked = false,
  label,
  size = "lg",
}: {
  field: RenderField;
  setupId: string;
  corner?: "FL" | "FR" | "RL" | "RR";
  path: string;
  stacked?: boolean;
  label?: string;
  size?: "lg" | "sm";
}) {
  const raw = corner ? field.values[corner] : field.values.value;
  const [value, setValue] = useState(raw === null || raw === undefined ? "" : String(raw));
  const [isPending, startTransition] = useTransition();

  function commit(next: string) {
    setValue(next);
    startTransition(() => {
      saveValue(setupId, field.id, corner ?? null, next, path);
    });
  }

  const displayLabel = label ?? field.label;

  if (stacked) {
    const valueTextClass = size === "sm" ? "text-base" : "text-2xl";
    const labelTextClass = size === "sm" ? "text-[11px]" : "text-[13px]";
    const blockPad = size === "sm" ? "px-1.5 py-0.5" : "px-2.5 py-1";
    const stackedInputClass = `bg-ink-primary text-surface-0 text-center font-mono ${valueTextClass} rounded-md ${blockPad} outline-none focus:ring-2 focus:ring-accent placeholder:text-surface-0/40`;

    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`${labelTextClass} font-medium text-accent`}>{displayLabel}</span>
        {field.type === "select" ? (
          <select
            value={value}
            onChange={(e) => commit(e.target.value)}
            className={`bg-ink-primary text-surface-0 font-mono ${valueTextClass} rounded-md ${blockPad} outline-none focus:ring-2 focus:ring-accent text-center`}
          >
            <option value="">—</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <span className="flex items-baseline gap-1">
            <input
              type={field.type === "number" ? "number" : "text"}
              inputMode={field.type === "number" ? "decimal" : "text"}
              value={value}
              placeholder="—"
              onChange={(e) => setValue(e.target.value)}
              onBlur={(e) => commit(e.target.value)}
              className={stackedInputClass}
              style={{ opacity: isPending ? 0.6 : 1, width: `${Math.max(value.length, 2) + 3}ch` }}
            />
            {field.unit && <span className="text-xs text-ink-muted">{field.unit}</span>}
          </span>
        )}
      </div>
    );
  }

  const inputClass =
    "w-20 bg-ink-primary text-surface-0 text-right font-mono text-[15px] rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-accent placeholder:text-surface-0/40";

  return (
    <div className="flex items-baseline justify-between py-1.5">
      <label className="text-[13px] text-ink-secondary">{displayLabel}</label>
      <span className="flex items-baseline gap-1">
        {field.type === "select" ? (
          <select
            value={value}
            onChange={(e) => commit(e.target.value)}
            className="bg-ink-primary text-surface-0 font-mono text-[15px] rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">—</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={field.type === "number" ? "number" : "text"}
            inputMode={field.type === "number" ? "decimal" : "text"}
            value={value}
            placeholder="—"
            onChange={(e) => setValue(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            className={inputClass}
            style={{ opacity: isPending ? 0.6 : 1 }}
          />
        )}
        {field.unit && <span className="text-[11px] text-ink-muted">{field.unit}</span>}
      </span>
    </div>
  );
}
