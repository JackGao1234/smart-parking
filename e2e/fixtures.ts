import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type BrowserContext, type Page } from '@playwright/test';

// E2E_DOCS_DIR：改測另一份 docs 複本（例如故意弄壞的版本），不必動原檔。
const DOCS = process.env.E2E_DOCS_DIR ?? fileURLToPath(new URL('../docs/', import.meta.url));
const APP = 'http://app.test';
export const TAIPEI = { lat: 25.0478, lng: 121.5319 };
export const TAICHUNG = { lat: 24.1477, lng: 120.6736 };

export const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export interface Lot {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  totalSpaces: number;
  availableSpaces: number;
  liveStatus?: string;
  dataAt?: string;
  dataAtKind?: string;
  hourlyRate: string;
  sourceTag: string;
}

/** 第 n 個停車場在目的地北方約 n × 110 公尺，所以距離順序就是 n 的順序。 */
export function makeLot(n: number, over: Partial<Lot> = {}, center = TAIPEI): Lot {
  return {
    id: `tpe-T${n}`,
    name: `測試${n}號停車場`,
    address: '台北市測試路',
    lat: Number((center.lat + n * 0.001).toFixed(6)),
    lng: center.lng,
    totalSpaces: 100,
    availableSpaces: 50,
    dataAt: minsAgo(2),
    dataAtKind: 'official',
    hourlyRate: '30元',
    sourceTag: '北市停管',
    ...over
  };
}

export function taipeiXml(spaces: Record<string, number>, ageMinutes = 1): string {
  const local = new Date(Date.now() - ageMinutes * 60_000 + 8 * 3_600_000); // 台北時間
  const [wd, d, mon, y, hms] = local.toUTCString().replace(',', '').split(' ');
  const parks = Object.entries(spaces).map(
    ([id, n]) => `<PARK><ID>${id}</ID><AVAILABLECAR>${n}</AVAILABLECAR></PARK>`
  );
  return `<DATA><UPDATETIME>${wd} ${mon} ${d} ${hms} CST ${y}</UPDATETIME>${parks.join('')}</DATA>`;
}

export interface Backend {
  lots: Lot[];
  roads?: Lot[];
  /** 手機直抓的台北 XML；不給就模擬連線失敗。 */
  taipei?: string;
  /** 手機直抓的台中燈號；不給就模擬連線失敗。 */
  taichung?: Array<{ ID: string; AvailableCarRGB: string }>;
}

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };

/** 開真正的 docs/index.html；所有網路都在這裡回假資料，沒列到的一律擋掉。 */
export async function openLivePage(page: Page, context: BrowserContext, backend: Backend, dest = TAIPEI) {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown) =>
      route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });

    if (url.origin === APP) {
      if (url.pathname === '/data/live-parking.json') return json({ updatedAt: minsAgo(0), lots: backend.lots });
      if (url.pathname === '/data/taipei-roadside.json') return json({ roads: backend.roads ?? [] });
      if (url.pathname === '/data/custom-parking.json') return json([]);
      const file = path.join(DOCS, url.pathname);
      try {
        return await route.fulfill({
          body: readFileSync(file),
          contentType: `${MIME[path.extname(file)] ?? 'text/plain'}; charset=utf-8`
        });
      } catch {
        return route.fulfill({ status: 404, body: '' });
      }
    }
    if (url.pathname.endsWith('TCMSV_allavailable.xml') && backend.taipei) {
      return route.fulfill({ body: backend.taipei, headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.hostname === 'newdatacenter.taichung.gov.tw' && backend.taichung) return json(backend.taichung);
    if (url.hostname === 'overpass-api.de') return json({ elements: [{ tags: { access: 'private' } }] });
    if (url.hostname === 'www.google.com') return route.fulfill({ body: 'maps', contentType: 'text/html' });
    return route.abort();
  });

  await page.addInitScript((d) => {
    localStorage.setItem(
      'smart_parking_last_search_v1',
      JSON.stringify({ mode: { type: 'coords', ...d, name: 'test' }, inputText: 'test' })
    );
  }, dest);
  await page.goto(`${APP}/index.html`);
  await expect(page.locator('.parking-card').first()).toBeVisible();
}

export const card = (page: Page, lot: Lot) => page.locator('.parking-card', { hasText: lot.name });

const coords = (lot: Lot) => `${lot.lat},${lot.lng}`;

/** 滿位：卡片鎖住，而且整頁任何連結（卡片、順位、連導）都不含這個停車場。 */
export async function expectLocked(page: Page, lot: Lot) {
  const c = card(page, lot);
  await expect(c).toHaveClass(/status-FULL/);
  await expect(c.locator('button.nav-btn')).toBeDisabled();
  await expect(c.locator('button.nav-btn')).toContainText('鎖定導航');
  await expect(c.locator('a')).toHaveCount(0);
  await expect(c.locator('.seq-toggle-btn')).toHaveCount(0);
  await expect(page.locator('#sequential-panel')).not.toContainText(lot.name);
  const hrefs = await page.locator('a[href]').evaluateAll((as) =>
    as.map((a) => decodeURIComponent((a as HTMLAnchorElement).href))
  );
  expect(hrefs.filter((h) => h.includes(coords(lot)))).toEqual([]);
}

export async function expectNavigable(page: Page, lot: Lot) {
  const link = card(page, lot).locator('a.nav-btn');
  await expect(link).toHaveCount(1);
  expect(decodeURIComponent((await link.getAttribute('href')) ?? '')).toContain(coords(lot));
}

export { coords };
