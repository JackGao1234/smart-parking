import { Duplex } from 'node:stream';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

interface TestResponse {
  status: number;
  body: any;
  text: string;
}

/**
 * Dispatches an HTTP request directly into the Express app pipeline in-memory
 * so API integration tests run fast and deterministically even in sandboxed environments
 * without opening ephemeral TCP sockets.
 */
async function invokeApp(
  app: Express,
  options: {
    method: 'GET' | 'POST';
    path: string;
    query?: Record<string, string | number | boolean>;
    body?: unknown;
  }
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const socket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      }
    });

    const req = new IncomingMessage(socket as any);
    req.method = options.method;

    const searchParams = new URLSearchParams();
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        searchParams.set(k, String(v));
      }
    }
    const qs = searchParams.toString();
    req.url = qs ? `${options.path}?${qs}` : options.path;
    req.headers = {
      host: 'localhost',
      'content-type': 'application/json'
    };

    const payload = options.body !== undefined ? JSON.stringify(options.body) : '';
    if (payload) {
      req.headers['content-length'] = String(Buffer.byteLength(payload));
    }

    const res = new ServerResponse(req);
    const chunks: Buffer[] = [];

    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = ((chunk: any, encoding?: any, cb?: any) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding));
      }
      return origWrite(chunk, encoding, cb);
    }) as any;

    res.end = ((chunk?: any, encoding?: any, cb?: any) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding));
      }
      origEnd(chunk, encoding, cb);

      const rawText = Buffer.concat(chunks).toString('utf8');
      let parsedBody: any = rawText;
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        // Keep raw text if not JSON
      }

      resolve({
        status: res.statusCode,
        body: parsedBody,
        text: rawText
      });
      return res;
    }) as any;

    app(req as any, res as any, (err: unknown) => {
      if (err) reject(err);
    });

    if (payload) {
      req.push(payload);
    }
    req.push(null);
  });
}

describe('Smart Parking Finder REST API Integration Tests', () => {
  it('GET /api/health returns 200 OK', async () => {
    const app = createApp();
    const res = await invokeApp(app, { method: 'GET', path: '/api/health' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('smart-parking-finder');
  });

  it('GET /api/landmarks returns built-in Taiwan quick landmarks', async () => {
    const app = createApp();
    const res = await invokeApp(app, { method: 'GET', path: '/api/landmarks' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.landmarks)).toBe(true);
    expect(res.body.landmarks.length).toBeGreaterThanOrEqual(6);
  });

  it('GET /api/parking/search?q=桃園市平鎮區文化街24巷8號 resolves doorplate address and returns Pingzhen lots with full-lot protection', async () => {
    const app = createApp();
    const res = await invokeApp(app, {
      method: 'GET',
      path: '/api/parking/search',
      query: { q: '桃園市平鎮區文化街24巷8號', radius: 1200 }
    });

    expect(res.status).toBe(200);
    expect(res.body.destination.name).toBe('桃園市平鎮區文化街24巷8號');
    expect(res.body.parkingLots.length).toBeGreaterThanOrEqual(4);

    // First lot must be available and navigable (平鎮區文化公園地下停車場 at 桃園市平鎮區復興街85號)
    expect(res.body.parkingLots[0].canNavigate).toBe(true);
    expect(res.body.parkingLots[0].googleMapsNavUrl).toContain('travelmode=driving');
    const firstDest = new URL(res.body.parkingLots[0].googleMapsNavUrl).searchParams.get(
      'destination'
    );
    expect(firstDest).toContain('平鎮區');

    // Times 平鎮文化街停車場 (-1 spaces) is marked UNKNOWN ("⚪ ? / 32 (無資料)"), NOT FULL!
    const timesLot = res.body.parkingLots.find((l: any) => l.id === 'tyn-pz-003');
    expect(timesLot).toBeDefined();
    expect(timesLot.status).toBe('UNKNOWN');
    expect(timesLot.statusLabel).toBe('⚪ ? / 32 (無資料)');
    expect(timesLot.canNavigate).toBe(true);
    expect(timesLot.googleMapsNavUrl).not.toBeNull();

    // 聯新國際醫院立體停車場 (0 spaces) is marked FULL ("🚫 已滿位 (剩 0 格)") and locked
    const fullLot = res.body.parkingLots.find((l: any) => l.id === 'tyn-pz-005');
    expect(fullLot).toBeDefined();
    expect(fullLot.status).toBe('FULL');
    expect(fullLot.canNavigate).toBe(false);
    expect(fullLot.googleMapsNavUrl).toBeNull();
  });

  it('GET /api/parking/search?q=臺北市內湖區內湖路一段411巷74弄1號 returns REAL Neihu parking lots (never fabricated names) with valid Google Maps navigation URLs', async () => {
    const app = createApp();
    const res = await invokeApp(app, {
      method: 'GET',
      path: '/api/parking/search',
      query: { q: '臺北市內湖區內湖路一段411巷74弄1號', radius: 1200 }
    });

    expect(res.status).toBe(200);
    expect(res.body.parkingLots.length).toBeGreaterThanOrEqual(3);

    const names = res.body.parkingLots.map((l: any) => l.name);
    expect(names).toContain('西湖公園地下停車場');
    expect(names).toContain('洲子立體停車場');
    // Must NEVER fabricate fake names like "台北市內湖區內湖路一段公有地下停車場"
    expect(names).not.toContain('台北市內湖區內湖路一段公有地下停車場');

    const xihuLot = res.body.parkingLots.find((l: any) => l.name.includes('西湖公園地下停車場'));
    expect(xihuLot).toBeDefined();
    expect(xihuLot.canNavigate).toBe(true);
    expect(xihuLot.priorityRank).toBe(1);
    const destParam = new URL(xihuLot.googleMapsNavUrl).searchParams.get('destination');
    expect(destParam).toContain('內湖路一段387巷38號');
    expect(destParam).toContain('西湖公園地下停車場');

    // Also verifies sequentialPlan (multi-stop 1st->2nd->3rd choice backup route)
    expect(res.body.sequentialPlan).toBeDefined();
    expect(res.body.sequentialPlan.lotIds.length).toBeGreaterThanOrEqual(2);
    expect(res.body.sequentialPlan.googleMapsSequentialUrl).toContain('waypoints=');
  });

  it('GET /api/parking/search?q=小巨蛋 resolves to Taipei Arena (never Guangzhou or Kaohsiung) and returns Taipei Arena lots', async () => {
    const app = createApp();
    const res = await invokeApp(app, {
      method: 'GET',
      path: '/api/parking/search',
      query: { q: '小巨蛋', radius: 800 }
    });

    expect(res.status).toBe(200);
    expect(res.body.destination.name).toContain('台北小巨蛋');
    expect(res.body.parkingLots.length).toBeGreaterThanOrEqual(5);

    const names = res.body.parkingLots.map((l: any) => l.name);
    expect(names).toContain('嘟嘟房台北小巨蛋站停車場');
    expect(names).toContain('臺北體育館地下停車場');
  });

  it('GET /api/parking/search?q=台北101 returns available and full-marked lots with Google Maps URLs', async () => {
    const app = createApp();
    const res = await invokeApp(app, {
      method: 'GET',
      path: '/api/parking/search',
      query: { q: '台北101', radius: 1200 }
    });

    expect(res.status).toBe(200);
    expect(res.body.destination.name).toContain('台北101');
    expect(res.body.parkingLots.length).toBeGreaterThan(0);

    const availableLots = res.body.parkingLots.filter((l: any) => l.canNavigate);
    const fullLots = res.body.parkingLots.filter((l: any) => l.status === 'FULL');

    expect(availableLots.length).toBeGreaterThan(0);
    expect(fullLots.length).toBeGreaterThan(0);

    for (const lot of availableLots) {
      expect(lot.googleMapsNavUrl).toMatch(
        /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=.*&travelmode=driving&dir_action=navigate$/
      );
    }

    for (const lot of fullLots) {
      expect(lot.canNavigate).toBe(false);
      expect(lot.googleMapsNavUrl).toBeNull();
      expect(lot.statusLabel).toContain('已滿位');
    }
  });

  it('GET /api/parking/search supports onlyAvailable=true filter', async () => {
    const app = createApp();
    const res = await invokeApp(app, {
      method: 'GET',
      path: '/api/parking/search',
      query: { q: '台北101', radius: 1200, onlyAvailable: true }
    });

    expect(res.status).toBe(200);
    expect(res.body.parkingLots.length).toBeGreaterThan(0);
    expect(res.body.parkingLots.every((l: any) => l.canNavigate === true)).toBe(true);
    expect(res.body.parkingLots.some((l: any) => l.status === 'FULL')).toBe(false);
  });

  it('GET /api/parking/search returns 400 when destination query is empty or radius is invalid', async () => {
    const app = createApp();
    const emptyRes = await invokeApp(app, {
      method: 'GET',
      path: '/api/parking/search',
      query: { q: '   ' }
    });
    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.error).toBe('MISSING_DESTINATION');

    const badRadiusRes = await invokeApp(app, {
      method: 'GET',
      path: '/api/parking/search',
      query: { q: '台北101', radius: -50 }
    });
    expect(badRadiusRes.status).toBe(400);
    expect(badRadiusRes.body.error).toBe('INVALID_RADIUS');
  });

  it('GET /api/parking/nearby validates coordinates and returns nearby lots', async () => {
    const app = createApp();
    const badRes = await invokeApp(app, {
      method: 'GET',
      path: '/api/parking/nearby',
      query: { lat: 'invalid', lng: 121.56 }
    });
    expect(badRes.status).toBe(400);

    const goodRes = await invokeApp(app, {
      method: 'GET',
      path: '/api/parking/nearby',
      query: { lat: 25.01427, lng: 121.46375, name: '板橋車站', radius: 1200 }
    });
    expect(goodRes.status).toBe(200);
    expect(goodRes.body.destination.name).toBe('板橋車站');
    expect(goodRes.body.parkingLots.length).toBeGreaterThan(0);
  });

  it('POST /api/parking/simulate-update dynamically locks navigation when a lot becomes full (0 spaces)', async () => {
    const app = createApp();

    const updateRes = await invokeApp(app, {
      method: 'POST',
      path: '/api/parking/simulate-update',
      body: { id: 'tpe-xinyi-001', availableSpaces: 0 }
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.lot.availableSpaces).toBe(0);

    const searchRes = await invokeApp(app, {
      method: 'GET',
      path: '/api/parking/search',
      query: { q: '台北101', radius: 1200 }
    });

    const songshou = searchRes.body.parkingLots.find((l: any) => l.id === 'tpe-xinyi-001');
    expect(songshou).toBeDefined();
    expect(songshou.status).toBe('FULL');
    expect(songshou.canNavigate).toBe(false);
    expect(songshou.googleMapsNavUrl).toBeNull();
  });

  it('POST /api/parking/simulate-update returns 404 for unknown parking lot ID', async () => {
    const app = createApp();
    const res = await invokeApp(app, {
      method: 'POST',
      path: '/api/parking/simulate-update',
      body: { id: 'non-existent-id', availableSpaces: 10 }
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('PARKING_LOT_NOT_FOUND');
  });
});
