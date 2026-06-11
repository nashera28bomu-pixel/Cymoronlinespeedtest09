/* =============================================
   CYMOR FOOTBALL LIVE — FRONTEND APP
   ============================================= */

const API = '/api';

// ── STATE ──
const state = {
  view: 'live',
  currentPage: 1,
  totalPages: 1,
  streamType: '',
  search: '',
  matches: [],
  filteredMatches: null,
  currentMatch: null,
  currentServerIdx: 0,
  hls: null,
  cache: new Map(),
  abortController: null,
  prevScores: new Map(), // Track scores for goal notifications
};

// ── ELEMENT REFS ──
const $ = id => document.getElementById(id);
const matchesGrid = $('matchesGrid');
const leaguesGrid = $('leaguesGrid');
const matchesSection = $('matchesSection');
const leaguesSection = $('leaguesSection');
const sectionTitle = $('sectionTitle');
const matchCount = $('matchCount');
const pagination = $('pagination');
const searchInput = $('searchInput');
const streamModal = $('streamModal');
const videoPlayer = $('videoPlayer');
const serverList = $('serverList');
const matchMeta = $('matchMeta');
const modalMatchInfo = $('modalMatchInfo');
const modalClose = $('modalClose');
const videoPlaceholder = $('videoPlaceholder');
const videoError = $('videoError');
const videoErrorText = $('videoErrorText');
const btnRetry = $('btnRetry');
const tickerTrack = $('tickerTrack');
const statLive = $('statLive');
const statUpcoming = $('statUpcoming');
const toast = $('toast');
let toastTimer;

// ── TOAST ──
function showToast(msg, duration = 4000) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}

// ── FORMAT TIME (EAT) ──
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(parseInt(ts) * 1000);
  return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' });
}

// ── FALLBACK LOGO ──
function imgWithFallback(src, fallbackEmoji) {
  if (!src) return `<span style="font-size:32px">${fallbackEmoji}</span>`;
  return `<img src="${src}" alt="" style="width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5))" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${fallbackEmoji}',style:'font-size:32px'}))" />`;
}

// ── RENDER MATCH CARD ──
function renderMatchCard(match, index) {
  const isLive = match.match_status === 'live';
  const servers = match.servers || [];
  const scoreHtml = isLive
  ? `<div class="score-wrap">
         <div class="score">${match.homeTeamScore?? '0'}<span class="score-sep"> : </span>${match.awayTeamScore?? '0'}</div>
         <div class="match-time-label">LIVE</div>
       </div>`
    : `<div class="score-wrap">
         <div class="vs-text">VS</div>
         <div class="match-time-label">${formatTime(match.match_time)}</div>
       </div>`;

  return `
    <div class="match-card ${isLive? 'is-live' : ''}" data-index="${index}">
      <div class="card-top">
        <div class="card-league">
          ${match.league_logo? `<img src="${match.league_logo}" alt="" style="width:16px;height:16px;object-fit:contain" onerror="this.style.display='none'" />` : ''}
          ${match.league_name || 'Unknown League'}
        </div>
        <div class="card-status ${isLive? 'live' : 'upcoming'}">${isLive? '● LIVE' : 'UPCOMING'}</div>
      </div>
      <div class="teams">
        <div class="team">
          ${imgWithFallback(match.home_team_logo, '🏠')}
          <div class="team-name">${match.home_team_name}</div>
        </div>
        ${scoreHtml}
        <div class="team">
          ${imgWithFallback(match.away_team_logo, '✈️')}
          <div class="team-name">${match.away_team_name}</div>
        </div>
      </div>
      <div class="card-footer">
        <div class="servers-count">📡 <span>${servers.length}</span> server${servers.length!== 1? 's' : ''}</div>
        <button class="watch-btn" data-index="${index}">▶ Watch</button>
      </div>
    </div>`;
}

// ── RENDER LEAGUE CARD ──
function renderLeagueCard(league) {
  const name = (league.league_name || league.name || 'Unknown').replace(/'/g, "\\'");
  return `
    <div class="league-card" data-league="${name}">
      ${league.league_logo? `<img src="${league.league_logo}" alt="" style="width:36px;height:36px;object-fit:contain" onerror="this.style.display='none'" />` : '<span style="font-size:28px">🏆</span>'}
      <div class="league-info">
        <div class="league-name">${league.league_name || league.name || 'Unknown'}</div>
        <div class="league-matches">${league.match_count?? ''} matches</div>
      </div>
    </div>`;
}

// ── TICKER ──
function buildTicker(matches) {
  if (!matches.length) {
    tickerTrack.innerHTML = '<span class="ticker-loading">No live matches right now</span>';
    return;
  }
  tickerTrack.innerHTML = matches.slice(0, 20).map(m => {
    const isLive = m.match_status === 'live';
    return `<div class="ticker-item">
      ${isLive? '<span class="live-badge">● LIVE</span>' : ''}
      ${m.home_team_name} <span class="score">${isLive? `${m.homeTeamScore?? 0} - ${m.awayTeamScore?? 0}` : 'vs'}</span> ${m.away_team_name}
      <em style="font-size:10px;opacity:0.5">${m.league_name || ''}</em>
    </div>`;
  }).join('');
}

// ── CHECK FOR GOALS ──
function checkForGoals(matches) {
  matches.forEach(m => {
    if (m.match_status!== 'live') return;
    const key = `${m.home_team_name}_${m.away_team_name}`;
    const prev = state.prevScores.get(key);
    const curr = `${m.homeTeamScore?? 0}-${m.awayTeamScore?? 0}`;

    if (prev && prev!== curr) {
      const [h, a] = curr.split('-');
      const [ph, pa] = prev.split('-');
      if (h > ph) showToast(`⚽ GOAL! ${m.home_team_name} ${curr} ${m.away_team_name}`);
      if (a > pa) showToast(`⚽ GOAL! ${m.home_team_name} ${curr} ${m.away_team_name}`);
    }
    state.prevScores.set(key, curr);
  });
}

// ── CACHED FETCH ──
async function cachedFetch(url) {
  const now = Date.now();
  const cached = state.cache.get(url);
  if (cached && now - cached.time < 120000) return cached.data;

  if (state.abortController) state.abortController.abort();
  state.abortController = new AbortController();

  const res = await fetch(url, { signal: state.abortController.signal });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load');

  state.cache.set(url, { data, time: now });
  return data;
}

// ── LOAD MATCHES ──
async function loadMatches(page = 1) {
  matchesSection.classList.remove('hidden');
  leaguesSection.classList.add('hidden');
  matchesGrid.innerHTML = `<div class="skeleton-grid">${Array(6).fill('<div class="skeleton-card"></div>').join('')}</div>`;
  pagination.innerHTML = '';
  state.filteredMatches = null;

  const params = new URLSearchParams({ status: 'live', page });
  if (state.streamType) params.append('type', state.streamType);
  const url = `${API}/matches?${params}`;

  try {
    const data = await cachedFetch(url);
    let allMatches = data.matches || [];

    // World Cup filter - includes live + today's WC matches
    if (state.view === 'worldcup') {
      const today = new Date().toISOString().split('T')[0];
      allMatches = allMatches.filter(m => {
        const isWC = m.league_name?.toLowerCase().includes('world cup') ||
                     m.league_name?.toLowerCase().includes('fifa');
        const matchDate = new Date(parseInt(m.match_time) * 1000).toISOString().split('T')[0];
        return isWC && (m.match_status === 'live' || matchDate === today);
      });
    }

    // Check for goals before updating state
    if (state.view === 'live' || state.view === 'worldcup') checkForGoals(allMatches);

    state.matches = allMatches;
    state.totalPages = data.pagination?.totalPages || 1;
    state.currentPage = page;

    if (state.view === 'live' || state.view === 'worldcup') {
      statLive.textContent = allMatches.length;
      buildTicker(allMatches);
    } else if (state.view === 'vs') {
      statUpcoming.textContent = data.pagination?.total || allMatches.length;
    }

    sectionTitle.textContent =
      state.view === 'live'? '🔴 Live Matches' :
      state.view === 'worldcup'? '🏆 FIFA World Cup' :
      '📅 Upcoming Matches';

    let toRender = allMatches;
    if (state.search) {
      const q = state.search.toLowerCase();
      toRender = allMatches.filter(m =>
        m.home_team_name?.toLowerCase().includes(q) ||
        m.away_team_name?.toLowerCase().includes(q) ||
        m.league_name?.toLowerCase().includes(q)
      );
      state.filteredMatches = toRender;
    }

    matchCount.textContent = `${toRender.length} match${toRender.length!== 1? 'es' : ''}`;

    if (!toRender.length) {
      matchesGrid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚽</div><p>No ${state.view === 'worldcup'? 'World Cup' : state.view === 'live'? 'live' : 'upcoming'} matches right now.</p></div>`;
      return;
    }

    matchesGrid.innerHTML = toRender.map((m, i) => renderMatchCard(m, i)).join('');
    renderPagination();
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error(err);
    matchesGrid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load matches. Try again.</p></div>`;
  }
}
window.loadMatches = loadMatches;

// ── LOAD LEAGUES ──
async function loadLeagues() {
  matchesSection.classList.add('hidden');
  leaguesSection.classList.remove('hidden');
  sectionTitle.textContent = '🏆 Available Leagues';
  leaguesGrid.innerHTML = `<div class="skeleton-grid">${Array(8).fill('<div class="skeleton-card skeleton-league"></div>').join('')}</div>`;

  try {
    const data = await cachedFetch(`${API}/leagues`);
    const leagues = data.leagues || data || [];
    if (!leagues.length) {
      leaguesGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">🏆</div><p>No leagues found.</p></div>';
      return;
    }
    leaguesGrid.innerHTML = leagues.map(renderLeagueCard).join('');
  } catch (err) {
    if (err.name!== 'AbortError') {
      leaguesGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load leagues.</p></div>';
    }
  }
}

// ── PAGINATION ──
function renderPagination() {
  if (state.totalPages <= 1) return;
  const btns = [];
  btns.push(`<button class="page-btn" ${state.currentPage === 1? 'disabled' : ''} onclick="loadMatches(${state.currentPage - 1})">← Prev</button>`);
  for (let i = 1; i <= state.totalPages; i++) {
    if (i === 1 || i === state.totalPages || Math.abs(i - state.currentPage) <= 1) {
      btns.push(`<button class="page-btn ${i === state.currentPage? 'active' : ''}" onclick="loadMatches(${i})">${i}</button>`);
    } else if (Math.abs(i - state.currentPage) === 2) {
      btns.push(`<span style="color:var(--text-dim);padding:0 4px">…</span>`);
    }
  }
  btns.push(`<button class="page-btn" ${state.currentPage === state.totalPages? 'disabled' : ''} onclick="loadMatches(${state.currentPage + 1})">Next →</button>`);
  pagination.innerHTML = btns.join('');
}

// ── EVENT DELEGATION ──
matchesGrid.addEventListener('click', e => {
  const watchBtn = e.target.closest('.watch-btn');
  const card = e.target.closest('.match-card');
  const target = watchBtn || card;
  if (!target) return;

  const idx = parseInt(target.dataset.index?? card?.dataset.index);
  if (isNaN(idx)) return;

  const pool = state.filteredMatches || state.matches;
  const match = pool[idx];
  if (match) openStream(match);
});

leaguesGrid.addEventListener('click', e => {
  const card = e.target.closest('.league-card');
  if (!card) return;
  const league = card.dataset.league;
  if (league) filterByLeague(league);
});

// ── FILTER BY LEAGUE ──
function filterByLeague(leagueName) {
  state.view = 'live';
  state.search = leagueName;
  searchInput.value = leagueName;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-filter="live"]').classList.add('active');
  state.cache.clear();
  loadMatches(1);
  matchesSection.scrollIntoView({ behavior: 'smooth' });
}

// ── OPEN STREAM MODAL ──
function openStream(match) {
  state.currentMatch = match;
  state.currentServerIdx = 0;

  const isLive = match.match_status === 'live';
  const scoreStr = isLive? `${match.homeTeamScore?? 0} – ${match.awayTeamScore?? 0}` : '';

  modalMatchInfo.innerHTML = `
    <div>
      <div class="modal-teams">${match.home_team_name} vs ${match.away_team_name}</div>
      <div class="modal-league">${match.league_name || ''}</div>
    </div>
    ${scoreStr? `<div class="modal-score">${scoreStr}</div>` : ''}
    ${isLive? '<div class="card-status live">● LIVE</div>' : `<div class="card-status upcoming">${formatTime(match.match_time)} EAT</div>`}
  `;

  const servers = match.servers || [];
  serverList.innerHTML = servers.length
  ? servers.map((srv, i) => `
        <button class="server-btn ${i === 0? 'active' : ''}" data-idx="${i}">
          ${srv.name || `Server ${i + 1}`}
          <span class="type-badge ${srv.type || 'direct'}">${srv.type || 'direct'}</span>
        </button>`).join('')
    : '<p style="color:var(--text-dim);font-size:13px">No streams available.</p>';

  serverList.onclick = e => {
    const btn = e.target.closest('.server-btn');
    if (!btn) return;
    playServer(parseInt(btn.dataset.idx));
  };

  matchMeta.innerHTML = `
    <div class="meta-tag">⏰ <strong>Kick-off:</strong> ${formatTime(match.match_time)} EAT</div>
    <div class="meta-tag">📡 <strong>Servers:</strong> ${servers.length}</div>
    <div class="meta-tag">🏆 <strong>League:</strong> ${match.league_name || 'N/A'}</div>
  `;

  videoPlaceholder.classList.remove('hidden');
  videoError.classList.add('hidden');
  videoPlayer.style.display = 'none';
  streamModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  if (servers.length > 0) playServer(0);
}

// ── PLAY SERVER ──
function playServer(idx) {
  const match = state.currentMatch;
  const servers = match?.servers || [];
  if (!servers[idx]) return;

  state.currentServerIdx = idx;
  document.querySelectorAll('.server-btn').forEach((b, i) => b.classList.toggle('active', i === idx));

  const server = servers[idx];
  let url = server.url;
  const type = server.type || 'direct';
  const ua = server.header?.['user-agent'] || 'Mozilla/5.0';
  const referer = server.header?.referer;

  videoError.classList.add('hidden');
  videoPlaceholder.classList.add('hidden');
  videoPlayer.style.display = 'block';

  if (state.hls) { state.hls.destroy(); state.hls = null; }

  if (type === 'referer' && referer) {
    url = `/api/stream-proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}&userAgent=${encodeURIComponent(ua)}`;
  }

  if (type === 'drm') {
    url = url.split('|')[0];
    showToast('⚠️ DRM stream — may require extra browser permissions');
  }

  if (Hls.isSupported()) {
    const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    state.hls = hls;
    hls.loadSource(url);
    hls.attachMedia(videoPlayer);
    hls.on(Hls.Events.MANIFEST_PARSED, () => videoPlayer.play().catch(() => {}));
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) showStreamError(`Server ${idx + 1} failed. Try another.`);
    });
  } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
    videoPlayer.src = url;
    videoPlayer.play().catch(() => {});
  } else {
    showStreamError('HLS not supported in this browser.');
  }

  videoPlayer.onerror = () => showStreamError(`Server ${idx + 1} unavailable.`);
}

// ── STREAM ERROR ──
function showStreamError(msg) {
  videoPlayer.style.display = 'none';
  videoError.classList.remove('hidden');
  videoPlaceholder.classList.add('hidden');
  videoErrorText.textContent = msg;
}

// ── RETRY ──
btnRetry.addEventListener('click', () => {
  const servers = state.currentMatch?.servers || [];
  const next = state.currentServerIdx + 1;
  if (next < servers.length) playServer(next);
  else showToast('No more servers available for this match.');
});

// ── CLOSE MODAL ──
function closeModal() {
  if (state.hls) { state.hls.destroy(); state.hls = null; }
  videoPlayer.pause();
  videoPlayer.src = '';
  streamModal.classList.add('hidden');
  document.body.style.overflow = '';
}
modalClose.addEventListener('click', closeModal);
streamModal.addEventListener('click', e => { if (e.target === streamModal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── NAV BUTTONS ──
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.view = btn.dataset.filter;
    state.currentPage = 1;
    state.search = '';
    searchInput.value = '';
    state.cache.clear();
    if (state.view === 'leagues') loadLeagues();
    else loadMatches(1);
  });
});

// ── STREAM TYPE FILTERS ──
document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.streamType = chip.dataset.type;
    state.cache.clear();
    if (state.view!== 'leagues') loadMatches(1);
  });
});

// ── SEARCH ──
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = searchInput.value.trim();
    if (state.view!== 'leagues') {
      if (state.search) {
        const q = state.search.toLowerCase();
        const filtered = state.matches.filter(m =>
          m.home_team_name?.toLowerCase().includes(q) ||
          m.away_team_name?.toLowerCase().includes(q) ||
          m.league_name?.toLowerCase().includes(q)
        );
        state.filteredMatches = filtered;
        matchCount.textContent = `${filtered.length} match${filtered.length!== 1? 'es' : ''}`;
        matchesGrid.innerHTML = filtered.length
        ? filtered.map((m, i) => renderMatchCard(m, i)).join('')
          : `<div class="empty-state"><div class="empty-icon">🔍</div><p>No results for "${state.search}"</p></div>`;
      } else {
        state.filteredMatches = null;
        matchesGrid.innerHTML = state.matches.map((m, i) => renderMatchCard(m, i)).join('');
        matchCount.textContent = `${state.matches.length} match${state.matches.length!== 1? 'es' : ''}`;
      }
    }
  }, 300);
});

// ── SMART AUTO REFRESH ──
setInterval(() => {
  if (!document.hidden && (state.view === 'live' || state.view === 'worldcup') && streamModal.classList.contains('hidden')) {
    state.cache.clear();
    loadMatches(state.currentPage);
  }
}, 30000);

// ── INIT ──
(async () => {
  await loadMatches(1);
  try {
    const data = await cachedFetch(`${API}/matches?status=vs&page=1`);
    statUpcoming.textContent = data.pagination?.total || (data.matches?.length || 0);
  } catch {}
})();
