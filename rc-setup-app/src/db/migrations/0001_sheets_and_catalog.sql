ALTER TYPE "public"."field_type" ADD VALUE IF NOT EXISTS 'checkbox';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "car_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "car_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "manufacturers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "manufacturers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	CONSTRAINT "scales_label_unique" UNIQUE("label")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sheet_pages" (
	"template_id" uuid NOT NULL,
	"page_index" integer NOT NULL,
	"width" real NOT NULL,
	"height" real NOT NULL,
	"mime" text,
	"image_b64" text,
	CONSTRAINT "sheet_pages_template_id_page_index_pk" PRIMARY KEY("template_id","page_index")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sheet_widgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"page_index" integer NOT NULL,
	"pdf_field" text NOT NULL,
	"kind" text NOT NULL,
	"export_value" text,
	"options" jsonb,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"w" real NOT NULL,
	"h" real NOT NULL,
	"font_size" real,
	"multiline" boolean DEFAULT false NOT NULL,
	"align" integer DEFAULT 0 NOT NULL,
	"field_id" uuid,
	"corner" "corner"
);
--> statement-breakpoint
ALTER TABLE "car_models" ADD COLUMN IF NOT EXISTS "model_name" text;--> statement-breakpoint
ALTER TABLE "car_models" ADD COLUMN IF NOT EXISTS "year" integer;--> statement-breakpoint
ALTER TABLE "car_models" ADD COLUMN IF NOT EXISTS "scale" text;--> statement-breakpoint
ALTER TABLE "cars" ADD COLUMN IF NOT EXISTS "body_style" text DEFAULT 'sports' NOT NULL;--> statement-breakpoint
ALTER TABLE "setup_templates" ADD COLUMN IF NOT EXISTS "sheet_name" text;--> statement-breakpoint
ALTER TABLE "setup_templates" ADD COLUMN IF NOT EXISTS "sheet_filename" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sheet_pages" ADD CONSTRAINT "sheet_pages_template_id_setup_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."setup_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sheet_widgets" ADD CONSTRAINT "sheet_widgets_template_id_setup_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."setup_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sheet_widgets" ADD CONSTRAINT "sheet_widgets_field_id_template_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."template_fields"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sheet_widgets_template_idx" ON "sheet_widgets" ("template_id");
--> statement-breakpoint
-- Backfill wizard columns on existing models, e.g. "X4 '22" -> model_name X4, year 2022
UPDATE "car_models"
   SET "model_name" = COALESCE("model_name", trim(regexp_replace("name", '\s*''\d{2}$', ''))),
       "year"       = COALESCE("year", 2000 + ((regexp_match("name", '''(\d{2})$'))[1])::int),
       "scale"      = COALESCE("scale", '1/10');
--> statement-breakpoint
INSERT INTO "car_types" ("name", "sort_order") VALUES
  ('Touring', 10), ('F1', 20), ('Pan Car', 30), ('Nascar', 40), ('Buggy 2WD', 50), ('Buggy 4WD', 60),
  ('Truggy', 70), ('Stadium Truck', 80), ('Short Course', 90), ('Drift', 100), ('Rally', 110), ('Crawler', 120), ('Mini', 130)
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "car_types" ("name") SELECT DISTINCT "car_class" FROM "car_models" ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "manufacturers" ("name") VALUES
  ('Xray'), ('Team Associated'), ('Yokomo'), ('Awesomatix'), ('Mugen Seiki'), ('Infinity'), ('Tamiya'),
  ('Team Losi Racing'), ('Kyosho'), ('Schumacher'), ('Serpent'), ('3Racing'), ('Mon-Tech'), ('ARRMA'),
  ('Traxxas'), ('Sweep'), ('Capricorn')
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "manufacturers" ("name") SELECT DISTINCT "manufacturer" FROM "car_models" ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
INSERT INTO "scales" ("label", "sort_order") VALUES
  ('1/5', 5), ('1/8', 10), ('1/10', 20), ('1/12', 30), ('1/18', 40), ('1/24', 50), ('1/28', 60)
ON CONFLICT ("label") DO NOTHING;
--> statement-breakpoint
-- X4 '26 alongside the existing X4 '22 (drivetrain constants copied from the '22)
INSERT INTO "car_models" ("manufacturer", "name", "car_class", "constants", "model_name", "year", "scale")
SELECT 'Xray', 'X4 ''26', 'Touring',
       COALESCE((SELECT "constants" FROM "car_models" WHERE "manufacturer" = 'Xray' AND "model_name" = 'X4' ORDER BY "year" DESC NULLS LAST LIMIT 1), '{}'::jsonb),
       'X4', 2026, '1/10'
WHERE NOT EXISTS (SELECT 1 FROM "car_models" WHERE "manufacturer" = 'Xray' AND "model_name" = 'X4' AND "year" = 2026);
