// Direct script to sync PRs without needing the API endpoint
require('dotenv').config();
const { getInstallationAccessToken } = require('../dist/services/githubApi');
const axios = require('axios');
const prisma = require('../dist/db').default;
const { getReviewQueue } = require('../dist/jobs/queue');

const REPO_FULL_NAME = 'dineshmagizh93/pixmerge';
const INSTALLATION_ID = '110717794';

async function syncPRs() {
    console.log('🔄 Syncing PRs from', REPO_FULL_NAME, '...\n');

    try {
        // 1. Get installation token
        console.log('1️⃣  Getting installation access token...');
        const token = await getInstallationAccessToken(INSTALLATION_ID);
        console.log('   ✅ Token obtained\n');

        // 2. Fetch open PRs
        console.log('2️⃣  Fetching open PRs from GitHub...');
        const response = await axios.get(
            `https://api.github.com/repos/${REPO_FULL_NAME}/pulls?state=open`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );

        const prs = response.data;
        console.log(`   ✅ Found ${prs.length} open PR(s)\n`);

        if (prs.length === 0) {
            console.log('   ℹ️  No open PRs to sync');
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
                    where: {
                        repoId: repo.id,
                        number: pr.number,
                    },
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
                    console.log(`   ✅ Created PR #${pr.number}: ${pr.title}`);
                } else {
                    await prisma.pullRequest.update({
                        where: { id: existingPR.id },
                        data: {
                            headSha: pr.head.sha,
                            title: pr.title,
                        },
                    });
                    results.push({ number: pr.number, title: pr.title, status: 'updated' });
                    console.log(`   ✅ Updated PR #${pr.number}: ${pr.title}`);
                }
            } catch (error) {
                console.error(`   ❌ Error syncing PR #${pr.number}:`, error.message);
                results.push({ number: pr.number, title: pr.title, status: 'error', error: error.message });
            }
        }

        console.log('\n✅ Sync complete!');
        console.log('\nResults:');
        results.forEach(r => {
            console.log(`   PR #${r.number}: ${r.status}`);
        });

        console.log('\n📊 Check your dashboard: http://localhost:5173/pull-requests');
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.response) {
            console.error('   GitHub API Error:', error.response.data);
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

syncPRs();
