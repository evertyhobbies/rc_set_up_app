import { RenderField } from "@/lib/getSetupData";
import { ValueInput } from "./ValueInput";
import { Readout } from "./Readout";

function CarBody() {
  return (
    <svg viewBox="0 0 120 380" className="h-full w-full" aria-hidden="true">
      <path
        d="M40,10 Q60,-4 80,10 L92,45 Q100,70 98,110 L98,270 Q100,310 92,335 L80,370 Q60,384 40,370 L28,335 Q20,310 22,270 L22,110 Q20,70 28,45 Z"
        fill="var(--surface-2)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      <rect x="38" y="130" width="44" height="120" rx="12" fill="var(--surface-1)" opacity="0.7" />
    </svg>
  );
}

export function CornerWeightDiagram({
  gramsField,
  computed,
  setupId,
  path,
}: {
  gramsField: RenderField | undefined;
  computed: RenderField[];
  setupId: string;
  path: string;
}) {
  const byKey = (key: string) => computed.find((f) => f.key === key);
  const total = byKey("total_scale_weight_g");
  const frontPct = byKey("front_weight_pct");
  const rearPct = byKey("rear_weight_pct");
  const leftPct = byKey("left_weight_pct");
  const rightPct = byKey("right_weight_pct");
  const crossPct = byKey("cross_weight_pct");

  const g = (corner: "FL" | "FR" | "RL" | "RR") => {
    const v = gramsField?.values[corner];
    return v === null || v === undefined || v === "" ? null : Number(v);
  };
  const fl = g("FL");
  const fr = g("FR");
  const rl = g("RL");
  const rr = g("RR");
  const rfLr = fr !== null && rl !== null ? fr + rl : null;
  const lfRr = fl !== null && rr !== null ? fl + rr : null;
  const crossTotal = rfLr !== null && lfRr !== null ? rfLr + lfRr : null;

  return (
    <div className="rounded-md border border-line bg-surface-1 px-4 py-4">
      <div
        className="grid gap-y-4 gap-x-2"
        style={{
          gridTemplateColumns: "1fr 110px 1fr",
          gridTemplateAreas:
            '"front front front" "lf car rf" "lw car rw" "lr car rr" "rear rear rear" "total total total" "rfcross crosslabel lfcross"',
        }}
      >
        <div style={{ gridArea: "front" }}>
          {frontPct && <Readout field={frontPct} stacked label="Front weight" />}
        </div>

        <div style={{ gridArea: "lf" }} className="self-start justify-self-end">
          {gramsField && <ValueInput field={gramsField} corner="FL" setupId={setupId} path={path} stacked label="Left front" />}
        </div>
        <div style={{ gridArea: "car" }} className="mx-auto flex h-full items-center justify-center px-2">
          <CarBody />
        </div>
        <div style={{ gridArea: "rf" }} className="self-start justify-self-start">
          {gramsField && <ValueInput field={gramsField} corner="FR" setupId={setupId} path={path} stacked label="Right front" />}
        </div>

        <div style={{ gridArea: "lw" }} className="self-center justify-self-end">
          {leftPct && <Readout field={leftPct} stacked label="Left weight" />}
        </div>
        <div style={{ gridArea: "rw" }} className="self-center justify-self-start">
          {rightPct && <Readout field={rightPct} stacked label="Right weight" />}
        </div>

        <div style={{ gridArea: "lr" }} className="self-end justify-self-end">
          {gramsField && <ValueInput field={gramsField} corner="RL" setupId={setupId} path={path} stacked label="Left rear" />}
        </div>
        <div style={{ gridArea: "rr" }} className="self-end justify-self-start">
          {gramsField && <ValueInput field={gramsField} corner="RR" setupId={setupId} path={path} stacked label="Right rear" />}
        </div>

        <div style={{ gridArea: "rear" }}>
          {rearPct && <Readout field={rearPct} stacked label="Rear weight" />}
        </div>

        <div style={{ gridArea: "total" }}>
          {total && <Readout field={total} stacked label="Total weight" />}
        </div>

        <div style={{ gridArea: "rfcross" }} className="flex flex-col items-center gap-0.5">
          <span className="text-[13px] font-medium text-accent">RF + LR</span>
          <span className="flex items-baseline gap-1">
            <span className="font-mono text-2xl text-ink-primary">{rfLr !== null ? rfLr.toFixed(1) : "—"}</span>
            <span className="text-sm text-ink-muted">g</span>
          </span>
          {crossPct && (
            <span className="font-mono text-sm text-ink-secondary">{Number(crossPct.values.value).toFixed(0)}%</span>
          )}
        </div>
        <div style={{ gridArea: "crosslabel" }} className="flex items-center justify-center text-[13px] font-medium text-ink-secondary">
          Cross weight
        </div>
        <div style={{ gridArea: "lfcross" }} className="flex flex-col items-center gap-0.5">
          <span className="text-[13px] font-medium text-accent">LF + RR</span>
          <span className="flex items-baseline gap-1">
            <span className="font-mono text-2xl text-ink-primary">{lfRr !== null ? lfRr.toFixed(1) : "—"}</span>
            <span className="text-sm text-ink-muted">g</span>
          </span>
          {crossPct && crossTotal !== null && (
            <span className="font-mono text-sm text-ink-secondary">
              {(100 - Number(crossPct.values.value)).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
