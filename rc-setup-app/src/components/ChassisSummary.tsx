import { RenderField } from "@/lib/getSetupData";
import { ValueInput } from "./ValueInput";
import { Readout } from "./Readout";
import { CarIcon } from "./CarIcon";
import { BodyStyleSelect } from "./BodyStyleSelect";

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
  carId,
  bodyStyle,
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
  carId: string;
  bodyStyle: string;
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
        <div style={{ gridArea: "car" }} className="mx-auto flex w-full flex-col items-center gap-2 px-2 pt-2">
          <BodyStyleSelect carId={carId} value={bodyStyle} path={path} />
          <CarIcon style={bodyStyle} />
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
