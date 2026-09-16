import { getSetupData } from "@/lib/getSetupData";
import { ChassisSummary } from "@/components/ChassisSummary";
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
  const cornerWeightGrams = section("corner_weight")?.fields.find((f) => f.type === "number");
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

      <ChassisSummary
        corners={corners}
        frontAxle={frontAxle}
        rearAxle={rearAxle}
        transmission={transmission}
        cornerWeightGrams={cornerWeightGrams}
        cornerWeightComputed={cornerWeightComputed}
        raceWeight={raceWeight}
        carId={carId}
        bodyStyle={car.bodyStyle}
        setupId={setupId}
        path={path}
      />
    </main>
  );
}
