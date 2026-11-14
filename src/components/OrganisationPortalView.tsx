import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  CloudRain,
  FileSpreadsheet,
  Lock,
  Megaphone,
  Plus,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  apiRequest,
  assignOrganisationSpecialist,
  createOrganisationActivity,
  createOrganisationProject,
} from '../lib/api';
import { getSastDateString } from '../lib/saTime';
import {
  AuthUser,
  CollaborationDirectoryPayload,
  OrganisationMemberRole,
  OrganisationOverviewPayload,
  OrganisationProgrammeActivityItem,
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
  const [subTab, setSubTab] = useState<
    'analytics' | 'projects' | 'farms_weather' | 'profile' | 'team_comms'
  >('analytics');
  const [overview, setOverview] = useState<OrganisationOverviewPayload | null>(null);
  const [expertsDirectory, setExpertsDirectory] = useState<
    CollaborationDirectoryPayload['experts']
  >([]);
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

  // Add project state
  const [projTitle, setProjTitle] = useState('');
  const [projCode, setProjCode] = useState('');
  const [projProvince, setProjProvince] = useState('Mpumalanga');
  const [projFocus, setProjFocus] = useState('');
  const [projStartDate, setProjStartDate] = useState(getSastDateString());
  const [projTargetEndDate, setProjTargetEndDate] = useState('');
  const [projTargetFarms, setProjTargetFarms] = useState(10);
  const [projTargetHa, setProjTargetHa] = useState(50);
  const [projBudgetZar, setProjBudgetZar] = useState(120000);
  const [projSummary, setProjSummary] = useState('');
  const [savingProj, setSavingProj] = useState(false);

  // Add programme activity state
  const [actProjectId, setActProjectId] = useState('');
  const [actTitle, setActTitle] = useState('');
  const [actType, setActType] =
    useState<OrganisationProgrammeActivityItem['activityType']>('training_workshop');
  const [actDate, setActDate] = useState(getSastDateString());
  const [actProvince, setActProvince] = useState('Mpumalanga');
  const [actDistrict, setActDistrict] = useState('');
  const [actParticipants, setActParticipants] = useState(20);
  const [actFarmsReached, setActFarmsReached] = useState(8);
  const [actCostZar, setActCostZar] = useState(5000);
  const [actFacilitator, setActFacilitator] = useState('');
  const [actOutcomes, setActOutcomes] = useState('');
  const [savingAct, setSavingAct] = useState(false);

  // Assign specialist state
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assignExpertId, setAssignExpertId] = useState('');
  const [assignRegion, setAssignRegion] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

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
      const [data, dir] = await Promise.all([
        apiRequest<OrganisationOverviewPayload>('/api/organisation/overview'),
        apiRequest<CollaborationDirectoryPayload>('/api/collaboration/directory').catch(
          () => ({ experts: [], organisations: [] }) as CollaborationDirectoryPayload
        ),
      ]);
      setOverview(data);
      setExpertsDirectory(dir.experts || []);
      if (dir.experts[0] && !assignExpertId) {
        setAssignExpertId(dir.experts[0].userId);
      }
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
        setProjProvince(data.organisation.province);
        setActProvince(data.organisation.province);
        if (!assignRegion) setAssignRegion(data.organisation.district || data.organisation.province);
      } else {
        setContactEmail(user.email);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load Organisation Portal.');
    } finally {
      setLoading(false);
    }
  }, [user.email, assignExpertId, assignRegion]);

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

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projTitle.trim()) return;
    setSavingProj(true);
    setNotice(null);
    setError(null);
    try {
      await createOrganisationProject({
        title: projTitle.trim(),
        programmeCode: projCode.trim() || `PRG-${Date.now().toString().slice(-4)}`,
        province: projProvince,
        focusArea: projFocus.trim() || 'Smallholder Farmer Support',
        startDate: projStartDate,
        targetEndDate: projTargetEndDate || projStartDate,
        targetFarmsCount: Number(projTargetFarms) || 1,
        targetHectares: Number(projTargetHa) || 1,
        budgetAllocatedZar: Number(projBudgetZar) || 0,
        summary: projSummary.trim() || 'Programme initiated by organisation manager.',
      });
      setProjTitle('');
      setProjCode('');
      setProjFocus('');
      setProjSummary('');
      setNotice('Organisation agricultural project created.');
      await loadOverview();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to create project.');
    } finally {
      setSavingProj(false);
    }
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle.trim()) return;
    setSavingAct(true);
    setNotice(null);
    setError(null);
    try {
      await createOrganisationActivity({
        projectId: actProjectId || null,
        title: actTitle.trim(),
        activityType: actType,
        activityDate: actDate,
        province: actProvince,
        district: actDistrict.trim() || overview?.organisation?.district || 'Regional',
        participantsCount: Number(actParticipants) || 0,
        farmsReachedCount: Number(actFarmsReached) || 0,
        costZar: Number(actCostZar) || 0,
        facilitatorName: actFacilitator.trim() || user.profile?.fullName || user.email,
        outcomesSummary: actOutcomes.trim() || 'Recorded field programme activity.',
      });
      setActTitle('');
      setActOutcomes('');
      setNotice('Programme activity logged.');
      await loadOverview();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to log programme activity.');
    } finally {
      setSavingAct(false);
    }
  };

  const handleAssignSpecialist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignExpertId) return;
    setSavingAssign(true);
    setNotice(null);
    setError(null);
    try {
      await assignOrganisationSpecialist({
        projectId: assignProjectId || null,
        expertUserId: assignExpertId,
        assignedRegion: assignRegion.trim() || overview?.organisation?.province || 'South Africa',
      });
      setNotice('Specialist assigned to organisation programme.');
      await loadOverview();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to assign specialist.');
    } finally {
      setSavingAssign(false);
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

  const projectsList = overview?.projects || [];
  const activitiesList = overview?.programmeActivities || [];
  const assignedSpecialists = overview?.assignedSpecialists || [];
  const finSummary = overview?.financialSummary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
            Organisation Manager Portal
          </h1>
          <p className="text-sm text-[#475569] mt-0.5">
            {overview?.organisation?.name || 'Register your cooperative or agricultural organisation'} ·
            Authorised multi-farm oversight & provincial analytics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#CBD5E1] rounded-xl overflow-x-auto max-w-full">
            {[
              { id: 'analytics' as const, label: 'Organisation Analytics', icon: <BarChart3 className="w-4 h-4" /> },
              {
                id: 'projects' as const,
                label: `Projects & Specialists (${projectsList.length})`,
                icon: <Briefcase className="w-4 h-4" />,
              },
              { id: 'farms_weather' as const, label: 'Authorised Farms & Weather', icon: <CloudRain className="w-4 h-4" /> },
              { id: 'profile' as const, label: 'Organisation Profile', icon: <Building2 className="w-4 h-4" /> },
              { id: 'team_comms' as const, label: 'Users & Communications', icon: <Users className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  subTab === tab.id
                    ? 'bg-[#0B3D91] text-white'
                    : 'text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0B1F3A]'
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
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-[#174C3C] hover:bg-[#113B2E] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Aggregated PDF / CSV Reports</span>
          </button>
        </div>
      </div>

      {/* Mandatory Privacy Protection Banner */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs text-[#0B1F3A]">
        <Lock className="w-4 h-4 text-[#0B3D91] shrink-0 mt-0.5" />
        <span>
          {overview?.privacyNotice ||
            'Privacy Protection Active: Individual farmer identities and private financial records are protected in all organisation views and aggregated exports.'}
        </span>
      </div>

      {notice && (
        <div className="bg-[#ECF5F2] border border-[#A7D7C5] text-[#0B1F3A] rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#174C3C]" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-4 py-3 text-sm">
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
          <div key={kpi.label} className="bg-white border border-[#CBD5E1] rounded-xl p-4">
            <p className="text-xs text-[#475569]">{kpi.label}</p>
            <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-1">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white border border-[#CBD5E1] rounded-2xl p-8 text-sm text-[#475569]">
          Loading organisation analytics...
        </div>
      ) : subTab === 'analytics' && overview ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Provincial Distribution */}
            <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                Provincial Agricultural Distribution
              </h2>
              {overview.provincialDistribution.length === 0 ? (
                <p className="text-sm text-[#475569]">
                  No authorised farms assigned to your organisation yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {overview.provincialDistribution.map((prov) => {
                    const widthPct = Math.max(8, Math.round((prov.hectares / maxProvinceHa) * 100));
                    return (
                      <div key={prov.province} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#0B1F3A]">{prov.province}</span>
                          <span className="font-mono tabular-nums text-[#475569]">
                            {prov.farmCount} farm(s) · {prov.hectares} ha · {prov.livestockHead} head
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#174C3C] rounded-full"
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
            <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                Agricultural Trend Analysis (Monthly Output & Incidents)
              </h2>
              {overview.trendAnalysis.length === 0 ? (
                <p className="text-sm text-[#475569]">No longitudinal trend records yet.</p>
              ) : (
                <div className="space-y-3">
                  <svg
                    viewBox="0 0 420 140"
                    className="w-full h-36 bg-[#F8FAFC] rounded-xl p-2 border border-[#E2E8F0]"
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
                          <rect x={x} y={y} width={barW} height={barH} rx={4} fill="#0B3D91" />
                          <text
                            x={x + barW / 2}
                            y={128}
                            textAnchor="middle"
                            fontSize="9"
                            fill="#475569"
                          >
                            {pt.period}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  <div className="divide-y divide-[#E2E8F0] text-xs">
                    {overview.trendAnalysis.map((t) => (
                      <div key={t.period} className="py-1.5 flex items-center justify-between">
                        <span className="font-mono font-semibold text-[#0B1F3A]">{t.period}</span>
                        <span className="font-mono tabular-nums text-[#334155]">
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

          {/* Consent-Scoped Financial Summary */}
          {finSummary && (
            <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Consent-Scoped Programme & Farm Financial Summary
                </h2>
                <span className="font-mono text-xs text-[#0B3D91] font-semibold tabular-nums">
                  Financial Scope Active: {finSummary.financialScopedFarmsCount} /{' '}
                  {finSummary.totalAuthorisedFarmsCount} farms
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                  <p className="text-[#475569]">Programme Budget Allocated</p>
                  <p className="font-mono text-lg font-bold tabular-nums text-[#0B1F3A] mt-1">
                    R{finSummary.programmeBudgetAllocatedZar.toLocaleString()}
                  </p>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                  <p className="text-[#475569]">Programme Budget Spent</p>
                  <p className="font-mono text-lg font-bold tabular-nums text-[#0B3D91] mt-1">
                    R{finSummary.programmeBudgetSpentZar.toLocaleString()}
                  </p>
                </div>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                  <p className="text-[#475569]">Authorised Farm Expenses</p>
                  <p className="font-mono text-lg font-bold tabular-nums text-[#0B1F3A] mt-1">
                    R{finSummary.recordedFarmExpensesZar.toLocaleString()}
                  </p>
                </div>
                <div className="bg-[#ECF5F2] border border-[#A7D7C5] rounded-xl p-4">
                  <p className="text-[#174C3C]">Est. Crop & Stock Value (Scoped)</p>
                  <p className="font-mono text-lg font-bold tabular-nums text-[#174C3C] mt-1">
                    R{finSummary.estimatedCropAndStockValueZar.toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#475569]">{finSummary.scopeNote}</p>
            </div>
          )}

          {/* Crop, Livestock & Farming Category Summaries */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-3">
              <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                Crop Distribution Summary
              </h3>
              {overview.cropDistribution.length === 0 ? (
                <p className="text-xs text-[#475569]">No crop records in scope.</p>
              ) : (
                <div className="divide-y divide-[#E2E8F0] text-xs">
                  {overview.cropDistribution.map((c) => (
                    <div key={c.cropName} className="py-2 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#0B1F3A]">{c.cropName}</p>
                        <p className="text-[#475569]">{c.farmsCount} farm(s)</p>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <p className="font-semibold text-[#0B1F3A]">{c.hectares} ha</p>
                        <p className="text-[#475569]">{c.harvestedKg.toLocaleString()} kg</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-3">
              <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                Livestock Distribution Summary
              </h3>
              {overview.livestockDistribution.length === 0 ? (
                <p className="text-xs text-[#475569]">No livestock records in scope.</p>
              ) : (
                <div className="divide-y divide-[#E2E8F0] text-xs">
                  {overview.livestockDistribution.map((l) => (
                    <div key={l.animalType} className="py-2 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#0B1F3A]">{l.animalType}</p>
                        <p className="text-[#475569]">{l.groupsCount} herd/flock group(s)</p>
                      </div>
                      <p className="font-mono font-bold tabular-nums text-[#0B1F3A]">
                        {l.headCount.toLocaleString()} head
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-3">
              <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                Farming Categories
              </h3>
              {overview.farmingCategoriesSummary.length === 0 ? (
                <p className="text-xs text-[#475569]">No farming categories recorded.</p>
              ) : (
                <div className="divide-y divide-[#E2E8F0] text-xs">
                  {overview.farmingCategoriesSummary.map((fc) => (
                    <div key={fc.category} className="py-2 flex items-center justify-between">
                      <span className="font-semibold text-[#0B1F3A]">{fc.category}</span>
                      <span className="font-mono tabular-nums text-[#475569]">
                        {fc.farmCount} farm(s) · {fc.hectares} ha
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : subTab === 'projects' && overview ? (
        <div className="space-y-6">
          {/* Projects Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-7 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#0B3D91]" />
                <span>Agricultural Projects ({projectsList.length})</span>
              </h2>

              {projectsList.length === 0 ? (
                <p className="text-sm text-[#475569]">No projects recorded yet.</p>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {projectsList.map((proj) => {
                    const pct =
                      proj.budgetAllocatedZar > 0
                        ? Math.min(
                            100,
                            Math.round((proj.budgetSpentZar / proj.budgetAllocatedZar) * 100)
                          )
                        : 0;
                    return (
                      <div key={proj.id} className="py-3.5 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-display text-sm font-bold text-[#0B1F3A]">
                              {proj.title}
                            </p>
                            <p className="text-[#475569]">
                              <span className="font-mono">{proj.programmeCode}</span> · {proj.province} ·{' '}
                              {proj.focusArea}
                            </p>
                          </div>
                          <span className="font-mono uppercase font-semibold text-[#0B3D91]">
                            {proj.status}
                          </span>
                        </div>
                        <p className="text-[#334155]">{proj.summary}</p>
                        <div className="flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums text-[#475569]">
                          <span>
                            Targets: {proj.targetFarmsCount} farms · {proj.targetHectares} ha
                          </span>
                          <span>
                            Budget: R{proj.budgetSpentZar.toLocaleString()} / R
                            {proj.budgetAllocatedZar.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0B3D91]"
                            style={{ width: `${Math.max(4, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Create Project Form */}
            <form
              onSubmit={handleCreateProject}
              className="lg:col-span-5 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-3"
            >
              <h3 className="font-display text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#0B3D91]" />
                <span>Create Agricultural Project</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#334155] mb-1">Project Title *</label>
                  <input
                    type="text"
                    required
                    value={projTitle}
                    onChange={(e) => setProjTitle(e.target.value)}
                    placeholder="e.g. Lowveld Drip Irrigation Rollout"
                    className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">Programme Code</label>
                  <input
                    type="text"
                    value={projCode}
                    onChange={(e) => setProjCode(e.target.value)}
                    placeholder="e.g. LGC-2026-03"
                    className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">Province</label>
                  <select
                    value={projProvince}
                    onChange={(e) => setProjProvince(e.target.value)}
                    className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white"
                  >
                    {provinces.map((p) => (
                      <option key={p.code} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#334155] mb-1">Focus Area</label>
                  <input
                    type="text"
                    value={projFocus}
                    onChange={(e) => setProjFocus(e.target.value)}
                    placeholder="e.g. Climate-smart maize & soil fertility"
                    className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={projStartDate}
                    onChange={(e) => setProjStartDate(e.target.value)}
                    className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">Target End Date</label>
                  <input
                    type="date"
                    value={projTargetEndDate}
                    onChange={(e) => setProjTargetEndDate(e.target.value)}
                    className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">Target Farms</label>
                  <input
                    type="number"
                    min={1}
                    value={projTargetFarms}
                    onChange={(e) => setProjTargetFarms(Number(e.target.value))}
                    className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#334155] mb-1">Target Hectares</label>
                  <input
                    type="number"
                    min={1}
                    value={projTargetHa}
                    onChange={(e) => setProjTargetHa(Number(e.target.value))}
                    className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#334155] mb-1">Allocated Budget (ZAR)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={projBudgetZar}
                    onChange={(e) => setProjBudgetZar(Number(e.target.value))}
                    className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#334155] mb-1">Project Summary</label>
                  <textarea
                    rows={2}
                    value={projSummary}
                    onChange={(e) => setProjSummary(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingProj}
                className="w-full py-2.5 min-h-[42px] rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-xs font-semibold cursor-pointer"
              >
                {savingProj ? 'Creating...' : 'Create Project'}
              </button>
            </form>
          </div>

          {/* Programme Activities & Specialist Assignments */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-7 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#174C3C]" />
                <span>Programme Field Activities ({activitiesList.length})</span>
              </h2>

              <form
                onSubmit={handleCreateActivity}
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-4 space-y-3 text-xs"
              >
                <p className="font-semibold text-[#0B1F3A]">Log New Programme Activity</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    value={actTitle}
                    onChange={(e) => setActTitle(e.target.value)}
                    placeholder="Activity title..."
                    className="sm:col-span-2 px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white"
                  />
                  <select
                    value={actType}
                    onChange={(e) =>
                      setActType(
                        e.target.value as OrganisationProgrammeActivityItem['activityType']
                      )
                    }
                    className="px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white"
                  >
                    <option value="training_workshop">Training Workshop</option>
                    <option value="field_day">Field Day</option>
                    <option value="soil_sampling_drive">Soil Sampling Drive</option>
                    <option value="vaccination_campaign">Vaccination Campaign</option>
                    <option value="input_distribution">Input Distribution</option>
                    <option value="advisory_visit">Advisory Visit</option>
                  </select>
                  <select
                    value={actProjectId}
                    onChange={(e) => setActProjectId(e.target.value)}
                    className="px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white"
                  >
                    <option value="">General Programme</option>
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={actDate}
                    onChange={(e) => setActDate(e.target.value)}
                    className="px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white"
                  />
                  <input
                    type="text"
                    value={actFacilitator}
                    onChange={(e) => setActFacilitator(e.target.value)}
                    placeholder="Facilitator name"
                    className="px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white"
                  />
                  <input
                    type="number"
                    min={0}
                    value={actParticipants}
                    onChange={(e) => setActParticipants(Number(e.target.value))}
                    placeholder="Participants"
                    className="px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white font-mono"
                  />
                  <input
                    type="number"
                    min={0}
                    value={actFarmsReached}
                    onChange={(e) => setActFarmsReached(Number(e.target.value))}
                    placeholder="Farms reached"
                    className="px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white font-mono"
                  />
                  <input
                    type="number"
                    min={0}
                    value={actCostZar}
                    onChange={(e) => setActCostZar(Number(e.target.value))}
                    placeholder="Cost (ZAR)"
                    className="px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white font-mono"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={actOutcomes}
                    onChange={(e) => setActOutcomes(e.target.value)}
                    placeholder="Outcomes summary..."
                    className="flex-1 min-w-[200px] px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white"
                  />
                  <button
                    type="submit"
                    disabled={savingAct}
                    className="px-4 py-2 min-h-[38px] rounded-lg bg-[#174C3C] hover:bg-[#113B2E] text-white font-semibold cursor-pointer"
                  >
                    {savingAct ? 'Logging...' : 'Log Activity'}
                  </button>
                </div>
              </form>

              {activitiesList.length === 0 ? (
                <p className="text-xs text-[#475569]">No programme activities logged yet.</p>
              ) : (
                <div className="divide-y divide-[#E2E8F0] text-xs">
                  {activitiesList.map((act) => (
                    <div key={act.id} className="py-3 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-[#0B1F3A] text-sm">{act.title}</span>
                        <span className="font-mono tabular-nums text-[#475569]">
                          {act.activityDate} · R{act.costZar.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[#475569]">
                        <span className="capitalize">{act.activityType.replace(/_/g, ' ')}</span> ·{' '}
                        {act.district}, {act.province} · {act.participantsCount} participants ·{' '}
                        {act.farmsReachedCount} farm(s) · Facilitator: {act.facilitatorName}
                      </p>
                      <p className="text-[#334155]">{act.outcomesSummary}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Assigned Agricultural Specialists */}
            <section className="lg:col-span-5 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                Assigned Specialists ({assignedSpecialists.length})
              </h2>

              <form
                onSubmit={handleAssignSpecialist}
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-4 space-y-3 text-xs"
              >
                <p className="font-semibold text-[#0B1F3A]">Assign Specialist to Programme</p>
                <div className="space-y-2">
                  <select
                    value={assignExpertId}
                    onChange={(e) => setAssignExpertId(e.target.value)}
                    className="w-full px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white"
                  >
                    {expertsDirectory.map((ex) => (
                      <option key={ex.userId} value={ex.userId}>
                        {ex.fullName} — {ex.specialisation.replace(/_/g, ' ')}
                        {ex.isDemonstration ? ' (Demo · Unverified)' : ''}
                      </option>
                    ))}
                  </select>
                  <select
                    value={assignProjectId}
                    onChange={(e) => setAssignProjectId(e.target.value)}
                    className="w-full px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white"
                  >
                    <option value="">Organisation-wide Advisory</option>
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        Project: {p.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={assignRegion}
                    onChange={(e) => setAssignRegion(e.target.value)}
                    placeholder="Assigned region / district"
                    className="w-full px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingAssign || !assignExpertId}
                  className="w-full py-2 min-h-[38px] rounded-lg bg-[#0B3D91] hover:bg-[#082E70] disabled:opacity-50 text-white font-semibold cursor-pointer"
                >
                  {savingAssign ? 'Assigning...' : 'Assign Specialist'}
                </button>
              </form>

              {assignedSpecialists.length === 0 ? (
                <p className="text-xs text-[#475569]">No specialists assigned yet.</p>
              ) : (
                <div className="divide-y divide-[#E2E8F0] text-xs">
                  {assignedSpecialists.map((sp) => (
                    <div key={sp.id} className="py-3 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0B1F3A] text-sm">{sp.expertName}</span>
                        <span className="font-mono uppercase text-[#174C3C] font-semibold">
                          {sp.status}
                        </span>
                      </div>
                      <p className="text-[#0B3D91] capitalize font-semibold">
                        {sp.specialisation.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[#475569]">
                        Region: {sp.assignedRegion} · Assigned{' '}
                        <span className="font-mono tabular-nums">{sp.assignedAt.slice(0, 10)}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : subTab === 'farms_weather' && overview ? (
        <div className="space-y-6">
          {/* Anonymised Multi-Farm Performance Table */}
          <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
              Authorised Farm Performance Comparisons (Identity & Financials Protected)
            </h2>
            {overview.authorisedFarms.length === 0 ? (
              <p className="text-sm text-[#475569]">
                No farms have granted active access to your organisation yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#475569]">
                      <th className="py-2 pr-4">Anonymised Ref</th>
                      <th className="py-2 pr-4">Province / District</th>
                      <th className="py-2 pr-4 text-right">Hectares</th>
                      <th className="py-2 pr-4 text-right">Harvested (kg)</th>
                      <th className="py-2 pr-4 text-right">Livestock Head</th>
                      <th className="py-2 pr-4 text-right">Active Incidents</th>
                      <th className="py-2">Authorised Basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {overview.authorisedFarms.map((af) => (
                      <tr key={af.farmId}>
                        <td className="py-2.5 pr-4 font-mono font-semibold text-[#0B1F3A]">
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
                        <td className="py-2.5 text-[#475569]">{af.authorisedBasis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Regional Weather Comparisons */}
          <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
              Regional Weather Comparisons (Forecast vs Farmer Rain-Gauge Reports)
            </h2>
            {overview.weatherComparisons.length === 0 ? (
              <p className="text-sm text-[#475569]">No weather observations available across authorised farms.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#475569]">
                      <th className="py-2 pr-4">Farm Ref</th>
                      <th className="py-2 pr-4">Province</th>
                      <th className="py-2 pr-4">Latest Date</th>
                      <th className="py-2 pr-4 text-right">Forecast Rain (mm)</th>
                      <th className="py-2 pr-4 text-right">Farmer Gauge (mm)</th>
                      <th className="py-2 pr-4 text-right">Temp (°C)</th>
                      <th className="py-2">QC Classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {overview.weatherComparisons.map((wc) => (
                      <tr key={wc.farmReferenceCode}>
                        <td className="py-2.5 pr-4 font-mono font-semibold text-[#0B1F3A]">
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
                        <td className="py-2.5 text-[#475569]">
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
          className="bg-white border border-[#CBD5E1] rounded-2xl p-6 max-w-3xl space-y-4"
        >
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
            Organisation Registration & Profile
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#334155]">Organisation Name</label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Lowveld Growers Cooperative"
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#CBD5E1] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#334155]">Organisation Type</label>
              <select
                value={orgType}
                onChange={(e) => setOrgType(e.target.value as OrganisationType)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#CBD5E1] bg-white text-sm"
              >
                {ORG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#334155]">
                Registration Number
              </label>
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#CBD5E1] font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#334155]">Province</label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#CBD5E1] bg-white text-sm"
              >
                {provinces.map((p) => (
                  <option key={p.code} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#334155]">District</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#CBD5E1] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#334155]">Primary Focus</label>
              <input
                type="text"
                value={primaryFocus}
                onChange={(e) => setPrimaryFocus(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#CBD5E1] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#334155]">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#CBD5E1] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#334155]">Contact Phone</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-[#CBD5E1] text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#334155]">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#CBD5E1] text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={savingOrg}
            className="px-5 py-2.5 min-h-[42px] rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold cursor-pointer"
          >
            {savingOrg ? 'Saving...' : 'Save Organisation Profile'}
          </button>
        </form>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Organisation User Management */}
          <div className="lg:col-span-7 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-5">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#0B3D91]" />
              <span>Organisation User Management ({overview?.members.length || 0})</span>
            </h2>

            <form
              onSubmit={handleAddMember}
              className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end"
            >
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Sipho Mabena"
                  className="w-full px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="sipho@coop.co.za"
                  className="w-full px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">Org Role</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as OrganisationMemberRole)}
                  className="w-full px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
                >
                  <option value="analyst">Analyst</option>
                  <option value="advisor">Advisor</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={addingMember}
                className="px-4 py-2 min-h-[38px] rounded-lg bg-[#0B3D91] hover:bg-[#082E70] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                {addingMember ? 'Adding...' : 'Add User'}
              </button>
            </form>

            <div className="divide-y divide-[#E2E8F0]">
              {(overview?.members || []).map((m) => (
                <div key={m.membershipId} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-[#0B1F3A]">{m.fullName}</p>
                    <p className="text-xs text-[#475569]">
                      {m.email} · Role: <span className="capitalize font-semibold">{m.orgRole}</span> ·{' '}
                      <span
                        className={`font-semibold ${
                          m.status === 'active' ? 'text-[#174C3C]' : 'text-[#FC3D21]'
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
                      className="px-3 py-1.5 min-h-[36px] rounded-lg border border-[#CBD5E1] hover:bg-[#F1F5F9] text-xs font-semibold cursor-pointer"
                    >
                      {m.status === 'active' ? 'Deactivate' : 'Reactivate'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Organisation Communication Broadcaster */}
          <div className="lg:col-span-5 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-[#0B3D91]" />
              <span>Send Organisation Communication</span>
            </h2>
            <p className="text-xs text-[#475569]">
              Respects each recipient&apos;s notification category preferences and delivers in their preferred language.
            </p>
            <form onSubmit={handleSendCommunication} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#334155]">Audience</label>
                <select
                  value={commAudience}
                  onChange={(e) =>
                    setCommAudience(
                      e.target.value as 'authorised_farmers' | 'org_members' | 'all_connected'
                    )
                  }
                  className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
                >
                  <option value="all_connected">Authorised Farmers & Organisation Team</option>
                  <option value="authorised_farmers">Authorised Farmers Only</option>
                  <option value="org_members">Organisation Team Only</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#334155]">Subject</label>
                <input
                  type="text"
                  required
                  value={commTitle}
                  onChange={(e) => setCommTitle(e.target.value)}
                  placeholder="e.g. Regional Cooperative Market Intake Schedule"
                  className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#334155]">Message</label>
                <textarea
                  rows={4}
                  required
                  value={commMessage}
                  onChange={(e) => setCommMessage(e.target.value)}
                  placeholder="Write cooperative guidance, intake updates, or regional coordination details..."
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <select
                  value={commPriority}
                  onChange={(e) => setCommPriority(e.target.value as 'normal' | 'high')}
                  className="px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
                >
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <button
                  type="submit"
                  disabled={sendingComm}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-xs font-semibold cursor-pointer"
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
