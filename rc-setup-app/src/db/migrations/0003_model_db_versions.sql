CREATE TABLE IF NOT EXISTS "model_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"car_model_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"filename" text NOT NULL,
	"pathname" text NOT NULL,
	"content_type" text,
	"size" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "summary_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"zone" text NOT NULL,
	"pdf_field" text NOT NULL,
	"label" text NOT NULL,
	"unit" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "setups" ALTER COLUMN "car_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "setups" ADD COLUMN IF NOT EXISTS "car_model_id" uuid;--> statement-breakpoint
ALTER TABLE "setups" ADD COLUMN IF NOT EXISTS "is_master" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "setups" ADD COLUMN IF NOT EXISTS "version_no" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_files" ADD CONSTRAINT "model_files_car_model_id_car_models_id_fk" FOREIGN KEY ("car_model_id") REFERENCES "public"."car_models"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "summary_slots" ADD CONSTRAINT "summary_slots_template_id_setup_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."setup_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "setups" ADD CONSTRAINT "setups_car_model_id_car_models_id_fk" FOREIGN KEY ("car_model_id") REFERENCES "public"."car_models"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "setups_one_master_per_model" ON "setups" ("car_model_id") WHERE "is_master";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "setups_version_per_model" ON "setups" ("car_model_id", "version_no") WHERE "version_no" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "model_files_model_idx" ON "model_files" ("car_model_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "summary_slots_template_idx" ON "summary_slots" ("template_id");
