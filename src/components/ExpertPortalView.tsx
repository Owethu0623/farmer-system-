import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MessageSquarePlus,
  Microscope,
  Sprout,
  Users,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  AuthUser,
  ExpertConcernCategory,
  ExpertFarmReviewPayload,
  ExpertFeedbackItem,
  ExpertOverviewPayload,
  ExpertSpecialisation,
  LanguageCode,
} from '../types';

interface ExpertPortalViewProps {
  user: AuthUser;
  provinces: { code: string; name: string }[];
  onRefreshWorkspace?: () => Promise<void>;
}

const SPECIALISATION_OPTIONS: { value: ExpertSpecialisation; label: string }[] = [
  { value: 'agronomist', label: 'Agronomist' },
  { value: 'soil_specialist', label: 'Soil Specialist' },
  { value: 'livestock_specialist', label: 'Livestock Specialist' },
  { value: 'veterinarian', label: 'Veterinarian' },
  { value: 'agricultural_consultant', label: 'Agricultural Consultant' },
];

const CONCERN_CATEGORIES: { value: ExpertConcernCategory; label: string }[] = [
  { value: 'farm_info', label: 'Farm Information Review' },
  { value: 'crop_concern', label: 'Crop Concern Review' },
  { value: 'soil_info', label: 'Soil Information Review' },
  { value: 'livestock_concern', label: 'Livestock Concern Review' },
  { value: 'ai_review', label: 'AI Recommendation Review' },
  { value: 'incident_assistance', label: 'Incident Assistance' },
  { value: 'general_guidance', label: 'General Agricultural Guidance' },
];

export const ExpertPortalView: React.FC<ExpertPortalViewProps> = ({
  user,
  provinces,
  onRefreshWorkspace,
}) => {
  const [subTab, setSubTab] = useState<'overview' | 'review' | 'profile' | 'activity'>('overview');
  const [overview, setOverview] = useState<ExpertOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Selected farm review state
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');
  const [farmReview, setFarmReview] = useState<ExpertFarmReviewPayload | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);

  // Feedback composer state
  const [concernCategory, setConcernCategory] =
    useState<ExpertConcernCategory>('general_guidance');
  const [subject, setSubject] = useState('');
  const [assessment, setAssessment] = useState('');
  const [recommendationsText, setRecommendationsText] = useState('');
  const [fbStatus, setFbStatus] = useState<'pending_review' | 'in_progress' | 'completed'>(
    'completed'
  );
  const [linkedIncidentId, setLinkedIncidentId] = useState<string>('');
  const [linkedCropId, setLinkedCropId] = useState<string>('');
  const [linkedLivestockId, setLinkedLivestockId] = useState<string>('');
  const [linkedSoilId, setLinkedSoilId] = useState<string>('');
  const [linkedAiId, setLinkedAiId] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Profile editor state
  const [specialisation, setSpecialisation] = useState<ExpertSpecialisation>('agronomist');
  const [qualifications, setQualifications] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [yearsExp, setYearsExp] = useState(5);
  const [provincesServed, setProvincesServed] = useState<string[]>([]);
  const [languagesSpoken, setLanguagesSpoken] = useState<LanguageCode[]>(['en']);
  const [availability, setAvailability] = useState<'available' | 'limited' | 'unavailable'>(
    'available'
  );
  const [bio, setBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ExpertOverviewPayload>('/api/expert/overview');
      setOverview(data);
      setSpecialisation(data.profile.specialisation);
      setQualifications(data.profile.qualifications);
      setRegNumber(data.profile.professionalBodyNumber);
      setYearsExp(data.profile.yearsExperience);
      setProvincesServed(data.profile.provincesServed);
      setLanguagesSpoken(data.profile.languagesSpoken);
      setAvailability(data.profile.availabilityStatus);
      setBio(data.profile.bio);
      if (data.assignedFarms.length > 0 && !selectedFarmId) {
        setSelectedFarmId(data.assignedFarms[0].farmId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load Expert Portal.');
    } finally {
      setLoading(false);
    }
  }, [selectedFarmId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const loadFarmReview = useCallback(async (farmId: string) => {
    if (!farmId) {
      setFarmReview(null);
      return;
    }
    setLoadingReview(true);
    setError(null);
    try {
      const data = await apiRequest<ExpertFarmReviewPayload>(
        `/api/expert/farms/${farmId}/review`
      );
      setFarmReview(data);
    } catch (err: unknown) {
      setFarmReview(null);
      setError(err instanceof Error ? err.message : 'Unable to load farm review.');
    } finally {
      setLoadingReview(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === 'review' && selectedFarmId) {
      loadFarmReview(selectedFarmId);
    }
  }, [subTab, selectedFarmId, loadFarmReview]);

  const openConcernInReview = (concern: ExpertOverviewPayload['openConcerns'][number]) => {
    setSelectedFarmId(concern.farmId);
    setLinkedIncidentId(concern.linkedIncidentId || '');
    setLinkedCropId(concern.linkedCropId || '');
    setLinkedLivestockId(concern.linkedLivestockGroupId || '');
    setLinkedAiId(concern.linkedAiInsightId || '');
    setLinkedSoilId('');
    setConcernCategory(
      concern.concernType === 'incident'
        ? 'incident_assistance'
        : concern.concernType === 'crop_concern'
        ? 'crop_concern'
        : concern.concernType === 'livestock_concern'
        ? 'livestock_concern'
        : 'ai_review'
    );
    setSubject(`Advisory Review: ${concern.title}`);
    setSubTab('review');
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmId) return;
    setSubmittingFeedback(true);
    setNotice(null);
    setError(null);
    try {
      await apiRequest('/api/expert/feedback', {
        method: 'POST',
        body: JSON.stringify({
          farmId: selectedFarmId,
          concernCategory,
          subject,
          assessment,
          recommendations: recommendationsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          status: fbStatus,
          incidentId: linkedIncidentId || null,
          cropId: linkedCropId || null,
          livestockGroupId: linkedLivestockId || null,
          soilReportId: linkedSoilId || null,
          aiInsightId: linkedAiId || null,
        }),
      });
      setSubject('');
      setAssessment('');
      setRecommendationsText('');
      setLinkedIncidentId('');
      setLinkedCropId('');
      setLinkedLivestockId('');
      setLinkedSoilId('');
      setLinkedAiId('');
      setNotice('Professional feedback submitted and farmer notified.');
      await Promise.all([loadOverview(), loadFarmReview(selectedFarmId)]);
      if (onRefreshWorkspace) await onRefreshWorkspace();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleUpdateFeedbackStatus = async (
    fb: ExpertFeedbackItem,
    nextStatus: 'pending_review' | 'in_progress' | 'completed'
  ) => {
    await apiRequest(`/api/expert/feedback/${fb.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadOverview();
    if (selectedFarmId) await loadFarmReview(selectedFarmId);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setNotice(null);
    setError(null);
    try {
      await apiRequest('/api/expert/profile', {
        method: 'PUT',
        body: JSON.stringify({
          specialisation,
          qualifications,
          professionalBodyNumber: regNumber,
          yearsExperience: yearsExp,
          provincesServed,
          languagesSpoken,
          availabilityStatus: availability,
          bio,
        }),
      });
      setNotice('Agricultural expert profile & qualifications updated.');
      await loadOverview();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update expert profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#143326]">
            Agricultural Expert Portal
          </h1>
          <p className="text-sm text-[#4A5A50] mt-0.5">
            {user.profile?.fullName || user.email} ·{' '}
            {SPECIALISATION_OPTIONS.find((s) => s.value === overview?.profile.specialisation)?.label ||
              'Specialist'}{' '}
            · Authorised farmer access only
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-[#EAECE6] rounded-xl overflow-x-auto max-w-full">
          {[
            { id: 'overview' as const, label: 'Dashboard & Concerns', icon: <Users className="w-4 h-4" /> },
            { id: 'review' as const, label: 'Farm Review & Advice', icon: <Microscope className="w-4 h-4" /> },
            { id: 'profile' as const, label: 'Expert Profile', icon: <Award className="w-4 h-4" /> },
            { id: 'activity' as const, label: 'Activity Records', icon: <Activity className="w-4 h-4" /> },
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
      </div>

      {notice && (
        <div className="bg-[#EDF5EF] border border-[#BFD6C5] text-[#143326] rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#1B4332] shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Expert KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Assigned Farmers', value: overview?.stats.assignedFarmersCount ?? 0 },
          { label: 'Authorised Farms', value: overview?.stats.authorisedFarmsCount ?? 0 },
          { label: 'Pending Reviews', value: overview?.stats.pendingReviewsCount ?? 0 },
          { label: 'Open Concerns', value: overview?.stats.openConcernsCount ?? 0 },
          {
            label: 'Completed Consultations',
            value: overview?.stats.completedConsultationsCount ?? 0,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-[#E2E6DF] rounded-xl p-4">
            <p className="text-xs text-[#4A5A50]">{kpi.label}</p>
            <p className="font-mono text-2xl font-bold tabular-nums text-[#143326] mt-1">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white border border-[#E2E6DF] rounded-2xl p-8 text-sm text-[#4A5A50]">
          Loading authorised farmer records...
        </div>
      ) : subTab === 'overview' && overview ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Authorised Farms */}
            <div className="lg:col-span-5 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#143326]">
                Authorised Farmers & Farms
              </h2>
              {overview.assignedFarms.length === 0 ? (
                <div className="py-6 text-sm text-[#4A5A50] space-y-2">
                  <p className="font-semibold text-[#143326]">No active farm access grants</p>
                  <p className="text-xs">
                    Farmers control access to their data. Once a farmer grants you permission in their Farm Access settings, their farm appears here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E6DF]">
                  {overview.assignedFarms.map((af) => (
                    <div key={af.farmId} className="py-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-[#143326]">{af.farmName}</p>
                          <p className="text-xs text-[#4A5A50]">
                            {af.farmerName} · {af.province} ·{' '}
                            <span className="font-mono tabular-nums">{af.farmSizeHectares} ha</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFarmId(af.farmId);
                            setSubTab('review');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#EDF5EF] hover:bg-[#DCEBDD] text-xs font-semibold text-[#1B4332] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Open Review
                        </button>
                      </div>
                      <p className="text-xs text-[#4A5A50]">
                        <span className="font-mono tabular-nums">{af.cropsCount}</span> crops ·{' '}
                        <span className="font-mono tabular-nums">{af.livestockHeadCount}</span>{' '}
                        livestock ·{' '}
                        <span className="font-mono tabular-nums">{af.openIncidentsCount}</span> open
                        incidents
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Open Agricultural Concerns Queue */}
            <div className="lg:col-span-7 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-[#143326] flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#D97706]" />
                  <span>Open Agricultural Concerns & Pending AI Reviews</span>
                </h2>
                <span className="text-xs font-mono text-[#4A5A50]">
                  {overview.openConcerns.length} item(s)
                </span>
              </div>

              {overview.openConcerns.length === 0 ? (
                <p className="text-sm text-[#4A5A50] py-6">
                  No open incidents, crop/livestock concerns, or unreviewed AI recommendations across your authorised farms.
                </p>
              ) : (
                <div className="divide-y divide-[#E2E6DF]">
                  {overview.openConcerns.map((c) => (
                    <div key={c.id} className="py-3.5 flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 max-w-xl">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#4A5A50]">
                          <span className="font-semibold text-[#1B4332] uppercase">
                            {c.concernType.replace(/_/g, ' ')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{c.farmName}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-semibold ${
                              c.severity === 'high'
                                ? 'text-[#DC2626]'
                                : c.severity === 'medium'
                                ? 'text-[#D97706]'
                                : 'text-[#4A5A50]'
                            }`}
                          >
                            {c.severity} priority
                          </span>
                          {c.hasExpertFeedback && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#16A34A] font-semibold">Reviewed</span>
                            </>
                          )}
                        </div>
                        <p className="font-semibold text-sm text-[#143326]">{c.title}</p>
                        <p className="text-xs text-[#35443B]">{c.detail}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openConcernInReview(c)}
                        className="px-3 py-1.5 rounded-lg border border-[#1B4332] text-xs font-semibold text-[#1B4332] hover:bg-[#EDF5EF] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Review & Advise
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Feedback & Consultations */}
          <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#143326] flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#1B4332]" />
              <span>Recent Professional Feedback & Consultations</span>
            </h2>
            {overview.recentFeedback.length === 0 ? (
              <p className="text-sm text-[#4A5A50]">No feedback submitted yet.</p>
            ) : (
              <div className="divide-y divide-[#E2E6DF]">
                {overview.recentFeedback.map((fb) => (
                  <div key={fb.id} className="py-4 flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1 max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#4A5A50]">
                        <span className="font-semibold text-[#1B4332]">
                          {fb.concernCategory.replace(/_/g, ' ')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{fb.farmName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{fb.updatedAt.slice(0, 10)}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            fb.status === 'completed' ? 'text-[#16A34A]' : 'text-[#D97706]'
                          }`}
                        >
                          {fb.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="font-semibold text-sm text-[#143326]">{fb.subject}</p>
                      <p className="text-xs text-[#35443B]">{fb.assessment}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {fb.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateFeedbackStatus(fb, 'completed')}
                          className="px-3 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : subTab === 'review' && overview ? (
        <div className="space-y-6">
          <div className="bg-white border border-[#E2E6DF] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-[#35443B]">Authorised Farm:</label>
              <select
                value={selectedFarmId}
                onChange={(e) => setSelectedFarmId(e.target.value)}
                className="px-3.5 py-2 rounded-lg border border-[#D4DDD2] bg-white text-sm font-semibold text-[#143326]"
              >
                {overview.assignedFarms.length === 0 ? (
                  <option value="">No authorised farms</option>
                ) : (
                  overview.assignedFarms.map((af) => (
                    <option key={af.farmId} value={af.farmId}>
                      {af.farmName} ({af.farmerName})
                    </option>
                  ))
                )}
              </select>
            </div>
            {farmReview && (
              <p className="text-xs text-[#4A5A50]">
                Authorised Scopes:{' '}
                {Object.entries(farmReview.scopes)
                  .filter(([, v]) => v)
                  .map(([k]) => k)
                  .join(' · ')}
              </p>
            )}
          </div>

          {loadingReview ? (
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-8 text-sm text-[#4A5A50]">
              Loading farm dossier...
            </div>
          ) : !farmReview ? (
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-8 text-sm text-[#4A5A50]">
              Select an authorised farm to inspect crops, soil reports, livestock, incidents, and AI recommendations.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Farm Dossier */}
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-[#143326]">
                    {farmReview.farm.name}
                  </h2>
                  <p className="text-xs text-[#4A5A50]">
                    Farmer: {farmReview.farmerName} ·{' '}
                    {farmReview.farm.location?.province} ·{' '}
                    {farmReview.farm.location?.districtMunicipality} ·{' '}
                    <span className="font-mono tabular-nums">
                      {farmReview.farm.farmSizeHectares} ha
                    </span>{' '}
                    · Water: {farmReview.farm.waterAvailability}
                  </p>

                  {/* Crops */}
                  <div className="pt-3 border-t border-[#E2E6DF] space-y-2">
                    <h3 className="text-sm font-bold text-[#143326] flex items-center gap-1.5">
                      <Sprout className="w-4 h-4 text-[#1B4332]" />
                      <span>Crops ({farmReview.crops.length})</span>
                    </h3>
                    {!farmReview.scopes.crops ? (
                      <p className="text-xs text-[#4A5A50]">Crop records not included in farmer grant scope.</p>
                    ) : farmReview.crops.length === 0 ? (
                      <p className="text-xs text-[#4A5A50]">No crop records logged.</p>
                    ) : (
                      <div className="divide-y divide-[#E2E6DF] text-xs">
                        {farmReview.crops.map((c) => (
                          <div key={c.id} className="py-2 flex items-center justify-between gap-2">
                            <div>
                              <span className="font-semibold text-[#143326]">
                                {c.cropName} ({c.cropVariety})
                              </span>{' '}
                              · {c.growthStage} · Damaged:{' '}
                              <span className="font-mono tabular-nums">{c.damagedPlants}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setConcernCategory('crop_concern');
                                setLinkedCropId(c.id);
                                setSubject(`Crop Guidance: ${c.cropName} (${c.cropVariety})`);
                              }}
                              className="text-[#1B4332] font-semibold hover:underline cursor-pointer"
                            >
                              Advise
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Soil */}
                  <div className="pt-3 border-t border-[#E2E6DF] space-y-2">
                    <h3 className="text-sm font-bold text-[#143326]">
                      Soil Laboratory Reports ({farmReview.soilReports.length})
                    </h3>
                    {!farmReview.scopes.soil ? (
                      <p className="text-xs text-[#4A5A50]">Soil records not included in farmer grant scope.</p>
                    ) : farmReview.soilReports.length === 0 ? (
                      <p className="text-xs text-[#4A5A50]">No soil lab reports uploaded.</p>
                    ) : (
                      <div className="divide-y divide-[#E2E6DF] text-xs">
                        {farmReview.soilReports.map((sr) => (
                          <div key={sr.id} className="py-2 flex items-center justify-between gap-2">
                            <div>
                              <span className="font-semibold text-[#143326]">{sr.sampleCode}</span> ·{' '}
                              pH H2O <span className="font-mono">{sr.soilPhWater ?? '—'}</span> · P{' '}
                              <span className="font-mono">{sr.phosphorusMgKg ?? '—'}</span> mg/kg ·{' '}
                              {sr.fertilityRating}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setConcernCategory('soil_info');
                                setLinkedSoilId(sr.id);
                                setSubject(`Soil Report Review (${sr.sampleCode})`);
                              }}
                              className="text-[#1B4332] font-semibold hover:underline cursor-pointer"
                            >
                              Review Soil
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Livestock */}
                  <div className="pt-3 border-t border-[#E2E6DF] space-y-2">
                    <h3 className="text-sm font-bold text-[#143326]">
                      Livestock Groups ({farmReview.livestockGroups.length})
                    </h3>
                    {!farmReview.scopes.livestock ? (
                      <p className="text-xs text-[#4A5A50]">Livestock records not included in farmer grant scope.</p>
                    ) : farmReview.livestockGroups.length === 0 ? (
                      <p className="text-xs text-[#4A5A50]">No livestock groups recorded.</p>
                    ) : (
                      <div className="divide-y divide-[#E2E6DF] text-xs">
                        {farmReview.livestockGroups.map((lg) => (
                          <div key={lg.id} className="py-2 flex items-center justify-between gap-2">
                            <div>
                              <span className="font-semibold text-[#143326]">{lg.groupName}</span> ·{' '}
                              <span className="font-mono tabular-nums">{lg.quantity}</span>{' '}
                              {lg.animalType} ({lg.breed}) · Health: {lg.healthStatus}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setConcernCategory('livestock_concern');
                                setLinkedLivestockId(lg.id);
                                setSubject(`Livestock Guidance: ${lg.groupName}`);
                              }}
                              className="text-[#1B4332] font-semibold hover:underline cursor-pointer"
                            >
                              Advise
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Incidents */}
                  <div className="pt-3 border-t border-[#E2E6DF] space-y-2">
                    <h3 className="text-sm font-bold text-[#143326]">
                      Agricultural Incidents ({farmReview.incidents.length})
                    </h3>
                    {farmReview.incidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="py-2 border-t border-[#F1F3EF] flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-[#143326]">{inc.title}</span> ·{' '}
                          {inc.status} · {inc.affectedQuantity} {inc.affectedUnit}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setConcernCategory('incident_assistance');
                            setLinkedIncidentId(inc.id);
                            setSubject(`Incident Assistance: ${inc.title}`);
                          }}
                          className="text-[#8E2424] font-semibold hover:underline cursor-pointer"
                        >
                          Assist Incident
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* AI Insights */}
                  {farmReview.scopes.aiInsights && farmReview.aiInsights.length > 0 && (
                    <div className="pt-3 border-t border-[#E2E6DF] space-y-2">
                      <h3 className="text-sm font-bold text-[#143326]">
                        AI Recommendations for Expert Verification ({farmReview.aiInsights.length})
                      </h3>
                      {farmReview.aiInsights.map((ai) => (
                        <div
                          key={ai.id}
                          className="py-2 border-t border-[#F1F3EF] flex items-start justify-between gap-2 text-xs"
                        >
                          <div>
                            <p className="font-semibold text-[#143326]">{ai.title}</p>
                            <p className="text-[#4A5A50]">{ai.summary}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setConcernCategory('ai_review');
                              setLinkedAiId(ai.id);
                              setSubject(`AI Verification: ${ai.title}`);
                            }}
                            className="text-[#1B4332] font-semibold hover:underline shrink-0 cursor-pointer"
                          >
                            Verify AI
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Feedback & Guidance Form */}
              <div className="lg:col-span-5 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#143326] flex items-center gap-2">
                  <MessageSquarePlus className="w-5 h-5 text-[#1B4332]" />
                  <span>Provide Professional Feedback</span>
                </h2>
                <form onSubmit={handleSubmitFeedback} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#35443B]">
                      Review Category
                    </label>
                    <select
                      value={concernCategory}
                      onChange={(e) =>
                        setConcernCategory(e.target.value as ExpertConcernCategory)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs"
                    >
                      {CONCERN_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#35443B]">
                      Consultation Subject
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Maize Stalk Borer & Top-Dressing Plan"
                      className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#35443B]">
                      Professional Assessment & Findings
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={assessment}
                      onChange={(e) => setAssessment(e.target.value)}
                      placeholder="Enter practical agronomic, soil, or veterinary guidance grounded in the farm records..."
                      className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#35443B]">
                      Actionable Recommendations (one per line)
                    </label>
                    <textarea
                      rows={3}
                      value={recommendationsText}
                      onChange={(e) => setRecommendationsText(e.target.value)}
                      placeholder="1. Inspect drainage outlets before fertilising&#10;2. Schedule follow-up count in 7 days"
                      className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#35443B]">
                      Consultation Status
                    </label>
                    <select
                      value={fbStatus}
                      onChange={(e) =>
                        setFbStatus(
                          e.target.value as 'pending_review' | 'in_progress' | 'completed'
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs"
                    >
                      <option value="completed">Completed Consultation</option>
                      <option value="in_progress">In Progress / Monitoring</option>
                      <option value="pending_review">Pending Further Sample</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingFeedback}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white text-sm font-semibold cursor-pointer"
                  >
                    {submittingFeedback ? 'Submitting Guidance...' : 'Submit Feedback & Notify Farmer'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : subTab === 'profile' ? (
        <form
          onSubmit={handleSaveProfile}
          className="bg-white border border-[#E2E6DF] rounded-2xl p-6 max-w-3xl space-y-5"
        >
          <h2 className="font-display text-lg font-bold text-[#143326]">
            Professional Specialisation, Qualifications & Experience
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#35443B]">
                Primary Specialisation
              </label>
              <select
                value={specialisation}
                onChange={(e) => setSpecialisation(e.target.value as ExpertSpecialisation)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
              >
                {SPECIALISATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#35443B]">
                Years of Professional Experience
              </label>
              <input
                type="number"
                min={0}
                max={70}
                value={yearsExp}
                onChange={(e) => setYearsExp(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#35443B]">
                Academic / Professional Qualifications
              </label>
              <input
                type="text"
                value={qualifications}
                onChange={(e) => setQualifications(e.target.value)}
                placeholder="e.g. M.Sc. Agronomy / BVSc"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#35443B]">
                Registration Number (SACNASP / SAVC)
              </label>
              <input
                type="text"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                placeholder="e.g. SACNASP Pr.Sci.Nat. 400218/08"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#35443B]">Provinces Served</label>
            <div className="flex flex-wrap gap-3 text-xs">
              {provinces.map((p) => {
                const active = provincesServed.includes(p.name);
                return (
                  <label key={p.code} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) =>
                        setProvincesServed(
                          e.target.checked
                            ? [...provincesServed, p.name]
                            : provincesServed.filter((x) => x !== p.name)
                        )
                      }
                      className="w-4 h-4 accent-[#1B4332]"
                    />
                    <span>{p.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#35443B]">Availability</label>
            <select
              value={availability}
              onChange={(e) =>
                setAvailability(e.target.value as 'available' | 'limited' | 'unavailable')
              }
              className="w-full sm:w-64 px-3.5 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
            >
              <option value="available">Available for Farm Consultations</option>
              <option value="limited">Limited Capacity</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#35443B]">Advisory Biography</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#D4DDD2] text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white text-sm font-semibold cursor-pointer"
          >
            {savingProfile ? 'Saving Profile...' : 'Save Expert Profile'}
          </button>
        </form>
      ) : (
        <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#143326] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#1B4332]" />
            <span>Professional Activity Records ({overview?.activityRecords.length || 0})</span>
          </h2>
          {(overview?.activityRecords || []).length === 0 ? (
            <p className="text-sm text-[#4A5A50]">No professional audit entries recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E6DF] text-[#4A5A50]">
                    <th className="py-2 pr-4">Date & Time</th>
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2 pr-4">Entity</th>
                    <th className="py-2">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E6DF]">
                  {(overview?.activityRecords || []).map((a) => (
                    <tr key={a.id}>
                      <td className="py-2.5 pr-4 font-mono tabular-nums whitespace-nowrap">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 font-semibold text-[#143326]">{a.action}</td>
                      <td className="py-2.5 pr-4">{a.entityType}</td>
                      <td className="py-2.5 font-mono text-[#4A5A50]">
                        {JSON.stringify(a.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
