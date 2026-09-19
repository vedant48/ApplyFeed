import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

export const client = connectionString
  ? postgres(connectionString, { max: 10, idle_timeout: 20 })
  : null;

export const db = client ? drizzle(client, { schema }) : null;
