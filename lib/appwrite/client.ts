import { Client, Account, Databases } from 'appwrite';
import { APPWRITE_CONFIG } from './config';

export function createBrowserClient() {
  const client = new Client()
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId);

  return {
    get client() {
      return client;
    },
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
  };
}
