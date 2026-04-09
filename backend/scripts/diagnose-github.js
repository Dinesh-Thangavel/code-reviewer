// Comprehensive GitHub integration diagnostic
require('dotenv').config();
const jwt = require('jsonwebtoken');

console.log('🔍 GitHub Integration Diagnostic\n');
console.log('='.repeat(50));

// 1. Check Environment Variables
console.log('\n1️⃣  Environment Variables:');
const appId = process.env.GITHUB_APP_ID;
const privateKey = process.env.GITHUB_PRIVATE_KEY;
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

console.log(`   GITHUB_APP_ID: ${appId ? '✅ Set (' + appId + ')' : '❌ Missing'}`);
console.log(`   GITHUB_PRIVATE_KEY: ${privateKey ? '✅ Set (' + privateKey.substring(0, 30) + '...)' : '❌ Missing'}`);
console.log(`   GITHUB_WEBHOOK_SECRET: ${webhookSecret ? '✅ Set' : '⚠️  Missing (optional for testing)'}`);

// 2. Check Private Key Format
console.log('\n2️⃣  Private Key Format:');
if (privateKey) {
    if (privateKey.includes('BEGIN RSA PRIVATE KEY') && privateKey.includes('END RSA PRIVATE KEY')) {
        console.log('   ✅ Format is correct (has BEGIN/END lines)');
    } else {
        console.log('   ❌ Format is incorrect - missing BEGIN/END lines');
        console.log('   📝 Current starts with:', privateKey.substring(0, 50));
        console.log('   💡 Run: node scripts/fix-private-key.js');
    }
} else {
    console.log('   ❌ Private key not set');
}

// 3. Test JWT Generation
console.log('\n3️⃣  JWT Generation Test:');
if (appId && privateKey && privateKey.includes('BEGIN RSA PRIVATE KEY')) {
    try {
        const PRIVATE_KEY = privateKey.replace(/\\n/g, '\n');
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iat: now - 60,
            exp: now + (10 * 60),
            iss: appId,
        };
        
        const token = jwt.sign(payload, PRIVATE_KEY, { algorithm: 'RS256' });
        console.log('   ✅ JWT generation successful!');
        console.log('   📋 Token preview:', token.substring(0, 50) + '...');
    } catch (error) {
        console.log('   ❌ JWT generation failed:', error.message);
    }
} else {
    console.log('   ⏭️  Skipped (missing credentials or incorrect format)');
}

// 4. Check Webhook Setup
console.log('\n4️⃣  Webhook Configuration:');
console.log('   📍 Webhook URL should be: http://your-server/api/github/webhook');
console.log('   💡 For local testing, use ngrok: ngrok http 5000');
console.log('   📝 Update GitHub App webhook URL to: https://your-ngrok-url.ngrok.io/api/github/webhook');

// 5. Next Steps
console.log('\n5️⃣  Next Steps:');
console.log('   [ ] Fix private key format (if needed)');
console.log('   [ ] Ensure GitHub App is installed on repositories');
console.log('   [ ] Set up webhook URL (use ngrok for local)');
console.log('   [ ] Create a test PR or sync existing PRs');
console.log('   [ ] Check backend logs for webhook events');

console.log('\n' + '='.repeat(50));
console.log('\n💡 To sync existing PRs manually:');
console.log('   POST http://localhost:5000/api/github/sync');
console.log('   Body: { "repoFullName": "owner/repo", "installationId": "12345678" }');
