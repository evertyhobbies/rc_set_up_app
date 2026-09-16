import { RenderField } from "@/lib/getSetupData";
import { ValueInput } from "./ValueInput";

const CORNER_LABELS: Record<"FL" | "FR" | "RL" | "RR", string> = {
  FL: "Front left",
  FR: "Front right",
  RL: "Rear left",
  RR: "Rear right",
};

export function CornerCard({
  corner,
  fields,
  setupId,
  path,
}: {
  corner: "FL" | "FR" | "RL" | "RR";
  fields: RenderField[];
  setupId: string;
  path: string;
}) {
  return (
    <div className="rounded-md border border-line bg-surface-1 px-3 py-2.5">
      <div className="text-[13px] font-medium text-ink-primary">{CORNER_LABELS[corner]}</div>
      <div className="mt-1 divide-y divide-line/60">
        {fields.map((f) => (
          <ValueInput key={f.id} field={f} corner={corner} setupId={setupId} path={path} />
        ))}
      </div>
    </div>
  );
}
