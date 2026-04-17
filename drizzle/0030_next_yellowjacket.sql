CREATE TABLE "prompt_overrides" (
	"stage" text PRIMARY KEY NOT NULL,
	"template" text NOT NULL,
	"exported_by" text,
	"exported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"variant_id" text,
	"notes" text
);
