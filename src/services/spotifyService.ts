import axios from 'axios';
import crypto from 'crypto';
import qs from 'querystring';
import fs from 'fs';
import path from 'path';

// Configuration
const CLIENT_ID = 'a8c488be90ae4626a301e5f84c7135e6';
export const REDIRECT_URI = 'http://127.0.0.1:8888/spotify/callback';
const TOKEN_URI = 'https://accounts.spotify.com/api/token';

// Token storage file
const TOKEN_FILE = path.join(process.cwd(), 'spotify_token.json');

let codeVerifier: string | null = null;

// Token storage interface
interface TokenData {
  refresh_token: string;
  access_token?: string;
  expires_at?: number;
}

// Helper functions for token storage
function saveToken(tokenData: TokenData): void {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
  } catch (error) {
    console.error('Failed to save token:', error);
  }
}

function loadToken(): TokenData | null {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load token:', error);
  }
  return null;
}

function clearToken(): void {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
  } catch (error) {
    console.error('Failed to clear token:', error);
  }
}

export function generateVerifier(): string {
  codeVerifier = crypto.randomBytes(64).toString('hex');
  return codeVerifier;
}

export function generateChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function isAuthenticated(): boolean {
  const tokenData = loadToken();
  return tokenData?.refresh_token !== null && tokenData?.refresh_token !== undefined;
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
  
  // Save tokens persistently
  const tokenData: TokenData = {
    refresh_token: resp.data.refresh_token,
    access_token: resp.data.access_token,
    expires_at: Date.now() + (resp.data.expires_in * 1000)
  };
  
  saveToken(tokenData);
  return resp.data.access_token;
}

export async function getAccessToken(): Promise<string> {
  const tokenData = loadToken();
  
  if (!tokenData?.refresh_token) {
    throw new Error('Not authenticated. Please login first.');
  }
  
  // Check if we have a valid access token
  if (tokenData.access_token && tokenData.expires_at && Date.now() < tokenData.expires_at) {
    return tokenData.access_token;
  }
  
  // Access token expired or missing, refresh it
  try {
    const body = qs.stringify({
      grant_type: 'refresh_token',
      refresh_token: tokenData.refresh_token,
      client_id: CLIENT_ID
    });
    
    const resp = await axios.post(TOKEN_URI, body, {
      headers: {'Content-Type': 'application/x-www-form-urlencoded'}
    });
    
    // Update stored tokens
    const updatedTokenData: TokenData = {
      refresh_token: resp.data.refresh_token || tokenData.refresh_token, // Keep old refresh token if new one not provided
      access_token: resp.data.access_token,
      expires_at: Date.now() + (resp.data.expires_in * 1000)
    };
    
    saveToken(updatedTokenData);
    return resp.data.access_token;
    
  } catch (error: any) {
    if (error.response?.data?.error === 'invalid_grant') {
      // Refresh token is invalid, clear it and throw authentication error
      clearToken();
      throw new Error('Authentication expired. Please login again.');
    }
    throw error;
  }
}

// Function to clear authentication (for logout)
export function logout(): void {
  clearToken();
}
