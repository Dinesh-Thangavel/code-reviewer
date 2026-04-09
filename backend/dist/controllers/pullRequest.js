"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPullRequestById = exports.getPullRequests = void 0;
const db_1 = __importDefault(require("../db"));
const jwt_1 = require("../utils/jwt");
const getPullRequests = async (req, res) => {
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
        const { status, risk, repo, search, page = '1', limit = '20' } = req.query;
        const pageNum = parseInt(page) || 1;
        const pageSize = parseInt(limit) || 20;
        const skip = (pageNum - 1) * pageSize;
        const where = {};
        // Filter by user's repositories only
        if (userId) {
            where.repository = {
                userId: userId,
            };
        }
        else {
            // If no valid user, return empty
            return res.json({ pullRequests: [], total: 0, page: pageNum, totalPages: 0 });
        }
        // Filters
        if (status && status !== 'all') {
            const statusMap = {
                'Reviewing': 'OPEN',
                'Completed': 'MERGED',
                'Waiting': 'OPEN',
                'Failed': 'CLOSED',
            };
            where.status = statusMap[status] || status;
        }
        if (risk && risk !== 'all') {
            where.riskLevel = risk;
        }
        if (repo && repo !== 'all') {
            // Combine with existing userId filter
            where.repository = {
                ...where.repository,
                fullName: { contains: repo },
            };
        }
        if (search) {
            // Combine search with userId filter
            where.AND = [
                where.repository, // Keep the userId filter
                {
                    OR: [
                        { title: { contains: search } },
                        { author: { contains: search } },
                        { repository: { fullName: { contains: search } } },
                    ],
                },
            ];
            // Remove the repository filter from top level since it's now in AND
            delete where.repository;
        }
        const [prs, total] = await Promise.all([
            db_1.default.pullRequest.findMany({
                where,
                include: {
                    repository: true,
                    reviews: {
                        include: {
                            issues: {
                                select: {
                                    id: true,
                                    severity: true,
                                    fixStatus: true,
                                },
                            },
                        },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
            }),
            db_1.default.pullRequest.count({ where }),
        ]);
        const response = prs.map((pr) => {
            const latestReview = pr.reviews[0];
            const issueCount = latestReview ? latestReview.issues.length : 0;
            const fixedCount = latestReview
                ? latestReview.issues.filter((i) => i.fixStatus === 'APPLIED').length
                : 0;
            // Map DB status to frontend status
            let frontendStatus = 'Waiting';
            if (pr.status === 'OPEN') {
                frontendStatus = latestReview
                    ? (latestReview.status === 'COMPLETED' ? 'Completed' : latestReview.status === 'FAILED' ? 'Failed' : 'Reviewing')
                    : 'Waiting';
            }
            else if (pr.status === 'MERGED') {
                frontendStatus = 'Completed';
            }
            else {
                frontendStatus = 'Completed';
            }
            return {
                id: pr.id,
                number: pr.number,
                title: pr.title,
                repo: pr.repository.fullName,
                author: pr.author,
                status: frontendStatus,
                risk: pr.riskLevel,
                issues: issueCount,
                fixedIssues: fixedCount,
                lastRun: latestReview?.createdAt || pr.createdAt,
                reviewId: latestReview?.id || null,
            };
        });
        res.json({
            data: response,
            pagination: {
                page: pageNum,
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    }
    catch (error) {
        console.error('Error fetching PRs:', error);
        res.status(500).json({ error: 'Failed to fetch PRs' });
    }
};
exports.getPullRequests = getPullRequests;
const getPullRequestById = async (req, res) => {
    const id = req.params.id;
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const requesterId = (0, jwt_1.getUserIdFromToken)(token);
        if (!requesterId) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        const pr = await db_1.default.pullRequest.findUnique({
            where: { id },
            include: {
                repository: true,
                reviews: {
                    include: {
                        issues: {
                            orderBy: { lineNumber: 'asc' },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!pr) {
            res.status(404).json({ error: 'Pull Request not found' });
            return;
        }
        if (pr.repository.userId && pr.repository.userId !== requesterId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const latestReview = pr.reviews[0];
        // Build language breakdown from issues
        const langMap = {};
        if (latestReview) {
            for (const issue of latestReview.issues) {
                if (!langMap[issue.language]) {
                    langMap[issue.language] = { files: new Set(), lines: 0 };
                }
                langMap[issue.language].files.add(issue.filePath);
                langMap[issue.language].lines++;
            }
        }
        const totalFiles = new Set(latestReview?.issues.map((i) => i.filePath) || []).size;
        const languageBreakdown = Object.entries(langMap).map(([language, data]) => ({
            language,
            files: data.files.size,
            lines: data.lines,
            percentage: totalFiles > 0 ? Math.round((data.files.size / totalFiles) * 100) : 0,
        }));
        res.json({
            id: pr.id,
            number: pr.number,
            title: pr.title,
            author: pr.author,
            repo: pr.repository.fullName,
            repoId: pr.repository.id,
            status: pr.status,
            riskLevel: pr.riskLevel,
            baseBranch: pr.baseBranch || 'main',
            headSha: pr.headSha,
            reviewId: latestReview?.id || null,
            summary: latestReview?.summary || 'No review generated yet.',
            confidenceScore: latestReview?.confidenceScore || 0,
            reviewStatus: latestReview?.status || 'PENDING',
            filesChanged: latestReview?.filesChanged || totalFiles,
            languageBreakdown,
            issues: latestReview?.issues.map((issue) => {
                // Parse alternativeFixes if it exists
                let alternativeFixes = [];
                if (issue.alternativeFixes) {
                    try {
                        alternativeFixes = JSON.parse(issue.alternativeFixes);
                    }
                    catch (e) {
                        console.error('Error parsing alternativeFixes:', e);
                    }
                }
                return {
                    id: issue.id,
                    severity: issue.severity,
                    file: issue.filePath,
                    line: issue.lineNumber,
                    title: issue.title,
                    description: issue.description,
                    suggestedFix: issue.suggestedFix,
                    alternativeFixes: alternativeFixes,
                    language: issue.language,
                    fixStatus: issue.fixStatus,
                    appliedAt: issue.appliedAt,
                    commitSha: issue.commitSha,
                    fixBranch: issue.fixBranch,
                };
            }) || [],
            reviews: pr.reviews.map((r) => ({
                id: r.id,
                status: r.status,
                confidenceScore: r.confidenceScore,
                riskLevel: r.riskLevel,
                issueCount: r.issues.length,
                createdAt: r.createdAt,
            })),
            createdAt: pr.createdAt,
            updatedAt: pr.updatedAt,
        });
    }
    catch (error) {
        console.error(`Error fetching PR ${id}:`, error);
        res.status(500).json({ error: 'Failed to fetch PR details' });
    }
};
exports.getPullRequestById = getPullRequestById;
