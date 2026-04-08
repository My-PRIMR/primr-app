CREATE TYPE "public"."onboarding_segment" AS ENUM('creator_free', 'creator_pro', 'creator_enterprise', 'teacher', 'lnd_manager', 'org_admin');--> statement-breakpoint
CREATE TABLE "onboarding_playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment" "onboarding_segment" NOT NULL,
	"lesson_id" uuid NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_playlists_segment_lesson" UNIQUE("segment","lesson_id"),
	CONSTRAINT "onboarding_playlists_segment_order" UNIQUE("segment","display_order")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_dismissed_at" timestamp;--> statement-breakpoint
ALTER TABLE "onboarding_playlists" ADD CONSTRAINT "onboarding_playlists_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;