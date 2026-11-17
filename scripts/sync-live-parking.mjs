import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'docs', 'data');

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
  const [descRes, availRes] = await Promise.all([
    fetch('https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_alldesc.json', {
      signal: AbortSignal.timeout(15000)
    }),
    fetch('https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_allavailable.json', {
      signal: AbortSignal.timeout(15000)
    })
  ]);
  if (!descRes.ok || !availRes.ok) return [];

  const descJson = await descRes.json();
  const availJson = await availRes.json();
  const availMap = new Map();
  for (const a of availJson.data?.park ?? []) {
    availMap.set(a.id, Number(a.availablecar));
  }

  const results = [];
  for (const p of descJson.data?.park ?? []) {
    const x = Number(p.tw97x);
    const y = Number(p.tw97y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) continue;
    const { lat, lng } = twd97ToWgs84(x, y);
    if (lat < 24.9 || lat > 25.3 || lng < 121.4 || lng > 121.7) continue;

    const rawAvail = availMap.get(p.id);
    const hasLive = rawAvail !== undefined && rawAvail >= 0;
    results.push({
      id: `tpe-${p.id}`,
      name: p.name,
      address:
        p.address?.startsWith('台北') || p.address?.startsWith('臺北')
          ? p.address
          : `台北市${p.area || ''}${p.address || ''}`,
      lat,
      lng,
      totalSpaces: Number(p.totalcar) || 0,
      availableSpaces: hasLive ? rawAvail : -1,
      hourlyRate: p.payex ? p.payex.slice(0, 32) : '依現場公告',
      sourceTag: '北市停管'
    });
  }
  return results;
}

async function fetchNewTaipeiOffStreet() {
  const results = [];
  for (let page = 0; page < 3; page++) {
    try {
      const res = await fetch(
        `https://data.ntpc.gov.tw/api/datasets/b1464ef0-9c7c-4a6f-abf7-6bdf32847e68/json?page=${page}&size=1000`,
        { signal: AbortSignal.timeout(12000) }
      );
      if (!res.ok) break;
      const rows = await res.json();
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
    } catch {
      break;
    }
  }
  return results;
}

async function fetchTaoyuanOffStreet() {
  try {
    const res = await fetch(
      'https://data.tycg.gov.tw/opendata/datalist/datasetMeta/download?id=f4cc0b12-86ac-40f9-8745-885bddc18f79&rid=0daad6e6-0632-44f5-bd25-5e1de1e9146f',
      { signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const results = [];
    for (const item of data.parkingLots ?? []) {
      const lat = Number(item.wgsY);
      const lng = Number(item.wgsX);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 24 || lat > 26) continue;
      const sur = Number.parseInt(String(item.surplusSpace), 10);
      const hasLive = Number.isFinite(sur) && sur >= 0;
      results.push({
        id: `tycg-${item.parkId}`,
        name: item.parkName,
        address: `桃園市${item.areaName || ''}${item.address || ''}`,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        totalSpaces: Number(item.totalSpace) || 0,
        availableSpaces: hasLive ? sur : -1,
        hourlyRate: item.payGuide ? item.payGuide.slice(0, 30) : '依現場公告',
        sourceTag: '桃市交通'
      });
    }
    return results;
  } catch {
    return [];
  }
}

async function fetchTaipeiRoadside(offStreetLots) {
  try {
    const res = await fetch('https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_roadquery.xml', {
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) return [];
    const xml = await res.text();
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
        hourlyRate: fee,
        sourceTag: '北市路邊'
      });
    }
    return results;
  } catch {
    return [];
  }
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const [taipeiOffStreet, newTaipeiOffStreet, taoyuanOffStreet] = await Promise.all([
    fetchTaipeiOffStreet(),
    fetchNewTaipeiOffStreet(),
    fetchTaoyuanOffStreet()
  ]);
  const taipeiRoadside = await fetchTaipeiRoadside(taipeiOffStreet);

  const updatedAt = new Date().toISOString();
  const allOffStreet = [...taipeiOffStreet, ...newTaipeiOffStreet, ...taoyuanOffStreet];
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
    `Synced: ${taipeiOffStreet.length} Taipei off-street, ${newTaipeiOffStreet.length} New Taipei off-street, ${taoyuanOffStreet.length} Taoyuan off-street, ${taipeiRoadside.length} Taipei roadside segments.`
  );
}

main();
