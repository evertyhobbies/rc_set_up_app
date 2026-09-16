import { RenderField } from "@/lib/getSetupData";

export function Readout({
  field,
  corner,
  highlight,
  stacked = false,
  label,
}: {
  field: RenderField;
  corner?: "FL" | "FR" | "RL" | "RR";
  highlight?: boolean;
  /** Label above, big bold centered value below — the digital-scale look. */
  stacked?: boolean;
  /** Override the displayed label (defaults to field.label). */
  label?: string;
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
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[13px] font-medium text-accent">{displayLabel}</span>
        <span className="flex items-baseline gap-1">
          <span className="font-mono text-2xl text-ink-primary">{display}</span>
          {field.unit && <span className="text-sm text-ink-muted">{field.unit}</span>}
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
