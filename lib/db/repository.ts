import { db } from './index';
import {
  emailAccounts,
  emails,
  appUsers,
  demoAppUsers,
  demoEmailAccounts,
  demoEmails,
  EmailAccount,
  NewEmailAccount,
  Email,
  NewEmail,
  AppUser,
  NewAppUser,
  DemoAppUser,
  DemoEmailAccount,
  DemoEmail,
} from './schema';
import { eq, and, gte, lt, ilike, or, desc, sql, inArray } from 'drizzle-orm';
import { createAdminClient, Query, ID } from '@/lib/appwrite/server';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export interface GetEmailsParams {
  userId: string;
  isDemo?: boolean;
  search?: string;
  from?: string; // ISO date string (YYYY-MM-DD or full ISO)
  to?: string;   // ISO date string (YYYY-MM-DD or full ISO)
  accountId?: string;
  category?: string;
  classification?: string; // 'JOB' | 'UNCERTAIN' | 'NOT_JOB' | 'UNCLASSIFIED' | 'all'
  needsAttention?: boolean;
  page?: number;
  limit?: number;
}

export interface EmailWithAccount extends Email {
  accountEmail?: string;
  accountProvider?: string;
}

function getAppwrite() {
  try {
    if (process.env.NODE_ENV === 'test') return null;
    if (!APPWRITE_CONFIG.apiKey || !APPWRITE_CONFIG.projectId) return null;
    return createAdminClient();
  } catch {
    return null;
  }
}

export function docToEmailAccount(doc: any): EmailAccount {
  return {
    id: doc.$id || doc.id,
    userId: doc.userId,
    provider: doc.provider,
    email: doc.email,
    providerAccountId: doc.providerAccountId,
    encryptedAccessToken: doc.encryptedAccessToken,
    encryptedRefreshToken: doc.encryptedRefreshToken || null,
    tokenExpiresAt: doc.tokenExpiresAt ? new Date(doc.tokenExpiresAt) : null,
    lastSyncedAt: doc.lastSyncedAt ? new Date(doc.lastSyncedAt) : null,
    syncCursor: doc.syncCursor || null,
    status: doc.status || 'IDLE',
    lastError: doc.lastError || null,
    createdAt: new Date(doc.$createdAt || doc.createdAt || Date.now()),
    updatedAt: new Date(doc.$updatedAt || doc.updatedAt || Date.now()),
  };
}

export function docToEmail(doc: any): Email {
  return {
    id: doc.$id || doc.id,
    userId: doc.userId,
    emailAccountId: doc.emailAccountId,
    providerMessageId: doc.providerMessageId,
    providerThreadId: doc.providerThreadId || null,
    sender: doc.sender,
    senderEmail: doc.senderEmail,
    company: doc.company || null,
    subject: doc.subject,
    snippet: doc.snippet || null,
    bodyText: doc.bodyText || null,
    receivedAt: new Date(doc.receivedAt),
    category: doc.category,
    deterministicClassification: doc.deterministicClassification || 'UNCLASSIFIED',
    userOverride: doc.userOverride || null,
    classification: doc.classification || 'UNCLASSIFIED',
    source: doc.source || 'UNKNOWN',
    score: doc.score ?? 0,
    confidence: doc.confidence || 'MEDIUM',
    evidence: doc.evidence || null,
    metadata: doc.metadata || null,
    isJobRelated: doc.isJobRelated ?? true,
    classificationConfidence: doc.classificationConfidence ?? null,
    role: doc.role || null,
    platform: doc.platform || 'Unknown',
    requiresAttention: doc.requiresAttention ?? false,
    isRead: doc.isRead ?? false,
    processedAt: doc.processedAt ? new Date(doc.processedAt) : new Date(doc.$createdAt || Date.now()),
    createdAt: new Date(doc.$createdAt || doc.createdAt || Date.now()),
    updatedAt: new Date(doc.$updatedAt || doc.updatedAt || Date.now()),
  };
}

export function docToAppUser(doc: any): AppUser {
  return {
    id: doc.$id || doc.id,
    email: doc.email,
    passwordHash: doc.passwordHash || null,
    name: doc.name || null,
    googleId: doc.googleId || null,
    avatarUrl: doc.avatarUrl || null,
    authProvider: doc.authProvider || 'google',
    createdAt: new Date(doc.$createdAt || doc.createdAt || Date.now()),
    updatedAt: new Date(doc.$updatedAt || doc.updatedAt || Date.now()),
  };
}

// Memory store fallback for environments without live connection (e.g. testing / demo)
class MemoryDataStore {
  accounts: Map<string, EmailAccount> = new Map();
  emailsList: Map<string, Email> = new Map();
  users: Map<string, AppUser> = new Map();

  constructor() {
    this.seedDefaults();
  }

  seedDefaults() {
    const demoUserId = 'usr_default';
    const now = new Date();
    
    const personalAccount: EmailAccount = {
      id: 'acc_gmail_personal_1',
      userId: demoUserId,
      provider: 'gmail',
      email: 'personal@gmail.com',
      providerAccountId: 'google_10293847',
      encryptedAccessToken: 'enc:token:gmail1',
      encryptedRefreshToken: 'enc:ref:gmail1',
      tokenExpiresAt: new Date(now.getTime() + 3600000),
      lastSyncedAt: new Date(now.getTime() - 4 * 60 * 1000), // 4 mins ago
      syncCursor: 'hist_928371',
      status: 'SUCCESS',
      lastError: null,
      createdAt: new Date(now.getTime() - 86400000 * 14),
      updatedAt: new Date(now.getTime() - 4 * 60 * 1000),
    };

    const workAccount: EmailAccount = {
      id: 'acc_gmail_work_2',
      userId: demoUserId,
      provider: 'gmail',
      email: 'work@gmail.com',
      providerAccountId: 'google_58291034',
      encryptedAccessToken: 'enc:token:gmail2',
      encryptedRefreshToken: 'enc:ref:gmail2',
      tokenExpiresAt: new Date(now.getTime() + 3600000),
      lastSyncedAt: new Date(now.getTime() - 9 * 60 * 1000), // 9 mins ago
      syncCursor: 'hist_482910',
      status: 'SUCCESS',
      lastError: null,
      createdAt: new Date(now.getTime() - 86400000 * 10),
      updatedAt: new Date(now.getTime() - 9 * 60 * 1000),
    };

    const outlookAccount: EmailAccount = {
      id: 'acc_outlook_3',
      userId: demoUserId,
      provider: 'microsoft',
      email: 'user@outlook.com',
      providerAccountId: 'ms_99182341',
      encryptedAccessToken: 'enc:token:ms1',
      encryptedRefreshToken: 'enc:ref:ms1',
      tokenExpiresAt: new Date(now.getTime() + 3600000),
      lastSyncedAt: new Date(now.getTime() - 12 * 60 * 1000), // 12 mins ago
      syncCursor: 'delta_tok_8471',
      status: 'SUCCESS',
      lastError: null,
      createdAt: new Date(now.getTime() - 86400000 * 7),
      updatedAt: new Date(now.getTime() - 12 * 60 * 1000),
    };

    this.accounts.set(personalAccount.id, personalAccount);
    this.accounts.set(workAccount.id, workAccount);
    this.accounts.set(outlookAccount.id, outlookAccount);

    // Initial emails matching the prompt examples
    const seedDefaults = {
      deterministicClassification: 'JOB',
      userOverride: null,
      classification: 'JOB',
      source: 'ATS',
      score: 10,
      confidence: 'HIGH',
      evidence: null,
      metadata: null,
    };

    const seedEmails: Email[] = [
      {
        ...seedDefaults,
        id: 'em_101',
        userId: demoUserId,
        emailAccountId: personalAccount.id,
        providerMessageId: 'gmail_msg_101',
        providerThreadId: 'gmail_th_101',
        sender: 'Greenhouse Recruiting',
        senderEmail: 'no-reply@greenhouse.io',
        company: 'Acme',
        subject: 'Interview invitation — Senior Frontend Engineer',
        snippet: 'Hi John, thanks for applying to Acme! We were impressed with your background and would love to invite you to schedule your technical interview.',
        bodyText: `Hi John,

Thanks for applying to Acme! We were impressed with your background and would love to invite you to schedule your technical interview with our engineering team.

Please pick a time that works best for your schedule using the link below:
https://boards.greenhouse.io/acme/interviews/schedule/abc-123

We look forward to speaking with you!

Best,
The Acme Talent Team`,
        receivedAt: new Date(now.getTime() - 2 * 3600 * 1000), // Today
        category: 'INTERVIEW',
        isJobRelated: true,
        classificationConfidence: 0.98,
        role: 'Senior Frontend Engineer',
        platform: 'Greenhouse',
        requiresAttention: true,
        isRead: false,
        processedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        ...seedDefaults,
        id: 'em_102',
        userId: demoUserId,
        emailAccountId: personalAccount.id,
        providerMessageId: 'gmail_msg_102',
        providerThreadId: 'gmail_th_102',
        sender: 'Lever Applications',
        senderEmail: 'jobs@lever.co',
        company: 'Stripe',
        subject: 'Application received: Fullstack Developer',
        snippet: 'Thank you for your application to the Fullstack Developer role at Stripe. We have received your materials.',
        bodyText: `Hello John,

Thank you for your interest in joining Stripe! This email confirms that we have received your application for the Fullstack Developer role.

Our recruiting team is carefully reviewing your resume and experience. You can expect to hear back from us within 5 business days regarding next steps.

Kind regards,
Stripe Recruiting Team`,
        receivedAt: new Date(now.getTime() - 24 * 3600 * 1000), // Yesterday
        category: 'APPLICATION_RECEIVED',
        isJobRelated: true,
        classificationConfidence: 0.95,
        role: 'Fullstack Developer',
        platform: 'Lever',
        requiresAttention: false,
        isRead: true,
        processedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        ...seedDefaults,
        id: 'em_103',
        userId: demoUserId,
        emailAccountId: workAccount.id,
        providerMessageId: 'gmail_msg_103',
        providerThreadId: 'gmail_th_103',
        sender: 'Sarah Jenkins',
        senderEmail: 'sarah.j@techrecruits.com',
        company: 'Linear',
        subject: 'Linear engineering role - quick chat?',
        snippet: 'Saw your GitHub profile and wanted to reach out regarding a Staff Software Engineer opportunity at Linear.',
        bodyText: `Hi John,

I came across your open source contributions and recent work on high-performance web systems. The founders at Linear are currently scaling out the core product team and looking for a Staff Software Engineer to lead frontend architecture.

Would you be open to a casual 15-minute chat this Thursday or Friday to learn more about the roadmap?

Best regards,
Sarah Jenkins
Executive Talent Partner`,
        receivedAt: new Date(now.getTime() - 3 * 86400 * 1000), // 3 days ago
        category: 'RECRUITER',
        isJobRelated: true,
        classificationConfidence: 0.92,
        role: 'Staff Software Engineer',
        platform: 'Direct Outreach',
        requiresAttention: true,
        isRead: false,
        processedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        ...seedDefaults,
        id: 'em_104',
        userId: demoUserId,
        emailAccountId: personalAccount.id,
        providerMessageId: 'gmail_msg_104',
        providerThreadId: 'gmail_th_104',
        sender: 'HackerRank Assessments',
        senderEmail: 'support@hackerrank.com',
        company: 'Vercel',
        subject: 'Coding Assessment: Platform Engineer at Vercel',
        snippet: 'You have been invited to complete a technical assessment for the Platform Engineer position at Vercel.',
        bodyText: `Hello John,

As part of the evaluation process for the Platform Engineer position at Vercel, we invite you to complete an online coding challenge on HackerRank.

Details:
• Time limit: 75 minutes
• Valid until: End of this week
• Link: https://hackerrank.com/tests/vercel-pe-2025

Please ensure you have an uninterrupted environment before beginning. Good luck!`,
        receivedAt: new Date(now.getTime() - 4 * 86400 * 1000), // 4 days ago
        category: 'ASSESSMENT',
        isJobRelated: true,
        classificationConfidence: 0.99,
        role: 'Platform Engineer',
        platform: 'HackerRank',
        requiresAttention: true,
        isRead: false,
        processedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        ...seedDefaults,
        id: 'em_105',
        userId: demoUserId,
        emailAccountId: personalAccount.id,
        providerMessageId: 'gmail_msg_105',
        providerThreadId: 'gmail_th_105',
        sender: 'Datadog Careers',
        senderEmail: 'talent@datadog.com',
        company: 'Datadog',
        subject: 'Update regarding your application at Datadog',
        snippet: 'Thank you for taking the time to speak with us. Unfortunately, we have decided to move forward with other candidates at this time.',
        bodyText: `Dear John,

Thank you for investing your time and effort into interviewing with Datadog for the Systems Engineer position. We truly enjoyed speaking with you.

While our team was impressed with your technical capabilities, we have chosen to move forward with a candidate whose experience more closely aligns with the specific needs of this role right now.

We will keep your resume on file for future openings that match your skills.

Sincerely,
The Datadog Recruiting Team`,
        receivedAt: new Date(now.getTime() - 7 * 86400 * 1000), // 7 days ago
        category: 'REJECTION',
        isJobRelated: true,
        classificationConfidence: 0.96,
        role: 'Systems Engineer',
        platform: 'Workday',
        requiresAttention: false,
        isRead: true,
        processedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        ...seedDefaults,
        id: 'em_106',
        userId: demoUserId,
        emailAccountId: outlookAccount.id,
        providerMessageId: 'ms_msg_106',
        providerThreadId: 'ms_th_106',
        sender: 'Airbnb Talent',
        senderEmail: 'offers@airbnb.com',
        company: 'Airbnb',
        subject: 'Offer of Employment — Senior Full Stack Engineer',
        snippet: 'We are thrilled to extend an official offer of employment to join Airbnb as a Senior Full Stack Engineer!',
        bodyText: `Dear John,

On behalf of the entire team at Airbnb, we are absolutely thrilled to extend you this formal offer of employment for the Senior Full Stack Engineer position!

Attached to this message you will find the formal offer letter detailing compensation, equity grants, and comprehensive benefits.

Please review and sign through DocuSign by next Tuesday. Welcome to the team!

Warm regards,
Brian Chesky & The Airbnb People Team`,
        receivedAt: new Date(now.getTime() - 9 * 86400 * 1000), // 9 days ago
        category: 'OFFER',
        isJobRelated: true,
        classificationConfidence: 0.99,
        role: 'Senior Full Stack Engineer',
        platform: 'Direct Offer',
        requiresAttention: true,
        isRead: false,
        processedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        ...seedDefaults,
        id: 'em_107',
        userId: demoUserId,
        emailAccountId: workAccount.id,
        providerMessageId: 'gmail_msg_107',
        providerThreadId: 'gmail_th_107',
        sender: 'Elena Rostova',
        senderEmail: 'elena@scale.com',
        company: 'Scale AI',
        subject: 'Following up on our conversation last week',
        snippet: 'Just checking in to see if you had any questions regarding the ML Infrastructure Lead role we discussed.',
        bodyText: `Hi John,

I wanted to quickly follow up on our discussion last Thursday regarding the ML Infrastructure Lead role at Scale AI.

Our VP of Engineering was very impressed by your past architectural projects and wanted to see if you would like to meet with him for a 30-minute introductory call early next week.

Let me know your availability!

Best,
Elena`,
        receivedAt: new Date(now.getTime() - 11 * 86400 * 1000), // 11 days ago
        category: 'FOLLOW_UP',
        isJobRelated: true,
        classificationConfidence: 0.91,
        role: 'ML Infrastructure Lead',
        platform: 'Direct Outreach',
        requiresAttention: false,
        isRead: true,
        processedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        ...seedDefaults,
        id: 'em_108',
        userId: demoUserId,
        emailAccountId: personalAccount.id,
        providerMessageId: 'gmail_msg_108',
        providerThreadId: 'gmail_th_108',
        sender: 'AngelList Weekly',
        senderEmail: 'digest@wellfound.com',
        company: 'Wellfound',
        subject: 'Top seed-stage developer roles tailored for you',
        snippet: 'Discover 12 high-growth startups hiring Senior Engineers in your area this week.',
        bodyText: `Here are your weekly startup job matches on Wellfound:

1. Supabase - Core Database Engineer (Remote, $160k - $210k + equity)
2. Resend - Frontend Infrastructure Specialist (Remote, $150k - $190k)
3. Cursor / Anysphere - AI Systems Engineer (San Francisco, $180k - $250k)

Click any position to apply directly with your 1-click candidate profile.`,
        receivedAt: new Date(now.getTime() - 14 * 86400 * 1000), // 14 days ago
        category: 'OTHER_JOB',
        isJobRelated: true,
        classificationConfidence: 0.85,
        role: 'Various Engineering Roles',
        platform: 'Wellfound',
        requiresAttention: false,
        isRead: true,
        processedAt: now,
        createdAt: now,
        updatedAt: now,
      }
    ];

    for (const em of seedEmails) {
      this.emailsList.set(em.id, em);
    }
  }
}

export const memoryStore = new MemoryDataStore();

export function parseDateRangeBoundaries(fromStr?: string, toStr?: string): { fromDate?: Date; toDate?: Date } {
  let fromDate: Date | undefined;
  let toDate: Date | undefined;

  if (fromStr) {
    const parsed = new Date(fromStr);
    if (!isNaN(parsed.getTime())) {
      parsed.setUTCHours(0, 0, 0, 0);
      fromDate = parsed;
    }
  }

  if (toStr) {
    const parsed = new Date(toStr);
    if (!isNaN(parsed.getTime())) {
      parsed.setUTCHours(23, 59, 59, 999);
      toDate = parsed;
    }
  }

  return { fromDate, toDate };
}

export const repository = {
  // Accounts
  async getEmailAccounts(userId: string, isDemo?: boolean): Promise<EmailAccount[]> {
    if (isDemo || userId === 'usr_demo') {
      const appwrite = getAppwrite();
      if (appwrite) {
        try {
          const res = await appwrite.databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.emailAccounts,
            [Query.equal('userId', 'usr_demo'), Query.limit(100)]
          );
          if (res.documents.length > 0) {
            return res.documents.map(docToEmailAccount);
          }
        } catch (e) {
          console.warn('Appwrite demo accounts fetch error:', e);
        }
      }
      return Array.from(memoryStore.accounts.values());
    }

    const appwrite = getAppwrite();
    if (appwrite) {
      try {
        const res = await appwrite.databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.emailAccounts,
          [Query.equal('userId', userId), Query.limit(100)]
        );
        return res.documents.map(docToEmailAccount);
      } catch (e) {
        console.warn('Appwrite getEmailAccounts error:', e);
      }
    }

    if (db) {
      return await db.select().from(emailAccounts).where(eq(emailAccounts.userId, userId));
    }
    return Array.from(memoryStore.accounts.values()).filter(a => a.userId === userId);
  },

  async getEmailAccountById(id: string, userId: string, isDemo?: boolean): Promise<EmailAccount | null> {
    if (isDemo || userId === 'usr_demo') {
      const appwrite = getAppwrite();
      if (appwrite) {
        try {
          const doc = await appwrite.databases.getDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.emailAccounts,
            id
          );
          return docToEmailAccount(doc);
        } catch {}
      }
      const acc = memoryStore.accounts.get(id);
      return acc || null;
    }

    const appwrite = getAppwrite();
    if (appwrite) {
      try {
        const doc = await appwrite.databases.getDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.emailAccounts,
          id
        );
        if (doc.userId === userId) {
          return docToEmailAccount(doc);
        }
        return null;
      } catch (e) {}
    }

    if (db) {
      const res = await db.select().from(emailAccounts).where(and(eq(emailAccounts.id, id), eq(emailAccounts.userId, userId)));
      return res[0] || null;
    }
    const acc = memoryStore.accounts.get(id);
    if (acc && acc.userId === userId) return acc;
    return null;
  },

  async createEmailAccount(data: NewEmailAccount): Promise<EmailAccount> {
    const docId = data.id || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = {
      userId: data.userId,
      provider: data.provider,
      email: data.email,
      providerAccountId: data.providerAccountId,
      encryptedAccessToken: data.encryptedAccessToken,
      encryptedRefreshToken: data.encryptedRefreshToken || null,
      tokenExpiresAt: data.tokenExpiresAt ? data.tokenExpiresAt.toISOString() : null,
      lastSyncedAt: data.lastSyncedAt ? data.lastSyncedAt.toISOString() : null,
      syncCursor: data.syncCursor || null,
      status: data.status || 'IDLE',
      lastError: data.lastError || null,
    };

    const appwrite = getAppwrite();
    if (appwrite) {
      try {
        const created = await appwrite.databases.createDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.emailAccounts,
          docId,
          payload
        );
        const result = docToEmailAccount(created);
        memoryStore.accounts.set(result.id, result);
        return result;
      } catch (e) {
        console.warn('Appwrite createEmailAccount error:', e);
      }
    }

    if (db) {
      const res = await db.insert(emailAccounts).values(data).returning();
      return res[0];
    }

    const newAcc: EmailAccount = {
      ...data,
      id: docId,
      status: data.status || 'IDLE',
      lastError: data.lastError || null,
      syncCursor: data.syncCursor || null,
      encryptedRefreshToken: data.encryptedRefreshToken || null,
      tokenExpiresAt: data.tokenExpiresAt || null,
      lastSyncedAt: data.lastSyncedAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.accounts.set(docId, newAcc);
    return newAcc;
  },

  async updateEmailAccount(id: string, data: Partial<EmailAccount>): Promise<EmailAccount | null> {
    const appwrite = getAppwrite();
    if (appwrite) {
      try {
        const payload: Record<string, any> = {};
        if (data.encryptedAccessToken !== undefined) payload.encryptedAccessToken = data.encryptedAccessToken;
        if (data.encryptedRefreshToken !== undefined) payload.encryptedRefreshToken = data.encryptedRefreshToken;
        if (data.tokenExpiresAt !== undefined) payload.tokenExpiresAt = data.tokenExpiresAt ? data.tokenExpiresAt.toISOString() : null;
        if (data.lastSyncedAt !== undefined) payload.lastSyncedAt = data.lastSyncedAt ? data.lastSyncedAt.toISOString() : null;
        if (data.syncCursor !== undefined) payload.syncCursor = data.syncCursor;
        if (data.status !== undefined) payload.status = data.status;
        if (data.lastError !== undefined) payload.lastError = data.lastError;

        const updated = await appwrite.databases.updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.emailAccounts,
          id,
          payload
        );
        const result = docToEmailAccount(updated);
        memoryStore.accounts.set(id, result);
        return result;
      } catch (e) {
        console.warn('Appwrite updateEmailAccount error:', e);
      }
    }

    if (db) {
      const res = await db.update(emailAccounts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(emailAccounts.id, id))
        .returning();
      return res[0] || null;
    }
    const existing = memoryStore.accounts.get(id);
    if (!existing) return null;
    const updated: EmailAccount = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    memoryStore.accounts.set(id, updated);
    return updated;
  },

  async deleteEmailAccount(id: string, userId: string): Promise<boolean> {
    const appwrite = getAppwrite();
    if (appwrite) {
      try {
        const acc = await appwrite.databases.getDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.emailAccounts,
          id
        );
        if (acc.userId === userId) {
          await appwrite.databases.deleteDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.emailAccounts,
            id
          );
          try {
            const emailsRes = await appwrite.databases.listDocuments(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.emails,
              [Query.equal('emailAccountId', id), Query.limit(100)]
            );
            for (const em of emailsRes.documents) {
              await appwrite.databases.deleteDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.emails,
                em.$id
              );
            }
          } catch {}
          memoryStore.accounts.delete(id);
          return true;
        }
        return false;
      } catch (e) {
        console.warn('Appwrite deleteEmailAccount error:', e);
      }
    }

    if (db) {
      const res = await db.delete(emailAccounts)
        .where(and(eq(emailAccounts.id, id), eq(emailAccounts.userId, userId)))
        .returning();
      return res.length > 0;
    }
    const acc = memoryStore.accounts.get(id);
    if (acc && acc.userId === userId) {
      memoryStore.accounts.delete(id);
      return true;
    }
    return false;
  },

  // Emails
  async getEmails(params: GetEmailsParams): Promise<{ emails: EmailWithAccount[]; total: number }> {
    const { userId, isDemo, search, from, to, accountId, category, classification, needsAttention, page = 1, limit = 20 } = params;
    const { fromDate, toDate } = parseDateRangeBoundaries(from, to);

    // Completely isolated query for demo sandbox or test runner
    if (isDemo || userId === 'usr_demo' || process.env.NODE_ENV === 'test') {
      let all = Array.from(memoryStore.emailsList.values()).filter(e => {
        if (e.userId !== userId && userId !== 'usr_demo' && !isDemo) return false;

        const targetClass = classification || 'JOB';
        if (targetClass !== 'all' && (e.classification || 'JOB') !== targetClass) return false;

        if (accountId && accountId !== 'all' && e.emailAccountId !== accountId) return false;
        if (category && category !== 'all' && e.category.toLowerCase() !== category.toLowerCase()) return false;
        if (needsAttention && !e.requiresAttention) return false;

        if (fromDate && e.receivedAt < fromDate) return false;
        if (toDate && e.receivedAt > toDate) return false;

        if (search && search.trim()) {
          const s = search.toLowerCase().trim();
          const matches = 
            (e.company?.toLowerCase().includes(s) ?? false) ||
            (e.role?.toLowerCase().includes(s) ?? false) ||
            e.subject.toLowerCase().includes(s) ||
            e.sender.toLowerCase().includes(s) ||
            (e.platform?.toLowerCase().includes(s) ?? false);
          if (!matches) return false;
        }

        return true;
      });

      all.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

      const total = all.length;
      const offset = (page - 1) * limit;
      const paged = all.slice(offset, offset + limit);

      const mapped: EmailWithAccount[] = paged.map(em => {
        const acc = memoryStore.accounts.get(em.emailAccountId);
        return {
          ...em,
          accountEmail: acc?.email,
          accountProvider: acc?.provider,
        };
      });

      return { emails: mapped, total };
    }

    const appwrite = getAppwrite();
    if (appwrite) {
      try {
        const queries: string[] = [
          Query.equal('userId', userId),
        ];

        if (classification && classification !== 'all') {
          queries.push(Query.equal('classification', classification));
        } else if (!classification) {
          queries.push(Query.equal('classification', 'JOB'));
        }

        if (accountId && accountId !== 'all') {
          queries.push(Query.equal('emailAccountId', accountId));
        }

        if (category && category !== 'all') {
          queries.push(Query.equal('category', category));
        }

        if (needsAttention) {
          queries.push(Query.equal('requiresAttention', true));
        }

        if (fromDate) {
          queries.push(Query.greaterThanEqual('receivedAt', fromDate.toISOString()));
        }

        if (toDate) {
          queries.push(Query.lessThanEqual('receivedAt', toDate.toISOString()));
        }

        queries.push(Query.orderDesc('receivedAt'));
        queries.push(Query.limit(limit));
        queries.push(Query.offset((page - 1) * limit));

        const res = await appwrite.databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.emails,
          queries
        );

        const accountsRes = await appwrite.databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.emailAccounts,
          [Query.equal('userId', userId), Query.limit(100)]
        );
        const accMap = new Map(accountsRes.documents.map((a: any) => [a.$id, a]));

        let emailList: EmailWithAccount[] = res.documents.map((doc: any) => {
          const em = docToEmail(doc);
          const acc = accMap.get(em.emailAccountId);
          return {
            ...em,
            accountEmail: acc?.email,
            accountProvider: acc?.provider,
          };
        });

        if (search && search.trim()) {
          const term = search.trim().toLowerCase();
          emailList = emailList.filter(e =>
            (e.company && e.company.toLowerCase().includes(term)) ||
            (e.role && e.role.toLowerCase().includes(term)) ||
            (e.subject && e.subject.toLowerCase().includes(term)) ||
            (e.sender && e.sender.toLowerCase().includes(term)) ||
            (e.platform && e.platform.toLowerCase().includes(term))
          );
        }

        return {
          emails: emailList,
          total: res.total,
        };
      } catch (err) {
        console.warn('Appwrite getEmails error, falling back:', err);
      }
    }

    if (db) {
      const conditions = [
        eq(emails.userId, userId),
      ];

      if (classification && classification !== 'all') {
        conditions.push(eq(emails.classification, classification));
      } else if (!classification) {
        conditions.push(eq(emails.classification, 'JOB'));
      }

      if (accountId && accountId !== 'all') {
        conditions.push(eq(emails.emailAccountId, accountId));
      }

      if (category && category !== 'all') {
        conditions.push(eq(emails.category, category));
      }

      if (needsAttention) {
        conditions.push(eq(emails.requiresAttention, true));
      }

      if (fromDate) {
        conditions.push(gte(emails.receivedAt, fromDate));
      }

      if (toDate) {
        conditions.push(lt(emails.receivedAt, toDate));
      }

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        conditions.push(
          or(
            ilike(emails.company, term),
            ilike(emails.role, term),
            ilike(emails.subject, term),
            ilike(emails.sender, term),
            ilike(emails.platform, term)
          )!
        );
      }

      const whereClause = and(...conditions);

      const [totalCountResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(emails)
        .where(whereClause);

      const offset = (page - 1) * limit;

      const rawEmails = await db
        .select({
          email: emails,
          accountEmail: emailAccounts.email,
          accountProvider: emailAccounts.provider,
        })
        .from(emails)
        .leftJoin(emailAccounts, eq(emails.emailAccountId, emailAccounts.id))
        .where(whereClause)
        .orderBy(desc(emails.receivedAt))
        .limit(limit)
        .offset(offset);

      const resultEmails: EmailWithAccount[] = rawEmails.map(r => ({
        ...r.email,
        accountEmail: r.accountEmail || undefined,
        accountProvider: r.accountProvider || undefined,
      }));

      return {
        emails: resultEmails,
        total: Number(totalCountResult?.count || 0),
      };
    }

    // Default Memory Store fallback
    let all = Array.from(memoryStore.emailsList.values()).filter(e => {
      if (e.userId !== userId) return false;

      const targetClass = classification || 'JOB';
      if (targetClass !== 'all' && (e.classification || 'JOB') !== targetClass) return false;

      if (accountId && accountId !== 'all' && e.emailAccountId !== accountId) return false;
      if (category && category !== 'all' && e.category.toLowerCase() !== category.toLowerCase()) return false;
      if (needsAttention && !e.requiresAttention) return false;

      if (fromDate && e.receivedAt < fromDate) return false;
      if (toDate && e.receivedAt > toDate) return false;

      if (search && search.trim()) {
        const s = search.toLowerCase().trim();
        const matches = 
          (e.company?.toLowerCase().includes(s) ?? false) ||
          (e.role?.toLowerCase().includes(s) ?? false) ||
          e.subject.toLowerCase().includes(s) ||
          e.sender.toLowerCase().includes(s) ||
          (e.platform?.toLowerCase().includes(s) ?? false);
        if (!matches) return false;
      }

      return true;
    });

    all.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

    const total = all.length;
    const offset = (page - 1) * limit;
    const paged = all.slice(offset, offset + limit);

    const mapped: EmailWithAccount[] = paged.map(em => {
      const acc = memoryStore.accounts.get(em.emailAccountId);
      return {
        ...em,
        accountEmail: acc?.email,
        accountProvider: acc?.provider,
      };
    });

    return { emails: mapped, total };
  },

  async getEmailById(id: string, userId: string, isDemo?: boolean): Promise<EmailWithAccount | null> {
    if (isDemo || userId === 'usr_demo') {
      const appwrite = getAppwrite();
      if (appwrite) {
        try {
          const doc = await appwrite.databases.getDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.emails,
            id
          );
          const em = docToEmail(doc);
          let accountEmail: string | undefined;
          let accountProvider: string | undefined;
          try {
            const acc = await appwrite.databases.getDocument(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.emailAccounts,
              em.emailAccountId
            );
            accountEmail = acc.email;
            accountProvider = acc.provider;
          } catch {}
          return { ...em, accountEmail, accountProvider };
        } catch {}
      }
      const em = memoryStore.emailsList.get(id);
      if (!em) return null;
      const acc = memoryStore.accounts.get(em.emailAccountId);
      return {
        ...em,
        accountEmail: acc?.email,
        accountProvider: acc?.provider,
      };
    }

    const appwrite = getAppwrite();
    if (appwrite) {
      try {
        const doc = await appwrite.databases.getDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.emails,
          id
        );
        if (doc.userId === userId) {
          const em = docToEmail(doc);
          let accountEmail: string | undefined;
          let accountProvider: string | undefined;
          try {
            const acc = await appwrite.databases.getDocument(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.emailAccounts,
              em.emailAccountId
            );
            accountEmail = acc.email;
            accountProvider = acc.provider;
          } catch {}
          return { ...em, accountEmail, accountProvider };
        }
        return null;
      } catch (e) {}
    }

    if (db) {
      const res = await db
        .select({
          email: emails,
          accountEmail: emailAccounts.email,
          accountProvider: emailAccounts.provider,
        })
        .from(emails)
        .leftJoin(emailAccounts, eq(emails.emailAccountId, emailAccounts.id))
        .where(and(eq(emails.id, id), eq(emails.userId, userId)));

      if (!res[0]) return null;
      return {
        ...res[0].email,
        accountEmail: res[0].accountEmail || undefined,
        accountProvider: res[0].accountProvider || undefined,
      };
    }

    const em = memoryStore.emailsList.get(id);
    if (!em || (userId !== 'usr_demo' && !isDemo && em.userId !== userId)) return null;
    const acc = memoryStore.accounts.get(em.emailAccountId);
    return {
      ...em,
      accountEmail: acc?.email,
      accountProvider: acc?.provider,
    };
  },

  async updateEmail(id: string, userId: string, data: Partial<Email>, isDemo?: boolean): Promise<Email | null> {
    const appwrite = getAppwrite();
    if (appwrite && !isDemo && userId !== 'usr_demo') {
      try {
        const payload: Record<string, any> = {};
        if (data.isRead !== undefined) payload.isRead = data.isRead;
        if (data.requiresAttention !== undefined) payload.requiresAttention = data.requiresAttention;
        if (data.classification !== undefined) payload.classification = data.classification;
        if (data.userOverride !== undefined) payload.userOverride = data.userOverride;
        if (data.category !== undefined) payload.category = data.category;
        if (data.company !== undefined) payload.company = data.company;
        if (data.role !== undefined) payload.role = data.role;

        const updated = await appwrite.databases.updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.emails,
          id,
          payload
        );
        const result = docToEmail(updated);
        memoryStore.emailsList.set(id, result);
        return result;
      } catch (e) {
        console.warn('Appwrite updateEmail error:', e);
      }
    }

    if (db) {
      const res = await db.update(emails)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(emails.id, id), eq(emails.userId, userId)))
        .returning();
      return res[0] || null;
    }

    const em = memoryStore.emailsList.get(id);
    if (!em || (userId !== 'usr_demo' && !isDemo && em.userId !== userId)) return null;
    const updated: Email = {
      ...em,
      ...data,
      updatedAt: new Date(),
    };
    memoryStore.emailsList.set(id, updated);
    return updated;
  },

  async overrideEmailClassification(
    emailId: string,
    userId: string,
    override: 'JOB' | 'UNCERTAIN' | 'NOT_JOB',
    isDemo?: boolean
  ): Promise<Email | null> {
    const appwrite = getAppwrite();
    if (appwrite && !isDemo && userId !== 'usr_demo') {
      try {
        const updated = await appwrite.databases.updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.emails,
          emailId,
          {
            userOverride: override,
            classification: override,
            isJobRelated: override === 'JOB' || override === 'UNCERTAIN',
          }
        );
        const result = docToEmail(updated);
        memoryStore.emailsList.set(emailId, result);
        return result;
      } catch (e) {
        console.warn('Appwrite overrideEmailClassification error:', e);
      }
    }

    if (db) {
      const res = await db.update(emails)
        .set({
          userOverride: override,
          classification: override,
          isJobRelated: override === 'JOB' || override === 'UNCERTAIN',
          updatedAt: new Date(),
        })
        .where(and(eq(emails.id, emailId), eq(emails.userId, userId)))
        .returning();
      return res[0] || null;
    }

    const em = memoryStore.emailsList.get(emailId);
    if (!em || em.userId !== userId) return null;
    const updated: Email = {
      ...em,
      userOverride: override,
      classification: override,
      isJobRelated: override === 'JOB' || override === 'UNCERTAIN',
      updatedAt: new Date(),
    };
    memoryStore.emailsList.set(emailId, updated);
    return updated;
  },

  async saveBatchEmails(items: NewEmail[]): Promise<{ inserted: number; updated: number; skipped: number }> {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    if (!items || items.length === 0) {
      return { inserted: 0, updated: 0, skipped: 0 };
    }

    const appwrite = getAppwrite();
    if (appwrite) {
      for (const item of items) {
        try {
          const existing = await appwrite.databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.emails,
            [
              Query.equal('emailAccountId', item.emailAccountId),
              Query.equal('providerMessageId', item.providerMessageId),
              Query.limit(1),
            ]
          );

          const defaultClass = item.classification || item.deterministicClassification || (item.isJobRelated ? 'JOB' : 'UNCLASSIFIED');
          const isJob = item.isJobRelated ?? (defaultClass === 'JOB' || defaultClass === 'UNCERTAIN');

          const payload = {
            userId: item.userId,
            emailAccountId: item.emailAccountId,
            providerMessageId: item.providerMessageId,
            providerThreadId: item.providerThreadId || null,
            sender: item.sender,
            senderEmail: item.senderEmail,
            company: item.company || null,
            subject: (item.subject || '').substring(0, 1000),
            snippet: item.snippet ? item.snippet.substring(0, 1000) : null,
            bodyText: item.bodyText ? item.bodyText.substring(0, 2000) : null,
            receivedAt: item.receivedAt instanceof Date ? item.receivedAt.toISOString() : new Date(item.receivedAt).toISOString(),
            category: item.category,
            deterministicClassification: item.deterministicClassification || defaultClass,
            classification: defaultClass,
            source: item.source || 'UNKNOWN',
            score: item.score ?? 0,
            confidence: item.confidence ?? 'MEDIUM',
            evidence: item.evidence ? item.evidence.substring(0, 1000) : null,
            metadata: item.metadata ? item.metadata.substring(0, 1000) : null,
            isJobRelated: isJob,
            classificationConfidence: item.classificationConfidence ?? null,
            role: item.role ? item.role.substring(0, 255) : null,
            platform: item.platform || 'Unknown',
            requiresAttention: item.requiresAttention ?? false,
            isRead: item.isRead ?? false,
            processedAt: item.processedAt instanceof Date ? item.processedAt.toISOString() : new Date(item.processedAt || Date.now()).toISOString(),
          };

          if (existing.documents.length > 0) {
            const ex = existing.documents[0];
            const currentOverride = ex.userOverride;
            const effectiveClass = currentOverride || payload.deterministicClassification;

            await appwrite.databases.updateDocument(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.emails,
              ex.$id,
              {
                ...payload,
                classification: effectiveClass,
                isJobRelated: effectiveClass === 'JOB' || effectiveClass === 'UNCERTAIN',
                userOverride: currentOverride || null,
              }
            );
            updated++;
          } else {
            const docId = item.id || ID.unique();
            await appwrite.databases.createDocument(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.emails,
              docId,
              payload
            );
            inserted++;
          }
        } catch (itemErr) {
          console.warn('Appwrite saveBatchEmails item error:', itemErr);
          skipped++;
        }
      }

      // Also mirror to memoryStore for local in-session responsiveness
      for (const item of items) {
        const id = item.id || `em_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const defaultClass = item.classification || item.deterministicClassification || (item.isJobRelated ? 'JOB' : 'UNCLASSIFIED');
        const fullEmail: Email = {
          ...item,
          id,
          deterministicClassification: item.deterministicClassification || defaultClass,
          userOverride: null,
          classification: defaultClass,
          source: item.source || 'UNKNOWN',
          score: item.score ?? 0,
          confidence: item.confidence ?? 'MEDIUM',
          evidence: item.evidence || null,
          metadata: item.metadata || null,
          company: item.company || null,
          role: item.role || null,
          platform: item.platform || 'Unknown',
          snippet: item.snippet || null,
          bodyText: item.bodyText || null,
          providerThreadId: item.providerThreadId || null,
          classificationConfidence: item.classificationConfidence || null,
          isJobRelated: item.isJobRelated ?? (defaultClass === 'JOB' || defaultClass === 'UNCERTAIN'),
          requiresAttention: item.requiresAttention ?? false,
          isRead: item.isRead ?? false,
          processedAt: item.processedAt || new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memoryStore.emailsList.set(id, fullEmail);
      }

      return { inserted, updated, skipped };
    }

    if (db) {
      const byAccount = new Map<string, NewEmail[]>();
      for (const item of items) {
        const list = byAccount.get(item.emailAccountId) || [];
        list.push(item);
        byAccount.set(item.emailAccountId, list);
      }

      for (const [accountId, accountItems] of byAccount.entries()) {
        try {
          const ids = accountItems.map(i => i.providerMessageId);
          const existing = await db
            .select({ id: emails.id, providerMessageId: emails.providerMessageId, userOverride: emails.userOverride })
            .from(emails)
            .where(
              and(
                eq(emails.emailAccountId, accountId),
                inArray(emails.providerMessageId, ids)
              )
            );

          const existingMap = new Map(existing.map(e => [e.providerMessageId, e]));
          const toInsert: NewEmail[] = [];

          for (const item of accountItems) {
            const ex = existingMap.get(item.providerMessageId);
            if (ex) {
              const currentOverride = ex.userOverride;
              const effectiveClass = currentOverride || item.deterministicClassification || 'UNCLASSIFIED';

              await db.update(emails)
                .set({
                  deterministicClassification: item.deterministicClassification || 'UNCLASSIFIED',
                  classification: effectiveClass,
                  source: item.source || 'UNKNOWN',
                  category: item.category,
                  isJobRelated: item.isJobRelated ?? (effectiveClass === 'JOB' || effectiveClass === 'UNCERTAIN'),
                  score: item.score ?? 0,
                  confidence: item.confidence ?? 'MEDIUM',
                  evidence: item.evidence || null,
                  metadata: item.metadata || null,
                  company: item.company || null,
                  role: item.role || null,
                  platform: item.platform || 'Unknown',
                  requiresAttention: item.requiresAttention ?? false,
                  snippet: item.snippet || null,
                  bodyText: item.bodyText || null,
                  updatedAt: new Date(),
                })
                .where(eq(emails.id, ex.id));
              updated++;
            } else {
              toInsert.push(item);
            }
          }

          const CHUNK_SIZE = 50;
          for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
            const chunk = toInsert.slice(i, i + CHUNK_SIZE);
            try {
              await db.insert(emails).values(chunk);
              inserted += chunk.length;
            } catch {
              for (const single of chunk) {
                try {
                  await db.insert(emails).values(single);
                  inserted++;
                } catch {
                  skipped++;
                }
              }
            }
          }
        } catch (e) {
          console.warn('Error saving batch email items for account:', accountId, e);
          skipped += accountItems.length;
        }
      }
      return { inserted, updated, skipped };
    }

    // Default Memory Store fallback
    for (const item of items) {
      const existing = Array.from(memoryStore.emailsList.values()).find(
        e => e.emailAccountId === item.emailAccountId && e.providerMessageId === item.providerMessageId
      );
      if (existing) {
        const effectiveClass = existing.userOverride || item.deterministicClassification || 'UNCLASSIFIED';
        Object.assign(existing, {
          ...item,
          classification: effectiveClass,
          updatedAt: new Date(),
        });
        updated++;
      } else {
        const id = item.id || `em_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const defaultClass = item.classification || item.deterministicClassification || (item.isJobRelated ? 'JOB' : 'UNCLASSIFIED');
        const fullEmail: Email = {
          ...item,
          id,
          deterministicClassification: item.deterministicClassification || defaultClass,
          userOverride: null,
          classification: defaultClass,
          source: item.source || 'UNKNOWN',
          score: item.score ?? 0,
          confidence: item.confidence ?? 'MEDIUM',
          evidence: item.evidence || null,
          metadata: item.metadata || null,
          company: item.company || null,
          role: item.role || null,
          platform: item.platform || 'Unknown',
          snippet: item.snippet || null,
          bodyText: item.bodyText || null,
          providerThreadId: item.providerThreadId || null,
          classificationConfidence: item.classificationConfidence || null,
          isJobRelated: item.isJobRelated ?? (defaultClass === 'JOB' || defaultClass === 'UNCERTAIN'),
          requiresAttention: item.requiresAttention ?? false,
          isRead: item.isRead ?? false,
          processedAt: item.processedAt || new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memoryStore.emailsList.set(id, fullEmail);
        inserted++;
      }
    }

    return { inserted, updated, skipped };
  },

  // User Authentication & Accounts
  async getAppUserByEmail(email: string): Promise<AppUser | null> {
    const normalized = email.trim().toLowerCase();

    const appwrite = getAppwrite();
    if (appwrite) {
      try {
        const res = await appwrite.databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.users,
          [Query.equal('email', normalized), Query.limit(1)]
        );
        if (res.documents.length > 0) {
          return docToAppUser(res.documents[0]);
        }
      } catch (err) {
        console.warn('Appwrite getAppUserByEmail error:', err);
      }
    }

    if (db) {
      if (normalized === 'demo.candidate@applyfeed.com') {
        const res = await db.select().from(demoAppUsers).where(eq(demoAppUsers.email, normalized));
        return (res[0] as unknown as AppUser) || null;
      }
      const res = await db.select().from(appUsers).where(eq(appUsers.email, normalized));
      return res[0] || null;
    }

    for (const u of memoryStore.users.values()) {
      if (u.email.toLowerCase() === normalized) return u;
    }
    return null;
  },

  async getAppUserById(id: string): Promise<AppUser | null> {
    const appwrite = getAppwrite();
    if (appwrite && id !== 'usr_demo') {
      try {
        const doc = await appwrite.databases.getDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.users,
          id
        );
        return docToAppUser(doc);
      } catch (err) {}
    }

    if (db) {
      if (id === 'usr_demo') {
        const res = await db.select().from(demoAppUsers).where(eq(demoAppUsers.id, id));
        return (res[0] as unknown as AppUser) || null;
      }
      const res = await db.select().from(appUsers).where(eq(appUsers.id, id));
      return res[0] || null;
    }

    return memoryStore.users.get(id) || null;
  },

  async createAppUser(data: NewAppUser): Promise<AppUser> {
    const appwrite = getAppwrite();
    if (appwrite) {
      try {
        const doc = await appwrite.databases.createDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.users,
          data.id,
          {
            email: data.email,
            passwordHash: data.passwordHash || null,
            name: data.name || null,
            googleId: data.googleId || null,
            avatarUrl: data.avatarUrl || null,
            authProvider: data.authProvider || 'google',
          }
        );
        const user = docToAppUser(doc);
        memoryStore.users.set(user.id, user);
        return user;
      } catch (err) {
        console.warn('Appwrite createAppUser error:', err);
      }
    }

    if (db) {
      const res = await db.insert(appUsers).values(data).returning();
      return res[0];
    }

    const user: AppUser = {
      id: data.id,
      email: data.email,
      passwordHash: data.passwordHash || null,
      name: data.name || null,
      googleId: data.googleId || null,
      avatarUrl: data.avatarUrl || null,
      authProvider: data.authProvider || 'google',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.users.set(data.id, user);
    return user;
  },

  async upsertGoogleUser(data: {
    email: string;
    name?: string;
    googleId?: string;
    avatarUrl?: string;
  }): Promise<AppUser> {
    const normalized = data.email.trim().toLowerCase();

    const appwrite = getAppwrite();
    if (appwrite) {
      try {
        const existing = await appwrite.databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.users,
          [Query.equal('email', normalized), Query.limit(1)]
        );

        if (existing.documents.length > 0) {
          const ex = existing.documents[0];
          const updated = await appwrite.databases.updateDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.users,
            ex.$id,
            {
              name: data.name || ex.name,
              googleId: data.googleId || ex.googleId,
              avatarUrl: data.avatarUrl || ex.avatarUrl,
            }
          );
          const user = docToAppUser(updated);
          memoryStore.users.set(user.id, user);
          return user;
        } else {
          const newId = `usr_${data.googleId ? data.googleId.slice(0, 16) : Math.random().toString(36).substring(2, 12)}`;
          const created = await appwrite.databases.createDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.users,
            newId,
            {
              email: normalized,
              name: data.name || null,
              googleId: data.googleId || null,
              avatarUrl: data.avatarUrl || null,
              authProvider: 'google',
            }
          );
          const user = docToAppUser(created);
          memoryStore.users.set(user.id, user);
          return user;
        }
      } catch (err) {
        console.warn('Appwrite upsertGoogleUser error:', err);
      }
    }

    if (db) {
      const existing = await db.select().from(appUsers).where(eq(appUsers.email, normalized));
      let user: AppUser;
      if (existing[0]) {
        const updated = await db.update(appUsers)
          .set({
            name: data.name || existing[0].name,
            googleId: data.googleId || existing[0].googleId,
            avatarUrl: data.avatarUrl || existing[0].avatarUrl,
            updatedAt: new Date(),
          })
          .where(eq(appUsers.id, existing[0].id))
          .returning();
        user = updated[0];
      } else {
        const newId = `usr_${data.googleId ? data.googleId.slice(0, 16) : Math.random().toString(36).substring(2, 12)}`;
        const inserted = await db.insert(appUsers).values({
          id: newId,
          email: normalized,
          name: data.name || null,
          googleId: data.googleId || null,
          avatarUrl: data.avatarUrl || null,
          authProvider: 'google',
        }).returning();
        user = inserted[0];
      }

      return user;
    }

    const fallbackUser: AppUser = {
      id: `usr_${data.googleId || 'mock'}`,
      email: normalized,
      name: data.name || null,
      passwordHash: null,
      googleId: data.googleId || null,
      avatarUrl: data.avatarUrl || null,
      authProvider: 'google',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.users.set(fallbackUser.id, fallbackUser);
    return fallbackUser;
  },
};
