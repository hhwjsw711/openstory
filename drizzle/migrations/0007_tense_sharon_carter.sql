CREATE TABLE "script_analysis_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"user_script" text NOT NULL,
	"system_prompt_version" varchar(16) NOT NULL,
	"user_prompt" text NOT NULL,
	"style_config" jsonb NOT NULL,
	"model" varchar(100) NOT NULL,
	"raw_output" text,
	"parsed_output" jsonb,
	"api_error" text,
	"parse_error" text,
	"token_usage" jsonb,
	"cost_credits" numeric(10, 6),
	"duration_ms" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "script_analysis_audit" ADD CONSTRAINT "script_analysis_audit_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_analysis_audit" ADD CONSTRAINT "script_analysis_audit_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_analysis_audit" ADD CONSTRAINT "script_analysis_audit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "script_analysis_audit_sequence_id_idx" ON "script_analysis_audit" USING btree ("sequence_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "script_analysis_audit_team_id_idx" ON "script_analysis_audit" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "script_analysis_audit_created_at_idx" ON "script_analysis_audit" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "script_analysis_audit_status_idx" ON "script_analysis_audit" USING btree ("status" text_ops);