import express, { Express, Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geocodeDestination, TAIWAN_LANDMARKS } from './core/geo.js';
import { ParkingService } from './core/parkingService.js';
import { ParkingDataProvider } from './core/types.js';
import { TaiwanParkingProvider } from './providers/taiwanParkingProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(customProvider?: ParkingDataProvider): Express {
  const app = express();
  const provider = customProvider ?? new TaiwanParkingProvider();
  const parkingService = new ParkingService(provider);

  app.use(express.json());
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
  });
  app.use(express.static(path.join(__dirname, '..', 'public')));

  /**
   * Health check endpoint
   */
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'smart-parking-finder',
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Downloadable single-file standalone HTML app for Pixel phone (works without a backend server!)
   */
  app.get('/download-standalone', (_req: Request, res: Response) => {
    const standalonePath = path.join(__dirname, '..', 'public', 'pixel-parking-standalone.html');
    res.download(standalonePath, '智慧找車位導航-Pixel手機獨立版.html');
  });

  /**
   * Quick preset landmarks for 1-tap mobile selection
   */
  app.get('/api/landmarks', (_req: Request, res: Response) => {
    const landmarks = Object.entries(TAIWAN_LANDMARKS).map(([key, item]) => ({
      key,
      name: item.name,
      formattedAddress: item.formattedAddress,
      lat: item.lat,
      lng: item.lng
    }));
    res.json({ landmarks });
  });

  /**
   * Search parking lots by destination name or coordinate query string
   * Example: GET /api/parking/search?q=台北101&radius=800&onlyAvailable=false
   */
  app.get('/api/parking/search', async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q ?? '').trim();
      if (!q) {
        res.status(400).json({
          error: 'MISSING_DESTINATION',
          message: '請輸入目的地名稱（例如：台北101、板橋車站、西門町）或門牌地址'
        });
        return;
      }

      const radius = req.query.radius ? Number(req.query.radius) : 800;
      const onlyAvailable = req.query.onlyAvailable === 'true';

      if (!Number.isFinite(radius) || radius <= 0 || radius > 20000) {
        res.status(400).json({
          error: 'INVALID_RADIUS',
          message: '搜尋半徑必須介於 1 至 20000 公尺之間'
        });
        return;
      }

      const destination = await geocodeDestination(q);
      if (!destination) {
        res.status(404).json({
          error: 'DESTINATION_NOT_FOUND',
          message: `找不到目的地「${q}」的座標，請嘗試輸入完整地址或經緯度（如 25.0339,121.5644）`
        });
        return;
      }

      const result = await parkingService.searchNearbyParking({
        destLat: destination.lat,
        destLng: destination.lng,
        destName: destination.name,
        radiusMeters: radius,
        onlyAvailable
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  /**
   * Search parking lots directly by GPS coordinates
   * Example: GET /api/parking/nearby?lat=25.0339&lng=121.5644&radius=800&onlyAvailable=false
   */
  app.get('/api/parking/nearby', async (req: Request, res: Response) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const name = String(req.query.name ?? '目前選擇位置').trim();
      const radius = req.query.radius ? Number(req.query.radius) : 800;
      const onlyAvailable = req.query.onlyAvailable === 'true';

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        res.status(400).json({
          error: 'INVALID_COORDINATES',
          message: '請提供有效的經緯度座標 (lat, lng)'
        });
        return;
      }

      if (!Number.isFinite(radius) || radius <= 0 || radius > 20000) {
        res.status(400).json({
          error: 'INVALID_RADIUS',
          message: '搜尋半徑必須介於 1 至 20000 公尺之間'
        });
        return;
      }

      const result = await parkingService.searchNearbyParking({
        destLat: lat,
        destLng: lng,
        destName: name,
        radiusMeters: radius,
        onlyAvailable
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  /**
   * Simulate real-time parking vacancy changes (for live testing / demo)
   * POST /api/parking/simulate-update { id: "tpe-xinyi-001", availableSpaces: 0 }
   */
  app.post('/api/parking/simulate-update', async (req: Request, res: Response) => {
    try {
      const { id, availableSpaces } = req.body ?? {};
      if (!id || typeof id !== 'string' || typeof availableSpaces !== 'number') {
        res.status(400).json({
          error: 'INVALID_PAYLOAD',
          message: '請提供有效的停車場 id 與 availableSpaces 數值'
        });
        return;
      }

      const outcome = await parkingService.updateLotVacancy(id, availableSpaces);
      if (!outcome.found || !outcome.lot) {
        res.status(404).json({
          error: 'PARKING_LOT_NOT_FOUND',
          message: `找不到 ID 為 ${id} 的停車場`
        });
        return;
      }

      res.json({
        message: '已更新停車場即時空位數',
        lot: outcome.lot
      });
    } catch (err) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  return app;
}
