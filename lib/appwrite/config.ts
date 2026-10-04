export const APPWRITE_CONFIG = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID || '6ac11eea0003a6ff8261',
  apiKey: process.env.APPWRITE_API_KEY || 'standard_358a57e4755a92af081e85a4389b1b526748f3de9cacb226f24024575bb9693b7d3bfe9b877cfd54f3c6a474bf2693d0e17dd80a24f9d07ba6cf040df6d9559e7685804b9c44475dad67f1697782a3aadd968e4d49917eb627a5af511aa5e24079f5e82526263dd0b8e25351972933afee1730ca561e482fd3e3b14e8a1b6d97',
  databaseId: process.env.APPWRITE_DATABASE_ID || 'applyfeed',
  collections: {
    users: 'app_users',
    emailAccounts: 'email_accounts',
    emails: 'emails',
  },
};
