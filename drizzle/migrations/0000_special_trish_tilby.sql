-- Enable pg_trgm extension for GIN trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."fal_request_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."letzai_request_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sequence_status" AS ENUM('draft', 'processing', 'completed', 'failed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."team_member_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('credit_purchase', 'credit_usage', 'credit_refund', 'credit_adjustment');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "anonymous_sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"team_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT (now() + '30 days'::interval)
);
--> statement-breakpoint
ALTER TABLE "anonymous_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audio" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"duration_ms" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "audio" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"lora_url" text,
	"config" jsonb DEFAULT '{}'::jsonb,
	"preview_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "characters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credits" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positive_balance" CHECK (balance >= (0)::numeric)
);
--> statement-breakpoint
ALTER TABLE "credits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fal_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"job_id" uuid,
	"team_id" uuid,
	"user_id" uuid,
	"model" varchar(255) NOT NULL,
	"request_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_data" jsonb,
	"cost_credits" numeric(10, 4) DEFAULT '0',
	"latency_ms" integer,
	"status" "fal_request_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fal_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "frames" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"description" text,
	"duration_ms" integer DEFAULT 3000,
	"thumbnail_url" text,
	"video_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "frames_sequence_id_order_index_key" UNIQUE("sequence_id","order_index")
);
--> statement-breakpoint
ALTER TABLE "frames" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "letzai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" text,
	"team_id" uuid,
	"user_id" uuid,
	"endpoint" text NOT NULL,
	"model" text,
	"request_payload" jsonb NOT NULL,
	"status" "letzai_request_status" DEFAULT 'pending' NOT NULL,
	"response_data" jsonb,
	"error" text,
	"cost_credits" numeric(10, 4),
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "letzai_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"team_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"script" text,
	"status" "sequence_status" DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"style_id" uuid
);
--> statement-breakpoint
ALTER TABLE "sequences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_key" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "style_adaptations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"style_id" uuid NOT NULL,
	"model_provider" varchar(100) NOT NULL,
	"model_name" varchar(100) NOT NULL,
	"adapted_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "style_adaptations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "styles" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"category" varchar(100),
	"tags" text[] DEFAULT '{""}',
	"is_public" boolean DEFAULT false,
	"is_template" boolean DEFAULT false,
	"version" integer DEFAULT 1,
	"parent_id" uuid,
	"preview_url" text,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "styles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"team_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "team_member_role" DEFAULT 'member' NOT NULL,
	"invited_by" uuid NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	CONSTRAINT "team_invitations_token_key" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "team_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_member_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_pkey" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_key" UNIQUE("slug"),
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_anonymous" boolean DEFAULT false,
	"full_name" text,
	"avatar_url" text,
	"onboarding_completed" boolean DEFAULT false,
	CONSTRAINT "user_email_key" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vfx" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"preset_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"preview_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "vfx" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audio" ADD CONSTRAINT "audio_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio" ADD CONSTRAINT "audio_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fal_requests" ADD CONSTRAINT "fal_requests_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fal_requests" ADD CONSTRAINT "fal_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frames" ADD CONSTRAINT "frames_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letzai_requests" ADD CONSTRAINT "letzai_requests_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letzai_requests" ADD CONSTRAINT "letzai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_adaptations" ADD CONSTRAINT "style_adaptations_style_id_fkey" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "styles" ADD CONSTRAINT "styles_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "styles" ADD CONSTRAINT "styles_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."styles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "styles" ADD CONSTRAINT "styles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vfx" ADD CONSTRAINT "vfx_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vfx" ADD CONSTRAINT "vfx_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_provider" ON "account" USING btree ("provider_id" text_ops,"account_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_account_user_id" ON "account" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_anonymous_sessions_expires" ON "anonymous_sessions" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_anonymous_sessions_team_id" ON "anonymous_sessions" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_audio_name" ON "audio" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_audio_team_id" ON "audio" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_characters_name" ON "characters" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_characters_team_id" ON "characters" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_fal_requests_created_at" ON "fal_requests" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_fal_requests_job_id" ON "fal_requests" USING btree ("job_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_fal_requests_model" ON "fal_requests" USING btree ("model" text_ops);--> statement-breakpoint
CREATE INDEX "idx_fal_requests_status" ON "fal_requests" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_fal_requests_team_id" ON "fal_requests" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_fal_requests_user_id" ON "fal_requests" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_frames_order" ON "frames" USING btree ("sequence_id" uuid_ops,"order_index" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_frames_sequence_id" ON "frames" USING btree ("sequence_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_created_at" ON "letzai_requests" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_endpoint" ON "letzai_requests" USING btree ("endpoint" text_ops);--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_job_id" ON "letzai_requests" USING btree ("job_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_status" ON "letzai_requests" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_team_id" ON "letzai_requests" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_team_status_created" ON "letzai_requests" USING btree ("team_id" uuid_ops,"status" enum_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_user_id" ON "letzai_requests" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sequences_created_at" ON "sequences" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_sequences_status" ON "sequences" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_sequences_style_id" ON "sequences" USING btree ("style_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sequences_team_id" ON "sequences" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_session_expires_at" ON "session" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_session_token" ON "session" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "idx_session_user_id" ON "session" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_style_adaptations_provider_model" ON "style_adaptations" USING btree ("model_provider" text_ops,"model_name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_style_adaptations_style_id" ON "style_adaptations" USING btree ("style_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_styles_category" ON "styles" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "idx_styles_created_at" ON "styles" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_styles_is_public" ON "styles" USING btree ("is_public" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_styles_is_template" ON "styles" USING btree ("is_template" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_styles_name_gin" ON "styles" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_styles_parent_id" ON "styles" USING btree ("parent_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_styles_tags_gin" ON "styles" USING gin ("tags" array_ops);--> statement-breakpoint
CREATE INDEX "idx_styles_team_id" ON "styles" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_styles_usage_count" ON "styles" USING btree ("usage_count" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_team_invitations_email" ON "team_invitations" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_team_invitations_expires_at" ON "team_invitations" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_team_invitations_status" ON "team_invitations" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_team_invitations_team_id" ON "team_invitations" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_team_invitations_token" ON "team_invitations" USING btree ("token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_team_invitations_unique_pending" ON "team_invitations" USING btree ("team_id" uuid_ops,"email" text_ops) WHERE (status = 'pending'::invitation_status);--> statement-breakpoint
CREATE INDEX "idx_team_members_team_id" ON "team_members" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_team_members_user_id" ON "team_members" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_teams_slug" ON "teams" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "idx_transactions_created_at" ON "transactions" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_transactions_type" ON "transactions" USING btree ("type" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_transactions_user_id" ON "transactions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_verification_expires_at" ON "verification" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_verification_identifier" ON "verification" USING btree ("identifier" text_ops);--> statement-breakpoint
CREATE INDEX "idx_vfx_name" ON "vfx" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_vfx_team_id" ON "vfx" USING btree ("team_id" uuid_ops);--> statement-breakpoint
CREATE POLICY "Service role full access" ON "account" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "anonymous_sessions" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "audio" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "characters" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "credits" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "fal_requests" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "frames" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "letzai_requests" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "sequences" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role full access" ON "session" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "style_adaptations" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "styles" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "team_invitations" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "team_members" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "teams" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "transactions" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role full access" ON "user" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role full access" ON "verification" AS PERMISSIVE FOR ALL TO public USING (true);--> statement-breakpoint
CREATE POLICY "Service role bypass" ON "vfx" AS PERMISSIVE FOR ALL TO public USING (true);