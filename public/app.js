const searchForm = document.getElementById('search-form');
const destinationInput = document.getElementById('destination-input');
const radiusSelect = document.getElementById('radius-select');
const onlyAvailableToggle = document.getElementById('only-available-toggle');
const gpsBtn = document.getElementById('gps-btn');
const sequentialPanel = document.getElementById('sequential-panel');
const resultsContainer = document.getElementById('results-container');

let lastSearchMode = null;
let currentParkingLots = [];
let selectedSequenceIds = [];
let activeSequenceIndex = 0;

function cleanPlaceText(text) {
  if (!text) return '';
  return text
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*（[^）]*）/g, '')
    .replace(/(?:地下室|地下|[Bb]\d(?:-[Bb]?\d)?樓?|[Bb]\d\/[Bb]\d|旁|對面)$/g, '')
    .trim();
}

function formatStopQuery(lot) {
  const cleanName = cleanPlaceText(lot.name);
  const cleanAddr = cleanPlaceText(lot.address);
  const hasExactDoorplate = /\d+(?:之\d+)?號/.test(cleanAddr);
  if (hasExactDoorplate && cleanName && !lot.id.startsWith('tpe-road-')) {
    return cleanAddr.includes(cleanName) ? cleanAddr : `${cleanAddr} ${cleanName}`;
  }
  if (hasExactDoorplate) return cleanAddr;
  return `${lot.lat},${lot.lng}`;
}

function buildMultiStopGoogleMapsUrl(lots) {
  if (!lots || lots.length === 0) return null;
  const queries = lots.map((l) => formatStopQuery(l));
  if (queries.length === 1) {
    const params = new URLSearchParams({
      api: '1',
      query: queries[0]
    });
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }
  const finalDest = queries[queries.length - 1];
  const waypoints = queries.slice(0, -1).join('|');
  const params = new URLSearchParams({
    api: '1',
    destination: finalDest,
    waypoints,
    travelmode: 'driving'
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

async function performSearch() {
  if (!lastSearchMode) return;

  const radius = radiusSelect.value;
  const onlyAvailable = onlyAvailableToggle.checked;

  sequentialPanel.innerHTML = '';
  resultsContainer.innerHTML = `<div class="empty-state">🔍 查詢周邊停車場中...</div>`;

  try {
    let url = '';
    if (lastSearchMode.type === 'coords') {
      const params = new URLSearchParams({
        lat: String(lastSearchMode.lat),
        lng: String(lastSearchMode.lng),
        name: lastSearchMode.name || '手機目前定位',
        radius: String(radius),
        onlyAvailable: String(onlyAvailable)
      });
      url = `/api/parking/nearby?${params.toString()}`;
    } else {
      const q = lastSearchMode.query;
      if (!q) return;
      const params = new URLSearchParams({
        q,
        radius: String(radius),
        onlyAvailable: String(onlyAvailable)
      });
      url = `/api/parking/search?${params.toString()}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      sequentialPanel.innerHTML = '';
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <p>⚠️ ${data.message || '查詢失敗'}</p>
        </div>
      `;
      return;
    }

    currentParkingLots = data.parkingLots || [];
    selectedSequenceIds =
      data.sequentialPlan?.lotIds ||
      currentParkingLots
        .filter((l) => l.canNavigate)
        .slice(0, 3)
        .map((l) => l.id);
    activeSequenceIndex = 0;

    renderSequentialPanel();
    renderParkingLots();
  } catch (err) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <p>⚠️ 網路連線異常，請稍後再試</p>
      </div>
    `;
  }
}

function renderSequentialPanel() {
  const seqLots = selectedSequenceIds
    .map((id) => currentParkingLots.find((l) => l.id === id))
    .filter((l) => l && l.canNavigate);

  if (seqLots.length === 0) {
    sequentialPanel.innerHTML = '';
    return;
  }

  if (activeSequenceIndex >= seqLots.length) {
    activeSequenceIndex = 0;
  }

  const multiStopUrl = buildMultiStopGoogleMapsUrl(seqLots);
  const nextIndex = (activeSequenceIndex + 1) % seqLots.length;
  const nextLot = seqLots[nextIndex];

  const stopsHtml = seqLots
    .map((lot, idx) => {
      const isCurrent = idx === activeSequenceIndex;
      return `
        <div class="seq-stop-item ${isCurrent ? 'active-stop' : ''}">
          <div class="seq-stop-left">
            <span class="seq-rank-badge">#${idx + 1}</span>
            <span>${lot.name} (${lot.distanceMeters}m ‧ ${lot.statusLabel})</span>
          </div>
          <a
            href="${lot.googleMapsNavUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="seq-quick-go"
            data-seq-idx="${idx}"
          >
            🚗 單導
          </a>
        </div>
      `;
    })
    .join('');

  sequentialPanel.innerHTML = `
    <div class="seq-card">
      <div class="seq-header">
        <span class="seq-title">⛓️ 順位備案導航 (${seqLots.length} 站)</span>
      </div>
      <div class="seq-stops-row">
        ${stopsHtml}
      </div>
      <div class="seq-actions-row">
        <a
          href="${multiStopUrl}"
          target="_blank"
          rel="noopener noreferrer"
          class="seq-multi-btn"
          data-testid="seq-multi-nav-btn"
        >
          🗺️ 順位連導 (1→${seqLots.length} 站)
        </a>
        ${
          seqLots.length > 1
            ? `<button type="button" id="seq-next-btn" class="seq-next-btn">
                 ⏭️ 第${activeSequenceIndex + 1}家塞車？秒導第${nextIndex + 1}順位 (${nextLot.name.slice(0, 6)})
               </button>`
            : ''
        }
      </div>
    </div>
  `;

  const nextBtn = document.getElementById('seq-next-btn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      activeSequenceIndex = nextIndex;
      const targetLot = seqLots[activeSequenceIndex];
      renderSequentialPanel();
      if (targetLot && targetLot.googleMapsNavUrl) {
        window.open(targetLot.googleMapsNavUrl, '_blank', 'noopener,noreferrer');
      }
    });
  }
}

function renderParkingLots() {
  if (!currentParkingLots || currentParkingLots.length === 0) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <p>此範圍內沒有找到停車場，建議將搜尋範圍調大。</p>
      </div>
    `;
    return;
  }

  resultsContainer.innerHTML = currentParkingLots
    .map((lot) => {
      const seqPos = selectedSequenceIds.indexOf(lot.id);
      const isInSeq = seqPos !== -1;
      const rankBadgeHtml = isInSeq
        ? `<span class="rank-tag">順位 #${seqPos + 1}</span>`
        : '';

      let actionButtonHtml = '';
      let seqToggleHtml = '';

      if (lot.canNavigate && lot.googleMapsNavUrl) {
        const isUnknown = lot.status === 'UNKNOWN';
        const btnText = isUnknown ? '📍 查看位置 (無即時資料)' : '📍 Google Maps 查看位置';
        actionButtonHtml = `
          <a
            href="${lot.googleMapsNavUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="nav-btn ${isUnknown ? 'unknown-nav' : ''}"
            data-testid="nav-btn-${lot.id}"
          >
            ${btnText}
          </a>`;

        seqToggleHtml = `
          <button
            type="button"
            class="seq-toggle-btn ${isInSeq ? 'in-seq' : ''}"
            data-seq-toggle-id="${lot.id}"
          >
            ${isInSeq ? `✓ 順位 #${seqPos + 1}` : '➕ 排入順位'}
          </button>`;
      } else {
        actionButtonHtml = `
          <button
            type="button"
            class="nav-btn disabled"
            disabled
            aria-disabled="true"
            data-testid="nav-disabled-${lot.id}"
          >
            🔒 0 格已滿位 ‧ 鎖定導航
          </button>`;
      }

      return `
        <article class="parking-card status-${lot.status}" data-lot-id="${lot.id}">
          <div class="card-top">
            <div>
              <div class="lot-title-row">
                ${rankBadgeHtml}
                <h2 class="lot-title">${lot.name}</h2>
              </div>
              <p class="lot-address">${lot.address}</p>
            </div>
            <div style="text-align:right;">
              <span class="distance-pill">${lot.distanceMeters}m</span>
              <div style="font-size:11px; color:#94a3b8; margin-top:4px;">${lot.dataSourceLabel || ''}</div>
            </div>
          </div>

          <div class="vacancy-row vacancy-${lot.status}">
            <span class="vacancy-badge"${lot.statusTooltip ? ` title="${lot.statusTooltip}" style="cursor:help;"` : ''}>${lot.statusLabel}</span>
            <span class="rate-text">${lot.hourlyRate}</span>
          </div>

          <div class="card-actions">
            ${actionButtonHtml}
            ${seqToggleHtml}
          </div>
        </article>
      `;
    })
    .join('');
}

function setControlsLocked(locked) {
  const searchBtn = document.getElementById('search-btn');
  [destinationInput, searchBtn, gpsBtn, radiusSelect, onlyAvailableToggle].forEach((el) => {
    if (el) el.disabled = locked;
  });
}

const LAST_SEARCH_KEY = 'smart_parking_last_search_v1';

function saveLastSearch(mode, inputText) {
  try {
    localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify({ mode, inputText }));
  } catch {}
}

function loadLastSearch() {
  try {
    const raw = localStorage.getItem(LAST_SEARCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.mode) return null;
    if (parsed.mode.type === 'query' && typeof parsed.mode.query === 'string' && parsed.mode.query.trim()) {
      return parsed;
    }
    if (parsed.mode.type === 'coords' && Number.isFinite(parsed.mode.lat) && Number.isFinite(parsed.mode.lng)) {
      return parsed;
    }
  } catch {}
  return null;
}

async function onGpsSuccess(pos) {
  gpsBtn.textContent = '🎯 目前手機定位';
  const { latitude, longitude } = pos.coords;
  const coordText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  destinationInput.value = coordText;
  lastSearchMode = {
    type: 'coords',
    lat: latitude,
    lng: longitude,
    name: '目前手機定位'
  };
  saveLastSearch(lastSearchMode, coordText);
  try {
    await performSearch();
  } finally {
    setControlsLocked(false);
  }
}

function triggerGpsLocation(isManualClick = false) {
  if (!navigator.geolocation) {
    setControlsLocked(false);
    if (isManualClick) {
      resultsContainer.innerHTML = `<div class="empty-state">⚠️ 此瀏覽器環境不支援定位 API</div>`;
    }
    return;
  }

  setControlsLocked(true);
  gpsBtn.textContent = '📡 定位中...';
  resultsContainer.innerHTML = `<div class="empty-state">📡 正在取得您的手機定位，請稍候...<br/><span style="font-size:12px;">（定位完成後將自動開放搜尋與範圍切換）</span></div>`;

  // Stage 1: Try high-accuracy GPS first (best for Pixel phones)
  navigator.geolocation.getCurrentPosition(
    onGpsSuccess,
    () => {
      // Stage 2: Fallback to coarse/network location if satellite GPS times out
      navigator.geolocation.getCurrentPosition(
        onGpsSuccess,
        (err) => {
          gpsBtn.textContent = '🎯 目前手機定位';
          setControlsLocked(false);
          if (isManualClick) {
            const httpsSamePortUrl = `https://${window.location.host}`;
            const isLanHttp =
              window.location.protocol === 'http:' &&
              window.location.hostname !== 'localhost' &&
              window.location.hostname !== '127.0.0.1';
            resultsContainer.innerHTML = `
              <div class="empty-state" style="text-align:left; line-height:1.7;">
                <p style="color:#f87171; font-weight:800; margin-bottom:8px;">⚠️ 定位被手機瀏覽器攔截 (${err.message})</p>
                ${
                  isLanHttp
                    ? `<p style="font-size:13px; color:#cbd5e1; margin-bottom:12px;">因為目前是 <code>http://</code>，Android 規定必須在 <code>https://</code> 下才能讀取手機 GPS。</p>
                       <a href="${httpsSamePortUrl}" class="nav-btn" style="text-decoration:none; display:inline-flex; width:100%;">🔒 點此切換至同埠 HTTPS (${httpsSamePortUrl}) 啟用手機定位</a>`
                    : `<p style="font-size:13px; color:#cbd5e1;">請確認已允許瀏覽器的「位置」權限。</p>`
                }
              </div>
            `;
          } else if (!lastSearchMode) {
            resultsContainer.innerHTML = `<div class="empty-state">⚠️ 無法自動取得手機定位，請手動輸入目的地或再點一次「🎯 目前手機定位」</div>`;
          }
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    },
    { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
  );
}

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = destinationInput.value.trim();
  if (!q) return;
  lastSearchMode = { type: 'query', query: q };
  saveLastSearch(lastSearchMode, q);
  performSearch();
});

radiusSelect.addEventListener('change', () => performSearch());
onlyAvailableToggle.addEventListener('change', () => performSearch());
gpsBtn.addEventListener('click', () => triggerGpsLocation(true));

resultsContainer.addEventListener('click', (e) => {
  const seqToggleBtn = e.target.closest('.seq-toggle-btn');
  if (!seqToggleBtn) return;

  const lotId = seqToggleBtn.dataset.seqToggleId;
  const idx = selectedSequenceIds.indexOf(lotId);
  if (idx !== -1) {
    selectedSequenceIds.splice(idx, 1);
  } else {
    if (selectedSequenceIds.length >= 5) {
      alert('順位導航最多可排入 5 間停車場');
      return;
    }
    selectedSequenceIds.push(lotId);
  }
  activeSequenceIndex = 0;
  renderSequentialPanel();
  renderParkingLots();
});

// Default to last search on this device; fall back to GPS on first visit
const savedSearch = loadLastSearch();
if (savedSearch) {
  lastSearchMode = savedSearch.mode;
  destinationInput.value =
    savedSearch.inputText || (savedSearch.mode.type === 'query' ? savedSearch.mode.query : '');
  performSearch();
} else {
  triggerGpsLocation(false);
}
