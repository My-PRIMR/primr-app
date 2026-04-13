CREATE TABLE "embed_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid,
	"course_id" uuid,
	"event_type" text NOT NULL,
	"embed_origin" text NOT NULL,
	"anonymous_session_id" text NOT NULL,
	"user_id" uuid,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "embeddable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "embed_events" ADD CONSTRAINT "embed_events_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embed_events" ADD CONSTRAINT "embed_events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embed_events" ADD CONSTRAINT "embed_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;