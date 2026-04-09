"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const health_1 = require("./routes/health");
const api_1 = require("./routes/api");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cors_1.default)({
    origin: process.env.CORS_ALLOWLIST ? process.env.CORS_ALLOWLIST.split(',').map(o => o.trim()) : '*',
    credentials: true,
}));
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
// Basic rate limiting to reduce abuse
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 900, // 900 requests per 15 min per IP
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
// Routes
app.use('/health', health_1.router);
app.use('/api', api_1.router);
exports.default = app;
