import { describe, expect, it } from 'vitest';
import {
  buildAddressSearchCandidates,
  calculateDistanceMeters,
  geocodeDestination,
  parseCoordinateString,
  twd97ToWgs84
} from '../src/core/geo.js';

describe('Geo & Distance Utilities', () => {
  it('calculates 0 meters for identical coordinates', () => {
    const dist = calculateDistanceMeters(25.033964, 121.564468, 25.033964, 121.564468);
    expect(dist).toBe(0);
  });

  it('calculates accurate Haversine distance between Taipei 101 and Songshou Plaza (~290m)', () => {
    const dist = calculateDistanceMeters(25.033964, 121.564468, 25.03582, 121.56651);
    expect(dist).toBeGreaterThan(250);
    expect(dist).toBeLessThan(330);
  });

  it('throws on invalid NaN coordinates', () => {
    expect(() => calculateDistanceMeters(NaN, 121.5, 25.0, 121.5)).toThrow();
  });

  it('parses valid coordinate strings and rejects invalid ones', () => {
    expect(parseCoordinateString('25.0339, 121.5644')).toEqual({
      lat: 25.0339,
      lng: 121.5644
    });
    expect(parseCoordinateString('999, 121.5')).toBeNull();
    expect(parseCoordinateString('台北101')).toBeNull();
  });

  it('builds progressive Taiwan doorplate address candidates from lane/alley/number down to street and district', () => {
    const candidates = buildAddressSearchCandidates('桃園市平鎮區文化街24巷8號');
    expect(candidates).toContain('桃園市平鎮區文化街24巷8號');
    expect(candidates).toContain('桃園市平鎮區文化街24巷');
    expect(candidates).toContain('桃園市平鎮區文化街');
    expect(candidates).toContain('桃園市 平鎮區');
  });

  it('geocodes full Taiwan doorplate addresses like "桃園市平鎮區文化街24巷8號" and "臺北市內湖區內湖路一段411巷74弄1號" accurately', async () => {
    const pingzhen = await geocodeDestination('桃園市平鎮區文化街24巷8號');
    expect(pingzhen).not.toBeNull();
    expect(pingzhen?.lat).toBeCloseTo(24.95405, 2);
    expect(pingzhen?.lng).toBeCloseTo(121.20355, 2);

    const neihu = await geocodeDestination('臺北市內湖區內湖路一段411巷74弄1號');
    expect(neihu).not.toBeNull();
    expect(neihu?.lat).toBeCloseTo(25.08365, 2);
    expect(neihu?.lng).toBeCloseTo(121.57135, 2);
  });

  it('converts TWD97 TM2 (tw97x, tw97y) coordinates to WGS84 (lat, lng) accurately', () => {
    const coords = twd97ToWgs84(306814, 2769820);
    expect(coords.lat).toBeCloseTo(25.0358, 2);
    expect(coords.lng).toBeCloseTo(121.5632, 2);
  });

  it('geocodes built-in Taiwan landmarks and coordinate strings accurately', async () => {
    const taipei101 = await geocodeDestination('台北101');
    expect(taipei101).not.toBeNull();
    expect(taipei101?.lat).toBeCloseTo(25.033964, 4);
    expect(taipei101?.lng).toBeCloseTo(121.564468, 4);

    const banqiao = await geocodeDestination('新北耶誕城');
    expect(banqiao).not.toBeNull();
    expect(banqiao?.formattedAddress).toContain('板橋區');

    const taipeiArena = await geocodeDestination('小巨蛋');
    expect(taipeiArena).not.toBeNull();
    expect(taipeiArena?.name).toContain('台北小巨蛋');
    expect(taipeiArena?.lat).toBeCloseTo(25.0507, 3);
    expect(taipeiArena?.lng).toBeCloseTo(121.5501, 3);

    const customCoords = await geocodeDestination('24.1511, 120.6637');
    expect(customCoords).not.toBeNull();
    expect(customCoords?.lat).toBeCloseTo(24.1511, 4);
  });
});
