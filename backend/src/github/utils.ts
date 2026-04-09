import crypto from 'crypto';

export const verifyWebhookSignature = (
    secret: string,
    payload: string,
    signature: string
): boolean => {
    if (!secret || !payload || !signature) {
        return false;
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    // timeSafeEqual prevents timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(digest),
        Buffer.from(signature)
    );
};
