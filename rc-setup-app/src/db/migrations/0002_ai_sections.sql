ALTER TABLE "sheet_widgets" ADD COLUMN IF NOT EXISTS "axle" text;--> statement-breakpoint
ALTER TABLE "sheet_widgets" ADD COLUMN IF NOT EXISTS "section_id" uuid;--> statement-breakpoint
ALTER TABLE "sheet_widgets" ADD COLUMN IF NOT EXISTS "label" text;--> statement-breakpoint
ALTER TABLE "sheet_widgets" ADD COLUMN IF NOT EXISTS "unit" text;--> statement-breakpoint
ALTER TABLE "sheet_widgets" ADD COLUMN IF NOT EXISTS "choice_label" text;--> statement-breakpoint
ALTER TABLE "sheet_widgets" ADD COLUMN IF NOT EXISTS "sort_order" integer;--> statement-breakpoint
ALTER TABLE "template_sections" ADD COLUMN IF NOT EXISTS "source" text;--> statement-breakpoint
ALTER TABLE "template_sections" ADD COLUMN IF NOT EXISTS "crop_page" integer;--> statement-breakpoint
ALTER TABLE "template_sections" ADD COLUMN IF NOT EXISTS "crop_x" real;--> statement-breakpoint
ALTER TABLE "template_sections" ADD COLUMN IF NOT EXISTS "crop_y" real;--> statement-breakpoint
ALTER TABLE "template_sections" ADD COLUMN IF NOT EXISTS "crop_w" real;--> statement-breakpoint
ALTER TABLE "template_sections" ADD COLUMN IF NOT EXISTS "crop_h" real;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sheet_widgets" ADD CONSTRAINT "sheet_widgets_section_id_template_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."template_sections"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
