import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Compass,
  Database,
  Droplets,
  FileText,
  Layers,
  Mountain,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiRequest, fetchPublicDatasets } from '../lib/api';
import { isLikelyOfflineError } from '../lib/offlineSync';
import { getSastDateString } from '../lib/saTime';
import { FarmItem, LanguageCode, PublicDatasetRecord, SoilLandIntelligence } from '../types';
import { SpeakButton } from './AccessibilityControls';

interface SoilLandViewProps {
  farms: FarmItem[];
  selectedFarmId: string | null;
  onSelectFarm: (farmId: string) => void;
  languageCode: LanguageCode;
  isSpeaking: boolean;
  speechSupported: boolean;
  onSpeak: (txt: string) => void;
  onStopSpeaking: () => void;
}

const FARMING_TYPE_FILTERS = [
  { value: '', label: 'All Farming Options' },
  { value: 'Horticulture', label: 'Vegetables & Horticulture' },
  { value: 'Field Crops', label: 'Maize & Field Crops' },
  { value: 'Livestock', label: 'Livestock & Mixed Grazing' },
  { value: 'Orchards', label: 'Perennial Orchards' },
];

export const SoilLandView: React.FC<SoilLandViewProps> = ({
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
  const activeFarm = farms.find((f) => f.id === activeFarmId) || farms[0] || null;

  const [farmingTypeFilter, setFarmingTypeFilter] = useState('');
  const [data, setData] = useState<SoilLandIntelligence | null>(null);
  const [publicDatasets, setPublicDatasets] = useState<PublicDatasetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload Laboratory Soil Report Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [labName, setLabName] = useState('ARC-ISCW Soil Analytical Laboratory');
  const [sampleCode, setSampleCode] = useState('');
  const [sampleDate, setSampleDate] = useState(getSastDateString());
  const [sampleDepth, setSampleDepth] = useState('0-20 cm');
  const [fieldId, setFieldId] = useState('');
  const [phWater, setPhWater] = useState('6.2');
  const [phKcl, setPhKcl] = useState('5.4');
  const [textureClass, setTextureClass] = useState('Sandy Clay Loam');
  const [clayPct, setClayPct] = useState('28');
  const [siltPct, setSiltPct] = useState('22');
  const [sandPct, setSandPct] = useState('50');
  const [omPct, setOmPct] = useState('2.4');
  const [nVal, setNVal] = useState('32');
  const [pVal, setPVal] = useState('24');
  const [kVal, setKVal] = useState('150');
  const [caVal, setCaVal] = useState('980');
  const [mgVal, setMgVal] = useState('210');
  const [cecVal, setCecVal] = useState('10.8');
  const [fertility, setFertility] = useState<'Low' | 'Moderate' | 'High' | 'Very High'>('Moderate');
  const [drainage, setDrainage] = useState<
    'Well Drained' | 'Moderately Well Drained' | 'Imperfectly Drained' | 'Poorly Drained'
  >('Well Drained');
  const [awcMm, setAwcMm] = useState('135');
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachmentSummary, setAttachmentSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [savingReport, setSavingReport] = useState(false);

  const loadSoilIntelligence = useCallback(async () => {
    if (!activeFarmId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = farmingTypeFilter ? `?farmingType=${encodeURIComponent(farmingTypeFilter)}` : '';
      const res = await apiRequest<SoilLandIntelligence>(
        `/api/soil-land/farms/${encodeURIComponent(activeFarmId)}${qs}`
      );
      setData(res);
    } catch (err: unknown) {
      if (isLikelyOfflineError(err)) {
        setError(
          'SoilGrids & ARC external coordinate terrain lookups require an active internet connection. Use Offline Sync to view downloaded farm, crop, and saved guide data.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Unable to load soil and land data.');
      }
    } finally {
      setLoading(false);
    }
  }, [activeFarmId, farmingTypeFilter]);

  useEffect(() => {
    loadSoilIntelligence();
  }, [loadSoilIntelligence]);

  useEffect(() => {
    fetchPublicDatasets()
      .then((res) =>
        setPublicDatasets(
          res.datasets.filter((d) =>
            ['soil', 'climate_agromet', 'elevation_terrain', 'geographical_boundaries'].includes(d.category)
          )
        )
      )
      .catch(() => {});
  }, []);

  const handleFileAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentName(file.name);
    if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')) {
      try {
        const text = await file.text();
        setAttachmentSummary(`Imported file ${file.name} (${Math.round(file.size / 1024)} KB)`);
        const lines = text.split(/\r?\n/).slice(0, 25);
        for (const line of lines) {
          const lower = line.toLowerCase();
          const numMatch = line.match(/([-+]?\d+(\.\d+)?)/);
          if (!numMatch) continue;
          if (lower.includes('ph') && lower.includes('kcl')) setPhKcl(numMatch[1]);
          else if (lower.includes('ph')) setPhWater(numMatch[1]);
          else if (lower.includes('organic')) setOmPct(numMatch[1]);
          else if (lower.includes('phosphorus') || lower.startsWith('p,')) setPVal(numMatch[1]);
          else if (lower.includes('potassium') || lower.startsWith('k,')) setKVal(numMatch[1]);
          else if (lower.includes('nitrogen') || lower.startsWith('n,')) setNVal(numMatch[1]);
          else if (lower.includes('clay')) setClayPct(numMatch[1]);
          else if (lower.includes('cec')) setCecVal(numMatch[1]);
        }
      } catch {
        setAttachmentSummary(`Attached ${file.name}`);
      }
    } else {
      setAttachmentSummary(`Attached laboratory document: ${file.name}`);
    }
  };

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarmId) return;
    setSavingReport(true);
    setError(null);
    try {
      await apiRequest(`/api/soil-land/farms/${encodeURIComponent(activeFarmId)}/reports`, {
        method: 'POST',
        body: JSON.stringify({
          fieldId: fieldId || null,
          laboratoryName: labName,
          sampleCode: sampleCode || `LAB-${sampleDate}`,
          sampleDate,
          sampleDepthCm: sampleDepth,
          soilPhWater: phWater,
          soilPhKcl: phKcl,
          soilTextureClass: textureClass,
          clayPercent: clayPct,
          siltPercent: siltPct,
          sandPercent: sandPct,
          organicMatterPercent: omPct,
          nitrogenMgKg: nVal,
          phosphorusMgKg: pVal,
          potassiumMgKg: kVal,
          calciumMgKg: caVal,
          magnesiumMgKg: mgVal,
          cecCmolKg: cecVal,
          fertilityRating: fertility,
          drainageClass: drainage,
          waterHoldingCapacityMmPerM: awcMm,
          attachmentFileName: attachmentName,
          attachmentSummary,
          notes,
        }),
      });
      setShowUploadModal(false);
      await loadSoilIntelligence();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save soil laboratory report.');
    } finally {
      setSavingReport(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      await apiRequest(`/api/soil-land/reports/${encodeURIComponent(reportId)}`, {
        method: 'DELETE',
      });
      await loadSoilIntelligence();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete soil report.');
    }
  };

  if (farms.length === 0) {
    return (
      <div className="bg-white border border-[#CBD5E1] rounded-2xl p-8 text-center space-y-2">
        <Mountain className="w-8 h-8 text-[#0B3D91] mx-auto" />
        <h2 className="font-display text-xl font-bold text-[#0B1F3A]">
          No Registered Farm Locations Found
        </h2>
        <p className="text-sm text-[#475569]">
          Register a farm in Farms & GPS Map to inspect coordinate-specific soil datasets, elevation, and land suitability.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
            Soil & Land Intelligence
          </h1>
          <p className="text-sm text-[#475569]">
            Distinguishes verified laboratory soil measurements from satellite/provincial mapped estimates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={activeFarmId}
            onChange={(e) => onSelectFarm(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-semibold text-[#0B1F3A] min-h-[42px]"
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                Farm: {f.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold min-h-[42px] cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Lab Soil Report</span>
          </button>

          <button
            type="button"
            onClick={loadSoilIntelligence}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#EFF6FF] text-sm font-semibold text-[#0B1F3A] min-h-[42px] cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="bg-white border border-[#CBD5E1] rounded-2xl p-8 text-sm text-[#475569]">
          Querying elevation, SoilGrids coordinates, and laboratory records...
        </div>
      )}

      {data && (
        <>
          {/* Honest Scientific Distinction Banner */}
          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-3xl">
              <p className="text-sm font-semibold text-[#0B1F3A]">
                {data.hasLabReport
                  ? `Laboratory Soil Report Active (${data.latestLabReport?.laboratoryName}, sampled ${data.latestLabReport?.sampleDate})`
                  : 'No Laboratory Soil Report Uploaded — Showing Mapped Geospatial Estimates Only'}
              </p>
              <p className="text-xs text-[#334155]">
                Mapped estimates from ISRIC SoilGrids (250 m grid) and ARC-ISCW references provide broad regional guidance only. They never substitute for a composite 0–20 cm laboratory soil analysis, and Field Shift never guarantees crop yields.
              </p>
            </div>
            <SpeakButton
              text={`Soil and land summary for ${data.farmName}. Elevation ${data.landIntelligence.elevationMeters ?? 'unknown'} meters. ${
                data.hasLabReport
                  ? `Latest lab soil report from ${data.latestLabReport?.laboratoryName} shows pH ${data.latestLabReport?.soilPhWater} and texture ${data.latestLabReport?.soilTextureClass}.`
                  : 'No laboratory soil report has been uploaded yet; only mapped geospatial estimates are shown.'
              }`}
              languageCode={languageCode}
              isSpeaking={isSpeaking}
              onSpeak={onSpeak}
              onStop={onStopSpeaking}
              supported={speechSupported}
              label="Read Soil Brief"
            />
          </div>

          {/* Land Intelligence Section */}
          <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Mountain className="w-5 h-5 text-[#0B3D91]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Land & Environmental Intelligence
                </h2>
              </div>
              <span className="text-xs font-mono tabular-nums text-[#475569]">
                {data.coordinates.latitude.toFixed(5)}, {data.coordinates.longitude.toFixed(5)} ·{' '}
                {data.coordinates.locationSource === 'gps'
                  ? 'GPS Coordinate'
                  : data.coordinates.locationSource === 'manual_map_pin'
                  ? 'Manual Map Pin'
                  : 'Municipal Reference'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2 border-t border-[#E2E8F0]">
              <div>
                <p className="text-xs text-[#475569]">Elevation</p>
                <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                  {data.landIntelligence.elevationMeters != null
                    ? `${data.landIntelligence.elevationMeters} m ASL`
                    : 'Not available'}
                </p>
                <p className="text-xs text-[#475569] mt-0.5">{data.landIntelligence.elevationSource}</p>
              </div>
              <div>
                <p className="text-xs text-[#475569]">Terrain & Physiography</p>
                <p className="text-sm font-semibold text-[#0B1F3A] mt-1">
                  {data.landIntelligence.terrainProfile}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#475569]">Water Availability</p>
                <p className="text-sm font-semibold text-[#0B1F3A] mt-1 flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-[#0B3D91] shrink-0" />
                  <span>{data.landIntelligence.waterAvailabilitySummary}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-[#475569]">Rainfall Pattern</p>
                <p className="font-mono font-semibold tabular-nums text-sm text-[#0B1F3A] mt-1">
                  {data.landIntelligence.annualRainfallPattern}
                </p>
                <p className="text-xs text-[#475569] mt-0.5">{data.landIntelligence.climateZone}</p>
              </div>
              <div>
                <p className="text-xs text-[#475569]">Temperature Pattern</p>
                <p className="text-sm text-[#0F172A] mt-1">{data.landIntelligence.temperaturePattern}</p>
              </div>
              <div>
                <p className="text-xs text-[#475569]">Environmental Conditions</p>
                <p className="text-sm text-[#0F172A] mt-1">
                  {data.landIntelligence.environmentalConditions}
                </p>
              </div>
            </div>
          </section>

          {/* Soil Metrics Table (Measured vs Mapped Comparison) */}
          <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#174C3C]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Soil Profile: Laboratory Measurements vs. Mapped Estimates
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
              >
                + Add Laboratory Test Result
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-xs text-[#475569]">
                    <th className="py-2.5 pr-4 font-semibold">Soil Property</th>
                    <th className="py-2.5 pr-4 font-semibold">Uploaded Lab Measurement</th>
                    <th className="py-2.5 pr-4 font-semibold">Mapped Geospatial Estimate</th>
                    <th className="py-2.5 font-semibold">Provenance & Reliability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {data.soilMetrics.map((m) => (
                    <tr key={m.key}>
                      <td className="py-3 pr-4 font-semibold text-[#0B1F3A]">{m.label}</td>
                      <td className="py-3 pr-4 font-mono tabular-nums">
                        {m.labValue ? (
                          <span className="font-bold text-[#174C3C]">{m.labValue}</span>
                        ) : (
                          <span className="text-[#64748B] text-xs">Not measured in lab</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-mono tabular-nums text-[#334155]">
                        {m.mappedEstimate || <span className="text-xs text-[#64748B]">Unavailable</span>}
                      </td>
                      <td className="py-3 text-xs">
                        <span
                          className={`font-semibold ${
                            m.sourceType === 'laboratory_measurement'
                              ? 'text-[#174C3C]'
                              : m.sourceType === 'mapped_estimate'
                              ? 'text-[#B45309]'
                              : 'text-[#B91C1C]'
                          }`}
                        >
                          {m.sourceType === 'laboratory_measurement'
                            ? 'Verified Lab Data'
                            : m.sourceType === 'mapped_estimate'
                            ? 'Mapped Estimate Only'
                            : 'Missing Data'}
                        </span>
                        <span className="text-[#475569]"> · {m.sourceNote}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Uploaded Soil Lab Reports List & Data Source Integrations */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-6 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0B3D91]" />
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Laboratory Soil Reports ({data.allLabReports.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record New Report</span>
                </button>
              </div>

              {data.allLabReports.length === 0 ? (
                <div className="py-6 text-center space-y-2 border-t border-[#E2E8F0]">
                  <p className="text-sm text-[#475569]">
                    No laboratory soil reports uploaded for {data.farmName} yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[#0B3D91] text-xs font-semibold cursor-pointer min-h-[40px]"
                  >
                    Upload Soil Test Now
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {data.allLabReports.map((rep) => (
                    <div key={rep.id} className="py-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-[#0B1F3A]">
                            {rep.laboratoryName} · Sample {rep.sampleCode}
                          </p>
                          <p className="text-xs text-[#475569] font-mono tabular-nums">
                            {rep.sampleDate} · Depth {rep.sampleDepthCm}
                            {rep.fieldName ? ` · Field: ${rep.fieldName}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteReport(rep.id)}
                          aria-label="Delete soil report"
                          className="p-1.5 rounded-lg text-[#B91C1C] hover:bg-[#FEF2F2] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-[#0F172A] font-mono tabular-nums">
                        pH(H₂O) {rep.soilPhWater ?? '—'} · {rep.soilTextureClass} · OM{' '}
                        {rep.organicMatterPercent ?? '—'}% · P {rep.phosphorusMgKg ?? '—'} · K{' '}
                        {rep.potassiumMgKg ?? '—'} mg/kg
                      </p>
                      {rep.attachmentFileName && (
                        <p className="text-xs text-[#174C3C]">
                          File: {rep.attachmentFileName}
                          {rep.attachmentSummary ? ` — ${rep.attachmentSummary}` : ''}
                        </p>
                      )}
                      {rep.notes && <p className="text-xs text-[#475569]">{rep.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="lg:col-span-6 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#0B3D91]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Connected South African & Geospatial Datasets
                </h2>
              </div>
              <div className="divide-y divide-[#E2E8F0]">
                {data.dataSources.map((src) => (
                  <div key={src.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#0B1F3A]">{src.name}</p>
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          src.status === 'farmer_uploaded' || src.status === 'connected'
                            ? 'text-[#174C3C]'
                            : src.status === 'reference_only'
                            ? 'text-[#B45309]'
                            : 'text-[#64748B]'
                        }`}
                      >
                        {src.status === 'farmer_uploaded'
                          ? 'Lab Data Active'
                          : src.status === 'connected'
                          ? 'Live Connected'
                          : src.status === 'reference_only'
                          ? 'Regional Reference'
                          : 'Unavailable / Not Uploaded'}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569] leading-relaxed">{src.summary}</p>
                  </div>
                ))}
              </div>

              {publicDatasets.length > 0 && (
                <div className="pt-3 border-t border-[#E2E8F0] space-y-2.5">
                  <p className="text-xs font-mono uppercase tracking-wider text-[#0B3D91] font-semibold">
                    Public Dataset Provenance & Limitations
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {publicDatasets.map((ds) => (
                      <div key={ds.id} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-xs space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#0B1F3A]">{ds.sourceName}</span>
                          <span className="font-mono text-[11px] text-[#475569]">{ds.units}</span>
                        </div>
                        <p className="text-[#334155] font-medium">{ds.datasetOrApiName}</p>
                        <p className="text-[#475569]">Licence: {ds.licenceAndTerms}</p>
                        <p className="text-[#B45309]">Limitation: {ds.limitations}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Land Suitability Analysis */}
          <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#0B3D91]" />
                  <h2 className="font-display text-xl font-bold text-[#0B1F3A]">
                    Land Suitability & Enterprise Assessment
                  </h2>
                </div>
                <p className="text-xs text-[#475569]">
                  Cross-analyses soil metrics, rainfall, elevation, water availability, farm size ({activeFarm?.farmSizeHectares} ha), and farmer experience. Suitability never guarantees yield or profit.
                </p>
              </div>

              <select
                value={farmingTypeFilter}
                onChange={(e) => setFarmingTypeFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-[#CBD5E1] bg-white text-sm font-semibold text-[#0B1F3A] min-h-[40px]"
              >
                {FARMING_TYPE_FILTERS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    Focus: {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {data.suitabilityOptions.map((opt) => (
                <article
                  key={opt.id}
                  className="border border-[#E2E8F0] rounded-2xl p-5 bg-[#F8FAFC] space-y-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-[#475569]">{opt.category}</span>
                      <span
                        className={`font-semibold ${
                          opt.suitabilityLevel === 'Well Suited'
                            ? 'text-[#174C3C]'
                            : opt.suitabilityLevel === 'Conditionally Suitable'
                            ? 'text-[#B45309]'
                            : 'text-[#B91C1C]'
                        }`}
                      >
                        {opt.suitabilityLevel}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                      {opt.farmingOption}
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs text-[#334155] leading-relaxed">
                    <div>
                      <p className="font-semibold text-[#0B1F3A]">1. Why this option may be suitable</p>
                      <p className="mt-0.5">{opt.whySuitable}</p>
                    </div>

                    <div>
                      <p className="font-semibold text-[#0B1F3A]">2. Supporting information</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {opt.supportingInformation.map((item) => (
                          <li key={item}>· {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold text-[#B45309]">3. Missing information</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {opt.missingInformation.map((item) => (
                          <li key={item}>· {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold text-[#B91C1C]">4. Possible limitations</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {opt.possibleLimitations.map((item) => (
                          <li key={item}>· {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold text-[#0B1F3A]">5. Additional assessments required</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {opt.additionalAssessmentsRequired.map((item) => (
                          <li key={item}>· {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Upload Laboratory Soil Report Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-[#0B1F3A]/50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleUploadReport}
            className="bg-white border border-[#CBD5E1] rounded-2xl max-w-2xl w-full p-6 space-y-4 my-8"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                Upload Laboratory Soil Report ({activeFarm?.name})
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-2 rounded-lg hover:bg-[#F8FAFC] text-[#475569] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3.5 text-xs text-[#0B1F3A] flex flex-wrap items-center justify-between gap-2">
              <span>Optional: Attach CSV/TXT/PDF lab file (CSV values auto-populate below)</span>
              <input
                type="file"
                accept=".csv,.txt,.pdf,.jpg,.png"
                onChange={handleFileAttachment}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Laboratory Name *
                </label>
                <input
                  required
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Sample Code
                </label>
                <input
                  value={sampleCode}
                  onChange={(e) => setSampleCode(e.target.value)}
                  placeholder="e.g. CED-2026-991"
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Sample Date *
                </label>
                <input
                  type="date"
                  required
                  value={sampleDate}
                  onChange={(e) => setSampleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Field (Optional)
                </label>
                <select
                  value={fieldId}
                  onChange={(e) => setFieldId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white"
                >
                  <option value="">Whole Farm Composite</option>
                  {activeFarm?.fields.map((fl) => (
                    <option key={fl.id} value={fl.id}>
                      {fl.name} ({fl.areaHectares} ha)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Soil Texture Class *
                </label>
                <input
                  required
                  value={textureClass}
                  onChange={(e) => setTextureClass(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Sample Depth
                </label>
                <input
                  value={sampleDepth}
                  onChange={(e) => setSampleDepth(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">pH (H₂O)</label>
                <input
                  type="number"
                  step="0.1"
                  value={phWater}
                  onChange={(e) => setPhWater(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">pH (KCl)</label>
                <input
                  type="number"
                  step="0.1"
                  value={phKcl}
                  onChange={(e) => setPhKcl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">OM (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={omPct}
                  onChange={(e) => setOmPct(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  CEC (cmol/kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={cecVal}
                  onChange={(e) => setCecVal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">N (mg/kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={nVal}
                  onChange={(e) => setNVal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">P (mg/kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={pVal}
                  onChange={(e) => setPVal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">K (mg/kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={kVal}
                  onChange={(e) => setKVal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">AWC (mm/m)</label>
                <input
                  type="number"
                  step="1"
                  value={awcMm}
                  onChange={(e) => setAwcMm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Clay / Silt / Sand (%)
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <input
                    type="number"
                    placeholder="Clay"
                    value={clayPct}
                    onChange={(e) => setClayPct(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-[#CBD5E1] text-xs font-mono"
                  />
                  <input
                    type="number"
                    placeholder="Silt"
                    value={siltPct}
                    onChange={(e) => setSiltPct(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-[#CBD5E1] text-xs font-mono"
                  />
                  <input
                    type="number"
                    placeholder="Sand"
                    value={sandPct}
                    onChange={(e) => setSandPct(e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-[#CBD5E1] text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Fertility Rating
                </label>
                <select
                  value={fertility}
                  onChange={(e) =>
                    setFertility(e.target.value as 'Low' | 'Moderate' | 'High' | 'Very High')
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white"
                >
                  <option value="Low">Low</option>
                  <option value="Moderate">Moderate</option>
                  <option value="High">High</option>
                  <option value="Very High">Very High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Drainage Class
                </label>
                <select
                  value={drainage}
                  onChange={(e) =>
                    setDrainage(
                      e.target.value as
                        | 'Well Drained'
                        | 'Moderately Well Drained'
                        | 'Imperfectly Drained'
                        | 'Poorly Drained'
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white"
                >
                  <option value="Well Drained">Well Drained</option>
                  <option value="Moderately Well Drained">Moderately Well Drained</option>
                  <option value="Imperfectly Drained">Imperfectly Drained</option>
                  <option value="Poorly Drained">Poorly Drained</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">
                Agronomist / Lab Recommendations
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Apply 1.5 t/ha dolomitic lime prior to planting..."
                className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-sm"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 rounded-xl border border-[#CBD5E1] text-sm font-semibold text-[#0B1F3A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingReport}
                className="px-5 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {savingReport ? 'Saving Report...' : 'Save Laboratory Report'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!loading && data && !data.hasLabReport && (
        <div className="bg-white border border-[#CBD5E1] rounded-xl px-4 py-3 flex items-center gap-2 text-xs text-[#475569]">
          <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0" />
          <span>
            Tip: Upload an actual lab report for {data.farmName} to unlock verified N-P-K and KCl lime recommendations.
          </span>
        </div>
      )}
    </div>
  );
};
