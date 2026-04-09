"use strict";
/**
 * Learning System
 * Learns from user feedback to improve suggestions
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImprovementSuggestions = exports.applyLearnedPreferences = exports.getLearnedPreferences = exports.recordFeedback = void 0;
const db_1 = __importDefault(require("../db"));
/**
 * Record user feedback for learning
 */
const recordFeedback = async (data) => {
    // Store feedback in issue record
    await db_1.default.issue.update({
        where: { id: data.issueId },
        data: {
            userFeedback: data.userFeedback,
            feedbackNote: data.feedbackNote,
        },
    });
    // Analyze patterns (simplified - in production, use ML)
    await analyzeFeedbackPatterns(data);
};
exports.recordFeedback = recordFeedback;
/**
 * Analyze feedback patterns to improve suggestions
 */
async function analyzeFeedbackPatterns(data) {
    // Get similar issues with feedback
    const similarIssues = await db_1.default.issue.findMany({
        where: {
            userFeedback: { not: null },
        },
        take: 100,
    });
    // Simple pattern matching:
    // - If user frequently rejects certain types of fixes, adjust suggestions
    // - If user modifies fixes in similar ways, learn the pattern
    // - Track which fix patterns are most accepted
    // In production, use:
    // - Machine learning models
    // - Pattern recognition
    // - Team-specific preferences
    // - Language-specific adjustments
    console.log(`[Learning] Analyzing feedback for issue ${data.issueId}`);
}
/**
 * Get learned preferences for a repository
 */
const getLearnedPreferences = async (repositoryId) => {
    const issues = await db_1.default.issue.findMany({
        where: {
            review: {
                pullRequest: {
                    repository: { id: repositoryId },
                },
            },
            userFeedback: { not: null },
        },
        select: {
            severity: true,
            language: true,
            userFeedback: true,
            feedbackNote: true,
        },
    });
    // Analyze patterns
    const preferences = {
        acceptedPatterns: [],
        rejectedPatterns: [],
        commonModifications: [],
    };
    // Group by feedback type
    const accepted = issues.filter(i => i.userFeedback === 'accepted');
    const rejected = issues.filter(i => i.userFeedback === 'rejected');
    const modified = issues.filter(i => i.userFeedback === 'modified');
    // Extract patterns (simplified)
    preferences.acceptedPatterns = accepted.map(i => ({
        severity: i.severity,
        language: i.language,
    }));
    preferences.rejectedPatterns = rejected.map(i => ({
        severity: i.severity,
        language: i.language,
        note: i.feedbackNote,
    }));
    return preferences;
};
exports.getLearnedPreferences = getLearnedPreferences;
/**
 * Apply learned preferences to improve fix suggestions
 */
const applyLearnedPreferences = (suggestedFix, preferences, context) => {
    // Analyze patterns and adjust suggestions
    const acceptedPatterns = preferences.acceptedPatterns || [];
    const rejectedPatterns = preferences.rejectedPatterns || [];
    // Check if this fix matches rejected patterns
    const isRejected = rejectedPatterns.some((pattern) => pattern.severity === context.severity &&
        pattern.language === context.language);
    if (isRejected) {
        // If this pattern is frequently rejected, add a note
        // In production, use ML to generate alternative suggestions
        console.log(`[Learning] Fix pattern frequently rejected for ${context.severity}/${context.language}`);
    }
    // Check if this matches accepted patterns
    const isAccepted = acceptedPatterns.some((pattern) => pattern.severity === context.severity &&
        pattern.language === context.language);
    if (isAccepted) {
        console.log(`[Learning] Fix pattern frequently accepted for ${context.severity}/${context.language}`);
    }
    // Return original fix (ML integration needed for actual modification)
    return suggestedFix;
};
exports.applyLearnedPreferences = applyLearnedPreferences;
/**
 * Get improvement suggestions based on feedback
 */
const getImprovementSuggestions = async (repositoryId) => {
    const preferences = await (0, exports.getLearnedPreferences)(repositoryId);
    const suggestions = [];
    if (preferences.rejectedPatterns.length > preferences.acceptedPatterns.length) {
        suggestions.push('Consider reviewing fix suggestions - many are being rejected');
    }
    if (preferences.acceptedPatterns.length > 0) {
        suggestions.push(`${preferences.acceptedPatterns.length} fix patterns are frequently accepted`);
    }
    return suggestions;
};
exports.getImprovementSuggestions = getImprovementSuggestions;
