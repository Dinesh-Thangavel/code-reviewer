"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewResponseSchema = void 0;
const zod_1 = require("zod");
exports.ReviewResponseSchema = zod_1.z.object({
    summary: zod_1.z.string(),
    riskLevel: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']),
    confidenceScore: zod_1.z.number().min(0).max(100),
    issues: zod_1.z.array(zod_1.z.object({
        severity: zod_1.z.enum(['critical', 'security', 'performance', 'quality', 'style']),
        file: zod_1.z.string(),
        line: zod_1.z.number(),
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        suggestedFix: zod_1.z.string().default(''), // Allow empty string but default to empty if missing
        alternativeFixes: zod_1.z.array(zod_1.z.string()).optional(), // Multiple fix options
        language: zod_1.z.string().default('plaintext'),
        category: zod_1.z.string().optional(), // e.g., 'async-handling', 'type-safety'
        cwe: zod_1.z.string().optional(), // CWE identifier if known
    })),
});
