import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

// Field data type — how the value is entered/rendered
export const fieldTypeEnum = pgEnum("field_type", [
  "number",
  "text",
  "select",
  "computed",
]);

// Which part of the car a field belongs to. Drives both layout (where it
// renders) and storage (whether a value needs a corner tag).
export const fieldScopeEnum = pgEnum("field_scope", [
  "car", // one value for the whole car, e.g. total race weight
  "axle_front", // one value, front axle only, e.g. steering lock
  "axle_rear", // one value, rear axle only, e.g. diff type
  "corner", // one value per corner (FL/FR/RL/RR), e.g. ride height
]);

export const fieldTierEnum = pgEnum("field_tier", ["main", "detail"]);

export const cornerEnum = pgEnum("corner", ["FL", "FR", "RL", "RR"]);

export const setupKindEnum = pgEnum("setup_kind", ["base", "race"]);

// A manufacturer + model + class, e.g. Xray / X4 '22 / Touring.
// `constants` holds model-level values a formula might reference —
// e.g. { "internal_ratio": 1.9 } for the X4 family's drivetrain calc.
export const carModels = pgTable("car_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  manufacturer: text("manufacturer").notNull(),
  name: text("name").notNull(), // "X4 '22"
  carClass: text("car_class").notNull(), // "Touring", "Nascar", "F1", "Buggy"
  constants: jsonb("constants").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A versioned field definition for a car model. Versioned so editing a
// template later doesn't rewrite the meaning of setups already logged
// against an earlier version.
export const setupTemplates = pgTable("setup_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  carModelId: uuid("car_model_id")
    .notNull()
    .references(() => carModels.id),
  version: integer("version").notNull().default(1),
  name: text("name").notNull(), // "Xray X4 '22 — standard"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Ordered groups within a template — Front, Rear, Transmission,
// Corner weight, Electronics, Tires, Misc, etc.
export const templateSections = pgTable("template_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => setupTemplates.id),
  key: text("key").notNull(), // "transmission", "corner_weight"
  label: text("label").notNull(), // "Transmission"
  sortOrder: integer("sort_order").notNull().default(0),
});

// A single field: what it's called, how it's entered, where it lives on
// the car, and whether it's a main-tier or detail-tier field.
// `formula` is only set when type = "computed" — a small expression
// referencing other field keys in this template (see lib/compute.ts).
export const templateFields = pgTable("template_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => templateSections.id),
  key: text("key").notNull(), // "ride_height", "final_drive_ratio"
  label: text("label").notNull(),
  unit: text("unit"), // "mm", "g", "cst", null for unitless/select
  type: fieldTypeEnum("type").notNull().default("number"),
  scope: fieldScopeEnum("scope").notNull().default("car"),
  tier: fieldTierEnum("tier").notNull().default("main"),
  options: jsonb("options"), // for type = "select", e.g. diff type choices
  formula: text("formula"), // for type = "computed"
  sortOrder: integer("sort_order").notNull().default(0),
});

// A physical car Tyler owns, tied to the template it's built to.
export const cars = pgTable("cars", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => setupTemplates.id),
  nickname: text("nickname").notNull(), // "Blue X4"
  // Which top-down icon to show on the setup page. One of:
  // "sports" | "porsche" | "f1" | "nascar" | "buggy" | "truck"
  bodyStyle: text("body_style").notNull().default("sports"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A full set of values for a car — either the standing "base" setup, or
// a "race" snapshot copied from base and tied to an event.
export const setups = pgTable("setups", {
  id: uuid("id").primaryKey().defaultRandom(),
  carId: uuid("car_id")
    .notNull()
    .references(() => cars.id),
  kind: setupKindEnum("kind").notNull().default("base"),
  name: text("name").notNull(), // "Base" or "HTO — Sept club race"
  track: text("track"),
  eventDate: timestamp("event_date"),
  qualPosition: text("qual_position"),
  finalPosition: text("final_position"),
  bestLapTime: text("best_lap_time"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// The actual entered values. `corner` is only set for scope = "corner"
// fields — one row per corner in that case, one row total otherwise.
export const setupValues = pgTable("setup_values", {
  id: uuid("id").primaryKey().defaultRandom(),
  setupId: uuid("setup_id")
    .notNull()
    .references(() => setups.id),
  fieldId: uuid("field_id")
    .notNull()
    .references(() => templateFields.id),
  corner: cornerEnum("corner"),
  value: text("value"), // stored as text, parsed per field.type on read
});
