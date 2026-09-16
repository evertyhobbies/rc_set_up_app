"use client";

import { useState, useTransition } from "react";
import { RenderField } from "@/lib/getSetupData";
import { saveValue } from "@/app/cars/[carId]/setups/[setupId]/actions";

export function ValueInput({
  field,
  setupId,
  corner,
  path,
}: {
  field: RenderField;
  setupId: string;
  corner?: "FL" | "FR" | "RL" | "RR";
  path: string;
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

  const inputClass =
    "w-20 bg-transparent text-right font-mono text-[15px] text-accent outline-none border-b border-transparent focus:border-accent/50 placeholder:text-ink-muted";

  return (
    <div className="flex items-baseline justify-between py-1.5">
      <label className="text-[13px] text-ink-secondary">{field.label}</label>
      <span className="flex items-baseline gap-1">
        {field.type === "select" ? (
          <select
            value={value}
            onChange={(e) => commit(e.target.value)}
            className="bg-transparent font-mono text-[15px] text-accent outline-none"
          >
            <option value="" className="bg-surface-1">
              —
            </option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt} className="bg-surface-1">
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
