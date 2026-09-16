CREATE TYPE "public"."corner" AS ENUM('FL', 'FR', 'RL', 'RR');--> statement-breakpoint
CREATE TYPE "public"."field_scope" AS ENUM('car', 'axle_front', 'axle_rear', 'corner');--> statement-breakpoint
CREATE TYPE "public"."field_tier" AS ENUM('main', 'detail');--> statement-breakpoint
CREATE TYPE "public"."field_type" AS ENUM('number', 'text', 'select', 'computed');--> statement-breakpoint
CREATE TYPE "public"."setup_kind" AS ENUM('base', 'race');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "car_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manufacturer" text NOT NULL,
	"name" text NOT NULL,
	"car_class" text NOT NULL,
	"constants" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"nickname" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "setup_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"car_model_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "setup_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setup_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"corner" "corner",
	"value" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "setups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"car_id" uuid NOT NULL,
	"kind" "setup_kind" DEFAULT 'base' NOT NULL,
	"name" text NOT NULL,
	"track" text,
	"event_date" timestamp,
	"qual_position" text,
	"final_position" text,
	"best_lap_time" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "template_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"unit" text,
	"type" "field_type" DEFAULT 'number' NOT NULL,
	"scope" "field_scope" DEFAULT 'car' NOT NULL,
	"tier" "field_tier" DEFAULT 'main' NOT NULL,
	"options" jsonb,
	"formula" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "template_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cars" ADD CONSTRAINT "cars_template_id_setup_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."setup_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "setup_templates" ADD CONSTRAINT "setup_templates_car_model_id_car_models_id_fk" FOREIGN KEY ("car_model_id") REFERENCES "public"."car_models"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "setup_values" ADD CONSTRAINT "setup_values_setup_id_setups_id_fk" FOREIGN KEY ("setup_id") REFERENCES "public"."setups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "setup_values" ADD CONSTRAINT "setup_values_field_id_template_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."template_fields"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "setups" ADD CONSTRAINT "setups_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "template_fields" ADD CONSTRAINT "template_fields_section_id_template_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."template_sections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "template_sections" ADD CONSTRAINT "template_sections_template_id_setup_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."setup_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
