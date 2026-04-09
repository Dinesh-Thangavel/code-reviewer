"use strict";
/**
 * Email Service
 * Handles email notifications via SendGrid or AWS SES
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmailTemplate = exports.sendEmail = void 0;
/**
 * Send email using configured provider
 */
const sendEmail = async (options) => {
    const emailProvider = process.env.EMAIL_PROVIDER || 'console'; // 'sendgrid', 'ses', 'console'
    try {
        switch (emailProvider) {
            case 'sendgrid':
                return await sendViaSendGrid(options);
            case 'ses':
                return await sendViaSES(options);
            case 'console':
            default:
                // Development: just log
                console.log('[Email]', {
                    to: options.to,
                    subject: options.subject,
                    html: options.html,
                });
                return true;
        }
    }
    catch (error) {
        console.error('Email send error:', error);
        return false;
    }
};
exports.sendEmail = sendEmail;
/**
 * Send via SendGrid
 */
async function sendViaSendGrid(options) {
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    if (!SENDGRID_API_KEY) {
        console.warn('SendGrid API key not configured');
        return false;
    }
    try {
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(SENDGRID_API_KEY);
        const msg = {
            to: options.to,
            from: process.env.SENDGRID_FROM_EMAIL || 'noreply@ai-code-review.com',
            subject: options.subject,
            text: options.text || options.html.replace(/<[^>]*>/g, ''),
            html: options.html,
        };
        await sgMail.send(msg);
        return true;
    }
    catch (error) {
        console.error('SendGrid error:', error);
        return false;
    }
}
/**
 * Send via AWS SES
 */
async function sendViaSES(options) {
    const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
    const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
    const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
        console.warn('AWS SES credentials not configured');
        return false;
    }
    try {
        const AWS = require('aws-sdk');
        const ses = new AWS.SES({
            region: AWS_REGION,
            accessKeyId: AWS_ACCESS_KEY_ID,
            secretAccessKey: AWS_SECRET_ACCESS_KEY,
        });
        const params = {
            Destination: { ToAddresses: [options.to] },
            Message: {
                Body: {
                    Html: { Charset: 'UTF-8', Data: options.html },
                    Text: { Charset: 'UTF-8', Data: options.text || options.html.replace(/<[^>]*>/g, '') },
                },
                Subject: { Charset: 'UTF-8', Data: options.subject },
            },
            Source: process.env.SES_FROM_EMAIL || 'noreply@ai-code-review.com',
        };
        await ses.sendEmail(params).promise();
        return true;
    }
    catch (error) {
        console.error('AWS SES error:', error);
        return false;
    }
}
/**
 * Generate email template
 */
const generateEmailTemplate = (title, message, link, linkText = 'View Details') => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">AI Code Review</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #333; margin-top: 0;">${title}</h2>
        <p style="color: #666; font-size: 16px;">${message}</p>
        ${link ? `
        <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">${linkText}</a>
        </div>
        ` : ''}
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            This is an automated notification from AI Code Review Dashboard.
        </p>
    </div>
</body>
</html>
    `.trim();
};
exports.generateEmailTemplate = generateEmailTemplate;
