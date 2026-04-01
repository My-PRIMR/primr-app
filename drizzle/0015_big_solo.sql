CREATE TABLE "lesson_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"rating" smallint,
	"comment" text,
	"block_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_feedback_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
ALTER TABLE "lesson_feedback" ADD CONSTRAINT "lesson_feedback_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_feedback" ADD CONSTRAINT "lesson_feedback_attempt_id_lesson_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."lesson_attempts"("id") ON DELETE cascade ON UPDATE no action;