CREATE TYPE "public"."teacher_application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."plan" ADD VALUE 'teacher' BEFORE 'pro';--> statement-breakpoint
CREATE TABLE "teacher_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"school_name" text NOT NULL,
	"grade_level" text NOT NULL,
	"proof_document_url" text NOT NULL,
	"status" "teacher_application_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" uuid,
	"rejection_reason" text
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "teacher_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "school_name" text;--> statement-breakpoint
ALTER TABLE "teacher_applications" ADD CONSTRAINT "teacher_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_applications" ADD CONSTRAINT "teacher_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;