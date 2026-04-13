import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Simple JWT guard for API routes.
 * Attaches userId to request for downstream access checks.
 */
export const requireAuth = (req: Request & { userId?: string }, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    if (!UUID_REGEX.test(decoded.userId)) {
        return res.status(401).json({ error: 'Invalid token payload' });
    }

    req.userId = decoded.userId;
    return next();
};
