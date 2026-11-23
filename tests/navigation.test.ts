import { describe, expect, it } from 'vitest';
import {
  buildGoogleMapsDrivingUrl,
  buildGoogleMapsSequentialUrl,
  classifyVacancyStatus,
  evaluateParkingNavigation
} from '../src/core/navigation.js';
import { RawParkingLot } from '../src/core/types.js';

const baseLot: RawParkingLot = {
  id: 'test-lot-1',
  name: '平鎮區文化公園地下停車場',
  city: '桃園市',
  district: '平鎮區',
  address: '桃園市平鎮區復興街85號',
  lat: 24.95352,
  lng: 121.20412,
  totalSpaces: 232,
  availableSpaces: 64,
  hourlyRate: 'NT$30 / 小時',
  is24Hours: true,
  updatedAt: '2026-11-16T12:00:00.000Z'
};

describe('Vacancy Classification & Google Maps Navigation Safety', () => {
  it('builds a Google Maps search pin URL using official address + name so user can preview location before navigating', () => {
    const url = buildGoogleMapsDrivingUrl(
      24.95621,
      121.20775,
      '廣北平面停車場',
      '桃園市平鎮區民族路245號 (廣達公園旁)'
    );
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://www.google.com/maps/search/');
    expect(parsed.searchParams.get('api')).toBe('1');
    expect(parsed.searchParams.get('query')).toBe('桃園市平鎮區民族路245號 廣北平面停車場');
    expect(parsed.searchParams.get('dir_action')).toBeNull();
  });

  it('falls back to exact lat,lng when address has no doorplate number (prevents Google Maps matching distant lot on same road)', () => {
    const url = buildGoogleMapsDrivingUrl(
      24.15908,
      120.73417,
      '廍子路停車場',
      '廍子路 廍子里 北屯區'
    );
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://www.google.com/maps/search/');
    expect(parsed.searchParams.get('query')).toBe('24.15908,120.73417');
  });

  it('falls back to lat,lng when name and address are omitted', () => {
    const url = buildGoogleMapsDrivingUrl(25.03582, 121.56651);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('query')).toBe('25.03582,121.56651');
  });

  it('builds a multi-stop sequential Google Maps route URL (1st choice -> 2nd choice -> 3rd choice) for backup navigation', () => {
    const seqUrl = buildGoogleMapsSequentialUrl([
      {
        lat: 25.08292,
        lng: 121.57025,
        name: '西湖公園地下停車場',
        address: '台北市內湖區內湖路一段387巷38號'
      },
      {
        lat: 25.07963,
        lng: 121.56929,
        name: '洲子立體停車場',
        address: '台北市內湖區瑞光路513巷22弄2號'
      },
      {
        lat: 25.08061,
        lng: 121.57385,
        name: '麗山國小地下停車場',
        address: '台北市內湖區港華街100號'
      }
    ]);

    expect(seqUrl).not.toBeNull();
    const parsed = new URL(seqUrl!);
    expect(parsed.searchParams.get('waypoints')).toBe(
      '台北市內湖區內湖路一段387巷38號 西湖公園地下停車場|台北市內湖區瑞光路513巷22弄2號 洲子立體停車場'
    );
    expect(parsed.searchParams.get('destination')).toBe(
      '台北市內湖區港華街100號 麗山國小地下停車場'
    );
    expect(parsed.searchParams.get('travelmode')).toBe('driving');
    expect(parsed.searchParams.get('dir_action')).toBeNull();
  });

  it('classifies vacancy status properly for AVAILABLE, LIMITED, FULL, and UNKNOWN', () => {
    expect(classifyVacancyStatus(50)).toBe('AVAILABLE');
    expect(classifyVacancyStatus(10)).toBe('LIMITED');
    expect(classifyVacancyStatus(1)).toBe('LIMITED');
    expect(classifyVacancyStatus(0)).toBe('FULL');
    expect(classifyVacancyStatus(-1)).toBe('UNKNOWN');
  });

  it('enables Google Maps location preview when parking lot has available spaces (> 10)', () => {
    const view = evaluateParkingNavigation(
      { ...baseLot, availableSpaces: 45 },
      24.95405,
      121.20355
    );
    expect(view.status).toBe('AVAILABLE');
    expect(view.canNavigate).toBe(true);
    const parsed = new URL(view.googleMapsNavUrl!);
    expect(parsed.origin + parsed.pathname).toBe('https://www.google.com/maps/search/');
    expect(parsed.searchParams.get('query')).toBe(
      '桃園市平鎮區復興街85號 平鎮區文化公園地下停車場'
    );
    expect(view.warningMessage).toBeNull();
  });

  it('enables navigation with a caution banner when spaces are LIMITED (1..10)', () => {
    const view = evaluateParkingNavigation(
      { ...baseLot, availableSpaces: 4 },
      24.95405,
      121.20355
    );
    expect(view.status).toBe('LIMITED');
    expect(view.canNavigate).toBe(true);
    expect(view.googleMapsNavUrl).not.toBeNull();
    expect(view.warningMessage).toContain('剩餘車位較少');
  });

  it('CRITICAL: marks FULL (0 spaces) clearly and locks/disables Google Maps navigation URL', () => {
    const view = evaluateParkingNavigation(
      { ...baseLot, availableSpaces: 0 },
      24.95405,
      121.20355
    );
    expect(view.status).toBe('FULL');
    expect(view.statusLabel).toContain('已滿位');
    expect(view.canNavigate).toBe(false);
    expect(view.googleMapsNavUrl).toBeNull();
    expect(view.warningMessage).toContain('無空位');
  });

  it('CRITICAL: marks UNKNOWN (-1 spaces) as concise fraction "? / 232 (無資料)" (distinct from FULL 0 spaces) and allows optional navigation', () => {
    const view = evaluateParkingNavigation(
      { ...baseLot, availableSpaces: -1 },
      24.95405,
      121.20355
    );
    expect(view.status).toBe('UNKNOWN');
    expect(view.statusLabel).toBe('⚪ ? / 232 (無資料)');
    expect(view.statusLabel).not.toContain('已滿位');
    expect(view.canNavigate).toBe(true);
    expect(view.googleMapsNavUrl).not.toBeNull();
    expect(view.warningMessage).toContain('非代表已滿位');
  });

  it('caps available spaces at totalSpaces with "*" and exposes raw count in statusTooltip when API exceeds total', () => {
    const view = evaluateParkingNavigation(
      { ...baseLot, totalSpaces: 88, availableSpaces: 177 },
      24.95405,
      121.20355
    );
    expect(view.status).toBe('AVAILABLE');
    expect(view.statusLabel).toBe('🟢 88 / 88 *');
    expect(view.statusTooltip).toBe('原始回傳：177 / 88（超過總車位數）');
  });
});
