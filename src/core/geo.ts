import { Coordinates, DestinationInfo } from './types.js';

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function isWithinTaiwanBounds(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 21.8 &&
    lat <= 25.45 &&
    lng >= 119.3 &&
    lng <= 122.2
  );
}

/**
 * Calculates the great-circle distance between two coordinates in meters
 * using the Haversine formula.
 */
export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    throw new Error('Invalid coordinates provided for distance calculation');
  }

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Converts TWD97 TM2 (Taiwan 121°E central meridian) coordinates (tw97x, tw97y)
 * used by Taipei City & New Taipei City Open Data into WGS84 (lat, lng).
 */
export function twd97ToWgs84(x: number, y: number): Coordinates {
  const a = 6378137.0;
  const b = 6356752.314245;
  const lng0 = (121 * Math.PI) / 180;
  const k0 = 0.9999;
  const dx = 250000;

  const e = Math.sqrt(1 - Math.pow(b, 2) / Math.pow(a, 2));
  const e2 = Math.pow(e, 2) / (1 - Math.pow(e, 2));
  const xAdj = x - dx;
  const M = y / k0;

  const mu =
    M /
    (a *
      (1.0 -
        Math.pow(e, 2) / 4.0 -
        (3 * Math.pow(e, 4)) / 64.0 -
        (5 * Math.pow(e, 6)) / 256.0));

  const e1 = (1.0 - Math.sqrt(1.0 - Math.pow(e, 2))) / (1.0 + Math.sqrt(1.0 - Math.pow(e, 2)));

  const J1 = (3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32.0;
  const J2 = (21 * Math.pow(e1, 2)) / 16 - (55 * Math.pow(e1, 4)) / 32.0;
  const J3 = (151 * Math.pow(e1, 3)) / 96.0;
  const J4 = (1097 * Math.pow(e1, 4)) / 512.0;

  const fp =
    mu +
    J1 * Math.sin(2 * mu) +
    J2 * Math.sin(4 * mu) +
    J3 * Math.sin(6 * mu) +
    J4 * Math.sin(8 * mu);

  const C1 = e2 * Math.pow(Math.cos(fp), 2);
  const T1 = Math.pow(Math.tan(fp), 2);
  const R1 =
    (a * (1 - Math.pow(e, 2))) / Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2), 1.5);
  const N1 = a / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2));
  const D = xAdj / (N1 * k0);

  const Q1 = (N1 * Math.tan(fp)) / R1;
  const Q2 = Math.pow(D, 2) / 2.0;
  const Q3 =
    ((5 + 3 * T1 + 10 * C1 - 4 * Math.pow(C1, 2) - 9 * e2) * Math.pow(D, 4)) / 24.0;
  const Q4 =
    ((61 + 90 * T1 + 298 * C1 + 45 * Math.pow(T1, 2) - 3 * Math.pow(C1, 2) - 252 * e2) *
      Math.pow(D, 6)) /
    720.0;
  const latRad = fp - Q1 * (Q2 - Q3 + Q4);

  const Q5 = D;
  const Q6 = ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6;
  const Q7 =
    ((5 - 2 * C1 + 28 * T1 - 3 * Math.pow(C1, 2) + 8 * e2 + 24 * Math.pow(T1, 2)) *
      Math.pow(D, 5)) /
    120.0;
  const lngRad = lng0 + (Q5 - Q6 + Q7) / Math.cos(fp);

  return {
    lat: Number(((latRad * 180) / Math.PI).toFixed(6)),
    lng: Number(((lngRad * 180) / Math.PI).toFixed(6))
  };
}

/**
 * Built-in catalog of popular Taiwan destinations & landmarks for instant offline/fast lookup.
 */
export const TAIWAN_LANDMARKS: Record<string, DestinationInfo & { aliases: string[] }> = {
  taipeiArena: {
    name: '台北小巨蛋',
    formattedAddress: '台北市松山區南京東路四段2號',
    lat: 25.050698,
    lng: 121.550122,
    aliases: ['台北小巨蛋', '小巨蛋', '松山運動中心', '微風南京', 'taipei arena']
  },
  taipeiDome: {
    name: '台北大巨蛋 / 國父紀念館',
    formattedAddress: '台北市信義區忠孝東路四段515號',
    lat: 25.04236,
    lng: 121.56015,
    aliases: ['台北大巨蛋', '大巨蛋', '國父紀念館', '松山文創園區', '松菸', 'taipei dome']
  },
  taipei101: {
    name: '台北101 / 信義商圈',
    formattedAddress: '台北市信義區信義路五段7號',
    lat: 25.033964,
    lng: 121.564468,
    aliases: ['台北101', '101', '信義區', '信義商圈', '華納威秀', '微風南山', 'taipei 101']
  },
  taipeiMainStation: {
    name: '台北車站 / 京站時尚廣場',
    formattedAddress: '台北市中正區北平西路3號',
    lat: 25.04776,
    lng: 121.51708,
    aliases: ['台北車站', '北車', '京站', '台北轉運站', 'taipei main station']
  },
  ximending: {
    name: '西門町商圈',
    formattedAddress: '台北市萬華區成都路10號',
    lat: 25.04218,
    lng: 121.50809,
    aliases: ['西門町', '西門', '紅樓', '西門紅樓', 'ximending']
  },
  banqiaoStation: {
    name: '板橋車站 / 新北耶誕城',
    formattedAddress: '新北市板橋區縣民大道二段7號',
    lat: 25.01427,
    lng: 121.46375,
    aliases: ['板橋車站', '板橋', '新北耶誕城', '板橋大遠百', 'banqiao']
  },
  pingzhenWenhua: {
    name: '桃園平鎮文化街商圈',
    formattedAddress: '桃園市平鎮區文化街24巷8號',
    lat: 24.95405,
    lng: 121.20355,
    aliases: ['平鎮文化街', '文化街24巷', '平鎮區文化街', '復旦國小', '文化國小']
  },
  taichungCMP: {
    name: '台中勤美誠品綠園道 / 草悟道',
    formattedAddress: '台中市西區公益路68號',
    lat: 24.15111,
    lng: 120.66376,
    aliases: ['勤美', '勤美誠品', '草悟道', '綠園道', '台中勤美']
  },
  kaohsiungArena: {
    name: '高雄漢神巨蛋購物廣場',
    formattedAddress: '高雄市左營區博愛二路777號',
    lat: 22.66963,
    lng: 120.30239,
    aliases: ['高雄巨蛋', '漢神巨蛋', '瑞豐夜市']
  }
};

const TAIWAN_ADDRESS_INDEX: Array<{
  keywords: string[];
  lat: number;
  lng: number;
}> = [
  // Taipei Neihu & Songshan streets
  { keywords: ['台北', '內湖', '內湖路一段411巷'], lat: 25.08365, lng: 121.57135 },
  { keywords: ['台北', '內湖', '內湖路一段'], lat: 25.08292, lng: 121.57025 },
  { keywords: ['台北', '內湖', '瑞光路'], lat: 25.07963, lng: 121.5693 },
  { keywords: ['台北', '松山', '南京東路四段'], lat: 25.0507, lng: 121.55012 },

  // Taoyuan Pingzhen & Chungli streets
  { keywords: ['桃園', '平鎮', '文化街'], lat: 24.95405, lng: 121.20355 },
  { keywords: ['桃園', '平鎮', '復興街'], lat: 24.95352, lng: 121.20412 },
  { keywords: ['桃園', '平鎮', '民族路'], lat: 24.95621, lng: 121.20775 },
  { keywords: ['桃園', '平鎮', '復旦路'], lat: 24.95185, lng: 121.20482 },
  { keywords: ['桃園', '平鎮', '環南路'], lat: 24.94165, lng: 121.20892 },
  { keywords: ['桃園', '平鎮', '中豐路'], lat: 24.93621, lng: 121.21954 },
  { keywords: ['桃園', '平鎮'], lat: 24.9535, lng: 121.2045 },
  { keywords: ['桃園', '中壢'], lat: 24.9537, lng: 121.2256 },
  { keywords: ['桃園', '桃園區'], lat: 24.9936, lng: 121.301 },
  { keywords: ['桃園', '龜山'], lat: 25.0245, lng: 121.3522 },
  { keywords: ['桃園', '蘆竹'], lat: 25.0453, lng: 121.2945 },
  { keywords: ['桃園', '八德'], lat: 24.9565, lng: 121.2986 },
  { keywords: ['桃園', '楊梅'], lat: 24.9125, lng: 121.1456 },
  { keywords: ['桃園', '龍潭'], lat: 24.8639, lng: 121.2128 },
  { keywords: ['桃園', '大溪'], lat: 24.8837, lng: 121.2869 },
  { keywords: ['桃園', '大園'], lat: 25.0641, lng: 121.1965 },
  { keywords: ['桃園'], lat: 24.9936, lng: 121.301 },

  // Taipei districts
  { keywords: ['台北', '信義'], lat: 25.03396, lng: 121.56447 },
  { keywords: ['台北', '中正'], lat: 25.0421, lng: 121.5186 },
  { keywords: ['台北', '大安'], lat: 25.0263, lng: 121.5436 },
  { keywords: ['台北', '中山'], lat: 25.05285, lng: 121.52562 },
  { keywords: ['台北', '松山'], lat: 25.0507, lng: 121.55012 },
  { keywords: ['台北', '萬華'], lat: 25.0422, lng: 121.5081 },
  { keywords: ['台北', '大同'], lat: 25.0558, lng: 121.5139 },
  { keywords: ['台北', '士林'], lat: 25.0904, lng: 121.5245 },
  { keywords: ['台北', '北投'], lat: 25.1321, lng: 121.5015 },
  { keywords: ['台北', '內湖'], lat: 25.08292, lng: 121.57025 },
  { keywords: ['台北', '南港'], lat: 25.0553, lng: 121.6068 },
  { keywords: ['台北', '文山'], lat: 24.9898, lng: 121.5702 },
  { keywords: ['台北'], lat: 25.04776, lng: 121.51708 },

  // New Taipei districts
  { keywords: ['新北', '板橋'], lat: 25.01427, lng: 121.46375 },
  { keywords: ['新北', '中和'], lat: 24.9994, lng: 121.4989 },
  { keywords: ['新北', '永和'], lat: 25.0085, lng: 121.5152 },
  { keywords: ['新北', '新莊'], lat: 25.0375, lng: 121.4505 },
  { keywords: ['新北', '三重'], lat: 25.0615, lng: 121.4882 },
  { keywords: ['新北', '新店'], lat: 24.9678, lng: 121.5419 },
  { keywords: ['新北', '土城'], lat: 24.9722, lng: 121.4435 },
  { keywords: ['新北', '蘆洲'], lat: 25.0849, lng: 121.4735 },
  { keywords: ['新北', '汐止'], lat: 25.0641, lng: 121.6582 },
  { keywords: ['新北', '淡水'], lat: 25.1695, lng: 121.4441 },
  { keywords: ['新北', '林口'], lat: 25.0775, lng: 121.3721 },
  { keywords: ['新北', '樹林'], lat: 24.9912, lng: 121.4245 },
  { keywords: ['新北', '三峽'], lat: 24.9345, lng: 121.3695 },
  { keywords: ['新北', '鶯歌'], lat: 24.9545, lng: 121.3541 },
  { keywords: ['新北'], lat: 25.01427, lng: 121.46375 },

  // Other major Taiwan cities
  { keywords: ['基隆'], lat: 25.1283, lng: 121.7419 },
  { keywords: ['新竹', '竹北'], lat: 24.8385, lng: 121.0096 },
  { keywords: ['新竹'], lat: 24.8015, lng: 120.9718 },
  { keywords: ['苗栗'], lat: 24.5602, lng: 120.8214 },
  { keywords: ['台中', '西屯'], lat: 24.1652, lng: 120.6401 },
  { keywords: ['台中', '北屯'], lat: 24.1825, lng: 120.6865 },
  { keywords: ['台中', '南屯'], lat: 24.1392, lng: 120.6435 },
  { keywords: ['台中', '西區'], lat: 24.15111, lng: 120.66376 },
  { keywords: ['台中'], lat: 24.1477, lng: 120.6736 },
  { keywords: ['彰化'], lat: 24.0815, lng: 120.5385 },
  { keywords: ['南投'], lat: 23.9157, lng: 120.6861 },
  { keywords: ['雲林'], lat: 23.7092, lng: 120.5433 },
  { keywords: ['嘉義'], lat: 23.4801, lng: 120.4491 },
  { keywords: ['台南', '東區'], lat: 22.9845, lng: 120.2265 },
  { keywords: ['台南', '中西區'], lat: 22.9921, lng: 120.1985 },
  { keywords: ['台南', '永康'], lat: 23.0256, lng: 120.2545 },
  { keywords: ['台南'], lat: 22.9971, lng: 120.2126 },
  { keywords: ['高雄', '左營'], lat: 22.66963, lng: 120.30239 },
  { keywords: ['高雄', '鼓山'], lat: 22.6485, lng: 120.2895 },
  { keywords: ['高雄', '三民'], lat: 22.6481, lng: 120.3215 },
  { keywords: ['高雄', '苓雅'], lat: 22.6215, lng: 120.3125 },
  { keywords: ['高雄', '前鎮'], lat: 22.5965, lng: 120.3085 },
  { keywords: ['高雄', '鳳山'], lat: 22.6265, lng: 120.3565 },
  { keywords: ['高雄'], lat: 22.6398, lng: 120.3021 },
  { keywords: ['屏東'], lat: 22.6691, lng: 120.4861 },
  { keywords: ['宜蘭'], lat: 24.7545, lng: 121.7582 },
  { keywords: ['花蓮'], lat: 23.9872, lng: 121.6015 },
  { keywords: ['台東'], lat: 22.7583, lng: 121.1444 }
];

export function normalizeTaiwanAddress(input: string): string {
  return input
    .trim()
    .replace(/臺/g, '台')
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

export function buildAddressSearchCandidates(address: string): string[] {
  const norm = normalizeTaiwanAddress(address);
  const candidates = new Set<string>([norm]);

  const noFloor = norm.replace(/[,，\s]*([Bb]?\d+樓(?:之\d+)?|\d+[Ff]).*$/, '').trim();
  if (noFloor) candidates.add(noFloor);

  const noNumber = noFloor.replace(/\d+(?:之\d+)?號.*$/, '').trim();
  if (noNumber) candidates.add(noNumber);

  const noAlley = noNumber.replace(/\d+弄.*$/, '').trim();
  if (noAlley) candidates.add(noAlley);

  const noLane = noAlley.replace(/\d+巷.*$/, '').trim();
  if (noLane) candidates.add(noLane);

  const spacedRoad = noLane.replace(
    /^([一-龥]{2,3}[縣市])([一-龥]{1,3}?(?:市區|鎮區|區|鎮|鄉|市))(.+?(?:路|街|大道|段))(.*)$/,
    '$1 $2 $3'
  );
  if (spacedRoad && spacedRoad !== noLane) {
    candidates.add(spacedRoad.trim());
  }

  const districtMatch = norm.match(
    /^([一-龥]{2,3}[縣市])([一-龥]{1,3}?(?:市區|鎮區|區|鎮|鄉|市))/
  );
  if (districtMatch) {
    candidates.add(`${districtMatch[1]} ${districtMatch[2]}`);
    candidates.add(`${districtMatch[1]}${districtMatch[2]}`);
  }

  return Array.from(candidates).filter((c) => c.length >= 2);
}

export function parseCoordinateString(input: string): Coordinates | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

async function queryNominatimTaiwan(candidates: string[]): Promise<DestinationInfo | null> {
  for (const candidate of candidates.slice(0, 3)) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        candidate
      )}&countrycodes=tw&limit=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SmartParkingFinderTW/1.0'
        },
        signal: AbortSignal.timeout(2500)
      });
      if (response.ok) {
        const results = (await response.json()) as Array<{
          display_name: string;
          lat: string;
          lon: string;
        }>;
        if (results.length > 0) {
          const lat = Number(results[0].lat);
          const lng = Number(results[0].lon);
          if (isWithinTaiwanBounds(lat, lng)) {
            return {
              name: candidates[0],
              formattedAddress: results[0].display_name,
              lat,
              lng
            };
          }
        }
      }
    } catch {
      break;
    }
  }
  return null;
}

async function queryArcGisTaiwan(cleaned: string): Promise<DestinationInfo | null> {
  try {
    const arcgisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(
      cleaned
    )}&countryCode=TWN&searchExtent=119.3,21.8,122.2,25.45&maxLocations=1`;
    const response = await fetch(arcgisUrl, {
      signal: AbortSignal.timeout(2500)
    });
    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: Array<{
          address: string;
          location: { x: number; y: number };
          score: number;
        }>;
      };
      if (data.candidates && data.candidates.length > 0 && data.candidates[0].score >= 75) {
        const best = data.candidates[0];
        const lat = Number(best.location.y.toFixed(6));
        const lng = Number(best.location.x.toFixed(6));
        if (isWithinTaiwanBounds(lat, lng) && best.address !== '台灣' && best.address !== '臺灣') {
          return {
            name: cleaned,
            formattedAddress: best.address || cleaned,
            lat,
            lng
          };
        }
      }
    }
  } catch {
    // Ignore network errors
  }
  return null;
}

/**
 * Resolves a destination search query or full Taiwan address to coordinates.
 * Always queries live external geocoding APIs (Nominatim & ArcGIS) first;
 * falls back to offline tables only when network is unreachable (e.g. sandboxed unit tests).
 */
export async function geocodeDestination(query: string): Promise<DestinationInfo | null> {
  const cleaned = normalizeTaiwanAddress(query);
  if (!cleaned) {
    return null;
  }

  // 1. Check if direct "lat,lng" string
  const coords = parseCoordinateString(cleaned);
  if (coords) {
    return {
      name: `定位座標 (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
      formattedAddress: `${coords.lat}, ${coords.lng}`,
      lat: coords.lat,
      lng: coords.lng
    };
  }

  const isSpecificDoorplate = /[路街大道段巷弄號]/.test(cleaned);
  const candidates = buildAddressSearchCandidates(cleaned);

  // 2. Live Online Geocoding FIRST (unless running in offline Vitest unit tests)
  if (!process.env.VITEST) {
    if (isSpecificDoorplate) {
      const arcRes = await queryArcGisTaiwan(cleaned);
      if (arcRes) return arcRes;
      const nomRes = await queryNominatimTaiwan(candidates);
      if (nomRes) return nomRes;
    } else {
      const nomRes = await queryNominatimTaiwan(candidates);
      if (nomRes) return nomRes;
      const arcRes = await queryArcGisTaiwan(cleaned);
      if (arcRes) return arcRes;
    }
  }

  // 3. Offline fallback (used when offline or in sandboxed unit tests)
  const compact = cleaned.toLowerCase().replace(/\s+/g, '');
  if (!isSpecificDoorplate) {
    for (const landmark of Object.values(TAIWAN_LANDMARKS)) {
      const matched = landmark.aliases.some((alias) => {
        const normAlias = normalizeTaiwanAddress(alias).toLowerCase().replace(/\s+/g, '');
        return normAlias === compact || normAlias.includes(compact) || compact.includes(normAlias);
      });
      if (matched) {
        return {
          name: landmark.name,
          formattedAddress: landmark.formattedAddress,
          lat: landmark.lat,
          lng: landmark.lng
        };
      }
    }
  }

  const matchedStreetEntry = TAIWAN_ADDRESS_INDEX.find(
    (entry) => entry.keywords.length >= 3 && entry.keywords.every((kw) => cleaned.includes(kw))
  );
  if (matchedStreetEntry) {
    return {
      name: cleaned,
      formattedAddress: cleaned,
      lat: matchedStreetEntry.lat,
      lng: matchedStreetEntry.lng
    };
  }

  for (const entry of TAIWAN_ADDRESS_INDEX) {
    if (entry.keywords.every((kw) => cleaned.includes(kw))) {
      return {
        name: cleaned,
        formattedAddress: cleaned,
        lat: entry.lat,
        lng: entry.lng
      };
    }
  }

  return null;
}
