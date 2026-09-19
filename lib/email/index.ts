import { EmailProviderType } from './types';
import { EmailProvider } from './provider';
import { GmailProvider } from './gmail';
import { MicrosoftProvider } from './microsoft';

const gmailInstance = new GmailProvider();
const microsoftInstance = new MicrosoftProvider();

export function getProvider(type: EmailProviderType): EmailProvider {
  if (type === 'gmail') return gmailInstance;
  if (type === 'microsoft') return microsoftInstance;
  throw new Error(`Unsupported email provider type: ${type}`);
}

export * from './types';
export * from './provider';
export * from './normalizer';
export * from './extractor';
export * from './classifier';
