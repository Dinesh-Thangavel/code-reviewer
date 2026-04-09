/**
 * Test script to verify Claude review is working
 * Run with: npx ts-node test-claude-review.ts
 */

import { claudeChat } from './src/ai/claudeClient';

const testDiff = `@@ -10,5 +10,6 @@
- NetworkManager.fetchPosts { [weak self] result in
-     self?.posts = result
-     self?.tableView.reloadData()
+ NetworkManager.fetchPosts { result in
+     self.posts = result
+     self.tableView.reloadData()
 }`;

const testPrompt = `You are CodeRabbit, an expert AI code reviewer. Analyze the code diff and provide detailed feedback.

**Language:** swift

**Code Diff:**
\`\`\`diff
${testDiff}
\`\`\`

**Your Task:**
1. Analyze the diff - identify what changed (lines with + and -)
2. Extract line numbers from @@ markers
3. For each change, identify issues
4. Provide detailed feedback with complete code fixes

**Response Format (JSON only, no markdown):**
{
  "summary": "Clear summary of changes",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "confidenceScore": 90,
  "issues": [
    {
      "severity": "critical" | "security" | "performance" | "quality" | "style",
      "file": "ViewController.swift",
      "line": 10,
      "title": "Specific issue title",
      "description": "Detailed explanation",
      "suggestedFix": "Complete working code",
      "language": "swift",
      "category": "memory-management"
    }
  ]
}

**Return ONLY valid JSON. No markdown, no code blocks, no extra text.**`;

async function testClaude() {
    try {
        console.log('Testing Claude review...');
        console.log('Prompt length:', testPrompt.length);
        
        const response = await claudeChat(
            [{ role: 'user', content: testPrompt }],
            { temperature: 0.0, format: 'json' }
        );
        
        console.log('\n=== Claude Response ===');
        console.log('Length:', response.length);
        console.log('First 1000 chars:', response.substring(0, 1000));
        console.log('\n=== Full Response ===');
        console.log(response);
        
        // Try to parse as JSON
        try {
            const json = JSON.parse(response);
            console.log('\n=== Parsed JSON ===');
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.error('\n=== JSON Parse Error ===');
            console.error(e);
        }
    } catch (error: any) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testClaude();
