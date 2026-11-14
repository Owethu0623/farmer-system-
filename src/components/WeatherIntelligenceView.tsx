import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CloudRain,
  Droplets,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Sun,
  Thermometer,
  Wind,
  WifiOff,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { getSastDateString } from '../lib/saTime';
import {
  enqueueOfflineMutation,
  getOfflineStaleness,
  isLikelyOfflineError,
  loadOfflineBundle,
} from '../lib/offlineSync';
import {
  FarmItem,
  LanguageCode,
  LocalWeatherFeedbackOverview,
  RainfallIntensity,
  RoleCode,
  WeatherIntelligence,
  WindObservationLevel,
} from '../types';
import { SpeakButton } from './AccessibilityControls';

interface WeatherIntelligenceViewProps {
  userId?: string;
  farms: FarmItem[];
  selectedFarmId: string | null;
  onSelectFarm: (farmId: string) => void;
  languageCode: LanguageCode;
  userRoleCode?: RoleCode;
  isSpeaking: boolean;
  speechSupported: boolean;
  onSpeak: (txt: string) => void;
  onStopSpeaking: () => void;
}

export const WeatherIntelligenceView: React.FC<WeatherIntelligenceViewProps> = ({
  userId,
  farms,
  selectedFarmId,
  onSelectFarm,
  languageCode,
  userRoleCode,
  isSpeaking,
  speechSupported,
  onSpeak,
  onStopSpeaking,
}) => {
  const activeFarmId = selectedFarmId || farms[0]?.id || '';
  const activeFarm = farms.find((f) => f.id === activeFarmId) || farms[0] || null;

  const [activeSection, setActiveSection] = useState<'forecast' | 'feedback'>('forecast');
  const [weather, setWeather] = useState<WeatherIntelligence | null>(null);
  const [feedback, setFeedback] = useState<LocalWeatherFeedbackOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Observation Form State
  const [obsFormOpen, setObsFormOpen] = useState(false);
  const [obsSubmitting, setObsSubmitting] = useState(false);
  const [observationDate, setObservationDate] = useState(getSastDateString());
  const [rainfallOccurred, setRainfallOccurred] = useState(true);
  const [rainfallIntensity, setRainfallIntensity] = useState<RainfallIntensity>('moderate');
  const [measuredRainfallMm, setMeasuredRainfallMm] = useState('12');
  const [temperatureC, setTemperatureC] = useState('23');
  const [windObservation, setWindObservation] = useState<WindObservationLevel>('light_breeze');
  const [windSpeedEstimateKmh, setWindSpeedEstimateKmh] = useState('');
  const [obsNotes, setObsNotes] = useState('');

  const loadWeather = useCallback(async () => {
    if (!activeFarmId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<WeatherIntelligence>(
        `/api/weather/farms/${encodeURIComponent(activeFarmId)}`
      );
      setWeather(res);
    } catch (err: unknown) {
      if (isLikelyOfflineError(err) && userId) {
        const bundle = await loadOfflineBundle(userId);
        const snap = bundle?.weatherSnapshots?.find((s) => s.farmId === activeFarmId) || null;
        if (bundle && activeFarm) {
          const staleness = getOfflineStaleness(bundle);
          const snapTime = snap?.snapshotFetchedAt || bundle.downloadedAt;
          const staleText = staleness.isWeatherStale
            ? `Outdated weather snapshot (${staleness.weatherAgeHours ?? '?'}h old; weather forecasts become stale after ${bundle.weatherStaleAfterHours || 6}h). `
            : '';
          setWeather({
            farmId: activeFarm.id,
            farmName: activeFarm.name,
            locationLabel: `${activeFarm.location?.townOrVillage || activeFarm.location?.districtMunicipality || activeFarm.name}, ${activeFarm.location?.province || 'South Africa'}`,
            coordinates: {
              latitude: activeFarm.location?.latitude ?? -25.7479,
              longitude: activeFarm.location?.longitude ?? 28.2293,
            },
            serviceAvailable: false,
            unavailableReason: `${staleText}Offline mode active — fresh live weather forecasts, SAWS/Open-Meteo telemetry, and external data require internet connectivity. Showing locally cached forecast records from ${new Date(snapTime).toLocaleString()}.`,
            source: 'Offline Weather Snapshot Cache',
            sawsIntegrationStatus: 'Offline — internet required for live SAWS / Open-Meteo sync',
            lastUpdated: snapTime,
            isCachedFallback: true,
            current: null,
            hourly: [],
            daily: (snap?.forecasts || []).map((f) => ({
              date: f.forecastDate,
              tempMaxC: f.predictedTempMaxC,
              tempMinC: f.predictedTempMinC,
              precipitationMm: f.predictedRainfallMm,
              precipProbabilityPercent: null,
              windMaxKmh: f.predictedWindMaxKmh,
              et0EvapotranspirationMm: null,
              weatherDescription: f.weatherDescription,
            })),
            historicalRainfall: {
              past14DaysMm: null,
              past30DaysMm: null,
              seasonalClimateNote:
                'Live historical rainfall charts require internet connectivity.',
              historicalDays: [],
            },
            operationsWindow: {
              sprayingStatus: 'Unknown',
              sprayingReason: 'Live wind and humidity forecast unavailable offline.',
              plantingStatus: 'Unknown',
              plantingReason: 'Live soil moisture and forecast rain unavailable offline.',
              irrigationStatus: 'Unknown',
              irrigationReason: 'Live ET0 and rain probability unavailable offline.',
            },
            warnings: [],
          });
          setLoading(false);
          return;
        }
      }
      setError(
        isLikelyOfflineError(err)
          ? 'Fresh weather forecasts require internet connectivity, and no offline weather snapshot is saved for this farm yet.'
          : err instanceof Error
          ? err.message
          : 'Unable to load agricultural weather.'
      );
    } finally {
      setLoading(false);
    }
  }, [activeFarmId, activeFarm, userId]);

  const loadFeedback = useCallback(async () => {
    if (!activeFarmId) return;
    setFeedbackLoading(true);
    try {
      const fb = await apiRequest<LocalWeatherFeedbackOverview>(
        `/api/weather/farms/${encodeURIComponent(activeFarmId)}/feedback`
      );
      setFeedback(fb);
    } catch (err: unknown) {
      if (isLikelyOfflineError(err) && userId && activeFarm) {
        const bundle = await loadOfflineBundle(userId);
        const snap = bundle?.weatherSnapshots?.find((s) => s.farmId === activeFarmId) || null;
        if (bundle && snap) {
          const forecastByDate = new Map(snap.forecasts.map((f) => [f.forecastDate, f]));
          setFeedback({
            farmId: activeFarm.id,
            farmName: activeFarm.name,
            farmLocationLabel: `${activeFarm.location?.townOrVillage || activeFarm.location?.districtMunicipality || activeFarm.name}, ${activeFarm.location?.province || 'South Africa'}`,
            verifiedStationStatus: {
              connected: false,
              stationName: null,
              note: 'Offline — verified station telemetry requires internet connectivity.',
            },
            calibrationPolicyNotice:
              'Viewing locally cached weather observations & stored forecast records. New on-farm observations will queue offline and sync when connectivity returns.',
            forecastRecords: snap.forecasts,
            observations: snap.recentObservations,
            comparisons: snap.recentObservations.map((obs) => {
              const fc = forecastByDate.get(obs.observationDate) || null;
              const diff =
                fc && obs.measuredRainfallMm !== null
                  ? Number((obs.measuredRainfallMm - fc.predictedRainfallMm).toFixed(1))
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
                verifiedStationAvailable: false,
                verifiedStationRainMm: null,
                verifiedStationTempC: null,
                rainfallDiffMm: diff,
                rainEventMatch: !fc
                  ? 'no_forecast_record'
                  : obs.rainfallOccurred && fc.predictedRainfallMm > 0
                  ? 'matched'
                  : !obs.rainfallOccurred && fc.predictedRainfallMm <= 0
                  ? 'matched'
                  : obs.rainfallOccurred
                  ? 'unexpected_rain_observed'
                  : 'forecast_rain_not_observed',
                tempDiffC: null,
                windComparisonNote: obs.windObservation.replace(/_/g, ' '),
              };
            }),
            summary: {
              sourceCategory: 'forecast_information',
              poweredBy: 'deterministic_summary',
              generatedAt: snap.snapshotFetchedAt,
              totalObservations: snap.recentObservations.length,
              qcPassedCount: snap.recentObservations.filter(
                (o) => o.qcStatus === 'qc_passed_reference'
              ).length,
              flaggedOutliersCount: snap.recentObservations.filter(
                (o) => o.qcStatus === 'qc_flagged_outlier'
              ).length,
              avgRainfallVarianceMm: null,
              rainAgreementRatePercent: null,
              narrative: `Showing ${snap.recentObservations.length} cached farmer weather observation(s) from offline pack downloaded ${new Date(snap.snapshotFetchedAt).toLocaleString()}.`,
              caveats: [
                'AI weather comparison summaries require internet connectivity.',
                'New on-farm observations recorded offline will be queued until connectivity returns.',
              ],
            },
          });
        }
      }
    } finally {
      setFeedbackLoading(false);
    }
  }, [activeFarmId, activeFarm, userId]);

  useEffect(() => {
    loadWeather().then(() => {
      loadFeedback();
    });
  }, [loadWeather, loadFeedback]);

  const handleSubmitObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarmId) return;
    setObsSubmitting(true);
    setError(null);
    setNotice(null);
    const payloadBody = {
      observationDate,
      rainfallOccurred,
      rainfallIntensity: rainfallOccurred ? rainfallIntensity : 'none',
      measuredRainfallMm: rainfallOccurred
        ? measuredRainfallMm === ''
          ? null
          : Number(measuredRainfallMm)
        : 0,
      temperatureC: temperatureC === '' ? null : Number(temperatureC),
      windObservation,
      windSpeedEstimateKmh: windSpeedEstimateKmh === '' ? null : Number(windSpeedEstimateKmh),
      notes: obsNotes,
    };
    try {
      const res = await apiRequest<{ overview: LocalWeatherFeedbackOverview }>(
        `/api/weather/farms/${encodeURIComponent(activeFarmId)}/observations`,
        {
          method: 'POST',
          body: JSON.stringify(payloadBody),
        }
      );
      setFeedback(res.overview);
      setObsFormOpen(false);
      setObsNotes('');
      setNotice(
        'On-farm weather observation recorded as an unverified farmer report and compared against stored forecast records.'
      );
    } catch (err: unknown) {
      if (isLikelyOfflineError(err) && userId) {
        await enqueueOfflineMutation({
          userId,
          mutationType: 'weather_observation',
          label: `Weather observation (${observationDate} · ${activeFarm?.name || 'Farm'})`,
          farmId: activeFarmId,
          farmName: activeFarm?.name || null,
          payload: {
            farmId: activeFarmId,
            ...payloadBody,
          },
        });
        setObsFormOpen(false);
        setObsNotes('');
        setNotice(
          'Offline: on-farm weather observation saved locally and queued for synchronisation when connectivity returns.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Unable to submit weather observation.');
      }
    } finally {
      setObsSubmitting(false);
    }
  };

  const handleGenerateLocalSummary = async () => {
    if (!activeFarmId) return;
    setSummaryLoading(true);
    setError(null);
    try {
      const summary = await apiRequest<LocalWeatherFeedbackOverview['summary']>(
        `/api/weather/farms/${encodeURIComponent(activeFarmId)}/feedback-summary`,
        {
          method: 'POST',
          body: JSON.stringify({ languageCode }),
        }
      );
      setFeedback((prev) => (prev ? { ...prev, summary } : prev));
    } catch (err: unknown) {
      setError(
        isLikelyOfflineError(err)
          ? 'Online AI weather comparison summary requires internet connectivity.'
          : err instanceof Error
          ? err.message
          : 'Unable to generate local weather summary.'
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleUpdateQc = async (
    obsId: string,
    qcStatus: 'qc_passed_reference' | 'qc_flagged_outlier'
  ) => {
    setError(null);
    try {
      await apiRequest(`/api/weather/observations/${encodeURIComponent(obsId)}/qc`, {
        method: 'PATCH',
        body: JSON.stringify({ qcStatus }),
      });
      await loadFeedback();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update observation QC status.');
    }
  };

  if (farms.length === 0) {
    return (
      <div className="bg-white border border-[#CBD5E1] rounded-2xl p-8 text-center space-y-2">
        <CloudRain className="w-8 h-8 text-[#0B3D91] mx-auto" />
        <h2 className="font-display text-xl font-bold text-[#0B1F3A]">
          Register a Farm Location for Weather Intelligence
        </h2>
        <p className="text-sm text-[#475569]">
          Agricultural weather warnings, coordinate forecasts, and local farmer rainfall feedback connect directly to each registered farm’s GPS or map coordinates.
        </p>
      </div>
    );
  }

  const maxHistRain = Math.max(
    10,
    ...(weather?.historicalRainfall.historicalDays.map((d) => d.precipitationMm) || [10])
  );

  const pairedChartRows = (feedback?.comparisons || [])
    .filter((c) => c.forecastRecord || c.reportedRainfallMm !== null)
    .slice(0, 8)
    .reverse();

  const maxCompareRain = Math.max(
    10,
    ...pairedChartRows.flatMap((r) => [
      r.reportedRainfallMm ?? 0,
      r.forecastRecord?.predictedRainfallMm ?? 0,
    ])
  );

  const canReviewQc =
    userRoleCode === 'agricultural_expert' || userRoleCode === 'system_administrator';

  return (
    <div className="space-y-6">
      {/* Header & Farm Switcher */}
      <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
              Agricultural Weather & Local Feedback Loop
            </h1>
            <p className="text-sm text-[#475569]">
              Coordinate-linked forecasts, agricultural warnings, and farmer-reported weather comparison.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={activeFarmId}
              onChange={(e) => onSelectFarm(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-semibold text-[#0F172A] min-h-[42px]"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  Farm: {f.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setActiveSection('feedback');
                setObsFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#0B3D91] text-[#0B3D91] hover:bg-[#EFF6FF] text-sm font-semibold min-h-[42px] cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Report Farm Weather</span>
            </button>

            <button
              type="button"
              onClick={() => {
                loadWeather().then(() => loadFeedback());
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold min-h-[42px] cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Update Weather</span>
            </button>
          </div>
        </div>

        {/* Segmented Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => setActiveSection('forecast')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'forecast'
                ? 'bg-[#0B3D91] text-white'
                : 'bg-[#F8FAFC] text-[#334155] border border-[#CBD5E1] hover:bg-[#EFF6FF]'
            }`}
          >
            Live Forecast & Warnings
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('feedback')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              activeSection === 'feedback'
                ? 'bg-[#0B3D91] text-white'
                : 'bg-[#F8FAFC] text-[#334155] border border-[#CBD5E1] hover:bg-[#EFF6FF]'
            }`}
          >
            Local Weather Feedback & Comparison ({feedback?.observations.length ?? 0})
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {notice && (
        <div className="bg-[#ECF5F2] border border-[#A7D7C5] text-[#174C3C] rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeSection === 'forecast' && loading && !weather && (
        <div className="bg-white border border-[#CBD5E1] rounded-2xl p-8 text-sm text-[#475569]">
          Fetching live coordinate weather and historical rainfall telemetry...
        </div>
      )}

      {activeSection === 'forecast' && weather && (
        <>
          {/* Source Attribution & Update Timestamp */}
          <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 text-xs text-[#334155]">
              <p className="font-semibold text-[#0B1F3A]">
                {weather.farmName} · {weather.locationLabel} (
                <span className="font-mono tabular-nums">
                  {weather.coordinates.latitude.toFixed(4)}, {weather.coordinates.longitude.toFixed(4)}
                </span>
                )
              </p>
              <p>
                Source: {weather.source} · Last updated:{' '}
                <span className="font-mono tabular-nums">
                  {weather.lastUpdated ? new Date(weather.lastUpdated).toLocaleString() : 'Unavailable'}
                </span>
              </p>
              <p className="text-[#475569]">{weather.sawsIntegrationStatus}</p>
            </div>

            {weather.current && (
              <SpeakButton
                text={`Current weather for ${weather.farmName}. ${weather.current.weatherDescription}. Temperature ${weather.current.temperatureC} degrees Celsius. Humidity ${weather.current.humidityPercent} percent. Wind ${weather.current.windSpeedKmh} kilometers per hour. Active warnings: ${weather.warnings.length}. ${
                  weather.warnings[0] ? weather.warnings[0].title + '. ' + weather.warnings[0].whatIsHappening : ''
                }`}
                languageCode={languageCode}
                isSpeaking={isSpeaking}
                onSpeak={onSpeak}
                onStop={onStopSpeaking}
                supported={speechSupported}
                label="Listen to Weather"
              />
            )}
          </div>

          {/* Graceful Unavailable / Cached Fallback Notice */}
          {(!weather.serviceAvailable || weather.isCachedFallback) && weather.unavailableReason && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] rounded-2xl p-4 flex items-start gap-3 text-sm">
              <WifiOff className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Weather Service Notice</p>
                <p className="text-xs leading-relaxed">{weather.unavailableReason}</p>
              </div>
            </div>
          )}

          {/* Current Conditions + Operations Suitability Strip */}
          {weather.current && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <section className="lg:col-span-5 bg-[#0B1F3A] text-white rounded-2xl p-6 space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-[#93C5FD] font-medium">Current Farm Conditions</p>
                    <p className="font-mono text-4xl font-bold tabular-nums mt-1">
                      {weather.current.temperatureC}°C
                    </p>
                    <p className="text-sm text-[#CBD5E1] mt-1">
                      {weather.current.weatherDescription}
                    </p>
                  </div>
                  <Sun className="w-9 h-9 text-[#93C5FD]" />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#163055] text-xs">
                  <div>
                    <p className="text-[#93C5FD]">Feels Like</p>
                    <p className="font-mono text-base font-semibold tabular-nums mt-0.5">
                      {weather.current.apparentTempC}°C
                    </p>
                  </div>
                  <div>
                    <p className="text-[#93C5FD]">Humidity</p>
                    <p className="font-mono text-base font-semibold tabular-nums mt-0.5">
                      {weather.current.humidityPercent}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[#93C5FD]">Wind Speed / Gusts</p>
                    <p className="font-mono text-base font-semibold tabular-nums mt-0.5">
                      {weather.current.windSpeedKmh} / {weather.current.windGustsKmh} km/h
                    </p>
                  </div>
                  <div>
                    <p className="text-[#93C5FD]">Current Precip</p>
                    <p className="font-mono text-base font-semibold tabular-nums mt-0.5">
                      {weather.current.precipitationMm} mm
                    </p>
                  </div>
                </div>
              </section>

              <section className="lg:col-span-7 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Field Operations Weather Window
                </h2>
                <div className="divide-y divide-[#E2E8F0]">
                  <div className="py-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#0B1F3A]">Crop Spraying Window</p>
                      <p className="text-xs text-[#475569] mt-0.5">
                        {weather.operationsWindow.sprayingReason}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold shrink-0 ${
                        weather.operationsWindow.sprayingStatus === 'Suitable'
                          ? 'text-[#174C3C]'
                          : weather.operationsWindow.sprayingStatus === 'Caution'
                          ? 'text-[#92400E]'
                          : 'text-[#B91C1C]'
                      }`}
                    >
                      {weather.operationsWindow.sprayingStatus}
                    </span>
                  </div>

                  <div className="py-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#0B1F3A]">Planting & Seeding Window</p>
                      <p className="text-xs text-[#475569] mt-0.5">
                        {weather.operationsWindow.plantingReason}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold shrink-0 ${
                        weather.operationsWindow.plantingStatus === 'Suitable'
                          ? 'text-[#174C3C]'
                          : weather.operationsWindow.plantingStatus === 'Caution'
                          ? 'text-[#92400E]'
                          : 'text-[#B91C1C]'
                      }`}
                    >
                      {weather.operationsWindow.plantingStatus}
                    </span>
                  </div>

                  <div className="py-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#0B1F3A]">Irrigation Guidance</p>
                      <p className="text-xs text-[#475569] mt-0.5">
                        {weather.operationsWindow.irrigationReason}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#174C3C] shrink-0">
                      {weather.operationsWindow.irrigationStatus}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Agricultural Warnings */}
          <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#92400E]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Agricultural Weather Warnings ({weather.warnings.length})
                </h2>
              </div>
              <span className="text-xs text-[#475569]">
                Generated from coordinate thresholds & farm crops/soils
              </span>
            </div>

            {weather.warnings.length === 0 ? (
              <p className="text-sm text-[#475569] py-3 border-t border-[#E2E8F0]">
                {weather.serviceAvailable
                  ? 'No severe weather, frost, flood, drought, or wind warnings active for this farm right now.'
                  : 'Warnings require live forecast telemetry.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {weather.warnings.map((w) => (
                  <article
                    key={w.id}
                    className={`rounded-2xl border p-5 space-y-3 ${
                      w.severity === 'High'
                        ? 'bg-[#FEF2F2] border-[#FECACA]'
                        : w.severity === 'Moderate'
                        ? 'bg-[#FFFBEB] border-[#FDE68A]'
                        : 'bg-[#F8FAFC] border-[#CBD5E1]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-base text-[#0B1F3A]">{w.title}</h3>
                      <span
                        className={`text-xs font-bold shrink-0 ${
                          w.severity === 'High'
                            ? 'text-[#B91C1C]'
                            : w.severity === 'Moderate'
                            ? 'text-[#92400E]'
                            : 'text-[#174C3C]'
                        }`}
                      >
                        {w.severity} Alert
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-[#0F172A] leading-relaxed">
                      <p>
                        <strong className="text-[#0B1F3A]">What is happening:</strong>{' '}
                        {w.whatIsHappening}
                      </p>
                      <p>
                        <strong className="text-[#0B1F3A]">Farm affected:</strong> {w.affectedFarm}
                      </p>
                      <p>
                        <strong className="text-[#0B1F3A]">Possible impact:</strong>{' '}
                        {w.possibleImpact}
                      </p>
                      <div>
                        <p className="font-semibold text-[#0B1F3A]">Recommended precautions:</p>
                        <ul className="mt-1 space-y-0.5">
                          {w.recommendedPrecautions.map((p) => (
                            <li key={p}>· {p}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Hourly Forecast Strip & 7-Day Daily Forecast */}
          {weather.hourly.length > 0 && (
            <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-[#0B3D91]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Next 24-Hour Farm Forecast
                </h2>
              </div>
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-3 min-w-max">
                  {weather.hourly.slice(0, 12).map((h) => (
                    <div
                      key={h.time}
                      className="w-28 border border-[#CBD5E1] rounded-xl p-3 bg-[#F8FAFC] text-xs space-y-1.5"
                    >
                      <p className="font-mono font-semibold text-[#0B1F3A]">
                        {h.time.slice(11, 16)}
                      </p>
                      <p className="font-mono text-lg font-bold tabular-nums text-[#0B3D91]">
                        {h.temperatureC}°C
                      </p>
                      <p className="font-mono tabular-nums text-[#475569]">
                        Rain: {h.precipitationMm} mm
                        {h.precipProbabilityPercent != null ? ` (${h.precipProbabilityPercent}%)` : ''}
                      </p>
                      <p className="font-mono tabular-nums text-[#475569] flex items-center gap-1">
                        <Wind className="w-3 h-3" />
                        <span>{h.windSpeedKmh} km/h</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {weather.daily.length > 0 && (
            <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <CloudRain className="w-5 h-5 text-[#0B3D91]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  7-Day Daily Forecast & Evapotranspiration (ET₀)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-xs text-[#475569]">
                      <th className="py-2.5 pr-4 font-semibold">Date</th>
                      <th className="py-2.5 pr-4 font-semibold">Conditions</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Min / Max</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Rainfall</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Max Wind</th>
                      <th className="py-2.5 font-semibold text-right">Crop Water Loss (ET₀)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {weather.daily.map((d) => (
                      <tr key={d.date}>
                        <td className="py-2.5 pr-4 font-mono tabular-nums font-semibold text-[#0B1F3A]">
                          {d.date}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-[#334155]">
                          {d.weatherDescription}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                          {d.tempMinC}° / <span className="font-bold">{d.tempMaxC}°C</span>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#0B3D91]">
                          {d.precipitationMm} mm
                          {d.precipProbabilityPercent != null ? ` (${d.precipProbabilityPercent}%)` : ''}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                          {d.windMaxKmh} km/h
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-[#475569]">
                          {d.et0EvapotranspirationMm != null ? `${d.et0EvapotranspirationMm} mm` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Historical Rainfall & Seasonal Climate */}
          <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-[#0B3D91]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Historical Rainfall & Seasonal Climate Context
                </h2>
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-mono tabular-nums">
                <span>
                  Past 14 Days:{' '}
                  <strong className="text-[#0B1F3A]">
                    {weather.historicalRainfall.past14DaysMm != null
                      ? `${weather.historicalRainfall.past14DaysMm} mm`
                      : 'Unavailable'}
                  </strong>
                </span>
                <span>
                  Past 30 Days:{' '}
                  <strong className="text-[#0B1F3A]">
                    {weather.historicalRainfall.past30DaysMm != null
                      ? `${weather.historicalRainfall.past30DaysMm} mm`
                      : 'Unavailable'}
                  </strong>
                </span>
              </div>
            </div>

            <p className="text-xs text-[#475569]">
              Seasonal Baseline: {weather.historicalRainfall.seasonalClimateNote}
            </p>

            {weather.historicalRainfall.historicalDays.length > 0 && (
              <div className="pt-2">
                <div className="flex items-end gap-1 h-28 border-b border-[#CBD5E1] pb-1">
                  {weather.historicalRainfall.historicalDays.map((hd) => {
                    const heightPct = Math.max(
                      4,
                      Math.round((hd.precipitationMm / maxHistRain) * 100)
                    );
                    return (
                      <div
                        key={hd.date}
                        title={`${hd.date}: ${hd.precipitationMm} mm`}
                        className="flex-1 flex flex-col items-center justify-end h-full"
                      >
                        <div
                          className={`w-full rounded-t ${
                            hd.precipitationMm > 0 ? 'bg-[#0B3D91]' : 'bg-[#E2E8F0]'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[11px] font-mono tabular-nums text-[#475569] mt-1">
                  <span>{weather.historicalRainfall.historicalDays[0]?.date}</span>
                  <span>30-Day Observed Coordinate Rainfall (mm/day)</span>
                  <span>
                    {
                      weather.historicalRainfall.historicalDays[
                        weather.historicalRainfall.historicalDays.length - 1
                      ]?.date
                    }
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* NASA POWER Satellite Agro-Meteorology & SA Seasonal Calendar */}
          {(weather.nasaPower || weather.seasonalCalendar) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {weather.nasaPower && (
                <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-wider text-[#0B3D91]">
                        Satellite Agro-Meteorology
                      </p>
                      <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                        NASA POWER Coordinate Summary
                      </h2>
                    </div>
                    <span className="text-[11px] font-mono text-[#475569]">
                      {weather.nasaPower.periodLabel}
                    </span>
                  </div>

                  {weather.nasaPower.serviceAvailable ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                        <p className="text-[#475569]">Solar Irradiance</p>
                        <p className="font-mono text-base font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                          {weather.nasaPower.avgSolarIrradiance ?? '—'} {weather.nasaPower.solarUnit}
                        </p>
                      </div>
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                        <p className="text-[#475569]">NASA Precip Total</p>
                        <p className="font-mono text-base font-bold tabular-nums text-[#0B3D91] mt-0.5">
                          {weather.nasaPower.totalPrecipitationMm ?? '—'} mm
                        </p>
                      </div>
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                        <p className="text-[#475569]">Mean Humidity</p>
                        <p className="font-mono text-base font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                          {weather.nasaPower.avgRelativeHumidityPercent ?? '—'}%
                        </p>
                      </div>
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                        <p className="text-[#475569]">Mean Daily High</p>
                        <p className="font-mono text-base font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                          {weather.nasaPower.avgMaxTempC ?? '—'}°C
                        </p>
                      </div>
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                        <p className="text-[#475569]">Mean Daily Low</p>
                        <p className="font-mono text-base font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                          {weather.nasaPower.avgMinTempC ?? '—'}°C
                        </p>
                      </div>
                      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                        <p className="text-[#475569]">Valid Days</p>
                        <p className="font-mono text-base font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                          {weather.nasaPower.daysCount} days
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3.5 text-xs text-[#92400E]">
                      {weather.nasaPower.unavailableReason ||
                        'NASA POWER satellite climatology requires live internet connectivity.'}
                    </div>
                  )}
                  <p className="text-[11px] text-[#475569] leading-relaxed">
                    Source: {weather.nasaPower.source}. Used for solar-drying, irrigation ET estimation, and multi-week rainfall cross-checking.
                  </p>
                </section>
              )}

              {weather.seasonalCalendar && (
                <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-wider text-[#174C3C]">
                        South African Seasonal Calendar (SAST)
                      </p>
                      <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                        {weather.seasonalCalendar.regime}
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-[#174C3C]">
                      {weather.seasonalCalendar.seasonLabel}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#0B1F3A]">
                    Planting Window: {weather.seasonalCalendar.plantingWindow}
                  </p>
                  {weather.seasonalCalendar.recommendedCrops.length > 0 && (
                    <p className="text-xs text-[#334155] leading-relaxed">
                      <span className="font-semibold text-[#0B1F3A]">Priority Crops: </span>
                      {weather.seasonalCalendar.recommendedCrops.join(' · ')}
                    </p>
                  )}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#334155]">
                    <span className="font-semibold text-[#0B1F3A]">Livestock Advisory: </span>
                    {weather.seasonalCalendar.livestockAdvisory}
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}

      {activeSection === 'feedback' && (
        <div className="space-y-6">
          {/* Four-Source Governance & Data Distinction Grid */}
          <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Weather Data Source Separation & Quality Control Policy
                </h2>
                <p className="text-xs text-[#475569]">
                  {feedback?.calibrationPolicyNotice ||
                    'Farmer-reported observations are never automatically treated as verified measurements and never automatically retrain AI models. Only quality-controlled records may be reviewed for future calibration.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setObsFormOpen(!obsFormOpen)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold min-h-[42px] cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>{obsFormOpen ? 'Close Observation Form' : 'Submit On-Farm Observation'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-[#E2E8F0] text-xs">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-1">
                <p className="font-semibold text-[#0B1F3A]">1. Verified Weather-Station Measurements</p>
                <p className="text-[#475569] leading-relaxed">
                  {feedback?.verifiedStationStatus.connected
                    ? `Connected: ${feedback.verifiedStationStatus.stationName}`
                    : 'Not Connected (SAWS synoptic station stream requires SAWS_API_KEY).'}
                </p>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-1">
                <p className="font-semibold text-[#0B1F3A]">2. Forecast Information</p>
                <p className="text-[#475569] leading-relaxed">
                  Stored Open-Meteo coordinate forecasts & gridded reanalysis ({feedback?.forecastRecords.length ?? 0} date snapshots saved for this farm).
                </p>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-1">
                <p className="font-semibold text-[#0B1F3A]">3. Farmer-Reported Observations</p>
                <p className="text-[#475569] leading-relaxed">
                  On-farm rain gauge, temp, and wind logs ({feedback?.observations.length ?? 0} reports). Marked unverified until quality-controlled.
                </p>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-1">
                <p className="font-semibold text-[#0B1F3A]">4. AI-Generated Estimates</p>
                <p className="text-[#475569] leading-relaxed">
                  Plain-language local comparison summaries synthesized for farmer awareness only. Never overwrites physical measurements.
                </p>
              </div>
            </div>
          </section>

          {/* Submit On-Farm Weather Observation Form */}
          {obsFormOpen && (
            <form
              onSubmit={handleSubmitObservation}
              className="bg-white border border-[#0B3D91] rounded-2xl p-6 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Log Actual Weather Experienced at {activeFarm?.name}
                  </h3>
                  <p className="text-xs text-[#475569]">
                    Location: {activeFarm?.location?.townOrVillage}, {activeFarm?.location?.localMunicipality},{' '}
                    {activeFarm?.location?.province} (
                    <span className="font-mono tabular-nums">
                      {activeFarm?.location?.latitude.toFixed(4)}, {activeFarm?.location?.longitude.toFixed(4)}
                    </span>
                    )
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#92400E]">
                  Recorded as: Farmer-Reported Observation (Unverified)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Observation Date
                  </label>
                  <input
                    type="date"
                    value={observationDate}
                    onChange={(e) => setObservationDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Did Rainfall Occur at the Farm?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRainfallOccurred(true);
                        if (rainfallIntensity === 'none') setRainfallIntensity('moderate');
                      }}
                      className={`py-2.5 rounded-xl border text-sm font-semibold cursor-pointer ${
                        rainfallOccurred
                          ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                          : 'bg-white text-[#334155] border-[#CBD5E1]'
                      }`}
                    >
                      Yes — Rain Occurred
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRainfallOccurred(false);
                        setRainfallIntensity('none');
                        setMeasuredRainfallMm('0');
                      }}
                      className={`py-2.5 rounded-xl border text-sm font-semibold cursor-pointer ${
                        !rainfallOccurred
                          ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                          : 'bg-white text-[#334155] border-[#CBD5E1]'
                      }`}
                    >
                      No — Dry Day
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Rainfall Intensity
                  </label>
                  <select
                    value={rainfallOccurred ? rainfallIntensity : 'none'}
                    disabled={!rainfallOccurred}
                    onChange={(e) => setRainfallIntensity(e.target.value as RainfallIntensity)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-semibold disabled:bg-[#F8FAFC]"
                  >
                    <option value="none">None (0 mm)</option>
                    <option value="light">Light Drizzle / Shower</option>
                    <option value="moderate">Moderate Steady Rain</option>
                    <option value="heavy">Heavy Downpour</option>
                    <option value="extreme">Extreme Storm / Flood Rain</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Measured Rainfall (mm) — Rain Gauge / Estimate
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="500"
                    disabled={!rainfallOccurred}
                    value={rainfallOccurred ? measuredRainfallMm : '0'}
                    onChange={(e) => setMeasuredRainfallMm(e.target.value)}
                    placeholder="e.g. 18.5"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-mono tabular-nums disabled:bg-[#F8FAFC]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Observed Temperature (°C, optional)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="-15"
                    max="52"
                    value={temperatureC}
                    onChange={(e) => setTemperatureC(e.target.value)}
                    placeholder="e.g. 24.5"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Wind Observation
                  </label>
                  <select
                    value={windObservation}
                    onChange={(e) => setWindObservation(e.target.value as WindObservationLevel)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-semibold"
                  >
                    <option value="calm">Calm (Leaves Still)</option>
                    <option value="light_breeze">Light Breeze (Ideal Spraying)</option>
                    <option value="moderate_wind">Moderate Wind (Branches Move)</option>
                    <option value="strong_wind">Strong Wind (Avoid Spraying)</option>
                    <option value="gale">Gale / Damaging Gusts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Estimated Wind Speed (km/h, optional)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="180"
                    value={windSpeedEstimateKmh}
                    onChange={(e) => setWindSpeedEstimateKmh(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-mono tabular-nums"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Field Weather Notes (Gauge placement, hail, storm direction)
                  </label>
                  <input
                    type="text"
                    value={obsNotes}
                    onChange={(e) => setObsNotes(e.target.value)}
                    placeholder="e.g. Manual gauge at North Contour Maize Block checked at 17:30"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setObsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={obsSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold cursor-pointer"
                >
                  {obsSubmitting ? 'Saving & Comparing...' : 'Submit Farm Observation'}
                </button>
              </div>
            </form>
          )}

          {/* Local Weather Comparison Summary & AI Synthesis */}
          {feedback && (
            <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
                    <span className="font-semibold text-[#0B1F3A]">
                      {feedback.summary.sourceCategory === 'ai_generated_estimate'
                        ? 'AI-Generated Local Weather Summary'
                        : 'Local Weather Comparison Summary'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Updated{' '}
                      <span className="font-mono tabular-nums">
                        {new Date(feedback.summary.generatedAt).toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Forecast vs Farm-Reported Weather Insights
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <SpeakButton
                    text={feedback.summary.narrative}
                    languageCode={languageCode}
                    isSpeaking={isSpeaking}
                    onSpeak={onSpeak}
                    onStop={onStopSpeaking}
                    supported={speechSupported}
                    label="Listen"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateLocalSummary}
                    disabled={summaryLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-xs font-semibold min-h-[40px] cursor-pointer whitespace-nowrap"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {summaryLoading ? 'Generating Summary...' : 'Generate AI Comparison Summary'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 border-y border-[#E2E8F0]">
                <div>
                  <p className="text-xs text-[#475569]">Farmer Observations</p>
                  <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                    {feedback.summary.totalObservations}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#475569]">Passed Plausibility QC</p>
                  <p className="font-mono text-xl font-bold tabular-nums text-[#174C3C] mt-0.5">
                    {feedback.summary.qcPassedCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#475569]">Rain Occurrence Match</p>
                  <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                    {feedback.summary.rainAgreementRatePercent !== null
                      ? `${feedback.summary.rainAgreementRatePercent}%`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#475569]">Avg Rainfall Difference</p>
                  <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                    {feedback.summary.avgRainfallVarianceMm !== null
                      ? `${feedback.summary.avgRainfallVarianceMm > 0 ? '+' : ''}${
                          feedback.summary.avgRainfallVarianceMm
                        } mm`
                      : '—'}
                  </p>
                </div>
              </div>

              <p className="text-sm text-[#0F172A] leading-relaxed">{feedback.summary.narrative}</p>
              <ul className="text-xs text-[#475569] space-y-1">
                {feedback.summary.caveats.map((c) => (
                  <li key={c}>· {c}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Forecast vs Reported Rainfall Visual Comparison Chart */}
          <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#0B3D91]" />
                <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Forecast vs Farmer-Reported Rainfall Comparison Chart (mm)
                </h3>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#334155]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#93C5FD] inline-block" />
                  <span>Stored Forecast Information</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#0B3D91] inline-block" />
                  <span>Farmer-Reported Observation (Unverified)</span>
                </span>
              </div>
            </div>

            {feedbackLoading && !feedback ? (
              <p className="text-sm text-[#475569]">Loading weather comparison history...</p>
            ) : pairedChartRows.length === 0 ? (
              <p className="text-sm text-[#475569] py-4 border-t border-[#E2E8F0]">
                Submit farm weather observations to plot forecast-vs-actual rainfall bars here.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 pt-4 border-t border-[#E2E8F0]">
                {pairedChartRows.map((row) => {
                  const fcMm = row.forecastRecord?.predictedRainfallMm ?? 0;
                  const repMm = row.reportedRainfallMm ?? 0;
                  const fcH = Math.max(4, Math.round((fcMm / maxCompareRain) * 100));
                  const repH = Math.max(4, Math.round((repMm / maxCompareRain) * 100));
                  return (
                    <div
                      key={row.observationId}
                      className="border border-[#CBD5E1] rounded-xl p-3 bg-[#F8FAFC] flex flex-col justify-between space-y-2"
                    >
                      <div className="h-28 flex items-end justify-center gap-2 border-b border-[#CBD5E1] pb-1">
                        <div className="flex flex-col items-center justify-end h-full w-6">
                          <span className="text-[10px] font-mono tabular-nums text-[#475569] mb-0.5">
                            {row.forecastRecord ? fcMm : '—'}
                          </span>
                          <div
                            className="w-full rounded-t bg-[#93C5FD]"
                            style={{ height: `${row.forecastRecord ? fcH : 4}%` }}
                            title={`Forecast: ${fcMm} mm`}
                          />
                        </div>
                        <div className="flex flex-col items-center justify-end h-full w-6">
                          <span className="text-[10px] font-mono tabular-nums text-[#0B1F3A] font-semibold mb-0.5">
                            {row.reportedRainfallMm ?? '—'}
                          </span>
                          <div
                            className="w-full rounded-t bg-[#0B3D91]"
                            style={{ height: `${repH}%` }}
                            title={`Farmer Reported: ${repMm} mm`}
                          />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] font-mono tabular-nums font-semibold text-[#0B1F3A]">
                          {row.observationDate}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-[#475569]">
                          {row.rainfallDiffMm !== null
                            ? `Diff ${row.rainfallDiffMm > 0 ? '+' : ''}${row.rainfallDiffMm}mm`
                            : 'No fcst'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Historical Observations & Detailed Comparison Table */}
          {feedback && (
            <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Historical Farm Observations & Forecast Comparison Log
                </h3>
                <span className="text-xs text-[#475569]">
                  Verified Station Telemetry:{' '}
                  {feedback.verifiedStationStatus.connected
                    ? feedback.verifiedStationStatus.stationName
                    : 'Not Connected'}
                </span>
              </div>

              {feedback.comparisons.length === 0 ? (
                <p className="text-sm text-[#475569] py-4 border-t border-[#E2E8F0]">
                  No farmer weather observations recorded yet for this farm.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-[#475569]">
                        <th className="py-2.5 pr-3 font-semibold">Date & Location</th>
                        <th className="py-2.5 pr-3 font-semibold">Farmer Report (Unverified)</th>
                        <th className="py-2.5 pr-3 font-semibold">Stored Forecast Info</th>
                        <th className="py-2.5 pr-3 font-semibold">Verified Station</th>
                        <th className="py-2.5 pr-3 font-semibold">Measured Difference</th>
                        <th className="py-2.5 font-semibold">Quality Control Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {feedback.comparisons.map((row) => (
                        <tr key={row.observationId} className="align-top">
                          <td className="py-3 pr-3">
                            <p className="font-mono tabular-nums font-semibold text-[#0B1F3A]">
                              {row.observationDate}
                            </p>
                            <p className="text-[#475569] mt-0.5">{row.farmLocationLabel}</p>
                          </td>
                          <td className="py-3 pr-3 space-y-0.5">
                            <p className="font-semibold text-[#0B1F3A]">
                              {row.reportedRainfallOccurred
                                ? `Rain (${row.reportedIntensity}): ${
                                    row.reportedRainfallMm !== null ? `${row.reportedRainfallMm} mm` : 'Unmeasured'
                                  }`
                                : 'Dry (0 mm)'}
                            </p>
                            <p className="font-mono tabular-nums text-[#475569]">
                              Temp: {row.reportedTemperatureC !== null ? `${row.reportedTemperatureC}°C` : '—'}
                            </p>
                            <p className="text-[#475569]">{row.windComparisonNote}</p>
                          </td>
                          <td className="py-3 pr-3 space-y-0.5">
                            {row.forecastRecord ? (
                              <>
                                <p className="font-mono tabular-nums font-semibold text-[#0B3D91]">
                                  {row.forecastRecord.predictedRainfallMm} mm
                                </p>
                                <p className="font-mono tabular-nums text-[#475569]">
                                  {row.forecastRecord.predictedTempMinC}°–{row.forecastRecord.predictedTempMaxC}°C · Max wind{' '}
                                  {row.forecastRecord.predictedWindMaxKmh} km/h
                                </p>
                                <p className="text-[#475569]">{row.forecastRecord.weatherDescription}</p>
                              </>
                            ) : (
                              <span className="text-[#475569]">No stored forecast for date</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-[#475569]">
                            {row.verifiedStationAvailable ? (
                              <span className="font-mono tabular-nums text-[#0B1F3A]">
                                {row.verifiedStationRainMm} mm / {row.verifiedStationTempC}°C
                              </span>
                            ) : (
                              <span>Unavailable (Not connected)</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 space-y-0.5">
                            <p className="font-mono tabular-nums font-semibold text-[#0B1F3A]">
                              {row.rainfallDiffMm !== null
                                ? `Rain ${row.rainfallDiffMm > 0 ? '+' : ''}${row.rainfallDiffMm} mm`
                                : '—'}
                            </p>
                            {row.tempDiffC !== null && (
                              <p className="font-mono tabular-nums text-[#475569]">
                                Temp {row.tempDiffC > 0 ? '+' : ''}
                                {row.tempDiffC}°C vs mid
                              </p>
                            )}
                            <p
                              className={`font-semibold ${
                                row.rainEventMatch === 'matched'
                                  ? 'text-[#174C3C]'
                                  : row.rainEventMatch === 'no_forecast_record'
                                  ? 'text-[#475569]'
                                  : 'text-[#92400E]'
                              }`}
                            >
                              {row.rainEventMatch === 'matched'
                                ? 'Rain event matched'
                                : row.rainEventMatch === 'forecast_rain_not_observed'
                                ? 'Forecast rain missed farm'
                                : row.rainEventMatch === 'unexpected_rain_observed'
                                ? 'Unforecast local rain'
                                : 'Unpaired'}
                            </p>
                          </td>
                          <td className="py-3 space-y-1">
                            <div className="flex items-center gap-1 font-semibold">
                              {row.qcStatus === 'qc_passed_reference' ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#174C3C] shrink-0" />
                                  <span className="text-[#174C3C]">Plausibility Passed (Reference Only)</span>
                                </>
                              ) : row.qcStatus === 'qc_flagged_outlier' ? (
                                <>
                                  <ShieldAlert className="w-3.5 h-3.5 text-[#B91C1C] shrink-0" />
                                  <span className="text-[#B91C1C]">Flagged Outlier</span>
                                </>
                              ) : (
                                <span className="text-[#92400E]">Pending QC</span>
                              )}
                            </div>
                            <p className="text-[#475569] max-w-xs leading-snug">{row.qcNotes}</p>
                            {canReviewQc && (
                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQc(row.observationId, 'qc_passed_reference')}
                                  className="text-[11px] font-semibold text-[#174C3C] underline cursor-pointer"
                                >
                                  Mark QC Passed
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQc(row.observationId, 'qc_flagged_outlier')}
                                  className="text-[11px] font-semibold text-[#B91C1C] underline cursor-pointer"
                                >
                                  Flag Outlier
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
