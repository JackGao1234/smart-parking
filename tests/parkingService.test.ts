import { describe, expect, it } from 'vitest';
import { ParkingService } from '../src/core/parkingService.js';
import { RawParkingLot } from '../src/core/types.js';
import { TaiwanParkingProvider } from '../src/providers/taiwanParkingProvider.js';

const fixtureLots: RawParkingLot[] = [
  {
    id: 'lot-closest-full',
    name: '超近但已滿位停車場',
    city: '台北市',
    district: '信義區',
    address: '信義路五段7號',
    lat: 25.03398,
    lng: 121.5645,
    totalSpaces: 200,
    availableSpaces: 0, // FULL!
    hourlyRate: 'NT$100 / 小時',
    updatedAt: '2026-11-16T12:00:00Z'
  },
  {
    id: 'lot-near-available',
    name: '近距離有車位停車場',
    city: '台北市',
    district: '信義區',
    address: '松智路17號',
    lat: 25.03582,
    lng: 121.56651,
    totalSpaces: 300,
    availableSpaces: 35, // AVAILABLE
    hourlyRate: 'NT$60 / 小時',
    updatedAt: '2026-11-16T12:00:00Z'
  },
  {
    id: 'lot-near-limited',
    name: '近距離車位緊張停車場',
    city: '台北市',
    district: '信義區',
    address: '松壽路9號',
    lat: 25.0345,
    lng: 121.5655,
    totalSpaces: 150,
    availableSpaces: 3, // LIMITED
    hourlyRate: 'NT$50 / 小時',
    updatedAt: '2026-11-16T12:00:00Z'
  },
  {
    id: 'lot-far-away',
    name: '高雄左營遠方停車場',
    city: '高雄市',
    district: '左營區',
    address: '博愛二路777號',
    lat: 22.66963,
    lng: 120.30239,
    totalSpaces: 500,
    availableSpaces: 120,
    hourlyRate: 'NT$30 / 小時',
    updatedAt: '2026-11-16T12:00:00Z'
  }
];

describe('ParkingService Search, Sorting, and Filtering', () => {
  it('filters out parking lots outside the search radius', async () => {
    const service = new ParkingService(new TaiwanParkingProvider(fixtureLots));
    const result = await service.searchNearbyParking({
      destLat: 25.033964,
      destLng: 121.564468,
      destName: '台北101',
      radiusMeters: 1000
    });

    const ids = result.parkingLots.map((l) => l.id);
    expect(ids).not.toContain('lot-far-away');
    expect(result.summary.totalFound).toBe(3);
  });

  it('prioritizes AVAILABLE and LIMITED lots ahead of FULL lots even when FULL lot is closer', async () => {
    const service = new ParkingService(new TaiwanParkingProvider(fixtureLots));
    const result = await service.searchNearbyParking({
      destLat: 25.033964,
      destLng: 121.564468,
      destName: '台北101',
      radiusMeters: 1000,
      onlyAvailable: false
    });

    expect(result.parkingLots.map((l) => l.id)).toEqual([
      'lot-near-available',
      'lot-near-limited',
      'lot-closest-full'
    ]);

    // Verify priorityRank and sequentialPlan
    expect(result.parkingLots[0].priorityRank).toBe(1);
    expect(result.parkingLots[1].priorityRank).toBe(2);
    expect(result.parkingLots[2].priorityRank).toBeNull();
    expect(result.sequentialPlan.lotIds).toEqual(['lot-near-available', 'lot-near-limited']);
    expect(result.sequentialPlan.googleMapsSequentialUrl).toContain('waypoints=');

    // Verify full lot is marked and cannot be navigated to
    const fullLot = result.parkingLots[2];
    expect(fullLot.status).toBe('FULL');
    expect(fullLot.canNavigate).toBe(false);
    expect(fullLot.googleMapsNavUrl).toBeNull();
  });

  it('hides FULL lots completely when onlyAvailable is true while keeping accurate area summary', async () => {
    const service = new ParkingService(new TaiwanParkingProvider(fixtureLots));
    const result = await service.searchNearbyParking({
      destLat: 25.033964,
      destLng: 121.564468,
      radiusMeters: 1000,
      onlyAvailable: true
    });

    expect(result.parkingLots.length).toBe(2);
    expect(result.parkingLots.every((l) => l.canNavigate)).toBe(true);
    expect(result.summary.fullCount).toBe(1);
  });

  it('prioritizes Government/Live Open Data over generic OSM POIs and deduplicates nearby OSM duplicates', async () => {
    const mixedLots: RawParkingLot[] = [
      {
        id: 'osm-dup-1',
        name: '西湖公園地下停車場 (OSM)',
        city: '台北市',
        district: '內湖區',
        address: '內湖路一段387巷',
        lat: 25.08295,
        lng: 121.57028,
        totalSpaces: 0,
        availableSpaces: -1,
        hourlyRate: '依現場公告',
        dataSource: 'NO_LIVE_DATA',
        sourceTag: 'OSM圖資',
        updatedAt: '2026-11-16T12:00:00Z'
      },
      {
        id: 'tpe-live-gov',
        name: '西湖公園地下停車場',
        city: '台北市',
        district: '內湖區',
        address: '台北市內湖區內湖路一段387巷38號',
        lat: 25.08292,
        lng: 121.57025,
        totalSpaces: 236,
        availableSpaces: 42,
        hourlyRate: 'NT$30 / 小時',
        dataSource: 'LIVE_OPENDATA',
        sourceTag: '北市停管',
        updatedAt: '2026-11-16T12:00:00Z'
      }
    ];

    const service = new ParkingService(new TaiwanParkingProvider(mixedLots));
    const result = await service.searchNearbyParking({
      destLat: 25.083,
      destLng: 121.5703,
      radiusMeters: 500
    });

    expect(result.parkingLots.length).toBe(1);
    expect(result.parkingLots[0].id).toBe('tpe-live-gov');
    expect(result.parkingLots[0].dataSourceLabel).toBe('北市停管');
  });
});
