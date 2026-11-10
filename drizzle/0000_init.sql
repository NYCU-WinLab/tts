CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"alg" text,
	"crv" text
);
--> statement-breakpoint
CREATE TABLE "oauth_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"client_id" text NOT NULL,
	"session_id" uuid,
	"user_id" uuid,
	"reference_id" text,
	"authorization_code_id" text,
	"resources" jsonb,
	"requested_user_info_claims" jsonb,
	"refresh_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"revoked" timestamp with time zone,
	"confirmation" jsonb,
	"scopes" jsonb NOT NULL,
	CONSTRAINT "oauth_access_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text,
	"client_discovery_id" text,
	"disabled" boolean,
	"skip_consent" boolean,
	"enable_end_session" boolean,
	"subject_type" text,
	"scopes" jsonb,
	"client_credentials_scopes" jsonb,
	"user_id" uuid,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"name" text,
	"uri" text,
	"icon" text,
	"contacts" jsonb,
	"tos" text,
	"policy" text,
	"software_id" text,
	"software_version" text,
	"software_statement" text,
	"redirect_uris" jsonb NOT NULL,
	"post_logout_redirect_uris" jsonb,
	"backchannel_logout_uri" text,
	"backchannel_logout_session_required" boolean,
	"token_endpoint_auth_method" text,
	"application_type" text,
	"jwks" text,
	"jwks_uri" text,
	"grant_types" jsonb,
	"response_types" jsonb,
	"require_pkce" boolean,
	"dpop_bound_access_tokens" boolean,
	"reference_id" text,
	"metadata" jsonb,
	CONSTRAINT "oauth_clients_clientId_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_client_assertions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_client_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "oauth_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"user_id" uuid,
	"reference_id" text,
	"resources" jsonb,
	"requested_user_info_claims" jsonb,
	"scopes" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"client_id" text NOT NULL,
	"session_id" uuid,
	"user_id" uuid NOT NULL,
	"reference_id" text,
	"authorization_code_id" text,
	"resources" jsonb,
	"requested_user_info_claims" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"revoked" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"rotation_replay_response" text,
	"rotation_replay_expires_at" timestamp with time zone,
	"auth_time" timestamp with time zone,
	"confirmation" jsonb,
	"scopes" jsonb NOT NULL,
	CONSTRAINT "oauth_refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "oauth_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"name" text NOT NULL,
	"access_token_ttl" integer,
	"refresh_token_ttl" integer,
	"signing_algorithm" text,
	"signing_key_id" text,
	"allowed_scopes" jsonb,
	"custom_claims" jsonb,
	"dpop_bound_access_tokens_required" boolean,
	"disabled" boolean,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"policy_version" integer,
	"metadata" jsonb,
	CONSTRAINT "oauth_resources_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"username" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"user_id" uuid NOT NULL,
	"params" jsonb NOT NULL,
	"chars" integer DEFAULT 0 NOT NULL,
	"via" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"result" "bytea",
	"result_mime" text,
	"seconds" real,
	"error" text,
	"link_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "voices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"builtin" boolean DEFAULT false NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"consent_id" text,
	"consent_note" text,
	"sample" "bytea" NOT NULL,
	"mime" text NOT NULL,
	"similarity" real,
	"embedding" real[],
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"recording" "bytea" NOT NULL,
	"mime" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"transcript" text,
	"score" real,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_refresh_id_oauth_refresh_tokens_id_fk" FOREIGN KEY ("refresh_id") REFERENCES "public"."oauth_refresh_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_client_resources" ADD CONSTRAINT "oauth_client_resources_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_client_resources" ADD CONSTRAINT "oauth_client_resources_resource_id_oauth_resources_identifier_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."oauth_resources"("identifier") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voices" ADD CONSTRAINT "voices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voices" ADD CONSTRAINT "voices_consent_id_voice_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."voice_consents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_consents" ADD CONSTRAINT "voice_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_index" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_access_tokens_authorization_code_id_index" ON "oauth_access_tokens" USING btree ("authorization_code_id");--> statement-breakpoint
CREATE INDEX "oauth_access_tokens_client_id_index" ON "oauth_access_tokens" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_access_tokens_refresh_id_index" ON "oauth_access_tokens" USING btree ("refresh_id");--> statement-breakpoint
CREATE INDEX "oauth_access_tokens_session_id_index" ON "oauth_access_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "oauth_access_tokens_user_id_index" ON "oauth_access_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_clients_user_id_index" ON "oauth_clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_client_resources_client_id_index" ON "oauth_client_resources" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_client_resources_client_id_resource_id_index" ON "oauth_client_resources" USING btree ("client_id","resource_id");--> statement-breakpoint
CREATE INDEX "oauth_client_resources_resource_id_index" ON "oauth_client_resources" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "oauth_consents_client_id_index" ON "oauth_consents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_consents_user_id_index" ON "oauth_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_authorization_code_id_index" ON "oauth_refresh_tokens" USING btree ("authorization_code_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_client_id_index" ON "oauth_refresh_tokens" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_session_id_index" ON "oauth_refresh_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_user_id_index" ON "oauth_refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_index" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "api_keys_user_id_index" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jobs_queue_idx" ON "jobs" USING btree ("created_at") WHERE "jobs"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "jobs_user_id_created_at_index" ON "jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "voices_user_id_index" ON "voices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "voice_consents_user_id_index" ON "voice_consents" USING btree ("user_id");