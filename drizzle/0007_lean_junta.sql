CREATE TABLE "course_invite_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_invite_links_course_id_unique" UNIQUE("course_id"),
	CONSTRAINT "course_invite_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "course_invite_links" ADD CONSTRAINT "course_invite_links_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_invite_links" ADD CONSTRAINT "course_invite_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;