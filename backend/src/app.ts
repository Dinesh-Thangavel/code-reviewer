import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { router as healthRouter } from './routes/health';
import { router as apiRouter } from './routes/api';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: process.env.CORS_ALLOWLIST ? process.env.CORS_ALLOWLIST.split(',').map(o => o.trim()) : '*',
    credentials: true,
}));
app.use(helmet());
app.use(morgan('dev'));

// Basic rate limiting to reduce abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 900, // 900 requests per 15 min per IP
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Routes
app.use('/health', healthRouter);
app.use('/api', apiRouter);

export default app;
