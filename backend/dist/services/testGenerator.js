"use strict";
/**
 * Test Generation Service
 * Generates unit tests for code changes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeTestCoverage = exports.generateTests = void 0;
const ollamaClient_1 = require("../ai/ollamaClient");
/**
 * Generate unit tests for a function or code block
 */
const generateTests = async (options) => {
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
        const response = await (0, ollamaClient_1.ollamaChat)([
            {
                role: 'system',
                content: 'You are an expert at writing unit tests. Generate high-quality, comprehensive test code.',
            },
            {
                role: 'user',
                content: prompt,
            },
        ], {
            temperature: 0.3, // Lower temperature for more consistent test generation
            format: '', // Plain text
        });
        return response.trim();
    }
    catch (error) {
        throw new Error(`Failed to generate tests: ${error.message}`);
    }
};
exports.generateTests = generateTests;
/**
 * Get default test framework for language
 */
const getDefaultFramework = (language) => {
    const frameworks = {
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
const analyzeTestCoverage = async (code, tests, language) => {
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
        const response = await (0, ollamaClient_1.ollamaChat)([
            {
                role: 'system',
                content: 'You are a test coverage analysis expert. Analyze test coverage and provide detailed feedback.',
            },
            {
                role: 'user',
                content: prompt,
            },
        ], {
            temperature: 0.2,
            format: 'json',
        });
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
    }
    catch (error) {
        console.error('Test coverage analysis error:', error);
        return {
            coverage: 0,
            missingTests: [],
            suggestions: ['Unable to analyze test coverage'],
        };
    }
};
exports.analyzeTestCoverage = analyzeTestCoverage;
