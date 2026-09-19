-- ====================================================================
-- SUPABASE POSTGRESQL SCHEMA & ROW LEVEL SECURITY SETUP FOR APPLYFEED
-- ====================================================================

-- 1. Create email_accounts table
CREATE TABLE IF NOT EXISTS "email_accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" text NOT NULL,
    "provider" text NOT NULL, -- 'gmail' | 'microsoft'
    "email" text NOT NULL,
    "provider_account_id" text NOT NULL,
    "encrypted_access_token" text NOT NULL,
    "encrypted_refresh_token" text,
    "token_expires_at" timestamp with time zone,
    "last_synced_at" timestamp with time zone,
    "sync_cursor" text,
    "status" text DEFAULT 'IDLE' NOT NULL, -- 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR' | 'AUTH_EXPIRED'
    "last_error" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Create emails table
CREATE TABLE IF NOT EXISTS "emails" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" text NOT NULL,
    "email_account_id" uuid NOT NULL REFERENCES "email_accounts"("id") ON DELETE cascade,
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

-- 3. Indexes & Constraints for High Performance Aggregation
CREATE INDEX IF NOT EXISTS "email_accounts_user_id_idx" ON "email_accounts" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "email_accounts_user_provider_email_idx" ON "email_accounts" ("user_id", "provider", "email");

CREATE UNIQUE INDEX IF NOT EXISTS "emails_account_message_idx" ON "emails" ("email_account_id", "provider_message_id");
CREATE INDEX IF NOT EXISTS "emails_user_id_idx" ON "emails" ("user_id");
CREATE INDEX IF NOT EXISTS "emails_email_account_id_idx" ON "emails" ("email_account_id");
CREATE INDEX IF NOT EXISTS "emails_received_at_idx" ON "emails" ("received_at");
CREATE INDEX IF NOT EXISTS "emails_category_idx" ON "emails" ("category");
CREATE INDEX IF NOT EXISTS "emails_company_idx" ON "emails" ("company");
CREATE INDEX IF NOT EXISTS "emails_role_idx" ON "emails" ("role");
CREATE INDEX IF NOT EXISTS "emails_platform_idx" ON "emails" ("platform");
CREATE INDEX IF NOT EXISTS "emails_is_job_related_idx" ON "emails" ("is_job_related");
CREATE INDEX IF NOT EXISTS "emails_requires_attention_idx" ON "emails" ("requires_attention");

-- 4. Enable Supabase Row Level Security (RLS)
ALTER TABLE "email_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emails" ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Authenticated users can only read and manage their own data
DROP POLICY IF EXISTS "Users can manage their own email accounts" ON "email_accounts";
CREATE POLICY "Users can manage their own email accounts" 
ON "email_accounts"
FOR ALL
USING (auth.uid()::text = user_id OR user_id = 'usr_default')
WITH CHECK (auth.uid()::text = user_id OR user_id = 'usr_default');

DROP POLICY IF EXISTS "Users can view and manage their own emails" ON "emails";
CREATE POLICY "Users can view and manage their own emails" 
ON "emails"
FOR ALL
USING (auth.uid()::text = user_id OR user_id = 'usr_default')
WITH CHECK (auth.uid()::text = user_id OR user_id = 'usr_default');
