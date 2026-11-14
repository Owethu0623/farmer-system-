import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CloudRain,
  Droplets,
  RefreshCw,
  Sun,
  Thermometer,
  Wind,
  WifiOff,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { FarmItem, LanguageCode, WeatherIntelligence } from '../types';
import { SpeakButton } from './AccessibilityControls';

interface WeatherIntelligenceViewProps {
  farms: FarmItem[];
  selectedFarmId: string | null;
  onSelectFarm: (farmId: string) => void;
  languageCode: LanguageCode;
  isSpeaking: boolean;
  speechSupported: boolean;
  onSpeak: (txt: string) => void;
  onStopSpeaking: () => void;
}

export const WeatherIntelligenceView: React.FC<WeatherIntelligenceViewProps> = ({
  farms,
  selectedFarmId,
  onSelectFarm,
  languageCode,
  isSpeaking,
  speechSupported,
  onSpeak,
  onStopSpeaking,
}) => {
  const activeFarmId = selectedFarmId || farms[0]?.id || '';
  const [weather, setWeather] = useState<WeatherIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Unable to load agricultural weather.');
    } finally {
      setLoading(false);
    }
  }, [activeFarmId]);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  if (farms.length === 0) {
    return (
      <div className="bg-white border border-[#E2E6DF] rounded-2xl p-8 text-center space-y-2">
        <CloudRain className="w-8 h-8 text-[#1B4332] mx-auto" />
        <h2 className="font-display text-xl font-bold text-[#143326]">
          Register a Farm Location for Weather Intelligence
        </h2>
        <p className="text-sm text-[#4A5A50]">
          Agricultural weather warnings and coordinate forecasts connect directly to each registered farm’s GPS or map coordinates.
        </p>
      </div>
    );
  }

  const maxHistRain = Math.max(
    10,
    ...(weather?.historicalRainfall.historicalDays.map((d) => d.precipitationMm) || [10])
  );

  return (
    <div className="space-y-6">
      {/* Header & Farm Switcher */}
      <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-[#143326]">
            Agricultural Weather Intelligence
          </h1>
          <p className="text-sm text-[#4A5A50]">
            Real coordinate-linked forecasts, historical rainfall, and operational crop/livestock warnings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={activeFarmId}
            onChange={(e) => onSelectFarm(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm font-semibold min-h-[42px]"
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                Farm: {f.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadWeather}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white text-sm font-semibold min-h-[42px] cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Update Weather</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading && !weather && (
        <div className="bg-white border border-[#E2E6DF] rounded-2xl p-8 text-sm text-[#4A5A50]">
          Fetching live coordinate weather and historical rainfall telemetry...
        </div>
      )}

      {weather && (
        <>
          {/* Source Attribution & Update Timestamp */}
          <div className="bg-[#F6F7F4] border border-[#D4DDD2] rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 text-xs text-[#35443B]">
              <p className="font-semibold text-[#143326]">
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
              <p className="text-[#4A5A50]">{weather.sawsIntegrationStatus}</p>
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
            <div className="bg-[#FFF9ED] border border-[#E6C98A] text-[#7A4A0B] rounded-2xl p-4 flex items-start gap-3 text-sm">
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
              <section className="lg:col-span-5 bg-[#143326] text-white rounded-2xl p-6 space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-[#B7DEC4] font-medium">Current Farm Conditions</p>
                    <p className="font-mono text-4xl font-bold tabular-nums mt-1">
                      {weather.current.temperatureC}°C
                    </p>
                    <p className="text-sm text-[#DCE8DF] mt-1">
                      {weather.current.weatherDescription}
                    </p>
                  </div>
                  <Sun className="w-9 h-9 text-[#B7DEC4]" />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#2D6A4F] text-xs">
                  <div>
                    <p className="text-[#B7DEC4]">Feels Like</p>
                    <p className="font-mono text-base font-semibold tabular-nums mt-0.5">
                      {weather.current.apparentTempC}°C
                    </p>
                  </div>
                  <div>
                    <p className="text-[#B7DEC4]">Humidity</p>
                    <p className="font-mono text-base font-semibold tabular-nums mt-0.5">
                      {weather.current.humidityPercent}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[#B7DEC4]">Wind Speed / Gusts</p>
                    <p className="font-mono text-base font-semibold tabular-nums mt-0.5">
                      {weather.current.windSpeedKmh} / {weather.current.windGustsKmh} km/h
                    </p>
                  </div>
                  <div>
                    <p className="text-[#B7DEC4]">Current Precip</p>
                    <p className="font-mono text-base font-semibold tabular-nums mt-0.5">
                      {weather.current.precipitationMm} mm
                    </p>
                  </div>
                </div>
              </section>

              <section className="lg:col-span-7 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#143326]">
                  Field Operations Weather Window
                </h2>
                <div className="divide-y divide-[#E2E6DF]">
                  <div className="py-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#143326]">Crop Spraying Window</p>
                      <p className="text-xs text-[#4A5A50] mt-0.5">
                        {weather.operationsWindow.sprayingReason}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold shrink-0 ${
                        weather.operationsWindow.sprayingStatus === 'Suitable'
                          ? 'text-[#1B4332]'
                          : weather.operationsWindow.sprayingStatus === 'Caution'
                          ? 'text-[#9A5B13]'
                          : 'text-[#8E2424]'
                      }`}
                    >
                      {weather.operationsWindow.sprayingStatus}
                    </span>
                  </div>

                  <div className="py-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#143326]">Planting & Seeding Window</p>
                      <p className="text-xs text-[#4A5A50] mt-0.5">
                        {weather.operationsWindow.plantingReason}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold shrink-0 ${
                        weather.operationsWindow.plantingStatus === 'Suitable'
                          ? 'text-[#1B4332]'
                          : weather.operationsWindow.plantingStatus === 'Caution'
                          ? 'text-[#9A5B13]'
                          : 'text-[#8E2424]'
                      }`}
                    >
                      {weather.operationsWindow.plantingStatus}
                    </span>
                  </div>

                  <div className="py-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#143326]">Irrigation Guidance</p>
                      <p className="text-xs text-[#4A5A50] mt-0.5">
                        {weather.operationsWindow.irrigationReason}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#1B4332] shrink-0">
                      {weather.operationsWindow.irrigationStatus}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Agricultural Warnings */}
          <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#9A5B13]" />
                <h2 className="font-display text-lg font-bold text-[#143326]">
                  Agricultural Weather Warnings ({weather.warnings.length})
                </h2>
              </div>
              <span className="text-xs text-[#4A5A50]">
                Generated from coordinate thresholds & farm crops/soils
              </span>
            </div>

            {weather.warnings.length === 0 ? (
              <p className="text-sm text-[#4A5A50] py-3 border-t border-[#E2E6DF]">
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
                        ? 'bg-[#FDF2F2] border-[#E8B4B4]'
                        : w.severity === 'Moderate'
                        ? 'bg-[#FFF9ED] border-[#E6C98A]'
                        : 'bg-[#F6F7F4] border-[#D4DDD2]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-base text-[#143326]">{w.title}</h3>
                      <span
                        className={`text-xs font-bold shrink-0 ${
                          w.severity === 'High'
                            ? 'text-[#8E2424]'
                            : w.severity === 'Moderate'
                            ? 'text-[#9A5B13]'
                            : 'text-[#1B4332]'
                        }`}
                      >
                        {w.severity} Alert
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-[#17201B] leading-relaxed">
                      <p>
                        <strong className="text-[#143326]">What is happening:</strong>{' '}
                        {w.whatIsHappening}
                      </p>
                      <p>
                        <strong className="text-[#143326]">Farm affected:</strong> {w.affectedFarm}
                      </p>
                      <p>
                        <strong className="text-[#143326]">Possible impact:</strong>{' '}
                        {w.possibleImpact}
                      </p>
                      <div>
                        <p className="font-semibold text-[#143326]">Recommended precautions:</p>
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
            <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-[#1B4332]" />
                <h2 className="font-display text-lg font-bold text-[#143326]">
                  Next 24-Hour Farm Forecast
                </h2>
              </div>
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-3 min-w-max">
                  {weather.hourly.slice(0, 12).map((h) => (
                    <div
                      key={h.time}
                      className="w-28 border border-[#E2E6DF] rounded-xl p-3 bg-[#FAFBF9] text-xs space-y-1.5"
                    >
                      <p className="font-mono font-semibold text-[#143326]">
                        {h.time.slice(11, 16)}
                      </p>
                      <p className="font-mono text-lg font-bold tabular-nums text-[#1B4332]">
                        {h.temperatureC}°C
                      </p>
                      <p className="font-mono tabular-nums text-[#4A5A50]">
                        Rain: {h.precipitationMm} mm
                        {h.precipProbabilityPercent != null ? ` (${h.precipProbabilityPercent}%)` : ''}
                      </p>
                      <p className="font-mono tabular-nums text-[#4A5A50] flex items-center gap-1">
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
            <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <CloudRain className="w-5 h-5 text-[#1B4332]" />
                <h2 className="font-display text-lg font-bold text-[#143326]">
                  7-Day Daily Forecast & Evapotranspiration (ET₀)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E6DF] text-xs text-[#4A5A50]">
                      <th className="py-2.5 pr-4 font-semibold">Date</th>
                      <th className="py-2.5 pr-4 font-semibold">Conditions</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Min / Max</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Rainfall</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Max Wind</th>
                      <th className="py-2.5 font-semibold text-right">Crop Water Loss (ET₀)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E6DF]">
                    {weather.daily.map((d) => (
                      <tr key={d.date}>
                        <td className="py-2.5 pr-4 font-mono tabular-nums font-semibold text-[#143326]">
                          {d.date}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-[#35443B]">
                          {d.weatherDescription}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                          {d.tempMinC}° / <span className="font-bold">{d.tempMaxC}°C</span>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#1B4332]">
                          {d.precipitationMm} mm
                          {d.precipProbabilityPercent != null ? ` (${d.precipProbabilityPercent}%)` : ''}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                          {d.windMaxKmh} km/h
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-[#4A5A50]">
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
          <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-[#1B4332]" />
                <h2 className="font-display text-lg font-bold text-[#143326]">
                  Historical Rainfall & Seasonal Climate Context
                </h2>
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-mono tabular-nums">
                <span>
                  Past 14 Days:{' '}
                  <strong className="text-[#143326]">
                    {weather.historicalRainfall.past14DaysMm != null
                      ? `${weather.historicalRainfall.past14DaysMm} mm`
                      : 'Unavailable'}
                  </strong>
                </span>
                <span>
                  Past 30 Days:{' '}
                  <strong className="text-[#143326]">
                    {weather.historicalRainfall.past30DaysMm != null
                      ? `${weather.historicalRainfall.past30DaysMm} mm`
                      : 'Unavailable'}
                  </strong>
                </span>
              </div>
            </div>

            <p className="text-xs text-[#4A5A50]">
              Seasonal Baseline: {weather.historicalRainfall.seasonalClimateNote}
            </p>

            {weather.historicalRainfall.historicalDays.length > 0 && (
              <div className="pt-2">
                <div className="flex items-end gap-1 h-28 border-b border-[#D4DDD2] pb-1">
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
                            hd.precipitationMm > 0 ? 'bg-[#2D6A4F]' : 'bg-[#E2E6DF]'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[11px] font-mono tabular-nums text-[#4A5A50] mt-1">
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
        </>
      )}
    </div>
  );
};
