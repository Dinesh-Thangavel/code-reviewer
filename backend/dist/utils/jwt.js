"use strict";
/**
 * JWT Utility Functions
 * Centralized JWT token verification and decoding
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = verifyToken;
exports.getUserIdFromToken = getUserIdFromToken;
exports.signToken = signToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
/**
 * Verify and decode JWT token
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 */
function verifyToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded;
    }
    catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return null;
        }
        throw error;
    }
}
/**
 * Extract user ID from JWT token
 * @param token - JWT token string
 * @returns User ID or null if invalid
 */
function getUserIdFromToken(token) {
    const decoded = verifyToken(token);
    return decoded?.userId || null;
}
/**
 * Sign JWT token
 * @param payload - Token payload
 * @param expiresIn - Expiration time (default: 7d)
 * @returns Signed token
 */
function signToken(payload, expiresIn = '7d') {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn });
}
