CREATE TYPE "public"."plan_subscription_period" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."plan_subscription_status" AS ENUM('active', 'past_due', 'canceled', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."plan_subscription_tier" AS ENUM('pro', 'teams');--> statement-breakpoint
CREATE TYPE "public"."team_invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TABLE "plan_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriber_user_id" uuid NOT NULL,
	"organization_id" uuid,
	"tier" "plan_subscription_tier" NOT NULL,
	"billing_period" "plan_subscription_period" NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"status" "plan_subscription_status" NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"status" "team_invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "seat_limit" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "plan_subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "plan_subscriptions" ADD CONSTRAINT "plan_subscriptions_subscriber_user_id_users_id_fk" FOREIGN KEY ("subscriber_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_subscriptions" ADD CONSTRAINT "plan_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_subscriptions_subscriber_idx" ON "plan_subscriptions" USING btree ("subscriber_user_id");--> statement-breakpoint
CREATE INDEX "plan_subscriptions_organization_idx" ON "plan_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_subscriptions_one_active_per_user_tier" ON "plan_subscriptions" USING btree ("subscriber_user_id","tier") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "team_invitations_one_pending_per_email_per_org" ON "team_invitations" USING btree ("organization_id","email") WHERE status = 'pending';--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;