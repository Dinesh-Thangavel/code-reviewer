// Quick test script to check Claude API connection
require('dotenv').config();
const axios = require('axios');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';

if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY is not set');
    process.exit(1);
}

console.log('Testing Claude API connection...');
console.log('Model:', CLAUDE_MODEL);
console.log('API Key prefix:', ANTHROPIC_API_KEY.substring(0, 20) + '...');

const testMessage = {
    model: CLAUDE_MODEL,
    max_tokens: 100,
    messages: [
        {
            role: 'user',
            content: 'Say "Hello, this is a test"',
        },
    ],
};

axios
    .post('https://api.anthropic.com/v1/messages', testMessage, {
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
        },
        timeout: 30000,
    })
    .then((response) => {
        console.log('✅ Claude API connection successful!');
        console.log('Response:', response.data.content[0]?.text || 'No text in response');
    })
    .catch((error) => {
        console.error('❌ Claude API connection failed!');
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Error Message:', error.message);
        if (error.response?.status === 401 || error.response?.status === 403) {
            console.error('\n⚠️  Your API key is invalid or expired. Please check your ANTHROPIC_API_KEY.');
        }
        process.exit(1);
    });
