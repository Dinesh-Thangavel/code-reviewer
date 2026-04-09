/**
 * YAML Configuration Parser
 * Supports .ai-review.yml configuration files
 */

import yaml from 'js-yaml';
import { z, type ZodIssue } from 'zod';

// Configuration schema
const ConfigSchema = z.object({
    version: z.string().optional().default('1.0'),
    strictness: z.enum(['RELAXED', 'BALANCED', 'STRICT']).optional(),
    autoReview: z.boolean().optional(),
    languages: z.array(z.string()).optional(),
    ignorePaths: z.array(z.string()).optional(),
    rules: z.object({
        critical: z.object({
            enabled: z.boolean().optional().default(true),
            customRules: z.array(z.string()).optional(),
        }).optional(),
        security: z.object({
            enabled: z.boolean().optional().default(true),
            customRules: z.array(z.string()).optional(),
        }).optional(),
        performance: z.object({
            enabled: z.boolean().optional().default(true),
            customRules: z.array(z.string()).optional(),
        }).optional(),
        quality: z.object({
            enabled: z.boolean().optional().default(true),
            customRules: z.array(z.string()).optional(),
        }).optional(),
        style: z.object({
            enabled: z.boolean().optional().default(false),
            customRules: z.array(z.string()).optional(),
        }).optional(),
    }).optional(),
    review: z.object({
        triggers: z.array(z.enum(['pull_request', 'push', 'manual'])).optional().default(['pull_request']),
        maxFiles: z.number().optional().default(25),
        maxFileSize: z.number().optional().default(10000), // in characters
    }).optional(),
    fixes: z.object({
        // NOTE: autoApply is NOT implemented - all fixes require manual approval
        // This field is kept for future compatibility but is currently ignored
        autoApply: z.boolean().optional().default(false),
        requireApproval: z.boolean().optional().default(true), // Always true - fixes require manual approval
        createPR: z.boolean().optional().default(true),
    }).optional(),
    tests: z.object({
        generate: z.boolean().optional().default(false),
        coverageThreshold: z.number().optional().default(80),
    }).optional(),
    documentation: z.object({
        generate: z.boolean().optional().default(false),
        format: z.enum(['jsdoc', 'tsdoc', 'python']).optional().default('jsdoc'),
    }).optional(),
});

export type ReviewConfig = z.infer<typeof ConfigSchema>;

const DEFAULT_CONFIG: ReviewConfig = {
    version: '1.0',
    strictness: 'BALANCED',
    autoReview: true,
    languages: [],
    ignorePaths: [],
    rules: {
        critical: { enabled: true },
        security: { enabled: true },
        performance: { enabled: true },
        quality: { enabled: true },
        style: { enabled: false },
    },
    review: {
        triggers: ['pull_request'],
        maxFiles: 25,
        maxFileSize: 10000,
    },
    fixes: {
        // NOTE: autoApply is NOT implemented - all fixes require manual approval via API
        autoApply: false, // Always false - fixes require manual approval
        requireApproval: true, // Always true - cannot be disabled
        createPR: true,
    },
    tests: {
        generate: false,
        coverageThreshold: 80,
    },
    documentation: {
        generate: false,
        format: 'jsdoc',
    },
};

/**
 * Parse YAML configuration from string
 */
export const parseYamlConfig = (yamlContent: string): ReviewConfig => {
    try {
        const parsed = yaml.load(yamlContent) as any;
        const validated = ConfigSchema.parse(parsed);
        return { ...DEFAULT_CONFIG, ...validated };
    } catch (error: any) {
        console.error('Error parsing YAML config:', error);
        throw new Error(`Invalid YAML configuration: ${error.message}`);
    }
};

/**
 * Generate default YAML configuration
 */
export const generateDefaultYaml = (): string => {
    const defaultConfig = {
        version: '1.0',
        strictness: 'BALANCED',
        autoReview: true,
        languages: [],
        ignorePaths: ['node_modules/**', 'dist/**', '*.test.ts'],
        rules: {
            critical: { enabled: true },
            security: { enabled: true },
            performance: { enabled: true },
            quality: { enabled: true },
            style: { enabled: false },
        },
        review: {
            triggers: ['pull_request'],
            maxFiles: 25,
            maxFileSize: 10000,
        },
        fixes: {
            autoApply: false,
            requireApproval: true,
            createPR: true,
        },
        tests: {
            generate: false,
            coverageThreshold: 80,
        },
        documentation: {
            generate: false,
            format: 'jsdoc',
        },
    };

    return yaml.dump(defaultConfig, { indent: 2 });
};

/**
 * Merge repository config with YAML config
 */
export const mergeConfigs = (
    repoConfig: {
        strictness?: string;
        autoReview?: boolean;
        languages?: string[];
        ignorePaths?: string[];
    },
    yamlConfig?: ReviewConfig
): ReviewConfig => {
    const base = yamlConfig || DEFAULT_CONFIG;

    return {
        ...base,
        strictness: (repoConfig.strictness as any) || base.strictness,
        autoReview: repoConfig.autoReview ?? base.autoReview,
        languages: repoConfig.languages?.length ? repoConfig.languages : base.languages,
        ignorePaths: repoConfig.ignorePaths?.length ? repoConfig.ignorePaths : base.ignorePaths,
    };
};

/**
 * Validate configuration
 */
export const validateConfig = (config: any): { valid: boolean; errors?: string[] } => {
    try {
        ConfigSchema.parse(config);
        return { valid: true };
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return {
                valid: false,
                errors: error.issues.map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`),
            };
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { valid: false, errors: [errorMessage] };
    }
};
