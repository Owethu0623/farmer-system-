import crypto from 'node:crypto';
import { getSastDateString, sastDaysAgo } from './saTime.ts';
import { SOUTH_AFRICA_PROVINCES } from './southAfricaData.ts';
import { store } from './store.ts';
import { NasaRetrievalProvenance } from './types.ts';

export type NasaValueKind =
  | 'satellite_reanalysis_observation'
  | 'model_derived_soil_wetness_estimate'
  | 'model_derived_evaporation_estimate'
  | 'system_indicator'
  | 'historical_climatology';

export interface NasaParameterSpec {
  code: string;
  name: string;
  unit: string;
  domain: 'rainfall' | 'temperature' | 'solar_radiation' | 'humidity_wind' | 'evaporation' | 'soil_moisture';
  supportedTemporalResolutions: ('daily' | 'monthly' | 'climatology')[];
  valueKind: NasaValueKind;
  sourceProduct: string;
  latencyNote: string;
  agronomicLimitation: string;
  verifiedLive: boolean;
}

/**
 * Authoritative registry of NASA POWER Community=AG parameters verified live against
 * https://power.larc.nasa.gov/api/temporal/daily/point and /monthly/point.
 * Note: NASA POWER provides NO soil pH, NPK, organic carbon, or field-specific texture.
 */
export const NASA_PARAMETER_REGISTRY: Record<string, NasaParameterSpec> = {
  PRECTOTCORR: {
    code: 'PRECTOTCORR',
    name: 'Bias-Corrected Total Precipitation',
    unit: 'mm/day',
    domain: 'rainfall',
    supportedTemporalResolutions: ['daily', 'monthly', 'climatology'],
    valueKind: 'satellite_reanalysis_observation',
    sourceProduct: 'NASA POWER AG (MERRA-2 / IMERG bias-corrected)',
    latencyNote: 'Near-real-time daily updates typically trail present date by 2–4 days.',
    agronomicLimitation: 'Regional ~0.5° × 0.625° grid (~55 km); does not capture isolated convective storm cells or micro-catchment runoff.',
    verifiedLive: true,
  },
  T2M: {
    code: 'T2M',
    name: 'Mean Air Temperature at 2 Meters',
    unit: '°C',
    domain: 'temperature',
    supportedTemporalResolutions: ['daily', 'monthly', 'climatology'],
    valueKind: 'satellite_reanalysis_observation',
    sourceProduct: 'NASA POWER AG (MERRA-2 2m Air Temp)',
    latencyNote: 'Typically trails current date by 2–3 days.',
    agronomicLimitation: 'Grid-cell average; low-lying valley frost pockets or mountain slopes may differ by 2–4°C.',
    verifiedLive: true,
  },
  T2M_MAX: {
    code: 'T2M_MAX',
    name: 'Daily Maximum Air Temperature at 2 Meters',
    unit: '°C',
    domain: 'temperature',
    supportedTemporalResolutions: ['daily', 'monthly', 'climatology'],
    valueKind: 'satellite_reanalysis_observation',
    sourceProduct: 'NASA POWER AG (MERRA-2 Daily Tmax)',
    latencyNote: 'Typically trails current date by 2–3 days.',
    agronomicLimitation: 'Used to screen daytime heat-stress days (>=32°C / >=35°C) at ~55 km regional resolution.',
    verifiedLive: true,
  },
  T2M_MIN: {
    code: 'T2M_MIN',
    name: 'Daily Minimum Air Temperature at 2 Meters',
    unit: '°C',
    domain: 'temperature',
    supportedTemporalResolutions: ['daily', 'monthly', 'climatology'],
    valueKind: 'satellite_reanalysis_observation',
    sourceProduct: 'NASA POWER AG (MERRA-2 Daily Tmin)',
    latencyNote: 'Typically trails current date by 2–3 days.',
    agronomicLimitation: 'Screening indicator for frost risk (<=2°C / <=0°C); micro-topographic radiation frost in valleys may be colder.',
    verifiedLive: true,
  },
  ALLSKY_SFC_SW_DWN: {
    code: 'ALLSKY_SFC_SW_DWN',
    name: 'All-Sky Surface Shortwave Downward Irradiance',
    unit: 'MJ/m²/day',
    domain: 'solar_radiation',
    supportedTemporalResolutions: ['daily', 'monthly', 'climatology'],
    valueKind: 'satellite_reanalysis_observation',
    sourceProduct: 'NASA POWER AG (CERES SYN1deg / FLASHFlux)',
    latencyNote: 'Available within ~3–7 days of observation.',
    agronomicLimitation: 'Drives canopy photosynthesis potential and evaporative demand; local slope shading is not modelled.',
    verifiedLive: true,
  },
  RH2M: {
    code: 'RH2M',
    name: 'Relative Humidity at 2 Meters',
    unit: '%',
    domain: 'humidity_wind',
    supportedTemporalResolutions: ['daily', 'monthly', 'climatology'],
    valueKind: 'satellite_reanalysis_observation',
    sourceProduct: 'NASA POWER AG (MERRA-2 2m RH)',
    latencyNote: 'Typically trails current date by 2–3 days.',
    agronomicLimitation: 'Irrigated blocks or dense canopies have higher microclimate humidity than regional grid averages.',
    verifiedLive: true,
  },
  T2MDEW: {
    code: 'T2MDEW',
    name: 'Dew / Frost Point Temperature at 2 Meters',
    unit: '°C',
    domain: 'humidity_wind',
    supportedTemporalResolutions: ['daily', 'monthly', 'climatology'],
    valueKind: 'satellite_reanalysis_observation',
    sourceProduct: 'NASA POWER AG (MERRA-2 2m Dew Point)',
    latencyNote: 'Typically trails current date by 2–3 days.',
    agronomicLimitation: 'Used alongside T2M to derive atmospheric vapor pressure deficit (VPD).',
    verifiedLive: true,
  },
  WS2M: {
    code: 'WS2M',
    name: 'Wind Speed at 2 Meters',
    unit: 'm/s',
    domain: 'humidity_wind',
    supportedTemporalResolutions: ['daily', 'monthly', 'climatology'],
    valueKind: 'satellite_reanalysis_observation',
    sourceProduct: 'NASA POWER AG (MERRA-2 2m Wind)',
    latencyNote: 'Typically trails current date by 2–3 days.',
    agronomicLimitation: 'Daily mean wind speed; instantaneous spray-drift gusts require live short-term forecasts or field anemometers.',
    verifiedLive: true,
  },
  EVLAND: {
    code: 'EVLAND',
    name: 'Land Surface Evaporation Flux',
    unit: 'mm/day',
    domain: 'evaporation',
    supportedTemporalResolutions: ['daily', 'monthly', 'climatology'],
    valueKind: 'model_derived_evaporation_estimate',
    sourceProduct: 'NASA POWER AG (MERRA-2 Land Surface Evaporation)',
    latencyNote: 'Typically trails current date by 2–4 days.',
    agronomicLimitation: 'Modelled regional land evaporation (~55 km grid); distinct from crop-specific FAO Penman-Monteith ET0 or on-farm pan evaporation.',
    verifiedLive: true,
  },
  EVPTRNS: {
    code: 'EVPTRNS',
    name: 'Evapotranspiration Energy Flux',
    unit: 'MJ/m²/day',
    domain: 'evaporation',
    supportedTemporalResolutions: ['daily', 'monthly', 'climatology'],
    valueKind: 'model_derived_evaporation_estimate',
    sourceProduct: 'NASA POWER AG (MERRA-2 Latent Heat / ET Energy Flux)',
    latencyNote: 'Typically trails current date by 2–4 days.',
    agronomicLimitation: 'Regional latent energy flux (~55 km); irrigation scheduling still requires crop coefficient (Kc) and local field checks.',
    verifiedLive: true,
  },
  GWETROOT: {
    code: 'GWETROOT',
    name: 'Root Zone Soil Wetness',
    unit: '0–1 fractional index',
    domain: 'soil_moisture',
    supportedTemporalResolutions: ['daily', 'monthly', 'climatology'],
    valueKind: 'model_derived_soil_wetness_estimate',
    sourceProduct: 'NASA POWER AG (MERRA-2 Land Surface Assimilation)',
    latencyNote: 'Typically trails current date by 2–4 days.',
    agronomicLimitation: 'Model-derived regional root-zone wetness fraction (0=wilting dry, 1=saturated); NOT an on-farm probe or soil lab test.',
    verifiedLive: true,
  },
  GWETTOP: {
    code: 'GWETTOP',
    name: 'Surface Soil Wetness (Top 0–5 cm)',
    unit: '0–1 fractional index',
    domain: 'soil_moisture',
    supportedTemporalResolutions: ['daily', 'monthly', 'climatology'],
    valueKind: 'model_derived_soil_wetness_estimate',
    sourceProduct: 'NASA POWER AG (MERRA-2 Surface Layer Assimilation)',
    latencyNote: 'Typically trails current date by 2–4 days.',
    agronomicLimitation: 'Model-derived 0–5 cm seedbed wetness index (~55 km grid); verify topsoil moisture manually before seeding.',
    verifiedLive: true,
  },
  GWETPROF: {
    code: 'GWETPROF',
    name: 'Full-Profile Soil Wetness',
    unit: '0–1 fractional index',
    domain: 'soil_moisture',
    supportedTemporalResolutions: ['daily', 'monthly', 'climatology'],
    valueKind: 'model_derived_soil_wetness_estimate',
    sourceProduct: 'NASA POWER AG (MERRA-2 Full Soil Profile)',
    latencyNote: 'Typically trails current date by 2–4 days.',
    agronomicLimitation: 'Model-derived deep soil column wetness index (~55 km grid); does not reflect local hardpans or perched water tables.',
    verifiedLive: true,
  },
};

export interface NasaParameterMetadata {
  parameterCode: string;
  parameterName: string;
  unit: string;
  source: string;
  coordinatesLabel: string;
  observationPeriod: string;
  retrievedAt: string | null;
  status: 'live' | 'cached' | 'unavailable';
  valueKind: NasaValueKind;
  note: string;
}

export interface NasaDailyPoint {
  date: string;
  precipitationMm: number | null;
  tempMeanC: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  solarMjM2Day: number | null;
  humidityPercent: number | null;
  dewPointC: number | null;
  windSpeedMs: number | null;
  evlandMmDay: number | null;
  evptrnsMjM2Day: number | null;
  vpdKpa: number | null;
  gwetRoot: number | null;
  gwetTop: number | null;
  gwetProf: number | null;
}

export interface MonthlyClimatePoint {
  monthIndex: number;
  monthLabel: string;
  baselineRainfallMm: number | null;
  recentRainfallMm: number | null;
  baselineT2mC: number | null;
  recentT2mC: number | null;
  baselineTmaxC: number | null;
  recentTmaxC: number | null;
  baselineTminC: number | null;
  recentTminC: number | null;
  baselineSolarMj: number | null;
  recentSolarMj: number | null;
  baselineEvlandMmDay: number | null;
  recentEvlandMmDay: number | null;
  baselineGwetRoot: number | null;
  recentGwetRoot: number | null;
  baselineGwetTop: number | null;
  recentGwetTop: number | null;
}

export interface AnnualClimatePoint {
  year: number;
  annualRainfallMm: number | null;
  avgMeanTempC: number | null;
  avgMaxTempC: number | null;
  avgMinTempC: number | null;
  avgSolarMj: number | null;
  avgEvlandMmDay: number | null;
  avgGwetRoot: number | null;
  isDryYear: boolean;
}

export interface NasaPowerSummaryData {
  serviceAvailable: boolean;
  unavailableReason: string | null;
  isCachedFallback?: boolean;
  source: string;
  coordinatesLabel: string;
  periodLabel: string;
  solarUnit: string;
  avgSolarIrradiance: number | null;
  totalPrecipitationMm: number | null;
  past30DaysNasaMm: number | null;
  past60DaysNasaMm: number | null;
  avgMeanTempC: number | null;
  avgMaxTempC: number | null;
  avgMinTempC: number | null;
  avgDewPointC: number | null;
  avgRelativeHumidityPercent: number | null;
  avgWindSpeedMs: number | null;
  avgEvlandMmDay: number | null;
  totalEvland60dMm: number | null;
  avgEvptrnsMjM2Day: number | null;
  avgVpdKpa: number | null;
  gwetRootRecent: number | null;
  gwetTopRecent: number | null;
  gwetProfRecent: number | null;
  gwetRootLabel: string;
  gwetTopLabel: string;
  gwetProfLabel: string;
  gwetDisclaimer: string;
  nasaDrySpellDays: number | null;
  nasaHotDays32c: number | null;
  nasaHotDays35c: number | null;
  nasaFrostDays2c: number | null;
  nasaFrostDays0c: number | null;
  daysCount: number;
  lastUpdated: string | null;
  dailySeries: NasaDailyPoint[];
  parameterMetadata: NasaParameterMetadata[];
}

export interface NasaClimateComparisonData {
  serviceAvailable: boolean;
  unavailableReason: string | null;
  isCachedFallback?: boolean;
  source: string;
  datasetName: string;
  coordinatesLabel: string;
  spatialResolutionNote: string;
  baselinePeriodLabel: string;
  recentPeriodLabel: string;
  retrievedAt: string | null;
  rainfallRegimeClassification:
    | 'Summer-Rainfall'
    | 'Winter-Rainfall'
    | 'All-Year / Transitional'
    | 'Semi-Arid';
  seasonalDistribution: {
    summerDjfBaselineMm: number | null;
    summerDjfRecentMm: number | null;
    autumnMamBaselineMm: number | null;
    autumnMamRecentMm: number | null;
    winterJjaBaselineMm: number | null;
    winterJjaRecentMm: number | null;
    springSonBaselineMm: number | null;
    springSonRecentMm: number | null;
  } | null;
  monthlyDistribution: MonthlyClimatePoint[];
  annualSeries: AnnualClimatePoint[];
  recurringDryYears: {
    thresholdMm: number | null;
    dryYearsList: number[];
    totalDryYearsCount: number;
    recent5YearDryCount: number;
    note: string;
  };
  baselineMetrics: {
    meanAnnualRainfallMm: number | null;
    summerDjRainfallMm: number | null;
    winterJjaRainfallMm: number | null;
    avgMeanTempC: number | null;
    avgMaxTempC: number | null;
    avgMinTempC: number | null;
    avgSolarIrradiance: number | null;
    avgRelativeHumidityPercent: number | null;
    avgEvlandMmDay: number | null;
    avgGwetRoot: number | null;
    avgGwetTop: number | null;
    avgGwetProf: number | null;
    yearsCovered: number;
  } | null;
  recentMetrics: {
    meanAnnualRainfallMm: number | null;
    summerDjRainfallMm: number | null;
    winterJjaRainfallMm: number | null;
    avgMeanTempC: number | null;
    avgMaxTempC: number | null;
    avgMinTempC: number | null;
    avgSolarIrradiance: number | null;
    avgRelativeHumidityPercent: number | null;
    avgEvlandMmDay: number | null;
    avgGwetRoot: number | null;
    avgGwetTop: number | null;
    avgGwetProf: number | null;
    yearsCovered: number;
  } | null;
  delta: {
    annualRainfallChangeMm: number | null;
    annualRainfallChangePercent: number | null;
    avgMeanTempChangeC: number | null;
    avgMaxTempChangeC: number | null;
    avgMinTempChangeC: number | null;
    solarIrradianceChange: number | null;
    humidityChangePercent: number | null;
    evlandChangeMmDay: number | null;
    gwetRootChange: number | null;
    gwetTopChange: number | null;
  } | null;
  localInterpretation: {
    summary: string;
    soilAndMoistureNote: string;
    cropPlanningNote: string;
    rotationDecisionRelevance: string;
    scientificFramingNote: string;
    dataLimitations: string;
  };
  parameterMetadata: NasaParameterMetadata[];
}

export interface ClimateProjectionStatus {
  datasetName: string;
  configured: boolean;
  statusLabel: string;
  scenariosSupported: string[];
  explanation: string;
  scientificSeparationNote: string;
}

const NASA_POWER_BASE_URL = (
  process.env.NASA_POWER_BASE_URL || 'https://power.larc.nasa.gov/api'
).replace(/\/+$/, '');
const NASA_CACHE_TTL_MS = Math.max(
  60_000,
  Number(process.env.NASA_CACHE_TTL_MS || 60 * 60 * 1000)
);

const DAILY_PARAMETERS = [
  'PRECTOTCORR',
  'T2M',
  'T2M_MAX',
  'T2M_MIN',
  'ALLSKY_SFC_SW_DWN',
  'RH2M',
  'T2MDEW',
  'WS2M',
  'EVLAND',
  'EVPTRNS',
  'GWETROOT',
  'GWETTOP',
  'GWETPROF',
];

const MONTHLY_PARAMETERS = [
  'PRECTOTCORR',
  'T2M',
  'T2M_MAX',
  'T2M_MIN',
  'ALLSKY_SFC_SW_DWN',
  'RH2M',
  'EVLAND',
  'GWETROOT',
  'GWETTOP',
  'GWETPROF',
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// In-memory hot cache + in-flight request deduplication + simple upstream rate-window
const DAILY_MEM_CACHE = new Map<string, { timestampMs: number; data: NasaPowerSummaryData }>();
const MONTHLY_MEM_CACHE = new Map<string, { timestampMs: number; data: NasaClimateComparisonData }>();
const IN_FLIGHT_DAILY = new Map<string, Promise<NasaPowerSummaryData>>();
const IN_FLIGHT_MONTHLY = new Map<string, Promise<NasaClimateComparisonData>>();
const UPSTREAM_TIMESTAMPS_MS: number[] = [];

function checkUpstreamRateAllowance(): boolean {
  const now = Date.now();
  while (UPSTREAM_TIMESTAMPS_MS.length > 0 && now - UPSTREAM_TIMESTAMPS_MS[0] > 60_000) {
    UPSTREAM_TIMESTAMPS_MS.shift();
  }
  if (UPSTREAM_TIMESTAMPS_MS.length >= 25) {
    return false;
  }
  UPSTREAM_TIMESTAMPS_MS.push(now);
  return true;
}

export function describeSoilWetness(val: number | null): string {
  if (val === null) return 'Unavailable';
  if (val < 0.25) return 'Very Dry (<0.25 fractional wetness)';
  if (val < 0.40) return 'Low Moisture (0.25–0.39 fractional wetness)';
  if (val < 0.60) return 'Moderate Moisture (0.40–0.59 fractional wetness)';
  if (val < 0.78) return 'Moist (0.60–0.77 fractional wetness)';
  return 'Near Saturation (>=0.78 fractional wetness)';
}

/**
 * Normalise NASA fill values (-999 or <= -900) strictly to null (NEVER 0).
 */
export function normalizeNasaValue(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= -900) {
    return null;
  }
  return v;
}

/**
 * Calculates Vapour Pressure Deficit (VPD in kPa) from air temperature (T2M, °C)
 * and dew point (T2MDEW, °C) or relative humidity (RH2M, %).
 * Tagged explicitly as a derived `system_indicator` — never masquerades as raw NASA field.
 */
export function computeVpdKpa(
  tempMeanC: number | null,
  dewPointC: number | null,
  rhPercent: number | null
): number | null {
  if (tempMeanC === null) return null;
  const es = 0.6108 * Math.exp((17.27 * tempMeanC) / (tempMeanC + 237.3));
  let ea: number | null = null;
  if (dewPointC !== null) {
    ea = 0.6108 * Math.exp((17.27 * dewPointC) / (dewPointC + 237.3));
  } else if (rhPercent !== null) {
    ea = es * Math.max(0, Math.min(1, rhPercent / 100));
  }
  if (ea === null) return null;
  return Number(Math.max(0, es - ea).toFixed(2));
}

function validateCoordinatesAndParams(lat: number, lng: number, paramCodes: string[]): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error(`Invalid coordinates (${lat}, ${lng}) for NASA POWER retrieval.`);
  }
  for (const code of paramCodes) {
    if (!NASA_PARAMETER_REGISTRY[code]) {
      throw new Error(`Unregistered NASA POWER parameter requested: ${code}`);
    }
  }
}

function getDiskCacheEntry<T>(cacheKey: string, temporalResolution: 'daily' | 'monthly'): { timestampMs: number; data: T } | null {
  const entries = store.db.nasaCache || [];
  const found = entries.find(
    (e) => e.cacheKey === cacheKey && e.temporalResolution === temporalResolution
  );
  if (!found || !found.data) return null;
  return { timestampMs: found.timestampMs, data: found.data as T };
}

function saveDiskCacheEntry(
  cacheKey: string,
  temporalResolution: 'daily' | 'monthly',
  data: unknown
): void {
  if (!Array.isArray(store.db.nasaCache)) store.db.nasaCache = [];
  const existingIdx = store.db.nasaCache.findIndex(
    (e) => e.cacheKey === cacheKey && e.temporalResolution === temporalResolution
  );
  const entry = {
    cacheKey,
    temporalResolution,
    timestampMs: Date.now(),
    data,
  };
  if (existingIdx >= 0) {
    store.db.nasaCache[existingIdx] = entry;
  } else {
    store.db.nasaCache.unshift(entry);
  }
  if (store.db.nasaCache.length > 24) {
    store.db.nasaCache = store.db.nasaCache.slice(0, 24);
  }
  store.save();
}

function recordProvenanceLog(entry: Omit<NasaRetrievalProvenance, 'id' | 'retrievedAt'>): void {
  if (!Array.isArray(store.db.nasaRetrievals)) store.db.nasaRetrievals = [];
  store.db.nasaRetrievals.unshift({
    id: `nasa-${crypto.randomUUID()}`,
    ...entry,
    retrievedAt: new Date().toISOString(),
  });
  if (store.db.nasaRetrievals.length > 40) {
    store.db.nasaRetrievals = store.db.nasaRetrievals.slice(0, 40);
  }
  store.save();
}

async function fetchJsonWithRetry(url: string, timeoutMs: number, maxAttempts = 2): Promise<{ status: number; json: unknown }> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`NASA POWER responded with HTTP ${res.status}`);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 450 * attempt));
          continue;
        }
        return { status: res.status, json: null };
      }
      if (!res.ok) {
        throw new Error(`NASA POWER responded with HTTP ${res.status}`);
      }
      const json = await res.json();
      return { status: res.status, json };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 350 * attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('NASA POWER network timeout');
}

function buildDailyNasaMetadata(params: {
  coordinatesLabel: string;
  periodLabel: string;
  retrievedAt: string | null;
  status: 'live' | 'cached' | 'unavailable';
}): NasaParameterMetadata[] {
  const src = 'NASA POWER Agroclimatology Daily Point API (Community: AG)';
  const codes = [
    'PRECTOTCORR',
    'T2M',
    'T2M_MAX',
    'T2M_MIN',
    'ALLSKY_SFC_SW_DWN',
    'EVLAND',
    'EVPTRNS',
    'GWETROOT',
    'GWETTOP',
    'GWETPROF',
    'RH2M',
    'T2MDEW',
    'WS2M',
  ];
  const rows: NasaParameterMetadata[] = codes.map((code) => {
    const spec = NASA_PARAMETER_REGISTRY[code];
    return {
      parameterCode: spec.code,
      parameterName: spec.name,
      unit: spec.unit,
      source: src,
      coordinatesLabel: params.coordinatesLabel,
      observationPeriod: params.periodLabel,
      retrievedAt: params.retrievedAt,
      status: params.status,
      valueKind: spec.valueKind,
      note: `${spec.latencyNote} ${spec.agronomicLimitation}`,
    };
  });

  rows.push({
    parameterCode: 'VPD_DERIVED (T2M + T2MDEW/RH2M)',
    parameterName: 'Vapour Pressure Deficit (Derived Atmospheric Drying Demand)',
    unit: 'kPa',
    source: 'Field Shift Indicator Engine (computed from NASA T2M & T2MDEW/RH2M)',
    coordinatesLabel: params.coordinatesLabel,
    observationPeriod: params.periodLabel,
    retrievedAt: params.retrievedAt,
    status: params.status,
    valueKind: 'system_indicator',
    note: 'Derived agronomic indicator (not a raw NASA POWER column): >1.6 kPa indicates strong midday atmospheric evaporative stress.',
  });

  return rows;
}

function avgNums(arr: (number | null)[], decimals = 1): number | null {
  const nums = arr.filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return Number((nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(decimals));
}

function computeDailyExtremes(series: NasaDailyPoint[]) {
  const ordered = [...series].sort((a, b) => a.date.localeCompare(b.date));
  let longestDrySpell = 0;
  let runningDry = 0;
  for (const d of ordered) {
    if (d.precipitationMm === null) continue;
    if (d.precipitationMm < 1.0) {
      runningDry += 1;
      if (runningDry > longestDrySpell) longestDrySpell = runningDry;
    } else {
      runningDry = 0;
    }
  }
  const hotDays32 = ordered.filter((d) => d.tempMaxC !== null && d.tempMaxC >= 32).length;
  const hotDays35 = ordered.filter((d) => d.tempMaxC !== null && d.tempMaxC >= 35).length;
  const frostDays2 = ordered.filter((d) => d.tempMinC !== null && d.tempMinC <= 2).length;
  const frostDays0 = ordered.filter((d) => d.tempMinC !== null && d.tempMinC <= 0).length;
  return { longestDrySpell, hotDays32, hotDays35, frostDays2, frostDays0 };
}

function formatYmdFromNasaKey(key: string): string {
  if (/^\d{8}$/.test(key)) {
    return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
  }
  return key;
}

export async function getNasaDailyEnvironmentalSummary(
  latitude: number,
  longitude: number,
  requestId?: string
): Promise<NasaPowerSummaryData> {
  validateCoordinatesAndParams(latitude, longitude, DAILY_PARAMETERS);
  const key = `daily:${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const coordLabel = `${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`;

  const memHit = DAILY_MEM_CACHE.get(key);
  if (memHit && Date.now() - memHit.timestampMs < NASA_CACHE_TTL_MS) {
    return memHit.data;
  }

  const diskHit = getDiskCacheEntry<NasaPowerSummaryData>(key, 'daily');
  if (diskHit && Date.now() - diskHit.timestampMs < NASA_CACHE_TTL_MS && Array.isArray(diskHit.data.dailySeries)) {
    DAILY_MEM_CACHE.set(key, diskHit);
    return {
      ...diskHit.data,
      isCachedFallback: false,
      parameterMetadata: diskHit.data.parameterMetadata.map((m) => ({ ...m, status: 'cached' })),
    };
  }

  const existingPromise = IN_FLIGHT_DAILY.get(key);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async (): Promise<NasaPowerSummaryData> => {
    const startDate = sastDaysAgo(63);
    const endDate = sastDaysAgo(3);
    const startStr = startDate.replace(/-/g, '');
    const endStr = endDate.replace(/-/g, '');
    const periodLabel = `${startDate} to ${endDate} (60-day SAST window)`;

    const url =
      `${NASA_POWER_BASE_URL}/temporal/daily/point` +
      `?parameters=${DAILY_PARAMETERS.join(',')}` +
      `&community=AG` +
      `&longitude=${encodeURIComponent(longitude)}` +
      `&latitude=${encodeURIComponent(latitude)}` +
      `&start=${startStr}&end=${endStr}&format=JSON`;

    try {
      if (!checkUpstreamRateAllowance()) {
        throw new Error('NASA POWER client rate guard reached; using cached fallback if available.');
      }
      const { status, json } = await fetchJsonWithRetry(url, 9000, 2);
      if (!json || typeof json !== 'object') {
        throw new Error(`NASA POWER daily endpoint returned HTTP ${status}`);
      }
      const raw = json as {
        parameters?: Record<string, { units?: string }>;
        properties?: {
          parameter?: Record<string, Record<string, number>>;
        };
      };

      const p = raw.properties?.parameter || {};
      const dateKeysSet = new Set<string>();
      let validCount = 0;
      let fillCount = 0;

      for (const code of DAILY_PARAMETERS) {
        const series = p[code] || {};
        for (const [dKey, val] of Object.entries(series)) {
          dateKeysSet.add(dKey);
          if (typeof val === 'number' && Number.isFinite(val) && val > -900) {
            validCount += 1;
          } else {
            fillCount += 1;
          }
        }
      }

      const sortedKeys = Array.from(dateKeysSet).sort();
      const dailySeries: NasaDailyPoint[] = sortedKeys.map((dKey) => {
        const tMean = normalizeNasaValue(p.T2M?.[dKey]);
        const tDew = normalizeNasaValue(p.T2MDEW?.[dKey]);
        const rh = normalizeNasaValue(p.RH2M?.[dKey]);
        return {
          date: formatYmdFromNasaKey(dKey),
          precipitationMm: normalizeNasaValue(p.PRECTOTCORR?.[dKey]),
          tempMeanC: tMean,
          tempMaxC: normalizeNasaValue(p.T2M_MAX?.[dKey]),
          tempMinC: normalizeNasaValue(p.T2M_MIN?.[dKey]),
          solarMjM2Day: normalizeNasaValue(p.ALLSKY_SFC_SW_DWN?.[dKey]),
          humidityPercent: rh,
          dewPointC: tDew,
          windSpeedMs: normalizeNasaValue(p.WS2M?.[dKey]),
          evlandMmDay: normalizeNasaValue(p.EVLAND?.[dKey]),
          evptrnsMjM2Day: normalizeNasaValue(p.EVPTRNS?.[dKey]),
          vpdKpa: computeVpdKpa(tMean, tDew, rh),
          gwetRoot: normalizeNasaValue(p.GWETROOT?.[dKey]),
          gwetTop: normalizeNasaValue(p.GWETTOP?.[dKey]),
          gwetProf: normalizeNasaValue(p.GWETPROF?.[dKey]),
        };
      });

      const validRainDays = dailySeries.filter((d) => d.precipitationMm !== null);
      const past30DaysNasaMm =
        validRainDays.length > 0
          ? Number(
              validRainDays
                .slice(-30)
                .reduce((s, d) => s + (d.precipitationMm ?? 0), 0)
                .toFixed(1)
            )
          : null;
      const past60DaysNasaMm =
        validRainDays.length > 0
          ? Number(
              validRainDays
                .reduce((s, d) => s + (d.precipitationMm ?? 0), 0)
                .toFixed(1)
            )
          : null;

      const validEvland = dailySeries.filter((d) => d.evlandMmDay !== null);
      const totalEvland60dMm =
        validEvland.length > 0
          ? Number(validEvland.reduce((s, d) => s + (d.evlandMmDay ?? 0), 0).toFixed(1))
          : null;

      const recent14 = dailySeries.slice(-14);
      const gwetRootRecent = avgNums(recent14.map((d) => d.gwetRoot), 2);
      const gwetTopRecent = avgNums(recent14.map((d) => d.gwetTop), 2);
      const gwetProfRecent = avgNums(recent14.map((d) => d.gwetProf), 2);
      const extremes = computeDailyExtremes(dailySeries);
      const retrievedAt = new Date().toISOString();
      const serviceAvailable =
        dailySeries.some((d) => d.solarMjM2Day !== null || d.precipitationMm !== null || d.tempMaxC !== null);

      const result: NasaPowerSummaryData = {
        serviceAvailable,
        unavailableReason: serviceAvailable
          ? null
          : 'NASA POWER returned no valid satellite observations for this window.',
        isCachedFallback: false,
        source: 'NASA POWER Agroclimatology Daily Point API (Community: AG)',
        coordinatesLabel: coordLabel,
        periodLabel,
        solarUnit: raw.parameters?.ALLSKY_SFC_SW_DWN?.units || 'MJ/m^2/day',
        avgSolarIrradiance: avgNums(dailySeries.map((d) => d.solarMjM2Day), 1),
        totalPrecipitationMm: past30DaysNasaMm,
        past30DaysNasaMm,
        past60DaysNasaMm,
        avgMeanTempC: avgNums(dailySeries.map((d) => d.tempMeanC), 1),
        avgMaxTempC: avgNums(dailySeries.map((d) => d.tempMaxC), 1),
        avgMinTempC: avgNums(dailySeries.map((d) => d.tempMinC), 1),
        avgDewPointC: avgNums(dailySeries.map((d) => d.dewPointC), 1),
        avgRelativeHumidityPercent: avgNums(dailySeries.map((d) => d.humidityPercent), 1),
        avgWindSpeedMs: avgNums(dailySeries.map((d) => d.windSpeedMs), 1),
        avgEvlandMmDay: avgNums(dailySeries.map((d) => d.evlandMmDay), 2),
        totalEvland60dMm,
        avgEvptrnsMjM2Day: avgNums(dailySeries.map((d) => d.evptrnsMjM2Day), 2),
        avgVpdKpa: avgNums(dailySeries.map((d) => d.vpdKpa), 2),
        gwetRootRecent,
        gwetTopRecent,
        gwetProfRecent,
        gwetRootLabel: describeSoilWetness(gwetRootRecent),
        gwetTopLabel: describeSoilWetness(gwetTopRecent),
        gwetProfLabel: describeSoilWetness(gwetProfRecent),
        gwetDisclaimer:
          'GWETROOT, GWETTOP, and GWETPROF are model-derived NASA MERRA-2 fractional soil wetness estimates (0–1 scale, ~55 km grid), NOT direct on-farm tensiometer or soil probe readings.',
        nasaDrySpellDays: validRainDays.length > 0 ? extremes.longestDrySpell : null,
        nasaHotDays32c: dailySeries.some((d) => d.tempMaxC !== null) ? extremes.hotDays32 : null,
        nasaHotDays35c: dailySeries.some((d) => d.tempMaxC !== null) ? extremes.hotDays35 : null,
        nasaFrostDays2c: dailySeries.some((d) => d.tempMinC !== null) ? extremes.frostDays2 : null,
        nasaFrostDays0c: dailySeries.some((d) => d.tempMinC !== null) ? extremes.frostDays0 : null,
        daysCount: dailySeries.length,
        lastUpdated: retrievedAt,
        dailySeries,
        parameterMetadata: buildDailyNasaMetadata({
          coordinatesLabel: coordLabel,
          periodLabel,
          retrievedAt,
          status: serviceAvailable ? 'live' : 'unavailable',
        }),
      };

      recordProvenanceLog({
        requestId,
        coordinatesLabel: coordLabel,
        latitude,
        longitude,
        temporalResolution: 'daily',
        dateWindowLabel: periodLabel,
        endpointUrl: url,
        parametersRequested: DAILY_PARAMETERS,
        httpStatus: status,
        cacheHit: false,
        validObservationCount: validCount,
        fillValueCount: fillCount,
        errorMessage: null,
      });

      if (serviceAvailable) {
        DAILY_MEM_CACHE.set(key, { timestampMs: Date.now(), data: result });
        saveDiskCacheEntry(key, 'daily', result);
      }
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'offline';
      recordProvenanceLog({
        requestId,
        coordinatesLabel: coordLabel,
        latitude,
        longitude,
        temporalResolution: 'daily',
        dateWindowLabel: periodLabel,
        endpointUrl: url,
        parametersRequested: DAILY_PARAMETERS,
        httpStatus: null,
        cacheHit: Boolean(memHit || diskHit),
        validObservationCount: 0,
        fillValueCount: 0,
        errorMessage: msg,
      });

      const fallback = memHit || diskHit;
      if (fallback) {
        return {
          ...fallback.data,
          isCachedFallback: true,
          unavailableReason: `Refresh failed (${msg}); showing last verified cached NASA POWER summary from ${fallback.data.lastUpdated ? new Date(fallback.data.lastUpdated).toLocaleString('en-ZA') : 'earlier'}.`,
          parameterMetadata: fallback.data.parameterMetadata.map((m) => ({ ...m, status: 'cached' })),
        };
      }

      return {
        serviceAvailable: false,
        unavailableReason: `NASA POWER service unreachable (${msg}). No fabricated satellite telemetry generated.`,
        isCachedFallback: false,
        source: 'NASA POWER Agroclimatology Daily Point API (Unavailable)',
        coordinatesLabel: coordLabel,
        periodLabel,
        solarUnit: 'MJ/m^2/day',
        avgSolarIrradiance: null,
        totalPrecipitationMm: null,
        past30DaysNasaMm: null,
        past60DaysNasaMm: null,
        avgMeanTempC: null,
        avgMaxTempC: null,
        avgMinTempC: null,
        avgDewPointC: null,
        avgRelativeHumidityPercent: null,
        avgWindSpeedMs: null,
        avgEvlandMmDay: null,
        totalEvland60dMm: null,
        avgEvptrnsMjM2Day: null,
        avgVpdKpa: null,
        gwetRootRecent: null,
        gwetTopRecent: null,
        gwetProfRecent: null,
        gwetRootLabel: 'Unavailable',
        gwetTopLabel: 'Unavailable',
        gwetProfLabel: 'Unavailable',
        gwetDisclaimer: 'NASA POWER soil wetness estimates could not be retrieved right now.',
        nasaDrySpellDays: null,
        nasaHotDays32c: null,
        nasaHotDays35c: null,
        nasaFrostDays2c: null,
        nasaFrostDays0c: null,
        daysCount: 0,
        lastUpdated: null,
        dailySeries: [],
        parameterMetadata: buildDailyNasaMetadata({
          coordinatesLabel: coordLabel,
          periodLabel,
          retrievedAt: null,
          status: 'unavailable',
        }),
      };
    } finally {
      IN_FLIGHT_DAILY.delete(key);
    }
  })();

  IN_FLIGHT_DAILY.set(key, promise);
  return promise;
}

function daysInMonth(year: number, month1To12: number): number {
  if (month1To12 === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month1To12)) return 30;
  return 31;
}

function buildInterpretedClimateBlock(
  base: NasaClimateComparisonData,
  context?: {
    province?: string;
    locationLabel?: string;
    waterAvailability?: string;
    primaryCrops?: string[];
  },
  prov?: (typeof SOUTH_AFRICA_PROVINCES)[number]
): NasaClimateComparisonData {
  if (!base.serviceAvailable || !base.baselineMetrics || !base.recentMetrics || !base.delta) {
    return base;
  }

  const d = base.delta;
  const rainChange = d.annualRainfallChangeMm ?? 0;
  const tmaxChange = d.avgMaxTempChangeC ?? 0;
  const evlandChange = d.evlandChangeMmDay ?? 0;
  const gwetRoot = base.recentMetrics.avgGwetRoot;
  const evlandRecent = base.recentMetrics.avgEvlandMmDay;
  const siteName = context?.locationLabel || context?.province || base.coordinatesLabel;
  const waterInfo = context?.waterAvailability || 'unverified water allocation';
  const cropList =
    context?.primaryCrops && context.primaryCrops.length > 0
      ? context.primaryCrops.join(', ')
      : prov?.keyCommodities.slice(0, 3).join(', ') || 'mixed crops';

  const rainDirection =
    rainChange <= -35
      ? `drier recent conditions (${rainChange} mm/yr compared to 2001–2015)`
      : rainChange >= 35
        ? `higher recent rainfall (+${rainChange} mm/yr compared to 2001–2015)`
        : `comparable annual rainfall (${rainChange >= 0 ? '+' : ''}${rainChange} mm/yr vs 2001–2015)`;

  const tempDirection =
    tmaxChange >= 0.4
      ? `warmer daytime peaks (+${tmaxChange}°C mean daily Tmax)`
      : tmaxChange <= -0.4
        ? `slightly cooler daytime peaks (${tmaxChange}°C mean daily Tmax)`
        : `stable daytime temperatures (${tmaxChange >= 0 ? '+' : ''}${tmaxChange}°C Tmax shift)`;

  const summary = `At ${siteName} (${base.coordinatesLabel} · ${base.rainfallRegimeClassification} pattern), NASA POWER observations show ${rainDirection} alongside ${tempDirection} between 2020–2024 and 2001–2015.`;

  const soilAndMoistureNote =
    rainChange < -20 || tmaxChange >= 0.4 || evlandChange >= 0.08 || (gwetRoot !== null && gwetRoot < 0.35)
      ? `Higher evaporative demand (EVLAND ${evlandRecent ?? '—'} mm/day) or lower modelled root-zone wetness (GWETROOT ${gwetRoot ?? '—'}) increases topsoil moisture loss risk. Prioritise surface mulch/residue cover, minimum tillage where practical, and verify water capacity (${waterInfo}).`
      : `Modelled root-zone soil wetness (GWETROOT ${gwetRoot ?? '—'}), land evaporation (EVLAND ${evlandRecent ?? '—'} mm/day), and seasonal rainfall remain broadly aligned with regional norms for ${prov?.name || 'this area'}, though intra-season dry spells still require staggered planting checks.`;

  const cropPlanningNote = `For ${cropList}: align planting dates to verified soil moisture rather than fixed calendar dates, pair heavy nitrogen feeders with legume break crops, and include drought-tolerant cultivars when ${base.recurringDryYears.totalDryYearsCount} historical dry year(s) occurred in 2001–2024.`;

  const rotationDecisionRelevance =
    rainChange <= -35 || base.recurringDryYears.recent5YearDryCount >= 2
      ? `Because recent conditions show lower rainfall or recurring dry years (${base.recurringDryYears.recent5YearDryCount} dry year(s) since 2020), Field Shift favours drought-hardy sorghum, cowpeas, sweet potato, or sunflower with residue retention unless reliable irrigation is confirmed.`
      : tmaxChange >= 0.4
        ? `Warmer daytime highs (+${tmaxChange}°C Tmax shift) elevate evaporation losses; Field Shift rewards residue-building cereals and trailing ground-cover crops that shade topsoil between seasons.`
        : `Stable rainfall and ${base.rainfallRegimeClassification} seasonality allow balanced 3-season cereal-legume-oilseed or root rotations matched to field texture and drainage.`;

  return {
    ...base,
    localInterpretation: {
      summary,
      soilAndMoistureNote,
      cropPlanningNote,
      rotationDecisionRelevance,
      scientificFramingNote: base.localInterpretation.scientificFramingNote,
      dataLimitations: base.spatialResolutionNote,
    },
  };
}

export async function getNasaMultiYearClimateComparison(
  latitude: number,
  longitude: number,
  context?: {
    province?: string;
    locationLabel?: string;
    waterAvailability?: string;
    primaryCrops?: string[];
  },
  requestId?: string
): Promise<NasaClimateComparisonData> {
  validateCoordinatesAndParams(latitude, longitude, MONTHLY_PARAMETERS);
  const key = `clim:${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const prov = SOUTH_AFRICA_PROVINCES.find((p) => p.name === context?.province);
  const coordLabel = `${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`;
  const spatialNote =
    'NASA POWER Agroclimatology monthly grid (~0.5° latitude × 0.625° longitude, ~55 km resolution). Represents regional satellite/reanalysis grid conditions rather than micro-scale farm valleys or frost pockets.';

  const memHit = MONTHLY_MEM_CACHE.get(key);
  if (memHit && Date.now() - memHit.timestampMs < NASA_CACHE_TTL_MS) {
    return buildInterpretedClimateBlock(memHit.data, context, prov);
  }

  const diskHit = getDiskCacheEntry<NasaClimateComparisonData>(key, 'monthly');
  if (
    diskHit &&
    Date.now() - diskHit.timestampMs < NASA_CACHE_TTL_MS &&
    Array.isArray(diskHit.data.monthlyDistribution) &&
    diskHit.data.monthlyDistribution[0]?.recentSolarMj !== undefined
  ) {
    MONTHLY_MEM_CACHE.set(key, diskHit);
    return buildInterpretedClimateBlock(
      {
        ...diskHit.data,
        parameterMetadata: diskHit.data.parameterMetadata.map((m) => ({ ...m, status: 'cached' })),
      },
      context,
      prov
    );
  }

  const existingPromise = IN_FLIGHT_MONTHLY.get(key);
  if (existingPromise) {
    const res = await existingPromise;
    return buildInterpretedClimateBlock(res, context, prov);
  }

  const promise = (async (): Promise<NasaClimateComparisonData> => {
    const url =
      `${NASA_POWER_BASE_URL}/temporal/monthly/point` +
      `?parameters=${MONTHLY_PARAMETERS.join(',')}` +
      `&community=AG` +
      `&longitude=${encodeURIComponent(longitude)}` +
      `&latitude=${encodeURIComponent(latitude)}` +
      `&start=2001&end=2024&format=JSON`;

    try {
      if (!checkUpstreamRateAllowance()) {
        throw new Error('NASA POWER client rate guard reached; using cached fallback if available.');
      }
      const { status, json } = await fetchJsonWithRetry(url, 11000, 2);
      if (!json || typeof json !== 'object') {
        throw new Error(`NASA POWER monthly archive responded with HTTP ${status}`);
      }
      const raw = json as {
        properties?: {
          parameter?: Record<string, Record<string, number>>;
        };
      };
      const params = raw.properties?.parameter || {};
      const rainMap = params.PRECTOTCORR || {};
      const t2mMap = params.T2M || {};
      const tmaxMap = params.T2M_MAX || {};
      const tminMap = params.T2M_MIN || {};
      const solarMap = params.ALLSKY_SFC_SW_DWN || {};
      const rhMap = params.RH2M || {};
      const evlandMap = params.EVLAND || {};
      const gwetRootMap = params.GWETROOT || {};
      const gwetTopMap = params.GWETTOP || {};
      const gwetProfMap = params.GWETPROF || {};

      let validCount = 0;
      let fillCount = 0;
      for (const code of MONTHLY_PARAMETERS) {
        const mSeries = params[code] || {};
        for (const val of Object.values(mSeries)) {
          if (typeof val === 'number' && Number.isFinite(val) && val > -900) validCount += 1;
          else fillCount += 1;
        }
      }

      const avgArr = (arr: number[], decimals = 1) =>
        arr.length > 0
          ? Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(decimals))
          : null;

      const summariseYears = (startYear: number, endYear: number) => {
        const annualTotals = new Map<number, number>();
        const djfTotals = new Map<number, number>();
        const mamTotals = new Map<number, number>();
        const jjaTotals = new Map<number, number>();
        const sonTotals = new Map<number, number>();

        const t2mVals: number[] = [];
        const tmaxVals: number[] = [];
        const tminVals: number[] = [];
        const solarVals: number[] = [];
        const rhVals: number[] = [];
        const evlandVals: number[] = [];
        const gwetRootVals: number[] = [];
        const gwetTopVals: number[] = [];
        const gwetProfVals: number[] = [];

        const byMonthRain = new Map<number, number[]>();
        const byMonthT2m = new Map<number, number[]>();
        const byMonthTmax = new Map<number, number[]>();
        const byMonthTmin = new Map<number, number[]>();
        const byMonthSolar = new Map<number, number[]>();
        const byMonthEvland = new Map<number, number[]>();
        const byMonthGwetRoot = new Map<number, number[]>();
        const byMonthGwetTop = new Map<number, number[]>();

        for (const ymKey of Object.keys(rainMap)) {
          if (ymKey.length !== 6) continue;
          const year = Number(ymKey.slice(0, 4));
          const month = Number(ymKey.slice(4, 6));
          if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) continue;
          if (year < startYear || year > endYear) continue;

          const rainRate = normalizeNasaValue(rainMap[ymKey]);
          if (rainRate !== null) {
            const monthMm = rainRate * daysInMonth(year, month);
            annualTotals.set(year, (annualTotals.get(year) || 0) + monthMm);
            if (month === 12 || month === 1 || month === 2) {
              djfTotals.set(year, (djfTotals.get(year) || 0) + monthMm);
            } else if (month >= 3 && month <= 5) {
              mamTotals.set(year, (mamTotals.get(year) || 0) + monthMm);
            } else if (month >= 6 && month <= 8) {
              jjaTotals.set(year, (jjaTotals.get(year) || 0) + monthMm);
            } else {
              sonTotals.set(year, (sonTotals.get(year) || 0) + monthMm);
            }
            const mArr = byMonthRain.get(month) || [];
            mArr.push(monthMm);
            byMonthRain.set(month, mArr);
          }

          const pushMonthly = (
            rawVal: unknown,
            flatArr: number[],
            monthMap?: Map<number, number[]>
          ) => {
            const val = normalizeNasaValue(rawVal);
            if (val === null) return;
            flatArr.push(val);
            if (monthMap) {
              const list = monthMap.get(month) || [];
              list.push(val);
              monthMap.set(month, list);
            }
          };

          pushMonthly(t2mMap[ymKey], t2mVals, byMonthT2m);
          pushMonthly(tmaxMap[ymKey], tmaxVals, byMonthTmax);
          pushMonthly(tminMap[ymKey], tminVals, byMonthTmin);
          pushMonthly(solarMap[ymKey], solarVals, byMonthSolar);
          pushMonthly(rhMap[ymKey], rhVals);
          pushMonthly(evlandMap[ymKey], evlandVals, byMonthEvland);
          pushMonthly(gwetRootMap[ymKey], gwetRootVals, byMonthGwetRoot);
          pushMonthly(gwetTopMap[ymKey], gwetTopVals, byMonthGwetTop);
          pushMonthly(gwetProfMap[ymKey], gwetProfVals);
        }

        return {
          metrics: {
            meanAnnualRainfallMm: avgArr(Array.from(annualTotals.values())),
            summerDjRainfallMm: avgArr(Array.from(djfTotals.values())),
            autumnMamRainfallMm: avgArr(Array.from(mamTotals.values())),
            winterJjaRainfallMm: avgArr(Array.from(jjaTotals.values())),
            springSonRainfallMm: avgArr(Array.from(sonTotals.values())),
            avgMeanTempC: avgArr(t2mVals),
            avgMaxTempC: avgArr(tmaxVals),
            avgMinTempC: avgArr(tminVals),
            avgSolarIrradiance: avgArr(solarVals),
            avgRelativeHumidityPercent: avgArr(rhVals),
            avgEvlandMmDay: avgArr(evlandVals, 2),
            avgGwetRoot: avgArr(gwetRootVals, 2),
            avgGwetTop: avgArr(gwetTopVals, 2),
            avgGwetProf: avgArr(gwetProfVals, 2),
            yearsCovered: annualTotals.size,
          },
          byMonthRain,
          byMonthT2m,
          byMonthTmax,
          byMonthTmin,
          byMonthSolar,
          byMonthEvland,
          byMonthGwetRoot,
          byMonthGwetTop,
        };
      };

      const baselineSummary = summariseYears(2001, 2015);
      const recentSummary = summariseYears(2020, 2024);

      if (baselineSummary.metrics.yearsCovered === 0 || recentSummary.metrics.yearsCovered === 0) {
        throw new Error('NASA POWER monthly archive returned insufficient valid observations for 2001–2024.');
      }

      const monthlyDistribution: MonthlyClimatePoint[] = MONTH_NAMES.map((label, idx) => {
        const m = idx + 1;
        return {
          monthIndex: m,
          monthLabel: label,
          baselineRainfallMm: avgArr(baselineSummary.byMonthRain.get(m) || [], 1),
          recentRainfallMm: avgArr(recentSummary.byMonthRain.get(m) || [], 1),
          baselineT2mC: avgArr(baselineSummary.byMonthT2m.get(m) || [], 1),
          recentT2mC: avgArr(recentSummary.byMonthT2m.get(m) || [], 1),
          baselineTmaxC: avgArr(baselineSummary.byMonthTmax.get(m) || [], 1),
          recentTmaxC: avgArr(recentSummary.byMonthTmax.get(m) || [], 1),
          baselineTminC: avgArr(baselineSummary.byMonthTmin.get(m) || [], 1),
          recentTminC: avgArr(recentSummary.byMonthTmin.get(m) || [], 1),
          baselineSolarMj: avgArr(baselineSummary.byMonthSolar.get(m) || [], 1),
          recentSolarMj: avgArr(recentSummary.byMonthSolar.get(m) || [], 1),
          baselineEvlandMmDay: avgArr(baselineSummary.byMonthEvland.get(m) || [], 2),
          recentEvlandMmDay: avgArr(recentSummary.byMonthEvland.get(m) || [], 2),
          baselineGwetRoot: avgArr(baselineSummary.byMonthGwetRoot.get(m) || [], 2),
          recentGwetRoot: avgArr(recentSummary.byMonthGwetRoot.get(m) || [], 2),
          baselineGwetTop: avgArr(baselineSummary.byMonthGwetTop.get(m) || [], 2),
          recentGwetTop: avgArr(recentSummary.byMonthGwetTop.get(m) || [], 2),
        };
      });

      const baselineMean = baselineSummary.metrics.meanAnnualRainfallMm;
      const dryThresholdMm = baselineMean !== null ? Number((baselineMean * 0.8).toFixed(1)) : null;
      const annualSeries: AnnualClimatePoint[] = [];

      for (let yr = 2001; yr <= 2024; yr += 1) {
        let rainSum = 0;
        let rainMonths = 0;
        const tMeanList: number[] = [];
        const tMaxList: number[] = [];
        const tMinList: number[] = [];
        const solarList: number[] = [];
        const evlandList: number[] = [];
        const gRootList: number[] = [];

        for (let m = 1; m <= 12; m += 1) {
          const ymKey = `${yr}${String(m).padStart(2, '0')}`;
          const rr = normalizeNasaValue(rainMap[ymKey]);
          if (rr !== null) {
            rainSum += rr * daysInMonth(yr, m);
            rainMonths += 1;
          }
          const tm = normalizeNasaValue(t2mMap[ymKey]);
          if (tm !== null) tMeanList.push(tm);
          const tx = normalizeNasaValue(tmaxMap[ymKey]);
          if (tx !== null) tMaxList.push(tx);
          const tn = normalizeNasaValue(tminMap[ymKey]);
          if (tn !== null) tMinList.push(tn);
          const sl = normalizeNasaValue(solarMap[ymKey]);
          if (sl !== null) solarList.push(sl);
          const ev = normalizeNasaValue(evlandMap[ymKey]);
          if (ev !== null) evlandList.push(ev);
          const gr = normalizeNasaValue(gwetRootMap[ymKey]);
          if (gr !== null) gRootList.push(gr);
        }

        const annualRain = rainMonths >= 10 ? Number(rainSum.toFixed(1)) : null;
        const isDryYear =
          annualRain !== null && dryThresholdMm !== null ? annualRain < dryThresholdMm : false;
        annualSeries.push({
          year: yr,
          annualRainfallMm: annualRain,
          avgMeanTempC: avgArr(tMeanList, 1),
          avgMaxTempC: avgArr(tMaxList, 1),
          avgMinTempC: avgArr(tMinList, 1),
          avgSolarMj: avgArr(solarList, 1),
          avgEvlandMmDay: avgArr(evlandList, 2),
          avgGwetRoot: avgArr(gRootList, 2),
          isDryYear,
        });
      }

      const dryYearsList = annualSeries.filter((y) => y.isDryYear).map((y) => y.year);
      const recent5YearDryCount = dryYearsList.filter((y) => y >= 2020).length;

      const summerMm =
        recentSummary.metrics.summerDjRainfallMm ?? baselineSummary.metrics.summerDjRainfallMm ?? 0;
      const winterMm =
        recentSummary.metrics.winterJjaRainfallMm ?? baselineSummary.metrics.winterJjaRainfallMm ?? 0;
      const annualRef =
        recentSummary.metrics.meanAnnualRainfallMm ?? baselineSummary.metrics.meanAnnualRainfallMm ?? 0;

      let rainfallRegimeClassification: NasaClimateComparisonData['rainfallRegimeClassification'] =
        'Summer-Rainfall';
      if (annualRef > 0 && annualRef < 320) {
        rainfallRegimeClassification = 'Semi-Arid';
      } else if (winterMm > summerMm * 1.35) {
        rainfallRegimeClassification = 'Winter-Rainfall';
      } else if (summerMm > winterMm * 1.45) {
        rainfallRegimeClassification = 'Summer-Rainfall';
      } else {
        rainfallRegimeClassification = 'All-Year / Transitional';
      }

      const diffOrNull = (a: number | null, b: number | null, decimals = 1) =>
        a !== null && b !== null ? Number((a - b).toFixed(decimals)) : null;

      const rainDeltaMm = diffOrNull(
        recentSummary.metrics.meanAnnualRainfallMm,
        baselineSummary.metrics.meanAnnualRainfallMm
      );
      const rainDeltaPct =
        rainDeltaMm !== null &&
        baselineSummary.metrics.meanAnnualRainfallMm !== null &&
        baselineSummary.metrics.meanAnnualRainfallMm > 0
          ? Number(((rainDeltaMm / baselineSummary.metrics.meanAnnualRainfallMm) * 100).toFixed(1))
          : null;

      const retrievedAt = new Date().toISOString();
      const monthlyMeta: NasaParameterMetadata[] = [
        {
          parameterCode: 'PRECTOTCORR (Monthly 2001–2024)',
          parameterName: 'Monthly Mean Precipitation & Annual Rainfall Totals',
          unit: 'mm/month & mm/yr',
          source: 'NASA POWER Monthly Agroclimatology Point API (power.larc.nasa.gov)',
          coordinatesLabel: coordLabel,
          observationPeriod: '2001–2024 (2001–2015 baseline vs 2020–2024 recent)',
          retrievedAt,
          status: 'live',
          valueKind: 'historical_climatology',
          note: spatialNote,
        },
        {
          parameterCode: 'T2M / T2M_MAX / T2M_MIN (Monthly 2001–2024)',
          parameterName: 'Monthly & Annual Mean, Max & Min 2m Air Temperature',
          unit: '°C',
          source: 'NASA POWER Monthly Agroclimatology Point API',
          coordinatesLabel: coordLabel,
          observationPeriod: '2001–2024',
          retrievedAt,
          status: 'live',
          valueKind: 'historical_climatology',
          note: 'Compares 15-year baseline temperatures against recent 5-year averages.',
        },
        {
          parameterCode: 'ALLSKY_SFC_SW_DWN & EVLAND (Monthly 2001–2024)',
          parameterName: 'Monthly Solar Irradiance & Land Evaporation Flux',
          unit: 'MJ/m²/day & mm/day',
          source: 'NASA POWER Monthly Agroclimatology Point API',
          coordinatesLabel: coordLabel,
          observationPeriod: '2001–2024',
          retrievedAt,
          status: 'live',
          valueKind: 'model_derived_evaporation_estimate',
          note: 'Tracks seasonal radiative energy and MERRA-2 modelled regional evaporation demand.',
        },
        {
          parameterCode: 'GWETROOT / GWETTOP / GWETPROF (Monthly 2001–2024)',
          parameterName: 'Multi-Year Root-Zone, Surface & Full-Profile Soil Wetness Index',
          unit: '0–1 fractional index',
          source: 'NASA POWER Monthly Agroclimatology Point API (MERRA-2 Land Surface)',
          coordinatesLabel: coordLabel,
          observationPeriod: '2001–2024',
          retrievedAt,
          status: 'live',
          valueKind: 'model_derived_soil_wetness_estimate',
          note: 'Model-derived regional soil wetness index (~55 km grid); NOT an empirical field probe measurement.',
        },
      ];

      const baseResult: NasaClimateComparisonData = {
        serviceAvailable: true,
        unavailableReason: null,
        isCachedFallback: false,
        source: 'NASA POWER Monthly Agroclimatology Point API (power.larc.nasa.gov)',
        datasetName:
          'NASA POWER AG Community Monthly Time Series (PRECTOTCORR, T2M, T2M_MAX, T2M_MIN, ALLSKY_SFC_SW_DWN, RH2M, EVLAND, GWETROOT, GWETTOP, GWETPROF)',
        coordinatesLabel: coordLabel,
        spatialResolutionNote: spatialNote,
        baselinePeriodLabel: '2001–2015 (15-year Baseline)',
        recentPeriodLabel: '2020–2024 (5-year Recent)',
        retrievedAt,
        rainfallRegimeClassification,
        seasonalDistribution: {
          summerDjfBaselineMm: baselineSummary.metrics.summerDjRainfallMm,
          summerDjfRecentMm: recentSummary.metrics.summerDjRainfallMm,
          autumnMamBaselineMm: baselineSummary.metrics.autumnMamRainfallMm,
          autumnMamRecentMm: recentSummary.metrics.autumnMamRainfallMm,
          winterJjaBaselineMm: baselineSummary.metrics.winterJjaRainfallMm,
          winterJjaRecentMm: recentSummary.metrics.winterJjaRainfallMm,
          springSonBaselineMm: baselineSummary.metrics.springSonRainfallMm,
          springSonRecentMm: recentSummary.metrics.springSonRainfallMm,
        },
        monthlyDistribution,
        annualSeries,
        recurringDryYears: {
          thresholdMm: dryThresholdMm,
          dryYearsList,
          totalDryYearsCount: dryYearsList.length,
          recent5YearDryCount,
          note:
            dryYearsList.length > 0
              ? `${dryYearsList.length} below-average rainfall year(s) (<80% of 2001–2015 mean, i.e., <${dryThresholdMm} mm/yr) observed between 2001 and 2024: ${dryYearsList.join(', ')}.`
              : `No individual year between 2001 and 2024 dropped below 80% of the 2001–2015 baseline (${dryThresholdMm ?? '—'} mm/yr), though intra-seasonal dry spells can still occur.`,
        },
        baselineMetrics: {
          meanAnnualRainfallMm: baselineSummary.metrics.meanAnnualRainfallMm,
          summerDjRainfallMm: baselineSummary.metrics.summerDjRainfallMm,
          winterJjaRainfallMm: baselineSummary.metrics.winterJjaRainfallMm,
          avgMeanTempC: baselineSummary.metrics.avgMeanTempC,
          avgMaxTempC: baselineSummary.metrics.avgMaxTempC,
          avgMinTempC: baselineSummary.metrics.avgMinTempC,
          avgSolarIrradiance: baselineSummary.metrics.avgSolarIrradiance,
          avgRelativeHumidityPercent: baselineSummary.metrics.avgRelativeHumidityPercent,
          avgEvlandMmDay: baselineSummary.metrics.avgEvlandMmDay,
          avgGwetRoot: baselineSummary.metrics.avgGwetRoot,
          avgGwetTop: baselineSummary.metrics.avgGwetTop,
          avgGwetProf: baselineSummary.metrics.avgGwetProf,
          yearsCovered: baselineSummary.metrics.yearsCovered,
        },
        recentMetrics: {
          meanAnnualRainfallMm: recentSummary.metrics.meanAnnualRainfallMm,
          summerDjRainfallMm: recentSummary.metrics.summerDjRainfallMm,
          winterJjaRainfallMm: recentSummary.metrics.winterJjaRainfallMm,
          avgMeanTempC: recentSummary.metrics.avgMeanTempC,
          avgMaxTempC: recentSummary.metrics.avgMaxTempC,
          avgMinTempC: recentSummary.metrics.avgMinTempC,
          avgSolarIrradiance: recentSummary.metrics.avgSolarIrradiance,
          avgRelativeHumidityPercent: recentSummary.metrics.avgRelativeHumidityPercent,
          avgEvlandMmDay: recentSummary.metrics.avgEvlandMmDay,
          avgGwetRoot: recentSummary.metrics.avgGwetRoot,
          avgGwetTop: recentSummary.metrics.avgGwetTop,
          avgGwetProf: recentSummary.metrics.avgGwetProf,
          yearsCovered: recentSummary.metrics.yearsCovered,
        },
        delta: {
          annualRainfallChangeMm: rainDeltaMm,
          annualRainfallChangePercent: rainDeltaPct,
          avgMeanTempChangeC: diffOrNull(
            recentSummary.metrics.avgMeanTempC,
            baselineSummary.metrics.avgMeanTempC
          ),
          avgMaxTempChangeC: diffOrNull(
            recentSummary.metrics.avgMaxTempC,
            baselineSummary.metrics.avgMaxTempC
          ),
          avgMinTempChangeC: diffOrNull(
            recentSummary.metrics.avgMinTempC,
            baselineSummary.metrics.avgMinTempC
          ),
          solarIrradianceChange: diffOrNull(
            recentSummary.metrics.avgSolarIrradiance,
            baselineSummary.metrics.avgSolarIrradiance
          ),
          humidityChangePercent: diffOrNull(
            recentSummary.metrics.avgRelativeHumidityPercent,
            baselineSummary.metrics.avgRelativeHumidityPercent
          ),
          evlandChangeMmDay: diffOrNull(
            recentSummary.metrics.avgEvlandMmDay,
            baselineSummary.metrics.avgEvlandMmDay,
            2
          ),
          gwetRootChange: diffOrNull(
            recentSummary.metrics.avgGwetRoot,
            baselineSummary.metrics.avgGwetRoot,
            2
          ),
          gwetTopChange: diffOrNull(
            recentSummary.metrics.avgGwetTop,
            baselineSummary.metrics.avgGwetTop,
            2
          ),
        },
        localInterpretation: {
          summary: '',
          soilAndMoistureNote: '',
          cropPlanningNote: '',
          rotationDecisionRelevance: '',
          scientificFramingNote:
            'This comparison describes observed and modelled environmental shifts at this coordinate grid cell (2001–2015 vs 2020–2024). It is intended for local agronomic adaptation and risk buffering, not formal climate-change attribution.',
          dataLimitations: spatialNote,
        },
        parameterMetadata: monthlyMeta,
      };

      recordProvenanceLog({
        requestId,
        coordinatesLabel: coordLabel,
        latitude,
        longitude,
        temporalResolution: 'monthly',
        dateWindowLabel: '2001–2024',
        endpointUrl: url,
        parametersRequested: MONTHLY_PARAMETERS,
        httpStatus: status,
        cacheHit: false,
        validObservationCount: validCount,
        fillValueCount: fillCount,
        errorMessage: null,
      });

      MONTHLY_MEM_CACHE.set(key, { timestampMs: Date.now(), data: baseResult });
      saveDiskCacheEntry(key, 'monthly', baseResult);
      return baseResult;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'offline';
      recordProvenanceLog({
        requestId,
        coordinatesLabel: coordLabel,
        latitude,
        longitude,
        temporalResolution: 'monthly',
        dateWindowLabel: '2001–2024',
        endpointUrl: url,
        parametersRequested: MONTHLY_PARAMETERS,
        httpStatus: null,
        cacheHit: Boolean(memHit || diskHit),
        validObservationCount: 0,
        fillValueCount: 0,
        errorMessage: msg,
      });

      const fallback = memHit || diskHit;
      if (fallback) {
        return {
          ...fallback.data,
          isCachedFallback: true,
          unavailableReason: `NASA POWER historical refresh failed (${msg}); showing last verified cached baseline from ${fallback.data.retrievedAt ? new Date(fallback.data.retrievedAt).toLocaleString('en-ZA') : 'earlier'}.`,
          parameterMetadata: fallback.data.parameterMetadata.map((m) => ({ ...m, status: 'cached' })),
        };
      }

      return {
        serviceAvailable: false,
        unavailableReason: `NASA POWER multi-year climate archive could not be retrieved (${msg}). No synthetic satellite trends are displayed.`,
        isCachedFallback: false,
        source: 'NASA POWER Monthly Agroclimatology Point API (Unavailable)',
        datasetName: 'NASA POWER AG Monthly Archive (2001–2024)',
        coordinatesLabel: coordLabel,
        spatialResolutionNote: spatialNote,
        baselinePeriodLabel: '2001–2015 (15-year Baseline)',
        recentPeriodLabel: '2020–2024 (5-year Recent)',
        retrievedAt: null,
        rainfallRegimeClassification: prov?.rainfallRegime.toLowerCase().includes('winter')
          ? 'Winter-Rainfall'
          : prov?.rainfallRegime.toLowerCase().includes('arid')
            ? 'Semi-Arid'
            : 'Summer-Rainfall',
        seasonalDistribution: null,
        monthlyDistribution: [],
        annualSeries: [],
        recurringDryYears: {
          thresholdMm: null,
          dryYearsList: [],
          totalDryYearsCount: 0,
          recent5YearDryCount: 0,
          note: 'Historical dry-year analysis is unavailable while NASA POWER cannot be reached.',
        },
        baselineMetrics: null,
        recentMetrics: null,
        delta: null,
        localInterpretation: {
          summary:
            'Multi-year NASA satellite climate comparison is currently unavailable. Use verified SAWS provincial weather advice and local soil moisture checks before planting.',
          soilAndMoistureNote: prov
            ? `Regional reference baseline for ${prov.name}: ${prov.climateZone} (${prov.annualRainfallMm}).`
            : 'Inspect local topsoil moisture and borehole logs prior to seasonal input orders.',
          cropPlanningNote:
            'Do not treat seasonal rainfall projections as guaranteed; match crop water needs to confirmed on-farm water storage.',
          rotationDecisionRelevance:
            'While NASA historical data is unavailable, rotation scoring lowers confidence and places greater weight on soil texture, farmer-reported water reliability, and pest-break rules.',
          scientificFramingNote:
            'Historical trend observations are unavailable offline; no synthetic climate trends are generated.',
          dataLimitations: spatialNote,
        },
        parameterMetadata: [
          {
            parameterCode: 'PRECTOTCORR / T2M / EVLAND / GWETROOT',
            parameterName: 'NASA POWER Monthly Archive (2001–2024)',
            unit: 'mm, °C, mm/day, 0–1 index',
            source: 'NASA POWER Monthly Point API',
            coordinatesLabel: coordLabel,
            observationPeriod: '2001–2024',
            retrievedAt: null,
            status: 'unavailable',
            valueKind: 'historical_climatology',
            note: 'Live retrieval failed; retry once connectivity resumes.',
          },
        ],
      };
    } finally {
      IN_FLIGHT_MONTHLY.delete(key);
    }
  })();

  IN_FLIGHT_MONTHLY.set(key, promise);
  const rawResult = await promise;
  return buildInterpretedClimateBlock(rawResult, context, prov);
}

export function getNasaClimateProjectionsStatus(): ClimateProjectionStatus {
  const configuredEndpoint = (process.env.NEX_GDDP_CMIP6_ENDPOINT || '').trim();
  const configured = configuredEndpoint.length > 0;
  return {
    datasetName: 'NASA Earth Exchange Global Daily Downscaled Projections (NEX-GDDP-CMIP6)',
    configured,
    statusLabel: configured
      ? 'External Gridded NetCDF / Zarr Adapter Configured'
      : 'External Pipeline Unconfigured (No Mock Projections Generated)',
    scenariosSupported: ['SSP2-4.5 (Intermediate Emissions)', 'SSP5-8.5 (High Emissions)'],
    explanation: configured
      ? `Configured via NEX_GDDP_CMIP6_ENDPOINT for multi-model CMIP6 downscaled bias-corrected climate projections (0.25° resolution).`
      : 'NASA NEX-GDDP-CMIP6 datasets are distributed as multi-terabyte NetCDF/Zarr gridded archives on NASA NCCS THREDDS and AWS Open Data. Because no external NetCDF extraction service (NEX_GDDP_CMIP6_ENDPOINT) is connected in this deployment, Field Shift intentionally displays zero fabricated future projections.',
    scientificSeparationNote:
      'Climate projections (future scenarios such as 2030–2050 SSP2-4.5) are scientifically distinct from historical NASA POWER observations (2001–2024) and short-term 7-day weather forecasts. Field Shift never mixes projected scenarios into historical rainfall or soil moisture metrics.',
  };
}

export function getNasaRegistrySummary() {
  return {
    provider: 'NASA POWER Agroclimatology API (Community: AG)',
    baseUrl: NASA_POWER_BASE_URL,
    documentationUrl: 'https://power.larc.nasa.gov/docs/services/api/',
    parameterDictionaryUrl: 'https://power.larc.nasa.gov/parameters/',
    lastCatalogVerificationDate: getSastDateString(),
    parameters: Object.values(NASA_PARAMETER_REGISTRY),
    climateProjections: getNasaClimateProjectionsStatus(),
  };
}
