import { buildGoogleMapsSequentialUrl, evaluateParkingNavigation } from './navigation.js';
import {
  ParkingDataProvider,
  ParkingLotView,
  SearchParkingOptions,
  SearchParkingResult,
  VacancyStatus
} from './types.js';
import { calculateDistanceMeters } from './geo.js';

const STATUS_PRIORITY: Record<VacancyStatus, number> = {
  AVAILABLE: 1,
  LIMITED: 2,
  UNKNOWN: 3,
  FULL: 4
};

function getSourcePriority(lot: ParkingLotView): number {
  // Government / Live Open Data always outranks generic OSM map POIs
  if (lot.dataSource === 'LIVE_OPENDATA') return 1;
  if (
    lot.sourceTag &&
    (lot.sourceTag.startsWith('北市') ||
      lot.sourceTag.startsWith('新北') ||
      lot.sourceTag.startsWith('桃市'))
  ) {
    return 2;
  }
  return 3;
}

export class ParkingService {
  constructor(private readonly provider: ParkingDataProvider) {}

  /**
   * Finds parking lots around a destination, prioritizes Government / Real-time Open Data
   * over generic map POIs (deduplicating nearby OSM duplicates), evaluates vacancy and
   * navigation locks, and builds a sequential backup navigation route.
   */
  async searchNearbyParking(options: SearchParkingOptions): Promise<SearchParkingResult> {
    const {
      destLat,
      destLng,
      destName = '指定目的地',
      radiusMeters = 800,
      onlyAvailable = false
    } = options;

    if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) {
      throw new Error('Destination latitude and longitude must be valid numbers');
    }
    if (radiusMeters <= 0 || radiusMeters > 20000) {
      throw new Error('Search radius must be between 1 and 20000 meters');
    }

    const rawLots = await this.provider.getParkingLots({
      destLat,
      destLng,
      radiusMeters,
      destName
    });

    // Evaluate distance and vacancy status for all lots within radius
    const withinRadius: ParkingLotView[] = rawLots
      .map((lot) => evaluateParkingNavigation(lot, destLat, destLng))
      .filter((view) => view.distanceMeters <= radiusMeters);

    // Deduplicate: if an OSM/generic POI is within 80m of an official Government/Live lot,
    // keep the Government/Live lot and drop the generic duplicate.
    const officialLots = withinRadius.filter((l) => getSourcePriority(l) <= 2);
    const deduplicated = withinRadius.filter((lot) => {
      if (getSourcePriority(lot) <= 2) return true;
      const hasOfficialNearby = officialLots.some(
        (gov) => calculateDistanceMeters(lot.lat, lot.lng, gov.lat, gov.lng) <= 80
      );
      return !hasOfficialNearby;
    });

    // Compute summary metrics across all deduplicated lots in the area
    const summary = {
      totalFound: deduplicated.length,
      availableCount: deduplicated.filter((l) => l.status === 'AVAILABLE').length,
      limitedCount: deduplicated.filter((l) => l.status === 'LIMITED').length,
      fullCount: deduplicated.filter((l) => l.status === 'FULL').length,
      unknownCount: deduplicated.filter((l) => l.status === 'UNKNOWN').length
    };

    // Filter if user requested only lots with confirmed available spaces
    const filtered = onlyAvailable
      ? deduplicated.filter((lot) => lot.status === 'AVAILABLE' || lot.status === 'LIMITED')
      : deduplicated;

    // Sort:
    // 1. STATUS_PRIORITY (AVAILABLE -> LIMITED -> UNKNOWN -> FULL)
    // 2. Source priority (Government/Live Open Data strictly before generic OSM)
    // 3. Distance ascending
    let rankCounter = 1;
    const sorted = [...filtered]
      .sort((a, b) => {
        const statusDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (statusDiff !== 0) {
          return statusDiff;
        }
        const sourceDiff = getSourcePriority(a) - getSourcePriority(b);
        if (sourceDiff !== 0) {
          return sourceDiff;
        }
        return a.distanceMeters - b.distanceMeters;
      })
      .map((lot) => ({
        ...lot,
        priorityRank: lot.canNavigate ? rankCounter++ : null
      }));

    // Build top-3 sequential backup plan (1st choice -> 2nd choice -> 3rd choice)
    const topNavigable = sorted.filter((l) => l.canNavigate).slice(0, 3);
    const sequentialPlan = {
      lotIds: topNavigable.map((l) => l.id),
      lotNames: topNavigable.map((l) => l.name),
      googleMapsSequentialUrl: buildGoogleMapsSequentialUrl(topNavigable)
    };

    return {
      destination: {
        name: destName,
        lat: destLat,
        lng: destLng
      },
      radiusMeters,
      summary,
      sequentialPlan,
      parkingLots: sorted
    };
  }

  async updateLotVacancy(id: string, availableSpaces: number): Promise<RawParkingLotResult> {
    if (!this.provider.updateVacancy) {
      throw new Error('Current parking data provider does not support manual vacancy simulation');
    }
    const updated = await this.provider.updateVacancy(id, availableSpaces);
    if (!updated) {
      return { found: false, lot: null };
    }
    return { found: true, lot: updated };
  }
}

export interface RawParkingLotResult {
  found: boolean;
  lot: import('./types.js').RawParkingLot | null;
}
