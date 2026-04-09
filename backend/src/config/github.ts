import dotenv from 'dotenv';

dotenv.config();

export const githubConfig = {
    appId: process.env.GITHUB_APP_ID || '',
    privateKey: process.env.GITHUB_PRIVATE_KEY || '',
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
};
