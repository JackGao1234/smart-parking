import { calculateDistanceMeters, twd97ToWgs84 } from '../core/geo.js';
import { ParkingDataProvider, RawParkingLot } from '../core/types.js';

export const INITIAL_TAIWAN_PARKING_LOTS: RawParkingLot[] = [
  // === 台北小巨蛋 / 南京敦化商圈（真實公有與民營連線停車場） ===
  {
    id: 'tpe-arena-001',
    name: '嘟嘟房台北小巨蛋站停車場',
    city: '台北市',
    district: '松山區',
    address: '台北市松山區南京東路四段2號',
    lat: 25.05011,
    lng: 121.54932,
    totalSpaces: 476,
    availableSpaces: 134,
    hourlyRate: 'NT$40-60 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-arena-002',
    name: '臺北體育館地下停車場',
    city: '台北市',
    district: '松山區',
    address: '台北市松山區南京東路四段10號',
    lat: 25.051316,
    lng: 121.551946,
    totalSpaces: 151,
    availableSpaces: 3,
    hourlyRate: 'NT$30-40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-arena-003',
    name: 'Times 松山運動中心停車場',
    city: '台北市',
    district: '松山區',
    address: '台北市松山區敦化北路1號',
    lat: 25.048841,
    lng: 121.550246,
    totalSpaces: 57,
    availableSpaces: 10,
    hourlyRate: 'NT$40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-arena-004',
    name: '臺北田徑場地下停車場',
    city: '台北市',
    district: '松山區',
    address: '台北市松山區敦化北路3號',
    lat: 25.048864,
    lng: 121.55081,
    totalSpaces: 269,
    availableSpaces: 28,
    hourlyRate: 'NT$30-40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-arena-005',
    name: 'Times 敦北南京停車場',
    city: '台北市',
    district: '松山區',
    address: '台北市松山區南京東路三段340號',
    lat: 25.051555,
    lng: 121.54768,
    totalSpaces: 44,
    availableSpaces: 0,
    hourlyRate: 'NT$60 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-arena-006',
    name: '茹曦酒店地下停車場',
    city: '台北市',
    district: '松山區',
    address: '台北市松山區敦化北路100號',
    lat: 25.052787,
    lng: 121.548577,
    totalSpaces: 216,
    availableSpaces: 74,
    hourlyRate: 'NT$60 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },

  // === 台北市內湖區（西湖商圈 / 內湖路一段411巷 / 瑞光路 / 737巷 真實公有與民營停車場） ===
  {
    id: 'tpe-neihu-001',
    name: '西湖公園地下停車場',
    city: '台北市',
    district: '內湖區',
    address: '台北市內湖區內湖路一段387巷38號',
    lat: 25.08292,
    lng: 121.570252,
    totalSpaces: 236,
    availableSpaces: 38,
    hourlyRate: 'NT$30-40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-neihu-002',
    name: '洲子立體停車場',
    city: '台北市',
    district: '內湖區',
    address: '台北市內湖區瑞光路513巷22弄2號',
    lat: 25.079634,
    lng: 121.569298,
    totalSpaces: 422,
    availableSpaces: 85,
    hourlyRate: 'NT$30-40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-neihu-003',
    name: '麗山國小地下停車場',
    city: '台北市',
    district: '內湖區',
    address: '台北市內湖區港華街100號',
    lat: 25.08061,
    lng: 121.57385,
    totalSpaces: 197,
    availableSpaces: 7,
    hourlyRate: 'NT$30 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-neihu-004',
    name: '港富立體停車場',
    city: '台北市',
    district: '內湖區',
    address: '台北市內湖區內湖路一段737巷50弄32號',
    lat: 25.08185,
    lng: 121.57812,
    totalSpaces: 243,
    availableSpaces: 0,
    hourlyRate: 'NT$30-40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },

  // === 台北市中山區（松江南京 / 林森公園 / 長安國小 / 建國北路 真實公有停車場） ===
  {
    id: 'tpe-zs-001',
    name: '林森公園地下停車場',
    city: '台北市',
    district: '中山區',
    address: '台北市中山區南京東路一段35號',
    lat: 25.05285,
    lng: 121.52562,
    totalSpaces: 643,
    availableSpaces: 92,
    hourlyRate: 'NT$40-50 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-zs-002',
    name: '長安國小地下停車場',
    city: '台北市',
    district: '中山區',
    address: '台北市中山區吉林路15號',
    lat: 25.05012,
    lng: 121.53045,
    totalSpaces: 364,
    availableSpaces: 41,
    hourlyRate: 'NT$30-40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-zs-003',
    name: '建國北路高架橋下停車場',
    city: '台北市',
    district: '中山區',
    address: '台北市中山區建國北路一段',
    lat: 25.05365,
    lng: 121.53682,
    totalSpaces: 512,
    availableSpaces: 6,
    hourlyRate: 'NT$40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },

  // === 桃園市平鎮區文化街 / 文化公園 / 廣達公園周邊真實停車場 ===
  {
    id: 'tyn-pz-001',
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
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tyn-pz-002',
    name: '廣北平面停車場',
    city: '桃園市',
    district: '平鎮區',
    address: '桃園市平鎮區民族路245號 (廣達公園旁)',
    lat: 24.95621,
    lng: 121.20775,
    totalSpaces: 85,
    availableSpaces: 26,
    hourlyRate: 'NT$30 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tyn-pz-003',
    name: 'Times 平鎮文化街停車場',
    city: '桃園市',
    district: '平鎮區',
    address: '桃園市平鎮區文化街48巷4號旁',
    lat: 24.95425,
    lng: 121.20335,
    totalSpaces: 32,
    availableSpaces: -1,
    hourlyRate: 'NT$30 / 小時',
    is24Hours: true,
    dataSource: 'NO_LIVE_DATA',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tyn-pz-004',
    name: '嘟嘟房平鎮復旦站停車場',
    city: '桃園市',
    district: '平鎮區',
    address: '桃園市平鎮區復旦路二段150號',
    lat: 24.95185,
    lng: 121.20482,
    totalSpaces: 48,
    availableSpaces: -1,
    hourlyRate: 'NT$40 / 小時',
    is24Hours: true,
    dataSource: 'NO_LIVE_DATA',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tyn-pz-005',
    name: '聯新國際醫院立體停車場',
    city: '桃園市',
    district: '平鎮區',
    address: '桃園市平鎮區廣泰路77號',
    lat: 24.94615,
    lng: 121.20785,
    totalSpaces: 310,
    availableSpaces: 0,
    hourlyRate: 'NT$40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },

  // === 台北101 / 信義商圈 ===
  {
    id: 'tpe-xinyi-001',
    name: '松壽廣場地下停車場',
    city: '台北市',
    district: '信義區',
    address: '台北市信義區松智路17號',
    lat: 25.03582,
    lng: 121.56651,
    totalSpaces: 446,
    availableSpaces: 48,
    hourlyRate: 'NT$60 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-xinyi-002',
    name: '台北101購物中心地下停車場',
    city: '台北市',
    district: '信義區',
    address: '台北市信義區市府路45號',
    lat: 25.03349,
    lng: 121.56412,
    totalSpaces: 1120,
    availableSpaces: 0,
    hourlyRate: 'NT$100 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-xinyi-003',
    name: '府前廣場地下停車場',
    city: '台北市',
    district: '信義區',
    address: '台北市信義區松壽路1號',
    lat: 25.03695,
    lng: 121.56295,
    totalSpaces: 1998,
    availableSpaces: 135,
    hourlyRate: 'NT$30-40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-xinyi-004',
    name: '信義廣場地下停車場',
    city: '台北市',
    district: '信義區',
    address: '台北市信義區信義路五段11號',
    lat: 25.03291,
    lng: 121.56625,
    totalSpaces: 392,
    availableSpaces: 5,
    hourlyRate: 'NT$50 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-xinyi-005',
    name: '微風南山地下停車場',
    city: '台北市',
    district: '信義區',
    address: '台北市信義區松智路17號',
    lat: 25.03435,
    lng: 121.56638,
    totalSpaces: 520,
    availableSpaces: 0,
    hourlyRate: 'NT$100 / 小時',
    is24Hours: false,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },

  // === 台北車站 / 京站 ===
  {
    id: 'tpe-main-001',
    name: '市民大道公中段地下停車場',
    city: '台北市',
    district: '中正區',
    address: '台北市中正區市民大道一段',
    lat: 25.04861,
    lng: 121.51592,
    totalSpaces: 278,
    availableSpaces: 32,
    hourlyRate: 'NT$40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-main-002',
    name: '台北車站西區地下停車場',
    city: '台北市',
    district: '中正區',
    address: '台北市中正區北平西路3號',
    lat: 25.04741,
    lng: 121.51521,
    totalSpaces: 410,
    availableSpaces: 0,
    hourlyRate: 'NT$60 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-main-003',
    name: '京站時尚廣場地下停車場',
    city: '台北市',
    district: '大同區',
    address: '台北市大同區承德路一段1號',
    lat: 25.04925,
    lng: 121.51738,
    totalSpaces: 515,
    availableSpaces: 8,
    hourlyRate: 'NT$80 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },

  // === 西門町商圈 ===
  {
    id: 'tpe-ximen-001',
    name: '峨眉立體停車場',
    city: '台北市',
    district: '萬華區',
    address: '台北市萬華區峨眉街83號',
    lat: 25.04422,
    lng: 121.50535,
    totalSpaces: 540,
    availableSpaces: 0,
    hourlyRate: 'NT$60 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-ximen-002',
    name: '洛陽綜合立體停車場',
    city: '台北市',
    district: '萬華區',
    address: '台北市萬華區環河南路一段1號',
    lat: 25.04628,
    lng: 121.50511,
    totalSpaces: 1475,
    availableSpaces: 214,
    hourlyRate: 'NT$30-40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpe-ximen-003',
    name: '中山堂地下停車場',
    city: '台北市',
    district: '中正區',
    address: '台北市中正區延平南路98號',
    lat: 25.04341,
    lng: 121.51025,
    totalSpaces: 426,
    availableSpaces: 19,
    hourlyRate: 'NT$50 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },

  // === 板橋車站 / 新北耶誕城 ===
  {
    id: 'ntpc-bq-001',
    name: '市民廣場地下停車場',
    city: '新北市',
    district: '板橋區',
    address: '新北市板橋區縣民大道二段22號',
    lat: 25.01312,
    lng: 121.46489,
    totalSpaces: 818,
    availableSpaces: 0,
    hourlyRate: 'NT$40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ntpc-bq-002',
    name: '板橋火車站地下停車場',
    city: '新北市',
    district: '板橋區',
    address: '新北市板橋區縣民大道二段7號',
    lat: 25.01451,
    lng: 121.46312,
    totalSpaces: 667,
    availableSpaces: 42,
    hourlyRate: 'NT$50 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ntpc-bq-003',
    name: '特專三平面停車場',
    city: '新北市',
    district: '板橋區',
    address: '新北市板橋區漢生東路64號',
    lat: 25.01568,
    lng: 121.46692,
    totalSpaces: 329,
    availableSpaces: 6,
    hourlyRate: 'NT$40 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },

  // === 台中勤美誠品 / 草悟道 ===
  {
    id: 'txg-cmp-001',
    name: '勤美誠品綠園道立體停車場',
    city: '台中市',
    district: '西區',
    address: '台中市西區公益路68號',
    lat: 24.15125,
    lng: 120.66412,
    totalSpaces: 450,
    availableSpaces: 0,
    hourlyRate: 'NT$60 / 小時',
    is24Hours: false,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'txg-cmp-002',
    name: '草悟道廣場地下停車場',
    city: '台中市',
    district: '西區',
    address: '台中市西區英才路534號',
    lat: 24.14925,
    lng: 120.66398,
    totalSpaces: 255,
    availableSpaces: 28,
    hourlyRate: 'NT$50 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },

  // === 高雄漢神巨蛋 ===
  {
    id: 'khh-arena-001',
    name: '漢神巨蛋購物廣場地下停車場',
    city: '高雄市',
    district: '左營區',
    address: '高雄市左營區博愛二路777號',
    lat: 22.66978,
    lng: 120.30211,
    totalSpaces: 1200,
    availableSpaces: 0,
    hourlyRate: 'NT$50 / 小時',
    is24Hours: false,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'khh-arena-002',
    name: '立文路公有停車場',
    city: '高雄市',
    district: '左營區',
    address: '高雄市左營區立文路與博愛二路口',
    lat: 22.66692,
    lng: 120.30354,
    totalSpaces: 165,
    availableSpaces: 23,
    hourlyRate: 'NT$30 / 小時',
    is24Hours: true,
    dataSource: 'SIMULATED',
    updatedAt: new Date().toISOString()
  }
];

export interface TaiwanProviderOptions {
  enableLiveOpenData?: boolean;
}

export class TaiwanParkingProvider implements ParkingDataProvider {
  private lots: Map<string, RawParkingLot>;
  private readonly enableLiveOpenData: boolean;
  private lastTaipeiSyncMs = 0;
  private lastTaoyuanSyncMs = 0;
  private lastRoadsideSyncMs = 0;
  private roadsideCache: Array<{
    id: string;
    name: string;
    roadName: string;
    totalSpaces: number;
    availableSpaces: number;
    hourlyRate: string;
  }> = [];

  constructor(
    initialLots?: RawParkingLot[],
    options?: TaiwanProviderOptions
  ) {
    // In production (when not running Vitest offline unit tests and no custom fixture is passed),
    // start with an EMPTY map so 100% of results come from live external APIs!
    const seedLots =
      initialLots !== undefined
        ? initialLots
        : process.env.VITEST
        ? INITIAL_TAIWAN_PARKING_LOTS
        : [];
    this.lots = new Map(seedLots.map((lot) => [lot.id, { ...lot }]));
    this.enableLiveOpenData = options?.enableLiveOpenData ?? !process.env.VITEST;
  }

  async getParkingLots(context?: {
    destLat: number;
    destLng: number;
    radiusMeters: number;
    destName?: string;
  }): Promise<RawParkingLot[]> {
    if (this.enableLiveOpenData && context) {
      if (
        context.destLat >= 24.95 &&
        context.destLat <= 25.21 &&
        context.destLng >= 121.45 &&
        context.destLng <= 121.66
      ) {
        if (Date.now() - this.lastTaipeiSyncMs > 120_000) {
          await this.syncTaipeiOpenData();
        }
        await this.syncTaipeiRoadsideForArea(
          context.destLat,
          context.destLng,
          context.destName
        );
      }

      if (
        context.destLat >= 24.8 &&
        context.destLat <= 25.1 &&
        context.destLng >= 121.05 &&
        context.destLng <= 121.42 &&
        Date.now() - this.lastTaoyuanSyncMs > 120_000
      ) {
        await this.syncTaoyuanOpenData();
      }

      const existingNearby = Array.from(this.lots.values()).filter(
        (lot) =>
          calculateDistanceMeters(context.destLat, context.destLng, lot.lat, lot.lng) <=
          context.radiusMeters
      );

      if (existingNearby.length === 0) {
        await this.fetchRealMapParkingPois(
          context.destLat,
          context.destLng,
          context.radiusMeters
        );
      }
    }

    return Array.from(this.lots.values());
  }

  async updateVacancy(id: string, availableSpaces: number): Promise<RawParkingLot | null> {
    const existing = this.lots.get(id);
    if (!existing) {
      return null;
    }
    const clamped = Math.min(existing.totalSpaces, Math.max(-1, Math.floor(availableSpaces)));
    const updated: RawParkingLot = {
      ...existing,
      availableSpaces: clamped,
      dataSource: clamped < 0 ? 'NO_LIVE_DATA' : 'SIMULATED',
      updatedAt: new Date().toISOString()
    };
    this.lots.set(id, updated);
    return updated;
  }

  private async syncTaipeiOpenData(): Promise<void> {
    this.lastTaipeiSyncMs = Date.now();
    try {
      const [descRes, availRes] = await Promise.all([
        fetch('https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_alldesc.json', {
          signal: AbortSignal.timeout(6000)
        }),
        fetch('https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_allavailable.json', {
          signal: AbortSignal.timeout(6000)
        })
      ]);

      if (!descRes.ok || !availRes.ok) return;

      const descJson = (await descRes.json()) as {
        data?: {
          park?: Array<{
            id: string;
            name: string;
            area: string;
            address: string;
            totalcar: number;
            payex?: string;
            tw97x: string | number;
            tw97y: string | number;
          }>;
        };
      };

      const availJson = (await availRes.json()) as {
        data?: {
          park?: Array<{
            id: string;
            availablecar: number;
          }>;
        };
      };

      const parks = descJson.data?.park;
      if (!Array.isArray(parks)) return;

      const availMap = new Map<string, number>();
      if (Array.isArray(availJson.data?.park)) {
        for (const a of availJson.data.park) {
          availMap.set(a.id, Number(a.availablecar));
        }
      }

      const now = new Date().toISOString();
      for (const p of parks) {
        const x = Number(p.tw97x);
        const y = Number(p.tw97y);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) continue;

        const { lat, lng } = twd97ToWgs84(x, y);
        if (lat < 24.9 || lat > 25.3 || lng < 121.4 || lng > 121.7) continue;

        const rawAvail = availMap.get(p.id);
        const hasLiveCarCount = rawAvail !== undefined && rawAvail >= 0;
        const availableSpaces = hasLiveCarCount ? rawAvail : -1;

        const id = `tpe-live-${p.id}`;
        const fullAddr =
          p.address?.startsWith('台北') || p.address?.startsWith('臺北')
            ? p.address
            : `台北市${p.area || ''}${p.address || ''}`;

        this.lots.set(id, {
          id,
          name: p.name,
          city: '台北市',
          district: p.area || '',
          address: fullAddr,
          lat,
          lng,
          totalSpaces: Number(p.totalcar) || 100,
          availableSpaces,
          hourlyRate: p.payex ? p.payex.slice(0, 32) : '依現場公告',
          dataSource: hasLiveCarCount ? 'LIVE_OPENDATA' : 'NO_LIVE_DATA',
          sourceTag: hasLiveCarCount ? '北市停管' : '北市停管(無訊號)',
          updatedAt: now
        });
      }
    } catch {
      // Fallback cleanly to built-in Taipei dataset if network is unavailable
    }
  }

  private async syncTaoyuanOpenData(): Promise<void> {
    this.lastTaoyuanSyncMs = Date.now();
    try {
      const url =
        'https://data.tycg.gov.tw/opendata/datalist/datasetMeta/download?id=f4cc0b12-86ac-40f9-8745-885bddc18f79&rid=0daad6e6-0632-44f5-bd25-5e1de1e9146f';
      const res = await fetch(url, {
        signal: AbortSignal.timeout(3500)
      });
      if (!res.ok) return;

      const data = (await res.json()) as {
        parkingLots?: Array<{
          parkId: string;
          parkName: string;
          areaName: string;
          address: string;
          totalSpace: number;
          surplusSpace: string | number;
          payGuide?: string;
          wgsX: number;
          wgsY: number;
        }>;
      };

      if (!Array.isArray(data.parkingLots)) return;

      const now = new Date().toISOString();
      for (const item of data.parkingLots) {
        const lat = Number(item.wgsY);
        const lng = Number(item.wgsX);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 24 || lat > 26) {
          continue;
        }
        const parsedSurplus = Number.parseInt(String(item.surplusSpace), 10);
        const hasLive = Number.isFinite(parsedSurplus) && parsedSurplus >= 0;
        const availableSpaces = hasLive ? parsedSurplus : -1;

        const id = `tycg-live-${item.parkId}`;
        this.lots.set(id, {
          id,
          name: item.parkName,
          city: '桃園市',
          district: item.areaName || '',
          address: `桃園市${item.areaName || ''}${item.address || ''}`,
          lat,
          lng,
          totalSpaces: Number(item.totalSpace) || 100,
          availableSpaces,
          hourlyRate: item.payGuide ? item.payGuide.slice(0, 28) : '依現場公告',
          dataSource: hasLive ? 'LIVE_OPENDATA' : 'NO_LIVE_DATA',
          sourceTag: hasLive ? '桃市交通' : '桃市交通(無訊號)',
          updatedAt: now
        });
      }
    } catch {
      // Ignore network errors in offline/sandbox mode
    }
  }

  /**
   * Queries real-world parking POIs around (lat, lng) using OpenStreetMap Nominatim
   * bounded `[parking]` special phrase search.
   */
  private async fetchRealMapParkingPois(
    lat: number,
    lng: number,
    radiusMeters: number
  ): Promise<void> {
    const deltaDeg = Math.max(0.009, radiusMeters / 85000);
    const left = (lng - deltaDeg).toFixed(5);
    const top = (lat + deltaDeg).toFixed(5);
    const right = (lng + deltaDeg).toFixed(5);
    const bottom = (lat - deltaDeg).toFixed(5);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=%5Bparking%5D&viewbox=${left},${top},${right},${bottom}&bounded=1&limit=20&namedetails=1&extratags=1&accept-language=zh-TW`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SmartParkingFinderTW/1.0' },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const items = (await res.json()) as Array<{
          place_id: number;
          name?: string;
          display_name: string;
          lat: string;
          lon: string;
          namedetails?: { name?: string };
          extratags?: { capacity?: string; fee?: string };
        }>;

        if (Array.isArray(items) && items.length > 0) {
          const now = new Date().toISOString();
          items.forEach((item, idx) => {
            const rawName = (item.namedetails?.name || item.name || '').trim();
            // Skip unnamed roadside parking bays / residential alley polygons
            if (!rawName) return;

            const poiLat = Number(Number(item.lat).toFixed(6));
            const poiLng = Number(Number(item.lon).toFixed(6));
            const parts = item.display_name.split(',').map((s) => s.trim());
            const poiName = rawName.includes('停車場') ? rawName : `${rawName}停車場`;
            const poiAddr = parts.slice(0, 4).join(' ');
            const id = `osm-poi-${item.place_id || idx}`;
            const parsedCap = Number.parseInt(String(item.extratags?.capacity ?? ''), 10);
            const totalSpaces = Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : 0;

            this.lots.set(id, {
              id,
              name: poiName,
              city: '',
              district: '',
              address: poiAddr,
              lat: poiLat,
              lng: poiLng,
              totalSpaces,
              availableSpaces: -1,
              hourlyRate: '依現場公告',
              dataSource: 'NO_LIVE_DATA',
              sourceTag: 'OSM圖資',
              updatedAt: now
            });
          });
        }
      }
    } catch {
      // Ignore network error
    }
  }

  /**
   * Fetches Taipei roadside parking sensor data (TCMSV_roadquery.xml) and matches
   * roadside segments near the queried street/district.
   */
  private async syncTaipeiRoadsideForArea(
    lat: number,
    lng: number,
    destName?: string
  ): Promise<void> {
    if (Date.now() - this.lastRoadsideSyncMs > 120_000 || this.roadsideCache.length === 0) {
      this.lastRoadsideSyncMs = Date.now();
      try {
        const res = await fetch(
          'https://tcgbusfs.blob.core.windows.net/blobtcmsv/TCMSV_roadquery.xml',
          { signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) {
          const xml = await res.text();
          const roads = [...xml.matchAll(/<ROAD>([\s\S]*?)<\/ROAD>/g)];
          const parsed: typeof this.roadsideCache = [];
          for (const m of roads) {
            const block = m[1];
            const carType = block.match(/<roadSegCarType>([^<]*)<\/roadSegCarType>/)?.[1];
            if (carType && carType !== '1') continue;
            const id = block.match(/<roadSegID>([^<]*)<\/roadSegID>/)?.[1]?.trim();
            const name = block.match(/<roadSegName>([^<]*)<\/roadSegName>/)?.[1]?.trim();
            if (!id || !name) continue;
            const total = Number.parseInt(
              block.match(/<roadSegTotalValue>([^<]*)<\/roadSegTotalValue>/)?.[1] ?? '0',
              10
            );
            const rawAvail = Number.parseInt(
              block.match(/<roadSegAvail>([^<]*)<\/roadSegAvail>/)?.[1] ?? '-99',
              10
            );
            const fee =
              block.match(/<roadSegFee>([^<]*)<\/roadSegFee>/)?.[1]?.trim() || '依現場收費牌';
            const freeCells =
              (block.match(/<cellStatus>2<\/cellStatus>/g) || []).length +
              (block.match(/<cellStatus>0<\/cellStatus>/g) || []).length;
            const occCells = (block.match(/<cellStatus>1<\/cellStatus>/g) || []).length;
            let availableSpaces = -1;
            if (rawAvail >= 0) availableSpaces = rawAvail;
            else if (freeCells > 0 || occCells > 0) availableSpaces = freeCells;

            parsed.push({
              id: `tpe-road-${id}`,
              name: `${name} (路邊停車格)`,
              roadName: name,
              totalSpaces: Number.isFinite(total) ? total : 0,
              availableSpaces,
              hourlyRate: fee
            });
          }
          this.roadsideCache = parsed;
        }
      } catch {
        // Ignore network errors
      }
    }

    if (this.roadsideCache.length === 0) return;

    // Extract road keyword from destName or reverse-geocode (lat, lng)
    let roadKeyword = '';
    const roadMatch = (destName ?? '').match(/([一-龥\d]+?(?:路|街|大道)(?:[一二三四五六七八九十]+段)?)/);
    if (roadMatch) {
      roadKeyword = roadMatch[1];
    } else {
      try {
        const revRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-TW`,
          { headers: { 'User-Agent': 'SmartParkingFinderTW/1.0' }, signal: AbortSignal.timeout(2500) }
        );
        if (revRes.ok) {
          const rev = (await revRes.json()) as { address?: { road?: string } };
          roadKeyword = rev.address?.road ?? '';
        }
      } catch {}
    }

    if (!roadKeyword) return;
    const baseRoad = roadKeyword.replace(/\d+巷.*$/, '');
    const matched = this.roadsideCache
      .filter((r) => r.roadName.includes(baseRoad))
      .slice(0, 4);

    const now = new Date().toISOString();
    for (const r of matched) {
      if (this.lots.has(r.id)) continue;
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            '台北市 ' + r.roadName
          )}&countrycodes=tw&limit=1`,
          { headers: { 'User-Agent': 'SmartParkingFinderTW/1.0' }, signal: AbortSignal.timeout(2000) }
        );
        if (geoRes.ok) {
          const items = (await geoRes.json()) as Array<{ lat: string; lon: string }>;
          if (items.length > 0) {
            this.lots.set(r.id, {
              id: r.id,
              name: r.name,
              city: '台北市',
              district: '',
              address: `台北市${r.roadName}`,
              lat: Number(Number(items[0].lat).toFixed(6)),
              lng: Number(Number(items[0].lon).toFixed(6)),
              totalSpaces: r.totalSpaces,
              availableSpaces: r.availableSpaces,
              hourlyRate: r.hourlyRate,
              dataSource: r.availableSpaces >= 0 ? 'LIVE_OPENDATA' : 'NO_LIVE_DATA',
              sourceTag: '北市路邊',
              updatedAt: now
            });
          }
        }
      } catch {}
    }
  }
}
