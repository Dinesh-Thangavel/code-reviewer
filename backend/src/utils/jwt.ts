/**
 * JWT Utility Functions
 * Centralized JWT token verification and decoding
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface JWTPayload {
    userId: string;
    email: string;
}

/**
 * Verify and decode JWT token
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 */
export function verifyToken(token: string): JWTPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        return decoded;
    } catch (error: any) {
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
export function getUserIdFromToken(token: string): string | null {
    const decoded = verifyToken(token);
    if (!decoded?.userId) return null;
    return UUID_REGEX.test(decoded.userId) ? decoded.userId : null;
}

/**
 * Sign JWT token
 * @param payload - Token payload
 * @param expiresIn - Expiration time (default: 7d)
 * @returns Signed token
 */
export function signToken(payload: JWTPayload, expiresIn: string = '7d'): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}
