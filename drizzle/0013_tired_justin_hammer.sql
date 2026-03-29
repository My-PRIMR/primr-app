ALTER TABLE "chapter_lessons" DROP CONSTRAINT "chapter_lessons_lesson_id_lessons_id_fk";
--> statement-breakpoint
ALTER TABLE "lesson_attempts" DROP CONSTRAINT "lesson_attempts_lesson_id_lessons_id_fk";
--> statement-breakpoint
ALTER TABLE "lesson_invitations" DROP CONSTRAINT "lesson_invitations_lesson_id_lessons_id_fk";
--> statement-breakpoint
ALTER TABLE "lesson_invite_links" DROP CONSTRAINT "lesson_invite_links_lesson_id_lessons_id_fk";
--> statement-breakpoint
ALTER TABLE "chapter_lessons" ADD CONSTRAINT "chapter_lessons_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_attempts" ADD CONSTRAINT "lesson_attempts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_invitations" ADD CONSTRAINT "lesson_invitations_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_invite_links" ADD CONSTRAINT "lesson_invite_links_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;