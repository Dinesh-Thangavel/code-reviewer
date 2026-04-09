/**
 * Learning System
 * Learns from user feedback to improve suggestions
 */

import prisma from '../db';

export interface LearningData {
    issueId: string;
    userFeedback: 'accepted' | 'rejected' | 'modified';
    feedbackNote?: string;
    originalFix: string;
    appliedFix?: string;
}

/**
 * Record user feedback for learning
 */
export const recordFeedback = async (data: LearningData) => {
    // Store feedback in issue record
    await prisma.issue.update({
        where: { id: data.issueId },
        data: {
            userFeedback: data.userFeedback,
            feedbackNote: data.feedbackNote,
        },
    });

    // Analyze patterns (simplified - in production, use ML)
    await analyzeFeedbackPatterns(data);
};

/**
 * Analyze feedback patterns to improve suggestions
 */
async function analyzeFeedbackPatterns(data: LearningData) {
    // Get similar issues with feedback
    const similarIssues = await prisma.issue.findMany({
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
export const getLearnedPreferences = async (repositoryId: string) => {
    const issues = await prisma.issue.findMany({
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
    const preferences: Record<string, any> = {
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

/**
 * Apply learned preferences to improve fix suggestions
 */
export const applyLearnedPreferences = (
    suggestedFix: string,
    preferences: any,
    context: { severity: string; language: string }
): string => {
    // Analyze patterns and adjust suggestions
    const acceptedPatterns = preferences.acceptedPatterns || [];
    const rejectedPatterns = preferences.rejectedPatterns || [];
    
    // Check if this fix matches rejected patterns
    const isRejected = rejectedPatterns.some((pattern: any) => 
        pattern.severity === context.severity && 
        pattern.language === context.language
    );
    
    if (isRejected) {
        // If this pattern is frequently rejected, add a note
        // In production, use ML to generate alternative suggestions
        console.log(`[Learning] Fix pattern frequently rejected for ${context.severity}/${context.language}`);
    }
    
    // Check if this matches accepted patterns
    const isAccepted = acceptedPatterns.some((pattern: any) => 
        pattern.severity === context.severity && 
        pattern.language === context.language
    );
    
    if (isAccepted) {
        console.log(`[Learning] Fix pattern frequently accepted for ${context.severity}/${context.language}`);
    }
    
    // Return original fix (ML integration needed for actual modification)
    return suggestedFix;
};

/**
 * Get improvement suggestions based on feedback
 */
export const getImprovementSuggestions = async (repositoryId: string) => {
    const preferences = await getLearnedPreferences(repositoryId);
    
    const suggestions: string[] = [];
    
    if (preferences.rejectedPatterns.length > preferences.acceptedPatterns.length) {
        suggestions.push('Consider reviewing fix suggestions - many are being rejected');
    }
    
    if (preferences.acceptedPatterns.length > 0) {
        suggestions.push(`${preferences.acceptedPatterns.length} fix patterns are frequently accepted`);
    }
    
    return suggestions;
};
