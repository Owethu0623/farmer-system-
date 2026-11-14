import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Lock, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  CollaborationDirectoryPayload,
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
  const [loading, setLoading] = useState(true);

  const [farmId, setFarmId] = useState(selectedFarmId || farms[0]?.id || '');
  const [granteeType, setGranteeType] = useState<'expert' | 'organisation'>('expert');
  const [granteeUserId, setGranteeUserId] = useState('');
  const [organisationId, setOrganisationId] = useState('');
  const [authorisedBasis, setAuthorisedBasis] = useState('Farmer explicit consent');
  const [scopes, setScopes] = useState<FarmAccessScopes>(DEFAULT_SCOPES);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFarmId) setFarmId(selectedFarmId);
    else if (farms[0] && !farmId) setFarmId(farms[0].id);
  }, [selectedFarmId, farms, farmId]);

  const loadCollaboration = useCallback(async () => {
    setLoading(true);
    try {
      const [dirData, grantData] = await Promise.all([
        apiRequest<CollaborationDirectoryPayload>('/api/collaboration/directory'),
        apiRequest<{ grants: FarmAccessGrantItem[]; expertFeedback: ExpertFeedbackItem[] }>(
          '/api/collaboration/grants'
        ),
      ]);
      setDirectory(dirData);
      setGrants(grantData.grants);
      setFeedback(grantData.expertFeedback);
      if (dirData.experts[0] && !granteeUserId) {
        setGranteeUserId(dirData.experts[0].userId);
      }
      if (dirData.organisations[0] && !organisationId) {
        setOrganisationId(dirData.organisations[0].id);
      }
    } catch {
      // ignore gracefully
    } finally {
      setLoading(false);
    }
  }, [granteeUserId, organisationId]);

  useEffect(() => {
    loadCollaboration();
  }, [loadCollaboration]);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;
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

  if (farms.length === 0) return null;

  return (
    <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-[#143326] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#1B4332]" />
            <span>Expert & Organisation Access Permissions</span>
          </h3>
          <p className="text-xs text-[#4A5A50] mt-0.5">
            Control exactly which agricultural experts and cooperatives may view your farm records, and revoke access anytime.
          </p>
        </div>
      </div>

      {notice && (
        <div className="bg-[#EDF5EF] border border-[#BFD6C5] text-[#143326] rounded-xl px-4 py-2.5 text-xs font-medium">
          {notice}
        </div>
      )}
      {error && (
        <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-2.5 text-xs">
          {error}
        </div>
      )}

      {/* Grant Form */}
      <form onSubmit={handleGrant} className="bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-[#143326]">Grant Scoped Farm Access</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#35443B]">Farm</label>
            <select
              value={farmId}
              onChange={(e) => setFarmId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#35443B]">Recipient Type</label>
            <select
              value={granteeType}
              onChange={(e) => setGranteeType(e.target.value as 'expert' | 'organisation')}
              className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs"
            >
              <option value="expert">Agricultural Expert</option>
              <option value="organisation">Agricultural Organisation / Co-op</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#35443B]">
              {granteeType === 'expert' ? 'Select Expert' : 'Select Organisation'}
            </label>
            {granteeType === 'expert' ? (
              <select
                value={granteeUserId}
                onChange={(e) => setGranteeUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs"
              >
                {(directory?.experts || []).map((ex) => (
                  <option key={ex.userId} value={ex.userId}>
                    {ex.fullName} ({ex.specialisation.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={organisationId}
                onChange={(e) => setOrganisationId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs"
              >
                {(directory?.organisations || []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.province})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#35443B]">
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
                className="w-4 h-4 accent-[#1B4332]"
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
            className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs"
          />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{submitting ? 'Granting...' : 'Grant Access'}</span>
          </button>
        </div>
      </form>

      {/* Active & Revoked Grants */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#4A5A50]">
          Current Access Grants ({grants.length})
        </p>
        {loading ? (
          <p className="text-xs text-[#4A5A50]">Loading access grants...</p>
        ) : grants.length === 0 ? (
          <p className="text-xs text-[#4A5A50]">No external access granted yet.</p>
        ) : (
          <div className="divide-y divide-[#E2E6DF]">
            {grants.map((g) => (
              <div key={g.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-[#143326]">{g.granteeLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#4A5A50]">{g.farmName}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        g.status === 'active' ? 'text-[#16A34A]' : 'text-[#8E2424]'
                      }`}
                    >
                      {g.status === 'active' ? 'Active' : 'Revoked'}
                    </span>
                  </div>
                  <p className="text-xs text-[#4A5A50]">
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
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E8B4B4] bg-[#FDF2F2] hover:bg-[#FADEDE] text-xs font-semibold text-[#8E2424] whitespace-nowrap cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Revoke Access</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-[#4A5A50]">
                    <Lock className="w-3 h-3" /> Revoked
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expert Feedback Received */}
      {feedback.length > 0 && (
        <div className="pt-4 border-t border-[#E2E6DF] space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#4A5A50]">
            Professional Expert Feedback Received ({feedback.length})
          </p>
          <div className="divide-y divide-[#E2E6DF]">
            {feedback.map((fb) => (
              <div key={fb.id} className="py-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#143326]">{fb.subject}</p>
                  {fb.farmerAcknowledged ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAcknowledgeFeedback(fb.id)}
                      className="px-3 py-1 rounded-lg bg-[#EDF5EF] hover:bg-[#DCEBDD] text-xs font-semibold text-[#1B4332] cursor-pointer"
                    >
                      Acknowledge Guidance
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#4A5A50]">
                  {fb.expertName} ({fb.expertSpecialisation.replace(/_/g, ' ')}) · {fb.farmName} ·{' '}
                  {fb.status.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-[#35443B]">{fb.assessment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
