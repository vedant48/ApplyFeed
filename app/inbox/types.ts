import { EmailWithAccount } from '@/lib/db/repository';

export type DatePreset = 'all' | 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'year' | 'custom';

export interface InboxFilterState {
  search: string;
  datePreset: DatePreset;
  customFrom?: string;
  customTo?: string;
  accountId: string;
  category: string;
  needsAttention: boolean;
  page: number;
  limit: number;
}

export interface SyncStatusProgress {
  isSyncing: boolean;
  accountsCount: number;
  completedCount: number;
  lastMessage?: string;
  results?: Array<{
    accountId: string;
    accountEmail: string;
    provider: string;
    success: boolean;
    newEmailsFound: number;
    error?: string;
  }>;
}

export interface EmailDetailData extends EmailWithAccount {
  deepLink?: string | null;
  bodyHtml?: string | null;
}
