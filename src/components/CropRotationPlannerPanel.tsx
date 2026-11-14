import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Droplets,
  Layers,
  Loader2,
  RefreshCw,
  Satellite,
  Sprout,
} from 'lucide-react';
import { analyzeCropRotation, fetchCropRotationCatalog } from '../lib/api';
import { CropRotationAnalysisPayload, CropRotationCatalogOption } from '../types';

interface CropRotationPlannerPanelProps {
  farmId?: string | null;
  province?: string;
  waterAvailability?: string;
  soilType?: string;
  soilPh?: number | null;
  farmSizeHectares?: number;
  provinces?: { name: string }[];
}

export const CropRotationPlannerPanel: React.FC<CropRotationPlannerPanelProps> = ({
  farmId,
  province: propProvince,
  waterAvailability: propWater,
  soilType: propSoilType,
  soilPh: propSoilPh,
  farmSizeHectares: propHa,
  provinces = [],
}) => {
  const [catalog, setCatalog] = useState<CropRotationCatalogOption[]>([]);
  const [selectedCropIds, setSelectedCropIds] = useState<string[]>([
    'maize',
    'dry_beans',
    'sunflower',
    'cabbage_brassica',
    'spinach_swiss_chard',
  ]);
  const [province, setProvince] = useState(propProvince || 'Free State');
  const [waterAvailability, setWaterAvailability] = useState(
    propWater || 'Borehole & Drip Irrigation'
  );
  const [soilType, setSoilType] = useState(propSoilType || 'Sandy Loam');
  const [soilPhInput, setSoilPhInput] = useState(
    propSoilPh !== null && propSoilPh !== undefined ? String(propSoilPh) : '6.1'
  );
  const [farmSizeHa, setFarmSizeHa] = useState(propHa ? String(propHa) : '5');
  const [farmerPriority, setFarmerPriority] = useState(
    'Balanced soil health, input resilience, and rotational diversity'
  );

  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CropRotationAnalysisPayload | null>(null);

  useEffect(() => {
    if (propProvince) setProvince(propProvince);
  }, [propProvince]);

  useEffect(() => {
    if (propWater) setWaterAvailability(propWater);
  }, [propWater]);

  useEffect(() => {
    if (propSoilType) setSoilType(propSoilType);
  }, [propSoilType]);

  useEffect(() => {
    if (propSoilPh !== null && propSoilPh !== undefined) {
      setSoilPhInput(String(propSoilPh));
    }
  }, [propSoilPh]);

  useEffect(() => {
    if (propHa) setFarmSizeHa(String(propHa));
  }, [propHa]);

  useEffect(() => {
    let active = true;
    setLoadingCatalog(true);
    fetchCropRotationCatalog()
      .then((rows) => {
        if (!active) return;
        setCatalog(rows);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load crop rotation catalog.');
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleCrop = (cropId: string) => {
    setSelectedCropIds((prev) => {
      if (prev.includes(cropId)) {
        return prev.length > 1 ? prev.filter((id) => id !== cropId) : prev;
      }
      if (prev.length >= 5) {
        return [...prev.slice(1), cropId];
      }
      return [...prev, cropId];
    });
  };

  const runAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setRunning(true);
    try {
      const parsedPh = Number(soilPhInput);
      const parsedHa = Number(farmSizeHa);
      const res = await analyzeCropRotation({
        farmId: farmId || null,
        province,
        waterAvailability,
        soilType,
        soilPh: Number.isFinite(parsedPh) ? parsedPh : undefined,
        farmSizeHectares: Number.isFinite(parsedHa) && parsedHa > 0 ? parsedHa : 5,
        farmerPriority,
        selectedCrops: selectedCropIds.slice(0, 5),
      });
      setAnalysis(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze rotation scenario.');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (!loadingCatalog && catalog.length > 0 && !analysis && !running) {
      void runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingCatalog, farmId]);

  const provinceOptions =
    provinces.length > 0
      ? provinces.map((p) => p.name)
      : [
          'Eastern Cape',
          'Free State',
          'Gauteng',
          'KwaZulu-Natal',
          'Limpopo',
          'Mpumalanga',
          'North West',
          'Northern Cape',
          'Western Cape',
        ];

  return (
    <div className="bg-white border border-slate-300 rounded-md shadow-xs p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
            <CalendarRange className="w-4 h-4 shrink-0" />
            <span>Multi-Season Crop Rotation & Scenario Analysis</span>
          </div>
          <h3 className="text-lg font-bold text-[#0B1F3A] mt-1">
            Compare Up to 5 Crops & Plan a 3-Season Botanical Rotation
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Evaluates botanical crop families (Poaceae, Fabaceae, Brassicaceae, Asteraceae, Solanaceae, Amaranthaceae), topsoil pH, water availability, and NASA POWER regional climate conditions across 3 growing seasons.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runAnalysis()}
          disabled={running || selectedCropIds.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0B1F3A] text-white text-sm font-semibold hover:bg-[#14345c] disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          {running ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span>{running ? 'Analyzing...' : 'Run 3-Season Scenario'}</span>
        </button>
      </div>

      {/* Scenario Parameters */}
      <form onSubmit={(e) => void runAnalysis(e)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {!farmId && (
            <div className="min-w-0">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Province
              </label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900"
              >
                {provinceOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Water Availability
            </label>
            <select
              value={waterAvailability}
              onChange={(e) => setWaterAvailability(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900"
            >
              <option value="Seasonal Rainfall Only (Dryland)">Seasonal Rainfall Only (Dryland)</option>
              <option value="Borehole & Drip Irrigation">Borehole & Drip Irrigation</option>
              <option value="Farm Dam & Gravity Irrigation">Farm Dam & Gravity Irrigation</option>
              <option value="River Abstraction / Pivot Irrigation">River Abstraction / Pivot Irrigation</option>
              <option value="Municipal / Tanker Buffer">Municipal / Tanker Buffer</option>
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Soil Texture
            </label>
            <select
              value={soilType}
              onChange={(e) => setSoilType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900"
            >
              <option value="Sandy">Sandy</option>
              <option value="Sandy Loam">Sandy Loam</option>
              <option value="Clay Loam">Clay Loam</option>
              <option value="Clay">Clay</option>
              <option value="Alluvial Loam">Alluvial Loam</option>
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Topsoil pH (H₂O)
            </label>
            <input
              type="number"
              step="0.1"
              min="4.0"
              max="8.5"
              value={soilPhInput}
              onChange={(e) => setSoilPhInput(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono bg-white text-slate-900"
            />
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Farmer Priority
            </label>
            <select
              value={farmerPriority}
              onChange={(e) => setFarmerPriority(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white text-slate-900"
            >
              <option value="Balanced soil health, input resilience, and rotational diversity">
                Balanced Soil Health & Resilience
              </option>
              <option value="Soil nitrogen recovery and pest cycle break">
                Soil Nitrogen Recovery First
              </option>
              <option value="High market turnover and shorter growing cycles">
                Market Turnover & Shorter Cycles
              </option>
            </select>
          </div>
        </div>

        {/* Crop selection up to 5 */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Select up to 5 Crops to Compare ({selectedCropIds.length}/5 selected)
            </span>
            <span className="text-xs text-slate-500">
              Mixing families (e.g. Poaceae + Fabaceae + Brassicaceae) reduces soil disease carryover.
            </span>
          </div>

          {loadingCatalog ? (
            <div className="text-sm text-slate-500 flex items-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading South African crop catalog...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {catalog.map((crop) => {
                const isSelected = selectedCropIds.includes(crop.id);
                return (
                  <button
                    key={crop.id}
                    type="button"
                    onClick={() => toggleCrop(crop.id)}
                    className={`text-left p-3 rounded border transition-colors ${
                      isSelected
                        ? 'border-emerald-700 bg-emerald-50/70'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm text-[#0B1F3A] break-words">
                        {crop.name}
                      </span>
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          isSelected ? 'text-emerald-800' : 'text-slate-500'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {crop.botanicalFamily} · {crop.preferredSeason} · Water: {crop.waterNeed}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </form>

      {error && (
        <div className="p-3 rounded border border-red-300 bg-red-50 text-sm text-red-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
          <span>{error}</span>
        </div>
      )}

      {analysis && (
        <div className="space-y-5 pt-2 border-t border-slate-200">
          {/* Context & Climate Grounding Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded p-3.5 text-xs">
            <div className="space-y-1">
              <div className="font-semibold text-[#0B1F3A] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-600" />
                <span>Site & Soil Basis: {analysis.siteContext.label}</span>
              </div>
              <p className="text-slate-600">
                {analysis.siteContext.province} ({analysis.siteContext.rainfallRegime}) ·{' '}
                {analysis.siteContext.soilType} (pH {analysis.siteContext.soilPh}) ·{' '}
                {analysis.siteContext.waterAvailability}
              </p>
              <p className="text-slate-500">Source: {analysis.siteContext.soilDataSource}</p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-[#0B1F3A] flex items-center gap-1.5">
                <Satellite className="w-3.5 h-3.5 text-[#0B3D91]" />
                <span>NASA POWER Climate Grounding</span>
              </div>
              <p className="text-slate-600">{analysis.climateSource.note}</p>
              {analysis.climateSource.available && (
                <p className="font-mono text-slate-700">
                  Recent 2020–2024 rain: {analysis.climateSource.recentAnnualRainfallMm ?? '—'} mm/yr
                  (baseline {analysis.climateSource.baselineAnnualRainfallMm ?? '—'} mm/yr) · Mean Tmax:{' '}
                  {analysis.climateSource.avgMaxTempC ?? '—'}°C
                </p>
              )}
            </div>
          </div>

          {/* 3-Growing-Season Rotation Plan */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-2">
              <Sprout className="w-4 h-4 text-emerald-700" />
              <span>Recommended 3-Growing-Season Rotation Sequence</span>
            </h4>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {analysis.threeSeasonRotation.map((s) => (
                <div
                  key={s.seasonNumber}
                  className="border border-slate-300 rounded bg-white p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-500 uppercase">
                          {s.seasonLabel}
                        </div>
                        <div className="text-base font-bold text-[#0B1F3A] mt-0.5 break-words">
                          {s.recommendedCropName}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold shrink-0 ${
                          s.suitabilityLevel === 'Strong Fit'
                            ? 'text-emerald-800'
                            : s.suitabilityLevel === 'Conditional Fit'
                              ? 'text-amber-800'
                              : 'text-red-800'
                        }`}
                      >
                        {s.suitabilityLevel}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 font-medium">
                      Family: {s.botanicalFamily} · {s.nitrogenRole} · Window: {s.plantingWindow}
                    </div>

                    <div className="space-y-1 text-xs text-slate-700 pt-1">
                      <div className="font-semibold text-[#0B1F3A]">Why Selected:</div>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {s.suitabilityReasons.map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-1 text-xs text-slate-700 pt-1">
                      <div className="font-semibold text-emerald-900">Key Benefits:</div>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {s.benefits.map((b, idx) => (
                          <li key={idx}>{b}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-1 text-xs text-amber-900 bg-amber-50/70 border border-amber-200 rounded p-2">
                      <div className="font-semibold">Risks to Manage:</div>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {s.risks.map((rk, idx) => (
                          <li key={idx}>{rk}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 text-xs text-slate-700">
                    <div className="font-semibold text-[#0B1F3A] mb-1">
                      Planting Checklist:
                    </div>
                    <ul className="space-y-1">
                      {s.plantingChecklist.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Crop Comparison Table (up to 5 selected crops) */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-[#0B1F3A] uppercase tracking-wide">
              Side-by-Side Comparison ({analysis.comparedCrops.length} Selected Crop Options)
            </h4>
            <div className="overflow-x-auto border border-slate-300 rounded">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-[#0B1F3A] border-b border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Crop Option</th>
                    <th className="py-2.5 px-3 font-semibold">Botanical Family</th>
                    <th className="py-2.5 px-3 font-semibold">Water Need</th>
                    <th className="py-2.5 px-3 font-semibold">Target pH</th>
                    <th className="py-2.5 px-3 font-semibold">Site Fit</th>
                    <th className="py-2.5 px-3 font-semibold">Agronomic Assessment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {analysis.comparedCrops.map((row) => (
                    <tr key={row.cropId}>
                      <td className="py-2.5 px-3 font-semibold text-[#0B1F3A] whitespace-nowrap">
                        {row.cropName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {row.botanicalFamily}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {row.waterNeed}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {row.idealPhRange[0]}–{row.idealPhRange[1]}
                      </td>
                      <td
                        className={`py-2.5 px-3 font-bold whitespace-nowrap ${
                          row.suitabilityScoreLabel === 'High Fit'
                            ? 'text-emerald-800'
                            : row.suitabilityScoreLabel === 'Moderate Fit'
                              ? 'text-amber-800'
                              : 'text-red-800'
                        }`}
                      >
                        {row.suitabilityScoreLabel}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 min-w-[260px]">
                        {row.suitabilityReason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Soil Health Implications & Moisture Alignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded border border-slate-200 bg-slate-50 space-y-2">
              <div className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-1.5">
                <Sprout className="w-4 h-4 text-emerald-700" />
                <span>Soil Health Implications</span>
              </div>
              <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
                {analysis.soilHealthImplications.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded border border-slate-200 bg-slate-50 space-y-2">
              <div className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wide flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-[#0B3D91]" />
                <span>Rainfall, Climate & Water Alignment</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {analysis.climateAndMoistureAlignment}
              </p>
            </div>
          </div>

          {/* Explicit Assumptions, Limitations & Non-Guarantee Disclaimer */}
          <div className="p-4 rounded border border-amber-300 bg-amber-50 space-y-2 text-xs text-amber-950">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-800" />
              <span>Scenario Assumptions, Limitations & Non-Guarantee Notice</span>
            </div>
            <p className="font-semibold text-red-900">{analysis.disclaimer}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <div className="font-semibold mb-1">Explicit Assumptions:</div>
                <ul className="list-disc pl-4 space-y-0.5 text-amber-900">
                  {analysis.assumptions.map((a, idx) => (
                    <li key={idx}>{a}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-1">Key Limitations:</div>
                <ul className="list-disc pl-4 space-y-0.5 text-amber-900">
                  {analysis.limitations.map((l, idx) => (
                    <li key={idx}>{l}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
