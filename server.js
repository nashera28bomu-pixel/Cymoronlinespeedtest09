import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'football-live-streaming-api.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// Fail fast if key missing
if (!RAPIDAPI_KEY) {
  console.error('❌ RAPIDAPI_KEY missing in .env');
  process.exit(1);
}

const apiHeaders = {
  'X-RapidAPI-Key': RAPIDAPI_KEY,
  'X-RapidAPI-Host': RAPIDAPI_HOST,
};

// ── Simple in-memory cache ──
const cache = new Map();
const CACHE_TTL = 120000; // 2 minutes

function getCacheKey(route, query) {
  return `${route}_${JSON.stringify(query)}`;
}

function getCached(route, query) {
  const key = getCacheKey(route, query);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_TTL) {
    return hit.data;
  }
  cache.delete(key);
  return null;
}

function setCache(route, query, data) {
  const key = getCacheKey(route, query);
  cache.set(key, { data, time: Date.now() });
}

// ── GET /api/matches ──
app.get('/api/matches', async (req, res) => {
  try {
    const { status = 'live', page = 1, league, type, date } = req.query;
    const cached = getCached('matches', req.query);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'public, max-age=120');
      return res.json(cached);
    }

    const params = new URLSearchParams({ page });
    if (status) params.append('status', status);
    if (league) params.append('league', league);
    if (type) params.append('type', type);
    if (date) params.append('date', date);

    const response = await fetch(`${BASE_URL}/matches?${params}`, { headers: apiHeaders });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'API request failed', status: response.status });
    }

    const data = await response.json();
    setCache('matches', req.query, data);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json(data);
  } catch (err) {
    console.error('Matches error:', err);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// ── GET /api/leagues ──
app.get('/api/leagues', async (req, res) => {
  try {
    const cached = getCached('leagues', req.query);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.json(cached);
    }

    const { page = 1 } = req.query;
    const response = await fetch(`${BASE_URL}/leagues?page=${page}`, { headers: apiHeaders });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'API request failed' });
    }

    const data = await response.json();
    setCache('leagues', req.query, data);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(data);
  } catch (err) {
    console.error('Leagues error:', err);
    res.status(500).json({ error: 'Failed to fetch leagues' });
  }
});

// ── GET /api/stream-proxy ──
// Secure proxy: only allows .m3u8 and common CDN domains
app.get('/api/stream-proxy', async (req, res) => {
  try {
    const { url, referer, userAgent } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url param' });

    // Block open proxy abuse
    const allowed = url.endsWith('.m3u8') || 
                    url.includes('akamai') || 
                    url.includes('cloudfront') || 
                    url.includes('m3u8');
    if (!allowed) return res.status(403).json({ error: 'Invalid stream URL' });

    const headers = { 'User-Agent': userAgent || 'Mozilla/5.0' };
    if (referer) headers['Referer'] = referer;

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error('Upstream stream error');

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

    const body = await response.text();
    res.send(body);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: 'Stream proxy failed' });
  }
});

// ── Catch-all: serve frontend ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`⚽ Cymor Football Live running on port ${PORT}`);
});
