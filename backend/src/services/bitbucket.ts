/**
 * Bitbucket Service
 * Handles Bitbucket API operations for pull requests and repositories
 */

import axios from 'axios';
import prisma from '../db';
import { getReviewQueue } from '../jobs/queue';
import { decryptToken } from './bitbucketOAuth';

/**
 * Fetch pull requests from Bitbucket API
 */
export const getBitbucketPullRequests = async (
    token: string,
    workspace: string,
    repoSlug: string
): Promise<Array<{
    id: number;
    title: string;
    author: {
        username: string;
        display_name: string;
    };
    source: {
        commit: {
            hash: string;
        };
        branch: {
            name: string;
        };
    };
    destination: {
        branch: {
            name: string;
        };
    };
    state: string;
}>> => {
    try {
        const allPRs: any[] = [];
        let nextUrl = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests?state=OPEN&pagelen=50`;

        // Bitbucket uses pagination
        while (nextUrl) {
            const response = await axios.get(nextUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            });

            const prs = response.data.values || [];
            allPRs.push(...prs);

            // Check for next page
            nextUrl = response.data.next || null;
        }

        return allPRs.map((pr: any) => ({
            id: pr.id,
            title: pr.title,
            author: {
                username: pr.author.username,
                display_name: pr.author.display_name || pr.author.username,
            },
            source: {
                commit: {
                    hash: pr.source.commit.hash,
                },
                branch: {
                    name: pr.source.branch.name,
                },
            },
            destination: {
                branch: {
                    name: pr.destination.branch.name,
                },
            },
            state: pr.state,
        }));
    } catch (error: any) {
        console.error('Error fetching Bitbucket pull requests:', error);
        throw new Error(`Failed to fetch Bitbucket pull requests: ${error.message}`);
    }
};

/**
 * Handle Bitbucket Pull Request Opened
 * Similar to GitHub's handlePullRequestOpened but for Bitbucket
 */
export const handleBitbucketPullRequestOpened = async (payload: {
    repository: {
        full_name: string; // workspace/repo-slug
        name: string;
    };
    pull_request: {
        id: number;
        title: string;
        author: {
            username: string;
        };
        source: {
            commit: {
                hash: string;
            };
            branch: {
                name: string;
            };
        };
        destination: {
            branch: {
                name: string;
            };
        };
    };
    userId: string;
}) => {
    const { repository, pull_request, userId } = payload;

    try {
        console.log(`[Bitbucket] Processing PR opened event: ${repository.full_name} #${pull_request.id}`);

        // 1. Find Repository (use findUnique for unique field)
        const repo = await prisma.repository.findUnique({
            where: { fullName: repository.full_name },
        });

        if (!repo) {
            console.log(`[Bitbucket] Repository ${repository.full_name} not found`);
            return { success: false, error: 'Repository not found' };
        }

        // Ensure it belongs to the user
        if (repo.userId !== userId) {
            console.log(`[Bitbucket] Repository ${repository.full_name} does not belong to user ${userId}`);
            return { success: false, error: 'Repository access denied' };
        }

        // Check if auto-review is enabled
        if (!repo.isActive || !repo.autoReview) {
            console.log(`[Bitbucket] Skipping review for ${repository.full_name} (auto-review disabled)`);
            return { success: true, skipped: true, reason: 'auto-review-disabled' };
        }

        // 2. Upsert Pull Request (use compound unique key to prevent duplicates)
        const pr = await prisma.pullRequest.upsert({
            where: {
                repoId_number: {
                    repoId: repo.id,
                    number: pull_request.id,
                },
            },
            update: {
                // Update fields that might change
                headSha: pull_request.source.commit.hash,
                title: pull_request.title,
            },
            create: {
                repoId: repo.id,
                number: pull_request.id,
                title: pull_request.title,
                author: pull_request.author.username,
                status: 'OPEN',
                riskLevel: 'LOW',
                headSha: pull_request.source.commit.hash,
                baseBranch: pull_request.destination.branch.name || 'main',
            },
        });
        console.log(`[Bitbucket] ✅ Upserted PR #${pull_request.id} for ${repository.full_name} (PR ID: ${pr.id})`);

        // 3. Enqueue Review Job with retry logic
        const queue = getReviewQueue();
        if (queue) {
            const job = await queue.add('review-pr', {
                repoFullName: repository.full_name,
                prNumber: pull_request.id,
                provider: 'BITBUCKET',
                commitSha: pull_request.source.commit.hash,
                userId: userId,
            }, {
                attempts: 5, // Increased from 3 to 5
                backoff: {
                    type: 'exponential',
                    delay: 2000, // Start with 2 seconds
                },
                removeOnComplete: {
                    age: 3600, // Keep completed jobs for 1 hour
                },
                removeOnFail: {
                    age: 86400, // Keep failed jobs for 24 hours for debugging
                },
            });
            console.log(`[Bitbucket] ✅ Enqueued review-pr for ${repository.full_name} #${pull_request.id} (Job ID: ${job.id})`);
            return { success: true, jobId: job.id, prId: pr.id };
        } else {
            console.error(`[Bitbucket] ❌ Redis unavailable – cannot enqueue review for ${repository.full_name} #${pull_request.id}`);
            return { success: false, error: 'Redis unavailable' };
        }
    } catch (error: any) {
        console.error(`[Bitbucket] ❌ Error handling PR opened for ${repository.full_name} #${pull_request.id}:`, error);
        console.error(`[Bitbucket] Error stack:`, error.stack);
        return { success: false, error: error.message };
    }
};
