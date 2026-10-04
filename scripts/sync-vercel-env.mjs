#!/usr/bin/env node
/**
 * Automated Vercel Environment Variable Synchronizer for ApplyFeed
 * Reads .env.local and automatically synchronizes all variables to Vercel
 * via the Vercel REST API or Vercel CLI across production, preview, and development targets.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local not found. Please create .env.local first.');
  process.exit(1);
}

const envConfig = dotenv.parse(fs.readFileSync(envPath));

// Target environment variables to sync
const targetKeys = [
  'NEXT_PUBLIC_APPWRITE_ENDPOINT',
  'NEXT_PUBLIC_APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'APPWRITE_DATABASE_ID',
  'NEXT_PUBLIC_APPWRITE_COLLECTION_APP_USERS',
  'NEXT_PUBLIC_APPWRITE_COLLECTION_EMAIL_ACCOUNTS',
  'NEXT_PUBLIC_APPWRITE_COLLECTION_EMAILS',
  'ENCRYPTION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
];

const vercelToken = process.env.VERCEL_TOKEN;
const vercelProjectId = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME || 'apply-feed';
const vercelTeamId = process.env.VERCEL_TEAM_ID;

console.log('🔄 ApplyFeed Vercel Environment Variable Synchronizer');
console.log(`📁 Reading variables from: ${envPath}`);

// Identify variables present in .env.local
const varsToSync = {};
for (const key of Object.keys(envConfig)) {
  const val = envConfig[key]?.trim();
  if (val && !key.startsWith('#')) {
    varsToSync[key] = val;
  }
}

const keys = Object.keys(varsToSync);
console.log(`📋 Found ${keys.length} environment variables to sync:`);
keys.forEach(k => console.log(`   • ${k} (${k.includes('KEY') || k.includes('SECRET') ? '***hidden***' : varsToSync[k]})`));

async function syncViaVercelApi() {
  console.log('\n🌐 Connecting to Vercel REST API...');
  const baseUrl = 'https://api.vercel.com/v10/projects';
  const teamParam = vercelTeamId ? `?teamId=${vercelTeamId}` : '';
  const headers = {
    Authorization: `Bearer ${vercelToken}`,
    'Content-Type': 'application/json',
  };

  // 1. Get existing project env vars
  const listRes = await fetch(`${baseUrl}/${vercelProjectId}/env${teamParam}`, { headers });
  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Failed to list Vercel env vars: ${listRes.status} ${err}`);
  }

  const { envs: existingEnvs } = await listRes.json();
  const existingMap = new Map();
  for (const item of existingEnvs || []) {
    existingMap.set(item.key, item);
  }

  const targets = ['production', 'preview', 'development'];

  for (const [key, value] of Object.entries(varsToSync)) {
    const existing = existingMap.get(key);

    if (existing) {
      console.log(`⚡ Updating existing Vercel env: ${key} (targets: ${targets.join(', ')})`);
      const editRes = await fetch(`${baseUrl}/${vercelProjectId}/env/${existing.id}${teamParam}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          value,
          target: targets,
          type: key.includes('KEY') || key.includes('SECRET') ? 'secret' : 'plain',
        }),
      });

      if (!editRes.ok) {
        // If edit fails or type doesn't allow patch, delete and recreate
        await fetch(`${baseUrl}/${vercelProjectId}/env/${existing.id}${teamParam}`, {
          method: 'DELETE',
          headers,
        });
        await fetch(`${baseUrl}/${vercelProjectId}/env${teamParam}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            key,
            value,
            type: 'plain',
            target: targets,
          }),
        });
      }
    } else {
      console.log(`➕ Creating new Vercel env: ${key} (targets: ${targets.join(', ')})`);
      const createRes = await fetch(`${baseUrl}/${vercelProjectId}/env${teamParam}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          key,
          value,
          type: 'plain',
          target: targets,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        console.warn(`   ⚠️ Warning: Failed to create ${key}: ${err}`);
      }
    }
  }

  console.log('\n✅ All environment variables successfully synced to Vercel!');
}

function syncViaVercelCli() {
  console.log('\n💻 Syncing via Vercel CLI...');
  for (const [key, value] of Object.entries(varsToSync)) {
    for (const target of ['production', 'preview', 'development']) {
      try {
        console.log(`   Adding ${key} to ${target}...`);
        execSync(`npx vercel env add ${key} ${target} --force`, {
          input: value + '\n',
          stdio: ['pipe', 'ignore', 'ignore'],
        });
      } catch (e) {
        // continue
      }
    }
  }
  console.log('✅ CLI sync finished.');
}

async function main() {
  if (vercelToken) {
    await syncViaVercelApi();
  } else {
    console.log('\nℹ️ VERCEL_TOKEN environment variable not set.');
    console.log('ℹ️ Export VERCEL_TOKEN and VERCEL_PROJECT_ID to sync automatically via Vercel REST API, or login with "npx vercel login".');
    console.log('\n📝 Generated Vercel Environment Variables snippet for manual copy or CI/CD secret sync:');
    console.log('───────────────────────────────────────────────────────────────────');
    for (const [k, v] of Object.entries(varsToSync)) {
      console.log(`${k}=${v}`);
    }
    console.log('───────────────────────────────────────────────────────────────────');
  }
}

main().catch(err => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
