"use strict";
/**
 * YAML Configuration Parser
 * Supports .ai-review.yml configuration files
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = exports.mergeConfigs = exports.generateDefaultYaml = exports.parseYamlConfig = void 0;
const js_yaml_1 = __importDefault(require("js-yaml"));
const zod_1 = require("zod");
// Configuration schema
const ConfigSchema = zod_1.z.object({
    version: zod_1.z.string().optional().default('1.0'),
    strictness: zod_1.z.enum(['RELAXED', 'BALANCED', 'STRICT']).optional(),
    autoReview: zod_1.z.boolean().optional(),
    languages: zod_1.z.array(zod_1.z.string()).optional(),
    ignorePaths: zod_1.z.array(zod_1.z.string()).optional(),
    rules: zod_1.z.object({
        critical: zod_1.z.object({
            enabled: zod_1.z.boolean().optional().default(true),
            customRules: zod_1.z.array(zod_1.z.string()).optional(),
        }).optional(),
        security: zod_1.z.object({
            enabled: zod_1.z.boolean().optional().default(true),
            customRules: zod_1.z.array(zod_1.z.string()).optional(),
        }).optional(),
        performance: zod_1.z.object({
            enabled: zod_1.z.boolean().optional().default(true),
            customRules: zod_1.z.array(zod_1.z.string()).optional(),
        }).optional(),
        quality: zod_1.z.object({
            enabled: zod_1.z.boolean().optional().default(true),
            customRules: zod_1.z.array(zod_1.z.string()).optional(),
        }).optional(),
        style: zod_1.z.object({
            enabled: zod_1.z.boolean().optional().default(false),
            customRules: zod_1.z.array(zod_1.z.string()).optional(),
        }).optional(),
    }).optional(),
    review: zod_1.z.object({
        triggers: zod_1.z.array(zod_1.z.enum(['pull_request', 'push', 'manual'])).optional().default(['pull_request']),
        maxFiles: zod_1.z.number().optional().default(25),
        maxFileSize: zod_1.z.number().optional().default(10000), // in characters
    }).optional(),
    fixes: zod_1.z.object({
        // NOTE: autoApply is NOT implemented - all fixes require manual approval
        // This field is kept for future compatibility but is currently ignored
        autoApply: zod_1.z.boolean().optional().default(false),
        requireApproval: zod_1.z.boolean().optional().default(true), // Always true - fixes require manual approval
        createPR: zod_1.z.boolean().optional().default(true),
    }).optional(),
    tests: zod_1.z.object({
        generate: zod_1.z.boolean().optional().default(false),
        coverageThreshold: zod_1.z.number().optional().default(80),
    }).optional(),
    documentation: zod_1.z.object({
        generate: zod_1.z.boolean().optional().default(false),
        format: zod_1.z.enum(['jsdoc', 'tsdoc', 'python']).optional().default('jsdoc'),
    }).optional(),
});
const DEFAULT_CONFIG = {
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
const parseYamlConfig = (yamlContent) => {
    try {
        const parsed = js_yaml_1.default.load(yamlContent);
        const validated = ConfigSchema.parse(parsed);
        return { ...DEFAULT_CONFIG, ...validated };
    }
    catch (error) {
        console.error('Error parsing YAML config:', error);
        throw new Error(`Invalid YAML configuration: ${error.message}`);
    }
};
exports.parseYamlConfig = parseYamlConfig;
/**
 * Generate default YAML configuration
 */
const generateDefaultYaml = () => {
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
    return js_yaml_1.default.dump(defaultConfig, { indent: 2 });
};
exports.generateDefaultYaml = generateDefaultYaml;
/**
 * Merge repository config with YAML config
 */
const mergeConfigs = (repoConfig, yamlConfig) => {
    const base = yamlConfig || DEFAULT_CONFIG;
    return {
        ...base,
        strictness: repoConfig.strictness || base.strictness,
        autoReview: repoConfig.autoReview ?? base.autoReview,
        languages: repoConfig.languages?.length ? repoConfig.languages : base.languages,
        ignorePaths: repoConfig.ignorePaths?.length ? repoConfig.ignorePaths : base.ignorePaths,
    };
};
exports.mergeConfigs = mergeConfigs;
/**
 * Validate configuration
 */
const validateConfig = (config) => {
    try {
        ConfigSchema.parse(config);
        return { valid: true };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                valid: false,
                errors: error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
            };
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { valid: false, errors: [errorMessage] };
    }
};
exports.validateConfig = validateConfig;
