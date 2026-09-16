import { RenderField } from "@/lib/getSetupData";
import { ValueInput } from "./ValueInput";
import { Readout } from "./Readout";

function CarBody() {
  return (
    <svg viewBox="0 0 120 620" className="h-full w-full" aria-hidden="true">
      <path
        d="M40,10 Q60,-4 80,10 L92,45 Q100,70 98,110 L98,510 Q100,550 92,575 L80,610 Q60,624 40,610 L28,575 Q20,550 22,510 L22,110 Q20,70 28,45 Z"
        className="fill-surface-2 stroke-line"
        strokeWidth="1.5"
      />
      <rect x="38" y="130" width="44" height="360" rx="12" className="fill-surface-1" opacity="0.7" />
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
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-line px-3 py-3">
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
    <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-3">
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
        className="grid gap-y-5 gap-x-2"
        style={{
          gridTemplateColumns: "1fr 110px 1fr",
          gridTemplateAreas:
            '"frontpct frontpct frontpct" "front front front" "lf car rf" "lw car rw" "lr car rr" "rear rear rear" "rearpct rearpct rearpct" "total total total" "rfcross crosslabel lfcross" "race race race"',
        }}
      >
        <div style={{ gridArea: "frontpct" }}>
          {frontPct && <Readout field={frontPct} stacked label="Front weight" />}
        </div>

        <div style={{ gridArea: "front" }}>
          <FieldCluster fields={frontFields} setupId={setupId} path={path} />
        </div>

        <div style={{ gridArea: "lf" }} className="self-start justify-self-end">
          <CornerStack corner="FL" cornerFields={corners} gramsField={cornerWeightGrams} setupId={setupId} path={path} />
        </div>
        <div style={{ gridArea: "car" }} className="mx-auto flex h-full items-center justify-center px-2">
          <CarBody />
        </div>
        <div style={{ gridArea: "rf" }} className="self-start justify-self-start">
          <CornerStack corner="FR" cornerFields={corners} gramsField={cornerWeightGrams} setupId={setupId} path={path} />
        </div>

        <div style={{ gridArea: "lw" }} className="self-center justify-self-end">
          {leftPct && <Readout field={leftPct} stacked label="Left weight" />}
        </div>
        <div style={{ gridArea: "rw" }} className="self-center justify-self-start">
          {rightPct && <Readout field={rightPct} stacked label="Right weight" />}
        </div>

        <div style={{ gridArea: "lr" }} className="self-end justify-self-end">
          <CornerStack corner="RL" cornerFields={corners} gramsField={cornerWeightGrams} setupId={setupId} path={path} />
        </div>
        <div style={{ gridArea: "rr" }} className="self-end justify-self-start">
          <CornerStack corner="RR" cornerFields={corners} gramsField={cornerWeightGrams} setupId={setupId} path={path} />
        </div>

        <div style={{ gridArea: "rear" }}>
          <FieldCluster fields={rearFields} setupId={setupId} path={path} />
        </div>

        <div style={{ gridArea: "rearpct" }}>
          {rearPct && <Readout field={rearPct} stacked label="Rear weight" />}
        </div>

        <div style={{ gridArea: "total" }}>
          {total && <Readout field={total} stacked label="Total weight (scale)" />}
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
          {crossPct && (
            <span className="font-mono text-sm text-ink-secondary">
              {(100 - Number(crossPct.values.value)).toFixed(0)}%
            </span>
          )}
        </div>

        <div style={{ gridArea: "race" }} className="border-t border-line/60 pt-4">
          <FieldCluster fields={raceWeight} setupId={setupId} path={path} />
        </div>
      </div>
    </div>
  );
}
