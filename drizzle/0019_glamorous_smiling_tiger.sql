ALTER TABLE "courses" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;