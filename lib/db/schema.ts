import { pgTable, text, timestamp, boolean, uuid, real, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const emailAccounts = pgTable('email_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  provider: text('provider').notNull(), // 'gmail' | 'microsoft'
  email: text('email').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  encryptedAccessToken: text('encrypted_access_token').notNull(),
  encryptedRefreshToken: text('encrypted_refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  syncCursor: text('sync_cursor'),
  status: text('status').notNull().default('IDLE'), // 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR' | 'AUTH_EXPIRED'
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('email_accounts_user_id_idx').on(table.userId),
  uniqueIndex('email_accounts_user_provider_email_idx').on(table.userId, table.provider, table.email),
]);

export const emails = pgTable('emails', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  emailAccountId: uuid('email_account_id')
    .notNull()
    .references(() => emailAccounts.id, { onDelete: 'cascade' }),
  providerMessageId: text('provider_message_id').notNull(),
  providerThreadId: text('provider_thread_id'),
  sender: text('sender').notNull(),
  senderEmail: text('sender_email').notNull(),
  company: text('company'),
  subject: text('subject').notNull(),
  snippet: text('snippet'),
  bodyText: text('body_text'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  category: text('category').notNull(), // 'APPLICATION' | 'APPLICATION_RECEIVED' | 'RECRUITER' | 'ASSESSMENT' | 'INTERVIEW' | 'INTERVIEW_SCHEDULE' | 'REJECTION' | 'OFFER' | 'FOLLOW_UP' | 'OTHER_JOB' | 'NOT_JOB_RELATED'
  deterministicClassification: text('deterministic_classification').notNull().default('UNCLASSIFIED'), // 'UNCLASSIFIED' | 'JOB' | 'UNCERTAIN' | 'NOT_JOB'
  userOverride: text('user_override'), // null | 'JOB' | 'UNCERTAIN' | 'NOT_JOB'
  classification: text('classification').notNull().default('UNCLASSIFIED'), // Effective: userOverride || deterministicClassification
  source: text('source').default('UNKNOWN'), // 'ATS' | 'COMPANY_RECRUITING' | 'RECRUITER' | 'JOB_BOARD' | 'PERSONAL' | 'UNKNOWN'
  score: real('score').default(0),
  confidence: text('confidence').default('MEDIUM'), // 'HIGH' | 'MEDIUM' | 'LOW'
  evidence: text('evidence'), // JSON stringified array of evidence items
  metadata: text('metadata'), // JSON stringified additional metadata
  isJobRelated: boolean('is_job_related').notNull().default(true),
  classificationConfidence: real('classification_confidence'),
  role: text('role'),
  platform: text('platform').default('Unknown'),
  requiresAttention: boolean('requires_attention').notNull().default(false),
  isRead: boolean('is_read').notNull().default(false),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('emails_account_message_idx').on(table.emailAccountId, table.providerMessageId),
  index('emails_user_id_idx').on(table.userId),
  index('emails_email_account_id_idx').on(table.emailAccountId),
  index('emails_received_at_idx').on(table.receivedAt),
  index('emails_category_idx').on(table.category),
  index('emails_classification_idx').on(table.classification),
  index('emails_user_classification_idx').on(table.userId, table.classification),
  index('emails_company_idx').on(table.company),
  index('emails_role_idx').on(table.role),
  index('emails_platform_idx').on(table.platform),
  index('emails_is_job_related_idx').on(table.isJobRelated),
  index('emails_requires_attention_idx').on(table.requiresAttention),
]);

export const emailAccountsRelations = relations(emailAccounts, ({ many }) => ({
  emails: many(emails),
}));

export const emailsRelations = relations(emails, ({ one }) => ({
  account: one(emailAccounts, {
    fields: [emails.emailAccountId],
    references: [emailAccounts.id],
  }),
}));

export type EmailAccount = typeof emailAccounts.$inferSelect;
export type NewEmailAccount = typeof emailAccounts.$inferInsert;
export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;

export const appUsers = pgTable('app_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name'),
  googleId: text('google_id'),
  avatarUrl: text('avatar_url'),
  authProvider: text('auth_provider').default('google'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AppUser = typeof appUsers.$inferSelect;
export type NewAppUser = typeof appUsers.$inferInsert;

// =========================================================================
// ISOLATED DEMO / TEST TABLES
// Production data (real emails, real accounts) never touches these tables.
// Demo sessions strictly query demo_app_users, demo_email_accounts, and demo_emails.
// =========================================================================

export const demoAppUsers = pgTable('demo_app_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type DemoAppUser = typeof demoAppUsers.$inferSelect;
export type NewDemoAppUser = typeof demoAppUsers.$inferInsert;

export const demoEmailAccounts = pgTable('demo_email_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().default('usr_demo').references(() => demoAppUsers.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'gmail' | 'microsoft'
  email: text('email').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  status: text('status').notNull().default('SUCCESS'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const demoEmails = pgTable('demo_emails', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().default('usr_demo'),
  emailAccountId: uuid('email_account_id')
    .notNull()
    .references(() => demoEmailAccounts.id, { onDelete: 'cascade' }),
  providerMessageId: text('provider_message_id').notNull(),
  providerThreadId: text('provider_thread_id'),
  sender: text('sender').notNull(),
  senderEmail: text('sender_email').notNull(),
  company: text('company'),
  subject: text('subject').notNull(),
  snippet: text('snippet'),
  bodyText: text('body_text'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  category: text('category').notNull(),
  deterministicClassification: text('deterministic_classification').notNull().default('JOB'),
  userOverride: text('user_override'),
  classification: text('classification').notNull().default('JOB'),
  source: text('source').default('ATS'),
  score: real('score').default(0.95),
  confidence: text('confidence').default('HIGH'),
  evidence: text('evidence'),
  metadata: text('metadata'),
  isJobRelated: boolean('is_job_related').notNull().default(true),
  classificationConfidence: real('classification_confidence'),
  role: text('role'),
  platform: text('platform').default('Greenhouse'),
  requiresAttention: boolean('requires_attention').notNull().default(false),
  isRead: boolean('is_read').notNull().default(false),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('demo_emails_user_id_idx').on(table.userId),
  index('demo_emails_account_id_idx').on(table.emailAccountId),
  index('demo_emails_received_at_idx').on(table.receivedAt),
  index('demo_emails_category_idx').on(table.category),
  index('demo_emails_classification_idx').on(table.classification),
]);

export const demoEmailAccountsRelations = relations(demoEmailAccounts, ({ many }) => ({
  emails: many(demoEmails),
}));

export const demoEmailsRelations = relations(demoEmails, ({ one }) => ({
  account: one(demoEmailAccounts, {
    fields: [demoEmails.emailAccountId],
    references: [demoEmailAccounts.id],
  }),
}));

export type DemoEmailAccount = typeof demoEmailAccounts.$inferSelect;
export type NewDemoEmailAccount = typeof demoEmailAccounts.$inferInsert;
export type DemoEmail = typeof demoEmails.$inferSelect;
export type NewDemoEmail = typeof demoEmails.$inferInsert;


