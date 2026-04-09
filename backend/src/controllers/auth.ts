import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import prisma from '../db';
import { createAuditLog } from '../services/auditLog';
import { signToken, verifyToken } from '../utils/jwt';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Validation schemas
const signupSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required'),
});

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

// Signup
export const signup = async (req: Request, res: Response) => {
    try {
        const validated = signupSchema.parse(req.body);

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: validated.email.toLowerCase() },
        });

        if (existingUser) {
            return res.status(400).json({
                error: 'User with this email already exists',
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(validated.password, 10);

        // Create user
        const user = await prisma.user.create({
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
        const token = signToken(
            { userId: user.id, email: user.email },
            JWT_EXPIRES_IN
        );

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
    } catch (error: any) {
        if (error instanceof z.ZodError) {
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

// Login
export const login = async (req: Request, res: Response) => {
    try {
        const validated = loginSchema.parse(req.body);

        // Find user
        const user = await prisma.user.findUnique({
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
        const isValidPassword = await bcrypt.compare(validated.password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Invalid email or password',
            });
        }

        // Generate JWT token
        const token = signToken(
            { userId: user.id, email: user.email },
            JWT_EXPIRES_IN
        );

        // Create audit log for login
        await createAuditLog({
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
    } catch (error: any) {
        if (error instanceof z.ZodError) {
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

// Get current user (verify token)
export const getCurrentUser = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                error: 'No token provided',
            });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({
                error: 'Invalid or expired token',
            });
        }

        const user = await prisma.user.findUnique({
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
    } catch (error: any) {
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

// Update user profile
export const updateProfile = async (req: Request, res: Response) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                error: 'No token provided',
            });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(401).json({
                error: 'Invalid or expired token',
            });
        }

        const updateSchema = z.object({
            name: z.string().min(1).optional(),
            avatar: z.string().url().optional().nullable(),
        });

        const validated = updateSchema.parse(req.body);

        const user = await prisma.user.update({
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
        await createAuditLog({
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
    } catch (error: any) {
        if (error instanceof z.ZodError) {
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
