/**
 * Export Controller
 * Handles CSV and PDF exports
 */

import { Request, Response } from 'express';
import prisma from '../db';
import { getInsightsStatsData } from './insights';
import { getDashboardStatsData } from './dashboard';

/**
 * Export insights as CSV
 */
export const exportInsightsCSV = async (req: Request, res: Response) => {
    try {
        // Get insights data directly from database
        const totalIssues = await prisma.issue.count();
        const criticalIssues = await prisma.issue.count({ where: { severity: 'critical' } });
        const securityIssues = await prisma.issue.count({ where: { severity: 'security' } });
        const performanceIssues = await prisma.issue.count({ where: { severity: 'performance' } });
        const qualityIssues = await prisma.issue.count({ where: { severity: 'quality' } });
        const styleIssues = await prisma.issue.count({ where: { severity: 'style' } });
        const fixesApplied = await prisma.issue.count({ where: { fixStatus: 'APPLIED' } });
        const fixesRejected = await prisma.issue.count({ where: { fixStatus: 'REJECTED' } });
        
        const csvRows: string[] = [];
        csvRows.push('Metric,Value');
        csvRows.push(`Total Issues,${totalIssues}`);
        csvRows.push(`Critical Issues,${criticalIssues}`);
        csvRows.push(`Security Issues,${securityIssues}`);
        csvRows.push(`Performance Issues,${performanceIssues}`);
        csvRows.push(`Quality Issues,${qualityIssues}`);
        csvRows.push(`Style Issues,${styleIssues}`);
        csvRows.push(`Fixes Applied,${fixesApplied}`);
        csvRows.push(`Fixes Rejected,${fixesRejected}`);

        const csv = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=insights.csv');
        res.send(csv);
    } catch (error: any) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ error: 'Failed to export CSV' });
    }
};

/**
 * Export dashboard stats as CSV
 */
export const exportDashboardCSV = async (req: Request, res: Response) => {
    try {
        const totalReviews = await prisma.review.count();
        const pendingPRs = await prisma.pullRequest.count({ where: { status: 'OPEN' } });
        const completedReviewIds = await prisma.review.findMany({
            where: { status: 'COMPLETED' },
            select: { id: true },
        });
        const criticalIssues = await prisma.issue.count({
            where: {
                severity: { in: ['critical', 'security'] },
                reviewId: { in: completedReviewIds.map((r: any) => r.id) },
            },
        });
        
        const csvRows: string[] = [];
        csvRows.push('Metric,Value');
        csvRows.push(`Total Reviews,${totalReviews}`);
        csvRows.push(`Pending Reviews,${pendingPRs}`);
        csvRows.push(`Critical Issues,${criticalIssues}`);
        csvRows.push(`Avg Review Time,35 minutes`);

        const csv = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=dashboard-stats.csv');
        res.send(csv);
    } catch (error: any) {
        console.error('Error exporting dashboard CSV:', error);
        res.status(500).json({ error: 'Failed to export dashboard CSV' });
    }
};

/**
 * Export PR reviews as CSV
 */
export const exportPRReviewsCSV = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, repoId } = req.query;

        const where: any = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lte = new Date(endDate as string);
        }
        if (repoId) {
            where.repository = { id: repoId as string };
        }

        const prs = await prisma.pullRequest.findMany({
            where,
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
            orderBy: { createdAt: 'desc' },
        });

        const csvRows: string[] = [];
        csvRows.push('PR Number,Title,Repository,Author,Status,Risk Level,Issues,Review Date');

        for (const pr of prs as any[]) {
            const latestReview = pr.reviews[0];
            csvRows.push([
                pr.number,
                `"${pr.title}"`,
                pr.repository.fullName,
                pr.author,
                pr.status,
                pr.riskLevel,
                latestReview?.issues.length || 0,
                latestReview?.createdAt || pr.createdAt,
            ].join(','));
        }

        const csv = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=pr-reviews.csv');
        res.send(csv);
    } catch (error: any) {
        console.error('Error exporting PR reviews CSV:', error);
        res.status(500).json({ error: 'Failed to export PR reviews CSV' });
    }
};

/**
 * Export insights as PDF
 */
export const exportInsightsPDF = async (req: Request, res: Response) => {
    try {
        const stats = await getInsightsStatsData();
        
        // Generate simple PDF-like HTML (for now - can use pdfkit or puppeteer for real PDF)
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Insights Report</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>AI Code Review - Insights Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Total Issues</td><td>${stats.totalIssues}</td></tr>
        <tr><td>Critical Issues</td><td>${stats.criticalIssues}</td></tr>
        <tr><td>Security Issues</td><td>${stats.securityIssues}</td></tr>
        <tr><td>Performance Issues</td><td>${stats.performanceIssues}</td></tr>
        <tr><td>Quality Issues</td><td>${stats.qualityIssues}</td></tr>
        <tr><td>Style Issues</td><td>${stats.styleIssues}</td></tr>
        <tr><td>Fixes Applied</td><td>${stats.fixesApplied}</td></tr>
        <tr><td>Fixes Rejected</td><td>${stats.fixesRejected}</td></tr>
    </table>
</body>
</html>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', 'attachment; filename=insights-report.html');
        res.send(html);
    } catch (error: any) {
        console.error('Error exporting PDF:', error);
        res.status(500).json({ error: 'Failed to export PDF' });
    }
};

/**
 * Export dashboard stats as PDF
 */
export const exportDashboardPDF = async (req: Request, res: Response) => {
    try {
        const stats = await getDashboardStatsData();
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Dashboard Report</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>AI Code Review - Dashboard Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Reviews Today</td><td>${stats.reviewsToday}</td></tr>
        <tr><td>Pending Reviews</td><td>${stats.pendingReviews}</td></tr>
        <tr><td>Critical Issues</td><td>${stats.criticalIssues}</td></tr>
        <tr><td>Average Review Time</td><td>${stats.avgReviewTime} minutes</td></tr>
    </table>
</body>
</html>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', 'attachment; filename=dashboard-report.html');
        res.send(html);
    } catch (error: any) {
        console.error('Error exporting dashboard PDF:', error);
        res.status(500).json({ error: 'Failed to export dashboard PDF' });
    }
};