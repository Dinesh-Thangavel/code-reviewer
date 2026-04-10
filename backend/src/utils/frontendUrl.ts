/**
 * Base URL for OAuth redirects and email links. Must always include a scheme;
 * otherwise browsers treat Location as a relative path (e.g. under /api/auth/github/...).
 */
export function getFrontendBaseUrl(): string {
    const raw = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');
    if (/^https?:\/\//i.test(raw)) {
        return raw;
    }
    if (/^localhost\b|^127\./i.test(raw)) {
        return `http://${raw}`;
    }
    return `https://${raw}`;
}
