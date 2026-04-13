CREATE INDEX "embed_events_lesson_idx" ON "embed_events" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "embed_events_course_idx" ON "embed_events" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "embed_events_created_idx" ON "embed_events" USING btree ("created_at");