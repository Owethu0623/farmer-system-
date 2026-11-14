import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { store } from './store.ts';
import {
  FarmerWeatherObservation,
  LanguageCode,
  RainfallIntensity,
  SanitizedUser,
  WeatherForecastRecord,
  WindObservationLevel,
} from './types.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 15000,
      retryOptions: { attempts: 1 },
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
}

function getVerifiedStationConfig(): { connected: boolean; stationName: string | null; note: string } {
  if (process.env.SAWS_API_KEY && process.env.SAWS_API_URL) {
    return {
      connected: true,
      stationName: 'SAWS Regional Synoptic Station Feed',
      note: 'Verified South African Weather Service (SAWS) synoptic measurements connected.',
    };
  }
  return {
    connected: false,
    stationName: null,
    note: 'No verified physical weather-station feed (SAWS synoptic station) is currently connected for this farm. Open-Meteo coordinate forecasts/reanalysis and farmer-reported observations are displayed separately and never merged into verified station data.',
  };
}

export function recordForecastSnapshots(params: {
  farmId: string;
  sourceName: string;
  daily: {
    date: string;
    tempMaxC: number;
    tempMinC: number;
    precipitationMm: number;
    windMaxKmh: number;
    weatherDescription: string;
  }[];
  historicalDays: {
    date: string;
    precipitationMm: number;
    tempMaxC: number;
    tempMinC: number;
  }[];
}): void {
  const now = new Date().toISOString();
  const hasSaws = Boolean(process.env.SAWS_API_KEY && process.env.SAWS_API_URL);

  const combinedDays = [
    ...params.historicalDays.slice(-14).map((h) => ({
      date: h.date,
      precipitationMm: h.precipitationMm,
      tempMinC: h.tempMinC,
      tempMaxC: h.tempMaxC,
      windMaxKmh: 0,
      weatherDescription: h.precipitationMm > 0 ? 'Coordinate archive rainfall day' : 'Dry archive day',
    })),
    ...params.daily.map((d) => ({
      date: d.date,
      precipitationMm: d.precipitationMm,
      tempMinC: d.tempMinC,
      tempMaxC: d.tempMaxC,
      windMaxKmh: d.windMaxKmh,
      weatherDescription: d.weatherDescription,
    })),
  ];

  let changed = false;
  for (const day of combinedDays) {
    const existing = store.db.weatherForecastRecords.find(
      (r) => r.farmId === params.farmId && r.forecastDate === day.date
    );
    if (existing) {
      // Keep original snapshot if already locked for historical comparisons; update only today/future forecasts
      const todayIso = now.slice(0, 10);
      if (day.date >= todayIso) {
        existing.fetchedAt = now;
        existing.sourceName = params.sourceName;
        existing.predictedRainfallMm = day.precipitationMm;
        existing.predictedTempMinC = day.tempMinC;
        existing.predictedTempMaxC = day.tempMaxC;
        if (day.windMaxKmh > 0) existing.predictedWindMaxKmh = day.windMaxKmh;
        existing.weatherDescription = day.weatherDescription;
        changed = true;
      }
    } else {
      const record: WeatherForecastRecord = {
        id: `wfc-${crypto.randomUUID()}`,
        farmId: params.farmId,
        forecastDate: day.date,
        fetchedAt: now,
        sourceName: params.sourceName,
        sourceCategory: 'forecast_information',
        verifiedStationName: hasSaws ? 'SAWS Synoptic Network' : null,
        verifiedStationRainMm: null,
        verifiedStationTempC: null,
        predictedRainfallMm: day.precipitationMm,
        predictedTempMinC: day.tempMinC,
        predictedTempMaxC: day.tempMaxC,
        predictedWindMaxKmh: day.windMaxKmh,
        weatherDescription: day.weatherDescription,
      };
      store.db.weatherForecastRecords.unshift(record);
      changed = true;
    }
  }

  // Keep recent 120 records per farm to avoid unbounded growth
  if (store.db.weatherForecastRecords.length > 600) {
    store.db.weatherForecastRecords = store.db.weatherForecastRecords
      .sort((a, b) => b.forecastDate.localeCompare(a.forecastDate))
      .slice(0, 600);
    changed = true;
  }

  if (changed) {
    store.save();
  }
}

function evaluateObservationQc(input: {
  rainfallOccurred: boolean;
  rainfallIntensity: RainfallIntensity;
  measuredRainfallMm: number | null;
  temperatureC: number | null;
  windSpeedEstimateKmh: number | null;
}): { qcStatus: FarmerWeatherObservation['qcStatus']; qcNotes: string } {
  const issues: string[] = [];

  if (input.measuredRainfallMm !== null) {
    if (input.measuredRainfallMm < 0 || input.measuredRainfallMm > 500) {
      issues.push('Rainfall reading outside plausible daily range (0–500 mm).');
    } else if (input.measuredRainfallMm > 150) {
      issues.push('Extreme rainfall reading (>150 mm) flagged for manual quality review.');
    }
    if (!input.rainfallOccurred && input.measuredRainfallMm > 0.5) {
      issues.push('Marked "No rainfall occurred" while entering >0.5 mm measured rainfall.');
    }
    if (input.rainfallOccurred && input.rainfallIntensity === 'none' && input.measuredRainfallMm > 0) {
      issues.push('Rainfall intensity marked "none" despite positive rainfall amount.');
    }
  }

  if (input.temperatureC !== null && (input.temperatureC < -15 || input.temperatureC > 52)) {
    issues.push('Temperature outside plausible South African ambient range (-15°C to 52°C).');
  }

  if (input.windSpeedEstimateKmh !== null && (input.windSpeedEstimateKmh < 0 || input.windSpeedEstimateKmh > 180)) {
    issues.push('Wind speed estimate outside plausible range (0–180 km/h).');
  }

  if (issues.length > 0) {
    return {
      qcStatus: 'qc_flagged_outlier',
      qcNotes: `Flagged during automated plausibility check: ${issues.join(' ')} Excluded from calibration reference until reviewed.`,
    };
  }

  return {
    qcStatus: 'qc_passed_reference',
    qcNotes:
      'Passed basic plausibility check as a farmer-reported observation. Not a verified weather-station measurement; retained only for potential quality-controlled calibration review.',
  };
}

function describeWindComparison(
  reported: WindObservationLevel,
  reportedKmh: number | null,
  forecastMaxKmh: number | null
): string {
  const labelMap: Record<WindObservationLevel, string> = {
    calm: 'Calm (0–5 km/h)',
    light_breeze: 'Light breeze (6–19 km/h)',
    moderate_wind: 'Moderate wind (20–34 km/h)',
    strong_wind: 'Strong wind (35–54 km/h)',
    gale: 'Gale / damaging wind (55+ km/h)',
  };
  if (forecastMaxKmh === null || forecastMaxKmh <= 0) {
    return `Farmer reported ${labelMap[reported]}${reportedKmh !== null ? ` (~${reportedKmh} km/h)` : ''}; no daily wind forecast stored for this date.`;
  }
  const repEst =
    reportedKmh ??
    (reported === 'calm'
      ? 3
      : reported === 'light_breeze'
      ? 12
      : reported === 'moderate_wind'
      ? 27
      : reported === 'strong_wind'
      ? 45
      : 65);
  const diff = Number((repEst - forecastMaxKmh).toFixed(1));
  const diffLabel = diff === 0 ? 'matches forecast' : diff > 0 ? `+${diff} km/h stronger` : `${diff} km/h calmer`;
  return `Reported ${labelMap[reported]} vs forecast max ${forecastMaxKmh} km/h (${diffLabel}).`;
}

export function submitFarmerWeatherObservation(params: {
  user: SanitizedUser;
  farmId: string;
  observationDate: string;
  rainfallOccurred: boolean;
  rainfallIntensity: RainfallIntensity;
  measuredRainfallMm: number | null;
  temperatureC: number | null;
  windObservation: WindObservationLevel;
  windSpeedEstimateKmh: number | null;
  notes: string;
}): FarmerWeatherObservation {
  const farm = store.db.farms.find((f) => f.id === params.farmId);
  const location = store.db.farmLocations.find((l) => l.farmId === params.farmId);
  if (!farm || !location) {
    throw new Error('Farm location record not found.');
  }

  const normalizedIntensity: RainfallIntensity = !params.rainfallOccurred ? 'none' : params.rainfallIntensity;
  const normalizedRainMm = !params.rainfallOccurred
    ? 0
    : params.measuredRainfallMm !== null && Number.isFinite(params.measuredRainfallMm)
    ? Number(params.measuredRainfallMm.toFixed(1))
    : null;

  const qc = evaluateObservationQc({
    rainfallOccurred: params.rainfallOccurred,
    rainfallIntensity: normalizedIntensity,
    measuredRainfallMm: normalizedRainMm,
    temperatureC: params.temperatureC,
    windSpeedEstimateKmh: params.windSpeedEstimateKmh,
  });

  const matchedForecast = store.db.weatherForecastRecords.find(
    (r) => r.farmId === params.farmId && r.forecastDate === params.observationDate
  );

  const now = new Date().toISOString();
  const obs: FarmerWeatherObservation = {
    id: `wobs-${crypto.randomUUID()}`,
    farmId: farm.id,
    ownerId: params.user.id,
    farmLocationLabel: `${location.townOrVillage}, ${location.localMunicipality}, ${location.province}`,
    latitude: location.latitude,
    longitude: location.longitude,
    observationDate: params.observationDate,
    rainfallOccurred: params.rainfallOccurred,
    rainfallIntensity: normalizedIntensity,
    measuredRainfallMm: normalizedRainMm,
    temperatureC:
      params.temperatureC !== null && Number.isFinite(params.temperatureC)
        ? Number(params.temperatureC.toFixed(1))
        : null,
    windObservation: params.windObservation,
    windSpeedEstimateKmh:
      params.windSpeedEstimateKmh !== null && Number.isFinite(params.windSpeedEstimateKmh)
        ? Number(params.windSpeedEstimateKmh.toFixed(1))
        : null,
    notes: params.notes.trim(),
    sourceCategory: 'farmer_reported_observation',
    qcStatus: qc.qcStatus,
    qcNotes: qc.qcNotes,
    comparedForecastRecordId: matchedForecast?.id || null,
    createdAt: now,
    updatedAt: now,
  };

  store.db.weatherObservations.unshift(obs);
  store.logAudit(
    params.user.id,
    'FARMER_WEATHER_OBSERVATION_LOGGED',
    'FarmerWeatherObservation',
    obs.id,
    {
      farmId: farm.id,
      observationDate: obs.observationDate,
      rainfallOccurred: obs.rainfallOccurred,
      measuredRainfallMm: obs.measuredRainfallMm,
      qcStatus: obs.qcStatus,
      sourceCategory: obs.sourceCategory,
    },
    '127.0.0.1'
  );
  store.save();

  return obs;
}

export function buildWeatherFeedbackOverview(farmId: string) {
  const farm = store.db.farms.find((f) => f.id === farmId);
  const location = store.db.farmLocations.find((l) => l.farmId === farmId);
  if (!farm || !location) {
    throw new Error('Farm not found.');
  }

  const farmLocationLabel = `${location.townOrVillage}, ${location.localMunicipality}, ${location.province}`;
  const forecastRecords = store.db.weatherForecastRecords
    .filter((r) => r.farmId === farmId)
    .sort((a, b) => b.forecastDate.localeCompare(a.forecastDate));

  const observations = store.db.weatherObservations
    .filter((o) => o.farmId === farmId)
    .sort((a, b) => b.observationDate.localeCompare(a.observationDate) || b.createdAt.localeCompare(a.createdAt));

  const stationStatus = getVerifiedStationConfig();

  const comparisons = observations.map((obs) => {
    const fc =
      forecastRecords.find((r) => r.id === obs.comparedForecastRecordId) ||
      forecastRecords.find((r) => r.forecastDate === obs.observationDate) ||
      null;

    const rainfallDiffMm =
      fc && obs.measuredRainfallMm !== null
        ? Number((obs.measuredRainfallMm - fc.predictedRainfallMm).toFixed(1))
        : null;

    let rainEventMatch: 'matched' | 'forecast_rain_not_observed' | 'unexpected_rain_observed' | 'no_forecast_record' =
      'no_forecast_record';
    if (fc) {
      const forecastHadRain = fc.predictedRainfallMm >= 1;
      if (forecastHadRain === obs.rainfallOccurred) {
        rainEventMatch = 'matched';
      } else if (forecastHadRain && !obs.rainfallOccurred) {
        rainEventMatch = 'forecast_rain_not_observed';
      } else {
        rainEventMatch = 'unexpected_rain_observed';
      }
    }

    const forecastMidTemp =
      fc ? Number(((fc.predictedTempMinC + fc.predictedTempMaxC) / 2).toFixed(1)) : null;
    const tempDiffC =
      forecastMidTemp !== null && obs.temperatureC !== null
        ? Number((obs.temperatureC - forecastMidTemp).toFixed(1))
        : null;

    return {
      observationId: obs.id,
      observationDate: obs.observationDate,
      farmLocationLabel: obs.farmLocationLabel,
      reportedRainfallOccurred: obs.rainfallOccurred,
      reportedIntensity: obs.rainfallIntensity,
      reportedRainfallMm: obs.measuredRainfallMm,
      reportedTemperatureC: obs.temperatureC,
      reportedWind: obs.windObservation,
      reportedWindEstimateKmh: obs.windSpeedEstimateKmh,
      qcStatus: obs.qcStatus,
      qcNotes: obs.qcNotes,
      forecastRecord: fc,
      verifiedStationAvailable: Boolean(fc?.verifiedStationRainMm !== null && fc?.verifiedStationRainMm !== undefined),
      verifiedStationRainMm: fc?.verifiedStationRainMm ?? null,
      verifiedStationTempC: fc?.verifiedStationTempC ?? null,
      rainfallDiffMm,
      rainEventMatch,
      tempDiffC,
      windComparisonNote: describeWindComparison(
        obs.windObservation,
        obs.windSpeedEstimateKmh,
        fc ? fc.predictedWindMaxKmh : null
      ),
    };
  });

  const rainDiffs = comparisons
    .map((c) => c.rainfallDiffMm)
    .filter((v): v is number => v !== null);
  const avgRainfallVarianceMm =
    rainDiffs.length > 0
      ? Number((rainDiffs.reduce((s, v) => s + v, 0) / rainDiffs.length).toFixed(1))
      : null;

  const matchedChecks = comparisons.filter((c) => c.rainEventMatch !== 'no_forecast_record');
  const rainAgreementRatePercent =
    matchedChecks.length > 0
      ? Math.round(
          (matchedChecks.filter((c) => c.rainEventMatch === 'matched').length / matchedChecks.length) *
            100
        )
      : null;

  const qcPassedCount = observations.filter((o) => o.qcStatus === 'qc_passed_reference').length;
  const flaggedOutliersCount = observations.filter((o) => o.qcStatus === 'qc_flagged_outlier').length;

  const narrativeParts: string[] = [];
  if (observations.length === 0) {
    narrativeParts.push(
      `No on-farm weather observations logged yet for ${farm.name}. Submit your first rain gauge or field observation below to compare actual farm conditions against stored coordinate forecasts.`
    );
  } else {
    narrativeParts.push(
      `${observations.length} farmer-reported observation(s) logged at ${farm.name} (${qcPassedCount} passed plausibility checks, ${flaggedOutliersCount} flagged for review).`
    );
    if (rainAgreementRatePercent !== null) {
      narrativeParts.push(
        `Forecast rain occurrence matched farm reports ${rainAgreementRatePercent}% of the time across ${matchedChecks.length} paired date(s).`
      );
    }
    if (avgRainfallVarianceMm !== null) {
      narrativeParts.push(
        `Average reported vs forecast rainfall difference is ${avgRainfallVarianceMm > 0 ? `+${avgRainfallVarianceMm}` : avgRainfallVarianceMm} mm.`
      );
    }
  }

  return {
    farmId: farm.id,
    farmName: farm.name,
    farmLocationLabel,
    verifiedStationStatus: stationStatus,
    calibrationPolicyNotice:
      'Governance & Calibration Policy: Farmer-reported observations are never automatically treated as verified weather-station measurements and never automatically retrain AI models. Only quality-controlled records may be reviewed for future regional model calibration.',
    forecastRecords: forecastRecords.slice(0, 30),
    observations,
    comparisons,
    summary: {
      sourceCategory: 'forecast_information' as const,
      poweredBy: 'deterministic_summary' as const,
      generatedAt: new Date().toISOString(),
      totalObservations: observations.length,
      qcPassedCount,
      flaggedOutliersCount,
      avgRainfallVarianceMm,
      rainAgreementRatePercent,
      narrative: narrativeParts.join(' '),
      caveats: [
        'Farmer reports reflect local microclimate conditions and manual gauges; they are labeled separately from official station telemetry.',
        'Coordinate forecasts represent gridded atmospheric model output and can differ from localized convective thunderstorms.',
      ],
    },
  };
}

export async function generateAiLocalWeatherSummary(params: {
  farmId: string;
  languageCode: LanguageCode;
}) {
  const overview = buildWeatherFeedbackOverview(params.farmId);
  const ai = getGeminiClient();
  const lang = store.db.languages.find((l) => l.code === params.languageCode);
  const languageName = lang ? `${lang.name} (${lang.nativeName})` : 'English';

  if (!ai || overview.observations.length === 0) {
    return {
      ...overview.summary,
      sourceCategory: 'ai_generated_estimate' as const,
      poweredBy: 'deterministic_summary' as const,
      generatedAt: new Date().toISOString(),
      narrative:
        overview.observations.length === 0
          ? `Submit at least one on-farm observation at ${overview.farmName} to generate a paired local weather comparison summary.`
          : overview.summary.narrative,
    };
  }

  const pairedText = overview.comparisons
    .slice(0, 10)
    .map((c) => {
      const fcStr = c.forecastRecord
        ? `Forecast ${c.forecastRecord.predictedRainfallMm}mm, ${c.forecastRecord.predictedTempMinC}-${c.forecastRecord.predictedTempMaxC}C, max wind ${c.forecastRecord.predictedWindMaxKmh}km/h`
        : 'No stored forecast';
      const obsStr = `Farmer reported rainOccurred=${c.reportedRainfallOccurred} (${c.reportedIntensity}), measured=${c.reportedRainfallMm ?? 'N/A'}mm, temp=${c.reportedTemperatureC ?? 'N/A'}C, wind=${c.reportedWind}, QC=${c.qcStatus}`;
      return `${c.observationDate}: ${obsStr} | ${fcStr} | Diff=${c.rainfallDiffMm ?? 'N/A'}mm (${c.rainEventMatch})`;
    })
    .join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: [
        `Generate a concise, practical local weather comparison summary in ${languageName} for farm "${overview.farmName}" (${overview.farmLocationLabel}).`,
        `Verified Station Status: ${overview.verifiedStationStatus.note}`,
        `Paired Observations vs Forecasts:\n${pairedText}`,
        `Rules: Explicitly distinguish forecast information from unverified farmer-reported observations. Never claim farmer reports are verified station data or retrain AI models. Keep to 3–5 clear sentences.`,
      ].join('\n\n'),
      config: {
        abortSignal: AbortSignal.timeout(15000),
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });
    const text = (response.text || '').trim();
    return {
      ...overview.summary,
      sourceCategory: 'ai_generated_estimate' as const,
      poweredBy: 'gemini' as const,
      generatedAt: new Date().toISOString(),
      narrative: text || overview.summary.narrative,
      caveats: [
        'AI-Generated Estimate: Synthesized from stored forecast records and unverified farmer reports for local planning insight only.',
        ...overview.summary.caveats,
      ],
    };
  } catch {
    return {
      ...overview.summary,
      sourceCategory: 'ai_generated_estimate' as const,
      poweredBy: 'deterministic_summary' as const,
      generatedAt: new Date().toISOString(),
    };
  }
}
