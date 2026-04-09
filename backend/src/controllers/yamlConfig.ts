/**
 * YAML Configuration Controller
 * Handles repository YAML configuration
 */

import { Request, Response } from 'express';
import { parseYamlConfig, generateDefaultYaml, validateConfig, mergeConfigs } from '../services/yamlConfig';
import yaml from 'js-yaml';
import prisma from '../db';

/**
 * Get repository configuration (merged with YAML if exists)
 */
export const getRepositoryConfig = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const repo = await prisma.repository.findUnique({
            where: { id: id as string },
        });

        if (!repo) {
            return res.status(404).json({ error: 'Repository not found' });
        }

        let yamlConfig = null;
        if (repo.configYaml) {
            try {
                yamlConfig = parseYamlConfig(repo.configYaml);
            } catch (error: any) {
                console.error('Error parsing YAML config:', error);
            }
        }

        const merged = mergeConfigs(
            {
                strictness: repo.strictness,
                autoReview: repo.autoReview,
                languages: repo.languages ? JSON.parse(repo.languages) : [],
                ignorePaths: repo.ignorePaths ? JSON.parse(repo.ignorePaths) : [],
            },
            yamlConfig || undefined
        );

        res.json({
            success: true,
            config: merged,
            yamlConfig: repo.configYaml,
            hasYaml: !!repo.configYaml,
        });
    } catch (error: any) {
        console.error('Error getting repository config:', error);
        res.status(500).json({ error: 'Failed to get repository configuration' });
    }
};

/**
 * Update repository YAML configuration
 */
export const updateYamlConfig = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { yamlContent } = req.body;

        if (!yamlContent) {
            return res.status(400).json({ error: 'YAML content is required' });
        }

        // Validate YAML
        const validation = validateConfig(yaml.load(yamlContent) as any);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Invalid YAML configuration',
                errors: validation.errors,
            });
        }

        // Parse to ensure it's valid
        const config = parseYamlConfig(yamlContent);

        // Update repository
        await prisma.repository.update({
            where: { id: id as string },
            data: { configYaml: yamlContent },
        });

        res.json({
            success: true,
            message: 'YAML configuration updated',
            config,
        });
    } catch (error: any) {
        console.error('Error updating YAML config:', error);
        res.status(500).json({
            error: 'Failed to update YAML configuration',
            message: error.message,
        });
    }
};

/**
 * Get default YAML template
 */
export const getDefaultYaml = async (_req: Request, res: Response) => {
    try {
        const defaultYaml = generateDefaultYaml();
        res.json({
            success: true,
            yaml: defaultYaml,
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to generate default YAML' });
    }
};
