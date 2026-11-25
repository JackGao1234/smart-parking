import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TAICHUNG_LIVE_URL,
  TAIPEI_AVAIL_URL,
  TAIPEI_DESC_URL,
  TAOYUAN_URL,
  hasVacancyData,
  inferDataAt,
  parseTaichungLight,
  parseTaipeiAvailability,
  parseTaipeiDesc,
  parseTaoyuanLots
} from '../docs/parking-core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'docs', 'data');

async function fetchText(url, timeoutMs = 15000, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000 * i));
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return await res.text();
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`${url}: ${lastError?.message} ${lastError?.cause?.code ?? ''}`);
}

const PREVIOUS_SNAPSHOT_URL = 'https://jackgao1234.github.io/smart-parking/data/live-parking.json';

/** 上一次部署的資料，用來判斷沒有時間欄位的來源是不是停住了。抓不到就當作沒有（＝不當即時）。 */
async function fetchPreviousLots() {
  try {
    const { lots } = JSON.parse(await fetchText(PREVIOUS_SNAPSHOT_URL));
    return new Map(lots.map((l) => [l.id, l]));
  } catch (e) {
    console.warn(`::warning::讀不到上一次的資料：${e.message}`);
    return new Map();
  }
}

function withInferredTime(label, lots, prevById) {
  const dataAt = inferDataAt(lots, prevById, new Date().toISOString());
  console.log(`${label} last observed change: ${dataAt ?? 'none (treated as not live)'}`);
  return lots.map((l) => (dataAt && hasVacancyData(l) ? { ...l, dataAt, dataAtKind: 'observed' } : l));
}

/** 抓取失敗不再默默當成 0 筆：印出原因，由 main() 的筆數檢查讓整次同步失敗。 */
async function orEmpty(label, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(`::error::${label} 抓取失敗：${e.message}`);
    return [];
  }
}

function twd97ToWgs84(x, y) {
  const a = 6378137.0;
  const b = 6356752.314245;
  const lng0 = (121 * Math.PI) / 180;
  const k0 = 0.9999;
  const dx = 250000;
  const e = Math.sqrt(1 - (b ** 2) / (a ** 2));
  const e2 = (e ** 2) / (1 - (e ** 2));
  const xAdj = x - dx;
  const M = y / k0;
  const mu = M / (a * (1 - (e ** 2) / 4 - (3 * (e ** 4)) / 64 - (5 * (e ** 6)) / 256));
  const e1 = (1 - Math.sqrt(1 - (e ** 2))) / (1 + Math.sqrt(1 - (e ** 2)));
  const J1 = (3 * e1) / 2 - (27 * (e1 ** 3)) / 32;
  const J2 = (21 * (e1 ** 2)) / 16 - (55 * (e1 ** 4)) / 32;
  const J3 = (151 * (e1 ** 3)) / 96;
  const J4 = (1097 * (e1 ** 4)) / 512;
  const fp =
    mu +
    J1 * Math.sin(2 * mu) +
    J2 * Math.sin(4 * mu) +
    J3 * Math.sin(6 * mu) +
    J4 * Math.sin(8 * mu);
  const C1 = e2 * (Math.cos(fp) ** 2);
  const T1 = Math.tan(fp) ** 2;
  const R1 = (a * (1 - (e ** 2))) / ((1 - (e ** 2) * (Math.sin(fp) ** 2)) ** 1.5);
  const N1 = a / Math.sqrt(1 - (e ** 2) * (Math.sin(fp) ** 2));
  const D = xAdj / (N1 * k0);
  const Q1 = (N1 * Math.tan(fp)) / R1;
  const Q2 = (D ** 2) / 2;
  const Q3 = ((5 + 3 * T1 + 10 * C1 - 4 * (C1 ** 2) - 9 * e2) * (D ** 4)) / 24;
  const Q4 =
    ((61 + 90 * T1 + 298 * C1 + 45 * (T1 ** 2) - 3 * (C1 ** 2) - 252 * e2) * (D ** 6)) / 720;
  const latRad = fp - Q1 * (Q2 - Q3 + Q4);
  const Q5 = D;
  const Q6 = ((1 + 2 * T1 + C1) * (D ** 3)) / 6;
  const Q7 =
    ((5 - 2 * C1 + 28 * T1 - 3 * (C1 ** 2) + 8 * e2 + 24 * (T1 ** 2)) * (D ** 5)) / 120;
  const lngRad = lng0 + (Q5 - Q6 + Q7) / Math.cos(fp);
  return {
    lat: Number(((latRad * 180) / Math.PI).toFixed(6)),
    lng: Number(((lngRad * 180) / Math.PI).toFixed(6))
  };
}

async function fetchTaipeiOffStreet() {
  const [descXml, availXml] = await Promise.all([
    fetchText(TAIPEI_DESC_URL, 30000),
    fetchText(TAIPEI_AVAIL_URL, 30000)
  ]);
  const { updatedAt, spaces } = parseTaipeiAvailability(availXml);
  console.log(`Taipei vacancy official time: ${updatedAt}`);

  const results = [];
  for (const p of parseTaipeiDesc(descXml)) {
    const { tw97x: x, tw97y: y } = p;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) continue;
    const { lat, lng } = twd97ToWgs84(x, y);
    if (lat < 24.9 || lat > 25.3 || lng < 121.4 || lng > 121.7) continue;

    const rawAvail = spaces.get(p.id);
    const hasLive = rawAvail !== undefined && rawAvail >= 0;
    results.push({
      id: `tpe-${p.id}`,
      name: p.name,
      address:
        p.address.startsWith('台北') || p.address.startsWith('臺北')
          ? p.address
          : `台北市${p.area}${p.address}`,
      lat,
      lng,
      totalSpaces: p.totalcar,
      availableSpaces: hasLive ? rawAvail : -1,
      ...(hasLive ? { dataAt: updatedAt, dataAtKind: 'official' } : {}),
      hourlyRate: p.payex ? p.payex.slice(0, 32) : '依現場公告',
      sourceTag: '北市停管'
    });
  }
  return results;
}

async function fetchNewTaipeiOffStreet() {
  const results = [];
  for (let page = 0; page < 3; page++) {
    const rows = JSON.parse(
      await fetchText(
        `https://data.ntpc.gov.tw/api/datasets/b1464ef0-9c7c-4a6f-abf7-6bdf32847e68/json?page=${page}&size=1000`
      )
    );
    if (!Array.isArray(rows) || rows.length === 0) break;

    for (const p of rows) {
      const x = Number(p.TW97X);
      const y = Number(p.TW97Y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) continue;
      const { lat, lng } = twd97ToWgs84(x, y);
      if (lat < 24.6 || lat > 25.35 || lng < 121.25 || lng > 122.05) continue;

      const area = p.AREA || '';
      const addr = p.ADDRESS || '';
      const fullAddr = addr.startsWith('新北') ? addr : `新北市${area}${addr}`;
      results.push({
        id: `ntpc-${p.ID}`,
        name: p.NAME,
        address: fullAddr,
        lat,
        lng,
        totalSpaces: Number(p.TOTALCAR) || 0,
        availableSpaces: -1,
        hourlyRate: p.PAYEX ? String(p.PAYEX).slice(0, 32) : '依現場公告',
        sourceTag: '新北交通'
      });
    }
    if (rows.length < 1000) break;
  }
  return results;
}

async function fetchTaoyuanOffStreet() {
  const rows = JSON.parse(await fetchText(TAOYUAN_URL));
  return parseTaoyuanLots(rows).map((p) => ({
    id: `tycg-${p.id}`,
    name: p.name,
    address: `桃園市${p.area}${p.address}`,
    lat: p.lat,
    lng: p.lng,
    totalSpaces: p.totalSpaces,
    availableSpaces: p.availableSpaces,
    hourlyRate: p.payGuide ? p.payGuide.slice(0, 30) : '依現場公告',
    sourceTag: '桃市交通'
  }));
}

async function fetchTaipeiRoadside(offStreetLots) {
  const xml = await fetchText(
    'https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_roadquery.xml',
    40000
  );
  const now = Date.now();
  const newest = [...xml.matchAll(/<data_Dt>(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})<\/data_Dt>/g)]
    .map((m) => Date.parse(`${m[1]}T${m[2]}+08:00`))
    .filter((t) => t <= now)
    .reduce((a, b) => Math.max(a, b), 0);
  const dataAt = newest ? new Date(newest).toISOString() : null;
  const roads = [...xml.matchAll(/<ROAD>([\s\S]*?)<\/ROAD>/g)];

  // Build a fast street-name -> centroid coordinate index from the 1,767 off-street lots
  const streetIndex = [];
  for (const lot of offStreetLots) {
    const m = (lot.address || '').match(/([一-龥\d]+?(?:路|街|大道)(?:[一二三四五六七八九十]+段)?)/);
    if (m) {
      streetIndex.push({ street: m[1], lat: lot.lat, lng: lot.lng });
    }
  }

  const results = [];
  for (const m of roads) {
    const block = m[1];
    const carType = block.match(/<roadSegCarType>([^<]*)<\/roadSegCarType>/)?.[1];
    if (carType && carType !== '1') continue;

    const id = block.match(/<roadSegID>([^<]*)<\/roadSegID>/)?.[1]?.trim();
    const name = block.match(/<roadSegName>([^<]*)<\/roadSegName>/)?.[1]?.trim();
    if (!id || !name) continue;

    const total = Number.parseInt(
      block.match(/<roadSegTotalValue>([^<]*)<\/roadSegTotalValue>/)?.[1] ?? '0',
      10
    );
    const rawAvail = Number.parseInt(
      block.match(/<roadSegAvail>([^<]*)<\/roadSegAvail>/)?.[1] ?? '-99',
      10
    );
    const fee = block.match(/<roadSegFee>([^<]*)<\/roadSegFee>/)?.[1]?.trim() || '依現場收費牌';
    const freeCells =
      (block.match(/<cellStatus>2<\/cellStatus>/g) || []).length +
      (block.match(/<cellStatus>0<\/cellStatus>/g) || []).length;
    const occCells = (block.match(/<cellStatus>1<\/cellStatus>/g) || []).length;

    let availableSpaces = -1;
    if (rawAvail >= 0) {
      availableSpaces = rawAvail;
    } else if (freeCells > 0 || occCells > 0) {
      availableSpaces = freeCells;
    }

    // Match street coordinate from off-street index (zero extra API calls!)
    const baseStreet = name.replace(/\d+巷.*$/, '').replace(/\d+弄.*$/, '');
    const hit =
      streetIndex.find((s) => s.street === baseStreet) ||
      streetIndex.find((s) => baseStreet.includes(s.street) || s.street.includes(baseStreet));

    results.push({
      id: `tpe-road-${id}`,
      name: `${name} (路邊停車格)`,
      roadName: name,
      address: `台北市${name}`,
      lat: hit ? hit.lat : null,
      lng: hit ? hit.lng : null,
      totalSpaces: Number.isFinite(total) ? total : 0,
      availableSpaces,
      ...(availableSpaces >= 0 ? { dataAt, dataAtKind: 'official' } : {}),
      hourlyRate: fee,
      sourceTag: '北市路邊'
    });
  }
  return results;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const clean = text.replace(/^\uFEFF+/, '');
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c !== '')) rows.push(row);
  }
  return rows;
}

async function fetchTaichungOffStreet() {
  const base = 'https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=';
  const [liveText, coordText, pubText, privText] = await Promise.all([
    fetchText(TAICHUNG_LIVE_URL),
    fetchText(`${base}c047b32f-b57a-459c-abd4-5969885c60a6`),
    fetchText(`${base}098d6e7d-9615-4f78-be30-d902436c9a02`),
    fetchText(`${base}6e343cff-5508-47e2-8534-f34421b1e16b`)
  ]);

  const coordMap = new Map();
  const rows = parseCsvRows(coordText);
  for (let i = 1; i < rows.length; i++) {
    const [, , id, addr, latStr, lngStr] = rows[i];
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (id && Number.isFinite(lat) && Number.isFinite(lng)) {
      coordMap.set(String(id), { address: (addr || '').replace(/\?/g, ''), lat, lng });
    }
  }

  const dirMap = new Map();
  const ingestDir = (rows) => {
    for (let i = 1; i < rows.length; i++) {
      const [, , district, id, name, fee, hours, totalStr] = rows[i];
      if (!id) continue;
      dirMap.set(String(id), {
        district: district || '',
        name: name || '',
        fee: fee || '',
        hours: hours || '',
        totalSpaces: Number.parseInt(String(totalStr || '0'), 10) || 0
      });
    }
  };
  ingestDir(parseCsvRows(pubText));
  ingestDir(parseCsvRows(privText));

  const results = [];
  const seenIds = new Set();

  const liveList = JSON.parse(liveText);
  if (Array.isArray(liveList)) {
    for (const item of liveList) {
      const id = String(item.ID || '').trim();
      if (!id || seenIds.has(id)) continue;
      const c = coordMap.get(id);
      const d = dirMap.get(id);
      const lat = Number(item.Lat) || c?.lat;
      const lng = Number(item.Lng) || c?.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 23.9 || lat > 24.5 || lng < 120.4 || lng > 121.5) {
        continue;
      }
      seenIds.add(id);

      const rawName = (item.Position || d?.name || '').trim();
      const name = rawName.replace(/P(\([^)]+\))?$/, '停車場$1');
      const totalCar = Number.parseInt(String(item.TotalCar || '0'), 10);
      const totalSpaces = Number.isFinite(totalCar) && totalCar > 0 ? totalCar : d?.totalSpaces || 0;
      const light = parseTaichungLight(item.AvailableCarRGB);

      const kw = String(item.KeyWord || '').split(/[\r\n]/)[0].trim();
      const address = c?.address || (d?.district ? `臺中市${d.district}${kw}` : kw) || '臺中市';
      const feeText = d?.fee ? d.fee.slice(0, 32) : '依現場公告';

      results.push({
        id: `txg-${id}`,
        name,
        address,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        totalSpaces,
        ...light,
        hourlyRate: feeText,
        sourceTag: '台中交通'
      });
    }
  }

  // Include any directory+coord lots not present in liveList
  for (const [id, c] of coordMap.entries()) {
    if (seenIds.has(id)) continue;
    if (c.lat < 23.9 || c.lat > 24.5 || c.lng < 120.4 || c.lng > 121.5) continue;
    const d = dirMap.get(id);
    const rawName = (d?.name || c.address || `停車場 ${id}`).trim();
    const name = rawName.replace(/P(\([^)]+\))?$/, '停車場$1');
    results.push({
      id: `txg-${id}`,
      name,
      address: c.address || `臺中市${d?.district || ''}`,
      lat: Number(c.lat.toFixed(6)),
      lng: Number(c.lng.toFixed(6)),
      totalSpaces: d?.totalSpaces || 0,
      availableSpaces: -1,
      hourlyRate: d?.fee ? d.fee.slice(0, 32) : '依現場公告',
      sourceTag: '台中交通'
    });
  }

  return results;
}

async function geocodeCustomAddress(address) {
  const clean = String(address || '').trim().replace(/臺/g, '台');
  if (!clean) return null;
  try {
    const res = await fetch(
      `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(clean)}&countryCode=TWN&searchExtent=119.3,21.8,122.2,25.45&maxLocations=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      const cand = data.candidates?.[0];
      if (cand && cand.score >= 75 && cand.address !== '台灣') {
        return { lat: Number(cand.location.y.toFixed(6)), lng: Number(cand.location.x.toFixed(6)) };
      }
    }
  } catch {}
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&countrycodes=tw&limit=1`,
      { headers: { 'User-Agent': 'SmartParkingFinderTW/1.0' }, signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        return { lat: Number(Number(rows[0].lat).toFixed(6)), lng: Number(Number(rows[0].lon).toFixed(6)) };
      }
    }
  } catch {}
  return null;
}

async function loadCustomParkingLots() {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, 'custom-parking.json'), 'utf8');
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return [];
    const resolved = [];
    for (const lot of items) {
      if (Number.isFinite(lot.lat) && Number.isFinite(lot.lng)) {
        resolved.push(lot);
      } else {
        const geo = await geocodeCustomAddress(lot.address);
        if (geo) {
          resolved.push({ ...lot, lat: geo.lat, lng: geo.lng });
        }
      }
    }
    return resolved;
  } catch {
    return [];
  }
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const [taipeiOffStreet, newTaipeiOffStreet, taoyuanOffStreet, taichungOffStreet, customLots] = await Promise.all([
    orEmpty('台北停車場', fetchTaipeiOffStreet),
    orEmpty('新北停車場', fetchNewTaipeiOffStreet),
    orEmpty('桃園停車場', fetchTaoyuanOffStreet),
    orEmpty('台中停車場', fetchTaichungOffStreet),
    loadCustomParkingLots()
  ]);
  const taipeiRoadside = await orEmpty('台北路邊格', () => fetchTaipeiRoadside(taipeiOffStreet));

  const counts = {
    台北停車場: taipeiOffStreet.length,
    新北停車場: newTaipeiOffStreet.length,
    桃園停車場: taoyuanOffStreet.length,
    台中停車場: taichungOffStreet.length,
    台北路邊格: taipeiRoadside.length
  };
  const empty = Object.keys(counts).filter((k) => counts[k] === 0);
  if (empty.length > 0) {
    console.error(`::error::同步中止，以下來源是 0 筆：${empty.join('、')}。線上版維持上一次的資料。`);
    process.exitCode = 1;
    return;
  }

  const prevById = await fetchPreviousLots();
  const updatedAt = new Date().toISOString();
  const allOffStreet = [
    ...taipeiOffStreet,
    ...newTaipeiOffStreet,
    ...withInferredTime('Taoyuan', taoyuanOffStreet, prevById),
    ...withInferredTime('Taichung', taichungOffStreet, prevById),
    ...customLots
  ];
  const offStreetPayload = {
    updatedAt,
    count: allOffStreet.length,
    lots: allOffStreet
  };

  const roadsidePayload = {
    updatedAt,
    count: taipeiRoadside.length,
    roads: taipeiRoadside
  };

  await fs.writeFile(
    path.join(DATA_DIR, 'live-parking.json'),
    JSON.stringify(offStreetPayload),
    'utf8'
  );
  await fs.writeFile(
    path.join(DATA_DIR, 'taipei-roadside.json'),
    JSON.stringify(roadsidePayload),
    'utf8'
  );

  console.log(
    `Synced: ${taipeiOffStreet.length} Taipei off-street, ${newTaipeiOffStreet.length} New Taipei off-street, ${taoyuanOffStreet.length} Taoyuan off-street, ${taichungOffStreet.length} Taichung off-street, ${taipeiRoadside.length} Taipei roadside segments.`
  );
}

main();
