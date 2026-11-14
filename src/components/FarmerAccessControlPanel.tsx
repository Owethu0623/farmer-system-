import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Lock,
  MessageSquarePlus,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  apiRequest,
  createConsultation,
  fetchConsultations,
} from '../lib/api';
import {
  CollaborationDirectoryPayload,
  ConsultationRequestItem,
  ExpertFeedbackItem,
  FarmAccessGrantItem,
  FarmAccessScopes,
  FarmItem,
} from '../types';

interface FarmerAccessControlPanelProps {
  farms: FarmItem[];
  selectedFarmId: string | null;
}

const DEFAULT_SCOPES: FarmAccessScopes = {
  overview: true,
  crops: true,
  soil: true,
  livestock: true,
  incidents: true,
  aiInsights: true,
  weather: true,
  financialSummary: false,
};

export const FarmerAccessControlPanel: React.FC<FarmerAccessControlPanelProps> = ({
  farms,
  selectedFarmId,
}) => {
  const [directory, setDirectory] = useState<CollaborationDirectoryPayload | null>(null);
  const [grants, setGrants] = useState<FarmAccessGrantItem[]>([]);
  const [feedback, setFeedback] = useState<ExpertFeedbackItem[]>([]);
  const [consultations, setConsultations] = useState<ConsultationRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [farmId, setFarmId] = useState(selectedFarmId || farms[0]?.id || '');
  const [granteeType, setGranteeType] = useState<'expert' | 'organisation'>('expert');
  const [granteeUserId, setGranteeUserId] = useState('');
  const [organisationId, setOrganisationId] = useState('');
  const [authorisedBasis, setAuthorisedBasis] = useState('Farmer explicit consent');
  const [scopes, setScopes] = useState<FarmAccessScopes>(DEFAULT_SCOPES);
  const [submitting, setSubmitting] = useState(false);

  // Consultation request form state
  const [consultFarmId, setConsultFarmId] = useState(selectedFarmId || farms[0]?.id || '');
  const [consultExpertId, setConsultExpertId] = useState('');
  const [consultSubject, setConsultSubject] = useState('');
  const [consultDescription, setConsultDescription] = useState('');
  const [consultUrgency, setConsultUrgency] = useState<'routine' | 'priority' | 'urgent'>('routine');
  const [submittingConsult, setSubmittingConsult] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFarmId) {
      setFarmId(selectedFarmId);
      setConsultFarmId(selectedFarmId);
    } else if (farms[0]) {
      if (!farmId) setFarmId(farms[0].id);
      if (!consultFarmId) setConsultFarmId(farms[0].id);
    }
  }, [selectedFarmId, farms, farmId, consultFarmId]);

  const loadCollaboration = useCallback(async () => {
    setLoading(true);
    try {
      const [dirData, grantData, consultData] = await Promise.all([
        apiRequest<CollaborationDirectoryPayload>('/api/collaboration/directory'),
        apiRequest<{ grants: FarmAccessGrantItem[]; expertFeedback: ExpertFeedbackItem[] }>(
          '/api/collaboration/grants'
        ),
        fetchConsultations().catch(() => [] as ConsultationRequestItem[]),
      ]);
      setDirectory(dirData);
      setGrants(grantData.grants);
      setFeedback(grantData.expertFeedback);
      setConsultations(consultData);
      if (dirData.experts[0]) {
        if (!granteeUserId) setGranteeUserId(dirData.experts[0].userId);
        if (!consultExpertId) setConsultExpertId(dirData.experts[0].userId);
      }
      if (dirData.organisations[0] && !organisationId) {
        setOrganisationId(dirData.organisations[0].id);
      }
    } catch {
      // ignore gracefully
    } finally {
      setLoading(false);
    }
  }, [granteeUserId, consultExpertId, organisationId]);

  useEffect(() => {
    loadCollaboration();
  }, [loadCollaboration]);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;
    const recipientId = granteeType === 'expert' ? granteeUserId : organisationId;
    if (!recipientId) {
      setError(
        granteeType === 'expert'
          ? 'Please select an agricultural expert before granting access.'
          : 'Please select an agricultural organisation before granting access.'
      );
      return;
    }
    setSubmitting(true);
    setNotice(null);
    setError(null);
    try {
      await apiRequest('/api/collaboration/grants', {
        method: 'POST',
        body: JSON.stringify({
          farmId,
          granteeType,
          granteeUserId: granteeType === 'expert' ? granteeUserId : null,
          organisationId: granteeType === 'organisation' ? organisationId : null,
          scopes:
            granteeType === 'organisation'
              ? { ...scopes, financialSummary: false }
              : scopes,
          authorisedBasis,
        }),
      });
      setNotice('Scoped farm access granted.');
      await loadCollaboration();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to grant access.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (grantId: string) => {
    setNotice(null);
    setError(null);
    try {
      await apiRequest(`/api/collaboration/grants/${grantId}/revoke`, { method: 'PATCH' });
      setNotice('Access revoked immediately. The expert or organisation can no longer view that farm.');
      await loadCollaboration();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to revoke grant.');
    }
  };

  const handleAcknowledgeFeedback = async (feedbackId: string) => {
    await apiRequest(`/api/collaboration/feedback/${feedbackId}/acknowledge`, {
      method: 'PATCH',
    });
    await loadCollaboration();
  };

  const handleRequestConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultFarmId || !consultExpertId || !consultSubject.trim() || !consultDescription.trim()) {
      setError('Select a farm, specialist, subject, and case description to request a consultation.');
      return;
    }
    setSubmittingConsult(true);
    setNotice(null);
    setError(null);
    try {
      await createConsultation({
        farmId: consultFarmId,
        expertUserId: consultExpertId,
        subject: consultSubject.trim(),
        description: consultDescription.trim(),
        urgency: consultUrgency,
      });
      setConsultSubject('');
      setConsultDescription('');
      setConsultUrgency('routine');
      setNotice('Specialist consultation request submitted.');
      await loadCollaboration();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to submit consultation request.');
    } finally {
      setSubmittingConsult(false);
    }
  };

  const formatVerificationBadge = (ex: CollaborationDirectoryPayload['experts'][number]) => {
    if (ex.isDemonstration || ex.verificationStatus === 'demo_unverified') {
      return 'Demo · Unverified';
    }
    if (ex.verificationStatus === 'verified') {
      return ex.regulatoryBodyName ? `Verified · ${ex.regulatoryBodyName}` : 'Verified';
    }
    return 'Pending Verification';
  };

  if (farms.length === 0) return null;

  return (
    <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-[#0B1F3A] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0B3D91]" />
            <span>Expert & Organisation Access Permissions & Consultations</span>
          </h3>
          <p className="text-xs text-[#475569] mt-0.5">
            Control exactly which agricultural specialists and cooperatives may view your farm records, request targeted consultations, and revoke access anytime.
          </p>
        </div>
      </div>

      {notice && (
        <div className="bg-[#ECF5F2] border border-[#A7D7C5] text-[#0B1F3A] rounded-xl px-4 py-2.5 text-xs font-medium">
          {notice}
        </div>
      )}
      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-4 py-2.5 text-xs">
          {error}
        </div>
      )}

      {/* Grant Form */}
      <form onSubmit={handleGrant} className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-[#0B1F3A]">Grant Scoped Farm Access</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#334155]">Farm</label>
            <select
              value={farmId}
              onChange={(e) => setFarmId(e.target.value)}
              className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#334155]">Recipient Type</label>
            <select
              value={granteeType}
              onChange={(e) => setGranteeType(e.target.value as 'expert' | 'organisation')}
              className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
            >
              <option value="expert">Agricultural Specialist / Expert</option>
              <option value="organisation">Agricultural Organisation / Co-op</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#334155]">
              {granteeType === 'expert' ? 'Select Specialist' : 'Select Organisation'}
            </label>
            {granteeType === 'expert' ? (
              <select
                value={granteeUserId}
                onChange={(e) => setGranteeUserId(e.target.value)}
                className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
              >
                {(directory?.experts || []).map((ex) => (
                  <option key={ex.userId} value={ex.userId}>
                    {ex.fullName} — {ex.specialisation.replace(/_/g, ' ')} ({formatVerificationBadge(ex)})
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={organisationId}
                onChange={(e) => setOrganisationId(e.target.value)}
                className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
              >
                {(directory?.organisations || []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.province}){org.isDemonstration ? ' · Demo' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#334155]">
          {[
            { key: 'crops' as const, label: 'Crops' },
            { key: 'soil' as const, label: 'Soil Reports' },
            { key: 'livestock' as const, label: 'Livestock' },
            { key: 'incidents' as const, label: 'Incidents' },
            { key: 'weather' as const, label: 'Weather' },
            { key: 'aiInsights' as const, label: 'AI Insights' },
          ].map((sc) => (
            <label key={sc.key} className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={scopes[sc.key]}
                onChange={(e) => setScopes({ ...scopes, [sc.key]: e.target.checked })}
                className="w-4 h-4 accent-[#0B3D91]"
              />
              <span>{sc.label}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            type="text"
            value={authorisedBasis}
            onChange={(e) => setAuthorisedBasis(e.target.value)}
            placeholder="Authorised basis (e.g. Farmer explicit consent)"
            className="flex-1 min-w-[220px] px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
          />
          <button
            type="submit"
            disabled={
              submitting ||
              !(granteeType === 'expert' ? granteeUserId : organisationId)
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-[#0B3D91] hover:bg-[#082E70] disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{submitting ? 'Granting...' : 'Grant Access'}</span>
          </button>
        </div>
      </form>

      {/* Active & Revoked Grants */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
          Current Access Grants (<span className="font-mono tabular-nums">{grants.length}</span>)
        </p>
        {loading ? (
          <p className="text-xs text-[#475569]">Loading access grants...</p>
        ) : grants.length === 0 ? (
          <p className="text-xs text-[#475569]">No external access granted yet.</p>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {grants.map((g) => (
              <div key={g.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-[#0B1F3A]">{g.granteeLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#475569]">{g.farmName}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        g.status === 'active' ? 'text-[#174C3C]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {g.status === 'active' ? 'Active' : 'Revoked'}
                    </span>
                  </div>
                  <p className="text-xs text-[#475569]">
                    {g.authorisedBasis} · Scopes:{' '}
                    {Object.entries(g.scopes)
                      .filter(([, val]) => val)
                      .map(([k]) => k)
                      .join(', ')}
                  </p>
                </div>

                {g.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => handleRevoke(g.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-xs font-semibold text-[#B91C1C] whitespace-nowrap cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Revoke Access</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-[#475569]">
                    <Lock className="w-3 h-3" /> Revoked
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Specialist Consultation */}
      <form
        onSubmit={handleRequestConsultation}
        className="pt-4 border-t border-[#E2E8F0] space-y-4"
      >
        <div>
          <h4 className="font-display text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4 text-[#0B3D91]" />
            <span>Request Specialist Consultation</span>
          </h4>
          <p className="text-xs text-[#475569] mt-0.5">
            Submit a targeted agronomic, soil, veterinary, irrigation, or farm economics consultation request. Note: Demonstration specialists are sample accounts and do not hold verified statutory accreditation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#334155]">Farm</label>
            <select
              value={consultFarmId}
              onChange={(e) => setConsultFarmId(e.target.value)}
              className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#334155]">Specialist</label>
            <select
              value={consultExpertId}
              onChange={(e) => setConsultExpertId(e.target.value)}
              className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
            >
              {(directory?.experts || []).map((ex) => (
                <option key={ex.userId} value={ex.userId}>
                  {ex.fullName} — {ex.specialisation.replace(/_/g, ' ')} ({formatVerificationBadge(ex)})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#334155]">Urgency</label>
            <select
              value={consultUrgency}
              onChange={(e) =>
                setConsultUrgency(e.target.value as 'routine' | 'priority' | 'urgent')
              }
              className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
            >
              <option value="routine">Routine Advisory</option>
              <option value="priority">Priority Follow-Up</option>
              <option value="urgent">Urgent Field Issue</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <input
            type="text"
            value={consultSubject}
            onChange={(e) => setConsultSubject(e.target.value)}
            placeholder="Consultation subject (e.g. Irrigation scheduling & nitrate leaching check)"
            className="w-full px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
          />
          <textarea
            rows={2}
            value={consultDescription}
            onChange={(e) => setConsultDescription(e.target.value)}
            placeholder="Describe field block observations, crop/livestock symptoms, or soil lab findings..."
            className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submittingConsult || !consultExpertId || !consultFarmId}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-[#174C3C] hover:bg-[#113B2E] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>{submittingConsult ? 'Submitting...' : 'Submit Consultation Request'}</span>
          </button>
        </div>

        {consultations.length > 0 && (
          <div className="divide-y divide-[#E2E8F0] pt-2">
            {consultations.map((c) => (
              <div key={c.id} className="py-3 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#0B1F3A]">{c.subject}</span>
                  <span
                    className={`font-mono uppercase font-semibold ${
                      c.urgency === 'urgent'
                        ? 'text-[#FC3D21]'
                        : c.status === 'responded' || c.status === 'closed'
                        ? 'text-[#174C3C]'
                        : 'text-[#0B3D91]'
                    }`}
                  >
                    {c.urgency} · {c.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-[#475569]">
                  {c.expertName || 'Specialist'} ({c.specialistCategory.replace(/_/g, ' ')}) ·{' '}
                  {c.farmName || 'Farm'} ·{' '}
                  <span className="font-mono tabular-nums">{c.requestedAt.slice(0, 10)}</span>
                </p>
                <p className="text-xs text-[#334155]">{c.description}</p>
                {c.recommendationSummary && (
                  <div className="mt-1 bg-[#ECF5F2] border border-[#A7D7C5] rounded-lg px-3 py-2 text-xs text-[#0B1F3A]">
                    <span className="font-semibold text-[#174C3C]">Specialist Response: </span>
                    {c.recommendationSummary}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </form>

      {/* Expert Feedback Received */}
      {feedback.length > 0 && (
        <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
            Professional Expert Feedback Received (<span className="font-mono tabular-nums">{feedback.length}</span>)
          </p>
          <div className="divide-y divide-[#E2E8F0]">
            {feedback.map((fb) => (
              <div key={fb.id} className="py-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#0B1F3A]">{fb.subject}</p>
                  {fb.farmerAcknowledged ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#174C3C]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAcknowledgeFeedback(fb.id)}
                      className="px-3 py-1.5 min-h-[36px] rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-xs font-semibold text-[#0B3D91] cursor-pointer"
                    >
                      Acknowledge Guidance
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#475569]">
                  {fb.expertName} ({fb.expertSpecialisation.replace(/_/g, ' ')}) · {fb.farmName} ·{' '}
                  {fb.status.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-[#334155]">{fb.assessment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
