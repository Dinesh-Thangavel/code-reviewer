"use strict";
/**
 * Test Generator Controller
 * Handles test generation requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeCoverageController = exports.generateTestsController = void 0;
const testGenerator_1 = require("../services/testGenerator");
/**
 * Generate tests for code
 */
const generateTestsController = async (req, res) => {
    try {
        const { code, language, framework, existingTests, functionName } = req.body;
        if (!code || !language) {
            return res.status(400).json({ error: 'code and language are required' });
        }
        const tests = await (0, testGenerator_1.generateTests)({
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
    }
    catch (error) {
        console.error('Error generating tests:', error);
        res.status(500).json({
            error: 'Failed to generate tests',
            message: error.message,
        });
    }
};
exports.generateTestsController = generateTestsController;
/**
 * Analyze test coverage
 */
const analyzeCoverageController = async (req, res) => {
    try {
        const { code, tests, language } = req.body;
        if (!code || !tests || !language) {
            return res.status(400).json({ error: 'code, tests, and language are required' });
        }
        const analysis = await (0, testGenerator_1.analyzeTestCoverage)(code, tests, language);
        res.json({
            success: true,
            analysis,
        });
    }
    catch (error) {
        console.error('Error analyzing test coverage:', error);
        res.status(500).json({
            error: 'Failed to analyze test coverage',
            message: error.message,
        });
    }
};
exports.analyzeCoverageController = analyzeCoverageController;
