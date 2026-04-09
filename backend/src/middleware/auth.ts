import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

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

    req.userId = decoded.userId;
    return next();
};
