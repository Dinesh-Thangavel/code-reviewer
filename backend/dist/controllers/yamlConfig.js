"use strict";
/**
 * YAML Configuration Controller
 * Handles repository YAML configuration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultYaml = exports.updateYamlConfig = exports.getRepositoryConfig = void 0;
const yamlConfig_1 = require("../services/yamlConfig");
const js_yaml_1 = __importDefault(require("js-yaml"));
const db_1 = __importDefault(require("../db"));
/**
 * Get repository configuration (merged with YAML if exists)
 */
const getRepositoryConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const repo = await db_1.default.repository.findUnique({
            where: { id: id },
        });
        if (!repo) {
            return res.status(404).json({ error: 'Repository not found' });
        }
        let yamlConfig = null;
        if (repo.configYaml) {
            try {
                yamlConfig = (0, yamlConfig_1.parseYamlConfig)(repo.configYaml);
            }
            catch (error) {
                console.error('Error parsing YAML config:', error);
            }
        }
        const merged = (0, yamlConfig_1.mergeConfigs)({
            strictness: repo.strictness,
            autoReview: repo.autoReview,
            languages: repo.languages ? JSON.parse(repo.languages) : [],
            ignorePaths: repo.ignorePaths ? JSON.parse(repo.ignorePaths) : [],
        }, yamlConfig || undefined);
        res.json({
            success: true,
            config: merged,
            yamlConfig: repo.configYaml,
            hasYaml: !!repo.configYaml,
        });
    }
    catch (error) {
        console.error('Error getting repository config:', error);
        res.status(500).json({ error: 'Failed to get repository configuration' });
    }
};
exports.getRepositoryConfig = getRepositoryConfig;
/**
 * Update repository YAML configuration
 */
const updateYamlConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const { yamlContent } = req.body;
        if (!yamlContent) {
            return res.status(400).json({ error: 'YAML content is required' });
        }
        // Validate YAML
        const validation = (0, yamlConfig_1.validateConfig)(js_yaml_1.default.load(yamlContent));
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Invalid YAML configuration',
                errors: validation.errors,
            });
        }
        // Parse to ensure it's valid
        const config = (0, yamlConfig_1.parseYamlConfig)(yamlContent);
        // Update repository
        await db_1.default.repository.update({
            where: { id: id },
            data: { configYaml: yamlContent },
        });
        res.json({
            success: true,
            message: 'YAML configuration updated',
            config,
        });
    }
    catch (error) {
        console.error('Error updating YAML config:', error);
        res.status(500).json({
            error: 'Failed to update YAML configuration',
            message: error.message,
        });
    }
};
exports.updateYamlConfig = updateYamlConfig;
/**
 * Get default YAML template
 */
const getDefaultYaml = async (_req, res) => {
    try {
        const defaultYaml = (0, yamlConfig_1.generateDefaultYaml)();
        res.json({
            success: true,
            yaml: defaultYaml,
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to generate default YAML' });
    }
};
exports.getDefaultYaml = getDefaultYaml;
