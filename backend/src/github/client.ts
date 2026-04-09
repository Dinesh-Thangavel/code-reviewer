import axios from 'axios';
import { githubConfig } from '../config/github';

export const createGitHubClient = (installationId: string) => {
    // In a real app, you would exchange the installationId and private key for an access token.
    // For now, we will use a placeholder token as requested.
    const token = `installation_token_placeholder_${installationId}`;

    return axios.create({
        baseURL: 'https://api.github.com',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
        },
    });
};
