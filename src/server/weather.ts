import { SOUTH_AFRICA_PROVINCES } from './southAfricaData.ts';
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
  return 'SAWS Adapter Ready (Using Live Open-Meteo WMO Coordinate Feed; set SAWS_API_KEY for official SAWS CAP alert stream)';
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

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
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

    const todayStr = new Date().toISOString().slice(0, 10);
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

    const nowHourIso = new Date().toISOString().slice(0, 13);
    const hourlyStartIdx = Math.max(
      0,
      (raw.hourly?.time || []).findIndex((t) => t.slice(0, 13) >= nowHourIso)
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
      operationsWindow: derived.operationsWindow,
      warnings: derived.warnings,
    };

    WEATHER_CACHE.set(cacheKey, { timestampMs: Date.now(), payload });
    return payload;
  } catch (err: unknown) {
    if (cached) {
      return {
        ...cached.payload,
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
