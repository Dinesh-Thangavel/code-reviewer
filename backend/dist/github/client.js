"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGitHubClient = void 0;
const axios_1 = __importDefault(require("axios"));
const createGitHubClient = (installationId) => {
    // In a real app, you would exchange the installationId and private key for an access token.
    // For now, we will use a placeholder token as requested.
    const token = `installation_token_placeholder_${installationId}`;
    return axios_1.default.create({
        baseURL: 'https://api.github.com',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
        },
    });
};
exports.createGitHubClient = createGitHubClient;
