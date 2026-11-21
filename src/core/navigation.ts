import { calculateDistanceMeters } from './geo.js';
import { ParkingLotView, RawParkingLot, VacancyStatus } from './types.js';

export const LIMITED_VACANCY_THRESHOLD = 10;

/**
 * Strips helper notes in parentheses and basement suffixes like "地下室", "B1-B5", "旁"
 * so Google Maps receives a clean, navigable official address & POI name.
 */
export function cleanPlaceText(text?: string): string {
  if (!text) return '';
  return text
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*（[^）]*）/g, '')
    .replace(/(?:地下室|地下|[Bb]\d(?:-[Bb]?\d)?樓?|[Bb]\d\/[Bb]\d|旁|對面)$/g, '')
    .trim();
}

/**
 * Formats a single parking lot into a precise Google Maps query string.
 * IMPORTANT: Only uses text (`address + name`) when the address has an exact street
 * doorplate number (`號`). When there is no doorplate number (e.g. OSM "廍子路 廍子里 北屯區"),
 * we MUST return exact `${lat},${lng}` coordinates so Google Maps never fuzzy-matches
 * a completely different parking lot miles away on the same road!
 */
export function formatGoogleMapsStopQuery(
  lat: number,
  lng: number,
  name?: string,
  address?: string
): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Valid latitude and longitude are required to build Google Maps URL');
  }

  const cleanName = cleanPlaceText(name);
  const cleanAddr = cleanPlaceText(address);
  const hasExactDoorplate = /\d+(?:之\d+)?號/.test(cleanAddr);

  if (hasExactDoorplate && cleanName) {
    return cleanAddr.includes(cleanName) ? cleanAddr : `${cleanAddr} ${cleanName}`;
  }
  if (hasExactDoorplate) {
    return cleanAddr;
  }
  return `${lat},${lng}`;
}

/**
 * Generates a universal Google Maps location preview URL (`maps/search/?api=1&query=...`)
 * so the user sees the exact parking lot pin first and can choose their own starting point
 * instead of jumping straight into turn-by-turn navigation.
 */
export function buildGoogleMapsDrivingUrl(
  lat: number,
  lng: number,
  name?: string,
  address?: string
): string {
  const query = formatGoogleMapsStopQuery(lat, lng, name, address);

  const params = new URLSearchParams({
    api: '1',
    query
  });

  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/**
 * Generates a multi-stop sequential Google Maps route preview URL
 * (1st choice -> 2nd choice -> 3rd choice) without forcing immediate auto-navigation,
 * allowing the driver to pick or adjust the starting point.
 */
export function buildGoogleMapsSequentialUrl(
  stops: Array<{ lat: number; lng: number; name?: string; address?: string }>
): string | null {
  if (!stops || stops.length === 0) {
    return null;
  }
  if (stops.length === 1) {
    const only = stops[0];
    return buildGoogleMapsDrivingUrl(only.lat, only.lng, only.name, only.address);
  }

  const queries = stops.map((s) => formatGoogleMapsStopQuery(s.lat, s.lng, s.name, s.address));
  const finalDestination = queries[queries.length - 1];
  const waypoints = queries.slice(0, -1).join('|');

  const params = new URLSearchParams({
    api: '1',
    destination: finalDestination,
    waypoints,
    travelmode: 'driving'
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Generates a standard Google Maps location pin preview URL.
 */
export function buildGoogleMapsPreviewUrl(
  lat: number,
  lng: number,
  name?: string,
  address?: string
): string {
  return buildGoogleMapsDrivingUrl(lat, lng, name, address);
}

/**
 * Determines the vacancy status based on available spaces:
 * - < 0 spaces (-1): UNKNOWN (no real-time vacancy data)
 * - === 0 spaces: FULL (confirmed 0 spaces left)
 * - 1..10 spaces: LIMITED (almost full warning)
 * - > 10 spaces: AVAILABLE
 */
export function classifyVacancyStatus(availableSpaces: number): VacancyStatus {
  if (availableSpaces < 0) {
    return 'UNKNOWN';
  }
  if (availableSpaces === 0) {
    return 'FULL';
  }
  if (availableSpaces <= LIMITED_VACANCY_THRESHOLD) {
    return 'LIMITED';
  }
  return 'AVAILABLE';
}

/**
 * Evaluates a parking lot relative to the user's destination.
 * Uses concise fraction format `空位 / 總位數` (e.g. `134 / 476`, `0 / 44`, `? / 32`).
 */
export function evaluateParkingNavigation(
  lot: RawParkingLot,
  destLat: number,
  destLng: number
): ParkingLotView {
  const distanceMeters = calculateDistanceMeters(destLat, destLng, lot.lat, lot.lng);
  const status = classifyVacancyStatus(lot.availableSpaces);
  const dataSource =
    lot.dataSource ?? (status === 'UNKNOWN' ? 'NO_LIVE_DATA' : 'LIVE_OPENDATA');

  let dataSourceLabel = lot.sourceTag ?? '北市停管';
  if (!lot.sourceTag) {
    if (dataSource === 'NO_LIVE_DATA') {
      dataSourceLabel = 'OSM圖資';
    } else if (dataSource === 'SIMULATED') {
      dataSourceLabel = '測試資料';
    }
  }

  const totalPart = lot.totalSpaces > 0 ? String(lot.totalSpaces) : '?';

  let statusLabel = '';
  let canNavigate = false;
  let warningMessage: string | null = null;
  let googleMapsNavUrl: string | null = null;

  switch (status) {
    case 'AVAILABLE':
      statusLabel = `🟢 ${lot.availableSpaces} / ${totalPart}`;
      canNavigate = true;
      googleMapsNavUrl = buildGoogleMapsDrivingUrl(lot.lat, lot.lng, lot.name, lot.address);
      break;

    case 'LIMITED':
      statusLabel = `🟡 ${lot.availableSpaces} / ${totalPart}`;
      canNavigate = true;
      warningMessage = `剩餘車位較少 (${lot.availableSpaces}/${totalPart})`;
      googleMapsNavUrl = buildGoogleMapsDrivingUrl(lot.lat, lot.lng, lot.name, lot.address);
      break;

    case 'UNKNOWN':
      statusLabel = `⚪ ? / ${totalPart} (無資料)`;
      canNavigate = true;
      warningMessage = '未公開即時空位（非代表已滿位）';
      googleMapsNavUrl = buildGoogleMapsDrivingUrl(lot.lat, lot.lng, lot.name, lot.address);
      break;

    case 'FULL':
      statusLabel = `🚫 0 / ${totalPart} (已滿位)`;
      canNavigate = false;
      warningMessage = '無空位，已鎖定導航';
      googleMapsNavUrl = null;
      break;
  }

  return {
    ...lot,
    dataSource,
    dataSourceLabel,
    distanceMeters,
    status,
    statusLabel,
    priorityRank: null,
    canNavigate,
    warningMessage,
    googleMapsNavUrl,
    googleMapsPreviewUrl: buildGoogleMapsPreviewUrl(lot.lat, lot.lng, lot.name, lot.address)
  };
}
