CREATE TABLE "audio" (
	"id" uuid PRIMARY KEY NOT NULL,
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
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" uuid NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"isAnonymous" boolean DEFAULT false,
	"fullName" text,
	"avatarUrl" text,
	"onboardingCompleted" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY NOT NULL,
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
CREATE TABLE "credits" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positive_balance" CHECK ("credits"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "fal_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid,
	"team_id" uuid,
	"user_id" uuid,
	"model" varchar(255) NOT NULL,
	"request_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_data" jsonb,
	"cost_credits" numeric(10, 4) DEFAULT '0',
	"latency_ms" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "frames" (
	"id" uuid PRIMARY KEY NOT NULL,
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
CREATE TABLE "letzai_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" text,
	"team_id" uuid,
	"user_id" uuid,
	"endpoint" text NOT NULL,
	"model" text,
	"request_payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_data" jsonb,
	"error" text,
	"cost_credits" numeric(10, 4),
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"script" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"style_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "style_adaptations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"style_id" uuid NOT NULL,
	"model_provider" varchar(100) NOT NULL,
	"model_name" varchar(100) NOT NULL,
	"adapted_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "styles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"category" varchar(100),
	"tags" text[] DEFAULT '{}',
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
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	CONSTRAINT "team_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vfx" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"preset_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"preview_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "audio" ADD CONSTRAINT "audio_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio" ADD CONSTRAINT "audio_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fal_requests" ADD CONSTRAINT "fal_requests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fal_requests" ADD CONSTRAINT "fal_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frames" ADD CONSTRAINT "frames_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letzai_requests" ADD CONSTRAINT "letzai_requests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letzai_requests" ADD CONSTRAINT "letzai_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_style_id_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_adaptations" ADD CONSTRAINT "style_adaptations_style_id_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "styles" ADD CONSTRAINT "styles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "styles" ADD CONSTRAINT "styles_parent_id_styles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."styles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "styles" ADD CONSTRAINT "styles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vfx" ADD CONSTRAINT "vfx_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vfx" ADD CONSTRAINT "vfx_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audio_team_id" ON "audio" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_account_user_id" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_account_provider" ON "account" USING btree ("providerId","accountId");--> statement-breakpoint
CREATE INDEX "idx_session_user_id" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_session_token" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_session_expires_at" ON "session" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "idx_user_email" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_verification_identifier" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_verification_expires_at" ON "verification" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "idx_characters_team_id" ON "characters" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_fal_requests_job_id" ON "fal_requests" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_fal_requests_team_id" ON "fal_requests" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_fal_requests_user_id" ON "fal_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_fal_requests_model" ON "fal_requests" USING btree ("model");--> statement-breakpoint
CREATE INDEX "idx_fal_requests_status" ON "fal_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_fal_requests_created_at" ON "fal_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_frames_sequence_id" ON "frames" USING btree ("sequence_id");--> statement-breakpoint
CREATE INDEX "idx_frames_order" ON "frames" USING btree ("sequence_id","order_index");--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_team_id" ON "letzai_requests" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_user_id" ON "letzai_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_status" ON "letzai_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_job_id" ON "letzai_requests" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_created_at" ON "letzai_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_endpoint" ON "letzai_requests" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "idx_letzai_requests_team_status_created" ON "letzai_requests" USING btree ("team_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_sequences_team_id" ON "sequences" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_sequences_status" ON "sequences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sequences_created_at" ON "sequences" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sequences_style_id" ON "sequences" USING btree ("style_id");--> statement-breakpoint
CREATE INDEX "idx_style_adaptations_style_id" ON "style_adaptations" USING btree ("style_id");--> statement-breakpoint
CREATE INDEX "idx_style_adaptations_provider_model" ON "style_adaptations" USING btree ("model_provider","model_name");--> statement-breakpoint
CREATE INDEX "idx_styles_team_id" ON "styles" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_styles_is_public" ON "styles" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "idx_styles_is_template" ON "styles" USING btree ("is_template");--> statement-breakpoint
CREATE INDEX "idx_styles_category" ON "styles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_styles_usage_count" ON "styles" USING btree ("usage_count");--> statement-breakpoint
CREATE INDEX "idx_styles_created_at" ON "styles" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_styles_parent_id" ON "styles" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_team_invitations_team_id" ON "team_invitations" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_team_invitations_email" ON "team_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_team_invitations_token" ON "team_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_team_invitations_status" ON "team_invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_team_invitations_expires_at" ON "team_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_team_members_team_id" ON "team_members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_team_members_user_id" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_teams_slug" ON "teams" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_transactions_user_id" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_created_at" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_type" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_vfx_team_id" ON "vfx" USING btree ("team_id");