#!/usr/bin/env node
/**
 * Automated Vercel Deployment Script for ApplyFeed
 * Performs pre-flight build check, synchronizes environment variables, and deploys to Vercel.
 */

import { execSync } from 'child_process';
import path from 'path';

console.log('🚀 Starting ApplyFeed Automated Vercel Deployment');
console.log('═════════════════════════════════════════════════════');

// Step 1: Sync Environment Variables
console.log('\n[1/3] Synchronizing Environment Variables...');
try {
  execSync('node scripts/sync-vercel-env.mjs', { stdio: 'inherit' });
} catch (e) {
  console.warn('⚠️ Environment sync encountered a warning, continuing with deployment...');
}

// Step 2: Validate Next.js Build
console.log('\n[2/3] Verifying Next.js Build...');
try {
  execSync('pnpm build', { stdio: 'inherit' });
  console.log('✅ Build passed successfully!');
} catch (e) {
  console.error('❌ Build failed. Please fix build errors before deploying.');
  process.exit(1);
}

// Step 3: Deploy to Vercel
console.log('\n[3/3] Deploying to Vercel Production...');
try {
  const isProd = process.argv.includes('--prod') || true;
  const prodFlag = isProd ? '--prod' : '';
  const tokenFlag = process.env.VERCEL_TOKEN ? `--token=${process.env.VERCEL_TOKEN}` : '';
  
  execSync(`npx --yes vercel ${prodFlag} ${tokenFlag} --yes`, { stdio: 'inherit' });
  console.log('\n🎉 Deployment complete!');
} catch (e) {
  console.error('❌ Deployment command failed:', e.message);
  process.exit(1);
}
