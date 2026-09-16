import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cars, carModels, setupTemplates, setups } from "@/db/schema";

export const dynamic = "force-dynamic";


export default async function GaragePage() {
  const rows = await db
    .select({
      carId: cars.id,
      nickname: cars.nickname,
      manufacturer: carModels.manufacturer,
      model: carModels.name,
      carClass: carModels.carClass,
    })
    .from(cars)
    .innerJoin(setupTemplates, eq(cars.templateId, setupTemplates.id))
    .innerJoin(carModels, eq(setupTemplates.carModelId, carModels.id));

  const baseSetups = await db
    .select({ id: setups.id, carId: setups.carId })
    .from(setups)
    .where(eq(setups.kind, "base"));

  return (
    <main className="min-h-screen bg-surface-0 px-5 py-8">
      <h1 className="text-lg font-medium tracking-tight text-ink-primary">Garage</h1>
      <p className="mt-1 text-sm text-ink-secondary">Base setups for every car</p>

      <div className="mt-6 flex flex-col gap-2">
        {rows.map((car) => {
          const base = baseSetups.find((s) => s.carId === car.carId);
          return (
            <a
              key={car.carId}
              href={base ? `/cars/${car.carId}/setups/${base.id}` : "#"}
              className="flex items-center justify-between rounded-md border border-line bg-surface-1 px-4 py-3 transition-colors hover:border-accent/40"
            >
              <div>
                <div className="text-sm font-medium text-ink-primary">{car.nickname}</div>
                <div className="text-xs text-ink-secondary">
                  {car.manufacturer} {car.model} · {car.carClass}
                </div>
              </div>
              <span className="font-mono text-xs text-ink-muted">→</span>
            </a>
          );
        })}
        {rows.length === 0 && (
          <p className="text-sm text-ink-muted">No cars yet — add one to your garage.</p>
        )}
      </div>
    </main>
  );
}
