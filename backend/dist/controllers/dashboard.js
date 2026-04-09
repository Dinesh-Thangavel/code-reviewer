"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = exports.getDashboardStatsData = void 0;
const db_1 = __importDefault(require("../db"));
const jwt_1 = require("../utils/jwt");
/**
 * Get dashboard stats data (service function)
 * @param userId - Optional user ID to filter by user's repositories
 */
const getDashboardStatsData = async (userId) => {
    // Build repository filter for user's repos
    const repoFilter = userId ? { repository: { userId } } : {};
    // Get today's date range (start of today to now)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    // Count reviews TODAY - filtered by user's repos and today's date
    const reviewsToday = await db_1.default.review.count({
        where: {
            pullRequest: repoFilter,
            createdAt: {
                gte: today,
                lte: now,
            },
        },
    });
    // Count total completed reviews - filtered by user's repos
    const completedReviewsCount = await db_1.default.review.count({
        where: {
            status: 'COMPLETED',
            pullRequest: repoFilter,
        },
    });
    // Count pending PRs - PRs that don't have a completed review yet (matching PR page logic)
    const allPRs = await db_1.default.pullRequest.findMany({
        where: userId ? { repository: { userId } } : {},
        include: {
            reviews: {
                orderBy: { createdAt: 'desc' },
                take: 1, // Get latest review
            },
        },
    });
    // Count PRs where latest review is not completed or doesn't exist
    const pendingPRs = allPRs.filter((pr) => {
        const latestReview = pr.reviews[0];
        // Pending if: no review exists, or latest review is not COMPLETED
        return !latestReview || latestReview.status !== 'COMPLETED';
    }).length;
    // Get all PRs with their latest reviews (matching PR detail page logic)
    const prsWithLatestReviews = await db_1.default.pullRequest.findMany({
        where: userId ? { repository: { userId } } : {},
        include: {
            reviews: {
                where: {
                    status: 'COMPLETED',
                },
                orderBy: { createdAt: 'desc' },
                take: 1, // Only get the latest completed review per PR
                include: {
                    issues: {
                        select: {
                            severity: true,
                        },
                    },
                },
            },
        },
    });
    // Count critical issues from latest completed review only (matching PR page logic)
    let criticalIssuesCount = 0;
    const issuesBySeverity = {};
    for (const pr of prsWithLatestReviews) {
        const latestCompletedReview = pr.reviews[0];
        if (latestCompletedReview) {
            // Count critical/security issues from this PR's latest review
            const criticalCount = latestCompletedReview.issues.filter((issue) => issue.severity === 'critical' || issue.severity === 'security').length;
            criticalIssuesCount += criticalCount;
            // Count all issues by severity from this PR's latest review
            latestCompletedReview.issues.forEach((issue) => {
                issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
            });
        }
    }
    // Calculate average review time from completed reviews
    const completedReviewsWithTiming = await db_1.default.review.findMany({
        where: {
            status: 'COMPLETED',
            pullRequest: repoFilter,
        },
        select: {
            createdAt: true,
            updatedAt: true,
        },
    });
    let avgReviewTime = 0;
    if (completedReviewsWithTiming.length > 0) {
        const totalTime = completedReviewsWithTiming.reduce((sum, review) => {
            const timeDiff = review.updatedAt.getTime() - review.createdAt.getTime();
            return sum + timeDiff;
        }, 0);
        avgReviewTime = Math.round(totalTime / completedReviewsWithTiming.length / 1000 / 60); // Convert to minutes
    }
    // Get recent PRs (last 5) - filtered by user's repos, ordered by most recent review
    const recentPRs = await db_1.default.pullRequest.findMany({
        where: userId ? { repository: { userId } } : {},
        include: {
            repository: true,
            reviews: {
                include: {
                    issues: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
    });
    const formattedRecentPRs = recentPRs.map((pr) => {
        const latestReview = pr.reviews[0];
        const issueCount = latestReview ? latestReview.issues.length : 0;
        return {
            id: pr.id,
            title: pr.title,
            repo: pr.repository.fullName,
            author: pr.author,
            status: pr.status === 'OPEN' ? 'Reviewing' : pr.status === 'MERGED' ? 'Completed' : 'Closed',
            risk: pr.riskLevel,
            issues: issueCount,
            lastRun: latestReview?.createdAt || pr.createdAt,
        };
    });
    // Weekly trend data (filtered by user's repos)
    const weeklyReviewTrend = await getWeeklyReviewTrend(userId);
    return {
        reviewsToday,
        completedReviews: completedReviewsCount,
        pendingReviews: pendingPRs,
        criticalIssues: criticalIssuesCount,
        avgReviewTime: avgReviewTime || 0,
        weeklyReviewTrend,
        issuesBySeverity,
        recentPRs: formattedRecentPRs,
    };
};
exports.getDashboardStatsData = getDashboardStatsData;
const getDashboardStats = async (req, res) => {
    try {
        // Get user ID from token
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userId;
        if (token) {
            const extractedUserId = (0, jwt_1.getUserIdFromToken)(token);
            if (extractedUserId) {
                userId = extractedUserId;
            }
        }
        // Get stats filtered by user's repositories
        const stats = await (0, exports.getDashboardStatsData)(userId);
        res.json(stats);
    }
    catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};
exports.getDashboardStats = getDashboardStats;
async function getWeeklyReviewTrend(userId) {
    try {
        // Build repository filter for user's repos
        const repoFilter = userId ? { repository: { userId } } : {};
        // Try to get real data from last 7 days
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const reviews = await db_1.default.review.findMany({
            where: {
                createdAt: { gte: sevenDaysAgo },
                pullRequest: repoFilter,
            },
            select: {
                createdAt: true,
                status: true,
                issues: {
                    select: { severity: true },
                },
            },
        });
        // Group by date
        const trend = {};
        // Initialize all 7 days with zeros
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const key = date.toISOString().split('T')[0];
            trend[key] = { reviews: 0, approved: 0, rejected: 0, issues: 0 };
        }
        // Populate with actual data
        for (const review of reviews) {
            const key = review.createdAt.toISOString().split('T')[0];
            if (trend[key]) {
                trend[key].reviews++;
                if (review.status === 'COMPLETED')
                    trend[key].approved++;
                if (review.status === 'FAILED')
                    trend[key].rejected++;
                trend[key].issues += review.issues?.length || 0;
            }
        }
        const trendData = Object.entries(trend).map(([date, data]) => ({
            date,
            ...data,
        }));
        // Return real data (even if all zeros) - no demo data fallback
        return trendData;
    }
    catch (error) {
        console.error('Error fetching weekly review trend:', error);
        // Return empty data instead of demo data
        const now = new Date();
        const trendData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            trendData.push({
                date: date.toISOString().split('T')[0],
                reviews: 0,
                approved: 0,
                rejected: 0,
                issues: 0,
            });
        }
        return trendData;
    }
}
