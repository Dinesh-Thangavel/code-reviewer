/**
 * Docstring Generation Service
 * Generates documentation for functions and classes
 */

import { ollamaChat } from '../ai/ollamaClient';

export type DocstringFormat = 'jsdoc' | 'tsdoc' | 'python' | 'java' | 'go' | 'rust';

export interface DocstringOptions {
    code: string;
    language: string;
    format: DocstringFormat;
    functionName?: string;
    className?: string;
}

/**
 * Generate docstring for a function or class
 */
export const generateDocstring = async (options: DocstringOptions): Promise<string> => {
    const { code, language, format, functionName, className } = options;

    const formatExamples: Record<DocstringFormat, string> = {
        jsdoc: `/**
 * Description of the function
 * @param {type} paramName - Description of parameter
 * @returns {type} Description of return value
 * @example
 * const result = functionName(param);
 */`,
        tsdoc: `/**
 * Description of the function
 * @param paramName - Description of parameter
 * @returns Description of return value
 */`,
        python: `"""
Description of the function

Args:
    param_name: Description of parameter

Returns:
    Description of return value
"""`,
        java: `/**
 * Description of the function
 * @param paramName Description of parameter
 * @return Description of return value
 */`,
        go: `// FunctionName describes what the function does
// paramName: description of parameter
// Returns: description of return value`,
        rust: `/// Description of the function
/// 
/// # Arguments
/// * param_name - Description of parameter
/// 
/// # Returns
/// Description of return value`,
    };

    const example = formatExamples[format] || formatExamples.jsdoc;

    const prompt = `
Generate a ${format} docstring for the following ${language} code.

**Code**:
\`\`\`${language}
${code}
\`\`\`

${functionName ? `**Function Name**: ${functionName}` : ''}
${className ? `**Class Name**: ${className}` : ''}

**Format Example**:
\`\`\`
${example}
\`\`\`

**Requirements**:
1. Provide clear, concise description
2. Document all parameters with types and descriptions
3. Document return value
4. Include examples if helpful
5. Follow ${format} format exactly
6. Be specific and helpful

**Output**: Return only the docstring, no explanations or code blocks.
`;

    try {
        const response = await ollamaChat(
            [
                {
                    role: 'system',
                    content: `You are a documentation expert. Generate high-quality ${format} docstrings.`,
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            {
                temperature: 0.3,
                format: '', // Plain text
            }
        );

        // Clean up response
        let docstring = response.trim();
        
        // Remove code block markers if present
        if (docstring.startsWith('```')) {
            const lines = docstring.split('\n');
            if (lines[0].startsWith('```')) {
                lines.shift();
            }
            if (lines[lines.length - 1].trim() === '```') {
                lines.pop();
            }
            docstring = lines.join('\n');
        }

        return docstring.trim();
    } catch (error: any) {
        throw new Error(`Failed to generate docstring: ${error.message}`);
    }
};

/**
 * Generate docstring for multiple functions in a file
 */
export const generateFileDocstrings = async (
    fileContent: string,
    language: string,
    format: DocstringFormat
): Promise<Array<{ functionName: string; docstring: string; lineNumber: number }>> => {
    const prompt = `
Analyze the following ${language} file and generate ${format} docstrings for all functions and classes.

**File Content**:
\`\`\`${language}
${fileContent}
\`\`\`

Return a JSON array where each item has:
- functionName: name of the function/class
- docstring: the generated docstring
- lineNumber: line number where the function/class starts

Return only valid JSON, no markdown.
`;

    try {
        const response = await ollamaChat(
            [
                {
                    role: 'system',
                    content: `You are a documentation expert. Generate ${format} docstrings for all functions and classes.`,
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            {
                temperature: 0.3,
                format: 'json',
            }
        );

        // Parse JSON
        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.slice(7);
        }
        if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.slice(3);
        }
        if (cleanResponse.endsWith('```')) {
            cleanResponse = cleanResponse.slice(0, -3);
        }
        cleanResponse = cleanResponse.trim();

        return JSON.parse(cleanResponse);
    } catch (error: any) {
        console.error('Docstring generation error:', error);
        return [];
    }
};
