"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhookSignature = void 0;
const crypto_1 = __importDefault(require("crypto"));
const verifyWebhookSignature = (secret, payload, signature) => {
    if (!secret || !payload || !signature) {
        return false;
    }
    const hmac = crypto_1.default.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    // timeSafeEqual prevents timing attacks
    return crypto_1.default.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
};
exports.verifyWebhookSignature = verifyWebhookSignature;
