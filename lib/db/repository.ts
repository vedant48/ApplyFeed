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

// Memory store fallback for environments without live Postgres connection (e.g. testing / demo)
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
        processedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ...seedDefaults,
        id: 'em_102',
        userId: demoUserId,
        emailAccountId: outlookAccount.id,
        providerMessageId: 'ms_msg_202',
        providerThreadId: 'ms_th_202',
        sender: 'Razorpay Talent Acquisition',
        senderEmail: 'careers@razorpay.com',
        company: 'Razorpay',
        subject: 'Application received — Software Engineer II',
        snippet: 'Thank you for your application for the Software Engineer II position at Razorpay. Our recruiting team is currently reviewing your profile.',
        bodyText: `Dear Candidate,

Thank you for your interest in joining Razorpay. We have received your application for the Software Engineer II role submitted via Naukri.

Our hiring team is currently reviewing applications and will reach out if your profile matches the role requirements.

Regards,
Razorpay Talent Acquisition`,
        receivedAt: new Date(now.getTime() - 26 * 3600 * 1000), // Yesterday
        category: 'APPLICATION_RECEIVED',
        isJobRelated: true,
        classificationConfidence: 0.95,
        role: 'Software Engineer II',
        platform: 'Naukri',
        requiresAttention: false,
        isRead: true,
        processedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ...seedDefaults,
        id: 'em_103',
        userId: demoUserId,
        emailAccountId: personalAccount.id,
        providerMessageId: 'gmail_msg_303',
        providerThreadId: 'gmail_th_303',
        sender: 'Google Careers',
        senderEmail: 'jobs-noreply@google.com',
        company: 'Google',
        subject: 'Your application status',
        snippet: 'Thank you for applying to the Software Engineer role at Google. We are reviewing your qualifications and will be in touch.',
        bodyText: `Hello,

Thank you for your application to Google for the Software Engineer position.

We wanted to let you know that our recruitment team is reviewing your profile and will update you on the next steps as soon as possible. You can check the status of your submission anytime at Google Careers.

Sincerely,
Google Staffing`,
        receivedAt: new Date(now.getTime() - 3 * 86400 * 1000), // 3 days ago (Sep 12)
        category: 'APPLICATION',
        isJobRelated: true,
        classificationConfidence: 0.96,
        role: 'Software Engineer',
        platform: 'Google Careers',
        requiresAttention: false,
        isRead: false,
        processedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ...seedDefaults,
        id: 'em_104',
        userId: demoUserId,
        emailAccountId: workAccount.id,
        providerMessageId: 'gmail_msg_404',
        providerThreadId: 'gmail_th_404',
        sender: 'Stripe Recruiting',
        senderEmail: 'recruiting@stripe.com',
        company: 'Stripe',
        subject: 'Take-home technical assessment: Staff Infrastructure Engineer',
        snippet: 'Please find the instructions for your technical assessment. You will have 48 hours from starting to complete and submit.',
        bodyText: `Hi candidate,

As discussed during our recruiter chat, the next stage of our interview process is an asynchronous coding exercise.

Assessment link: https://app.coderpad.io/assessment/stripe-infra-9281

Please complete this within 5 business days. Let us know if you have any questions!

Best,
Stripe Recruiting`,
        receivedAt: new Date(now.getTime() - 5 * 86400 * 1000), // 5 days ago
        category: 'ASSESSMENT',
        isJobRelated: true,
        classificationConfidence: 0.97,
        role: 'Staff Infrastructure Engineer',
        platform: 'Ashby',
        requiresAttention: true,
        isRead: false,
        processedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ...seedDefaults,
        id: 'em_105',
        userId: demoUserId,
        emailAccountId: outlookAccount.id,
        providerMessageId: 'ms_msg_505',
        providerThreadId: 'ms_th_505',
        sender: 'Uber Careers',
        senderEmail: 'noreply@uber.com',
        company: 'Uber',
        subject: 'Update on your Senior Backend Engineer application',
        snippet: 'Thank you for your interest in Uber. After careful review, we have decided to move forward with other candidates at this time.',
        bodyText: `Dear candidate,

Thank you for your time and interest in the Senior Backend Engineer role at Uber.

While your background is impressive, we have chosen to move forward with candidates whose experience more closely matches the specific requirements of this team. We will keep your resume on file for future opportunities.

We wish you all the best in your job search.

Regards,
Uber Global Talent`,
        receivedAt: new Date(now.getTime() - 8 * 86400 * 1000), // 8 days ago
        category: 'REJECTION',
        isJobRelated: true,
        classificationConfidence: 0.99,
        role: 'Senior Backend Engineer',
        platform: 'Workday',
        requiresAttention: false,
        isRead: true,
        processedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ...seedDefaults,
        id: 'em_106',
        userId: demoUserId,
        emailAccountId: personalAccount.id,
        providerMessageId: 'gmail_msg_606',
        providerThreadId: 'gmail_th_606',
        sender: 'Linear Talent',
        senderEmail: 'talent@linear.app',
        company: 'Linear',
        subject: 'Offer of Employment — Full Stack Engineer',
        snippet: 'We are thrilled to extend an offer to join Linear as a Full Stack Engineer! Please review the enclosed offer letter and terms.',
        bodyText: `Hi John,

We are thrilled to offer you the Full Stack Engineer role at Linear! The entire team was thoroughly impressed by your design sensibilities and technical execution during the interviews.

Please find the official offer letter and details attached. We would love to discuss this with you on a call tomorrow.

Warmly,
Karri & the Linear Team`,
        receivedAt: new Date(now.getTime() - 14 * 86400 * 1000), // 14 days ago
        category: 'OFFER',
        isJobRelated: true,
        classificationConfidence: 0.99,
        role: 'Full Stack Engineer',
        platform: 'Lever',
        requiresAttention: true,
        isRead: false,
        processedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    for (const em of seedEmails) {
      this.emailsList.set(em.id, em);
    }
  }
}

const memoryStore = new MemoryDataStore();

/**
 * Parses date string boundaries properly handling timezone boundaries:
 * from: start of the day in local/UTC
 * to: end of the day in local/UTC (< endOfDay)
 */
export function parseDateRangeBoundaries(fromStr?: string, toStr?: string): { fromDate?: Date; toDate?: Date } {
  let fromDate: Date | undefined;
  let toDate: Date | undefined;

  if (fromStr) {
    const parsed = new Date(fromStr);
    if (!isNaN(parsed.getTime())) {
      // Start of day
      parsed.setUTCHours(0, 0, 0, 0);
      fromDate = parsed;
    }
  }

  if (toStr) {
    const parsed = new Date(toStr);
    if (!isNaN(parsed.getTime())) {
      // End of day (inclusive by setting to 23:59:59.999 or start of next day)
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
      if (db) {
        const rows = await db.select().from(demoEmailAccounts);
        return rows as unknown as EmailAccount[];
      }
      return Array.from(memoryStore.accounts.values());
    }
    if (db) {
      return await db.select().from(emailAccounts).where(eq(emailAccounts.userId, userId));
    }
    return Array.from(memoryStore.accounts.values()).filter(a => a.userId === userId);
  },

  async getEmailAccountById(id: string, userId: string, isDemo?: boolean): Promise<EmailAccount | null> {
    if (isDemo || userId === 'usr_demo') {
      if (db) {
        const res = await db.select().from(demoEmailAccounts).where(eq(demoEmailAccounts.id, id));
        return (res[0] as unknown as EmailAccount) || null;
      }
      const acc = memoryStore.accounts.get(id);
      return acc || null;
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
    if (db) {
      const res = await db.insert(emailAccounts).values(data).returning();
      return res[0];
    }
    const id = data.id || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newAcc: EmailAccount = {
      ...data,
      id,
      status: data.status || 'IDLE',
      lastError: data.lastError || null,
      syncCursor: data.syncCursor || null,
      encryptedRefreshToken: data.encryptedRefreshToken || null,
      tokenExpiresAt: data.tokenExpiresAt || null,
      lastSyncedAt: data.lastSyncedAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.accounts.set(id, newAcc);
    return newAcc;
  },

  async updateEmailAccount(id: string, data: Partial<EmailAccount>): Promise<EmailAccount | null> {
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

    // Completely isolated query for demo sandbox
    if (isDemo || userId === 'usr_demo') {
      if (db) {
        const demoConditions = [];
        if (classification && classification !== 'all') {
          demoConditions.push(eq(demoEmails.classification, classification));
        } else if (!classification) {
          demoConditions.push(eq(demoEmails.classification, 'JOB'));
        }

        if (accountId && accountId !== 'all') {
          demoConditions.push(eq(demoEmails.emailAccountId, accountId));
        }

        if (category && category !== 'all') {
          demoConditions.push(eq(demoEmails.category, category));
        }

        if (needsAttention) {
          demoConditions.push(eq(demoEmails.requiresAttention, true));
        }

        if (fromDate) {
          demoConditions.push(gte(demoEmails.receivedAt, fromDate));
        }

        if (toDate) {
          demoConditions.push(lt(demoEmails.receivedAt, toDate));
        }

        if (search && search.trim()) {
          const term = `%${search.trim()}%`;
          demoConditions.push(
            or(
              ilike(demoEmails.company, term),
              ilike(demoEmails.role, term),
              ilike(demoEmails.subject, term),
              ilike(demoEmails.sender, term),
              ilike(demoEmails.platform, term)
            )!
          );
        }

        const whereClause = demoConditions.length > 0 ? and(...demoConditions) : undefined;

        const [totalCountResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(demoEmails)
          .where(whereClause);

        const offset = (page - 1) * limit;

        const rawEmails = await db
          .select({
            email: demoEmails,
            accountEmail: demoEmailAccounts.email,
            accountProvider: demoEmailAccounts.provider,
          })
          .from(demoEmails)
          .leftJoin(demoEmailAccounts, eq(demoEmails.emailAccountId, demoEmailAccounts.id))
          .where(whereClause)
          .orderBy(desc(demoEmails.receivedAt))
          .limit(limit)
          .offset(offset);

        const resultEmails: EmailWithAccount[] = rawEmails.map(r => ({
          ...r.email,
          accountEmail: r.accountEmail || undefined,
          accountProvider: r.accountProvider || undefined,
        })) as unknown as EmailWithAccount[];

        return {
          emails: resultEmails,
          total: Number(totalCountResult?.count || 0),
        };
      }
    }

    if (db) {
      const conditions = [
        eq(emails.userId, userId),
      ];

      // Requirement 10: Classification is the single source of truth for the Job Inbox
      if (classification && classification !== 'all') {
        conditions.push(eq(emails.classification, classification));
      } else if (!classification) {
        // Main Job Inbox strictly queries classification = 'JOB'
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

    // Memory Store Implementation
    let all = Array.from(memoryStore.emailsList.values()).filter(e => {
      if (e.userId !== userId) return false;

      // Classification is single source of truth
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

    // Sort by receivedAt descending
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
      if (db) {
        const res = await db
          .select({
            email: demoEmails,
            accountEmail: demoEmailAccounts.email,
            accountProvider: demoEmailAccounts.provider,
          })
          .from(demoEmails)
          .leftJoin(demoEmailAccounts, eq(demoEmails.emailAccountId, demoEmailAccounts.id))
          .where(eq(demoEmails.id, id));

        if (!res[0]) return null;
        return {
          ...res[0].email,
          accountEmail: res[0].accountEmail || undefined,
          accountProvider: res[0].accountProvider || undefined,
        } as unknown as EmailWithAccount;
      }
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
    if (isDemo || userId === 'usr_demo') {
      if (db) {
        const res = await db.update(demoEmails)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(demoEmails.id, id))
          .returning();
        return (res[0] as unknown as Email) || null;
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
    if (isDemo || userId === 'usr_demo') {
      if (db) {
        const res = await db.update(demoEmails)
          .set({
            userOverride: override,
            classification: override,
            isJobRelated: override === 'JOB' || override === 'UNCERTAIN',
            updatedAt: new Date(),
          })
          .where(eq(demoEmails.id, emailId))
          .returning();
        return (res[0] as unknown as Email) || null;
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

    if (db) {
      // Group items by emailAccountId to perform efficient batch lookups
      const byAccount = new Map<string, NewEmail[]>();
      for (const item of items) {
        const list = byAccount.get(item.emailAccountId) || [];
        list.push(item);
        byAccount.set(item.emailAccountId, list);
      }

      for (const [accountId, accountItems] of byAccount.entries()) {
        try {
          const ids = accountItems.map(i => i.providerMessageId);
          // Look up existing in a single roundtrip
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

          // Chunked batch insertion
          const CHUNK_SIZE = 50;
          for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
            const chunk = toInsert.slice(i, i + CHUNK_SIZE);
            try {
              await db.insert(emails).values(chunk);
              inserted += chunk.length;
            } catch (chunkErr) {
              // If batch fails (e.g. duplicate inside chunk), fallback to one-by-one for this chunk
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
    } else {
      for (const item of items) {
        // Check uniqueness in memoryStore: emailAccountId + providerMessageId
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
    }

    return { inserted, updated, skipped };
  },

  // User Authentication & Accounts
  async getAppUserByEmail(email: string): Promise<AppUser | null> {
    const normalized = email.trim().toLowerCase();
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
