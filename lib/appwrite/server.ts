import { Client, Databases, Users, Account, ID, Query } from 'node-appwrite';
import { APPWRITE_CONFIG } from './config';

export function createAdminClient() {
  const client = new Client()
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId)
    .setKey(APPWRITE_CONFIG.apiKey);

  return {
    get client() {
      return client;
    },
    get databases() {
      return new Databases(client);
    },
    get users() {
      return new Users(client);
    },
    get account() {
      return new Account(client);
    },
  };
}

export { ID, Query, Databases, Users, Account };
