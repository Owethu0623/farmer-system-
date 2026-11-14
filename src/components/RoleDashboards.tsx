import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Beef,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Compass,
  Droplets,
  Layers,
  MapPin,
  Search,
  Shield,
  Sprout,
  Tractor,
  Users,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  AdminStats,
  AuditLogItem,
  AuthUser,
  BeginnerGuide,
  CropAnalytics,
  FarmItem,
  FarmingOpportunity,
  LanguageCode,
  LivestockAnalytics,
  MixedFarmingSummary,
  ProvinceInfo,
  RoleCode,
} from '../types';
import { SpeakButton } from './AccessibilityControls';

interface RoleDashboardProps {
  user: AuthUser;
  farms: FarmItem[];
  selectedFarmId: string | null;
  onSelectFarm: (id: string) => void;
  onOpenFarmsView: () => void;
  onOpenCropsView: () => void;
  onOpenLivestockView: () => void;
  onOpenMixedView: () => void;
  onOpenSoilLandView: () => void;
  onOpenWeatherView: () => void;
  onOpenVisualView: () => void;
  onOpenStockView: () => void;
  onOpenIncidentsView: () => void;
  onOpenAdvisorView: () => void;
  refreshKey: number;
  provinces: ProvinceInfo[];
  languageCode: LanguageCode;
  isSpeaking: boolean;
  speechSupported: boolean;
  onSpeak: (txt: string) => void;
  onStopSpeaking: () => void;
}

export const RoleDashboard: React.FC<RoleDashboardProps> = ({
  user,
  farms,
  selectedFarmId,
  onSelectFarm,
  onOpenFarmsView,
  onOpenCropsView,
  onOpenLivestockView,
  onOpenMixedView,
  onOpenSoilLandView,
  onOpenWeatherView,
  onOpenVisualView,
  onOpenStockView,
  onOpenIncidentsView,
  onOpenAdvisorView,
  refreshKey,
  provinces,
  languageCode,
  isSpeaking,
  speechSupported,
  onSpeak,
  onStopSpeaking,
}) => {
  // Prospective Farmer state
  const [opportunities, setOpportunities] = useState<FarmingOpportunity[]>([]);
  const [guides, setGuides] = useState<BeginnerGuide[]>([]);
  const [checkedPlanSteps, setCheckedPlanSteps] = useState<string[]>([
    'Define target buyer within 50km',
  ]);
  const [selectedProvinceName, setSelectedProvinceName] = useState<string>(
    user.profile?.province || provinces[0]?.name || 'KwaZulu-Natal'
  );

  // Admin state
  const [adminUsers, setAdminUsers] = useState<AuthUser[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);

  // Existing Farmer live metrics state
  const [cropStats, setCropStats] = useState<CropAnalytics | null>(null);
  const [livestockStats, setLivestockStats] = useState<LivestockAnalytics | null>(null);
  const [mixedSummary, setMixedSummary] = useState<MixedFarmingSummary | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const activeExistingFarm = useMemo(
    () => farms.find((f) => f.id === selectedFarmId) || farms[0] || null,
    [farms, selectedFarmId]
  );

  useEffect(() => {
    if (user.roleCode === 'prospective_farmer') {
      apiRequest<{ opportunities: FarmingOpportunity[]; beginnerGuides: BeginnerGuide[] }>(
        '/api/discovery/opportunities'
      )
        .then((d) => {
          setOpportunities(d.opportunities);
          setGuides(d.beginnerGuides);
        })
        .catch(() => {});
    }
  }, [user.roleCode]);

  useEffect(() => {
    if (
      user.roleCode === 'existing_farmer' ||
      user.roleCode === 'agricultural_expert' ||
      user.roleCode === 'organisation_manager'
    ) {
      setMetricsLoading(true);
      const qs =
        user.roleCode === 'existing_farmer' && activeExistingFarm?.id
          ? `?farmId=${encodeURIComponent(activeExistingFarm.id)}`
          : '';
      Promise.all([
        apiRequest<CropAnalytics>(`/api/crops/analytics${qs}`),
        apiRequest<LivestockAnalytics>(`/api/livestock/analytics${qs}`),
        apiRequest<MixedFarmingSummary>(`/api/mixed-farming/summary${qs}`),
      ])
        .then(([c, l, m]) => {
          setCropStats(c);
          setLivestockStats(l);
          setMixedSummary(m);
        })
        .catch(() => {})
        .finally(() => setMetricsLoading(false));
    }
  }, [user.roleCode, activeExistingFarm?.id, refreshKey]);

  const loadAdminData = async () => {
    try {
      const params = new URLSearchParams();
      if (userSearch) params.set('q', userSearch);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);

      const [usersRes, statsRes, logsRes] = await Promise.all([
        apiRequest<AuthUser[]>(`/api/admin/users?${params.toString()}`),
        apiRequest<AdminStats>('/api/admin/stats'),
        apiRequest<AuditLogItem[]>('/api/admin/audit-logs'),
      ]);
      setAdminUsers(usersRes);
      setAdminStats(statsRes);
      setAuditLogs(logsRes);
    } catch (err: unknown) {
      setAdminError(err instanceof Error ? err.message : 'Unable to load admin data.');
    }
  };

  useEffect(() => {
    if (user.roleCode === 'system_administrator') {
      loadAdminData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.roleCode, userSearch, roleFilter, statusFilter]);

  const handleToggleUserStatus = async (target: AuthUser) => {
    setAdminError(null);
    try {
      await apiRequest(`/api/admin/users/${target.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !target.isActive }),
      });
      await loadAdminData();
    } catch (err: unknown) {
      setAdminError(err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const handleRoleAssign = async (target: AuthUser, newRole: RoleCode) => {
    setAdminError(null);
    try {
      await apiRequest(`/api/admin/users/${target.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ roleCode: newRole }),
      });
      await loadAdminData();
    } catch (err: unknown) {
      setAdminError(err instanceof Error ? err.message : 'Role update failed.');
    }
  };

  const selectedProvince = useMemo(
    () => provinces.find((p) => p.name === selectedProvinceName) || provinces[0],
    [provinces, selectedProvinceName]
  );

  // ----------------------------------------------------------------
  // 1. PROSPECTIVE FARMER DASHBOARD
  // ----------------------------------------------------------------
  if (user.roleCode === 'prospective_farmer') {
    const pd = user.profile?.prospectiveData;
    const planItems = [
      'Define target buyer within 50km',
      'Verify borehole yield or municipal water supply',
      'Submit composite soil sample to provincial agricultural lab',
      'Estimate first-season seed, fertiliser, and labour budget',
      'Register cooperative or municipal lease agreement',
    ];

    return (
      <div className="space-y-8">
        <div className="bg-[#143326] text-white rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-mono uppercase tracking-wider text-[#B7DEC4]">
              Prospective Farmer · {user.profile?.province || 'South Africa'}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">
              Welcome, {user.profile?.fullName}
            </h1>
            <p className="text-sm text-[#DCE8DF]">
              Planning {pd?.intendedLandSizeHectares || 2} ha in{' '}
              {pd?.preferredFarmingType || 'Mixed Horticulture'} ·{' '}
              {pd?.landAccessStatus || 'Exploring land options'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <SpeakButton
              text={`Welcome ${user.profile?.fullName}. You are planning ${
                pd?.intendedLandSizeHectares || 2
              } hectares in ${user.profile?.province}. Explore land suitability, beginner farming guides, and business planning steps below.`}
              languageCode={languageCode}
              isSpeaking={isSpeaking}
              onSpeak={onSpeak}
              onStop={onStopSpeaking}
              supported={speechSupported}
            />
            <button
              type="button"
              onClick={onOpenAdvisorView}
              className="px-5 py-2.5 rounded-xl bg-white text-[#143326] font-semibold text-sm hover:bg-[#EDF2EC] cursor-pointer"
            >
              Ask Farm Advisor
            </button>
          </div>
        </div>

        {/* Land Suitability Exploration */}
        <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#1B4332]" />
              <h2 className="font-display text-xl font-bold text-[#143326]">
                Land Suitability Explorer
              </h2>
            </div>
            <select
              value={selectedProvinceName}
              onChange={(e) => setSelectedProvinceName(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm font-semibold"
            >
              {provinces.map((p) => (
                <option key={p.code} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProvince && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#E2E6DF]">
              <div>
                <p className="text-xs text-[#4A5A50]">Climate Zone</p>
                <p className="font-semibold text-[#143326] mt-1">{selectedProvince.climateZone}</p>
              </div>
              <div>
                <p className="text-xs text-[#4A5A50]">Typical Annual Rainfall</p>
                <p className="font-mono font-bold tabular-nums text-[#143326] mt-1">
                  {selectedProvince.annualRainfallMm}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#4A5A50]">Strong Provincial Commodities</p>
                <p className="text-sm text-[#17201B] mt-1">
                  {selectedProvince.keyCommodities.join(' · ')}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Farming Opportunity Discovery */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sprout className="w-5 h-5 text-[#1B4332]" />
            <h2 className="font-display text-xl font-bold text-[#143326]">
              Farming Opportunity Discovery
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opportunities.map((opp) => (
              <div
                key={opp.id}
                className="bg-white border border-[#E2E6DF] rounded-2xl p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#2D6A4F]">
                    {opp.startupTier} · Min {opp.minHectares} ha
                  </p>
                  <h3 className="font-display text-base font-bold text-[#143326]">{opp.title}</h3>
                  <p className="text-sm text-[#415047] leading-relaxed">{opp.summary}</p>
                </div>
                <div className="pt-3 border-t border-[#E2E6DF] text-xs text-[#4A5A50] space-y-1">
                  <p>Regions: {opp.province}</p>
                  <p>Water: {opp.waterNeed}</p>
                  <p>Cycle: {opp.cycleDays}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Beginner Farming Guidance & Business Planning */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#1B4332]" />
              <h2 className="font-display text-xl font-bold text-[#143326]">
                Beginner Farming Guidance
              </h2>
            </div>
            <div className="divide-y divide-[#E2E6DF]">
              {guides.map((g) => (
                <div key={g.id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display font-bold text-[#143326]">
                      {g.step}. {g.title}
                    </h3>
                    <SpeakButton
                      text={`${g.title}. ${g.summary}. Checklist: ${g.checklist.join('. ')}`}
                      languageCode={languageCode}
                      isSpeaking={isSpeaking}
                      onSpeak={onSpeak}
                      onStop={onStopSpeaking}
                      supported={speechSupported}
                      label="Listen"
                    />
                  </div>
                  <p className="text-sm text-[#415047]">{g.summary}</p>
                  <ul className="text-xs text-[#35443B] space-y-1 pt-1">
                    {g.checklist.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-5 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#1B4332]" />
              <h2 className="font-display text-xl font-bold text-[#143326]">
                Farming Business Planning
              </h2>
            </div>
            <p className="text-sm text-[#4A5A50]">
              Tap each readiness step as you prepare your launch plan:
            </p>
            <div className="space-y-2">
              {planItems.map((stepText) => {
                const done = checkedPlanSteps.includes(stepText);
                return (
                  <button
                    key={stepText}
                    type="button"
                    onClick={() =>
                      setCheckedPlanSteps((prev) =>
                        done ? prev.filter((x) => x !== stepText) : [...prev, stepText]
                      )
                    }
                    className={`w-full text-left p-3.5 rounded-xl border flex items-start gap-3 text-sm transition-colors cursor-pointer ${
                      done
                        ? 'bg-[#EDF5EF] border-[#1B4332] text-[#143326]'
                        : 'bg-white border-[#D4DDD2] text-[#17201B]'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        done ? 'text-[#1B4332]' : 'text-[#B5C0B8]'
                      }`}
                    />
                    <span className={done ? 'font-semibold' : ''}>{stepText}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------
  // 2. EXISTING FARMER DASHBOARD
  // ----------------------------------------------------------------
  if (user.roleCode === 'existing_farmer') {
    const activeFarm = activeExistingFarm;
    const totalHa = farms.reduce((s, f) => s + f.farmSizeHectares, 0);
    const totalFields = farms.reduce((s, f) => s + f.fields.length, 0);

    const locationSourceLabel =
      activeFarm?.location?.locationSource === 'gps'
        ? 'Device GPS Coordinate'
        : activeFarm?.location?.locationSource === 'manual_map_pin'
        ? 'Manual Map Pin'
        : 'Municipal Reference Center';

    return (
      <div className="space-y-6">
        <div className="bg-[#143326] text-white rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1.5">
            <p className="text-xs font-mono uppercase tracking-wider text-[#B7DEC4]">
              Existing Farmer Workspace · {farms.length} Registered Farm{farms.length === 1 ? '' : 's'}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">
              {user.profile?.fullName}
            </h1>
            <p className="text-sm text-[#DCE8DF]">
              Total land managed: <span className="font-mono font-bold tabular-nums">{totalHa} ha</span> ·{' '}
              <span className="font-mono font-bold tabular-nums">{totalFields}</span> mapped fields
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onOpenFarmsView}
              className="px-4 py-2.5 rounded-xl bg-white text-[#143326] font-semibold text-sm hover:bg-[#EDF2EC] cursor-pointer"
            >
              Farms & GPS Map
            </button>
            <button
              type="button"
              onClick={onOpenCropsView}
              className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer"
            >
              Manage Crops
            </button>
            <button
              type="button"
              onClick={onOpenLivestockView}
              className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer"
            >
              Livestock
            </button>
            <button
              type="button"
              onClick={onOpenMixedView}
              className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer"
            >
              Mixed Farming
            </button>
            <button
              type="button"
              onClick={onOpenSoilLandView}
              className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer"
            >
              Soil & Land
            </button>
            <button
              type="button"
              onClick={onOpenWeatherView}
              className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer"
            >
              Weather Alerts
            </button>
            <button
              type="button"
              onClick={onOpenVisualView}
              className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer"
            >
              Visual Scan
            </button>
            <button
              type="button"
              onClick={onOpenStockView}
              className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer"
            >
              Stock & Valuation
            </button>
            <button
              type="button"
              onClick={onOpenIncidentsView}
              className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer"
            >
              Incidents
            </button>
            <button
              type="button"
              onClick={onOpenAdvisorView}
              className="px-4 py-2.5 rounded-xl border border-[#8EB89D] text-white font-semibold text-sm hover:bg-[#1B4332] cursor-pointer"
            >
              AI Assistant
            </button>
          </div>
        </div>

        {/* Multi-Farm Selector Strip & Spatial Distinction */}
        {farms.length > 0 && (
          <div className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[#143326]">
                Active Farm Selection
              </h2>
              <div className="flex flex-wrap gap-2">
                {farms.map((farm) => (
                  <button
                    key={farm.id}
                    type="button"
                    onClick={() => onSelectFarm(farm.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                      activeFarm?.id === farm.id
                        ? 'bg-[#1B4332] text-white border-[#1B4332]'
                        : 'bg-[#F6F7F4] text-[#17201B] border-[#D4DDD2] hover:border-[#1B4332]'
                    }`}
                  >
                    {farm.name}
                  </button>
                ))}
              </div>
            </div>

            {activeFarm && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[#E2E6DF]">
                <div>
                  <p className="text-xs text-[#4A5A50]">Location ({locationSourceLabel})</p>
                  <p className="text-sm font-semibold text-[#143326] mt-1 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                    <span>
                      {activeFarm.location?.townOrVillage}, {activeFarm.location?.province}
                    </span>
                  </p>
                  <p className="text-xs font-mono tabular-nums text-[#4A5A50] mt-0.5">
                    Pin: {activeFarm.location?.latitude.toFixed(5)},{' '}
                    {activeFarm.location?.longitude.toFixed(5)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#4A5A50]">Saved Farm Boundary Area</p>
                  <p className="text-sm font-mono font-bold tabular-nums text-[#143326] mt-1">
                    {activeFarm.boundary
                      ? `${activeFarm.boundary.calculatedAreaHectares} ha (${activeFarm.boundary.perimeterMeters} m)`
                      : 'Boundary polygon not drawn yet'}
                  </p>
                  {activeFarm.location?.gpsLatitude != null &&
                    activeFarm.location?.gpsLongitude != null && (
                      <p className="text-xs font-mono tabular-nums text-[#2D6A4F] mt-0.5">
                        GPS fix: {activeFarm.location.gpsLatitude.toFixed(5)},{' '}
                        {activeFarm.location.gpsLongitude.toFixed(5)}
                      </p>
                    )}
                </div>
                <div>
                  <p className="text-xs text-[#4A5A50]">Water Supply</p>
                  <p className="text-sm font-semibold text-[#143326] mt-1 flex items-center gap-1">
                    <Droplets className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                    <span>{activeFarm.waterAvailability}</span>
                  </p>
                  <p className="text-xs text-[#4A5A50] mt-0.5">
                    {activeFarm.fields.length} mapped field{activeFarm.fields.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#4A5A50]">Enterprise Focus</p>
                  <p className="text-sm text-[#17201B] mt-1">
                    {activeFarm.farmingActivities.join(' · ') || 'Mixed Farming'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Farm Production & Mixed Farming Overview */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold text-[#143326]">
                {activeFarm ? `${activeFarm.name} — Live Operations Summary` : 'Live Operations Summary'}
              </h2>
              <p className="text-xs text-[#4A5A50]">
                Updates automatically whenever you register or edit crops, livestock, or mixed-farming records.
              </p>
            </div>
            {metricsLoading && (
              <span className="text-xs font-medium text-[#4A5A50]">Refreshing metrics...</span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Crop Intelligence Card */}
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sprout className="w-5 h-5 text-[#1B4332]" />
                    <h3 className="font-display font-bold text-[#143326]">Crop Production</h3>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenCropsView}
                    className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                  >
                    Open Crops →
                  </button>
                </div>

                {cropStats ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <p className="text-xs text-[#4A5A50]">Active Crops</p>
                        <p className="font-mono text-xl font-bold tabular-nums text-[#143326]">
                          {cropStats.totalRegisteredCrops}
                        </p>
                        <p className="text-xs text-[#4A5A50] font-mono tabular-nums">
                          {cropStats.totalCultivatedHectares} ha cultivated
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#4A5A50]">Estimated Value</p>
                        <p className="font-mono text-xl font-bold tabular-nums text-[#1B4332]">
                          R{cropStats.estimatedHarvestValueZar.toLocaleString()}
                        </p>
                        <p className="text-xs text-[#4A5A50] font-mono tabular-nums">
                          {cropStats.totalHarvestedKg.toLocaleString()} kg harvested
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#E2E6DF] text-xs text-[#35443B] flex justify-between font-mono tabular-nums">
                      <span>Remaining: {cropStats.remainingPlants.toLocaleString()} plants</span>
                      <span className="text-[#8E2424]">
                        Damaged: {cropStats.damagedPlants.toLocaleString()}
                      </span>
                    </div>

                    {cropStats.byCrop.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {cropStats.byCrop.slice(0, 3).map((c) => (
                          <div key={c.id} className="text-xs flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-[#143326]">
                              {c.cropName} ({c.cropVariety})
                            </span>
                            <span className="font-mono tabular-nums text-[#4A5A50] shrink-0">
                              {c.cultivatedAreaHectares} ha · {c.growthStage}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-[#4A5A50]">No crop records loaded yet.</p>
                )}
              </div>
            </div>

            {/* Livestock Intelligence Card */}
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Beef className="w-5 h-5 text-[#1B4332]" />
                    <h3 className="font-display font-bold text-[#143326]">Livestock Inventory</h3>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenLivestockView}
                    className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                  >
                    Open Livestock →
                  </button>
                </div>

                {livestockStats ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <p className="text-xs text-[#4A5A50]">Total Animals</p>
                        <p className="font-mono text-xl font-bold tabular-nums text-[#143326]">
                          {livestockStats.totalAnimals.toLocaleString()} head
                        </p>
                        <p className="text-xs text-[#4A5A50] font-mono tabular-nums">
                          {livestockStats.recordCount} ledger records
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#4A5A50]">Herd Valuation</p>
                        <p className="font-mono text-xl font-bold tabular-nums text-[#1B4332]">
                          R{livestockStats.estimatedLivestockValueZar.toLocaleString()}
                        </p>
                        <p className="text-xs text-[#4A5A50] font-mono tabular-nums">
                          +{livestockStats.births} births · -{livestockStats.deaths} deaths
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#E2E6DF] text-xs text-[#35443B] flex justify-between font-mono tabular-nums">
                      <span>Purchased: +{livestockStats.purchases}</span>
                      <span>Sold: -{livestockStats.sales}</span>
                    </div>

                    {livestockStats.byCategory.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {livestockStats.byCategory.map((cat) => (
                          <div
                            key={cat.category}
                            className="text-xs flex items-center justify-between gap-2"
                          >
                            <span className="font-medium text-[#143326]">{cat.category}</span>
                            <span className="font-mono tabular-nums text-[#4A5A50]">
                              {cat.count} · R{cat.valueZar.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-[#4A5A50]">No livestock groups loaded yet.</p>
                )}
              </div>
            </div>

            {/* Mixed Farming & Resource Card */}
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#1B4332]" />
                    <h3 className="font-display font-bold text-[#143326]">Mixed Farming</h3>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenMixedView}
                    className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                  >
                    Open Mixed Hub →
                  </button>
                </div>

                {mixedSummary ? (
                  <>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <p className="text-xs text-[#4A5A50]">Combined Farm Value</p>
                        <p className="font-mono text-xl font-bold tabular-nums text-[#1B4332]">
                          R{mixedSummary.combinedAssetAndHarvestValueZar.toLocaleString()}
                        </p>
                        <p className="text-xs text-[#4A5A50] font-mono tabular-nums">
                          Expenses: R{mixedSummary.combinedExpensesZar.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#4A5A50]">Shared Land Split</p>
                        <p className="font-mono text-xl font-bold tabular-nums text-[#143326]">
                          {mixedSummary.totalFarmAreaHa} ha
                        </p>
                        <p className="text-xs text-[#4A5A50] font-mono tabular-nums">
                          {mixedSummary.cropCultivatedHa} crop · {mixedSummary.grazingFieldsHa} grazing
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#E2E6DF] text-xs text-[#35443B] space-y-1.5 font-mono tabular-nums">
                      <div className="flex justify-between">
                        <span>Water Managed:</span>
                        <span className="font-semibold text-[#143326]">
                          {mixedSummary.totalWaterManagedLiters.toLocaleString()} L
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>On-Farm Feed Produced:</span>
                        <span className="font-semibold text-[#143326]">
                          {mixedSummary.totalFeedProducedKg.toLocaleString()} kg
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[#4A5A50]">No mixed-farming summary loaded yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ----------------------------------------------------------------
  // 3. SYSTEM ADMINISTRATOR DASHBOARD
  // ----------------------------------------------------------------
  if (user.roleCode === 'system_administrator') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#143326]">
              Platform Administration Console
            </h1>
            <p className="text-sm text-[#4A5A50]">
              Manage user accounts, role permissions, registration statistics, and system audit logs.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1B4332]">
            <Shield className="w-4 h-4" />
            <span>System Administrator</span>
          </div>
        </div>

        {adminError && (
          <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
            {adminError}
          </div>
        )}

        {/* Stats Row */}
        {adminStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Registered Users</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#143326] mt-1">
                {adminStats.totalUsers}
              </p>
              <p className="text-xs text-[#2D6A4F] mt-1">
                {adminStats.activeUsers} active · {adminStats.inactiveUsers} inactive
              </p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Registered Farms</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#143326] mt-1">
                {adminStats.totalFarms}
              </p>
              <p className="text-xs text-[#4A5A50] mt-1">
                {adminStats.totalFields} mapped fields
              </p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Total Hectares & Output</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#143326] mt-1">
                {adminStats.totalHectares} ha
              </p>
              <p className="text-xs text-[#4A5A50] mt-1 font-mono tabular-nums">
                {adminStats.totalCrops ?? 0} crops · {adminStats.totalLivestockHead ?? 0} livestock head
              </p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Role Distribution</p>
              <div className="text-xs text-[#17201B] mt-1.5 space-y-0.5">
                {adminStats.byRole.map((r) => (
                  <div key={r.roleCode} className="flex justify-between">
                    <span>{r.roleName}</span>
                    <span className="font-mono font-semibold tabular-nums">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* User Directory & Search */}
        <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#1B4332]" />
              <h2 className="font-display text-lg font-bold text-[#143326]">
                Registered Users ({adminUsers.length})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-[#4A5A50] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search name, email, province..."
                  className="pl-9 pr-3 py-2 rounded-lg border border-[#D4DDD2] text-sm"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-sm"
              >
                <option value="">All Roles</option>
                <option value="prospective_farmer">Prospective Farmer</option>
                <option value="existing_farmer">Existing Farmer</option>
                <option value="agricultural_expert">Agricultural Expert</option>
                <option value="organisation_manager">Organisation Manager</option>
                <option value="system_administrator">System Administrator</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-sm"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Deactivated</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E2E6DF] text-xs text-[#4A5A50]">
                  <th className="py-2.5 pr-4 font-semibold">User</th>
                  <th className="py-2.5 pr-4 font-semibold">Province / Lang</th>
                  <th className="py-2.5 pr-4 font-semibold">Assigned Role</th>
                  <th className="py-2.5 pr-4 font-semibold">Status</th>
                  <th className="py-2.5 text-right font-semibold">Account Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E6DF]">
                {adminUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[#143326]">
                        {u.profile?.fullName || 'Unnamed User'}
                      </p>
                      <p className="text-xs text-[#4A5A50]">{u.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs text-[#35443B]">
                      {u.profile?.province || 'Unassigned'} · {u.preferredLanguageCode.toUpperCase()}
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        value={u.roleCode}
                        disabled={u.id === user.id}
                        onChange={(e) => handleRoleAssign(u, e.target.value as RoleCode)}
                        className="px-2.5 py-1.5 rounded-lg border border-[#D4DDD2] bg-white text-xs font-medium disabled:opacity-60"
                      >
                        <option value="prospective_farmer">Prospective Farmer</option>
                        <option value="existing_farmer">Existing Farmer</option>
                        <option value="agricultural_expert">Agricultural Expert</option>
                        <option value="organisation_manager">Organisation Manager</option>
                        <option value="system_administrator">System Administrator</option>
                      </select>
                    </td>
                    <td className="py-3 pr-4 text-xs font-semibold">
                      <span className={u.isActive ? 'text-[#1B4332]' : 'text-[#8E2424]'}>
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {u.id !== user.id ? (
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                            u.isActive
                              ? 'border-[#E8B4B4] text-[#8E2424] hover:bg-[#FDF2F2]'
                              : 'border-[#BFD6C5] text-[#1B4332] hover:bg-[#EDF5EF]'
                          }`}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      ) : (
                        <span className="text-xs text-[#4A5A50]">Current Session</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Audit Logs */}
        <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#1B4332]" />
            <h2 className="font-display text-lg font-bold text-[#143326]">
              Recent Account & System Activity (Audit Logs)
            </h2>
          </div>
          <div className="divide-y divide-[#E2E6DF] max-h-80 overflow-y-auto">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-mono font-semibold text-[#143326]">{log.action}</span>
                  <span className="text-[#4A5A50]">
                    {' '}
                    · {log.actorEmail} · {log.entityType}
                  </span>
                </div>
                <span className="font-mono tabular-nums text-[#4A5A50]">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ----------------------------------------------------------------
  // 4. AGRICULTURAL EXPERT & ORGANISATION MANAGER DASHBOARDS
  // ----------------------------------------------------------------
  const isExpert = user.roleCode === 'agricultural_expert';
  const totalPortfolioHa = farms.reduce((s, f) => s + f.farmSizeHectares, 0);
  const totalPortfolioFields = farms.reduce((s, f) => s + f.fields.length, 0);

  return (
    <div className="space-y-6">
      <div className="bg-[#143326] text-white rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-1.5">
          <p className="text-xs font-mono uppercase tracking-wider text-[#B7DEC4]">
            {isExpert ? 'Agricultural Expert Advisory Desk' : 'Organisation Portfolio Management'}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">
            {user.profile?.fullName}
          </h1>
          <p className="text-sm text-[#DCE8DF]">
            Overseeing <span className="font-mono font-bold tabular-nums">{farms.length}</span> farms ·{' '}
            <span className="font-mono font-bold tabular-nums">{totalPortfolioHa} ha</span> ·{' '}
            <span className="font-mono font-bold tabular-nums">{totalPortfolioFields}</span> fields
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onOpenCropsView}
            className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer"
          >
            Review Crops
          </button>
          <button
            type="button"
            onClick={onOpenLivestockView}
            className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer"
          >
            Review Livestock
          </button>
          <button
            type="button"
            onClick={onOpenVisualView}
            className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer"
          >
            Visual Scans
          </button>
          <button
            type="button"
            onClick={onOpenStockView}
            className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer"
          >
            Stock Valuation
          </button>
          <button
            type="button"
            onClick={onOpenIncidentsView}
            className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer"
          >
            Incidents
          </button>
          <button
            type="button"
            onClick={onOpenAdvisorView}
            className="px-5 py-2.5 rounded-xl bg-white text-[#143326] font-semibold text-sm hover:bg-[#EDF2EC] cursor-pointer"
          >
            Open Multilingual AI Desk
          </button>
        </div>
      </div>

      {(cropStats || livestockStats || mixedSummary) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
            <p className="text-xs text-[#4A5A50]">Portfolio Crops</p>
            <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
              {cropStats?.totalRegisteredCrops ?? 0} registered ({cropStats?.totalCultivatedHectares ?? 0} ha)
            </p>
            <p className="text-xs text-[#2D6A4F] font-mono tabular-nums mt-0.5">
              Est. value R{(cropStats?.estimatedHarvestValueZar ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
            <p className="text-xs text-[#4A5A50]">Portfolio Livestock</p>
            <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
              {(livestockStats?.totalAnimals ?? 0).toLocaleString()} head
            </p>
            <p className="text-xs text-[#2D6A4F] font-mono tabular-nums mt-0.5">
              Est. value R{(livestockStats?.estimatedLivestockValueZar ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
            <p className="text-xs text-[#4A5A50]">Water & Feed Managed</p>
            <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
              {(mixedSummary?.totalWaterManagedLiters ?? 0).toLocaleString()} L
            </p>
            <p className="text-xs text-[#4A5A50] font-mono tabular-nums mt-0.5">
              {(mixedSummary?.totalFeedProducedKg ?? 0).toLocaleString()} kg feed produced
            </p>
          </div>
        </div>
      )}

      <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isExpert ? (
              <Layers className="w-5 h-5 text-[#1B4332]" />
            ) : (
              <Tractor className="w-5 h-5 text-[#1B4332]" />
            )}
            <h2 className="font-display text-lg font-bold text-[#143326]">
              {isExpert ? 'Farms Under Agronomic Review' : 'Cooperative & Member Farms'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenFarmsView}
            className="text-sm font-semibold text-[#2D6A4F] hover:underline cursor-pointer"
          >
            Inspect Spatial Boundaries
          </button>
        </div>

        <div className="divide-y divide-[#E2E6DF]">
          {farms.map((farm) => (
            <div
              key={farm.id}
              className="py-4 flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <p className="font-semibold text-[#143326]">{farm.name}</p>
                <p className="text-xs text-[#4A5A50] mt-0.5">
                  Owner: {farm.ownerName} · {farm.location?.townOrVillage}, {farm.location?.province} ·{' '}
                  {farm.waterAvailability}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-bold tabular-nums text-[#143326]">
                  {farm.farmSizeHectares} ha
                </p>
                <p className="text-xs text-[#4A5A50]">{farm.fields.length} fields</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
