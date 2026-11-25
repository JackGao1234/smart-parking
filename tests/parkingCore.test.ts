import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CoreLot,
  MAX_DATA_AGE_MS,
  describeFreshness,
  evaluateVacancy,
  isStaleData,
  mergeTaichungLights,
  mergeTaipeiAvailability,
  parseTaichungLight,
  parseTaipeiAvailability,
  parseTaipeiDesc,
  parseTaipeiUpdateTime,
  parseTaoyuanLots
} from '../docs/parking-core.js';
import { expireStaleLot } from '../src/providers/taiwanParkingProvider.js';

const NOW = Date.parse('2026-11-26T01:10:00+08:00');
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();
const lot = (over: Partial<CoreLot> = {}): CoreLot => ({
  totalSpaces: 100,
  availableSpaces: 50,
  dataAt: minsAgo(5),
  ...over
});

describe('線上版滿位鎖 evaluateVacancy', () => {
  it('剩 0 格一定鎖住導航', () => {
    const r = evaluateVacancy(lot({ availableSpaces: 0 }), NOW);
    expect(r.status).toBe('FULL');
    expect(r.canNavigate).toBe(false);
  });

  it('台中紅燈一定鎖住導航（有沒有 0 格數字都一樣）', () => {
    expect(evaluateVacancy(lot({ ...parseTaichungLight('R') }), NOW).canNavigate).toBe(false);
    expect(evaluateVacancy(lot({ availableSpaces: -1, liveStatus: 'FULL' }), NOW).canNavigate).toBe(false);
  });

  it('總車位未知（0）但剩 0 格，仍然鎖住', () => {
    expect(evaluateVacancy(lot({ totalSpaces: 0, availableSpaces: 0 }), NOW).canNavigate).toBe(false);
  });

  it('剛好 30 分鐘仍算即時；超過就變成無即時資料且可導航', () => {
    const full = (age: number) =>
      evaluateVacancy(lot({ availableSpaces: 0, dataAt: new Date(NOW - age).toISOString() }), NOW);
    expect(full(MAX_DATA_AGE_MS).canNavigate).toBe(false);
    const stale = full(MAX_DATA_AGE_MS + 1);
    expect(stale).toMatchObject({ status: 'UNKNOWN', canNavigate: true, isStale: true });
    expect(stale.statusLabel).toContain('無即時資料');
  });

  it('過期的「有位」不可以顯示成有位', () => {
    expect(evaluateVacancy(lot({ dataAt: '2026-10-19T02:26:00Z' }), NOW).status).toBe('UNKNOWN');
    expect(evaluateVacancy(lot({ dataAt: undefined }), NOW).status).toBe('UNKNOWN');
  });

  it('其他狀態：有位、較少、無資料、超過總車位加星號', () => {
    expect(evaluateVacancy(lot(), NOW)).toMatchObject({ status: 'AVAILABLE', statusLabel: '🟢 50 / 100' });
    expect(evaluateVacancy(lot({ availableSpaces: 10 }), NOW).status).toBe('LIMITED');
    expect(evaluateVacancy(lot({ availableSpaces: 11 }), NOW).status).toBe('AVAILABLE');
    expect(evaluateVacancy(lot({ availableSpaces: -1 }), NOW)).toMatchObject({ status: 'UNKNOWN', canNavigate: true });
    const over = evaluateVacancy(lot({ availableSpaces: 120 }), NOW);
    expect(over.statusLabel).toBe('🟢 100 / 100 *');
    expect(over.statusTooltip).toContain('120');
  });
});

describe('資料來源解析', () => {
  const xml = `<DATA><UPDATETIME>Thu Nov 26 01:05:00 CST 2026</UPDATETIME>
    <PARK><ID>TPE0001</ID><AVAILABLECAR>12</AVAILABLECAR></PARK>
    <PARK><ID>TPE0002</ID><AVAILABLECAR>-9</AVAILABLECAR></PARK>
    <PARK><ID>TPE0003</ID><AVAILABLECAR></AVAILABLECAR></PARK></DATA>`;

  it('台北：官方時間以 +08:00 解讀，空欄位不會變成 0（滿位）', () => {
    const r = parseTaipeiAvailability(xml);
    expect(r.updatedAt).toBe('2026-11-25T17:05:00.000Z');
    expect([...r.spaces]).toEqual([['TPE0001', 12], ['TPE0002', -9]]);
    expect(parseTaipeiUpdateTime('garbage')).toBeNull();
  });

  it('台北場站：讀取欄位並還原 XML 跳脫字元', () => {
    const [p] = parseTaipeiDesc(
      '<PARK><ID>A</ID><NAME>甲&amp;乙</NAME><TW97X>302864.7</TW97X><TW97Y>2771988.9</TW97Y><TOTALCAR>17</TOTALCAR></PARK>'
    );
    expect(p).toMatchObject({ id: 'A', name: '甲&乙', totalcar: 17, tw97x: 302864.7 });
  });

  it('桃園：wgsx/wgsy 名稱相反也能放對位置，非數字空位視為無資料', () => {
    const base = { parkid: 'P1', parkname: '甲', totalspace: '165', surplusspace: '96' };
    const swapped = parseTaoyuanLots([{ ...base, wgsx: '24.959', wgsy: '121.2985' }])[0];
    const normal = parseTaoyuanLots([{ ...base, wgsx: '121.2985', wgsy: '24.959' }])[0];
    expect(swapped).toMatchObject({ lat: 24.959, lng: 121.2985, availableSpaces: 96 });
    expect(normal).toMatchObject({ lat: 24.959, lng: 121.2985 });
    expect(parseTaoyuanLots([{ ...base, wgsx: '24.9', wgsy: '121.2', surplusspace: '開放中' }])[0].availableSpaces).toBe(-1);
    expect(parseTaoyuanLots([{ ...base, wgsx: '', wgsy: '' }])).toEqual([]);
  });
});

describe('手機直抓資料合併', () => {
  it('台北：覆蓋較舊的快照，但不會被更舊的資料蓋回去', () => {
    const map = new Map<string, CoreLot>([['tpe-A', lot({ availableSpaces: 30, dataAt: minsAgo(200) })]]);
    mergeTaipeiAvailability(map, { updatedAt: minsAgo(3), spaces: new Map([['A', 0]]) });
    expect(evaluateVacancy(map.get('tpe-A')!, NOW).canNavigate).toBe(false);
    mergeTaipeiAvailability(map, { updatedAt: minsAgo(90), spaces: new Map([['A', 30]]) });
    expect(map.get('tpe-A')!.availableSpaces).toBe(0);
    expect(mergeTaipeiAvailability(map, { updatedAt: null, spaces: new Map([['A', 9]]) })).toBe(0);
  });

  it('台中：紅燈轉綠燈會解鎖，綠燈轉紅燈會鎖住', () => {
    const map = new Map<string, CoreLot>([['txg-1', lot({ ...parseTaichungLight('R'), dataAt: minsAgo(60) })]]);
    mergeTaichungLights(map, [{ ID: '1', AvailableCarRGB: 'G' }], minsAgo(2));
    expect(evaluateVacancy(map.get('txg-1')!, NOW)).toMatchObject({ status: 'AVAILABLE', canNavigate: true });
    mergeTaichungLights(map, [{ ID: '1', AvailableCarRGB: 'R' }], minsAgo(1));
    expect(evaluateVacancy(map.get('txg-1')!, NOW).canNavigate).toBe(false);
  });
});

describe('新舊標示與 Express 版過期處理', () => {
  it('標示用資料時間，全部過期時給警告', () => {
    expect(describeFreshness([lot({ dataAtKind: 'official' })], NOW).text).toBe('(官方資料時間：5 分鐘前)');
    expect(describeFreshness([lot({ dataAt: minsAgo(99) })], NOW).fresh).toBe(false);
    expect(isStaleData(new Date(NOW + 3600000).toISOString(), NOW)).toBe(true);
  });

  it('Express：過期的即時資料改成無資料，其他資料不動', () => {
    const raw = {
      id: 'x', name: 'x', city: '', district: '', address: '', lat: 25, lng: 121.5,
      totalSpaces: 10, availableSpaces: 0, hourlyRate: '', updatedAt: minsAgo(60)
    };
    expect(expireStaleLot({ ...raw, dataSource: 'LIVE_OPENDATA' }, NOW).availableSpaces).toBe(-1);
    expect(expireStaleLot({ ...raw, dataSource: 'LIVE_OPENDATA', updatedAt: minsAgo(5) }, NOW).availableSpaces).toBe(0);
    expect(expireStaleLot({ ...raw, dataSource: 'SIMULATED' }, NOW).availableSpaces).toBe(0);
  });
});

describe('線上版 docs/index.html 接線', () => {
  const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');

  it('狀態判斷只走 evaluateVacancy，沒有另外改寫 canNavigate', () => {
    expect(html).toContain('evaluateVacancy(lot)');
    expect(html).not.toMatch(/canNavigate\s*=(?!=)/);
  });

  it('不可導航的停車場沒有導航網址，卡片顯示鎖定按鈕', () => {
    expect(html).toContain('googleMapsNavUrl: canNavigate ? buildSingleNavUrl(lot) : null');
    expect(html).toMatch(/lot\.canNavigate\s*\?/);
    expect(html).toContain('鎖定導航</button>');
  });
});
