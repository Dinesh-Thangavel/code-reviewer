// Quick script to test if GitHub private key is correctly formatted
require('dotenv').config();
const jwt = require('jsonwebtoken');

const appId = process.env.GITHUB_APP_ID;
const privateKey = process.env.GITHUB_PRIVATE_KEY;

console.log('Testing GitHub App Configuration...\n');

if (!appId) {
    console.error('❌ GITHUB_APP_ID is not set');
    process.exit(1);
}

if (!privateKey) {
    console.error('❌ GITHUB_PRIVATE_KEY is not set');
    process.exit(1);
}

// Check if it looks like a private key
if (!privateKey.includes('BEGIN RSA PRIVATE KEY') || !privateKey.includes('END RSA PRIVATE KEY')) {
    console.error('❌ GITHUB_PRIVATE_KEY does not look like a valid RSA private key');
    console.error('   It should start with: -----BEGIN RSA PRIVATE KEY-----');
    console.error('   It should end with: -----END RSA PRIVATE KEY-----');
    console.error('\n   Current value starts with:', privateKey.substring(0, 50));
    process.exit(1);
}

// Try to generate a JWT
try {
    const PRIVATE_KEY = privateKey.replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iat: now - 60,
        exp: now + (10 * 60),
        iss: appId,
    };
    
    const token = jwt.sign(payload, PRIVATE_KEY, { algorithm: 'RS256' });
    
    console.log('✅ GitHub App Configuration is valid!');
    console.log('   App ID:', appId);
    console.log('   Private Key: Valid RSA key');
    console.log('   JWT Generation: Success');
    console.log('\n   Sample JWT (first 50 chars):', token.substring(0, 50) + '...');
} catch (error) {
    console.error('❌ Failed to generate JWT:', error.message);
    console.error('\n   This usually means:');
    console.error('   1. Private key format is incorrect');
    console.error('   2. Private key doesn\'t match the App ID');
    console.error('   3. Private key has incorrect newline characters');
    process.exit(1);
}
