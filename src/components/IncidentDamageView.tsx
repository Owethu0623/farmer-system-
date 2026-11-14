import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Film,
  History,
  Info,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  enqueueOfflineMutation,
  isLikelyOfflineError,
  loadOfflineBundle,
} from '../lib/offlineSync';
import { getSastDateString, getSastDatetimeLocalInput } from '../lib/saTime';
import {
  CropItem,
  FarmIncidentItem,
  FarmItem,
  IncidentDashboardPayload,
  IncidentStatus,
  IncidentType,
  LivestockGroupItem,
} from '../types';

interface IncidentDamageViewProps {
  userId?: string;
  farms: FarmItem[];
  selectedFarmId: string | null;
  onSelectFarm: (farmId: string | null) => void;
  onDataChanged: () => void;
}

const INCIDENT_TYPE_OPTIONS: { value: IncidentType; label: string }[] = [
  { value: 'heavy_rainfall', label: 'Heavy rainfall' },
  { value: 'flooding', label: 'Flooding' },
  { value: 'storm_damage', label: 'Storm damage' },
  { value: 'drought', label: 'Drought' },
  { value: 'pest_outbreak', label: 'Pest outbreak' },
  { value: 'crop_disease', label: 'Crop disease' },
  { value: 'livestock_illness', label: 'Livestock illness' },
  { value: 'livestock_death', label: 'Livestock deaths' },
  { value: 'equipment_damage', label: 'Equipment damage' },
  { value: 'infrastructure_damage', label: 'Infrastructure damage' },
];

async function readImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported image format.'));
      img.onload = () => {
        const scale = Math.min(1, 960 / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas error'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function readVideoThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const objUrl = URL.createObjectURL(file);
    const vid = document.createElement('video');
    vid.preload = 'metadata';
    vid.muted = true;
    vid.playsInline = true;
    const cleanup = () => URL.revokeObjectURL(objUrl);
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 3000);
    vid.onloadeddata = () => {
      try {
        const scale = Math.min(1, 960 / (vid.videoWidth || 640));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((vid.videoWidth || 640) * scale));
        canvas.height = Math.max(1, Math.round((vid.videoHeight || 360) * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          clearTimeout(timer);
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/jpeg', 0.8);
        clearTimeout(timer);
        cleanup();
        resolve(url);
      } catch {
        clearTimeout(timer);
        cleanup();
        resolve(null);
      }
    };
    vid.onerror = () => {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    };
    vid.src = objUrl;
  });
}

export const IncidentDamageView: React.FC<IncidentDamageViewProps> = ({
  userId,
  farms,
  selectedFarmId,
  onSelectFarm,
  onDataChanged,
}) => {
  const [dashboard, setDashboard] = useState<IncidentDashboardPayload | null>(null);
  const [crops, setCrops] = useState<CropItem[]>([]);
  const [livestock, setLivestock] = useState<LivestockGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | IncidentStatus | 'audit'>('all');

  // New Incident Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [formFarmId, setFormFarmId] = useState(selectedFarmId || farms[0]?.id || '');
  const [formFieldId, setFormFieldId] = useState('');
  const [formCropId, setFormCropId] = useState('');
  const [formLivestockId, setFormLivestockId] = useState('');
  const [formType, setFormType] = useState<IncidentType>('storm_damage');
  const [formTitle, setFormTitle] = useState('');
  const [formOccurredAt, setFormOccurredAt] = useState(getSastDatetimeLocalInput());
  const [formDescription, setFormDescription] = useState('');
  const [formAffectedQty, setFormAffectedQty] = useState('0');
  const [formAffectedUnit, setFormAffectedUnit] = useState('plants');
  const [formAffectedAreaHa, setFormAffectedAreaHa] = useState('0');
  const [formImpactZar, setFormImpactZar] = useState('0');
  const [formActions, setFormActions] = useState('');
  const [formStatus, setFormStatus] = useState<IncidentStatus>('active');
  const [formMediaName, setFormMediaName] = useState<string | null>(null);
  const [formMediaType, setFormMediaType] = useState<'image' | 'video' | null>(null);
  const [formMediaPreview, setFormMediaPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Follow-up Modal
  const [followUpIncident, setFollowUpIncident] = useState<FarmIncidentItem | null>(null);
  const [fuDate, setFuDate] = useState(getSastDateString());
  const [fuStatusAfter, setFuStatusAfter] = useState<IncidentStatus>('monitoring');
  const [fuActionTaken, setFuActionTaken] = useState('');
  const [fuNotes, setFuNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = selectedFarmId ? `?farmId=${encodeURIComponent(selectedFarmId)}` : '';
      const [incData, cropsData, lvkData] = await Promise.all([
        apiRequest<IncidentDashboardPayload>(`/api/incidents${qs}`),
        apiRequest<CropItem[]>('/api/crops'),
        apiRequest<LivestockGroupItem[]>('/api/livestock'),
      ]);
      setDashboard(incData);
      setCrops(cropsData);
      setLivestock(lvkData);
    } catch (err: unknown) {
      if (userId && isLikelyOfflineError(err)) {
        const bundle = await loadOfflineBundle(userId);
        if (bundle) {
          const cachedInc = selectedFarmId
            ? bundle.incidents.filter((i) => i.farmId === selectedFarmId)
            : bundle.incidents;
          setDashboard({
            summary: {
              totalIncidents: cachedInc.length,
              activeCount: cachedInc.filter((i) => i.status === 'active').length,
              monitoringCount: cachedInc.filter((i) => i.status === 'monitoring').length,
              resolvedCount: cachedInc.filter((i) => i.status === 'resolved').length,
              totalFinancialImpactZar: cachedInc.reduce(
                (sum, i) => sum + (i.estimatedFinancialImpactZar || 0),
                0
              ),
              totalAffectedCropPlants: cachedInc
                .filter((i) => i.cropId && (i.affectedUnit || '').toLowerCase().includes('plant'))
                .reduce((sum, i) => sum + (i.affectedQuantity || 0), 0),
              totalAffectedLivestockHead: cachedInc
                .filter(
                  (i) => i.livestockGroupId && (i.affectedUnit || '').toLowerCase().includes('head')
                )
                .reduce((sum, i) => sum + (i.affectedQuantity || 0), 0),
              totalAffectedHectares: Number(
                cachedInc.reduce((sum, i) => sum + (i.affectedAreaHectares || 0), 0).toFixed(2)
              ),
            },
            incidents: cachedInc,
            auditHistory: [],
          });
          setCrops(bundle.crops);
          setLivestock(bundle.livestockGroups);
          setSuccessMsg(
            `Offline mode: viewing cached incidents from ${new Date(bundle.downloadedAt).toLocaleString()}. New reports will be queued on this device.`
          );
          return;
        }
      }
      setError(err instanceof Error ? err.message : 'Unable to load farm incidents.');
    } finally {
      setLoading(false);
    }
  }, [selectedFarmId, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!formFarmId && farms.length > 0) setFormFarmId(farms[0].id);
  }, [farms, formFarmId]);

  const formFarm = useMemo(() => farms.find((f) => f.id === formFarmId) || null, [farms, formFarmId]);
  const formCrops = useMemo(() => crops.filter((c) => c.farmId === formFarmId), [crops, formFarmId]);
  const formLivestock = useMemo(
    () => livestock.filter((g) => g.farmId === formFarmId),
    [livestock, formFarmId]
  );

  const selectedCropPreview = useMemo(() => {
    const crop = formCrops.find((c) => c.id === formCropId);
    if (!crop) return null;
    const orig = crop.plantingQuantity;
    const beforeRem = Math.max(0, crop.plantingQuantity - crop.damagedPlants);
    const dmg = Math.min(beforeRem, Math.max(0, Number(formAffectedQty) || 0));
    return {
      cropName: `${crop.cropName} (${crop.cropVariety})`,
      originalPlanted: orig,
      existingDamaged: crop.damagedPlants,
      beforeRemaining: beforeRem,
      appliedDamage: dmg,
      afterRemaining: Math.max(0, beforeRem - dmg),
    };
  }, [formCrops, formCropId, formAffectedQty]);

  const selectedLivestockPreview = useMemo(() => {
    const grp = formLivestock.find((g) => g.id === formLivestockId);
    if (!grp) return null;
    const loss =
      formType === 'livestock_death'
        ? Math.min(grp.quantity, Math.max(0, Math.round(Number(formAffectedQty) || 0)))
        : 0;
    return {
      groupName: `${grp.groupName} (${grp.animalType})`,
      currentHead: grp.quantity,
      appliedLoss: loss,
      afterHead: Math.max(0, grp.quantity - loss),
    };
  }, [formLivestock, formLivestockId, formType, formAffectedQty]);

  const handleMediaAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormMediaName(file.name);
    if (file.type.startsWith('video/')) {
      setFormMediaType('video');
      const thumb = await readVideoThumbnail(file);
      setFormMediaPreview(thumb);
    } else {
      try {
        const preview = await readImagePreview(file);
        setFormMediaType('image');
        setFormMediaPreview(preview);
      } catch {
        setError('Could not process attached photograph.');
      }
    }
    e.target.value = '';
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const incidentPayload = {
      farmId: formFarmId,
      fieldId: formFieldId || null,
      cropId: formCropId || null,
      livestockGroupId: formLivestockId || null,
      incidentType: formType,
      title: formTitle,
      occurredAt: new Date(formOccurredAt).toISOString(),
      description: formDescription,
      mediaFileName: formMediaName,
      mediaType: formMediaType,
      mediaPreviewDataUrl: formMediaPreview,
      affectedQuantity: Number(formAffectedQty) || 0,
      affectedUnit: formAffectedUnit,
      affectedAreaHectares: Number(formAffectedAreaHa) || 0,
      estimatedFinancialImpactZar: Number(formImpactZar) || 0,
      recommendedActions: formActions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      status: formStatus,
    };

    const queueIncidentOffline = async () => {
      if (!userId) return false;
      await enqueueOfflineMutation({
        userId,
        mutationType: 'farm_incident',
        label: `Incident: ${formTitle}`,
        farmId: formFarmId,
        farmName: formFarm?.name || null,
        payload: incidentPayload,
      });
      setCreateOpen(false);
      setFormTitle('');
      setFormDescription('');
      setFormAffectedQty('0');
      setFormAffectedAreaHa('0');
      setFormImpactZar('0');
      setFormActions('');
      setFormMediaName(null);
      setFormMediaPreview(null);
      setSuccessMsg('Offline mode: incident captured locally and queued for automatic sync when signal returns.');
      return true;
    };

    try {
      const simulatedOffline =
        typeof window !== 'undefined' &&
        window.localStorage.getItem('fieldshift_simulated_offline') === 'true';
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || simulatedOffline) {
        if (await queueIncidentOffline()) return;
      }

      await apiRequest('/api/incidents', {
        method: 'POST',
        body: JSON.stringify({
          ...incidentPayload,
          recommendedActions: formActions,
        }),
      });
      setCreateOpen(false);
      setFormTitle('');
      setFormDescription('');
      setFormAffectedQty('0');
      setFormAffectedAreaHa('0');
      setFormImpactZar('0');
      setFormActions('');
      setFormMediaName(null);
      setFormMediaPreview(null);
      setSuccessMsg('Incident logged and linked stock/damage quantities updated with full audit trail.');
      await loadData();
      onDataChanged();
    } catch (err: unknown) {
      if (isLikelyOfflineError(err) && (await queueIncidentOffline())) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to record farm incident.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (incidentId: string, status: IncidentStatus) => {
    try {
      await apiRequest(`/api/incidents/${incidentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadData();
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update status.');
    }
  };

  const handleSubmitFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpIncident) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/incidents/${followUpIncident.id}/follow-ups`, {
        method: 'POST',
        body: JSON.stringify({
          followUpDate: fuDate,
          statusAfter: fuStatusAfter,
          actionTaken: fuActionTaken,
          notes: fuNotes,
        }),
      });
      setFollowUpIncident(null);
      setFuActionTaken('');
      setFuNotes('');
      setSuccessMsg('Follow-up activity recorded in incident history.');
      await loadData();
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to log follow-up.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredIncidents = useMemo(() => {
    if (!dashboard) return [];
    if (statusFilter === 'all') return dashboard.incidents;
    return dashboard.incidents.filter((i) => i.status === statusFilter);
  }, [dashboard, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
            Farm Incident & Damage Management
          </h1>
          <p className="text-sm text-[#475569]">
            Report weather, pest, disease, livestock, equipment, or infrastructure incidents and track validated remaining stock.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedFarmId || ''}
            onChange={(e) => onSelectFarm(e.target.value || null)}
            className="px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-semibold text-[#0B1F3A]"
          >
            <option value="">All Accessible Farms</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setFormFarmId(selectedFarmId || farms[0]?.id || '');
              setCreateOpen(true);
            }}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B3D91] text-white text-sm font-semibold hover:bg-[#082E70] flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Report Incident</span>
          </button>
        </div>
      </div>

      {/* Monitoring / Non-Insurance Notice */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl p-4 flex items-start gap-2.5 text-xs text-[#0B1F3A]">
        <Info className="w-4 h-4 text-[#0B3D91] shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Agricultural Monitoring & Decision Support Only</p>
          <p className="text-[#334155] mt-0.5 leading-relaxed">
            This module tracks operational damage, preserves original planted/herd baselines, updates remaining stock transparently, and logs audit history for farm management. It does not perform formal insurance underwriting or claim adjudication.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3 text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-[#ECF5F2] border border-[#A7D7C5] rounded-xl px-4 py-3 text-sm text-[#174C3C] flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#174C3C] shrink-0" />
            {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading || !dashboard ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 text-center text-sm text-[#475569]">
          Loading incident and damage history...
        </div>
      ) : (
        <>
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
              <p className="text-xs text-[#475569]">Active Incidents</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#B91C1C] mt-1">
                {dashboard.summary.activeCount}
              </p>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
              <p className="text-xs text-[#475569]">Monitoring</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#92400E] mt-1">
                {dashboard.summary.monitoringCount}
              </p>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
              <p className="text-xs text-[#475569]">Resolved</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#174C3C] mt-1">
                {dashboard.summary.resolvedCount}
              </p>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
              <p className="text-xs text-[#475569]">Est. Financial Impact</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                R{dashboard.summary.totalFinancialImpactZar.toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
              <p className="text-xs text-[#475569]">Affected Plants</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                {dashboard.summary.totalAffectedCropPlants.toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
              <p className="text-xs text-[#475569]">Affected Area / Livestock</p>
              <p className="font-mono text-lg font-bold tabular-nums text-[#0B1F3A] mt-1">
                {dashboard.summary.totalAffectedHectares} ha · {dashboard.summary.totalAffectedLivestockHead} head
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'active', 'monitoring', 'resolved', 'audit'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`min-h-[40px] px-4 py-2 rounded-xl border text-xs font-semibold capitalize cursor-pointer inline-flex items-center gap-1.5 ${
                  statusFilter === st
                    ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                    : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F1F5F9]'
                }`}
              >
                {st === 'audit' && <History className="w-3.5 h-3.5" />}
                <span>
                  {st === 'all'
                    ? `All Incidents (${dashboard.incidents.length})`
                    : st === 'audit'
                    ? `Damage & Audit History (${dashboard.auditHistory?.length || 0})`
                    : st}
                </span>
              </button>
            ))}
          </div>

          {/* Audit History View */}
          {statusFilter === 'audit' ? (
            <section className="bg-white border border-[#E2E8F0] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#0B3D91]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Immutable Damage & Incident Audit History
                </h2>
              </div>
              <p className="text-xs text-[#475569]">
                Original planted and herd records are preserved permanently. Every reported incident, validated stock deduction, status change, and follow-up is logged chronologically below.
              </p>
              {!dashboard.auditHistory || dashboard.auditHistory.length === 0 ? (
                <p className="text-sm text-[#475569]">No incident audit entries recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-[#475569]">
                        <th className="py-2 pr-3 font-semibold">Timestamp</th>
                        <th className="py-2 pr-3 font-semibold">Actor</th>
                        <th className="py-2 pr-3 font-semibold">Event</th>
                        <th className="py-2 font-semibold">Validated Record Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {dashboard.auditHistory.map((log) => (
                        <tr key={log.id}>
                          <td className="py-2.5 pr-3 font-mono tabular-nums text-[#475569] whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-3 text-[#0B1F3A] font-medium">
                            {log.actorEmail || log.actorUserId || 'System'}
                          </td>
                          <td className="py-2.5 pr-3 font-mono font-semibold text-[#0B3D91]">
                            {log.action.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2.5 text-[#334155] font-mono text-[11px]">
                            {Object.entries(log.details || {})
                              .filter(([k]) => k !== 'farmId')
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(' · ') || log.entityId}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : filteredIncidents.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 text-center space-y-2">
              <AlertOctagon className="w-8 h-8 text-[#0B3D91] mx-auto" />
              <p className="font-display font-bold text-[#0B1F3A]">
                No incidents recorded under this filter
              </p>
              <p className="text-sm text-[#475569]">
                Use “Report Incident” above or convert a visual inspection into a tracked incident.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredIncidents.map((inc) => (
                <article
                  key={inc.id}
                  className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#475569]">
                        <span className="font-bold uppercase text-[#0B1F3A]">
                          {INCIDENT_TYPE_OPTIONS.find((o) => o.value === inc.incidentType)?.label ||
                            inc.incidentType}
                        </span>
                        <span>·</span>
                        <span>{new Date(inc.occurredAt).toLocaleString()}</span>
                        <span>·</span>
                        <span>{inc.farmName}</span>
                        {inc.fieldName && <span>· {inc.fieldName}</span>}
                        {inc.cropName && <span>· {inc.cropName}</span>}
                        {inc.livestockGroupName && <span>· {inc.livestockGroupName}</span>}
                      </div>
                      <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                        {inc.title}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={inc.status}
                        onChange={(e) => handleUpdateStatus(inc.id, e.target.value as IncidentStatus)}
                        aria-label="Incident status"
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold capitalize cursor-pointer ${
                          inc.status === 'active'
                            ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                            : inc.status === 'monitoring'
                            ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                            : 'bg-[#ECF5F2] border-[#A7D7C5] text-[#174C3C]'
                        }`}
                      >
                        <option value="active">Active</option>
                        <option value="monitoring">Monitoring</option>
                        <option value="resolved">Resolved</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          setFollowUpIncident(inc);
                          setFuStatusAfter(inc.status);
                          setFuDate(getSastDateString());
                        }}
                        className="min-h-[38px] px-3.5 py-2 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0B1F3A] flex items-center gap-1.5 cursor-pointer"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span>Add Follow-Up</span>
                      </button>
                    </div>
                  </div>

                  {/* Description & Media */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    {(inc.mediaPreviewDataUrl || inc.mediaFileName) && (
                      <div className="md:col-span-3 space-y-1.5">
                        {inc.mediaPreviewDataUrl ? (
                          <img
                            src={inc.mediaPreviewDataUrl}
                            alt={inc.mediaFileName || inc.title}
                            className="w-full h-36 object-cover rounded-xl border border-[#E2E8F0]"
                          />
                        ) : (
                          <div className="w-full h-24 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center gap-2 text-xs text-[#334155] px-3">
                            <Film className="w-4 h-4 text-[#0B3D91] shrink-0" />
                            <span className="truncate">{inc.mediaFileName}</span>
                          </div>
                        )}
                        {inc.mediaFileName && (
                          <p
                            title={inc.mediaFileName}
                            className="text-xs font-mono text-[#475569] break-all"
                          >
                            {inc.mediaType === 'video' ? 'Video: ' : 'Photo: '}
                            {inc.mediaFileName}
                          </p>
                        )}
                      </div>
                    )}
                    <div className={inc.mediaPreviewDataUrl || inc.mediaFileName ? 'md:col-span-9 space-y-3' : 'md:col-span-12 space-y-3'}>
                      <p className="text-sm text-[#0F172A] leading-relaxed whitespace-pre-line">
                        {inc.description}
                      </p>

                      {/* Validated Quantities & Financial Impact */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-xs">
                        <div>
                          <p className="text-[#475569]">Affected Qty</p>
                          <p className="font-mono font-bold tabular-nums text-[#B91C1C] mt-0.5">
                            {inc.affectedQuantity.toLocaleString()} {inc.affectedUnit}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#475569]">Affected Area</p>
                          <p className="font-mono font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                            {inc.affectedAreaHectares} ha
                          </p>
                        </div>
                        <div>
                          <p className="text-[#475569]">Est. Impact</p>
                          <p className="font-mono font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                            R{inc.estimatedFinancialImpactZar.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#475569]">Original Recorded</p>
                          <p className="font-mono font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                            {inc.originalRecordedQuantity !== null
                              ? inc.originalRecordedQuantity.toLocaleString()
                              : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#475569]">Remaining After</p>
                          <p className="font-mono font-bold tabular-nums text-[#174C3C] mt-0.5">
                            {inc.remainingRecordedQuantity !== null
                              ? inc.remainingRecordedQuantity.toLocaleString()
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recommended Actions */}
                  {inc.recommendedActions.length > 0 && (
                    <div className="text-xs text-[#174C3C] bg-[#ECF5F2] border border-[#A7D7C5] rounded-xl p-3 space-y-1">
                      <p className="font-bold uppercase tracking-wider text-[11px]">
                        Recommended Actions
                      </p>
                      <ul className="space-y-1 text-[#0F172A]">
                        {inc.recommendedActions.map((act, idx) => (
                          <li key={idx}>• {act}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Follow-Up Audit History */}
                  {inc.followUps.length > 0 && (
                    <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
                      <p className="text-xs font-bold text-[#475569] flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5" />
                        <span>Follow-Up History ({inc.followUps.length})</span>
                      </p>
                      <div className="space-y-2">
                        {inc.followUps.map((fu) => (
                          <div
                            key={fu.id}
                            className="text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div>
                              <span className="font-semibold text-[#0B1F3A]">{fu.actionTaken}</span>
                              {fu.notes && <span className="text-[#475569]"> — {fu.notes}</span>}
                            </div>
                            <span className="font-mono tabular-nums text-[#475569]">
                              {fu.followUpDate} · {fu.statusAfter} · {fu.actorName}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* Report New Incident Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateIncident}
            className="bg-white border border-[#E2E8F0] rounded-2xl max-w-2xl w-full p-6 space-y-4 my-8"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="font-display text-xl font-bold text-[#0B1F3A]">
                Report Farm Incident or Damage
              </h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-[#475569]" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Incident Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => {
                    const t = e.target.value as IncidentType;
                    setFormType(t);
                    if (t === 'livestock_death' || t === 'livestock_illness') {
                      setFormAffectedUnit('head');
                    } else if (t === 'equipment_damage' || t === 'infrastructure_damage') {
                      setFormAffectedUnit('units');
                    } else {
                      setFormAffectedUnit('plants');
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-semibold"
                >
                  {INCIDENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Date & Time Occurred
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formOccurredAt}
                  onChange={(e) => setFormOccurredAt(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">Farm</label>
                <select
                  value={formFarmId}
                  onChange={(e) => {
                    setFormFarmId(e.target.value);
                    setFormFieldId('');
                    setFormCropId('');
                    setFormLivestockId('');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Affected Field (Optional)
                </label>
                <select
                  value={formFieldId}
                  onChange={(e) => setFormFieldId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm"
                >
                  <option value="">Whole Farm / Unspecified</option>
                  {(formFarm?.fields || []).map((fl) => (
                    <option key={fl.id} value={fl.id}>
                      {fl.name} ({fl.areaHectares} ha)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Affected Crop (Auto-updates damaged & remaining stock)
                </label>
                <select
                  value={formCropId}
                  onChange={(e) => {
                    setFormCropId(e.target.value);
                    if (e.target.value) {
                      setFormLivestockId('');
                      setFormAffectedUnit('plants');
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm"
                >
                  <option value="">None / Not crop-specific</option>
                  {formCrops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.cropName} ({c.cropVariety}) — {c.remainingPlants ?? c.plantingQuantity} remaining
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Affected Livestock Group
                </label>
                <select
                  value={formLivestockId}
                  onChange={(e) => {
                    setFormLivestockId(e.target.value);
                    if (e.target.value) {
                      setFormCropId('');
                      setFormAffectedUnit('head');
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm"
                >
                  <option value="">None / Not livestock-specific</option>
                  {formLivestock.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.groupName} ({g.animalType} · {g.quantity} head)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Validated Damage Preview */}
            {selectedCropPreview && (
              <div className="bg-[#ECF5F2] border border-[#A7D7C5] rounded-xl p-3 text-xs text-[#174C3C] space-y-1">
                <p className="font-bold">Validated Crop Stock Accounting Preview — {selectedCropPreview.cropName}</p>
                <p className="font-mono tabular-nums">
                  Original Planted: {selectedCropPreview.originalPlanted.toLocaleString()} · Previously Damaged:{' '}
                  {selectedCropPreview.existingDamaged.toLocaleString()} · New Damage:{' '}
                  {selectedCropPreview.appliedDamage.toLocaleString()} · Updated Remaining:{' '}
                  {selectedCropPreview.afterRemaining.toLocaleString()}
                </p>
              </div>
            )}

            {selectedLivestockPreview && (
              <div className="bg-[#ECF5F2] border border-[#A7D7C5] rounded-xl p-3 text-xs text-[#174C3C] space-y-1">
                <p className="font-bold">Livestock Head Accounting Preview — {selectedLivestockPreview.groupName}</p>
                <p className="font-mono tabular-nums">
                  Current Head: {selectedLivestockPreview.currentHead} · Loss Recorded:{' '}
                  {selectedLivestockPreview.appliedLoss} · Remaining Head:{' '}
                  {selectedLivestockPreview.afterHead}
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                Incident Title
              </label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="E.g. Hailstorm damage on Lower Valley Maize"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                Detailed Description
              </label>
              <textarea
                rows={2}
                required
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe what happened, severity, and visible damage..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Affected Qty
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formAffectedQty}
                  onChange={(e) => setFormAffectedQty(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">Unit</label>
                <input
                  type="text"
                  value={formAffectedUnit}
                  onChange={(e) => setFormAffectedUnit(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Area (ha)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formAffectedAreaHa}
                  onChange={(e) => setFormAffectedAreaHa(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Est. Loss (ZAR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formImpactZar}
                  onChange={(e) => setFormImpactZar(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Recommended Actions (one per line)
                </label>
                <textarea
                  rows={2}
                  value={formActions}
                  onChange={(e) => setFormActions(e.target.value)}
                  placeholder="E.g. Clear drainage channels&#10;Schedule agronomist visit"
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-sm"
                />
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as IncidentStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <label className="min-h-[40px] px-3 py-2 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-xs font-semibold text-[#0B1F3A] flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4 text-[#0B3D91]" />
                  <span className="truncate">{formMediaName || 'Attach Photo or Video'}</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaAttach}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#CBD5E1] text-sm font-semibold text-[#334155]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold cursor-pointer"
              >
                {submitting ? 'Saving...' : 'Save Incident'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Follow-Up Modal */}
      {followUpIncident && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitFollowUp}
            className="bg-white border border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                Record Incident Follow-Up
              </h3>
              <button
                type="button"
                onClick={() => setFollowUpIncident(null)}
                className="cursor-pointer"
              >
                <X className="w-5 h-5 text-[#475569]" />
              </button>
            </div>
            <p className="text-xs text-[#475569]">{followUpIncident.title}</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={fuDate}
                    onChange={(e) => setFuDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">
                    Updated Status
                  </label>
                  <select
                    value={fuStatusAfter}
                    onChange={(e) => setFuStatusAfter(e.target.value as IncidentStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Action Taken
                </label>
                <input
                  type="text"
                  required
                  value={fuActionTaken}
                  onChange={(e) => setFuActionTaken(e.target.value)}
                  placeholder="E.g. Cleared storm drainage & consulted agronomist"
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={fuNotes}
                  onChange={(e) => setFuNotes(e.target.value)}
                  placeholder="Observations during follow-up inspection..."
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFollowUpIncident(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#CBD5E1] text-sm font-semibold text-[#334155]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold cursor-pointer"
              >
                Save Follow-Up
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
