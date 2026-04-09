/**
 * Docstring Generator Controller
 * Handles docstring generation requests
 */

import { Request, Response } from 'express';
import { generateDocstring, generateFileDocstrings } from '../services/docstringGenerator';

/**
 * Generate docstring for code
 */
export const generateDocstringController = async (req: Request, res: Response) => {
    try {
        const { code, language, format, functionName, className } = req.body;

        if (!code || !language || !format) {
            return res.status(400).json({ error: 'code, language, and format are required' });
        }

        const docstring = await generateDocstring({
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
    } catch (error: any) {
        console.error('Error generating docstring:', error);
        res.status(500).json({
            error: 'Failed to generate docstring',
            message: error.message,
        });
    }
};

/**
 * Generate docstrings for entire file
 */
export const generateFileDocstringsController = async (req: Request, res: Response) => {
    try {
        const { fileContent, language, format } = req.body;

        if (!fileContent || !language || !format) {
            return res.status(400).json({ error: 'fileContent, language, and format are required' });
        }

        const docstrings = await generateFileDocstrings(fileContent, language, format);

        res.json({
            success: true,
            docstrings,
        });
    } catch (error: any) {
        console.error('Error generating file docstrings:', error);
        res.status(500).json({
            error: 'Failed to generate file docstrings',
            message: error.message,
        });
    }
};
