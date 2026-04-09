"use strict";
/**
 * Docstring Generator Controller
 * Handles docstring generation requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFileDocstringsController = exports.generateDocstringController = void 0;
const docstringGenerator_1 = require("../services/docstringGenerator");
/**
 * Generate docstring for code
 */
const generateDocstringController = async (req, res) => {
    try {
        const { code, language, format, functionName, className } = req.body;
        if (!code || !language || !format) {
            return res.status(400).json({ error: 'code, language, and format are required' });
        }
        const docstring = await (0, docstringGenerator_1.generateDocstring)({
            code,
            language,
            format,
            functionName,
            className,
        });
        res.json({
            success: true,
            docstring,
        });
    }
    catch (error) {
        console.error('Error generating docstring:', error);
        res.status(500).json({
            error: 'Failed to generate docstring',
            message: error.message,
        });
    }
};
exports.generateDocstringController = generateDocstringController;
/**
 * Generate docstrings for entire file
 */
const generateFileDocstringsController = async (req, res) => {
    try {
        const { fileContent, language, format } = req.body;
        if (!fileContent || !language || !format) {
            return res.status(400).json({ error: 'fileContent, language, and format are required' });
        }
        const docstrings = await (0, docstringGenerator_1.generateFileDocstrings)(fileContent, language, format);
        res.json({
            success: true,
            docstrings,
        });
    }
    catch (error) {
        console.error('Error generating file docstrings:', error);
        res.status(500).json({
            error: 'Failed to generate file docstrings',
            message: error.message,
        });
    }
};
exports.generateFileDocstringsController = generateFileDocstringsController;
