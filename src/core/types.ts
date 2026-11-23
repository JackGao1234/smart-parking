export type VacancyStatus = 'AVAILABLE' | 'LIMITED' | 'FULL' | 'UNKNOWN';
export type ParkingDataSource = 'LIVE_OPENDATA' | 'NO_LIVE_DATA' | 'SIMULATED';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DestinationInfo extends Coordinates {
  name: string;
  formattedAddress: string;
}

export interface RawParkingLot {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  totalSpaces: number;
  /**
   * Number of currently available spaces:
   * - > 0: known available spaces
   * - 0: known FULL (0 spaces left)
   * - -1: UNKNOWN (no real-time vacancy data available)
   */
  availableSpaces: number;
  hourlyRate: string;
  is24Hours?: boolean;
  dataSource?: ParkingDataSource;
  sourceTag?: string;
  updatedAt: string;
}

export interface ParkingLotView extends RawParkingLot {
  distanceMeters: number;
  status: VacancyStatus;
  statusLabel: string;
  statusTooltip?: string;
  dataSourceLabel: string;
  /**
   * 1-based priority rank among navigable lots (1 = 1st choice, 2 = 2nd backup, etc.).
   * Null when status === 'FULL' (not navigable).
   */
  priorityRank: number | null;
  /**
   * True when navigation is allowed (AVAILABLE, LIMITED, or UNKNOWN with caution).
   * False ONLY when status === 'FULL' (confirmed 0 spaces), preventing navigation to a full lot.
   */
  canNavigate: boolean;
  warningMessage: string | null;
  /**
   * Universal Google Maps turn-by-turn driving navigation URL (Single target).
   * Null when canNavigate is false (preventing accidental navigation to confirmed FULL lots).
   */
  googleMapsNavUrl: string | null;
  /**
   * Secondary map preview URL for inspection only (not active navigation).
   */
  googleMapsPreviewUrl: string;
}

export interface SequentialNavigationPlan {
  /**
   * Ordered list of recommended parking lot IDs (e.g. top 3 navigable lots: 1st, 2nd, 3rd choice).
   */
  lotIds: string[];
  lotNames: string[];
  /**
   * Multi-stop Google Maps driving URL (1st choice -> 2nd choice -> 3rd choice)
   * so if the 1st lot has a traffic jam or queue, the driver can immediately advance to the 2nd lot.
   */
  googleMapsSequentialUrl: string | null;
}

export interface SearchParkingOptions {
  destLat: number;
  destLng: number;
  destName?: string;
  radiusMeters?: number;
  onlyAvailable?: boolean;
}

export interface SearchParkingResult {
  destination: {
    name: string;
    lat: number;
    lng: number;
  };
  radiusMeters: number;
  summary: {
    totalFound: number;
    availableCount: number;
    limitedCount: number;
    fullCount: number;
    unknownCount: number;
  };
  sequentialPlan: SequentialNavigationPlan;
  parkingLots: ParkingLotView[];
}

export interface ParkingDataProvider {
  getParkingLots(context?: {
    destLat: number;
    destLng: number;
    radiusMeters: number;
    destName?: string;
  }): Promise<RawParkingLot[]>;
  updateVacancy?(id: string, availableSpaces: number): Promise<RawParkingLot | null>;
}
