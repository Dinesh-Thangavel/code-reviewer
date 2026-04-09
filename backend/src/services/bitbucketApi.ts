import axios from 'axios';

export interface PRFile {
    filename: string;
    patch: string;
    language: string;
}

const getExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()! : 'txt';
};

/**
 * Fetch PR files with unified patch from Bitbucket Cloud.
 * Uses the PR patch endpoint and splits by file boundaries.
 */
export const getBitbucketPRFiles = async (
    token: string,
    workspace: string,
    repoSlug: string,
    prId: number,
): Promise<PRFile[]> => {
    try {
        const response = await axios.get(
            `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/patch`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'text/plain',
                },
                responseType: 'text',
            },
        );

        const patchText: string = response.data;
        const files: PRFile[] = [];

        // Split the patch by file; Bitbucket uses the same "diff --git" markers as git.
        const parts = patchText.split(/^diff --git/m).filter((p) => p.trim().length > 0);
        for (const part of parts) {
            const normalized = part.startsWith(' a/') ? `diff --git${part}` : `diff --git ${part}`;
            const match = normalized.match(/\+\+\+ b\/([^\n\r]+)/);
            if (!match || match[1] === 'dev/null') {
                continue; // Skip deletions or unknown files
            }
            const filename = match[1].trim();
            const patch = `diff --git ${normalized}`; // include the header we split on
            files.push({
                filename,
                patch,
                language: getExtension(filename),
            });
        }

        return files;
    } catch (error: any) {
        console.error('Error fetching Bitbucket PR files:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });
        throw new Error('Failed to fetch Bitbucket PR files');
    }
};

/**
 * Post a summary review comment back to Bitbucket.
 * For now we post a single general comment (no inline) so the review is visible in the PR timeline.
 */
export const postBitbucketReviewComment = async (
    token: string,
    workspace: string,
    repoSlug: string,
    prId: number,
    reviewResult: {
        summary: string;
        riskLevel: string;
        confidenceScore: number;
        issues: Array<{ severity: string; title: string; file?: string; line?: number }>;
    },
) => {
    const issuesCount = reviewResult.issues.reduce<Record<string, number>>((acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
    }, {});

    const summaryBody = [
        '### 🤖 AI Code Review',
        '',
        `**Risk Level:** ${reviewResult.riskLevel}`,
        `**Confidence:** ${reviewResult.confidenceScore}%`,
        '',
        '**Issue Summary:**',
        `- 🔴 Critical: ${issuesCount.critical || 0}`,
        `- 🔒 Security: ${issuesCount.security || 0}`,
        `- 🚩 Performance: ${issuesCount.performance || 0}`,
        `- 🔧 Quality: ${issuesCount.quality || 0}`,
        `- ✨ Style: ${issuesCount.style || 0}`,
        '',
        reviewResult.summary || '_No summary generated._',
    ].join('\n');

    try {
        await axios.post(
            `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
            {
                content: { raw: summaryBody },
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            },
        );
    } catch (error: any) {
        console.error('Error posting Bitbucket review comment:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });
        throw new Error('Failed to post Bitbucket review comment');
    }
};

/**
 * Post inline comments for individual issues (best-effort, limited to avoid noise).
 */
export const postBitbucketInlineComments = async (
    token: string,
    workspace: string,
    repoSlug: string,
    prId: number,
    issues: Array<{ file?: string; line?: number; title: string; description?: string; severity?: string }>,
    limit = 12,
) => {
    const subset = issues.slice(0, limit);
    for (const issue of subset) {
        if (!issue.file || !issue.line) continue;
        const bodyLines = [
            `**${issue.severity ?? 'Issue'}:** ${issue.title}`,
            issue.description ? issue.description : '',
        ].filter(Boolean);
        try {
            await axios.post(
                `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
                {
                    content: { raw: bodyLines.join('\n\n') },
                    inline: {
                        path: issue.file,
                        to: issue.line,
                    },
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );
        } catch (error: any) {
            console.warn('Error posting inline Bitbucket comment:', {
                message: error.message,
                status: error.response?.status,
            });
        }
    }
};

type BitbucketBuildState = 'SUCCESSFUL' | 'FAILED' | 'INPROGRESS' | 'STOPPED';

/**
 * Create/update build status on the commit for visibility.
 */
export const postBitbucketStatus = async (
    token: string,
    workspace: string,
    repoSlug: string,
    commitSha: string,
    state: BitbucketBuildState,
    url: string,
    description: string,
    key = 'ai-review',
) => {
    try {
        await axios.post(
            `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/commit/${commitSha}/statuses/build`,
            {
                state,
                key,
                url,
                description,
                name: 'AI Code Review',
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            },
        );
    } catch (error: any) {
        console.warn('Error posting Bitbucket status:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
        });
    }
};
