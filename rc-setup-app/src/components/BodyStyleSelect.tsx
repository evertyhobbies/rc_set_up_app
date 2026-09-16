"use client";

import { useTransition } from "react";
import { updateCarBodyStyle } from "@/app/cars/[carId]/setups/[setupId]/actions";
import { BODY_STYLE_OPTIONS } from "./CarIcon";

export function BodyStyleSelect({
  carId,
  value,
  path,
}: {
  carId: string;
  value: string;
  path: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={value}
      onChange={(e) =>
        startTransition(() => {
          updateCarBodyStyle(carId, e.target.value, path);
        })
      }
      style={{ opacity: isPending ? 0.6 : 1 }}
      className="rounded-md bg-ink-primary px-2 py-1 font-mono text-xs text-surface-0 outline-none focus:ring-2 focus:ring-accent"
    >
      {BODY_STYLE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
