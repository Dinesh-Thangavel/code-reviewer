import { Router } from 'express';
import { claudeChat } from '../ai/claudeClient';

export const router = Router();

router.post('/test', async (req, res) => {
    try {
        const { diff } = req.body;
        
        if (!diff) {
            return res.status(400).json({ error: 'diff is required' });
        }

        const testPrompt = `Analyze this code diff and return ONLY valid JSON (no markdown):

DIFF:
\`\`\`diff
${diff.substring(0, 4000)}
\`\`\`

Return this JSON structure:
{
  "summary": "What changed",
  "riskLevel": "LOW",
  "confidenceScore": 80,
  "issues": []
}`;

        console.log('[Test] Calling Claude with prompt length:', testPrompt.length);
        console.log('[Test] Diff length:', diff.length);
        
        const response = await claudeChat(
            [
                { role: 'system', content: 'You are a code reviewer. Return only valid JSON, no markdown.' },
                { role: 'user', content: testPrompt }
            ],
            { temperature: 0.0, format: 'json' }
        );

        console.log('[Test] Claude response length:', response.length);
        console.log('[Test] Claude response preview:', response.substring(0, 500));

        res.json({
            success: true,
            responseLength: response.length,
            responsePreview: response.substring(0, 500),
            fullResponse: response
        });
    } catch (error: any) {
        console.error('[Test] Error:', error.message);
        console.error('[Test] Error stack:', error.stack);
        if (error.response) {
            console.error('[Test] API response:', error.response.data);
        }
        res.status(500).json({
            error: error.message,
            details: error.response?.data
        });
    }
});
