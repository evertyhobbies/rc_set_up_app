import type { db as DbType } from "./index";
import { carModels, setupTemplates, templateSections, templateFields, cars, setups } from "./schema";

export async function seedX4(db: typeof DbType) {

  const [x4] = await db
    .insert(carModels)
    .values({
      manufacturer: "Xray",
      name: "X4 '22",
      carClass: "Touring",
      // Internal ratio is a property of the model, not something typed
      // per race — the transmission formula below reads it from here.
      constants: { internal_ratio: 1.9 },
    })
    .returning();

  const [template] = await db
    .insert(setupTemplates)
    .values({
      carModelId: x4.id,
      version: 1,
      name: "Xray X4 '22 — standard",
    })
    .returning();

  const [transmission, corners, frontAxle, rearAxle, cornerWeight, raceWeight] =
    await db
      .insert(templateSections)
      .values([
        { templateId: template.id, key: "transmission", label: "Transmission", sortOrder: 0 },
        { templateId: template.id, key: "corners", label: "Corners", sortOrder: 1 },
        { templateId: template.id, key: "front_axle", label: "Front", sortOrder: 2 },
        { templateId: template.id, key: "rear_axle", label: "Rear", sortOrder: 3 },
        { templateId: template.id, key: "corner_weight", label: "Corner weight", sortOrder: 4 },
        { templateId: template.id, key: "race_weight", label: "Race weight", sortOrder: 5 },
      ])
      .returning();

  await db.insert(templateFields).values([
    // Transmission — pinion/spur entered, final drive ratio computed from
    // the model's internal_ratio constant.
    { sectionId: transmission.id, key: "pinion", label: "Pinion", unit: "T", type: "number", scope: "car", tier: "main", sortOrder: 0 },
    { sectionId: transmission.id, key: "spur", label: "Spur", unit: "T", type: "number", scope: "car", tier: "main", sortOrder: 1 },
    {
      sectionId: transmission.id,
      key: "final_drive_ratio",
      label: "Final drive ratio",
      unit: null,
      type: "computed",
      scope: "car",
      tier: "main",
      formula: "(spur / pinion) * internal_ratio",
      sortOrder: 2,
    },

    // Corners — one value per FL/FR/RL/RR.
    { sectionId: corners.id, key: "ride_height", label: "Ride height", unit: "mm", type: "number", scope: "corner", tier: "main", sortOrder: 0 },
    { sectionId: corners.id, key: "camber", label: "Camber", unit: "deg", type: "number", scope: "corner", tier: "main", sortOrder: 1 },
    { sectionId: corners.id, key: "downstop", label: "Downstop", unit: "mm", type: "number", scope: "corner", tier: "main", sortOrder: 2 },

    // Front axle only.
    { sectionId: frontAxle.id, key: "toe_front", label: "Toe", unit: "deg", type: "number", scope: "axle_front", tier: "main", sortOrder: 0 },
    { sectionId: frontAxle.id, key: "steering_lock", label: "Steering lock", unit: "deg", type: "number", scope: "axle_front", tier: "main", sortOrder: 1 },

    // Rear axle only.
    { sectionId: rearAxle.id, key: "toe_rear", label: "Toe", unit: "deg", type: "number", scope: "axle_rear", tier: "main", sortOrder: 0 },
    {
      sectionId: rearAxle.id,
      key: "diff_type",
      label: "Diff type",
      unit: null,
      type: "select",
      scope: "axle_rear",
      tier: "main",
      options: ["Gear diff", "Ball diff", "Solid axle", "Spool"],
      sortOrder: 1,
    },
    { sectionId: rearAxle.id, key: "gear_diff_oil", label: "Gear diff oil", unit: "cst", type: "number", scope: "axle_rear", tier: "main", sortOrder: 2 },

    // Corner weight — grams entered per corner, percentages computed.
    { sectionId: cornerWeight.id, key: "corner_weight_g", label: "Corner weight", unit: "g", type: "number", scope: "corner", tier: "main", sortOrder: 0 },
    {
      sectionId: cornerWeight.id, key: "total_scale_weight_g", label: "Total (scale)", unit: "g", type: "computed", scope: "car", tier: "main",
      formula: "corner_weight_g.FL + corner_weight_g.FR + corner_weight_g.RL + corner_weight_g.RR",
      sortOrder: 1,
    },
    {
      sectionId: cornerWeight.id, key: "front_weight_pct", label: "Front", unit: "%", type: "computed", scope: "car", tier: "main",
      formula: "((corner_weight_g.FL + corner_weight_g.FR) / (corner_weight_g.FL + corner_weight_g.FR + corner_weight_g.RL + corner_weight_g.RR)) * 100",
      sortOrder: 2,
    },
    {
      sectionId: cornerWeight.id, key: "rear_weight_pct", label: "Rear", unit: "%", type: "computed", scope: "car", tier: "main",
      formula: "((corner_weight_g.RL + corner_weight_g.RR) / (corner_weight_g.FL + corner_weight_g.FR + corner_weight_g.RL + corner_weight_g.RR)) * 100",
      sortOrder: 3,
    },
    {
      sectionId: cornerWeight.id, key: "left_weight_pct", label: "Left", unit: "%", type: "computed", scope: "car", tier: "main",
      formula: "((corner_weight_g.FL + corner_weight_g.RL) / (corner_weight_g.FL + corner_weight_g.FR + corner_weight_g.RL + corner_weight_g.RR)) * 100",
      sortOrder: 4,
    },
    {
      sectionId: cornerWeight.id, key: "right_weight_pct", label: "Right", unit: "%", type: "computed", scope: "car", tier: "main",
      formula: "((corner_weight_g.FR + corner_weight_g.RR) / (corner_weight_g.FL + corner_weight_g.FR + corner_weight_g.RL + corner_weight_g.RR)) * 100",
      sortOrder: 5,
    },
    {
      sectionId: cornerWeight.id, key: "cross_weight_pct", label: "Cross (RF+LR)", unit: "%", type: "computed", scope: "car", tier: "main",
      formula: "((corner_weight_g.FR + corner_weight_g.RL) / (corner_weight_g.FL + corner_weight_g.FR + corner_weight_g.RL + corner_weight_g.RR)) * 100",
      sortOrder: 6,
    },

    // Race weight — full ready-to-race weight, entered manually since it
    // includes body/electronics the corner scale alone won't capture.
    { sectionId: raceWeight.id, key: "total_weight", label: "Total weight", unit: "g", type: "number", scope: "car", tier: "main", sortOrder: 0 },
  ]);

  // A demo car + empty base setup so the summary page has something to load.
  const [demoCar] = await db
    .insert(cars)
    .values({ templateId: template.id, nickname: "Demo X4" })
    .returning();

  const [baseSetup] = await db
    .insert(setups)
    .values({ carId: demoCar.id, kind: "base", name: "Base" })
    .returning();

  console.log(`Seeded template ${template.id} for ${x4.manufacturer} ${x4.name}`);
  console.log(`Visit: /cars/${demoCar.id}/setups/${baseSetup.id}`);

  return { templateId: template.id, demoCarId: demoCar.id, baseSetupId: baseSetup.id };
}
