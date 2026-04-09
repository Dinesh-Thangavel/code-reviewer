/**
 * Test Generator Controller
 * Handles test generation requests
 */

import { Request, Response } from 'express';
import { generateTests, analyzeTestCoverage } from '../services/testGenerator';

/**
 * Generate tests for code
 */
export const generateTestsController = async (req: Request, res: Response) => {
    try {
        const { code, language, framework, existingTests, functionName } = req.body;

        if (!code || !language) {
            return res.status(400).json({ error: 'code and language are required' });
        }

        const tests = await generateTests({
            code,
            language,
            framework,
            existingTests,
            functionName,
        });

        res.json({
            success: true,
            tests,
        });
    } catch (error: any) {
        console.error('Error generating tests:', error);
        res.status(500).json({
            error: 'Failed to generate tests',
            message: error.message,
        });
    }
};

/**
 * Analyze test coverage
 */
export const analyzeCoverageController = async (req: Request, res: Response) => {
    try {
        const { code, tests, language } = req.body;

        if (!code || !tests || !language) {
            return res.status(400).json({ error: 'code, tests, and language are required' });
        }

        const analysis = await analyzeTestCoverage(code, tests, language);

        res.json({
            success: true,
            analysis,
        });
    } catch (error: any) {
        console.error('Error analyzing test coverage:', error);
        res.status(500).json({
            error: 'Failed to analyze test coverage',
            message: error.message,
        });
    }
};
