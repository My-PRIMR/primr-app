ALTER TABLE "team_invitations" DROP CONSTRAINT "team_invitations_invited_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "team_invitations" ALTER COLUMN "invited_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_subscriptions_org_active_idx" ON "plan_subscriptions" USING btree ("organization_id") WHERE status = 'active';