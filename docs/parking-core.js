// 線上版（docs/index.html）、同步腳本（scripts/sync-live-parking.mjs）與 Express 版共用的純函式。
// 這裡不碰 DOM、不發網路請求，所以 tests/ 可以直接測到線上版的滿位鎖。

export const TAIPEI_DESC_URL = 'https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_alldesc.xml';
export const TAIPEI_AVAIL_URL = 'https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_allavailable.xml';
export const TAOYUAN_URL =
  'https://opendata.tycg.gov.tw/api/v1/dataset.api_access?rid=0daad6e6-0632-44f5-bd25-5e1de1e9146f&format=json&limit=2000';
export const TAICHUNG_LIVE_URL =
  'https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=4f9c4d26-d826-4277-8f8a-6d2469fe9653';

/** 超過這個時間的空位數不再當成即時資料。 */
export const MAX_DATA_AGE_MS = 30 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;
const LIMITED_THRESHOLD = 10;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeXml(s) {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTITIES[e]);
}

function xmlField(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? decodeXml(m[1]).trim() : '';
}

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

/** 解析「Thu Nov 26 01:05:00 CST 2026」（台北時間 +08:00），失敗回傳 null。 */
export function parseTaipeiUpdateTime(text) {
  const m = String(text ?? '').match(/([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+CST\s+(\d{4})/);
  if (!m || !MONTHS[m[1]]) return null;
  const p = (n) => String(n).padStart(2, '0');
  const t = Date.parse(`${m[6]}-${p(MONTHS[m[1]])}-${p(m[2])}T${m[3]}:${m[4]}:${m[5]}+08:00`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** @returns {{ updatedAt: string|null, spaces: Map<string, number> }} */
export function parseTaipeiAvailability(xml) {
  const spaces = new Map();
  for (const m of xml.matchAll(/<PARK>([\s\S]*?)<\/PARK>/g)) {
    const id = xmlField(m[1], 'ID');
    const raw = xmlField(m[1], 'AVAILABLECAR');
    const n = raw === '' ? NaN : Number(raw);
    if (id && Number.isFinite(n)) spaces.set(id, n);
  }
  return { updatedAt: parseTaipeiUpdateTime(xmlField(xml, 'UPDATETIME')), spaces };
}

export function parseTaipeiDesc(xml) {
  const parks = [];
  for (const m of xml.matchAll(/<PARK>([\s\S]*?)<\/PARK>/g)) {
    const id = xmlField(m[1], 'ID');
    if (!id) continue;
    parks.push({
      id,
      name: xmlField(m[1], 'NAME'),
      area: xmlField(m[1], 'AREA'),
      address: xmlField(m[1], 'ADDRESS'),
      payex: xmlField(m[1], 'PAYEX'),
      totalcar: Number(xmlField(m[1], 'TOTALCAR')) || 0,
      tw97x: Number(xmlField(m[1], 'TW97X')),
      tw97y: Number(xmlField(m[1], 'TW97Y'))
    });
  }
  return parks;
}

/** 新平台的 wgsx / wgsy 與名稱相反（wgsx 是緯度），所以用數值範圍判斷而不是看欄位名。 */
export function parseTaoyuanLots(rows) {
  const lots = [];
  for (const item of Array.isArray(rows) ? rows : []) {
    const a = Number(item.wgsx);
    const b = Number(item.wgsy);
    const lat = [a, b].find((v) => v > 24 && v < 26);
    const lng = [a, b].find((v) => v > 120 && v < 122);
    if (lat === undefined || lng === undefined || !item.parkid) continue;
    const raw = String(item.surplusspace ?? '').trim();
    lots.push({
      id: item.parkid,
      name: item.parkname ?? '',
      area: item.areaname ?? '',
      address: item.address ?? '',
      payGuide: item.payguide ?? '',
      totalSpaces: Number(item.totalspace) || 0,
      availableSpaces: /^\d+$/.test(raw) ? Number(raw) : -1,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6))
    });
  }
  return lots;
}

/** 台中只給燈號：G 有位、Y 較少、R 已滿，其他視為無資料。 */
export function parseTaichungLight(rgb) {
  switch (String(rgb ?? '').toUpperCase()) {
    case 'G':
      return { availableSpaces: -1, liveStatus: 'AVAILABLE' };
    case 'Y':
      return { availableSpaces: -1, liveStatus: 'LIMITED' };
    case 'R':
      return { availableSpaces: 0, liveStatus: 'FULL' };
    default:
      return { availableSpaces: -1 };
  }
}

export function hasVacancyData(lot) {
  return lot.availableSpaces >= 0 || Boolean(lot.liveStatus);
}

/** 沒有資料時間、太舊，或時間明顯在未來，都不能當即時資料。 */
export function isStaleData(dataAt, now = Date.now()) {
  const t = dataAt ? Date.parse(dataAt) : NaN;
  if (!Number.isFinite(t)) return true;
  const age = now - t;
  return age > MAX_DATA_AGE_MS || age < -MAX_CLOCK_SKEW_MS;
}

/** 線上版唯一的車位狀態判斷。滿位（0 格或紅燈）一律 canNavigate = false。 */
export function evaluateVacancy(lot, now = Date.now()) {
  const totalPart = lot.totalSpaces > 0 ? String(lot.totalSpaces) : '?';
  if (hasVacancyData(lot) && isStaleData(lot.dataAt, now)) {
    return {
      status: 'UNKNOWN',
      statusLabel: `⚪ ? / ${totalPart} (無即時資料)`,
      statusTooltip: '',
      canNavigate: true,
      isStale: true
    };
  }

  const isOverCapacity = lot.totalSpaces > 0 && lot.availableSpaces > lot.totalSpaces;
  const shown = isOverCapacity ? lot.totalSpaces : lot.availableSpaces;
  const star = isOverCapacity ? ' *' : '';
  const result = {
    status: 'AVAILABLE',
    statusLabel: `🟢 ${shown} / ${totalPart}${star}`,
    statusTooltip: isOverCapacity ? `原始回傳：${lot.availableSpaces} / ${totalPart}（超過總車位數）` : '',
    canNavigate: true,
    isStale: false
  };

  if (lot.liveStatus === 'FULL' && lot.availableSpaces < 0) {
    return { ...result, status: 'FULL', statusLabel: `🚫 已滿 (紅燈) / ${totalPart}`, canNavigate: false };
  }
  if (lot.availableSpaces === 0) {
    return { ...result, status: 'FULL', statusLabel: `🚫 0 / ${totalPart} (已滿位)`, canNavigate: false };
  }
  if (lot.availableSpaces < 0) {
    if (lot.liveStatus === 'AVAILABLE') return { ...result, statusLabel: `🟢 有位 (綠燈) / ${totalPart}` };
    if (lot.liveStatus === 'LIMITED') {
      return { ...result, status: 'LIMITED', statusLabel: `🟡 較少 (黃燈) / ${totalPart}` };
    }
    return { ...result, status: 'UNKNOWN', statusLabel: `⚪ ? / ${totalPart} (無資料)` };
  }
  if (lot.availableSpaces <= LIMITED_THRESHOLD) {
    return { ...result, status: 'LIMITED', statusLabel: `🟡 ${shown} / ${totalPart}${star}` };
  }
  return result;
}

function isOlder(candidate, current) {
  const c = Date.parse(candidate ?? '');
  const e = Date.parse(current ?? '');
  return Number.isFinite(e) && !(c >= e);
}

/** 把手機直接抓到的台北空位套到快照上；比現有資料舊就不套。 */
export function mergeTaipeiAvailability(lotsMap, { updatedAt, spaces }) {
  if (!updatedAt) return 0;
  let n = 0;
  for (const [id, value] of spaces) {
    const key = `tpe-${id}`;
    const lot = lotsMap.get(key);
    if (!lot || isOlder(updatedAt, lot.dataAt)) continue;
    lotsMap.set(key, { ...lot, availableSpaces: value >= 0 ? value : -1, dataAt: updatedAt, dataAtKind: 'official' });
    n++;
  }
  return n;
}

/** 台中即時 API 沒有資料時間欄位，用抓取時間當 dataAt。 */
export function mergeTaichungLights(lotsMap, rows, fetchedAt) {
  let n = 0;
  for (const item of Array.isArray(rows) ? rows : []) {
    const key = `txg-${String(item.ID ?? '').trim()}`;
    const lot = lotsMap.get(key);
    if (!lot || isOlder(fetchedAt, lot.dataAt)) continue;
    const { liveStatus: _old, ...rest } = lot;
    lotsMap.set(key, { ...rest, ...parseTaichungLight(item.AvailableCarRGB), dataAt: fetchedAt, dataAtKind: 'fetched' });
    n++;
  }
  return n;
}

/** 附近停車場的資料時間說明：只看還算即時的資料中最舊的一筆。 */
export function describeFreshness(lots, now = Date.now()) {
  const live = lots.filter((l) => hasVacancyData(l) && !isStaleData(l.dataAt, now));
  if (live.length === 0) return { fresh: false, text: '(⚠️ 附近沒有 30 分鐘內的即時空位資料)' };
  const oldest = live.reduce((a, b) => (Date.parse(a.dataAt) <= Date.parse(b.dataAt) ? a : b));
  const mins = Math.max(0, Math.round((now - Date.parse(oldest.dataAt)) / 60000));
  const what = oldest.dataAtKind === 'official' ? '官方資料時間' : '抓取時間';
  return { fresh: true, text: `(${what}：${mins} 分鐘前)` };
}
