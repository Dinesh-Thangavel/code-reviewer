// Direct script to sync PRs - run with: npx ts-node scripts/sync-pr-direct.ts
import dotenv from 'dotenv';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import prisma from '../src/db';

dotenv.config();

const REPO_FULL_NAME = 'dineshmagizh93/pixmerge';
const INSTALLATION_ID = '110717794';
const APP_ID = process.env.GITHUB_APP_ID || '';
const PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';

async function syncPRs() {
    console.log('🔄 Syncing PRs from', REPO_FULL_NAME, '...\n');

    try {
        // 1. Generate JWT and get installation token
        console.log('1️⃣  Getting installation access token...');
        const now = Math.floor(Date.now() / 1000);
        const jwtToken = jwt.sign(
            { iat: now - 60, exp: now + (10 * 60), iss: APP_ID },
            PRIVATE_KEY,
            { algorithm: 'RS256' }
        );

        const tokenResponse = await axios.post(
            `https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens`,
            {},
            { headers: { Authorization: `Bearer ${jwtToken}`, Accept: 'application/vnd.github.v3+json' } }
        );
        const token = tokenResponse.data.token;
        console.log('   ✅ Token obtained\n');

        // 2. Fetch open PRs
        console.log('2️⃣  Fetching open PRs from GitHub...');
        const prsResponse = await axios.get(
            `https://api.github.com/repos/${REPO_FULL_NAME}/pulls?state=open`,
            { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } }
        );

        const prs = prsResponse.data;
        console.log(`   ✅ Found ${prs.length} open PR(s)\n`);

        if (prs.length === 0) {
            console.log('   ℹ️  No open PRs to sync');
            await prisma.$disconnect();
            return;
        }

        // 3. Upsert repository
        console.log('3️⃣  Upserting repository...');
        let repo = await prisma.repository.findFirst({
            where: { fullName: REPO_FULL_NAME },
        });

        if (!repo) {
            repo = await prisma.repository.create({
                data: {
                    name: REPO_FULL_NAME.split('/')[1],
                    fullName: REPO_FULL_NAME,
                    isActive: true,
                    autoReview: true,
                    installationId: INSTALLATION_ID,
                },
            });
            console.log('   ✅ Repository created');
        } else {
            console.log('   ✅ Repository exists');
        }
        console.log('');

        // 4. Create/Update PRs
        console.log('4️⃣  Syncing PRs...');
        const results = [];

        for (const pr of prs) {
            try {
                const existingPR = await prisma.pullRequest.findFirst({
                    where: { repoId: repo.id, number: pr.number },
                });

                if (!existingPR) {
                    await prisma.pullRequest.create({
                        data: {
                            repoId: repo.id,
                            number: pr.number,
                            title: pr.title,
                            author: pr.user.login,
                            status: 'OPEN',
                            riskLevel: 'LOW',
                            headSha: pr.head.sha,
                            baseBranch: pr.base.ref,
                        },
                    });
                    results.push({ number: pr.number, title: pr.title, status: 'created' });
                    console.log(`   ✅ Created PR #${pr.number}: ${pr.title.substring(0, 50)}...`);
                } else {
                    await prisma.pullRequest.update({
                        where: { id: existingPR.id },
                        data: { headSha: pr.head.sha, title: pr.title },
                    });
                    results.push({ number: pr.number, title: pr.title, status: 'updated' });
                    console.log(`   ✅ Updated PR #${pr.number}: ${pr.title.substring(0, 50)}...`);
                }
            } catch (error: any) {
                console.error(`   ❌ Error syncing PR #${pr.number}:`, error.message);
                results.push({ number: pr.number, title: pr.title, status: 'error', error: error.message });
            }
        }

        console.log('\n✅ Sync complete!');
        console.log('\nResults:');
        results.forEach(r => console.log(`   PR #${r.number}: ${r.status}`));
        console.log('\n📊 Check your dashboard: http://localhost:5173/pull-requests');
    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('   GitHub API Error:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

syncPRs();
