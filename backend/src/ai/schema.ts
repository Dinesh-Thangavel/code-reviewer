import { z } from 'zod';

export const ReviewResponseSchema = z.object({
    summary: z.string(),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    confidenceScore: z.number().min(0).max(100),
    issues: z.array(
        z.object({
            severity: z.enum(['critical', 'security', 'performance', 'quality', 'style']),
            file: z.string(),
            line: z.number(),
            title: z.string(),
            description: z.string(),
            suggestedFix: z.string().default(''), // Allow empty string but default to empty if missing
            alternativeFixes: z.array(z.string()).optional(), // Multiple fix options
            language: z.string().default('plaintext'),
            category: z.string().optional(), // e.g., 'async-handling', 'type-safety'
            cwe: z.string().optional(), // CWE identifier if known
        })
    ),
});

export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;
export type ReviewIssue = ReviewResponse['issues'][number];
