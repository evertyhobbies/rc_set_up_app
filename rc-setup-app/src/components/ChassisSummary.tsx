import { RenderField } from "@/lib/getSetupData";
import { ValueInput } from "./ValueInput";
import { Readout } from "./Readout";

function CarBody() {
  return (
    <svg viewBox="0 0 140 425" className="h-auto w-full" aria-hidden="true">
      {/* Front wing */}
      <rect x="18" y="0" width="104" height="11" rx="5" className="fill-surface-2 stroke-line" strokeWidth="1" />
      <line x1="52" y1="11" x2="52" y2="22" className="stroke-line" strokeWidth="1.5" />
      <line x1="88" y1="11" x2="88" y2="22" className="stroke-line" strokeWidth="1.5" />

      {/* Chassis tub */}
      <path
        d="M50,20 Q70,8 90,20 L102,42 Q110,58 108,82 L108,343 Q110,368 102,384 L90,406 Q70,418 50,406 L38,384 Q30,368 32,343 L32,82 Q30,58 38,42 Z"
        className="fill-surface-2 stroke-line"
        strokeWidth="1.5"
      />

      {/* Front shock tower */}
      <path d="M56,26 L84,26 L78,42 L62,42 Z" className="fill-surface-1 stroke-line" strokeWidth="1" opacity="0.9" />
      {/* Rear shock tower */}
      <path d="M58,388 L82,388 L76,402 L64,402 Z" className="fill-surface-1 stroke-line" strokeWidth="1" opacity="0.9" />

      {/* Battery / ESC / receiver stack down the centerline */}
      <rect x="50" y="120" width="40" height="58" rx="4" className="fill-accent/15 stroke-accent/40" strokeWidth="1" />
      <rect x="52" y="186" width="36" height="86" rx="4" className="fill-surface-1 stroke-line" strokeWidth="1" />
      <rect x="54" y="280" width="32" height="34" rx="4" className="fill-surface-1 stroke-line" strokeWidth="1" opacity="0.9" />

      {/* Front wheels */}
      <rect x="0" y="48" width="26" height="68" rx="9" className="fill-ink-muted" opacity="0.55" />
      <rect x="114" y="48" width="26" height="68" rx="9" className="fill-ink-muted" opacity="0.55" />
      {/* Rear wheels */}
      <rect x="0" y="308" width="26" height="68" rx="9" className="fill-ink-muted" opacity="0.55" />
      <rect x="114" y="308" width="26" height="68" rx="9" className="fill-ink-muted" opacity="0.55" />

      {/* Drive shafts */}
      <line x1="26" y1="82" x2="38" y2="82" className="stroke-line" strokeWidth="2" />
      <line x1="102" y1="82" x2="114" y2="82" className="stroke-line" strokeWidth="2" />
      <line x1="26" y1="342" x2="38" y2="342" className="stroke-line" strokeWidth="2" />
      <line x1="102" y1="342" x2="114" y2="342" className="stroke-line" strokeWidth="2" />
    </svg>
  );
}

function CornerStack({
  corner,
  cornerFields,
  gramsField,
  setupId,
  path,
}: {
  corner: "FL" | "FR" | "RL" | "RR";
  cornerFields: RenderField[];
  gramsField: RenderField | undefined;
  setupId: string;
  path: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-line px-3 py-2.5">
      {cornerFields.map((f) => (
        <ValueInput key={f.id} field={f} corner={corner} setupId={setupId} path={path} stacked size="sm" />
      ))}
      {gramsField && (
        <ValueInput field={gramsField} corner={corner} setupId={setupId} path={path} stacked size="sm" label="Corner weight" />
      )}
    </div>
  );
}

function FieldCluster({
  fields,
  setupId,
  path,
}: {
  fields: RenderField[];
  setupId: string;
  path: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-center gap-x-8 gap-y-6 px-2">
      {fields.map((f) =>
        f.type === "computed" ? (
          <Readout key={f.id} field={f} stacked size="sm" highlight />
        ) : (
          <ValueInput key={f.id} field={f} setupId={setupId} path={path} stacked size="sm" />
        )
      )}
    </div>
  );
}

function CrossStat({ label, grams, pct }: { label: string; grams: number | null; pct: number | null }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[11px] font-medium text-accent">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="font-mono text-base text-ink-primary">{grams !== null ? grams.toFixed(1) : "—"}</span>
        <span className="text-xs text-ink-muted">g</span>
      </span>
      {pct !== null && <span className="font-mono text-xs text-ink-secondary">{pct.toFixed(0)}%</span>}
    </div>
  );
}

export function ChassisSummary({
  corners,
  frontAxle,
  rearAxle,
  transmission,
  cornerWeightGrams,
  cornerWeightComputed,
  raceWeight,
  setupId,
  path,
}: {
  corners: RenderField[];
  frontAxle: RenderField[];
  rearAxle: RenderField[];
  transmission: RenderField[];
  cornerWeightGrams: RenderField | undefined;
  cornerWeightComputed: RenderField[];
  raceWeight: RenderField[];
  setupId: string;
  path: string;
}) {
  const byKey = (key: string) => cornerWeightComputed.find((f) => f.key === key);
  const total = byKey("total_scale_weight_g");
  const frontPct = byKey("front_weight_pct");
  const rearPct = byKey("rear_weight_pct");
  const leftPct = byKey("left_weight_pct");
  const rightPct = byKey("right_weight_pct");
  const crossPct = byKey("cross_weight_pct");
  const crossPctValue =
    crossPct && crossPct.values.value !== null && crossPct.values.value !== undefined
      ? Number(crossPct.values.value)
      : null;

  const g = (corner: "FL" | "FR" | "RL" | "RR") => {
    const v = cornerWeightGrams?.values[corner];
    return v === null || v === undefined || v === "" ? null : Number(v);
  };
  const fl = g("FL");
  const fr = g("FR");
  const rl = g("RL");
  const rr = g("RR");
  const rfLr = fr !== null && rl !== null ? fr + rl : null;
  const lfRr = fl !== null && rr !== null ? fl + rr : null;

  const frontFields = [...frontAxle, ...transmission];
  const rearFields = [...rearAxle];

  return (
    <div className="rounded-md border border-line bg-surface-1 px-4 py-4">
      <div
        className="grid gap-y-3 gap-x-2"
        style={{
          gridTemplateColumns: "1fr 110px 1fr",
          gridTemplateAreas:
            '"frontpct frontpct frontpct" "front front front" "lf car rf" "lw car rw" "lr car rr" "rear rear rear" "rearpct rearpct rearpct" "total total total"',
        }}
      >
        <div style={{ gridArea: "frontpct" }}>
          {frontPct && <Readout field={frontPct} stacked label="Front weight" />}
        </div>

        <div style={{ gridArea: "front" }} className="py-1">
          <FieldCluster fields={frontFields} setupId={setupId} path={path} />
        </div>

        <div style={{ gridArea: "lf" }} className="self-start justify-self-end">
          <CornerStack corner="FL" cornerFields={corners} gramsField={cornerWeightGrams} setupId={setupId} path={path} />
        </div>
        <div style={{ gridArea: "car" }} className="mx-auto flex w-full items-start justify-center px-2 pt-2">
          <CarBody />
        </div>
        <div style={{ gridArea: "rf" }} className="self-start justify-self-start">
          <CornerStack corner="FR" cornerFields={corners} gramsField={cornerWeightGrams} setupId={setupId} path={path} />
        </div>

        <div style={{ gridArea: "lw" }} className="flex flex-col items-center justify-self-end gap-3">
          {leftPct && <Readout field={leftPct} stacked label="Left weight" />}
          <CrossStat label="RF + LR" grams={rfLr} pct={crossPctValue} />
        </div>
        <div style={{ gridArea: "rw" }} className="flex flex-col items-center justify-self-start gap-3">
          {rightPct && <Readout field={rightPct} stacked label="Right weight" />}
          <CrossStat label="LF + RR" grams={lfRr} pct={crossPctValue !== null ? 100 - crossPctValue : null} />
        </div>

        <div style={{ gridArea: "lr" }} className="self-end justify-self-end">
          <CornerStack corner="RL" cornerFields={corners} gramsField={cornerWeightGrams} setupId={setupId} path={path} />
        </div>
        <div style={{ gridArea: "rr" }} className="self-end justify-self-start">
          <CornerStack corner="RR" cornerFields={corners} gramsField={cornerWeightGrams} setupId={setupId} path={path} />
        </div>

        <div style={{ gridArea: "rear" }} className="py-1">
          <FieldCluster fields={rearFields} setupId={setupId} path={path} />
        </div>

        <div style={{ gridArea: "rearpct" }}>
          {rearPct && <Readout field={rearPct} stacked label="Rear weight" />}
        </div>

        <div style={{ gridArea: "total" }} className="flex items-start justify-center gap-10 border-t border-line/60 pt-4">
          {total && <Readout field={total} stacked label="Total weight (scale)" />}
          {raceWeight.map((f) => (
            <ValueInput key={f.id} field={f} setupId={setupId} path={path} stacked label="Total weight" />
          ))}
        </div>
      </div>
    </div>
  );
}
