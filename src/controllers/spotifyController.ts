import { Request, Response } from 'express';
import {
  generateVerifier,
  generateChallenge,
  exchangeCodeForTokens,
  getAccessToken,
  isAuthenticated,
  REDIRECT_URI
} from '../services/spotifyService';
import axios from 'axios';

const AUTH_URI = 'https://accounts.spotify.com/authorize';
const SCOPES = [
  'user-top-read',
  'user-read-playback-state',
  'user-modify-playback-state'
].join(' ');

export async function login(req: Request, res: Response) {
  const verifier = generateVerifier();
  const challenge = generateChallenge(verifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: 'a8c488be90ae4626a301e5f84c7135e6',
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge
  });
  res.redirect(`${AUTH_URI}?${params.toString()}`);
}

export async function callback(req: Request, res: Response) {
  try {
    const code = req.query.code as string;
    const accessToken = await exchangeCodeForTokens(code);
    res.send(`
      <h2>Success! 🎉</h2>
      <p>Access token saved and server ready.</p>
      <p>Top </p>
      <p>Use <code>/spotify/top</code>, <code>/spotify/current</code>, <code>/spotify/pause</code>, <code>/spotify/play?uri=...</code></p>
      
      <h3>API Endpoints:</h3>
      <ul>
        <li><a href="/spotify/status" target="_blank">Status Check</a> - Check authentication status</li>
        <li><a href="/spotify/top" target="_blank">Top Tracks</a> - Get your top 10 tracks</li>
        <li><a href="/spotify/current" target="_blank">Current Track</a> - Get currently playing track</li>
        <li><a href="/spotify/pause" target="_blank">Pause</a> - Pause playback (PUT request)</li>
        <li><a href="/spotify/play?uri=spotify:track:4iV5W9uYEdYUVa79Axb7Rh" target="_blank">Play Track</a> - Play a specific track (PUT request)</li>
      </ul>
      
      <p><strong>Note:</strong> For play/pause endpoints, you'll need to use a tool like Postman or curl since they require PUT requests.</p>
    `);
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).send(`
      <h2>Authentication Error</h2>
      <p>Failed to authenticate with Spotify. Please try again.</p>
      <a href="/spotify/login">Login Again</a>
    `);
  }
}

export async function topTracks(req: Request, res: Response) {
  try {
    if (!isAuthenticated()) {
      return res.redirect('/spotify/login');
    }
    
    const token = await getAccessToken();
    const data = (await axios.get('https://api.spotify.com/v1/me/top/tracks?limit=10', {
      headers: { Authorization: `Bearer ${token}` }
    })).data.items;
    res.json(data.map((t: any) => ({
      id: t.id,
      name: t.name,
      artists: t.artists.map((a: any) => a.name).join(', '),
      uri: t.uri,
      album: t.album.name,
      albumArt: t.album.images[0]?.url
    })));
  } catch (error: any) {
    console.error('Top tracks error:', error);
    if (error.message.includes('Not authenticated') || error.message.includes('Authentication expired')) {
      return res.redirect('/spotify/login');
    }
    res.status(500).json({ error: 'Failed to fetch top tracks' });
  }
}

export async function current(req: Request, res: Response) {
  try {
    if (!isAuthenticated()) {
      return res.redirect('/spotify/login');
    }
    
    const token = await getAccessToken();
    const { data } = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!data?.item) return res.json({ playing: false });
    const t = data.item;
    res.json({
      playing: data.is_playing,
      track: {
        id: t.id, name: t.name,
        artists: t.artists.map((a: any) => a.name).join(', '),
        uri: t.uri, albumArt: t.album.images[0]?.url, progress_ms: data.progress_ms
      }
    });
  } catch (error: any) {
    console.error('Current track error:', error);
    if (error.message.includes('Not authenticated') || error.message.includes('Authentication expired')) {
      return res.redirect('/spotify/login');
    }
    res.status(500).json({ error: 'Failed to fetch current track' });
  }
}

export async function pause(req: Request, res: Response) {
  try {
    if (!isAuthenticated()) {
      return res.redirect('/spotify/login');
    }
    
    const token = await getAccessToken();
    await axios.put('https://api.spotify.com/v1/me/player/pause', null, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Pause error:', error);
    if (error.message.includes('Not authenticated') || error.message.includes('Authentication expired')) {
      return res.redirect('/spotify/login');
    }
    res.status(500).json({ error: 'Failed to pause playback' });
  }
}

export async function play(req: Request, res: Response) {
  try {
    if (!isAuthenticated()) {
      return res.redirect('/spotify/login');
    }
    
    const uri = req.query.uri as string;
    if (!uri) return res.status(400).json({ error: 'Missing uri' });
    const token = await getAccessToken();
    await axios.put('https://api.spotify.com/v1/me/player/play', { uris: [uri] }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Play error:', error);
    if (error.message.includes('Not authenticated') || error.message.includes('Authentication expired')) {
      return res.redirect('/spotify/login');
    }
    res.status(500).json({ error: 'Failed to play track' });
  }
}

export async function status(req: Request, res: Response) {
  res.json({ 
    authenticated: isAuthenticated(),
    message: isAuthenticated() ? 'Ready to use Spotify API' : 'Please login first'
  });
}
