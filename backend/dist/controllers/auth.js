"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.getCurrentUser = exports.login = exports.signup = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const zod_1 = require("zod");
const db_1 = __importDefault(require("../db"));
const auditLog_1 = require("../services/auditLog");
const jwt_1 = require("../utils/jwt");
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
// Validation schemas
const signupSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    name: zod_1.z.string().min(1, 'Name is required'),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
// Signup
const signup = async (req, res) => {
    try {
        const validated = signupSchema.parse(req.body);
        // Check if user already exists
        const existingUser = await db_1.default.user.findUnique({
            where: { email: validated.email.toLowerCase() },
        });
        if (existingUser) {
            return res.status(400).json({
                error: 'User with this email already exists',
            });
        }
        // Hash password
        const hashedPassword = await bcrypt_1.default.hash(validated.password, 10);
        // Create user
        const user = await db_1.default.user.create({
            data: {
                email: validated.email.toLowerCase(),
                name: validated.name,
                password: hashedPassword,
            },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                githubConnected: true,
                githubUsername: true,
                bitbucketConnected: true,
                bitbucketUsername: true,
                createdAt: true,
            },
        });
        // Generate JWT token
        const token = (0, jwt_1.signToken)({ userId: user.id, email: user.email }, JWT_EXPIRES_IN);
        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                githubConnected: user.githubConnected || false,
                githubUsername: user.githubUsername || undefined,
                bitbucketConnected: user.bitbucketConnected || false,
                bitbucketUsername: user.bitbucketUsername || undefined,
            },
            token,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.issues,
            });
        }
        console.error('Signup error:', error);
        res.status(500).json({
            error: 'Failed to create account',
        });
    }
};
exports.signup = signup;
// Login
const login = async (req, res) => {
    try {
        const validated = loginSchema.parse(req.body);
        // Find user
        const user = await db_1.default.user.findUnique({
            where: { email: validated.email.toLowerCase() },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                password: true,
                githubConnected: true,
                githubUsername: true,
                bitbucketConnected: true,
                bitbucketUsername: true,
            },
        });
        if (!user) {
            return res.status(401).json({
                error: 'Invalid email or password',
            });
        }
        // Verify password
        const isValidPassword = await bcrypt_1.default.compare(validated.password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Invalid email or password',
            });
        }
        // Generate JWT token
        const token = (0, jwt_1.signToken)({ userId: user.id, email: user.email }, JWT_EXPIRES_IN);
        // Create audit log for login
        await (0, auditLog_1.createAuditLog)({
            userId: user.id,
            action: 'user_login',
            entityType: 'user',
            entityId: user.id,
            ipAddress: req.ip || req.socket.remoteAddress || undefined,
            userAgent: req.get('user-agent') || undefined,
        });
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                githubConnected: user.githubConnected || false,
                githubUsername: user.githubUsername || undefined,
                bitbucketConnected: user.bitbucketConnected || false,
                bitbucketUsername: user.bitbucketUsername || undefined,
            },
            token,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.issues,
            });
        }
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Failed to login',
        });
    }
};
exports.login = login;
// Get current user (verify token)
const getCurrentUser = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({
                error: 'No token provided',
            });
        }
        const decoded = (0, jwt_1.verifyToken)(token);
        if (!decoded) {
            return res.status(401).json({
                error: 'Invalid or expired token',
            });
        }
        const user = await db_1.default.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                githubConnected: true,
                githubUsername: true,
                bitbucketConnected: true,
                bitbucketUsername: true,
                createdAt: true,
            },
        });
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
            });
        }
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                githubConnected: user.githubConnected || false,
                githubUsername: user.githubUsername || undefined,
                bitbucketConnected: user.bitbucketConnected || false,
                bitbucketUsername: user.bitbucketUsername || undefined,
            },
        });
    }
    catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Invalid or expired token',
            });
        }
        console.error('Get current user error:', error);
        res.status(500).json({
            error: 'Failed to get user',
        });
    }
};
exports.getCurrentUser = getCurrentUser;
// Update user profile
const updateProfile = async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({
                error: 'No token provided',
            });
        }
        const decoded = (0, jwt_1.verifyToken)(token);
        if (!decoded) {
            return res.status(401).json({
                error: 'Invalid or expired token',
            });
        }
        const updateSchema = zod_1.z.object({
            name: zod_1.z.string().min(1).optional(),
            avatar: zod_1.z.string().url().optional().nullable(),
        });
        const validated = updateSchema.parse(req.body);
        const user = await db_1.default.user.update({
            where: { id: decoded.userId },
            data: validated,
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                githubConnected: true,
                githubUsername: true,
                bitbucketConnected: true,
                bitbucketUsername: true,
                createdAt: true,
            },
        });
        // Create audit log for settings update
        await (0, auditLog_1.createAuditLog)({
            userId: decoded.userId,
            action: 'settings_updated',
            entityType: 'user',
            entityId: decoded.userId,
            details: validated,
            ipAddress: req.ip || req.socket.remoteAddress || undefined,
            userAgent: req.get('user-agent') || undefined,
        });
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                githubConnected: user.githubConnected || false,
                githubUsername: user.githubUsername || undefined,
                bitbucketConnected: user.bitbucketConnected || false,
                bitbucketUsername: user.bitbucketUsername || undefined,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.issues,
            });
        }
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Invalid or expired token',
            });
        }
        console.error('Update profile error:', error);
        res.status(500).json({
            error: 'Failed to update profile',
        });
    }
};
exports.updateProfile = updateProfile;
