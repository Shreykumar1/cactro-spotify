import axios from 'axios';
import crypto from 'crypto';
import qs from 'querystring';

// Configuration
const CLIENT_ID = 'a8c488be90ae4626a301e5f84c7135e6';
export const REDIRECT_URI = 'http://127.0.0.1:8888/spotify/callback';
const TOKEN_URI = 'https://accounts.spotify.com/api/token';

let codeVerifier: string | null = null;
let refreshToken: string | null = null;

export function generateVerifier(): string {
  codeVerifier = crypto.randomBytes(64).toString('hex');
  return codeVerifier;
}

export function generateChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function isAuthenticated(): boolean {
  return refreshToken !== null;
}

export async function exchangeCodeForTokens(code: string): Promise<string> {
  if (!codeVerifier) throw new Error('Missing codeVerifier');
  const body = qs.stringify({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier
  });
  const resp = await axios.post(TOKEN_URI, body, {
    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
  });
  refreshToken = resp.data.refresh_token;
  return resp.data.access_token;
}

export async function getAccessToken(): Promise<string> {
  if (!refreshToken) {
    throw new Error('Not authenticated. Please login first.');
  }
  
  try {
    const body = qs.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID
    });
    const resp = await axios.post(TOKEN_URI, body, {
      headers: {'Content-Type': 'application/x-www-form-urlencoded'}
    });
    return resp.data.access_token;
  } catch (error: any) {
    if (error.response?.data?.error === 'invalid_grant') {
      // Refresh token is invalid, clear it and throw authentication error
      refreshToken = null;
      throw new Error('Authentication expired. Please login again.');
    }
    throw error;
  }
}
