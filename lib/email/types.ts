export type EmailProviderType = 'gmail' | 'microsoft';

export interface NormalizedEmail {
  provider: EmailProviderType;
  providerMessageId: string;
  providerThreadId?: string;
  sender: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  bodyText?: string;
  bodyHtml?: string;
  receivedAt: Date;
  links: string[];
}

export interface SyncOptions {
  cursor?: string;
  fromDate?: Date;
  toDate?: Date;
  isHistorical?: boolean;
  maxResults?: number;
}

export interface SyncFetchResult {
  emails: NormalizedEmail[];
  nextCursor?: string;
  discovered?: number;
}

export interface FilterStats {
  // Accurate counters (Part 1 requirement)
  discovered: number;
  fetched: number;
  processed: number;
  jobRelated: number;
  uncertain: number;
  nonJob: number;
  errors: number;

  // Compatibility fields for existing UI components
  totalScanned: number;
  filteredOutDeterministic: number;
  evaluatedByClassifier: number;
  jobEmailsSaved: number;
  duplicateOrSkipped: number;
  nonJobBreakdown: {
    receiptsAndPurchases: number;
    securityAndOtp: number;
    generalMarketingAndSocial: number;
    otherNonJob: number;
  };
  jobCategoryBreakdown: Record<string, number>;
}

export interface SyncAccountResult {
  accountId: string;
  accountEmail: string;
  provider: EmailProviderType;
  success: boolean;
  newEmailsFound: number;
  stats?: FilterStats;
  error?: string;
}

export type JobEmailCategory =
  | 'APPLICATION'
  | 'APPLICATION_RECEIVED'
  | 'RECRUITER'
  | 'ASSESSMENT'
  | 'INTERVIEW'
  | 'INTERVIEW_SCHEDULE'
  | 'REJECTION'
  | 'OFFER'
  | 'FOLLOW_UP'
  | 'OTHER_JOB'
  | 'NOT_JOB_RELATED';

export interface ClassificationResult {
  isJobRelated: boolean;
  category: JobEmailCategory;
  company: string | null;
  role: string | null;
  platform: string;
  requiresAttention: boolean;
  confidence: number;
}
