import { EmailProviderType, SyncOptions, SyncFetchResult } from './types';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  email: string;
  accountId: string;
}

export interface EmailProvider {
  type: EmailProviderType;
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  fetchEmails(accessToken: string, options: SyncOptions): Promise<SyncFetchResult>;
  getDeepLink(messageId: string, threadId?: string): string;
  refreshAccessToken?(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }>;
}
