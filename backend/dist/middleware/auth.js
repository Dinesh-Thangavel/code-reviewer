"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const jwt_1 = require("../utils/jwt");
/**
 * Simple JWT guard for API routes.
 * Attaches userId to request for downstream access checks.
 */
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.replace('Bearer ', '');
    const decoded = (0, jwt_1.verifyToken)(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.userId = decoded.userId;
    return next();
};
exports.requireAuth = requireAuth;
