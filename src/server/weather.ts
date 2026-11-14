import { getSastDateString, getSastIsoMinute, getSastMonth, sastDaysAgo } from './saTime.ts';
import { getSaSeasonalGuidance, SOUTH_AFRICA_PROVINCES } from './southAfricaData.ts';
import { store } from './store.ts';
import { CropRecord, Farm, FarmLocation, Field, LivestockGroup } from './types.ts';

export interface AgriculturalWarning {
  id: string;
  category:
    | 'heavy_rainfall'
    | 'flooding'
    | 'waterlogging'
    | 'drought'
    | 'extreme_heat'
    | 'frost'
    | 'strong_wind'
    | 'spraying'
    | 'planting'
    | 'irrigation';
  severity: 'High' | 'Moderate' | 'Advisory';
  title: string;
  whatIsHappening: string;
  affectedFarm: string;
  possibleImpact: string;
  recommendedPrecautions: string[];
}

export interface WeatherIntelligencePayload {
  farmId: string;
  farmName: string;
  locationLabel: string;
  coordinates: { latitude: number; longitude: number };
  serviceAvailable: boolean;
  unavailableReason: string | null;
  source: string;
  sawsIntegrationStatus: string;
  lastUpdated: string | null;
  isCachedFallback: boolean;
  current: {
    temperatureC: number | null;
    apparentTempC: number | null;
    humidityPercent: number | null;
    windSpeedKmh: number | null;
    windGustsKmh: number | null;
    windDirectionDeg: number | null;
    precipitationMm: number | null;
    weatherDescription: string;
  } | null;
  hourly: {
    time: string;
    temperatureC: number;
    precipitationMm: number;
    precipProbabilityPercent: number | null;
    windSpeedKmh: number;
    humidityPercent: number | null;
  }[];
  daily: {
    date: string;
    tempMaxC: number;
    tempMinC: number;
    precipitationMm: number;
    precipProbabilityPercent: number | null;
    windMaxKmh: number;
    et0EvapotranspirationMm: number | null;
    weatherDescription: string;
  }[];
  historicalRainfall: {
    past14DaysMm: number | null;
    past30DaysMm: number | null;
    seasonalClimateNote: string;
    historicalDays: { date: string; precipitationMm: number; tempMaxC: number; tempMinC: number }[];
  };
  nasaPower?: {
    serviceAvailable: boolean;
    unavailableReason: string | null;
    source: string;
    periodLabel: string;
    solarUnit: string;
    avgSolarIrradiance: number | null;
    totalPrecipitationMm: number | null;
    avgMaxTempC: number | null;
    avgMinTempC: number | null;
    avgRelativeHumidityPercent: number | null;
    daysCount: number;
    lastUpdated: string | null;
  };
  nasaClimateComparison?: {
    serviceAvailable: boolean;
    unavailableReason: string | null;
    source: string;
    datasetName: string;
    coordinatesLabel: string;
    spatialResolutionNote: string;
    baselinePeriodLabel: string;
    recentPeriodLabel: string;
    retrievedAt: string | null;
    baselineMetrics: {
      meanAnnualRainfallMm: number | null;
      summerDjRainfallMm: number | null;
      winterJjaRainfallMm: number | null;
      avgMaxTempC: number | null;
      avgMinTempC: number | null;
      avgSolarIrradiance: number | null;
      avgRelativeHumidityPercent: number | null;
      yearsCovered: number;
    } | null;
    recentMetrics: {
      meanAnnualRainfallMm: number | null;
      summerDjRainfallMm: number | null;
      winterJjaRainfallMm: number | null;
      avgMaxTempC: number | null;
      avgMinTempC: number | null;
      avgSolarIrradiance: number | null;
      avgRelativeHumidityPercent: number | null;
      yearsCovered: number;
    } | null;
    delta: {
      annualRainfallChangeMm: number | null;
      annualRainfallChangePercent: number | null;
      avgMaxTempChangeC: number | null;
      avgMinTempChangeC: number | null;
      solarIrradianceChange: number | null;
      humidityChangePercent: number | null;
    } | null;
    localInterpretation: {
      summary: string;
      soilAndMoistureNote: string;
      cropPlanningNote: string;
      dataLimitations: string;
    };
  };
  seasonalCalendar?: {
    regime: string;
    seasonLabel: string;
    plantingWindow: string;
    recommendedCrops: string[];
    livestockAdvisory: string;
  };
  operationsWindow: {
    sprayingStatus: 'Suitable' | 'Caution' | 'Avoid' | 'Unknown';
    sprayingReason: string;
    plantingStatus: 'Suitable' | 'Caution' | 'Avoid' | 'Unknown';
    plantingReason: string;
    irrigationStatus: 'Needed' | 'Moderate' | 'Pause (Rain Expected)' | 'Unknown';
    irrigationReason: string;
  };
  warnings: AgriculturalWarning[];
}

const WEATHER_CACHE = new Map<
  string,
  { timestampMs: number; payload: WeatherIntelligencePayload }
>();
const NASA_POWER_CACHE = new Map<
  string,
  { timestampMs: number; data: NonNullable<WeatherIntelligencePayload['nasaPower']> }
>();
const NASA_CLIMATE_CACHE = new Map<
  string,
  { timestampMs: number; data: NonNullable<WeatherIntelligencePayload['nasaClimateComparison']> }
>();
const CACHE_TTL_MS = 15 * 60 * 1000;
const NASA_CACHE_TTL_MS = 60 * 60 * 1000;

function wmoCodeToText(code: number | null | undefined): string {
  if (code === null || code === undefined) return 'Unknown conditions';
  if (code === 0) return 'Clear sky';
  if (code === 1 || code === 2) return 'Mainly clear / partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog or mist';
  if (code >= 51 && code <= 55) return 'Light to moderate drizzle';
  if (code >= 61 && code <= 65) return 'Rain showers';
  if (code >= 66 && code <= 67) return 'Freezing rain';
  if (code >= 80 && code <= 82) return 'Heavy rain showers';
  if (code >= 95) return 'Thunderstorm activity';
  return 'Variable cloud';
}

function getSawsStatusLabel(): string {
  if (process.env.SAWS_API_KEY && process.env.SAWS_API_URL) {
    return 'South African Weather Service (SAWS) Feed Configured';
  }
  return 'SAWS Adapter Ready (Using Live Open-Meteo WMO + NASA POWER Agro-Met Feeds; set SAWS_API_KEY for official SAWS CAP alert stream)';
}

async function fetchNasaPowerSummary(
  latitude: number,
  longitude: number
): Promise<NonNullable<WeatherIntelligencePayload['nasaPower']>> {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = NASA_POWER_CACHE.get(key);
  if (cached && Date.now() - cached.timestampMs < NASA_CACHE_TTL_MS) {
    return cached.data;
  }

  const startStr = sastDaysAgo(33).replace(/-/g, '');
  const endStr = sastDaysAgo(3).replace(/-/g, '');
  const periodLabel = `${sastDaysAgo(33)} to ${sastDaysAgo(3)} (SAST)`;

  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point` +
    `?parameters=ALLSKY_SFC_SW_DWN,PRECTOTCORR,T2M_MAX,T2M_MIN,RH2M` +
    `&community=AG` +
    `&longitude=${encodeURIComponent(longitude)}` +
    `&latitude=${encodeURIComponent(latitude)}` +
    `&start=${startStr}&end=${endStr}&format=JSON`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) {
      throw new Error(`NASA POWER responded with HTTP ${res.status}`);
    }
    const raw = (await res.json()) as {
      parameters?: Record<string, { units?: string }>;
      properties?: {
        parameter?: {
          ALLSKY_SFC_SW_DWN?: Record<string, number>;
          PRECTOTCORR?: Record<string, number>;
          T2M_MAX?: Record<string, number>;
          T2M_MIN?: Record<string, number>;
          RH2M?: Record<string, number>;
        };
      };
    };

    const params = raw.properties?.parameter || {};
    const valid = (rec?: Record<string, number>) =>
      Object.values(rec || {}).filter((v) => typeof v === 'number' && Number.isFinite(v) && v > -900);

    const solarVals = valid(params.ALLSKY_SFC_SW_DWN);
    const rainVals = valid(params.PRECTOTCORR);
    const tmaxVals = valid(params.T2M_MAX);
    const tminVals = valid(params.T2M_MIN);
    const rhVals = valid(params.RH2M);

    const avg = (arr: number[]) =>
      arr.length > 0 ? Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1)) : null;

    const result: NonNullable<WeatherIntelligencePayload['nasaPower']> = {
      serviceAvailable: solarVals.length > 0 || rainVals.length > 0 || tmaxVals.length > 0,
      unavailableReason: null,
      source: 'NASA POWER Agroclimatology Daily Point API (Community: AG)',
      periodLabel,
      solarUnit: raw.parameters?.ALLSKY_SFC_SW_DWN?.units || 'MJ/m^2/day',
      avgSolarIrradiance: avg(solarVals),
      totalPrecipitationMm:
        rainVals.length > 0 ? Number(rainVals.reduce((s, v) => s + v, 0).toFixed(1)) : null,
      avgMaxTempC: avg(tmaxVals),
      avgMinTempC: avg(tminVals),
      avgRelativeHumidityPercent: avg(rhVals),
      daysCount: Math.max(solarVals.length, rainVals.length, tmaxVals.length),
      lastUpdated: new Date().toISOString(),
    };

    if (!result.serviceAvailable) {
      result.unavailableReason = 'NASA POWER returned no valid satellite observations for this window.';
    } else {
      NASA_POWER_CACHE.set(key, { timestampMs: Date.now(), data: result });
    }
    return result;
  } catch (err: unknown) {
    if (cached) {
      return {
        ...cached.data,
        unavailableReason: `Refresh failed (${err instanceof Error ? err.message : 'network error'}); showing cached NASA POWER summary.`,
      };
    }
    return {
      serviceAvailable: false,
      unavailableReason: `NASA POWER service unreachable (${err instanceof Error ? err.message : 'offline'}).`,
      source: 'NASA POWER Agroclimatology Daily Point API (Unavailable)',
      periodLabel,
      solarUnit: 'MJ/m^2/day',
      avgSolarIrradiance: null,
      totalPrecipitationMm: null,
      avgMaxTempC: null,
      avgMinTempC: null,
      avgRelativeHumidityPercent: null,
      daysCount: 0,
      lastUpdated: null,
    };
  }
}

function daysInMonth(year: number, month1To12: number): number {
  if (month1To12 === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month1To12)) return 30;
  return 31;
}

export async function fetchNasaPowerClimateComparison(
  latitude: number,
  longitude: number,
  context?: {
    province?: string;
    locationLabel?: string;
    waterAvailability?: string;
    primaryCrops?: string[];
  }
): Promise<NonNullable<WeatherIntelligencePayload['nasaClimateComparison']>> {
  const key = `clim:${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = NASA_CLIMATE_CACHE.get(key);
  const prov = SOUTH_AFRICA_PROVINCES.find((p) => p.name === context?.province);
  const coordLabel = `${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`;
  const spatialNote =
    'NASA POWER Agroclimatology monthly grid (~0.5° latitude × 0.625° longitude, ~55 km resolution). Represents regional satellite/reanalysis grid conditions rather than micro-scale farm valleys or frost pockets.';

  if (cached && Date.now() - cached.timestampMs < NASA_CACHE_TTL_MS) {
    return buildInterpretedClimateBlock(cached.data, context, prov);
  }

  const url =
    `https://power.larc.nasa.gov/api/temporal/monthly/point` +
    `?parameters=ALLSKY_SFC_SW_DWN,PRECTOTCORR,T2M_MAX,T2M_MIN,RH2M` +
    `&community=AG` +
    `&longitude=${encodeURIComponent(longitude)}` +
    `&latitude=${encodeURIComponent(latitude)}` +
    `&start=2001&end=2024&format=JSON`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) {
      throw new Error(`NASA POWER monthly archive responded with HTTP ${res.status}`);
    }
    const raw = (await res.json()) as {
      properties?: {
        parameter?: {
          ALLSKY_SFC_SW_DWN?: Record<string, number>;
          PRECTOTCORR?: Record<string, number>;
          T2M_MAX?: Record<string, number>;
          T2M_MIN?: Record<string, number>;
          RH2M?: Record<string, number>;
        };
      };
    };

    const params = raw.properties?.parameter || {};
    const rainMap = params.PRECTOTCORR || {};
    const solarMap = params.ALLSKY_SFC_SW_DWN || {};
    const tmaxMap = params.T2M_MAX || {};
    const tminMap = params.T2M_MIN || {};
    const rhMap = params.RH2M || {};

    const summariseYears = (startYear: number, endYear: number) => {
      const annualTotals = new Map<number, number>();
      const djfTotals = new Map<number, number>();
      const jjaTotals = new Map<number, number>();
      const tmaxVals: number[] = [];
      const tminVals: number[] = [];
      const solarVals: number[] = [];
      const rhVals: number[] = [];

      for (const ymKey of Object.keys(rainMap)) {
        if (ymKey.length !== 6) continue;
        const year = Number(ymKey.slice(0, 4));
        const month = Number(ymKey.slice(4, 6));
        if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) continue;
        if (year < startYear || year > endYear) continue;

        const rainRate = rainMap[ymKey];
        if (typeof rainRate === 'number' && Number.isFinite(rainRate) && rainRate > -900) {
          const monthMm = rainRate * daysInMonth(year, month);
          annualTotals.set(year, (annualTotals.get(year) || 0) + monthMm);
          if (month === 12 || month === 1 || month === 2) {
            djfTotals.set(year, (djfTotals.get(year) || 0) + monthMm);
          }
          if (month === 6 || month === 7 || month === 8) {
            jjaTotals.set(year, (jjaTotals.get(year) || 0) + monthMm);
          }
        }
        const tmax = tmaxMap[ymKey];
        if (typeof tmax === 'number' && Number.isFinite(tmax) && tmax > -900) tmaxVals.push(tmax);
        const tmin = tminMap[ymKey];
        if (typeof tmin === 'number' && Number.isFinite(tmin) && tmin > -900) tminVals.push(tmin);
        const sol = solarMap[ymKey];
        if (typeof sol === 'number' && Number.isFinite(sol) && sol > -900) solarVals.push(sol);
        const rh = rhMap[ymKey];
        if (typeof rh === 'number' && Number.isFinite(rh) && rh > -900) rhVals.push(rh);
      }

      const avgArr = (arr: number[]) =>
        arr.length > 0 ? Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1)) : null;

      const annualList = Array.from(annualTotals.values());
      const djfList = Array.from(djfTotals.values());
      const jjaList = Array.from(jjaTotals.values());

      return {
        meanAnnualRainfallMm: avgArr(annualList),
        summerDjRainfallMm: avgArr(djfList),
        winterJjaRainfallMm: avgArr(jjaList),
        avgMaxTempC: avgArr(tmaxVals),
        avgMinTempC: avgArr(tminVals),
        avgSolarIrradiance: avgArr(solarVals),
        avgRelativeHumidityPercent: avgArr(rhVals),
        yearsCovered: annualTotals.size,
      };
    };

    const baselineMetrics = summariseYears(2001, 2015);
    const recentMetrics = summariseYears(2020, 2024);

    if (baselineMetrics.yearsCovered === 0 || recentMetrics.yearsCovered === 0) {
      throw new Error('NASA POWER monthly archive returned insufficient valid observations for 2001-2024.');
    }

    const diffOrNull = (a: number | null, b: number | null) =>
      a !== null && b !== null ? Number((a - b).toFixed(1)) : null;
    const rainDeltaMm = diffOrNull(
      recentMetrics.meanAnnualRainfallMm,
      baselineMetrics.meanAnnualRainfallMm
    );
    const rainDeltaPct =
      rainDeltaMm !== null &&
      baselineMetrics.meanAnnualRainfallMm !== null &&
      baselineMetrics.meanAnnualRainfallMm > 0
        ? Number(((rainDeltaMm / baselineMetrics.meanAnnualRainfallMm) * 100).toFixed(1))
        : null;

    const baseResult: NonNullable<WeatherIntelligencePayload['nasaClimateComparison']> = {
      serviceAvailable: true,
      unavailableReason: null,
      source: 'NASA POWER Monthly Agroclimatology Point API (power.larc.nasa.gov)',
      datasetName: 'NASA POWER AG Community Monthly Time Series (PRECTOTCORR, T2M_MAX, T2M_MIN, ALLSKY_SFC_SW_DWN, RH2M)',
      coordinatesLabel: coordLabel,
      spatialResolutionNote: spatialNote,
      baselinePeriodLabel: '2001–2015 (15-year Baseline)',
      recentPeriodLabel: '2020–2024 (5-year Recent)',
      retrievedAt: new Date().toISOString(),
      baselineMetrics,
      recentMetrics,
      delta: {
        annualRainfallChangeMm: rainDeltaMm,
        annualRainfallChangePercent: rainDeltaPct,
        avgMaxTempChangeC: diffOrNull(recentMetrics.avgMaxTempC, baselineMetrics.avgMaxTempC),
        avgMinTempChangeC: diffOrNull(recentMetrics.avgMinTempC, baselineMetrics.avgMinTempC),
        solarIrradianceChange: diffOrNull(
          recentMetrics.avgSolarIrradiance,
          baselineMetrics.avgSolarIrradiance
        ),
        humidityChangePercent: diffOrNull(
          recentMetrics.avgRelativeHumidityPercent,
          baselineMetrics.avgRelativeHumidityPercent
        ),
      },
      localInterpretation: {
        summary: '',
        soilAndMoistureNote: '',
        cropPlanningNote: '',
        dataLimitations: spatialNote,
      },
    };

    NASA_CLIMATE_CACHE.set(key, { timestampMs: Date.now(), data: baseResult });
    return buildInterpretedClimateBlock(baseResult, context, prov);
  } catch (err: unknown) {
    if (cached) {
      return buildInterpretedClimateBlock(
        {
          ...cached.data,
          unavailableReason: `NASA POWER historical refresh failed (${err instanceof Error ? err.message : 'network error'}); showing last verified cached baseline.`,
        },
        context,
        prov
      );
    }
    return {
      serviceAvailable: false,
      unavailableReason: `NASA POWER multi-year climate archive could not be retrieved (${err instanceof Error ? err.message : 'offline'}). No synthetic satellite trends are displayed.`,
      source: 'NASA POWER Monthly Agroclimatology Point API (Unavailable)',
      datasetName: 'NASA POWER AG Monthly Archive (2001–2024)',
      coordinatesLabel: coordLabel,
      spatialResolutionNote: spatialNote,
      baselinePeriodLabel: '2001–2015 (15-year Baseline)',
      recentPeriodLabel: '2020–2024 (5-year Recent)',
      retrievedAt: null,
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
        dataLimitations: spatialNote,
      },
    };
  }
}

function buildInterpretedClimateBlock(
  base: NonNullable<WeatherIntelligencePayload['nasaClimateComparison']>,
  context?: {
    province?: string;
    locationLabel?: string;
    waterAvailability?: string;
    primaryCrops?: string[];
  },
  prov?: (typeof SOUTH_AFRICA_PROVINCES)[number]
): NonNullable<WeatherIntelligencePayload['nasaClimateComparison']> {
  if (!base.serviceAvailable || !base.baselineMetrics || !base.recentMetrics || !base.delta) {
    return base;
  }

  const d = base.delta;
  const rainChange = d.annualRainfallChangeMm ?? 0;
  const tmaxChange = d.avgMaxTempChangeC ?? 0;
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

  const summary = `At ${siteName} (${base.coordinatesLabel}), NASA POWER satellite comparisons indicate ${rainDirection} alongside ${tempDirection} between 2020–2024 vs the 2001–2015 baseline.`;

  const soilAndMoistureNote =
    rainChange < -20 || tmaxChange >= 0.4
      ? `Warmer daytime peaks and lower rainfall reserves increase topsoil evapotranspiration. Prioritise mulch retention, zero/minimum tillage where practical, and verify water capacity (${waterInfo}) before expanding cropped area.`
      : `Moisture and heat signals remain within historical range for ${prov?.name || 'this region'}, though seasonal onset timing still fluctuates year-to-year — schedule irrigation around 0–20 cm soil moisture checks.`;

  const cropPlanningNote = `For ${cropList}: align planting dates to confirmed seasonal rain onset rather than fixed calendar dates, pair high-nitrogen feeders with legume cover or break crops, and avoid relying on historical averages without drought-tolerant cultivar buffers.`;

  return {
    ...base,
    localInterpretation: {
      summary,
      soilAndMoistureNote,
      cropPlanningNote,
      dataLimitations: base.spatialResolutionNote,
    },
  };
}

function deriveAgriculturalWarnings(params: {
  farm: Farm;
  location: FarmLocation;
  fields: Field[];
  crops: CropRecord[];
  livestock: LivestockGroup[];
  current: WeatherIntelligencePayload['current'];
  hourly: WeatherIntelligencePayload['hourly'];
  daily: WeatherIntelligencePayload['daily'];
  past14DaysMm: number | null;
  past30DaysMm: number | null;
}): {
  warnings: AgriculturalWarning[];
  operationsWindow: WeatherIntelligencePayload['operationsWindow'];
} {
  const { farm, location, fields, crops, livestock, current, hourly, daily, past14DaysMm, past30DaysMm } =
    params;
  const warnings: AgriculturalWarning[] = [];
  const farmLabel = `${farm.name} (${location.townOrVillage}, ${location.province})`;
  const activeCropsLabel = crops.length > 0 ? crops.map((c) => c.cropName).join(', ') : 'planned crops';
  const hasClayFields = fields.some((f) => f.soilType.toLowerCase().includes('clay'));

  const next3Days = daily.slice(0, 3);
  const next3DaysRain = Number(next3Days.reduce((s, d) => s + d.precipitationMm, 0).toFixed(1));
  const maxDayRain = Math.max(0, ...daily.map((d) => d.precipitationMm));
  const maxDayTemp = Math.max(-99, ...daily.map((d) => d.tempMaxC));
  const minDayTemp = Math.min(99, ...daily.map((d) => d.tempMinC));
  const maxWind = Math.max(0, ...daily.map((d) => d.windMaxKmh));
  const avgEt0 =
    daily.length > 0
      ? Number(
          (
            daily.reduce((s, d) => s + (d.et0EvapotranspirationMm || 0), 0) / daily.length
          ).toFixed(1)
        )
      : 0;
  const next6HoursRain = Number(
    hourly
      .slice(0, 6)
      .reduce((s, h) => s + h.precipitationMm, 0)
      .toFixed(1)
  );

  // 1. Heavy rainfall & possible flooding
  if (maxDayRain >= 25 || next3DaysRain >= 45) {
    warnings.push({
      id: 'warn-heavy-rain',
      category: maxDayRain >= 50 ? 'flooding' : 'heavy_rainfall',
      severity: maxDayRain >= 45 || next3DaysRain >= 65 ? 'High' : 'Moderate',
      title: maxDayRain >= 50 ? 'Heavy Rainfall & Surface Flooding Risk' : 'Heavy Rainfall Expected',
      whatIsHappening: `Forecast shows up to ${maxDayRain} mm in a single day and ${next3DaysRain} mm over the next 72 hours at ${farmLabel}.`,
      affectedFarm: `${farmLabel} — affects ${activeCropsLabel}${livestock.length ? ' and low-lying paddocks' : ''}.`,
      possibleImpact:
        'Surface runoff, soil erosion on sloped fields, wash-off of newly applied fertilisers/sprays, and possible flooding in valley bottoms.',
      recommendedPrecautions: [
        'Clear stormwater diversion furrows and field drainage outlets before rain arrives.',
        'Delay nitrogen top-dressing and foliar chemical spraying until after heavy rain passes.',
        'Move cattle, goats, or sheep out of riverbanks and low-lying floodplains.',
      ],
    });
  }

  // 2. Waterlogging
  if (next3DaysRain >= 30 || (past14DaysMm !== null && past14DaysMm >= 80 && next3DaysRain >= 15)) {
    warnings.push({
      id: 'warn-waterlogging',
      category: 'waterlogging',
      severity: hasClayFields ? 'High' : 'Moderate',
      title: 'Soil Waterlogging & Root Oxygen Stress Risk',
      whatIsHappening: `Cumulative moisture (${past14DaysMm ?? 0} mm past 14 days + ${next3DaysRain} mm forecast 72h) on ${hasClayFields ? 'clay-bearing fields' : 'farm soils'}.`,
      affectedFarm: `${farmLabel}${hasClayFields ? ' (Clay-heavy soils hold excess water longer)' : ''}.`,
      possibleImpact:
        'Poor root aeration, yellowing leaves in maize/vegetables, increased root rot and fungal pressure, and tractor compaction risk.',
      recommendedPrecautions: [
        'Pause all scheduled irrigation on wet blocks immediately.',
        'Keep heavy tractors and livestock off saturated fields to prevent soil compaction.',
        'Inspect root zones for damping-off or fungal lesions once surface drains.',
      ],
    });
  }

  // 3. Drought / Dry Spell
  if (past30DaysMm !== null && past30DaysMm < 15 && next3DaysRain < 3) {
    warnings.push({
      id: 'warn-drought',
      category: 'drought',
      severity: maxDayTemp >= 32 ? 'High' : 'Moderate',
      title: 'Prolonged Dry Conditions / Moisture Deficit',
      whatIsHappening: `Only ${past30DaysMm} mm recorded in the past 30 days with ${next3DaysRain} mm expected in the next 72 hours (avg ET0 ${avgEt0} mm/day).`,
      affectedFarm: `${farmLabel} — dryland crops and natural grazing camps.`,
      possibleImpact:
        'Reduced vegetative growth, flower/cob abortion under moisture stress, and declining veld grazing quality.',
      recommendedPrecautions: [
        'Prioritise drip or targeted irrigation for high-value vegetable and orchard blocks during early morning hours.',
        'Apply organic mulch along crop rows to cut soil evaporation.',
        'Check borehole recovery rates and reserve supplementary fodder/mineral licks for livestock.',
      ],
    });
  }

  // 4. Extreme Temperatures
  if (maxDayTemp >= 34) {
    warnings.push({
      id: 'warn-heat',
      category: 'extreme_heat',
      severity: maxDayTemp >= 37 ? 'High' : 'Moderate',
      title: 'Extreme High Temperature & Heat Stress',
      whatIsHappening: `Daily maximum temperatures forecast up to ${maxDayTemp}°C over the coming week.`,
      affectedFarm: `${farmLabel} — especially flowering crops, poultry houses, and dairy/feedlot animals.`,
      possibleImpact:
        'Blossom drop, leaf scorch, rapid soil drying, reduced poultry feed intake, and livestock heat stress.',
      recommendedPrecautions: [
        'Ensure clean, cool drinking water is continuously available in all troughs and poultry drinkers.',
        'Check poultry house ventilation and shade netting before midday peaks.',
        'Avoid transplanting seedlings or spraying emulsifiable oils during hot afternoons.',
      ],
    });
  }

  // 5. Frost Risk
  if (minDayTemp <= 3) {
    warnings.push({
      id: 'warn-frost',
      category: 'frost',
      severity: minDayTemp <= 0 ? 'High' : 'Moderate',
      title: minDayTemp <= 0 ? 'Severe Frost Alert' : 'Light Frost / Cold Night Risk',
      whatIsHappening: `Overnight minimum temperatures forecast to drop to ${minDayTemp}°C.`,
      affectedFarm: `${farmLabel} — sensitive horticulture, young seedlings, subtropical trees, and newborn lambs/kids.`,
      possibleImpact:
        'Tissue damage or die-back on tender leaves and blossoms; cold stress in young livestock.',
      recommendedPrecautions: [
        'Protect sensitive vegetable beds with frost cloth or overhead micro-irrigation just before dawn.',
        'Provide dry bedding and wind-sheltered housing for calves, lambs, kids, and chicks overnight.',
        'Hold off planting frost-sensitive summer seedlings until overnight lows exceed 6°C.',
      ],
    });
  }

  // 6. Strong Winds
  if (maxWind >= 30 || (current?.windGustsKmh || 0) >= 40) {
    warnings.push({
      id: 'warn-wind',
      category: 'strong_wind',
      severity: maxWind >= 45 ? 'High' : 'Moderate',
      title: 'Strong Wind Warning',
      whatIsHappening: `Peak wind speeds forecast up to ${maxWind} km/h${current?.windGustsKmh ? ` (current gusts ${current.windGustsKmh} km/h)` : ''}.`,
      affectedFarm: `${farmLabel} — tall maize, shade tunnels, orchards, and boom/knapsack spraying.`,
      possibleImpact:
        'Stalk lodging, wind-rub scarring on fruit, shade-net damage, and severe chemical spray drift.',
      recommendedPrecautions: [
        'Suspend all pesticide and foliar herbicide spraying until wind drops below 15 km/h.',
        'Check tunnel anchors, shade-cloth fastenings, and irrigation risers.',
      ],
    });
  }

  // 7. Operational Suitability Warnings (Spraying, Planting, Irrigation)
  const windNow = current?.windSpeedKmh ?? (hourly[0]?.windSpeedKmh || 0);
  const tempNow = current?.temperatureC ?? (hourly[0]?.temperatureC || 22);
  let sprayingStatus: 'Suitable' | 'Caution' | 'Avoid' = 'Suitable';
  let sprayingReason = `Wind ${windNow} km/h, temp ${tempNow}°C, next 6h rain ${next6HoursRain} mm.`;

  if (windNow >= 18 || next6HoursRain >= 1.5 || tempNow >= 32) {
    sprayingStatus = 'Avoid';
    sprayingReason =
      windNow >= 18
        ? `Wind speed (${windNow} km/h) causes unacceptable spray drift.`
        : next6HoursRain >= 1.5
        ? `${next6HoursRain} mm rain expected within 6 hours will wash off application.`
        : `High temperature (${tempNow}°C) increases rapid droplet evaporation.`;
    warnings.push({
      id: 'warn-spraying',
      category: 'spraying',
      severity: 'Advisory',
      title: 'Unfavourable Conditions for Crop Spraying',
      whatIsHappening: sprayingReason,
      affectedFarm: `${farmLabel} — all foliar crop protection & herbicide blocks.`,
      possibleImpact: 'Off-target chemical drift, reduced efficacy, and wasted input cost.',
      recommendedPrecautions: [
        'Reschedule spraying for early morning or late afternoon when wind is 4–12 km/h and rain risk is zero.',
      ],
    });
  } else if (windNow >= 12 || tempNow >= 28) {
    sprayingStatus = 'Caution';
    sprayingReason = `Moderate wind (${windNow} km/h) or warmth (${tempNow}°C) — use coarse-droplet nozzles early morning.`;
  }

  let plantingStatus: 'Suitable' | 'Caution' | 'Avoid' = 'Suitable';
  let plantingReason = `Soil moisture and temperature window support field planting operations.`;
  if (minDayTemp <= 2 || maxDayRain >= 35 || maxDayTemp >= 36) {
    plantingStatus = 'Avoid';
    plantingReason =
      minDayTemp <= 2
        ? `Minimum temp (${minDayTemp}°C) risks cold injury to emerging seedlings.`
        : maxDayRain >= 35
        ? `Heavy rain (${maxDayRain} mm) may wash out seedbeds or cause crusting.`
        : `Extreme heat (${maxDayTemp}°C) stresses newly transplanted seedlings.`;
    warnings.push({
      id: 'warn-planting',
      category: 'planting',
      severity: 'Advisory',
      title: 'Planting Window Caution / Delay Recommended',
      whatIsHappening: plantingReason,
      affectedFarm: `${farmLabel} — nursery transplants and direct-seeded blocks.`,
      possibleImpact: 'Poor germination percentage or seedling mortality.',
      recommendedPrecautions: [
        'Wait for milder temperatures and workable field moisture before opening seed furrows.',
      ],
    });
  } else if (next3DaysRain < 1 && farm.waterAvailability.toLowerCase().includes('rain')) {
    plantingStatus = 'Caution';
    plantingReason = 'Rain-fed farm with <1 mm rain in next 72h — confirm subsoil moisture before seeding.';
  }

  let irrigationStatus: 'Needed' | 'Moderate' | 'Pause (Rain Expected)' = 'Moderate';
  let irrigationReason = `Average reference evapotranspiration is ${avgEt0} mm/day.`;
  if (next3DaysRain >= 12) {
    irrigationStatus = 'Pause (Rain Expected)';
    irrigationReason = `${next3DaysRain} mm rain forecast over next 72h — conserve borehole/dam water and avoid over-saturation.`;
    warnings.push({
      id: 'warn-irrigation-pause',
      category: 'irrigation',
      severity: 'Advisory',
      title: 'Adjust Irrigation Schedule Before Rain',
      whatIsHappening: `${next3DaysRain} mm rain is forecast over the next 3 days.`,
      affectedFarm: `${farmLabel} — irrigated horticulture and orchard blocks.`,
      possibleImpact: 'Nutrient leaching and unnecessary pumping/electricity costs if irrigated prior to rain.',
      recommendedPrecautions: [
        'Pause routine irrigation cycles for 48–72 hours and re-check topsoil moisture after rainfall.',
      ],
    });
  } else if (avgEt0 >= 4.5 && next3DaysRain < 3) {
    irrigationStatus = 'Needed';
    irrigationReason = `High crop water demand (ET0 ${avgEt0} mm/day) with minimal rain (${next3DaysRain} mm/72h).`;
  }

  return {
    warnings,
    operationsWindow: {
      sprayingStatus,
      sprayingReason,
      plantingStatus,
      plantingReason,
      irrigationStatus,
      irrigationReason,
    },
  };
}

export async function getFarmWeatherIntelligence(farmId: string): Promise<WeatherIntelligencePayload> {
  const farm = store.db.farms.find((f) => f.id === farmId);
  const location = store.db.farmLocations.find((l) => l.farmId === farmId);
  if (!farm || !location) {
    throw new Error('Farm location coordinates not found.');
  }

  const fields = store.db.fields.filter((fl) => fl.farmId === farmId);
  const crops = store.db.crops.filter((c) => c.farmId === farmId);
  const livestock = store.db.livestockGroups.filter((g) => g.farmId === farmId);
  const prov = SOUTH_AFRICA_PROVINCES.find((p) => p.name === location.province);

  const cacheKey = `${farmId}:${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}`;
  const cached = WEATHER_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestampMs < CACHE_TTL_MS) {
    const derived = deriveAgriculturalWarnings({
      farm,
      location,
      fields,
      crops,
      livestock,
      current: cached.payload.current,
      hourly: cached.payload.hourly,
      daily: cached.payload.daily,
      past14DaysMm: cached.payload.historicalRainfall.past14DaysMm,
      past30DaysMm: cached.payload.historicalRainfall.past30DaysMm,
    });
    return {
      ...cached.payload,
      warnings: derived.warnings,
      operationsWindow: derived.operationsWindow,
    };
  }

  const locationLabel = `${location.townOrVillage}, ${location.localMunicipality}, ${location.province}`;
  const seasonalClimateNote = prov
    ? `${prov.climateZone} · Typical annual rainfall ${prov.annualRainfallMm}`
    : 'South African regional seasonal climate pattern';

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${encodeURIComponent(location.latitude)}` +
    `&longitude=${encodeURIComponent(location.longitude)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration` +
    `&past_days=30&forecast_days=7&timezone=Africa%2FJohannesburg`;

  const seasonalCalendar = getSaSeasonalGuidance(location.province, getSastMonth());
  const nasaPowerPromise = fetchNasaPowerSummary(location.latitude, location.longitude);
  const nasaClimatePromise = fetchNasaPowerClimateComparison(
    location.latitude,
    location.longitude,
    {
      province: location.province,
      locationLabel,
      waterAvailability: farm.waterAvailability,
      primaryCrops: crops.map((c) => c.cropName),
    }
  );

  try {
    const [response, nasaPower, nasaClimateComparison] = await Promise.all([
      fetch(url, { signal: AbortSignal.timeout(7000) }),
      nasaPowerPromise,
      nasaClimatePromise,
    ]);
    if (!response.ok) {
      throw new Error(`Weather API responded with HTTP ${response.status}`);
    }
    const raw = (await response.json()) as {
      current?: {
        temperature_2m?: number;
        apparent_temperature?: number;
        relative_humidity_2m?: number;
        wind_speed_10m?: number;
        wind_gusts_10m?: number;
        wind_direction_10m?: number;
        precipitation?: number;
        weather_code?: number;
      };
      hourly?: {
        time: string[];
        temperature_2m: number[];
        relative_humidity_2m?: number[];
        precipitation: number[];
        precipitation_probability?: number[];
        wind_speed_10m: number[];
      };
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        precipitation_probability_max?: number[];
        wind_speed_10m_max: number[];
        et0_fao_evapotranspiration?: number[];
      };
    };

    const todayStr = getSastDateString();
    const allDaily = (raw.daily?.time || []).map((date, idx) => ({
      date,
      tempMaxC: Number((raw.daily?.temperature_2m_max?.[idx] ?? 0).toFixed(1)),
      tempMinC: Number((raw.daily?.temperature_2m_min?.[idx] ?? 0).toFixed(1)),
      precipitationMm: Number((raw.daily?.precipitation_sum?.[idx] ?? 0).toFixed(1)),
      precipProbabilityPercent:
        raw.daily?.precipitation_probability_max?.[idx] !== undefined &&
        raw.daily?.precipitation_probability_max?.[idx] !== null
          ? Number(raw.daily.precipitation_probability_max[idx])
          : null,
      windMaxKmh: Number((raw.daily?.wind_speed_10m_max?.[idx] ?? 0).toFixed(1)),
      et0EvapotranspirationMm:
        raw.daily?.et0_fao_evapotranspiration?.[idx] !== undefined
          ? Number((raw.daily.et0_fao_evapotranspiration[idx] ?? 0).toFixed(1))
          : null,
      weatherDescription: wmoCodeToText(raw.daily?.weather_code?.[idx]),
    }));

    const historicalDays = allDaily
      .filter((d) => d.date < todayStr)
      .map((d) => ({
        date: d.date,
        precipitationMm: d.precipitationMm,
        tempMaxC: d.tempMaxC,
        tempMinC: d.tempMinC,
      }));
    const forecastDaily = allDaily.filter((d) => d.date >= todayStr).slice(0, 7);

    const past30DaysMm = Number(
      historicalDays.reduce((s, d) => s + d.precipitationMm, 0).toFixed(1)
    );
    const past14DaysMm = Number(
      historicalDays
        .slice(-14)
        .reduce((s, d) => s + d.precipitationMm, 0)
        .toFixed(1)
    );

    const nowHourSast = getSastIsoMinute().slice(0, 13);
    const hourlyStartIdx = Math.max(
      0,
      (raw.hourly?.time || []).findIndex((t) => t.slice(0, 13) >= nowHourSast)
    );
    const hourly = (raw.hourly?.time || [])
      .slice(hourlyStartIdx, hourlyStartIdx + 24)
      .map((time, offset) => {
        const idx = hourlyStartIdx + offset;
        return {
          time,
          temperatureC: Number((raw.hourly?.temperature_2m?.[idx] ?? 0).toFixed(1)),
          precipitationMm: Number((raw.hourly?.precipitation?.[idx] ?? 0).toFixed(1)),
          precipProbabilityPercent:
            raw.hourly?.precipitation_probability?.[idx] !== undefined &&
            raw.hourly?.precipitation_probability?.[idx] !== null
              ? Number(raw.hourly.precipitation_probability[idx])
              : null,
          windSpeedKmh: Number((raw.hourly?.wind_speed_10m?.[idx] ?? 0).toFixed(1)),
          humidityPercent:
            raw.hourly?.relative_humidity_2m?.[idx] !== undefined
              ? Number(raw.hourly.relative_humidity_2m[idx])
              : null,
        };
      });

    const current: WeatherIntelligencePayload['current'] = raw.current
      ? {
          temperatureC:
            raw.current.temperature_2m !== undefined ? Number(raw.current.temperature_2m.toFixed(1)) : null,
          apparentTempC:
            raw.current.apparent_temperature !== undefined
              ? Number(raw.current.apparent_temperature.toFixed(1))
              : null,
          humidityPercent:
            raw.current.relative_humidity_2m !== undefined ? raw.current.relative_humidity_2m : null,
          windSpeedKmh:
            raw.current.wind_speed_10m !== undefined ? Number(raw.current.wind_speed_10m.toFixed(1)) : null,
          windGustsKmh:
            raw.current.wind_gusts_10m !== undefined ? Number(raw.current.wind_gusts_10m.toFixed(1)) : null,
          windDirectionDeg:
            raw.current.wind_direction_10m !== undefined ? raw.current.wind_direction_10m : null,
          precipitationMm:
            raw.current.precipitation !== undefined ? Number(raw.current.precipitation.toFixed(1)) : null,
          weatherDescription: wmoCodeToText(raw.current.weather_code),
        }
      : null;

    const derived = deriveAgriculturalWarnings({
      farm,
      location,
      fields,
      crops,
      livestock,
      current,
      hourly,
      daily: forecastDaily,
      past14DaysMm,
      past30DaysMm,
    });

    const payload: WeatherIntelligencePayload = {
      farmId: farm.id,
      farmName: farm.name,
      locationLabel,
      coordinates: { latitude: location.latitude, longitude: location.longitude },
      serviceAvailable: true,
      unavailableReason: null,
      source: 'Open-Meteo Coordinate Weather & Historical Archive API',
      sawsIntegrationStatus: getSawsStatusLabel(),
      lastUpdated: new Date().toISOString(),
      isCachedFallback: false,
      current,
      hourly,
      daily: forecastDaily,
      historicalRainfall: {
        past14DaysMm,
        past30DaysMm,
        seasonalClimateNote,
        historicalDays,
      },
      nasaPower,
      nasaClimateComparison,
      seasonalCalendar,
      operationsWindow: derived.operationsWindow,
      warnings: derived.warnings,
    };

    WEATHER_CACHE.set(cacheKey, { timestampMs: Date.now(), payload });
    return payload;
  } catch (err: unknown) {
    const [nasaPower, nasaClimateComparison] = await Promise.all([
      nasaPowerPromise,
      nasaClimatePromise,
    ]);
    if (cached) {
      return {
        ...cached.payload,
        nasaPower: nasaPower.serviceAvailable ? nasaPower : cached.payload.nasaPower,
        nasaClimateComparison: nasaClimateComparison.serviceAvailable
          ? nasaClimateComparison
          : cached.payload.nasaClimateComparison,
        seasonalCalendar,
        isCachedFallback: true,
        unavailableReason: `Live weather refresh failed (${err instanceof Error ? err.message : 'network error'}). Showing last verified observation from ${new Date(cached.payload.lastUpdated || '').toLocaleString()}.`,
      };
    }

    return {
      farmId: farm.id,
      farmName: farm.name,
      locationLabel,
      coordinates: { latitude: location.latitude, longitude: location.longitude },
      serviceAvailable: false,
      unavailableReason: `Live weather service is currently unreachable (${err instanceof Error ? err.message : 'offline'}). No synthetic forecasts are generated.`,
      source: 'Seasonal Provincial Climate Reference Only (Live Feed Unavailable)',
      sawsIntegrationStatus: getSawsStatusLabel(),
      lastUpdated: null,
      isCachedFallback: false,
      current: null,
      hourly: [],
      daily: [],
      historicalRainfall: {
        past14DaysMm: null,
        past30DaysMm: null,
        seasonalClimateNote,
        historicalDays: [],
      },
      nasaPower,
      nasaClimateComparison,
      seasonalCalendar,
      operationsWindow: {
        sprayingStatus: 'Unknown',
        sprayingReason: 'Live wind and precipitation telemetry unavailable — check local wind conditions before spraying.',
        plantingStatus: 'Unknown',
        plantingReason: 'Live 7-day forecast unavailable — verify local soil moisture manually before seeding.',
        irrigationStatus: 'Unknown',
        irrigationReason: 'Live evapotranspiration and rainfall forecast unavailable — inspect soil profile by hand.',
      },
      warnings: [],
    };
  }
}

export async function getSiteWeatherIntelligence(params: {
  province: string;
  district?: string;
  townOrArea?: string;
  latitude?: number;
  longitude?: number;
  siteName?: string;
  waterAvailability?: string;
}): Promise<WeatherIntelligencePayload> {
  const prov =
    SOUTH_AFRICA_PROVINCES.find((p) => p.name === params.province) ||
    SOUTH_AFRICA_PROVINCES[0];
  const lat =
    typeof params.latitude === 'number' && Number.isFinite(params.latitude)
      ? params.latitude
      : prov.centerLat;
  const lng =
    typeof params.longitude === 'number' && Number.isFinite(params.longitude)
      ? params.longitude
      : prov.centerLng;
  const label = [params.townOrArea || prov.capital, params.district, prov.name]
    .filter(Boolean)
    .join(', ');
  const siteId = `site-${prov.code}`;
  const siteName = params.siteName || `${prov.name} Candidate Site`;
  const syntheticFarm: Farm = {
    id: siteId,
    ownerId: 'site-preview',
    name: siteName,
    farmingActivities: ['Mixed Planning'],
    farmSizeHectares: 5,
    yearsOfExperience: 0,
    waterAvailability: params.waterAvailability || 'Candidate Site Water Check',
    existingCrops: [],
    existingLivestock: [],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const syntheticLocation: FarmLocation = {
    id: `loc-${siteId}`,
    farmId: siteId,
    province: prov.name,
    districtMunicipality: params.district || prov.districts[0] || prov.capital,
    localMunicipality: params.townOrArea || prov.capital,
    townOrVillage: params.townOrArea || prov.capital,
    latitude: lat,
    longitude: lng,
    locationSource: 'municipal_center',
    gpsLatitude: null,
    gpsLongitude: null,
    gpsAccuracyMeters: null,
    gpsCapturedAt: null,
    centroidWkt: `POINT(${lng} ${lat})`,
    elevationMeters: 1100,
  };

  const seasonalClimateNote = `${prov.climateZone} · Typical annual rainfall ${prov.annualRainfallMm}`;
  const seasonalCalendar = getSaSeasonalGuidance(prov.name, getSastMonth());
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lng)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration` +
    `&past_days=30&forecast_days=7&timezone=Africa%2FJohannesburg`;

  const nasaPowerPromise = fetchNasaPowerSummary(lat, lng);
  const nasaClimatePromise = fetchNasaPowerClimateComparison(lat, lng, {
    province: prov.name,
    locationLabel: label,
    waterAvailability: params.waterAvailability,
    primaryCrops: prov.keyCommodities.slice(0, 3),
  });

  try {
    const [response, nasaPower, nasaClimateComparison] = await Promise.all([
      fetch(url, { signal: AbortSignal.timeout(7000) }),
      nasaPowerPromise,
      nasaClimatePromise,
    ]);
    if (!response.ok) {
      throw new Error(`Weather API responded with HTTP ${response.status}`);
    }
    const raw = (await response.json()) as {
      current?: Record<string, number | undefined>;
      hourly?: {
        time: string[];
        temperature_2m: number[];
        relative_humidity_2m?: number[];
        precipitation: number[];
        precipitation_probability?: number[];
        wind_speed_10m: number[];
      };
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        precipitation_probability_max?: number[];
        wind_speed_10m_max: number[];
        et0_fao_evapotranspiration?: number[];
      };
    };

    const todayStr = getSastDateString();
    const allDaily = (raw.daily?.time || []).map((date, idx) => ({
      date,
      tempMaxC: Number((raw.daily?.temperature_2m_max?.[idx] ?? 0).toFixed(1)),
      tempMinC: Number((raw.daily?.temperature_2m_min?.[idx] ?? 0).toFixed(1)),
      precipitationMm: Number((raw.daily?.precipitation_sum?.[idx] ?? 0).toFixed(1)),
      precipProbabilityPercent:
        raw.daily?.precipitation_probability_max?.[idx] !== undefined &&
        raw.daily?.precipitation_probability_max?.[idx] !== null
          ? Number(raw.daily.precipitation_probability_max[idx])
          : null,
      windMaxKmh: Number((raw.daily?.wind_speed_10m_max?.[idx] ?? 0).toFixed(1)),
      et0EvapotranspirationMm:
        raw.daily?.et0_fao_evapotranspiration?.[idx] !== undefined
          ? Number((raw.daily.et0_fao_evapotranspiration[idx] ?? 0).toFixed(1))
          : null,
      weatherDescription: wmoCodeToText(raw.daily?.weather_code?.[idx]),
    }));

    const historicalDays = allDaily
      .filter((d) => d.date < todayStr)
      .map((d) => ({
        date: d.date,
        precipitationMm: d.precipitationMm,
        tempMaxC: d.tempMaxC,
        tempMinC: d.tempMinC,
      }));
    const forecastDaily = allDaily.filter((d) => d.date >= todayStr).slice(0, 7);
    const past30DaysMm = Number(
      historicalDays.reduce((s, d) => s + d.precipitationMm, 0).toFixed(1)
    );
    const past14DaysMm = Number(
      historicalDays
        .slice(-14)
        .reduce((s, d) => s + d.precipitationMm, 0)
        .toFixed(1)
    );
    const nowHourSast = getSastIsoMinute().slice(0, 13);
    const hourlyStartIdx = Math.max(
      0,
      (raw.hourly?.time || []).findIndex((t) => t.slice(0, 13) >= nowHourSast)
    );
    const hourly = (raw.hourly?.time || [])
      .slice(hourlyStartIdx, hourlyStartIdx + 24)
      .map((time, offset) => {
        const idx = hourlyStartIdx + offset;
        return {
          time,
          temperatureC: Number((raw.hourly?.temperature_2m?.[idx] ?? 0).toFixed(1)),
          precipitationMm: Number((raw.hourly?.precipitation?.[idx] ?? 0).toFixed(1)),
          precipProbabilityPercent:
            raw.hourly?.precipitation_probability?.[idx] !== undefined &&
            raw.hourly?.precipitation_probability?.[idx] !== null
              ? Number(raw.hourly.precipitation_probability[idx])
              : null,
          windSpeedKmh: Number((raw.hourly?.wind_speed_10m?.[idx] ?? 0).toFixed(1)),
          humidityPercent:
            raw.hourly?.relative_humidity_2m?.[idx] !== undefined
              ? Number(raw.hourly.relative_humidity_2m[idx])
              : null,
        };
      });

    const current: WeatherIntelligencePayload['current'] = raw.current
      ? {
          temperatureC:
            raw.current.temperature_2m !== undefined ? Number(raw.current.temperature_2m.toFixed(1)) : null,
          apparentTempC:
            raw.current.apparent_temperature !== undefined
              ? Number(raw.current.apparent_temperature.toFixed(1))
              : null,
          humidityPercent:
            raw.current.relative_humidity_2m !== undefined ? raw.current.relative_humidity_2m : null,
          windSpeedKmh:
            raw.current.wind_speed_10m !== undefined ? Number(raw.current.wind_speed_10m.toFixed(1)) : null,
          windGustsKmh:
            raw.current.wind_gusts_10m !== undefined ? Number(raw.current.wind_gusts_10m.toFixed(1)) : null,
          windDirectionDeg:
            raw.current.wind_direction_10m !== undefined ? raw.current.wind_direction_10m : null,
          precipitationMm:
            raw.current.precipitation !== undefined ? Number(raw.current.precipitation.toFixed(1)) : null,
          weatherDescription: wmoCodeToText(raw.current.weather_code),
        }
      : null;

    const derived = deriveAgriculturalWarnings({
      farm: syntheticFarm,
      location: syntheticLocation,
      fields: [],
      crops: [],
      livestock: [],
      current,
      hourly,
      daily: forecastDaily,
      past14DaysMm,
      past30DaysMm,
    });

    return {
      farmId: siteId,
      farmName: siteName,
      locationLabel: label,
      coordinates: { latitude: lat, longitude: lng },
      serviceAvailable: true,
      unavailableReason: null,
      source: 'Open-Meteo Coordinate Weather & NASA POWER Agroclimatology API',
      sawsIntegrationStatus: getSawsStatusLabel(),
      lastUpdated: new Date().toISOString(),
      isCachedFallback: false,
      current,
      hourly,
      daily: forecastDaily,
      historicalRainfall: {
        past14DaysMm,
        past30DaysMm,
        seasonalClimateNote,
        historicalDays,
      },
      nasaPower,
      nasaClimateComparison,
      seasonalCalendar,
      operationsWindow: derived.operationsWindow,
      warnings: derived.warnings,
    };
  } catch (err: unknown) {
    const [nasaPower, nasaClimateComparison] = await Promise.all([
      nasaPowerPromise,
      nasaClimatePromise,
    ]);
    return {
      farmId: siteId,
      farmName: siteName,
      locationLabel: label,
      coordinates: { latitude: lat, longitude: lng },
      serviceAvailable: false,
      unavailableReason: `Live site weather service is currently unreachable (${err instanceof Error ? err.message : 'offline'}). No synthetic forecasts are generated.`,
      source: 'Seasonal Provincial Climate Reference Only (Live Feed Unavailable)',
      sawsIntegrationStatus: getSawsStatusLabel(),
      lastUpdated: null,
      isCachedFallback: false,
      current: null,
      hourly: [],
      daily: [],
      historicalRainfall: {
        past14DaysMm: null,
        past30DaysMm: null,
        seasonalClimateNote,
        historicalDays: [],
      },
      nasaPower,
      nasaClimateComparison,
      seasonalCalendar,
      operationsWindow: {
        sprayingStatus: 'Unknown',
        sprayingReason: 'Live wind and precipitation telemetry unavailable.',
        plantingStatus: 'Unknown',
        plantingReason: 'Live 7-day forecast unavailable.',
        irrigationStatus: 'Unknown',
        irrigationReason: 'Live evapotranspiration forecast unavailable.',
      },
      warnings: [],
    };
  }
}
