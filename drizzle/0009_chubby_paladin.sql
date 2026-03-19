CREATE TYPE "public"."internal_usage_cost_category" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."internal_usage_event_type" AS ENUM('standalone_lesson', 'course');--> statement-breakpoint
CREATE TABLE "internal_usage_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" "internal_usage_event_type" NOT NULL,
	"model_id" text NOT NULL,
	"cost_category" "internal_usage_cost_category" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "internal_usage_log" ADD CONSTRAINT "internal_usage_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;