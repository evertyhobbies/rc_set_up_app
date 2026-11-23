import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  pgEnum,
  real,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";

// Field data type — how the value is entered/rendered
export const fieldTypeEnum = pgEnum("field_type", [
  "number",
  "text",
  "select",
  "computed",
  "checkbox", // single on/off box from an imported PDF sheet
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
  // Split out for the Create New wizard (type → manufacturer → scale → model → year).
  modelName: text("model_name"), // "X4"
  year: integer("year"), // 2022
  scale: text("scale"), // "1/10"
  // Manufacturer's download page for this model/year (setup sheets, manuals, parts lists)
  downloadsUrl: text("downloads_url"),
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
  // Set once a manufacturer's editable PDF sheet has been imported.
  sheetName: text("sheet_name"),
  sheetFilename: text("sheet_filename"),
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
  // Set on sections the AI built from an imported sheet: "ai". The crop is the
  // part of the sheet page (0..1 fractions) shown as this section's drawing.
  source: text("source"),
  cropPage: integer("crop_page"),
  cropX: real("crop_x"),
  cropY: real("crop_y"),
  cropW: real("crop_w"),
  cropH: real("crop_h"),
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
  // Legacy per-car setups use car_id. Model/year setups (master + versions) use car_model_id.
  carId: uuid("car_id").references(() => cars.id),
  carModelId: uuid("car_model_id").references(() => carModels.id),
  isMaster: boolean("is_master").notNull().default(false),
  versionNo: integer("version_no"), // 1, 2, 3… for saved versions; null for the master
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

// ---------------------------------------------------------------------------
// Lookup lists for the Create New wizard. car_models keeps its text columns;
// these just supply the choices (and grow via "+ Add new").
export const carTypes = pgTable("car_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(), // matches car_models.car_class
  sortOrder: integer("sort_order").notNull().default(100),
});

export const manufacturers = pgTable("manufacturers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(), // matches car_models.manufacturer
});

export const scales = pgTable("scales", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull().unique(), // matches car_models.scale
  sortOrder: integer("sort_order").notNull().default(100),
});

// ---------------------------------------------------------------------------
// Imported PDF setup sheet. Each page is stored as a rendered image (the
// sheet artwork without form fields); each PDF form field becomes a widget
// positioned on that image. Widgets point at a template_field (+ corner), so
// the sheet view and the summary view read and write the same setup_values.
export const sheetPages = pgTable(
  "sheet_pages",
  {
    templateId: uuid("template_id")
      .notNull()
      .references(() => setupTemplates.id, { onDelete: "cascade" }),
    pageIndex: integer("page_index").notNull(),
    width: real("width").notNull(), // PDF points
    height: real("height").notNull(),
    mime: text("mime"),
    imageB64: text("image_b64"),
  },
  (t) => [primaryKey({ columns: [t.templateId, t.pageIndex] })]
);

export const sheetWidgets = pgTable("sheet_widgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => setupTemplates.id, { onDelete: "cascade" }),
  pageIndex: integer("page_index").notNull(),
  pdfField: text("pdf_field").notNull(), // the PDF's own field name
  kind: text("kind").notNull(), // text | checkbox | radio | choice
  exportValue: text("export_value"), // value a checkbox/radio sets when on
  options: jsonb("options"), // choice options
  // Position as a 0..1 fraction of the page, top-left origin
  x: real("x").notNull(),
  y: real("y").notNull(),
  w: real("w").notNull(),
  h: real("h").notNull(),
  fontSize: real("font_size"),
  multiline: boolean("multiline").notNull().default(false),
  align: integer("align").notNull().default(0),
  // Where this widget's value lives
  fieldId: uuid("field_id").references(() => templateFields.id, { onDelete: "set null" }),
  corner: cornerEnum("corner"),
  // For a corner-scoped field: one box on the sheet that covers a whole axle
  // ("front" → FL + FR, "rear" → RL + RR)
  axle: text("axle"),
  // Display info from the AI build: which section card it sits in, how it reads
  sectionId: uuid("section_id").references(() => templateSections.id, { onDelete: "set null" }),
  label: text("label"),
  unit: text("unit"),
  choiceLabel: text("choice_label"), // e.g. "4°" for one box of a caster picker
  sortOrder: integer("sort_order"),
});

// ---------------------------------------------------------------------------
// Reference files per model/year (manual, parts list, exploded view…), stored in Vercel Blob (private)
export const modelFiles = pgTable("model_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  carModelId: uuid("car_model_id")
    .notNull()
    .references(() => carModels.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // manual | parts_list | exploded_view | other
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  pathname: text("pathname").notNull(), // Blob pathname
  contentType: text("content_type"),
  size: integer("size"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Where sheet values appear on the Summary drawing
export const summarySlots = pgTable("summary_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => setupTemplates.id, { onDelete: "cascade" }),
  zone: text("zone").notNull(), // front | rear | FL | FR | RL | RR | center
  pdfField: text("pdf_field").notNull(), // the sheet box shown
  label: text("label").notNull(),
  unit: text("unit"),
  sortOrder: integer("sort_order").notNull().default(0),
});
