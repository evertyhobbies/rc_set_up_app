import { RenderField } from "@/lib/getSetupData";

export function Readout({
  field,
  corner,
  highlight,
}: {
  field: RenderField;
  corner?: "FL" | "FR" | "RL" | "RR";
  highlight?: boolean;
}) {
  const raw = corner ? field.values[corner] : field.values.value;
  const display =
    raw === null || raw === undefined || raw === ""
      ? "—"
      : field.type === "computed"
        ? Number(raw).toFixed(field.unit === "%" ? 0 : 2)
        : String(raw);

  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-[13px] text-ink-secondary">{field.label}</span>
      <span className="flex items-baseline gap-1 font-mono">
        <span className={`text-[15px] ${highlight ? "text-warn" : "text-accent"}`}>
          {display}
        </span>
        {field.unit && <span className="text-[11px] text-ink-muted">{field.unit}</span>}
      </span>
    </div>
  );
}
