import { getSetupData } from "@/lib/getSetupData";
import { CornerCard } from "@/components/CornerCard";
import { Readout } from "@/components/Readout";
import { ValueInput } from "@/components/ValueInput";
import { CornerWeightDiagram } from "@/components/CornerWeightDiagram";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";


export default async function SetupPage({
  params,
}: {
  params: Promise<{ carId: string; setupId: string }>;
}) {
  const { carId, setupId } = await params;
  const data = await getSetupData(setupId);
  if (!data) notFound();

  const { car, model, setup, sections } = data;
  const section = (key: string) => sections.find((s) => s.key === key);
  const path = `/cars/${carId}/setups/${setupId}`;

  const corners = section("corners")?.fields ?? [];
  const transmission = section("transmission")?.fields ?? [];
  const frontAxle = section("front_axle")?.fields ?? [];
  const rearAxle = section("rear_axle")?.fields ?? [];
  const cornerWeightGrams =
    section("corner_weight")?.fields.filter((f) => f.type === "number") ?? [];
  const cornerWeightComputed =
    section("corner_weight")?.fields.filter((f) => f.type === "computed") ?? [];
  const raceWeight = section("race_weight")?.fields ?? [];

  return (
    <main className="min-h-screen bg-surface-0 px-4 py-6">
      <div className="mb-5">
        <div className="text-xs text-ink-muted">
          {model.manufacturer} {model.name}
        </div>
        <h1 className="text-lg font-medium text-ink-primary">{car.nickname}</h1>
        <div className="mt-0.5 text-sm text-ink-secondary">
          {setup.name}
          {setup.track ? ` · ${setup.track}` : ""}
        </div>
      </div>

      {/* Car-plan layout: FL / front axle+transmission / FR, then RL / rear axle / RR */}
      <div className="grid grid-cols-3 gap-2">
        <CornerCard corner="FL" fields={corners} setupId={setupId} path={path} />
        <div className="rounded-md border border-line bg-surface-1 px-3 py-2.5">
          <div className="text-[13px] font-medium text-ink-primary">Front</div>
          <div className="mt-1 divide-y divide-line/60">
            {frontAxle.map((f) => (
              <ValueInput key={f.id} field={f} setupId={setupId} path={path} />
            ))}
            {transmission.map((f) =>
              f.type === "computed" ? (
                <Readout key={f.id} field={f} highlight />
              ) : (
                <ValueInput key={f.id} field={f} setupId={setupId} path={path} />
              )
            )}
          </div>
        </div>
        <CornerCard corner="FR" fields={corners} setupId={setupId} path={path} />

        <CornerCard corner="RL" fields={corners} setupId={setupId} path={path} />
        <div className="rounded-md border border-line bg-surface-1 px-3 py-2.5">
          <div className="text-[13px] font-medium text-ink-primary">Rear</div>
          <div className="mt-1 divide-y divide-line/60">
            {rearAxle.map((f) => (
              <ValueInput key={f.id} field={f} setupId={setupId} path={path} />
            ))}
          </div>
        </div>
        <CornerCard corner="RR" fields={corners} setupId={setupId} path={path} />
      </div>

      {/* Corner weight */}
      <div className="mt-2">
        <CornerWeightDiagram
          gramsField={cornerWeightGrams[0]}
          computed={cornerWeightComputed}
          setupId={setupId}
          path={path}
        />
      </div>

      {/* Race weight */}
      <div className="mt-2 rounded-md border border-line bg-surface-1 px-3 py-2.5">
        {raceWeight.map((f) => (
          <ValueInput key={f.id} field={f} setupId={setupId} path={path} />
        ))}
      </div>
    </main>
  );
}
