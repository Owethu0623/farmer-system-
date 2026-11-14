import { getSastDateString, getSastIsoMinute, getSastMonth } from './saTime.ts';
import { getSaSeasonalGuidance, SOUTH_AFRICA_PROVINCES } from './southAfricaData.ts';
import { store } from './store.ts';
import { CropRecord, Farm, FarmLocation, Field, LivestockGroup } from './types.ts';
import {
  ClimateProjectionStatus,
  MonthlyClimatePoint,
  AnnualClimatePoint,
  NasaClimateComparisonData,
  NasaParameterMetadata,
  NasaPowerSummaryData,
  getNasaClimateProjectionsStatus,
  getNasaDailyEnvironmentalSummary,
  getNasaMultiYearClimateComparison,
} from './nasaPowerService.ts';

export type {
  NasaParameterMetadata,
  MonthlyClimatePoint,
  AnnualClimatePoint,
};

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
    past60DaysMm: number | null;
    longestDrySpellDays60d: number | null;
    currentDrySpellDays: number | null;
    hotDays32cCount60d: number | null;
    hotDays35cCount60d: number | null;
    frostRiskDays2cCount60d: number | null;
    frostDays0cCount60d: number | null;
    seasonalClimateNote: string;
    historicalDays: { date: string; precipitationMm: number; tempMaxC: number; tempMinC: number }[];
  };
  nasaPower?: NasaPowerSummaryData;
  nasaClimateComparison?: NasaClimateComparisonData;
  climateProjectionsStatus?: ClimateProjectionStatus;
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
const CACHE_TTL_MS = 15 * 60 * 1000;
const OPEN_METEO_BASE_URL = (
  process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1'
).replace(/\/+$/, '');

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
  return 'SAWS Adapter Ready (Using Live NASA POWER Agro-Met + Open-Meteo WMO Forecast Feeds; set SAWS_API_KEY for official SAWS CAP alert stream)';
}

function computeDrySpellAndExtremeCounts(
  days: { date: string; precipitationMm: number; tempMaxC: number; tempMinC: number }[]
) {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let longestDrySpell = 0;
  let runningDry = 0;
  for (const d of ordered) {
    if (d.precipitationMm < 1.0) {
      runningDry += 1;
      if (runningDry > longestDrySpell) longestDrySpell = runningDry;
    } else {
      runningDry = 0;
    }
  }
  let currentDrySpell = 0;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if (ordered[i].precipitationMm < 1.0) {
      currentDrySpell += 1;
    } else {
      break;
    }
  }
  const hotDays32 = ordered.filter((d) => d.tempMaxC >= 32).length;
  const hotDays35 = ordered.filter((d) => d.tempMaxC >= 35).length;
  const frostDays2 = ordered.filter((d) => d.tempMinC <= 2).length;
  const frostDays0 = ordered.filter((d) => d.tempMinC <= 0).length;

  return {
    longestDrySpell,
    currentDrySpell,
    hotDays32,
    hotDays35,
    frostDays2,
    frostDays0,
  };
}

export async function fetchNasaPowerSummary(
  latitude: number,
  longitude: number,
  requestId?: string
): Promise<NasaPowerSummaryData> {
  return getNasaDailyEnvironmentalSummary(latitude, longitude, requestId);
}

export async function fetchNasaPowerClimateComparison(
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
  return getNasaMultiYearClimateComparison(latitude, longitude, context, requestId);
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
  const hasClayFields = fields.some(
    (f) =>
      f.soilType.toLowerCase().includes('clay') ||
      (f.soilTexture || '').toLowerCase().includes('clay')
  );

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

  if (maxDayTemp >= 32) {
    warnings.push({
      id: 'warn-heat',
      category: 'extreme_heat',
      severity: maxDayTemp >= 36 ? 'High' : 'Moderate',
      title: maxDayTemp >= 36 ? 'Extreme Heat Stress Warning' : 'High Temperature & Evaporation Advisory',
      whatIsHappening: `Forecast daytime highs reach ${maxDayTemp}°C at ${farmLabel}.`,
      affectedFarm: `${farmLabel} — flowering crops, nursery seedlings, poultry houses, and open grazing herds.`,
      possibleImpact:
        'Pollen sterility in maize/tomatoes, blossom drop in beans, rapid soil moisture loss, and heat stress in poultry and dairy stock.',
      recommendedPrecautions: [
        'Irrigate early morning (05:00–08:30) or late afternoon to avoid evaporative losses and leaf scald.',
        'Open poultry shed curtains/ventilation and keep clean cool drinking troughs shaded and full.',
        'Avoid transplanting seedlings or applying foliar chemicals during peak midday heat.',
      ],
    });
  }

  if (minDayTemp <= 3) {
    warnings.push({
      id: 'warn-frost',
      category: 'frost',
      severity: minDayTemp <= 0 ? 'High' : 'Moderate',
      title: minDayTemp <= 0 ? 'Frost Warning (Sub-Zero Night Temperatures)' : 'Cold Night / Light Frost Risk',
      whatIsHappening: `Minimum overnight temperatures forecast to drop to ${minDayTemp}°C at ${farmLabel}.`,
      affectedFarm: `${farmLabel} — frost-sensitive crops (tomatoes, peppers, subtropical seedlings) and newborn lambs/kids.`,
      possibleImpact: 'Cellular frost burn on tender leaves/blossoms and hypothermia in exposed young stock.',
      recommendedPrecautions: [
        'Cover sensitive vegetable beds or nursery tunnels before sunset with frost fleece.',
        'Run light evening overhead misting only if frost-protection design permits; otherwise keep soil lightly damp to radiate heat.',
        'Shelter lambs, kids, calves, and poultry in windproof dry bedding overnight.',
      ],
    });
  }

  const currentWind = current?.windSpeedKmh ?? 0;
  if (maxWind >= 35 || currentWind >= 28) {
    warnings.push({
      id: 'warn-wind',
      category: 'strong_wind',
      severity: maxWind >= 50 ? 'High' : 'Moderate',
      title: 'Strong Wind & Spray Drift Advisory',
      whatIsHappening: `Wind speeds forecast up to ${maxWind} km/h (current ${currentWind} km/h) at ${farmLabel}.`,
      affectedFarm: `${farmLabel} — chemical spraying blocks, shade-net structures, and tall crops.`,
      possibleImpact:
        'Severe chemical drift onto neighbouring crops, lodging of mature maize/sunflower, and structural damage to shade nets.',
      recommendedPrecautions: [
        'Suspend all boom and knapsack spraying whenever wind exceeds 15 km/h.',
        'Inspect trellises, shade-net tension wires, and polytunnel doors.',
      ],
    });
  }

  let sprayingStatus: 'Suitable' | 'Caution' | 'Avoid' = 'Suitable';
  let sprayingReason = 'Light winds and low immediate rain allow controlled spraying.';
  if (currentWind > 18 || maxWind > 28 || next6HoursRain >= 2) {
    sprayingStatus = 'Avoid';
    sprayingReason =
      next6HoursRain >= 2
        ? `Rain (${next6HoursRain} mm) expected within 6 hours — high chemical wash-off risk.`
        : `Wind too strong (current ${currentWind} km/h, gusts higher) — spray drift hazard.`;
    warnings.push({
      id: 'warn-spray',
      category: 'spraying',
      severity: 'Advisory',
      title: 'Unsuitable Conditions for Chemical Spraying',
      whatIsHappening: sprayingReason,
      affectedFarm: `${farmLabel} — crop protection activities.`,
      possibleImpact: 'Wasted chemical input, off-target crop scorch, or polluted runoff.',
      recommendedPrecautions: ['Reschedule spraying for calm early morning hours (<12 km/h wind, dry canopy).'],
    });
  } else if (currentWind > 12 || (current?.temperatureC ?? 20) >= 30) {
    sprayingStatus = 'Caution';
    sprayingReason = 'Moderate breeze or warm air — spray only early morning using coarse drift-reducing nozzles.';
  }

  let plantingStatus: 'Suitable' | 'Caution' | 'Avoid' = 'Suitable';
  let plantingReason = 'Temperature and rainfall outlook are workable for field planting and transplanting.';
  if (maxDayRain >= 40 || minDayTemp <= 1 || maxDayTemp >= 35) {
    plantingStatus = 'Avoid';
    plantingReason =
      maxDayRain >= 40
        ? `Heavy rainfall (${maxDayRain} mm/day) risks washing out seedbeds and sealing soil.`
        : minDayTemp <= 1
        ? `Near-freezing nights (${minDayTemp}°C) endanger emerging seedlings.`
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

function parseOpenMeteoResponse(raw: {
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
}) {
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

  const past60DaysMm = Number(
    historicalDays.slice(-60).reduce((s, d) => s + d.precipitationMm, 0).toFixed(1)
  );
  const past30DaysMm = Number(
    historicalDays.slice(-30).reduce((s, d) => s + d.precipitationMm, 0).toFixed(1)
  );
  const past14DaysMm = Number(
    historicalDays.slice(-14).reduce((s, d) => s + d.precipitationMm, 0).toFixed(1)
  );
  const extremes = computeDrySpellAndExtremeCounts(historicalDays.slice(-60));

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

  return {
    historicalDays,
    forecastDaily,
    past60DaysMm,
    past30DaysMm,
    past14DaysMm,
    extremes,
    hourly,
    current,
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
    `${OPEN_METEO_BASE_URL}/forecast` +
    `?latitude=${encodeURIComponent(location.latitude)}` +
    `&longitude=${encodeURIComponent(location.longitude)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration` +
    `&past_days=61&forecast_days=7&timezone=Africa%2FJohannesburg`;

  const seasonalCalendar = getSaSeasonalGuidance(location.province, getSastMonth());
  const climateProjectionsStatus = getNasaClimateProjectionsStatus();
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
    const raw = await response.json();
    const parsed = parseOpenMeteoResponse(raw);

    const derived = deriveAgriculturalWarnings({
      farm,
      location,
      fields,
      crops,
      livestock,
      current: parsed.current,
      hourly: parsed.hourly,
      daily: parsed.forecastDaily,
      past14DaysMm: parsed.past14DaysMm,
      past30DaysMm: parsed.past30DaysMm,
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
      current: parsed.current,
      hourly: parsed.hourly,
      daily: parsed.forecastDaily,
      historicalRainfall: {
        past14DaysMm: parsed.past14DaysMm,
        past30DaysMm: parsed.past30DaysMm,
        past60DaysMm: parsed.past60DaysMm,
        longestDrySpellDays60d: parsed.extremes.longestDrySpell,
        currentDrySpellDays: parsed.extremes.currentDrySpell,
        hotDays32cCount60d: parsed.extremes.hotDays32,
        hotDays35cCount60d: parsed.extremes.hotDays35,
        frostRiskDays2cCount60d: parsed.extremes.frostDays2,
        frostDays0cCount60d: parsed.extremes.frostDays0,
        seasonalClimateNote,
        historicalDays: parsed.historicalDays,
      },
      nasaPower,
      nasaClimateComparison,
      climateProjectionsStatus,
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
        climateProjectionsStatus,
        seasonalCalendar,
        isCachedFallback: true,
        unavailableReason: `Live weather refresh failed (${err instanceof Error ? err.message : 'network error'}). Showing last verified observation from ${new Date(cached.payload.lastUpdated || '').toLocaleString('en-ZA')}.`,
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
        past60DaysMm: null,
        longestDrySpellDays60d: null,
        currentDrySpellDays: null,
        hotDays32cCount60d: null,
        hotDays35cCount60d: null,
        frostRiskDays2cCount60d: null,
        frostDays0cCount60d: null,
        seasonalClimateNote,
        historicalDays: [],
      },
      nasaPower,
      nasaClimateComparison,
      climateProjectionsStatus,
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
    districtMunicipality: params.district || prov.districts[0]?.name || prov.capital,
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
  const climateProjectionsStatus = getNasaClimateProjectionsStatus();
  const url =
    `${OPEN_METEO_BASE_URL}/forecast` +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lng)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration` +
    `&past_days=61&forecast_days=7&timezone=Africa%2FJohannesburg`;

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
    const raw = await response.json();
    const parsed = parseOpenMeteoResponse(raw);

    const derived = deriveAgriculturalWarnings({
      farm: syntheticFarm,
      location: syntheticLocation,
      fields: [],
      crops: [],
      livestock: [],
      current: parsed.current,
      hourly: parsed.hourly,
      daily: parsed.forecastDaily,
      past14DaysMm: parsed.past14DaysMm,
      past30DaysMm: parsed.past30DaysMm,
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
      current: parsed.current,
      hourly: parsed.hourly,
      daily: parsed.forecastDaily,
      historicalRainfall: {
        past14DaysMm: parsed.past14DaysMm,
        past30DaysMm: parsed.past30DaysMm,
        past60DaysMm: parsed.past60DaysMm,
        longestDrySpellDays60d: parsed.extremes.longestDrySpell,
        currentDrySpellDays: parsed.extremes.currentDrySpell,
        hotDays32cCount60d: parsed.extremes.hotDays32,
        hotDays35cCount60d: parsed.extremes.hotDays35,
        frostRiskDays2cCount60d: parsed.extremes.frostDays2,
        frostDays0cCount60d: parsed.extremes.frostDays0,
        seasonalClimateNote,
        historicalDays: parsed.historicalDays,
      },
      nasaPower,
      nasaClimateComparison,
      climateProjectionsStatus,
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
        past60DaysMm: null,
        longestDrySpellDays60d: null,
        currentDrySpellDays: null,
        hotDays32cCount60d: null,
        hotDays35cCount60d: null,
        frostRiskDays2cCount60d: null,
        frostDays0cCount60d: null,
        seasonalClimateNote,
        historicalDays: [],
      },
      nasaPower,
      nasaClimateComparison,
      climateProjectionsStatus,
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

export { fetchNasaPowerSummary };
