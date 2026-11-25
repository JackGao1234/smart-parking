export interface CoreLot {
  id?: string;
  totalSpaces: number;
  availableSpaces: number;
  liveStatus?: 'AVAILABLE' | 'LIMITED' | 'FULL';
  dataAt?: string | null;
  dataAtKind?: 'official' | 'fetched';
}

export interface VacancyEvaluation {
  status: 'AVAILABLE' | 'LIMITED' | 'FULL' | 'UNKNOWN';
  statusLabel: string;
  statusTooltip: string;
  canNavigate: boolean;
  isStale: boolean;
}

export interface TaipeiAvailability {
  updatedAt: string | null;
  spaces: Map<string, number>;
}

export interface TaipeiPark {
  id: string;
  name: string;
  area: string;
  address: string;
  payex: string;
  totalcar: number;
  tw97x: number;
  tw97y: number;
}

export interface TaoyuanLot {
  id: string;
  name: string;
  area: string;
  address: string;
  payGuide: string;
  totalSpaces: number;
  availableSpaces: number;
  lat: number;
  lng: number;
}

export const TAIPEI_DESC_URL: string;
export const TAIPEI_AVAIL_URL: string;
export const TAOYUAN_URL: string;
export const TAICHUNG_LIVE_URL: string;
export const MAX_DATA_AGE_MS: number;

export function parseTaipeiUpdateTime(text: unknown): string | null;
export function parseTaipeiAvailability(xml: string): TaipeiAvailability;
export function parseTaipeiDesc(xml: string): TaipeiPark[];
export function parseTaoyuanLots(rows: unknown): TaoyuanLot[];
export function parseTaichungLight(rgb: unknown): Pick<CoreLot, 'availableSpaces' | 'liveStatus'>;
export function hasVacancyData(lot: CoreLot): boolean;
export function isStaleData(dataAt: string | null | undefined, now?: number): boolean;
export function evaluateVacancy(lot: CoreLot, now?: number): VacancyEvaluation;
export function mergeTaipeiAvailability<T extends CoreLot>(lotsMap: Map<string, T>, data: TaipeiAvailability): number;
export function mergeTaichungLights<T extends CoreLot>(lotsMap: Map<string, T>, rows: unknown, fetchedAt: string): number;
export function describeFreshness(lots: CoreLot[], now?: number): { fresh: boolean; text: string };
