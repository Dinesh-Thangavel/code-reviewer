// Script to help format the GitHub private key correctly
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const privateKey = process.env.GITHUB_PRIVATE_KEY;

if (!privateKey) {
    console.error('❌ GITHUB_PRIVATE_KEY not found in .env');
    process.exit(1);
}

// Check if it already has the proper format
if (privateKey.includes('BEGIN RSA PRIVATE KEY') && privateKey.includes('END RSA PRIVATE KEY')) {
    console.log('✅ Private key already has correct format!');
    process.exit(0);
}

// If it starts with base64 content, add the header/footer
let fixedKey = privateKey.trim();

// Remove any existing quotes
fixedKey = fixedKey.replace(/^["']|["']$/g, '');

// Check if it's just the base64 content
if (!fixedKey.includes('BEGIN') && !fixedKey.includes('END')) {
    console.log('📝 Adding BEGIN/END lines to private key...\n');
    
    // Add the header and footer
    fixedKey = `-----BEGIN RSA PRIVATE KEY-----\n${fixedKey}\n-----END RSA PRIVATE KEY-----`;
    
    console.log('✅ Fixed private key format!');
    console.log('\n📋 Update your .env file with this value:\n');
    console.log('GITHUB_PRIVATE_KEY="' + fixedKey.replace(/\n/g, '\\n') + '"\n');
    console.log('Or if your .env supports multi-line:\n');
    console.log('GITHUB_PRIVATE_KEY="' + fixedKey + '"\n');
} else {
    console.log('⚠️  Private key format looks unusual. Please verify it includes:');
    console.log('   -----BEGIN RSA PRIVATE KEY-----');
    console.log('   (base64 content)');
    console.log('   -----END RSA PRIVATE KEY-----');
}
