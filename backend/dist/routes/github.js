"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const github_1 = require("../controllers/github");
exports.router = (0, express_1.Router)();
// Use raw body for signature verification
exports.router.post('/webhook', express_2.default.raw({ type: 'application/json' }), github_1.handleWebhook);
exports.router.get('/test', github_1.testGitHubConnection);
exports.router.get('/app-installation-url', github_1.getInstallationUrl);
exports.router.post('/sync', github_1.syncRepository);
