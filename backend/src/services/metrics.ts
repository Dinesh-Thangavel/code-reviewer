/**
 * Metrics Service
 * Tracks review metrics for analytics
 */

import prisma from '../db';

/**
 * Record review metrics
 */
export const recordReviewMetrics = async (data: {
    repositoryId?: string;
    reviewsCompleted: number;
    reviewsFailed: number;
    avgReviewTime: number; // in seconds
    totalIssues: number;
    criticalIssues: number;
    fixesApplied: number;
    fixesRejected: number;
}) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        // Handle null repositoryId case - Prisma unique constraint doesn't support null in where clause
        // For null repositoryId, use findFirst + update/create
        if (!data.repositoryId) {
            const existing = await prisma.reviewMetrics.findFirst({
                where: {
                    repositoryId: null,
                    date: today,
                },
            });

            if (existing) {
                await prisma.reviewMetrics.update({
                    where: { id: existing.id },
                    data: {
                        reviewsCompleted: { increment: data.reviewsCompleted },
                        reviewsFailed: { increment: data.reviewsFailed },
                        avgReviewTime: data.avgReviewTime,
                        totalIssues: { increment: data.totalIssues },
                        criticalIssues: { increment: data.criticalIssues },
                        fixesApplied: { increment: data.fixesApplied },
                        fixesRejected: { increment: data.fixesRejected },
                    },
                });
            } else {
                await prisma.reviewMetrics.create({
                    data: {
                        repositoryId: null,
                        date: today,
                        reviewsCompleted: data.reviewsCompleted,
                        reviewsFailed: data.reviewsFailed,
                        avgReviewTime: data.avgReviewTime,
                        totalIssues: data.totalIssues,
                        criticalIssues: data.criticalIssues,
                        fixesApplied: data.fixesApplied,
                        fixesRejected: data.fixesRejected,
                    },
                });
            }
            return;
        }

        await prisma.reviewMetrics.upsert({
            where: {
                repositoryId_date: {
                    repositoryId: data.repositoryId,
                    date: today,
                },
            },
            update: {
                reviewsCompleted: { increment: data.reviewsCompleted },
                reviewsFailed: { increment: data.reviewsFailed },
                avgReviewTime: data.avgReviewTime,
                totalIssues: { increment: data.totalIssues },
                criticalIssues: { increment: data.criticalIssues },
                fixesApplied: { increment: data.fixesApplied },
                fixesRejected: { increment: data.fixesRejected },
            },
            create: {
                repositoryId: data.repositoryId,
                date: today,
                reviewsCompleted: data.reviewsCompleted,
                reviewsFailed: data.reviewsFailed,
                avgReviewTime: data.avgReviewTime,
                totalIssues: data.totalIssues,
                criticalIssues: data.criticalIssues,
                fixesApplied: data.fixesApplied,
                fixesRejected: data.fixesRejected,
            },
        });
    } catch (error) {
        console.error('Error recording review metrics:', error);
    }
};

/**
 * Get review velocity (reviews per day/week/month)
 */
export const getReviewVelocity = async (options: {
    repositoryId?: string;
    startDate: Date;
    endDate: Date;
    period: 'day' | 'week' | 'month';
}) => {
    const metrics = await prisma.reviewMetrics.findMany({
        where: {
            repositoryId: options.repositoryId || undefined,
            date: {
                gte: options.startDate,
                lte: options.endDate,
            },
        },
        orderBy: { date: 'asc' },
    });

    return metrics.map((m) => ({
        date: m.date,
        reviewsCompleted: m.reviewsCompleted,
        reviewsFailed: m.reviewsFailed,
        avgReviewTime: m.avgReviewTime,
        totalIssues: m.totalIssues,
        criticalIssues: m.criticalIssues,
        fixesApplied: m.fixesApplied,
        fixesRejected: m.fixesRejected,
    }));
};

/**
 * Get team performance metrics
 */
export const getTeamMetrics = async (options: {
    repositoryId?: string;
    startDate: Date;
    endDate: Date;
}) => {
    const metrics = await prisma.reviewMetrics.findMany({
        where: {
            repositoryId: options.repositoryId || undefined,
            date: {
                gte: options.startDate,
                lte: options.endDate,
            },
        },
    });

    const totals = metrics.reduce(
        (acc, m) => ({
            reviewsCompleted: acc.reviewsCompleted + m.reviewsCompleted,
            reviewsFailed: acc.reviewsFailed + m.reviewsFailed,
            totalIssues: acc.totalIssues + m.totalIssues,
            criticalIssues: acc.criticalIssues + m.criticalIssues,
            fixesApplied: acc.fixesApplied + m.fixesApplied,
            fixesRejected: acc.fixesRejected + m.fixesRejected,
            totalReviewTime: acc.totalReviewTime + m.avgReviewTime * m.reviewsCompleted,
        }),
        {
            reviewsCompleted: 0,
            reviewsFailed: 0,
            totalIssues: 0,
            criticalIssues: 0,
            fixesApplied: 0,
            fixesRejected: 0,
            totalReviewTime: 0,
        }
    );

    return {
        ...totals,
        avgReviewTime: totals.reviewsCompleted > 0 ? totals.totalReviewTime / totals.reviewsCompleted : 0,
        fixAcceptanceRate:
            totals.fixesApplied + totals.fixesRejected > 0
                ? (totals.fixesApplied / (totals.fixesApplied + totals.fixesRejected)) * 100
                : 0,
        criticalIssueRate:
            totals.totalIssues > 0 ? (totals.criticalIssues / totals.totalIssues) * 100 : 0,
    };
};

/**
 * Get accuracy metrics for automatic reviews
 * Calculates precision, recall, acceptance rate, and confidence calibration
 */
export const getAccuracyMetrics = async (options?: {
    repositoryId?: string;
    startDate?: Date;
    endDate?: Date;
}) => {
    const where: any = {
        userFeedback: { not: null }, // Only issues with feedback
    };

    // Filter by repository if provided
    if (options?.repositoryId) {
        where.review = {
            pullRequest: {
                repositoryId: options.repositoryId,
            },
        };
    }

    // Filter by date range if provided
    if (options?.startDate || options?.endDate) {
        where.createdAt = {};
        if (options.startDate) where.createdAt.gte = options.startDate;
        if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const issues = await prisma.issue.findMany({
        where,
        select: {
            id: true,
            severity: true,
            language: true,
            userFeedback: true,
            review: {
                select: {
                    confidenceScore: true,
                },
            },
        },
    });

    // Calculate overall metrics
    const totalIssues = issues.length;
    const accepted = issues.filter(i => i.userFeedback === 'accepted').length;
    const rejected = issues.filter(i => i.userFeedback === 'rejected').length;
    const modified = issues.filter(i => i.userFeedback === 'modified').length;

    // Precision = True Positives / (True Positives + False Positives)
    // In our case: Accepted / (Accepted + Rejected)
    const precision = accepted + rejected > 0 ? (accepted / (accepted + rejected)) * 100 : 0;

    // Acceptance Rate = Accepted / Total
    const acceptanceRate = totalIssues > 0 ? (accepted / totalIssues) * 100 : 0;

    // False Positive Rate = Rejected / Total
    const falsePositiveRate = totalIssues > 0 ? (rejected / totalIssues) * 100 : 0;

    // Calculate by severity
    const bySeverity: Record<string, any> = {};
    const severities = ['critical', 'security', 'performance', 'quality', 'style'];
    
    for (const severity of severities) {
        const severityIssues = issues.filter(i => i.severity === severity);
        const severityTotal = severityIssues.length;
        const severityAccepted = severityIssues.filter(i => i.userFeedback === 'accepted').length;
        const severityRejected = severityIssues.filter(i => i.userFeedback === 'rejected').length;
        
        if (severityTotal > 0) {
            bySeverity[severity] = {
                total: severityTotal,
                accepted: severityAccepted,
                rejected: severityRejected,
                modified: severityIssues.filter(i => i.userFeedback === 'modified').length,
                precision: severityAccepted + severityRejected > 0 
                    ? (severityAccepted / (severityAccepted + severityRejected)) * 100 
                    : 0,
                acceptanceRate: (severityAccepted / severityTotal) * 100,
            };
        }
    }

    // Calculate by language
    const byLanguage: Record<string, any> = {};
    const languages = [...new Set(issues.map(i => i.language))];
    
    for (const language of languages) {
        const langIssues = issues.filter(i => i.language === language);
        const langTotal = langIssues.length;
        const langAccepted = langIssues.filter(i => i.userFeedback === 'accepted').length;
        const langRejected = langIssues.filter(i => i.userFeedback === 'rejected').length;
        
        if (langTotal > 0) {
            byLanguage[language] = {
                total: langTotal,
                accepted: langAccepted,
                rejected: langRejected,
                modified: langIssues.filter(i => i.userFeedback === 'modified').length,
                precision: langAccepted + langRejected > 0 
                    ? (langAccepted / (langAccepted + langRejected)) * 100 
                    : 0,
                acceptanceRate: (langAccepted / langTotal) * 100,
            };
        }
    }

    // Confidence calibration
    // Group by confidence ranges and calculate acceptance rate for each
    const confidenceRanges = [
        { min: 0, max: 50, label: 'Low (0-50)' },
        { min: 51, max: 70, label: 'Medium (51-70)' },
        { min: 71, max: 85, label: 'High (71-85)' },
        { min: 86, max: 100, label: 'Very High (86-100)' },
    ];

    const confidenceCalibration = confidenceRanges.map(range => {
        const rangeIssues = issues.filter(i => {
            const conf = i.review.confidenceScore;
            return conf >= range.min && conf <= range.max;
        });
        const rangeTotal = rangeIssues.length;
        const rangeAccepted = rangeIssues.filter(i => i.userFeedback === 'accepted').length;
        
        return {
            range: range.label,
            total: rangeTotal,
            accepted: rangeAccepted,
            acceptanceRate: rangeTotal > 0 ? (rangeAccepted / rangeTotal) * 100 : 0,
        };
    }).filter(r => r.total > 0); // Only include ranges with data

    return {
        overall: {
            totalIssues,
            accepted,
            rejected,
            modified,
            precision: Math.round(precision * 100) / 100,
            acceptanceRate: Math.round(acceptanceRate * 100) / 100,
            falsePositiveRate: Math.round(falsePositiveRate * 100) / 100,
        },
        bySeverity,
        byLanguage,
        confidenceCalibration,
    };
};