#!/usr/bin/env ts-node
/**
 * Minimal CLI to trigger or sync reviews, usable in CI or locally.
 *
 * Usage:
 *   cd backend
 *   npm run cli -- --repo owner/name --provider github --token <jwt> [--sync]
 *
 * For Bitbucket:
 *   npm run cli -- --repo workspace/repo --provider bitbucket --token <jwt> --sync
 *
 * Env:
 *   BACKEND_URL (default http://localhost:5000)
 */
import axios from 'axios';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';

dotenv.config();

const argv = yargs(hideBin(process.argv))
  .option('repo', { type: 'string', demandOption: true, describe: 'Full repo name (owner/name or workspace/repo)' })
  .option('provider', { type: 'string', default: 'github', choices: ['github', 'bitbucket'] })
  .option('token', { type: 'string', describe: 'JWT auth token for API', demandOption: true })
  .option('sync', { type: 'boolean', default: true, describe: 'Sync PRs before review' })
  .option('review', { type: 'number', describe: 'Specific PR number to review (GitHub only via webhook flow)' })
  .help()
  .argv;

const BASE = process.env.BACKEND_URL || 'http://localhost:5000';

async function main() {
  const headers = { Authorization: `Bearer ${argv.token}` };

  if (argv.sync) {
    if (argv.provider === 'github') {
      await axios.post(`${BASE}/api/github/sync`, { repoFullName: argv.repo }, { headers });
      console.log(`Synced GitHub PRs for ${argv.repo}`);
    } else {
      await axios.post(`${BASE}/api/repositories/bitbucket/sync`, { repoFullName: argv.repo }, { headers });
      console.log(`Synced Bitbucket PRs for ${argv.repo}`);
    }
  }

  if (argv.review && argv.provider === 'github') {
    await axios.post(`${BASE}/api/reviews/${argv.review}/rerun`, {}, { headers });
    console.log(`Triggered re-review for reviewId=${argv.review}`);
  } else {
    console.log('Review not triggered (provide --review <id> for a specific review run).');
  }
}

main().catch((err) => {
  console.error('CLI error:', err.response?.data || err.message);
  process.exit(1);
});
