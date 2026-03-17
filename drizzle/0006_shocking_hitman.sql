CREATE TYPE "public"."lesson_generation_status" AS ENUM('pending', 'generating', 'done', 'failed');--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "source_video_url" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "generation_status" "lesson_generation_status";