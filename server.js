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

const apiHeaders = {
  'X-RapidAPI-Key': RAPIDAPI_KEY,
  'X-RapidAPI-Host': RAPIDAPI_HOST,
};

// GET /api/matches — fetch live or upcoming matches
app.get('/api/matches', async (req, res) => {
  try {
    const { status = 'live', page = 1, league, type, date } = req.query;
    const params = new URLSearchParams({ page });
    if (status) params.append('status', status);
    if (league) params.append('league', league);
    if (type) params.append('type', type);
    if (date) params.append('date', date);

    const response = await fetch(`${BASE_URL}/matches?${params}`, {
      headers: apiHeaders,
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'API request failed', status: response.status });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Matches error:', err);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// GET /api/leagues — fetch all available leagues
app.get('/api/leagues', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const response = await fetch(`${BASE_URL}/leagues?page=${page}`, {
      headers: apiHeaders,
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'API request failed' });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Leagues error:', err);
    res.status(500).json({ error: 'Failed to fetch leagues' });
  }
});

// GET /api/stream-proxy — proxy HLS stream to handle referer-based streams
app.get('/api/stream-proxy', async (req, res) => {
  try {
    const { url, referer, userAgent } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url param' });

    const headers = { 'User-Agent': userAgent || 'Mozilla/5.0' };
    if (referer) headers['Referer'] = referer;

    const response = await fetch(url, { headers });
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const body = await response.text();
    res.send(body);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Stream proxy failed' });
  }
});

// Catch-all: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`⚽ Cymor Football Live running on port ${PORT}`);
});
