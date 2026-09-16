import { RenderField } from "@/lib/getSetupData";

export function Readout({
  field,
  corner,
  highlight,
  stacked = false,
  label,
  size = "lg",
}: {
  field: RenderField;
  corner?: "FL" | "FR" | "RL" | "RR";
  highlight?: boolean;
  stacked?: boolean;
  label?: string;
  size?: "lg" | "sm";
}) {
  const raw = corner ? field.values[corner] : field.values.value;
  const display =
    raw === null || raw === undefined || raw === ""
      ? "—"
      : field.type === "computed"
        ? Number(raw).toFixed(field.unit === "%" ? 0 : 2)
        : String(raw);

  const displayLabel = label ?? field.label;

  if (stacked) {
    const valueTextClass = size === "sm" ? "text-base" : "text-2xl";
    const labelTextClass = size === "sm" ? "text-[11px]" : "text-[13px]";
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`${labelTextClass} font-medium text-accent`}>{displayLabel}</span>
        <span className="flex items-baseline gap-1">
          <span className={`font-mono ${valueTextClass} text-ink-primary`}>{display}</span>
          {field.unit && <span className="text-xs text-ink-muted">{field.unit}</span>}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-[13px] text-ink-secondary">{displayLabel}</span>
      <span className="flex items-baseline gap-1 font-mono">
        <span className={`text-[15px] ${highlight ? "text-warn" : "text-accent"}`}>
          {display}
        </span>
        {field.unit && <span className="text-[11px] text-ink-muted">{field.unit}</span>}
      </span>
    </div>
  );
}
