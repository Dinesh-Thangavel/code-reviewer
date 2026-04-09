import { Request, Response } from 'express';
import prisma from '../db';

/**
 * Get insights stats data (service function)
 */
export const getInsightsStatsData = async () => {
    // Total counts
    const totalPRs = await prisma.pullRequest.count();
    const totalIssues = await prisma.issue.count();
    const totalReviews = await prisma.review.count();

    const averageIssuesPerPR = totalPRs > 0 ? parseFloat((totalIssues / totalPRs).toFixed(1)) : 0;

    // Most common issue types (by severity)
    const allIssues = await prisma.issue.findMany({
        select: { severity: true, language: true },
    });

    const issueTypeCounts: Record<string, number> = {};
    const languageCounts: Record<string, number> = {};

    for (const issue of allIssues) {
        issueTypeCounts[issue.severity] = (issueTypeCounts[issue.severity] || 0) + 1;
        languageCounts[issue.language] = (languageCounts[issue.language] || 0) + 1;
    }

    const mostCommonIssueTypes = Object.entries(issueTypeCounts)
        .map(([type, count]) => ({ type: type.charAt(0).toUpperCase() + type.slice(1), count }))
        .sort((a, b) => b.count - a.count);

    // Issues per language
    const totalLangIssues = Object.values(languageCounts).reduce((a, b) => a + b, 0) || 1;
    const issuesPerLanguage = Object.entries(languageCounts)
        .map(([language, issues]) => ({
            language,
            issues,
            percentage: Math.round((issues / totalLangIssues) * 100),
        }))
        .sort((a, b) => b.issues - a.issues);

    // Risk trend - get PRs from the last 14 days grouped by date
    const riskTrend = await getRiskTrend();

    // Fix stats
    const fixStats = await getFixStats();

    // Calculate severity counts for export
    const criticalIssues = await prisma.issue.count({ where: { severity: 'critical' } });
    const securityIssues = await prisma.issue.count({ where: { severity: 'security' } });
    const performanceIssues = await prisma.issue.count({ where: { severity: 'performance' } });
    const qualityIssues = await prisma.issue.count({ where: { severity: 'quality' } });
    const styleIssues = await prisma.issue.count({ where: { severity: 'style' } });
    const fixesApplied = await prisma.issue.count({ where: { fixStatus: 'APPLIED' } });
    const fixesRejected = await prisma.issue.count({ where: { fixStatus: 'REJECTED' } });

    return {
        totalPRs,
        totalIssues,
        totalReviews,
        averageIssuesPerPR,
        mostCommonIssueTypes: mostCommonIssueTypes.length > 0 ? mostCommonIssueTypes : getDefaultIssueTypes(),
        issuesPerLanguage: issuesPerLanguage.length > 0 ? issuesPerLanguage : getDefaultLanguages(),
        riskTrend: riskTrend.length > 0 ? riskTrend : getDefaultRiskTrend(),
        fixStats,
        // Export-specific fields
        criticalIssues,
        securityIssues,
        performanceIssues,
        qualityIssues,
        styleIssues,
        fixesApplied,
        fixesRejected,
    };
};

export const getInsightsStats = async (_req: Request, res: Response) => {
    try {
        const stats = await getInsightsStatsData();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching insights stats:', error);
        res.status(500).json({ error: 'Failed to fetch insights stats' });
    }
};

async function getRiskTrend() {
    try {
        const now = new Date();
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const prs = await prisma.pullRequest.findMany({
            where: { createdAt: { gte: fourteenDaysAgo } },
            select: { riskLevel: true, createdAt: true },
        });

        const trend: Record<string, { high: number; medium: number; low: number }> = {};

        for (let i = 7; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const key = date.toISOString().split('T')[0];
            trend[key] = { high: 0, medium: 0, low: 0 };
        }

        for (const pr of prs) {
            const key = pr.createdAt.toISOString().split('T')[0];
            if (trend[key]) {
                if (pr.riskLevel === 'HIGH') trend[key].high++;
                else if (pr.riskLevel === 'MEDIUM') trend[key].medium++;
                else trend[key].low++;
            }
        }

        return Object.entries(trend).map(([date, data]) => ({ date, ...data }));
    } catch {
        return [];
    }
}

async function getFixStats() {
    try {
        const applied = await prisma.issue.count({ where: { fixStatus: 'APPLIED' } });
        const rejected = await prisma.issue.count({ where: { fixStatus: 'REJECTED' } });
        const failed = await prisma.issue.count({ where: { fixStatus: 'FAILED' } });
        const pending = await prisma.issue.count({ where: { fixStatus: 'PENDING' } });

        return { applied, rejected, failed, pending };
    } catch {
        return { applied: 0, rejected: 0, failed: 0, pending: 0 };
    }
}

function getDefaultIssueTypes() {
    return [
        { type: 'Quality', count: 45 },
        { type: 'Security', count: 28 },
        { type: 'Performance', count: 22 },
        { type: 'Critical', count: 15 },
        { type: 'Style', count: 38 },
    ];
}

function getDefaultLanguages() {
    return [
        { language: 'TypeScript', issues: 52, percentage: 35 },
        { language: 'JavaScript', issues: 30, percentage: 20 },
        { language: 'Python', issues: 25, percentage: 17 },
        { language: 'Kotlin', issues: 18, percentage: 12 },
        { language: 'Swift', issues: 15, percentage: 10 },
        { language: 'Other', issues: 10, percentage: 6 },
    ];
}

function getDefaultRiskTrend() {
    return [
        { date: '2024-02-01', high: 2, medium: 5, low: 8 },
        { date: '2024-02-02', high: 1, medium: 4, low: 10 },
        { date: '2024-02-03', high: 3, medium: 6, low: 7 },
        { date: '2024-02-04', high: 0, medium: 3, low: 12 },
        { date: '2024-02-05', high: 4, medium: 5, low: 9 },
        { date: '2024-02-06', high: 2, medium: 7, low: 6 },
        { date: '2024-02-07', high: 1, medium: 4, low: 11 },
        { date: '2024-02-08', high: 3, medium: 6, low: 8 },
    ];
}
