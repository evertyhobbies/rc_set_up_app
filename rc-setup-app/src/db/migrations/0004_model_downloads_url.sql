ALTER TABLE "car_models" ADD COLUMN IF NOT EXISTS "downloads_url" text;--> statement-breakpoint
UPDATE "car_models" SET "downloads_url" = 'https://teamxray.com/x4/2026/en/download/'
 WHERE "manufacturer" = 'Xray' AND "model_name" = 'X4' AND "year" = 2026 AND "downloads_url" IS NULL;
