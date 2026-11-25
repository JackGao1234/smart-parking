import { expect, test } from '@playwright/test';
import {
  TAICHUNG,
  card,
  coords,
  expectLocked,
  expectNavigable,
  makeLot,
  minsAgo,
  openLivePage,
  showOnlyAvailable,
  taipeiXml
} from './fixtures';

test.describe('線上版滿位鎖導航', () => {
  test('剩 0 格：卡片鎖住，所有導航入口都沒有它；有位的正常', async ({ page, context }) => {
    const full = makeLot(1, { availableSpaces: 0 });
    const open = makeLot(2);
    await openLivePage(page, context, { lots: [full, open] });
    await expectLocked(page, full);
    await expectNavigable(page, open);
  });

  test('總車位未知、但剩 0 格，也要鎖住', async ({ page, context }) => {
    const full = makeLot(1, { availableSpaces: 0, totalSpaces: 0 });
    await openLivePage(page, context, { lots: [full, makeLot(2)] });
    await expectLocked(page, full);
  });

  test('路邊停車格 0 格也要鎖住', async ({ page, context }) => {
    const road = makeLot(1, { id: 'tpe-road-1', name: '測試路邊格', availableSpaces: 0, sourceTag: '北市路邊' });
    await openLivePage(page, context, { lots: [makeLot(2)], roads: [road] });
    await expectLocked(page, road);
  });

  test('用力點鎖住的按鈕，不會開任何頁面', async ({ page, context }) => {
    const full = makeLot(1, { availableSpaces: 0 });
    await openLivePage(page, context, { lots: [full] });
    await card(page, full).locator('button.nav-btn').dispatchEvent('click');
    await card(page, full).locator('button.nav-btn').click({ force: true });
    await page.waitForTimeout(300);
    expect(context.pages()).toHaveLength(1);
    expect(page.url()).toContain('app.test');
  });

  test('全部滿位：沒有順位導航，也沒有任何 Google Maps 連結', async ({ page, context }) => {
    const lots = [1, 2, 3].map((n) => makeLot(n, { availableSpaces: 0 }));
    await openLivePage(page, context, { lots });
    for (const lot of lots) await expectLocked(page, lot);
    await expect(page.locator('#sequential-panel')).toBeEmpty();
    await expect(page.locator('a[href*="google.com/maps"]')).toHaveCount(0);
  });

  test('順位連導與「換下一家」都跳過滿位場', async ({ page, context }) => {
    const full = makeLot(1, { availableSpaces: 0 });
    const a = makeLot(2);
    const b = makeLot(3);
    await openLivePage(page, context, { lots: [full, a, b] });
    const multi = decodeURIComponent((await page.locator('.seq-multi-btn').getAttribute('href')) ?? '');
    expect(multi).toContain(coords(a));
    expect(multi).toContain(coords(b));
    expect(multi).not.toContain(coords(full));

    for (const expected of [b, a]) {
      const popup = context.waitForEvent('page');
      await page.locator('#seq-next-btn').click();
      const opened = await popup;
      await opened.waitForURL(/google\.com\/maps/);
      expect(decodeURIComponent(opened.url())).toContain(coords(expected));
      await opened.close();
    }
  });

  test('開啟「僅看確認有位」時，滿位場不出現', async ({ page, context }) => {
    const full = makeLot(1, { availableSpaces: 0 });
    const open = makeLot(2);
    await openLivePage(page, context, { lots: [full, open] });
    await showOnlyAvailable(page, [open]);
  });
});

test.describe('手機直抓資料與滿位鎖', () => {
  test('台北：快照有位、官方已滿 → 鎖住；快照滿、官方有位 → 解鎖', async ({ page, context }) => {
    const nowFull = makeLot(1);
    const nowOpen = makeLot(2, { availableSpaces: 0 });
    await openLivePage(page, context, { lots: [nowFull, nowOpen], taipei: taipeiXml({ T1: 0, T2: 20 }) });
    await expectLocked(page, nowFull);
    await expectNavigable(page, nowOpen);
  });

  test('台北：直抓到的資料比快照舊，不能解開滿位鎖', async ({ page, context }) => {
    const full = makeLot(1, { availableSpaces: 0 });
    await openLivePage(page, context, { lots: [full, makeLot(2)], taipei: taipeiXml({ T1: 30 }, 20) });
    await expectLocked(page, full);
  });

  test('直抓失敗：30 分鐘內的滿位快照仍然鎖住', async ({ page, context }) => {
    const full = makeLot(1, { availableSpaces: 0, dataAt: minsAgo(25) });
    await openLivePage(page, context, { lots: [full, makeLot(2)] });
    await expectLocked(page, full);
  });

  test('台中：綠燈轉紅燈會鎖住', async ({ page, context }) => {
    const txg = (n: number) =>
      makeLot(n, { id: `txg-${n}`, availableSpaces: -1, liveStatus: 'AVAILABLE', sourceTag: '台中交通' }, TAICHUNG);
    const red = txg(1);
    const green = txg(2);
    await openLivePage(
      page,
      context,
      {
        lots: [red, green],
        taichung: [
          { ID: '1', AvailableCarRGB: 'R' },
          { ID: '2', AvailableCarRGB: 'G' }
        ]
      },
      TAICHUNG
    );
    await expectLocked(page, red);
    await expectNavigable(page, green);
  });

  test('按重新整理後變滿位：立刻鎖住並移出順位', async ({ page, context }) => {
    const lot = makeLot(1);
    const backend = { lots: [lot, makeLot(2)], taipei: taipeiXml({ T1: 50, T2: 50 }) };
    await openLivePage(page, context, backend);
    await expectNavigable(page, lot);
    await expect(page.locator('#sequential-panel')).toContainText(lot.name);
    backend.taipei = taipeiXml({ T1: 0, T2: 50 }, 0);
    await page.locator('#refresh-btn').click();
    await expect(card(page, lot)).toHaveClass(/status-FULL/);
    await expectLocked(page, lot);
  });
});

test.describe('過期資料', () => {
  test('目前行為：超過 30 分鐘的滿位改成無即時資料、可導航，頁面標示沒有即時資料', async ({ page, context }) => {
    const stale = makeLot(1, { availableSpaces: 0, dataAt: minsAgo(45) });
    await openLivePage(page, context, { lots: [stale] });
    await expect(card(page, stale)).toHaveClass(/status-UNKNOWN/);
    await expect(card(page, stale)).toContainText('無即時資料');
    await expectNavigable(page, stale);
    await expect(page.locator('#sync-time-label')).toContainText('沒有 30 分鐘內的即時空位資料');
  });

  test('過期的「有位」不能顯示成有位，也不會出現在僅看確認有位', async ({ page, context }) => {
    const stale = makeLot(1, { availableSpaces: 80, dataAt: minsAgo(45) });
    const open = makeLot(2);
    await openLivePage(page, context, { lots: [stale, open] });
    await expect(card(page, stale)).toHaveClass(/status-UNKNOWN/);
    await expect(card(page, stale)).not.toContainText('80 / 100');
    await showOnlyAvailable(page, [open]);
    await expect(page.locator('#sequential-panel')).not.toContainText(stale.name);
  });
});
