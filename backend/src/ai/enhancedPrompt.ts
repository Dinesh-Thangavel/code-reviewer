/**
 * Enhanced AI prompts with CodeRabbit-like features:
 * - Codebase context awareness
 * - Better issue detection
 * - Architectural insights
 * - Learning from patterns
 */

export interface CodebaseContext {
    relatedFiles?: string[];
    dependencies?: string[];
    patterns?: string[];
    recentChanges?: string[];
    filename?: string;
}

export const buildEnhancedReviewPrompt = (
    filePatch: string,
    language: string,
    rules: string[],
    context?: CodebaseContext
): string => {
    const contextSection = context ? `
**Codebase Context:**
${context.relatedFiles ? `- Related files: ${context.relatedFiles.join(', ')}` : ''}
${context.dependencies ? `- Dependencies: ${context.dependencies.join(', ')}` : ''}
${context.patterns ? `- Common patterns in codebase: ${context.patterns.join(', ')}` : ''}
${context.recentChanges ? `- Recent changes: ${context.recentChanges.join(', ')}` : ''}
` : '';

    const filename = context?.filename || 'file';
    
    return `Analyze this code diff and return JSON. You are an expert code reviewer.

**REQUIREMENTS:**
- Analyze the diff below
- Find issues (memory leaks, bugs, security, performance, code quality)
- Provide detailed explanations
- Provide code fixes
- Return ONLY valid JSON (no markdown, no code blocks)

**Language:** ${language}
**File:** ${filename}

**Review Rules for ${language}:**
${rules.map(rule => `- ${rule}`).join('\n')}
${contextSection}

**Code Diff to Analyze:**
\`\`\`diff
${filePatch}
\`\`\`

**HOW TO READ THE DIFF:**
- Lines with "@@" show line numbers (e.g., @@ -10,5 +10,6 @@ means line 10)
- Lines starting with "-" are REMOVED code
- Lines starting with "+" are ADDED code
- Other lines are context

**LOOK FOR THESE ISSUES:**

1. Memory issues (retain cycles, leaks, weak/strong references)
2. Optional handling (force unwraps, nil safety)
3. Performance (inefficient code, missing optimizations)
4. Logic errors (off-by-one, edge cases, race conditions)
5. Security (injection, exposed data, validation)
6. Code quality (duplication, naming, error handling)

**FOR EACH ISSUE:**
- Line number (from @@ marker)
- Title (clear and specific)
- Description (what changed, why it's a problem, impact)
- Suggested fix (complete working code)

**EXAMPLE:**
If you see this diff removing [weak self] and optional chaining:
\`\`\`diff
- NetworkManager.fetchPosts { [weak self] result in
-     self?.posts = result
+ NetworkManager.fetchPosts { result in
+     self.posts = result
\`\`\`

You should identify:
- Issue: Removed [weak self] may cause retain cycle
- Line: 25 (from @@ marker)
- Description: If NetworkManager holds closure strongly, creates retain cycle preventing ViewController deallocation
- Fix: Add [weak self] and guard let self = self

**Response Format - Return ONLY valid JSON (no markdown, no code blocks, no explanations):**
{
  "summary": "Detailed summary explaining what changed, why it matters, and overall assessment. Be specific and actionable.",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "confidenceScore": 85,
  "issues": [
    {
      "severity": "critical" | "security" | "performance" | "quality" | "style",
      "file": "${filename}",
      "line": 25,
      "title": "Specific, actionable title",
      "description": "Detailed explanation: What changed, why it's problematic, specific scenarios where it fails, and the impact. Minimum 2-3 sentences.",
      "suggestedFix": "Complete working code that fixes the issue. Include full context if needed. Must be syntactically correct.",
      "language": "${language}",
      "category": "memory-management" | "optional-handling" | "performance" | "logic-error" | "security" | "code-quality",
      "cwe": "CWE-89"
    }
  ]
}

**FINAL REMINDERS:**
- Analyze EVERY line of the diff
- Find ALL issues, even subtle ones
- Provide detailed explanations (minimum 2-3 sentences per issue)
- Provide complete, working code fixes
- Set confidenceScore to 85-95 for clear issues
- Set riskLevel appropriately (HIGH for critical/security, MEDIUM for performance, LOW for style)
- Include a CWE ID when security-related (e.g., SQLi=CWE-89, XSS=CWE-79, Path Traversal=CWE-22, SSRF=CWE-918, Insecure Deserialization=CWE-502). If unknown, leave cwe empty.
- Return ONLY valid JSON, no markdown, no code blocks
- If you truly find no issues, still provide a meaningful summary explaining why the code is good
`;
};

/**
 * Build prompt for generating PR summary with visual insights
 */
export const buildSummaryPrompt = (
    allIssues: any[],
    filesChanged: number,
    riskLevel: string
): string => {
    const criticalCount = allIssues.filter(i => i.severity === 'critical' || i.severity === 'security').length;
    const performanceCount = allIssues.filter(i => i.severity === 'performance').length;
    const qualityCount = allIssues.filter(i => i.severity === 'quality').length;

    return `
Generate a comprehensive PR review summary in markdown format. Include:

1. **Executive Summary** - High-level overview of changes
2. **Risk Assessment** - Why the risk level is ${riskLevel}
3. **Key Findings** - Top 3-5 most important issues
4. **Architectural Impact** - How changes affect the codebase
5. **Recommended Actions** - Prioritized list of fixes
6. **Visual Summary** - Textual representation suitable for diagrams

**Stats:**
- Files changed: ${filesChanged}
- Critical/Security issues: ${criticalCount}
- Performance issues: ${performanceCount}
- Quality issues: ${qualityCount}

Make it developer-friendly, actionable, and concise.
`;
};

/**
 * Build prompt for AI chat responses about code
 */
export const buildChatPrompt = (
    userQuestion: string,
    prContext: {
        title: string;
        summary: string;
        issues: any[];
        filesChanged: number;
    }
): string => {
    return `
You are a helpful AI code review assistant (like CodeRabbit's chat feature). A developer is asking about a pull request.

**PR Context:**
- Title: ${prContext.title}
- Summary: ${prContext.summary}
- Files changed: ${prContext.filesChanged}
- Issues found: ${prContext.issues.length}

**User Question:**
${userQuestion}

**Instructions:**
1. Answer the question based on the PR context
2. Be helpful, concise, and developer-friendly
3. If asked about a specific issue, reference it clearly
4. If asked to generate code, provide complete, working examples
5. If asked about best practices, give actionable advice
6. Use markdown for code blocks and formatting

**Response Format:**
Provide a clear, helpful answer. Use markdown for formatting.
`;
};
