/**
 * Maps thrown errors from GitHub OAuth callback to a short, URL-safe code for /login?error=
 */
export function oauthCallbackErrorCode(error: unknown): string {
    const err = error as any;
    const msg = String(err?.message ?? error ?? '');
    const lower = msg.toLowerCase();

    if (
        lower.includes('redirect_uri') ||
        lower.includes('not associated with this application') ||
        err?.response?.data?.error === 'redirect_uri_mismatch'
    ) {
        return 'oauth_redirect_mismatch';
    }
    if (
        lower.includes('incorrect_client_credentials') ||
        lower.includes('bad_client_id') ||
        err?.response?.data?.error === 'incorrect_client_credentials'
    ) {
        return 'oauth_bad_credentials';
    }
    if (lower.includes('bad_verification_code') || err?.response?.data?.error === 'bad_verification_code') {
        return 'oauth_bad_code';
    }
    if (
        lower.includes('github oauth credentials not configured') ||
        lower.includes('check github_oauth_client_id')
    ) {
        return 'oauth_not_configured';
    }
    if (lower.includes('failed to fetch github user') || lower.includes('failed to fetch github user information')) {
        return 'oauth_github_user';
    }
    if (
        lower.includes('prisma') ||
        lower.includes('unique constraint') ||
        lower.includes("can't reach database") ||
        lower.includes('econnrefused') ||
        err?.code === 'P2002'
    ) {
        return 'db_error';
    }
    if (lower.includes('failed to exchange authorization code')) {
        return 'oauth_token_exchange';
    }
    return 'oauth_failed';
}
