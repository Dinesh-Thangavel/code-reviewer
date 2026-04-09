"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewPullRequest = void 0;
const ollamaClient_1 = require("./ollamaClient");
const geminiClient_1 = require("./geminiClient");
const claudeClient_1 = require("./claudeClient");
const openaiClient_1 = require("./openaiClient");
const enhancedPrompt_1 = require("./enhancedPrompt");
const schema_1 = require("./schema");
const language_1 = require("../utils/language");
const reviewRules_1 = require("./reviewRules");
const breakingChangeDetector_1 = require("../services/breakingChangeDetector");
// Determine which AI provider to use (CodeRabbit uses Claude primarily)
// Priority: Claude > GPT-4 > Gemini > Ollama
const AI_PROVIDER = process.env.AI_PROVIDER || 'claude';
const useClaude = (AI_PROVIDER.toLowerCase() === 'claude' || AI_PROVIDER.toLowerCase() === 'anthropic') && !!process.env.ANTHROPIC_API_KEY;
const useOpenAI = (AI_PROVIDER.toLowerCase() === 'openai' || AI_PROVIDER.toLowerCase() === 'gpt') && !!process.env.OPENAI_API_KEY;
const useGemini = (AI_PROVIDER.toLowerCase() === 'gemini') && !!process.env.GEMINI_API_KEY && !useClaude && !useOpenAI;
// Helper function to count lines in a diff patch
const countLinesInPatch = (patch) => {
    if (!patch)
        return { added: 0, removed: 0, total: 0 };
    const lines = patch.split('\n');
    let added = 0;
    let removed = 0;
    for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++'))
            added++;
        if (line.startsWith('-') && !line.startsWith('---'))
            removed++;
    }
    return { added, removed, total: added + removed };
};
// CWE/Category fallback mapping (best-effort)
const CWE_BY_CATEGORY = {
    'security': 'CWE-937',
    'critical': 'CWE-937',
    'memory-management': 'CWE-415',
    'optional-handling': 'CWE-476',
    'performance': 'CWE-409',
    'logic-error': 'CWE-628',
    'code-quality': 'CWE-710',
    'injection': 'CWE-89',
    'xss': 'CWE-79',
    'ssrf': 'CWE-918',
    'path-traversal': 'CWE-22',
    'deserialization': 'CWE-502',
};
const reviewPullRequest = async (files, progressCallback, options) => {
    const securityOnly = options?.securityOnly || false;
    const modelName = useClaude ? claudeClient_1.CLAUDE_MODEL_NAME : useOpenAI ? openaiClient_1.OPENAI_MODEL_NAME : useGemini ? geminiClient_1.GEMINI_MODEL_NAME : ollamaClient_1.OLLAMA_MODEL;
    const providerName = useClaude ? 'Claude (CodeRabbit-style)' : useOpenAI ? 'GPT-4' : useGemini ? 'Gemini' : 'Ollama';
    const reviewMode = securityOnly ? 'SECURITY-ONLY' : 'FULL';
    console.log(`[AI/${providerName}] Starting ${reviewMode} review for ${files.length} files using model: ${modelName}`);
    const MAX_FILES = 25;
    let filesToReview = files;
    let isTruncated = false;
    if (files.length > MAX_FILES) {
        console.log(`[AI/${providerName}] Pruning files from ${files.length} to ${MAX_FILES}`);
        filesToReview = files.slice(0, MAX_FILES);
        isTruncated = true;
    }
    // Calculate total lines for progress tracking
    const totalLines = filesToReview.reduce((sum, file) => {
        const counts = countLinesInPatch(file.patch);
        return sum + counts.total;
    }, 0);
    let reviewedLines = 0;
    let completedFiles = 0;
    // Emit initial progress
    if (progressCallback) {
        progressCallback({
            totalFiles: filesToReview.length,
            completedFiles: 0,
            pendingFiles: filesToReview.length,
            totalLines,
            reviewedLines: 0,
            pendingLines: totalLines,
            currentFile: filesToReview[0]?.filename,
            progressPercent: 0,
        });
    }
    const fileReviews = await Promise.all(filesToReview.map(async (file, fileIndex) => {
        try {
            // Validate patch exists and is not empty
            if (!file.patch || file.patch.trim().length === 0) {
                console.warn(`[AI] File ${file.filename} has no patch content`);
                return {
                    summary: `File ${file.filename} has no changes to review (empty patch).`,
                    riskLevel: 'LOW',
                    confidenceScore: 100,
                    issues: [],
                    file: file.filename
                };
            }
            const language = (0, language_1.detectLanguageFromFile)(file.filename);
            const rules = (0, reviewRules_1.getRulesForLanguage)(language);
            // Chunking Logic - Skip very large files to avoid timeouts
            const MAX_FILE_SIZE = 10000; // Skip files larger than 10KB
            if (file.patch.length > MAX_FILE_SIZE) {
                console.log(`[AI/Ollama] Skipping very large file ${file.filename} (${file.patch.length} chars > ${MAX_FILE_SIZE} limit)`);
                return {
                    summary: `File ${file.filename} is too large to review (${file.patch.length} chars). Skipped.`,
                    issues: [],
                    confidenceScore: 0,
                    riskLevel: 'LOW',
                    file: file.filename
                };
            }
            // Improved chunking: split by diff hunks to preserve line number context
            // Claude/GPT-4 can handle larger chunks, Ollama/Gemini need smaller
            const MAX_CHUNK_SIZE = useClaude || useOpenAI ? 8000 : useGemini ? 4000 : 3000;
            const patches = [];
            if (file.patch.length > MAX_CHUNK_SIZE) {
                console.log(`[AI/${providerName}] File ${file.filename} is too large (${file.patch.length} chars). Splitting into chunks while preserving context...`);
                // Try to split by diff hunks (lines starting with @@) to preserve line numbers
                const hunkPattern = /^@@ -(\d+),?\d* \+(\d+),?\d* @@/gm;
                const hunks = [];
                let match;
                const hunkMatches = [];
                // Find all hunk positions
                while ((match = hunkPattern.exec(file.patch)) !== null) {
                    hunkMatches.push({ index: match.index });
                }
                if (hunkMatches.length > 0) {
                    // Split by hunks, but combine small hunks together
                    let currentChunk = '';
                    for (let i = 0; i < hunkMatches.length; i++) {
                        const hunkStart = hunkMatches[i].index;
                        const hunkEnd = i < hunkMatches.length - 1 ? hunkMatches[i + 1].index : file.patch.length;
                        const hunkContent = file.patch.substring(hunkStart, hunkEnd);
                        if (currentChunk.length + hunkContent.length <= MAX_CHUNK_SIZE) {
                            currentChunk += hunkContent;
                        }
                        else {
                            if (currentChunk)
                                patches.push(currentChunk);
                            currentChunk = hunkContent;
                        }
                    }
                    if (currentChunk)
                        patches.push(currentChunk);
                }
                else {
                    // Fallback: split by lines but try to break at newlines
                    let currentChunk = '';
                    const lines = file.patch.split('\n');
                    for (const line of lines) {
                        if (currentChunk.length + line.length + 1 > MAX_CHUNK_SIZE && currentChunk) {
                            patches.push(currentChunk);
                            currentChunk = line + '\n';
                        }
                        else {
                            currentChunk += line + '\n';
                        }
                    }
                    if (currentChunk)
                        patches.push(currentChunk);
                }
            }
            else {
                patches.push(file.patch);
            }
            const chunkReviews = await Promise.all(patches.map(async (patchChunk, index) => {
                // Use enhanced prompt with codebase context (CodeRabbit-style)
                // If security-only mode, modify rules to focus on security
                const reviewRules = securityOnly
                    ? ['Focus ONLY on security vulnerabilities: SQL injection, XSS, CSRF, authentication bypass, authorization issues, sensitive data exposure, insecure dependencies, hardcoded secrets, insecure random number generation, timing attacks, path traversal, command injection, and other security flaws. Ignore all non-security issues.']
                    : rules;
                const prompt = (0, enhancedPrompt_1.buildEnhancedReviewPrompt)(patchChunk, language, reviewRules, {
                    relatedFiles: filesToReview.map(f => f.filename).filter(f => f !== file.filename).slice(0, 5),
                    filename: file.filename, // Pass filename for better context
                });
                try {
                    // Use lower temperature for more accurate, deterministic reviews
                    // CodeRabbit uses Claude with very low temperature for precision
                    let content;
                    if (useClaude) {
                        // Use user role for the prompt to ensure it's treated as the main instruction
                        try {
                            console.log(`[AI/Claude] Reviewing chunk ${index + 1}/${patches.length} of ${file.filename}, prompt length: ${prompt.length}, patch length: ${patchChunk.length}`);
                            content = await (0, claudeClient_1.claudeChat)([
                                {
                                    role: 'system',
                                    content: 'You are CodeRabbit, an expert AI code reviewer. You analyze code diffs meticulously, finding all issues including subtle bugs, memory leaks, performance problems, and security vulnerabilities. You provide detailed explanations and complete code fixes. Always return valid JSON only, no markdown.'
                                },
                                { role: 'user', content: prompt }
                            ], { temperature: 0.0, format: 'json' } // Claude: 0.0 for maximum accuracy
                            );
                            console.log(`[AI/Claude] Received response for chunk ${index + 1}, length: ${content?.length || 0}`);
                        }
                        catch (claudeError) {
                            console.error(`[AI/Claude] Error calling Claude API for chunk ${index + 1}:`, claudeError.message);
                            console.error(`[AI/Claude] Error details:`, {
                                status: claudeError.response?.status,
                                statusText: claudeError.response?.statusText,
                                data: claudeError.response?.data,
                            });
                            throw claudeError;
                        }
                    }
                    else if (useOpenAI) {
                        content = await (0, openaiClient_1.openaiChat)([{ role: 'system', content: prompt }], { temperature: 0.1, format: 'json' } // GPT-4: 0.1 for accuracy
                        );
                    }
                    else if (useGemini) {
                        content = await (0, geminiClient_1.geminiChat)([{ role: 'system', content: prompt }], { temperature: 0.1, format: 'json' } // Gemini: 0.1 for accuracy
                        );
                    }
                    else {
                        content = await (0, ollamaClient_1.ollamaChat)([{ role: 'system', content: prompt }], { temperature: 0.1, format: 'json' } // Ollama: 0.1 for accuracy
                        );
                    }
                    if (!content) {
                        console.error(`[AI] Empty response for chunk ${index} of ${file.filename}`);
                        return null;
                    }
                    // Clean up response - some models might wrap in markdown
                    let cleanContent = content.trim();
                    // Remove markdown code blocks
                    if (cleanContent.startsWith('```json')) {
                        cleanContent = cleanContent.slice(7);
                    }
                    if (cleanContent.startsWith('```')) {
                        cleanContent = cleanContent.slice(3);
                    }
                    if (cleanContent.endsWith('```')) {
                        cleanContent = cleanContent.slice(0, -3);
                    }
                    cleanContent = cleanContent.trim();
                    // Try to extract JSON if wrapped in text
                    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        cleanContent = jsonMatch[0];
                    }
                    console.log(`[AI] Parsing response for chunk ${index} of ${file.filename}, length: ${cleanContent.length}`);
                    let parsed;
                    try {
                        parsed = JSON.parse(cleanContent);
                    }
                    catch (parseError) {
                        console.error(`[AI] JSON parse error for chunk ${index}:`, parseError.message);
                        console.error(`[AI] Response preview (first 500 chars):`, cleanContent.substring(0, 500));
                        throw new Error(`Invalid JSON response: ${parseError.message}`);
                    }
                    const validated = schema_1.ReviewResponseSchema.parse(parsed);
                    // Validate that the review is meaningful
                    if (validated.summary.toLowerCase().includes('failed to analyze') ||
                        validated.summary.toLowerCase().includes('unable to analyze') ||
                        (validated.issues.length === 0 && validated.confidenceScore === 0)) {
                        console.warn(`[AI] Review appears to be a failure response. Summary: ${validated.summary.substring(0, 100)}`);
                        // Don't return null, but log a warning - let it through but we'll check later
                    }
                    console.log(`[AI] Successfully parsed review for chunk ${index}: ${validated.issues.length} issues found, confidence: ${validated.confidenceScore}%`);
                    return validated;
                }
                catch (e) {
                    const providerName = useClaude ? 'Claude' : useOpenAI ? 'GPT-4' : useGemini ? 'Gemini' : 'Ollama';
                    console.error(`[AI/${providerName}] Failed to review chunk ${index} of ${file.filename}:`, e.message);
                    console.error(`[AI/${providerName}] Error stack:`, e.stack);
                    if (e.response) {
                        console.error(`[AI/${providerName}] API response:`, e.response.data);
                    }
                    return null;
                }
            }));
            // Merge Chunk Results
            const validReviews = chunkReviews.filter((r) => r !== null);
            if (validReviews.length === 0) {
                console.error(`[AI] All chunks failed for ${file.filename}. Patch length: ${file.patch.length}`);
                console.error(`[AI] Patch preview (first 1000 chars):`, file.patch.substring(0, 1000));
                console.error(`[AI] Attempting fallback review with simplified prompt...`);
                // Fallback: try a much simpler, more direct prompt
                try {
                    // Extract basic info from patch for a basic analysis
                    const addedLines = (file.patch.match(/^\+/gm) || []).length;
                    const removedLines = (file.patch.match(/^-/gm) || []).length;
                    const lineMatches = file.patch.match(/^@@ -(\d+)/gm);
                    const startLine = lineMatches ? parseInt(lineMatches[0].match(/-(\d+)/)?.[1] || '0') : 0;
                    // Create a very simple, direct prompt
                    const simplePrompt = `You are a code reviewer. Analyze this diff and return ONLY valid JSON (no markdown):

DIFF:
${file.patch.substring(0, 6000)}

Return this exact JSON structure:
{
  "summary": "What changed in this code",
  "riskLevel": "LOW",
  "confidenceScore": 80,
  "issues": [
    {
      "severity": "quality",
      "file": "${file.filename}",
      "line": ${startLine},
      "title": "Issue found",
      "description": "Description of the issue",
      "suggestedFix": "Code fix",
      "language": "${language}",
      "category": "code-quality"
    }
  ]
}`;
                    console.log(`[AI] Trying fallback with simplified prompt...`);
                    const fallbackContent = useClaude
                        ? await (0, claudeClient_1.claudeChat)([
                            { role: 'system', content: 'You are a code reviewer. Return only valid JSON, no markdown.' },
                            { role: 'user', content: simplePrompt }
                        ], { temperature: 0.0, format: 'json' })
                        : useOpenAI
                            ? await (0, openaiClient_1.openaiChat)([{ role: 'user', content: simplePrompt }], { temperature: 0.1, format: 'json' })
                            : useGemini
                                ? await (0, geminiClient_1.geminiChat)([{ role: 'user', content: simplePrompt }], { temperature: 0.1, format: 'json' })
                                : await (0, ollamaClient_1.ollamaChat)([{ role: 'user', content: simplePrompt }], { temperature: 0.1, format: 'json' });
                    if (fallbackContent) {
                        console.log(`[AI] Fallback response received, length: ${fallbackContent.length}`);
                        console.log(`[AI] Fallback response preview:`, fallbackContent.substring(0, 500));
                        let cleanFallback = fallbackContent.trim();
                        // Remove markdown code blocks
                        if (cleanFallback.startsWith('```json'))
                            cleanFallback = cleanFallback.slice(7);
                        if (cleanFallback.startsWith('```'))
                            cleanFallback = cleanFallback.slice(3);
                        if (cleanFallback.endsWith('```'))
                            cleanFallback = cleanFallback.slice(0, -3);
                        cleanFallback = cleanFallback.trim();
                        // Extract JSON
                        const jsonMatch = cleanFallback.match(/\{[\s\S]*\}/);
                        if (jsonMatch)
                            cleanFallback = jsonMatch[0];
                        console.log(`[AI] Parsing fallback JSON...`);
                        const fallbackParsed = JSON.parse(cleanFallback);
                        const fallbackValidated = schema_1.ReviewResponseSchema.parse(fallbackParsed);
                        console.log(`[AI] ✅ Fallback review succeeded: ${fallbackValidated.issues.length} issues found`);
                        return {
                            summary: fallbackValidated.summary,
                            issues: fallbackValidated.issues,
                            confidenceScore: fallbackValidated.confidenceScore,
                            riskLevel: fallbackValidated.riskLevel,
                            file: file.filename
                        };
                    }
                    else {
                        console.error(`[AI] Fallback returned empty content`);
                    }
                }
                catch (fallbackError) {
                    console.error(`[AI] Fallback review failed:`, fallbackError.message);
                    console.error(`[AI] Fallback error stack:`, fallbackError.stack);
                    if (fallbackError.response) {
                        console.error(`[AI] Fallback API response:`, JSON.stringify(fallbackError.response.data, null, 2));
                    }
                }
                // Last resort: return a basic analysis based on patch content
                const addedLines = (file.patch.match(/^\+/gm) || []).length;
                const removedLines = (file.patch.match(/^-/gm) || []).length;
                const hasChanges = addedLines > 0 || removedLines > 0;
                // Extract basic info from patch for a minimal review
                const lineMatches = file.patch.match(/^@@ -(\d+)/gm);
                const startLine = lineMatches ? parseInt(lineMatches[0].match(/-(\d+)/)?.[1] || '0') : 0;
                // Look for common patterns in the diff
                const hasWeakSelf = file.patch.includes('[weak self]') || file.patch.includes('[unowned self]');
                const removedWeakSelf = file.patch.match(/^-.*\[weak self\]/m) && !file.patch.match(/^\+.*\[weak self\]/m);
                const hasOptionalChaining = file.patch.includes('?.') || file.patch.includes('!');
                const removedOptionalChaining = file.patch.match(/^-.*\?\./m) && !file.patch.match(/^\+.*\?\./m);
                const basicIssues = [];
                if (removedWeakSelf) {
                    basicIssues.push({
                        severity: 'performance',
                        file: file.filename,
                        line: startLine,
                        title: 'Removed weak self capture may cause retain cycle',
                        description: 'The closure no longer uses [weak self] capture. If the object holding this closure retains it strongly, this can create a retain cycle preventing proper deallocation.',
                        suggestedFix: 'Add [weak self] to the closure and use guard let self = self else { return } before accessing self.',
                        language: language,
                        category: 'memory-management'
                    });
                }
                if (removedOptionalChaining) {
                    basicIssues.push({
                        severity: 'quality',
                        file: file.filename,
                        line: startLine,
                        title: 'Removed optional chaining may cause crash',
                        description: 'Optional chaining was removed. This could cause a crash if the object is nil when accessed.',
                        suggestedFix: 'Keep optional chaining (self?.property) or add a nil check before accessing.',
                        language: language,
                        category: 'optional-handling'
                    });
                }
                // If we found issues via pattern matching, don't mention the failure
                const summaryText = basicIssues.length > 0
                    ? `Pattern-based analysis: ${addedLines} lines added, ${removedLines} lines removed. Found ${basicIssues.length} potential issue(s) based on code patterns (removed weak self capture, optional chaining changes, etc.).`
                    : `Basic analysis: ${addedLines} lines added, ${removedLines} lines removed. No obvious issues detected from pattern matching.`;
                // Update progress for pattern-based fallback
                const fileLineCounts = countLinesInPatch(file.patch);
                reviewedLines += fileLineCounts.total;
                completedFiles++;
                if (progressCallback) {
                    const nextFile = filesToReview[fileIndex + 1]?.filename;
                    progressCallback({
                        totalFiles: filesToReview.length,
                        completedFiles,
                        pendingFiles: filesToReview.length - completedFiles,
                        totalLines,
                        reviewedLines,
                        pendingLines: totalLines - reviewedLines,
                        currentFile: nextFile,
                        progressPercent: Math.round((completedFiles / filesToReview.length) * 100),
                    });
                }
                return {
                    summary: summaryText,
                    riskLevel: basicIssues.length > 0 ? 'MEDIUM' : 'LOW',
                    confidenceScore: basicIssues.length > 0 ? 60 : 30,
                    issues: basicIssues,
                    file: file.filename
                };
            }
            const mergedIssues = validReviews.flatMap(r => r.issues);
            const mergedSummary = validReviews.map(r => r.summary).join('\n\n---\n\n');
            const avgConfidence = validReviews.reduce((sum, r) => sum + r.confidenceScore, 0) / validReviews.length;
            const maxRisk = validReviews.reduce((max, r) => {
                const levels = { 'LOW': 0, 'MEDIUM': 1, 'HIGH': 2 };
                return levels[r.riskLevel] > levels[max] ? r.riskLevel : max;
            }, 'LOW');
            // Update progress after file review completes
            const fileLineCounts = countLinesInPatch(file.patch);
            reviewedLines += fileLineCounts.total;
            completedFiles++;
            // Emit progress update
            if (progressCallback) {
                const nextFile = filesToReview[fileIndex + 1]?.filename;
                progressCallback({
                    totalFiles: filesToReview.length,
                    completedFiles,
                    pendingFiles: filesToReview.length - completedFiles,
                    totalLines,
                    reviewedLines,
                    pendingLines: totalLines - reviewedLines,
                    currentFile: nextFile,
                    progressPercent: Math.round((completedFiles / filesToReview.length) * 100),
                });
            }
            return {
                summary: mergedSummary,
                issues: mergedIssues,
                confidenceScore: avgConfidence,
                riskLevel: maxRisk,
                file: file.filename
            };
        }
        catch (error) {
            const providerName = useClaude ? 'Claude' : useOpenAI ? 'GPT-4' : useGemini ? 'Gemini' : 'Ollama';
            console.error(`[AI/${providerName}] Failed to review file ${file.filename}:`, error.message);
            console.error(`[AI/${providerName}] Error stack:`, error.stack);
            console.error(`[AI/${providerName}] File patch length:`, file.patch.length);
            console.error(`[AI/${providerName}] File patch preview (first 500 chars):`, file.patch.substring(0, 500));
            // Return a more helpful error message
            return {
                summary: `Error analyzing ${file.filename}: ${error.message}. Please check the diff format and try again.`,
                riskLevel: 'LOW',
                confidenceScore: 0,
                issues: [],
                file: file.filename
            };
        }
    }));
    // Aggregate Results
    let allIssues = [];
    const fileSummaries = [];
    let totalConfidence = 0;
    let maxRiskLevel = 0;
    const RISK_MAP = { 'LOW': 0, 'MEDIUM': 1, 'HIGH': 2 };
    const REVERSE_RISK_MAP = ['LOW', 'MEDIUM', 'HIGH'];
    for (const review of fileReviews) {
        if (review.issues.length > 0) {
            allIssues.push(...review.issues);
        }
        if (review.summary) {
            fileSummaries.push({ file: review.file, summary: review.summary });
        }
        totalConfidence += review.confidenceScore;
        const riskVal = RISK_MAP[review.riskLevel] ?? 0;
        if (riskVal > maxRiskLevel) {
            maxRiskLevel = riskVal;
        }
    }
    // Filter to security issues only if security-only mode
    if (securityOnly) {
        const beforeCount = allIssues.length;
        allIssues = allIssues.filter(issue => issue.severity === 'security' ||
            issue.severity === 'critical' ||
            issue.title.toLowerCase().includes('security') ||
            issue.title.toLowerCase().includes('vulnerability') ||
            issue.title.toLowerCase().includes('injection') ||
            issue.title.toLowerCase().includes('xss') ||
            issue.title.toLowerCase().includes('csrf') ||
            issue.description.toLowerCase().includes('security') ||
            issue.description.toLowerCase().includes('vulnerable'));
        const afterCount = allIssues.length;
        console.log(`[AI] Security-only mode: Filtered ${beforeCount} issues to ${afterCount} security-related issues`);
        // Update risk level if no security issues found
        if (allIssues.length === 0 && maxRiskLevel > 0) {
            maxRiskLevel = 0; // Set to LOW if no security issues
        }
    }
    const avgConfidence = filesToReview.length > 0 ? Math.round(totalConfidence / filesToReview.length) : 0;
    const finalRisk = REVERSE_RISK_MAP[maxRiskLevel];
    // Generate Structured Summary
    const issuesCount = allIssues.reduce((acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
    }, {});
    // Enrich issues with CWE where missing
    allIssues = allIssues.map((issue) => {
        if (!issue.cwe) {
            const key = issue.category?.toLowerCase() || issue.severity;
            issue.cwe = CWE_BY_CATEGORY[key] || (issue.severity === 'security' || issue.severity === 'critical' ? 'CWE-937' : undefined);
        }
        return issue;
    });
    const criticalCount = issuesCount['critical'] || issuesCount['security'] || 0;
    const warningCount = issuesCount['warning'] || issuesCount['performance'] || 0;
    let nextSteps = "✅ **Ready to merge** (with caution).";
    if (criticalCount > 0) {
        nextSteps = "🛑 **Block Merge**: Critical issues detected. Please resolve immediately.";
    }
    else if (warningCount > 0) {
        nextSteps = "⚠️ **Review Required**: Address warnings before merging.";
    }
    const summaryList = fileSummaries.map(fs => `- **${fs.file}**: ${fs.summary}`).join('\n');
    const truncationNote = isTruncated
        ? `\n> ⚠️ **Note**: This PR contains ${files.length} files. Only the first ${MAX_FILES} were reviewed due to size limits.`
        : '';
    const finalSummary = `
## 🛡️ AI Review Summary (powered by ${providerName} – ${modelName})

### 📊 Overview
- **Risk Level**: ${finalRisk}
- **Confidence**: ${avgConfidence}%
- **Files Analyzed**: ${filesToReview.length}/${files.length} ${truncationNote}

### 🧐 Key Findings
${summaryList || "No significant findings."}

### 📉 Issue Breakdown
- 🔴 Critical/Security: ${criticalCount}
- 🟠 Warning/Performance: ${warningCount}
- 🔵 Info/Style: ${issuesCount['info'] || issuesCount['quality'] || issuesCount['style'] || 0}

### 🚀 Recommended Next Steps
${nextSteps}
`.trim();
    // Detect breaking changes
    let breakingChangesReport = '';
    try {
        const breakingChanges = await (0, breakingChangeDetector_1.detectBreakingChanges)(filesToReview);
        if (breakingChanges.length > 0) {
            breakingChangesReport = '\n\n' + (0, breakingChangeDetector_1.generateBreakingChangeReport)(breakingChanges);
            // Add breaking changes as issues
            for (const bc of breakingChanges) {
                allIssues.push({
                    severity: 'critical',
                    file: bc.file,
                    line: bc.line,
                    title: `Breaking Change: ${bc.type}`,
                    description: bc.description + (bc.migrationPath ? `\n\nMigration: ${bc.migrationPath}` : ''),
                    suggestedFix: `// TODO: Review and fix breaking change: ${bc.type}\n// ${bc.description}${bc.migrationPath ? `\n// Migration path: ${bc.migrationPath}` : ''}`,
                    language: (0, language_1.detectLanguageFromFile)(bc.file),
                });
            }
        }
    }
    catch (error) {
        const providerName = useClaude ? 'Claude' : useOpenAI ? 'GPT-4' : useGemini ? 'Gemini' : 'Ollama';
        console.error(`[AI/${providerName}] Error detecting breaking changes:`, error);
    }
    const finalSummaryWithBreakingChanges = finalSummary + breakingChangesReport;
    return {
        summary: finalSummaryWithBreakingChanges,
        riskLevel: finalRisk,
        confidenceScore: avgConfidence,
        issues: allIssues,
    };
};
exports.reviewPullRequest = reviewPullRequest;
