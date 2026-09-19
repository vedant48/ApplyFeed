CREATE TABLE "email_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"email" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"encrypted_access_token" text NOT NULL,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"sync_cursor" text,
	"status" text DEFAULT 'IDLE' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"email_account_id" uuid NOT NULL,
	"provider_message_id" text NOT NULL,
	"provider_thread_id" text,
	"sender" text NOT NULL,
	"sender_email" text NOT NULL,
	"company" text,
	"subject" text NOT NULL,
	"snippet" text,
	"body_text" text,
	"received_at" timestamp with time zone NOT NULL,
	"category" text NOT NULL,
	"is_job_related" boolean DEFAULT true NOT NULL,
	"classification_confidence" real,
	"role" text,
	"platform" text DEFAULT 'Unknown',
	"requires_attention" boolean DEFAULT false NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_accounts_user_id_idx" ON "email_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_accounts_user_provider_email_idx" ON "email_accounts" USING btree ("user_id","provider","email");--> statement-breakpoint
CREATE UNIQUE INDEX "emails_account_message_idx" ON "emails" USING btree ("email_account_id","provider_message_id");--> statement-breakpoint
CREATE INDEX "emails_user_id_idx" ON "emails" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "emails_email_account_id_idx" ON "emails" USING btree ("email_account_id");--> statement-breakpoint
CREATE INDEX "emails_received_at_idx" ON "emails" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "emails_category_idx" ON "emails" USING btree ("category");--> statement-breakpoint
CREATE INDEX "emails_company_idx" ON "emails" USING btree ("company");--> statement-breakpoint
CREATE INDEX "emails_role_idx" ON "emails" USING btree ("role");--> statement-breakpoint
CREATE INDEX "emails_platform_idx" ON "emails" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "emails_is_job_related_idx" ON "emails" USING btree ("is_job_related");--> statement-breakpoint
CREATE INDEX "emails_requires_attention_idx" ON "emails" USING btree ("requires_attention");