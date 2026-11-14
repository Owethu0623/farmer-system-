import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  CloudRain,
  FileSpreadsheet,
  Lock,
  Megaphone,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  AuthUser,
  OrganisationMemberRole,
  OrganisationOverviewPayload,
  OrganisationType,
} from '../types';

interface OrganisationPortalViewProps {
  user: AuthUser;
  provinces: { code: string; name: string }[];
  onOpenReportsView: () => void;
}

const ORG_TYPES: { value: OrganisationType; label: string }[] = [
  { value: 'cooperative', label: 'Agricultural Cooperative' },
  { value: 'agricultural_company', label: 'Agricultural Company / Agribusiness' },
  { value: 'extension_agency', label: 'Provincial / Extension Agency' },
  { value: 'research_body', label: 'Agricultural Research Body' },
];

export const OrganisationPortalView: React.FC<OrganisationPortalViewProps> = ({
  user,
  provinces,
  onOpenReportsView,
}) => {
  const [subTab, setSubTab] = useState<'analytics' | 'farms_weather' | 'profile' | 'team_comms'>(
    'analytics'
  );
  const [overview, setOverview] = useState<OrganisationOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Org profile state
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<OrganisationType>('cooperative');
  const [regNo, setRegNo] = useState('');
  const [province, setProvince] = useState('Mpumalanga');
  const [district, setDistrict] = useState('');
  const [primaryFocus, setPrimaryFocus] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [description, setDescription] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);

  // Add member state
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<OrganisationMemberRole>('analyst');
  const [addingMember, setAddingMember] = useState(false);

  // Broadcast communication state
  const [commTitle, setCommTitle] = useState('');
  const [commMessage, setCommMessage] = useState('');
  const [commAudience, setCommAudience] = useState<
    'authorised_farmers' | 'org_members' | 'all_connected'
  >('all_connected');
  const [commPriority, setCommPriority] = useState<'normal' | 'high'>('normal');
  const [sendingComm, setSendingComm] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<OrganisationOverviewPayload>('/api/organisation/overview');
      setOverview(data);
      if (data.organisation) {
        setOrgName(data.organisation.name);
        setOrgType(data.organisation.organisationType);
        setRegNo(data.organisation.registrationNumber);
        setProvince(data.organisation.province);
        setDistrict(data.organisation.district);
        setPrimaryFocus(data.organisation.primaryFocus);
        setContactEmail(data.organisation.contactEmail);
        setContactPhone(data.organisation.contactPhone);
        setDescription(data.organisation.description);
      } else {
        setContactEmail(user.email);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load Organisation Portal.');
    } finally {
      setLoading(false);
    }
  }, [user.email]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleSaveOrgProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOrg(true);
    setNotice(null);
    setError(null);
    try {
      await apiRequest('/api/organisation/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: orgName,
          organisationType: orgType,
          registrationNumber: regNo,
          province,
          district,
          primaryFocus,
          contactEmail,
          contactPhone,
          description,
        }),
      });
      setNotice('Organisation profile saved.');
      await loadOverview();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save organisation profile.');
    } finally {
      setSavingOrg(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingMember(true);
    setNotice(null);
    setError(null);
    try {
      await apiRequest('/api/organisation/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: memberName,
          email: memberEmail,
          orgRole: memberRole,
        }),
      });
      setMemberName('');
      setMemberEmail('');
      setNotice('Organisation user added.');
      await loadOverview();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to add organisation user.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleToggleMemberStatus = async (
    membershipId: string,
    currentStatus: 'active' | 'inactive'
  ) => {
    setError(null);
    try {
      await apiRequest(`/api/organisation/users/${membershipId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: currentStatus === 'active' ? 'inactive' : 'active' }),
      });
      await loadOverview();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update member status.');
    }
  };

  const handleSendCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingComm(true);
    setNotice(null);
    setError(null);
    try {
      const res = await apiRequest<{
        recipientsEvaluated: number;
        deliveredCount: number;
        suppressedCount: number;
      }>('/api/organisation/communications', {
        method: 'POST',
        body: JSON.stringify({
          title: commTitle,
          message: commMessage,
          targetAudience: commAudience,
          priority: commPriority,
        }),
      });
      setCommTitle('');
      setCommMessage('');
      setNotice(
        `Organisation bulletin dispatched: ${res.deliveredCount} delivered, ${res.suppressedCount} skipped due to recipient notification preferences.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send communication.');
    } finally {
      setSendingComm(false);
    }
  };

  const maxProvinceHa = Math.max(
    1,
    ...(overview?.provincialDistribution.map((p) => p.hectares) || [1])
  );
  const maxTrendHarvest = Math.max(
    1,
    ...(overview?.trendAnalysis.map((t) => t.harvestKg) || [1])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#143326]">
            Organisation Manager Portal
          </h1>
          <p className="text-sm text-[#4A5A50] mt-0.5">
            {overview?.organisation?.name || 'Register your cooperative or agricultural organisation'} ·
            Authorised multi-farm oversight & provincial analytics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-[#EAECE6] rounded-xl overflow-x-auto max-w-full">
            {[
              { id: 'analytics' as const, label: 'Organisation Analytics', icon: <BarChart3 className="w-4 h-4" /> },
              { id: 'farms_weather' as const, label: 'Authorised Farms & Weather', icon: <CloudRain className="w-4 h-4" /> },
              { id: 'profile' as const, label: 'Organisation Profile', icon: <Building2 className="w-4 h-4" /> },
              { id: 'team_comms' as const, label: 'Users & Communications', icon: <Users className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  subTab === tab.id
                    ? 'bg-white text-[#143326] shadow-sm'
                    : 'text-[#4A5A50] hover:text-[#143326]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenReportsView}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Aggregated PDF / CSV Reports</span>
          </button>
        </div>
      </div>

      {/* Mandatory Privacy Protection Banner */}
      <div className="bg-[#F6F7F4] border border-[#D4DDD2] rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs text-[#35443B]">
        <Lock className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" />
        <span>
          {overview?.privacyNotice ||
            'Privacy Protection Active: Individual farmer identities and private financial records are protected in all organisation views and aggregated exports.'}
        </span>
      </div>

      {notice && (
        <div className="bg-[#EDF5EF] border border-[#BFD6C5] text-[#143326] rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#1B4332]" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Authorised Farms', value: overview?.kpis.totalAuthorisedFarms ?? 0 },
          { label: 'Total Hectares', value: `${overview?.kpis.totalHectares ?? 0} ha` },
          { label: 'Farming Categories', value: overview?.kpis.activeFarmingCategories ?? 0 },
          { label: 'Harvest Output', value: `${(overview?.kpis.totalHarvestedKg ?? 0).toLocaleString()} kg` },
          { label: 'Livestock Head', value: (overview?.kpis.totalLivestockHead ?? 0).toLocaleString() },
          { label: 'Open Incidents', value: overview?.kpis.openIncidentsCount ?? 0 },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-[#E2E6DF] rounded-xl p-4">
            <p className="text-xs text-[#4A5A50]">{kpi.label}</p>
            <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white border border-[#E2E6DF] rounded-2xl p-8 text-sm text-[#4A5A50]">
          Loading organisation analytics...
        </div>
      ) : subTab === 'analytics' && overview ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Provincial Distribution */}
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#143326]">
                Provincial Agricultural Distribution
              </h2>
              {overview.provincialDistribution.length === 0 ? (
                <p className="text-sm text-[#4A5A50]">
                  No authorised farms assigned to your organisation yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {overview.provincialDistribution.map((prov) => {
                    const widthPct = Math.max(8, Math.round((prov.hectares / maxProvinceHa) * 100));
                    return (
                      <div key={prov.province} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#143326]">{prov.province}</span>
                          <span className="font-mono tabular-nums text-[#4A5A50]">
                            {prov.farmCount} farm(s) · {prov.hectares} ha · {prov.livestockHead} head
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-[#EDF2EC] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1B4332] rounded-full"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Agricultural Trend Analysis SVG Chart */}
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#143326]">
                Agricultural Trend Analysis (Monthly Output & Incidents)
              </h2>
              {overview.trendAnalysis.length === 0 ? (
                <p className="text-sm text-[#4A5A50]">No longitudinal trend records yet.</p>
              ) : (
                <div className="space-y-3">
                  <svg
                    viewBox="0 0 420 140"
                    className="w-full h-36 bg-[#F6F7F4] rounded-xl p-2"
                    role="img"
                    aria-label="Monthly harvest and incident trend chart"
                  >
                    {overview.trendAnalysis.map((pt, idx) => {
                      const barW = Math.max(
                        24,
                        Math.min(54, Math.floor(360 / Math.max(1, overview.trendAnalysis.length)) - 12)
                      );
                      const x = 24 + idx * (barW + 14);
                      const barH = Math.max(6, Math.round((pt.harvestKg / maxTrendHarvest) * 86));
                      const y = 108 - barH;
                      return (
                        <g key={pt.period}>
                          <rect x={x} y={y} width={barW} height={barH} rx={4} fill="#1B4332" />
                          <text
                            x={x + barW / 2}
                            y={128}
                            textAnchor="middle"
                            fontSize="9"
                            fill="#4A5A50"
                          >
                            {pt.period}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  <div className="divide-y divide-[#E2E6DF] text-xs">
                    {overview.trendAnalysis.map((t) => (
                      <div key={t.period} className="py-1.5 flex items-center justify-between">
                        <span className="font-mono font-semibold text-[#143326]">{t.period}</span>
                        <span className="font-mono tabular-nums text-[#35443B]">
                          Harvest: {t.harvestKg.toLocaleString()} kg · Incidents: {t.incidentsCount} ·
                          Weather Reports: {t.weatherObservationsCount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Crop, Livestock & Farming Category Summaries */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-3">
              <h3 className="font-display text-base font-bold text-[#143326]">
                Crop Distribution Summary
              </h3>
              {overview.cropDistribution.length === 0 ? (
                <p className="text-xs text-[#4A5A50]">No crop records in scope.</p>
              ) : (
                <div className="divide-y divide-[#E2E6DF] text-xs">
                  {overview.cropDistribution.map((c) => (
                    <div key={c.cropName} className="py-2 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#143326]">{c.cropName}</p>
                        <p className="text-[#4A5A50]">{c.farmsCount} farm(s)</p>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <p className="font-semibold text-[#143326]">{c.hectares} ha</p>
                        <p className="text-[#4A5A50]">{c.harvestedKg.toLocaleString()} kg</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-3">
              <h3 className="font-display text-base font-bold text-[#143326]">
                Livestock Distribution Summary
              </h3>
              {overview.livestockDistribution.length === 0 ? (
                <p className="text-xs text-[#4A5A50]">No livestock records in scope.</p>
              ) : (
                <div className="divide-y divide-[#E2E6DF] text-xs">
                  {overview.livestockDistribution.map((l) => (
                    <div key={l.animalType} className="py-2 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#143326]">{l.animalType}</p>
                        <p className="text-[#4A5A50]">{l.groupsCount} herd/flock group(s)</p>
                      </div>
                      <p className="font-mono font-bold tabular-nums text-[#143326]">
                        {l.headCount.toLocaleString()} head
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-3">
              <h3 className="font-display text-base font-bold text-[#143326]">
                Farming Categories
              </h3>
              {overview.farmingCategoriesSummary.length === 0 ? (
                <p className="text-xs text-[#4A5A50]">No farming categories recorded.</p>
              ) : (
                <div className="divide-y divide-[#E2E6DF] text-xs">
                  {overview.farmingCategoriesSummary.map((fc) => (
                    <div key={fc.category} className="py-2 flex items-center justify-between">
                      <span className="font-semibold text-[#143326]">{fc.category}</span>
                      <span className="font-mono tabular-nums text-[#4A5A50]">
                        {fc.farmCount} farm(s) · {fc.hectares} ha
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : subTab === 'farms_weather' && overview ? (
        <div className="space-y-6">
          {/* Anonymised Multi-Farm Performance Table */}
          <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#143326]">
              Authorised Farm Performance Comparisons (Identity & Financials Protected)
            </h2>
            {overview.authorisedFarms.length === 0 ? (
              <p className="text-sm text-[#4A5A50]">
                No farms have granted active access to your organisation yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E6DF] text-[#4A5A50]">
                      <th className="py-2 pr-4">Anonymised Ref</th>
                      <th className="py-2 pr-4">Province / District</th>
                      <th className="py-2 pr-4 text-right">Hectares</th>
                      <th className="py-2 pr-4 text-right">Harvested (kg)</th>
                      <th className="py-2 pr-4 text-right">Livestock Head</th>
                      <th className="py-2 pr-4 text-right">Active Incidents</th>
                      <th className="py-2">Authorised Basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E6DF]">
                    {overview.authorisedFarms.map((af) => (
                      <tr key={af.farmId}>
                        <td className="py-2.5 pr-4 font-mono font-semibold text-[#143326]">
                          {af.farmReferenceCode}
                        </td>
                        <td className="py-2.5 pr-4">
                          {af.province} · {af.district}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                          {af.hectares}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                          {af.harvestedKg.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                          {af.livestockHead}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                          {af.activeIncidentsCount}
                        </td>
                        <td className="py-2.5 text-[#4A5A50]">{af.authorisedBasis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Regional Weather Comparisons */}
          <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#143326]">
              Regional Weather Comparisons (Forecast vs Farmer Rain-Gauge Reports)
            </h2>
            {overview.weatherComparisons.length === 0 ? (
              <p className="text-sm text-[#4A5A50]">No weather observations available across authorised farms.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E6DF] text-[#4A5A50]">
                      <th className="py-2 pr-4">Farm Ref</th>
                      <th className="py-2 pr-4">Province</th>
                      <th className="py-2 pr-4">Latest Date</th>
                      <th className="py-2 pr-4 text-right">Forecast Rain (mm)</th>
                      <th className="py-2 pr-4 text-right">Farmer Gauge (mm)</th>
                      <th className="py-2 pr-4 text-right">Temp (°C)</th>
                      <th className="py-2">QC Classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E6DF]">
                    {overview.weatherComparisons.map((wc) => (
                      <tr key={wc.farmReferenceCode}>
                        <td className="py-2.5 pr-4 font-mono font-semibold text-[#143326]">
                          {wc.farmReferenceCode}
                        </td>
                        <td className="py-2.5 pr-4">{wc.province}</td>
                        <td className="py-2.5 pr-4 font-mono tabular-nums">
                          {wc.observationDate || '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                          {wc.forecastRainMm ?? '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                          {wc.farmerReportedRainMm ?? '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                          {wc.avgTempC ?? '—'}
                        </td>
                        <td className="py-2.5 text-[#4A5A50]">
                          {wc.qcStatus ? wc.qcStatus.replace(/_/g, ' ') : 'Forecast snapshot only'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : subTab === 'profile' ? (
        <form
          onSubmit={handleSaveOrgProfile}
          className="bg-white border border-[#E2E6DF] rounded-2xl p-6 max-w-3xl space-y-4"
        >
          <h2 className="font-display text-lg font-bold text-[#143326]">
            Organisation Registration & Profile
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#35443B]">Organisation Name</label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Lowveld Growers Cooperative"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#35443B]">Organisation Type</label>
              <select
                value={orgType}
                onChange={(e) => setOrgType(e.target.value as OrganisationType)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
              >
                {ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#35443B]">
                Registration Number
              </label>
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#35443B]">Province</label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
              >
                {provinces.map((p) => (
                  <option key={p.code} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#35443B]">District</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#35443B]">Primary Focus</label>
              <input
                type="text"
                value={primaryFocus}
                onChange={(e) => setPrimaryFocus(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#35443B]">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#35443B]">Contact Phone</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#35443B]">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#D4DDD2] text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={savingOrg}
            className="px-5 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white text-sm font-semibold cursor-pointer"
          >
            {savingOrg ? 'Saving...' : 'Save Organisation Profile'}
          </button>
        </form>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Organisation User Management */}
          <div className="lg:col-span-7 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-5">
            <h2 className="font-display text-lg font-bold text-[#143326] flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#1B4332]" />
              <span>Organisation User Management ({overview?.members.length || 0})</span>
            </h2>

            <form
              onSubmit={handleAddMember}
              className="bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end"
            >
              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Sipho Mabena"
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="sipho@coop.co.za"
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#35443B] mb-1">Org Role</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as OrganisationMemberRole)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs"
                >
                  <option value="analyst">Analyst</option>
                  <option value="advisor">Advisor</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={addingMember}
                className="px-4 py-2 rounded-lg bg-[#1B4332] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                {addingMember ? 'Adding...' : 'Add User'}
              </button>
            </form>

            <div className="divide-y divide-[#E2E6DF]">
              {(overview?.members || []).map((m) => (
                <div key={m.membershipId} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-[#143326]">{m.fullName}</p>
                    <p className="text-xs text-[#4A5A50]">
                      {m.email} · Role: <span className="capitalize font-semibold">{m.orgRole}</span> ·{' '}
                      <span
                        className={`font-semibold ${
                          m.status === 'active' ? 'text-[#16A34A]' : 'text-[#8E2424]'
                        }`}
                      >
                        {m.status}
                      </span>
                    </p>
                  </div>
                  {m.userId !== user.id && (
                    <button
                      type="button"
                      onClick={() => handleToggleMemberStatus(m.membershipId, m.status)}
                      className="px-3 py-1.5 rounded-lg border border-[#D4DDD2] hover:bg-[#EDF2EC] text-xs font-semibold cursor-pointer"
                    >
                      {m.status === 'active' ? 'Deactivate' : 'Reactivate'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Organisation Communication Broadcaster */}
          <div className="lg:col-span-5 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#143326] flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-[#1B4332]" />
              <span>Send Organisation Communication</span>
            </h2>
            <p className="text-xs text-[#4A5A50]">
              Respects each recipient&apos;s notification category preferences and delivers in their preferred language.
            </p>
            <form onSubmit={handleSendCommunication} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#35443B]">Audience</label>
                <select
                  value={commAudience}
                  onChange={(e) =>
                    setCommAudience(
                      e.target.value as 'authorised_farmers' | 'org_members' | 'all_connected'
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs"
                >
                  <option value="all_connected">Authorised Farmers & Organisation Team</option>
                  <option value="authorised_farmers">Authorised Farmers Only</option>
                  <option value="org_members">Organisation Team Only</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#35443B]">Subject</label>
                <input
                  type="text"
                  required
                  value={commTitle}
                  onChange={(e) => setCommTitle(e.target.value)}
                  placeholder="e.g. Regional Cooperative Market Intake Schedule"
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#35443B]">Message</label>
                <textarea
                  rows={4}
                  required
                  value={commMessage}
                  onChange={(e) => setCommMessage(e.target.value)}
                  placeholder="Write cooperative guidance, intake updates, or regional coordination details..."
                  className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] text-sm"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <select
                  value={commPriority}
                  onChange={(e) => setCommPriority(e.target.value as 'normal' | 'high')}
                  className="px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs"
                >
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <button
                  type="submit"
                  disabled={sendingComm}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-semibold cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingComm ? 'Sending...' : 'Broadcast Notice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
