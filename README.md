# ⚽ Cymor Football Live

Live football streaming platform covering 50+ leagues worldwide.  
Built by **Cymor Tech Services**.

---

## Features

- 🔴 Live match streaming with real-time scores
- 📅 Upcoming match schedule
- 📡 Up to 13 streaming servers per match (HLS/FLV + MPEG-DASH)
- 🔍 Search by team or league
- 🏆 League browser
- 📱 Mobile responsive + PWA installable
- 🔄 Auto-refresh every 60 seconds

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/cymor-football-live.git
cd cymor-football-live
npm install
```

### 2. Set Environment Variables

```bash
cp .env.example .env
# Edit .env and add your RAPIDAPI_KEY
```

Get your key at:  
👉 https://rapidapi.com/1xapi-rapid-team/api/football-live-streaming-api

### 3. Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## Deploy to Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo
4. Add env var: `RAPIDAPI_KEY` = your key
5. Deploy ✅

---

## Project Structure

```
cymor-football-live/
├── server.js           # Express backend + API proxy
├── package.json
├── render.yaml         # Render deployment config
├── .env.example
└── public/
    ├── index.html      # Frontend
    ├── manifest.json   # PWA manifest
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

---

## API Endpoints (Backend)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/matches?status=live&page=1` | Live matches |
| GET | `/api/matches?status=vs&page=1` | Upcoming matches |
| GET | `/api/leagues` | All leagues |
| GET | `/api/stream-proxy?url=...` | HLS stream proxy (for referer streams) |

---

## Tech Stack

- **Backend**: Node.js + Express (ES Modules)
- **Frontend**: Vanilla JS + HLS.js
- **Streaming API**: 1xapi/football-live-streaming-api (RapidAPI)
- **Deploy**: Render (free tier)

---

*Cymor Tech Services — Always a Winner 🏆*
