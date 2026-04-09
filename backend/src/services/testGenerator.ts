/**
 * Test Generation Service
 * Generates unit tests for code changes
 */

import { ollamaChat } from '../ai/ollamaClient';

export interface TestGenerationOptions {
    code: string;
    language: string;
    framework?: string; // 'jest', 'mocha', 'pytest', etc.
    existingTests?: string;
    functionName?: string;
}

/**
 * Generate unit tests for a function or code block
 */
export const generateTests = async (options: TestGenerationOptions): Promise<string> => {
    const { code, language, framework, existingTests, functionName } = options;

    const frameworkInfo = framework || getDefaultFramework(language);

    const prompt = `
You are a test generation expert. Generate comprehensive unit tests for the following code.

**Language**: ${language}
**Framework**: ${frameworkInfo}
${functionName ? `**Function Name**: ${functionName}` : ''}

**Code to Test**:
\`\`\`${language}
${code}
\`\`\`

${existingTests ? `**Existing Tests** (use as reference):
\`\`\`${language}
${existingTests}
\`\`\`
` : ''}

**Requirements**:
1. Generate comprehensive test cases covering:
   - Happy path scenarios
   - Edge cases
   - Error handling
   - Boundary conditions
2. Use appropriate testing framework for ${language}
3. Include descriptive test names
4. Add comments explaining test cases
5. Ensure good test coverage

**Output**: Return only the test code, no explanations.
`;

    try {
        const response = await ollamaChat(
            [
                {
                    role: 'system',
                    content: 'You are an expert at writing unit tests. Generate high-quality, comprehensive test code.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            {
                temperature: 0.3, // Lower temperature for more consistent test generation
                format: '', // Plain text
            }
        );

        return response.trim();
    } catch (error: any) {
        throw new Error(`Failed to generate tests: ${error.message}`);
    }
};

/**
 * Get default test framework for language
 */
const getDefaultFramework = (language: string): string => {
    const frameworks: Record<string, string> = {
        javascript: 'jest',
        typescript: 'jest',
        python: 'pytest',
        java: 'junit',
        go: 'testing',
        rust: 'cargo test',
        csharp: 'xunit',
        php: 'phpunit',
    };

    return frameworks[language.toLowerCase()] || 'jest';
};

/**
 * Analyze test coverage
 */
export const analyzeTestCoverage = async (
    code: string,
    tests: string,
    language: string
): Promise<{
    coverage: number;
    missingTests: string[];
    suggestions: string[];
}> => {
    const prompt = `
Analyze test coverage for the following code and tests.

**Code**:
\`\`\`${language}
${code}
\`\`\`

**Tests**:
\`\`\`${language}
${tests}
\`\`\`

Provide a JSON response with:
1. coverage: number (0-100)
2. missingTests: array of test case descriptions that are missing
3. suggestions: array of suggestions to improve test coverage

Return only valid JSON, no markdown.
`;

    try {
        const response = await ollamaChat(
            [
                {
                    role: 'system',
                    content: 'You are a test coverage analysis expert. Analyze test coverage and provide detailed feedback.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            {
                temperature: 0.2,
                format: 'json',
            }
        );

        // Parse JSON response
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

        const parsed = JSON.parse(cleanResponse);
        return {
            coverage: parsed.coverage || 0,
            missingTests: parsed.missingTests || [],
            suggestions: parsed.suggestions || [],
        };
    } catch (error: any) {
        console.error('Test coverage analysis error:', error);
        return {
            coverage: 0,
            missingTests: [],
            suggestions: ['Unable to analyze test coverage'],
        };
    }
};
