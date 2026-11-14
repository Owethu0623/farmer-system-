import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  CheckCircle2,
  CloudOff,
  CloudRain,
  Download,
  RefreshCw,
  Sprout,
  Tractor,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  downloadAndStoreOfflineBundle,
  enqueueOfflineMutation,
  getOfflineStaleness,
  loadOfflineBundle,
  loadOfflineQueue,
  markQueueItemForceOverwrite,
  removeOfflineQueueItem,
  syncPendingQueue,
} from '../lib/offlineSync';
import {
  AuthUser,
  CropActivityType,
  FarmItem,
  IncidentType,
  LivestockRecordType,
  OfflineBundlePayload,
  OfflineQueuedMutation,
} from '../types';

interface OfflineSyncViewProps {
  user: AuthUser;
  farms: FarmItem[];
  onSyncedDataChanged: () => void;
  onNavigateTab: (tab: string) => void;
}

type CacheTab = 'farms' | 'crops_livestock' | 'weather' | 'plans' | 'guides';
type CaptureTab = 'crop_activity' | 'livestock_record' | 'farm_incident';

async function compressImageForOffline(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read photograph.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported image format. Only JPEG/PNG/WebP are supported.'));
      img.onload = () => {
        const scale = Math.min(1, 840 / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas error'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const OfflineSyncView: React.FC<OfflineSyncViewProps> = ({
  user,
  farms,
  onSyncedDataChanged,
  onNavigateTab,
}) => {
  const { isOnline, browserOnline, simulatedOffline, toggleSimulatedOffline } = useOnlineStatus();

  const [bundle, setBundle] = useState<OfflineBundlePayload | null>(null);
  const [queue, setQueue] = useState<OfflineQueuedMutation[]>([]);
  const [selectedFarmIds, setSelectedFarmIds] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [cacheTab, setCacheTab] = useState<CacheTab>('farms');
  const [captureTab, setCaptureTab] = useState<CaptureTab>('crop_activity');
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>(null);

  // Offline quick-capture form states
  const [capCropId, setCapCropId] = useState('');
  const [capActType, setCapActType] = useState<CropActivityType>('irrigation');
  const [capActDate, setCapActDate] = useState(new Date().toISOString().slice(0, 10));
  const [capActQty, setCapActQty] = useState('120');
  const [capActUnit, setCapActUnit] = useState('liters');
  const [capActNotes, setCapActNotes] = useState('');

  const [capLivestockId, setCapLivestockId] = useState('');
  const [capRecType, setCapRecType] = useState<LivestockRecordType>('Feeding');
  const [capRecDate, setCapRecDate] = useState(new Date().toISOString().slice(0, 10));
  const [capRecCount, setCapRecCount] = useState('1');
  const [capRecNotes, setCapRecNotes] = useState('');

  const [capIncFarmId, setCapIncFarmId] = useState('');
  const [capIncType, setCapIncType] = useState<IncidentType>('storm_damage');
  const [capIncTitle, setCapIncTitle] = useState('');
  const [capIncDesc, setCapIncDesc] = useState('');
  const [capIncAffectedQty, setCapIncAffectedQty] = useState('0');
  const [capIncAffectedHa, setCapIncAffectedHa] = useState('0');
  const [capIncPhotoName, setCapIncPhotoName] = useState<string | null>(null);
  const [capIncPhotoDataUrl, setCapIncPhotoDataUrl] = useState<string | null>(null);

  const refreshLocalVault = useCallback(async () => {
    const [b, q] = await Promise.all([loadOfflineBundle(user.id), loadOfflineQueue(user.id)]);
    setBundle(b);
    setQueue(q);
  }, [user.id]);

  useEffect(() => {
    refreshLocalVault();
    const onQueueChange = () => {
      refreshLocalVault();
    };
    window.addEventListener('fieldshift-offline-queue-changed', onQueueChange);
    return () => {
      window.removeEventListener('fieldshift-offline-queue-changed', onQueueChange);
    };
  }, [refreshLocalVault]);

  const selectableFarms = useMemo(() => {
    if (farms.length > 0) return farms;
    return bundle?.farms || [];
  }, [farms, bundle]);

  useEffect(() => {
    if (selectedFarmIds.length === 0 && selectableFarms.length > 0) {
      setSelectedFarmIds(selectableFarms.map((f) => f.id));
    }
    if (!capIncFarmId && selectableFarms.length > 0) {
      setCapIncFarmId(selectableFarms[0].id);
    }
  }, [selectableFarms, selectedFarmIds.length, capIncFarmId]);

  useEffect(() => {
    if (!capCropId && bundle?.crops && bundle.crops.length > 0) {
      setCapCropId(bundle.crops[0].id);
    }
    if (!capLivestockId && bundle?.livestockGroups && bundle.livestockGroups.length > 0) {
      setCapLivestockId(bundle.livestockGroups[0].id);
    }
  }, [bundle, capCropId, capLivestockId]);

  const staleness = useMemo(() => getOfflineStaleness(bundle), [bundle]);

  const handleToggleFarmSelect = (farmId: string) => {
    setSelectedFarmIds((prev) =>
      prev.includes(farmId) ? prev.filter((id) => id !== farmId) : [...prev, farmId]
    );
  };

  const handleDownloadPack = async () => {
    if (!isOnline) {
      setErrorMessage('An internet connection is required to download an updated offline farm pack.');
      return;
    }
    setDownloading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const targetIds =
        selectableFarms.length > 0
          ? selectedFarmIds.length > 0
            ? selectedFarmIds
            : selectableFarms.map((f) => f.id)
          : undefined;
      const saved = await downloadAndStoreOfflineBundle(user.id, targetIds);
      setBundle(saved);
      setStatusMessage(
        `Saved offline pack at ${new Date(saved.downloadedAt).toLocaleString()} (${saved.farms.length} farm(s), ${saved.crops.length} crop(s), ${saved.businessPlans.length} plan(s), ${saved.learningGuides.length} guide(s)).`
      );
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to download offline pack.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRunSync = async (onlyMutationId?: string) => {
    if (!isOnline) {
      setErrorMessage('Cannot synchronise while offline. Your records remain safely queued on this device.');
      return;
    }
    setSyncing(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const summary = await syncPendingQueue(user.id, onlyMutationId);
      await refreshLocalVault();
      const parts: string[] = [];
      if (summary.syncedCount > 0) parts.push(`${summary.syncedCount} synced`);
      if (summary.duplicateSkippedCount > 0) {
        parts.push(`${summary.duplicateSkippedCount} duplicate(s) skipped safely`);
      }
      if (summary.conflictCount > 0) parts.push(`${summary.conflictCount} conflict(s) require review`);
      if (summary.errorCount > 0) parts.push(`${summary.errorCount} error(s)`);
      setStatusMessage(
        parts.length > 0 ? `Synchronisation result: ${parts.join(' · ')}.` : 'All queued records are already up to date.'
      );
      if (summary.syncedCount > 0) {
        try {
          const refreshed = await downloadAndStoreOfflineBundle(
            user.id,
            selectedFarmIds.length > 0 ? selectedFarmIds : undefined
          );
          setBundle(refreshed);
        } catch {
          // Non-fatal if background bundle refresh fails
        }
        onSyncedDataChanged();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Synchronisation failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDiscardItem = async (clientMutationId: string) => {
    await removeOfflineQueueItem(user.id, clientMutationId);
    await refreshLocalVault();
    setStatusMessage('Removed queued offline record.');
  };

  const handleOverwriteConflict = async (clientMutationId: string) => {
    await markQueueItemForceOverwrite(user.id, clientMutationId);
    await handleRunSync(clientMutationId);
  };

  const handleQueueCropActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    const crop = bundle?.crops.find((c) => c.id === capCropId);
    if (!crop) {
      setErrorMessage('Download a farm offline pack with crops first, or select a crop.');
      return;
    }
    await enqueueOfflineMutation({
      userId: user.id,
      mutationType: 'crop_activity',
      label: `${capActType.replace(/_/g, ' ')} — ${crop.cropName}`,
      farmId: crop.farmId,
      farmName: crop.farmName || null,
      baseUpdatedAt: crop.updatedAt,
      payload: {
        cropId: crop.id,
        activityType: capActType,
        activityDate: capActDate,
        quantity: Number(capActQty) || 0,
        unit: capActUnit || 'units',
        valueZar: 0,
        notes: capActNotes || 'Recorded via offline field capture',
      },
    });
    setCapActNotes('');
    await refreshLocalVault();
    setStatusMessage('Crop activity saved to local offline queue. It will sync automatically when connected.');
  };

  const handleQueueLivestockRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    const grp = bundle?.livestockGroups.find((g) => g.id === capLivestockId);
    if (!grp) {
      setErrorMessage('Download a farm offline pack with livestock groups first.');
      return;
    }
    await enqueueOfflineMutation({
      userId: user.id,
      mutationType: 'livestock_record',
      label: `${capRecType} — ${grp.groupName}`,
      farmId: grp.farmId,
      farmName: grp.farmName || null,
      baseUpdatedAt: grp.updatedAt,
      payload: {
        livestockGroupId: grp.id,
        recordType: capRecType,
        recordDate: capRecDate,
        count: Math.max(0, Number(capRecCount) || 0),
        productionAmount: 0,
        productionUnit: '',
        valueZar: 0,
        notes: capRecNotes || 'Recorded via offline field capture',
      },
    });
    setCapRecNotes('');
    await refreshLocalVault();
    setStatusMessage('Livestock event saved to local offline queue.');
  };

  const handleIncidentPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    try {
      const dataUrl = await compressImageForOffline(file);
      setCapIncPhotoName(file.name);
      setCapIncPhotoDataUrl(dataUrl);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to attach photograph.');
    }
    e.target.value = '';
  };

  const handleQueueIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    const targetFarm = selectableFarms.find((f) => f.id === capIncFarmId);
    if (!targetFarm) {
      setErrorMessage('Select an accessible farm to log the incident.');
      return;
    }
    if (!capIncTitle.trim()) {
      setErrorMessage('Incident title is required.');
      return;
    }
    await enqueueOfflineMutation({
      userId: user.id,
      mutationType: 'farm_incident',
      label: `Incident: ${capIncTitle.trim()}`,
      farmId: targetFarm.id,
      farmName: targetFarm.name,
      payload: {
        farmId: targetFarm.id,
        incidentType: capIncType,
        title: capIncTitle.trim(),
        occurredAt: new Date().toISOString(),
        description: capIncDesc.trim() || 'Field incident captured while offline.',
        mediaFileName: capIncPhotoName,
        mediaType: capIncPhotoDataUrl ? 'image' : null,
        mediaPreviewDataUrl: capIncPhotoDataUrl,
        affectedQuantity: Math.max(0, Number(capIncAffectedQty) || 0),
        affectedUnit: capIncType === 'livestock_death' || capIncType === 'livestock_illness' ? 'head' : 'plants',
        affectedAreaHectares: Math.max(0, Number(capIncAffectedHa) || 0),
        estimatedFinancialImpactZar: 0,
        recommendedActions: [],
        status: 'active',
      },
    });
    setCapIncTitle('');
    setCapIncDesc('');
    setCapIncPhotoName(null);
    setCapIncPhotoDataUrl(null);
    await refreshLocalVault();
    setStatusMessage('Incident saved locally on this device and queued for sync.');
  };

  return (
    <div className="space-y-6">
      {/* Header & Connectivity Status */}
      <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              {isOnline ? (
                <Wifi className="w-5 h-5 text-[#1B4332]" />
              ) : (
                <WifiOff className="w-5 h-5 text-[#8E2424]" />
              )}
              <h1 className="font-display text-2xl font-bold text-[#143326]">
                Offline Field Storage & Synchronisation
              </h1>
            </div>
            <p className="text-sm text-[#4A5A50]">
              Save selected farms, weather snapshots, business plans, and guides on your device for rural areas with weak or no signal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => toggleSimulatedOffline()}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
                simulatedOffline
                  ? 'bg-[#FDF2F2] border-[#E8B4B4] text-[#8E2424]'
                  : 'bg-[#F6F7F4] border-[#D4DDD2] text-[#143326] hover:bg-[#EDF2EC]'
              }`}
            >
              <CloudOff className="w-4 h-4" />
              <span>
                {simulatedOffline ? 'Exit Offline Test Mode' : 'Test Low-Connectivity Mode'}
              </span>
            </button>

            <button
              type="button"
              disabled={!isOnline || syncing || queue.length === 0}
              onClick={() => handleRunSync()}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1B4332] hover:bg-[#143326] disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>
                {syncing ? 'Syncing...' : `Sync Pending (${queue.length})`}
              </span>
            </button>
          </div>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#E2E6DF]">
          <div className="p-3.5 rounded-xl bg-[#F6F7F4] border border-[#E2E6DF]">
            <p className="text-xs text-[#4A5A50]">Connection Status</p>
            <p
              className={`font-semibold text-sm mt-1 ${
                isOnline ? 'text-[#1B4332]' : 'text-[#8E2424]'
              }`}
            >
              {isOnline
                ? 'Online — Ready to Sync'
                : simulatedOffline && browserOnline
                ? 'Offline (Simulated Test Mode)'
                : 'Offline — Local Storage Active'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F6F7F4] border border-[#E2E6DF]">
            <p className="text-xs text-[#4A5A50]">Last Downloaded Pack</p>
            <p className="font-mono text-xs font-semibold text-[#143326] mt-1 tabular-nums">
              {bundle ? new Date(bundle.downloadedAt).toLocaleString() : 'Not downloaded yet'}
            </p>
            {staleness.isBundleStale && (
              <p className="text-[11px] font-semibold text-[#9A5B13] mt-0.5">
                Outdated cache ({staleness.bundleAgeHours}h old — refresh when online)
              </p>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-[#F6F7F4] border border-[#E2E6DF]">
            <p className="text-xs text-[#4A5A50]">Weather Cache Status</p>
            <p className="font-mono text-xs font-semibold text-[#143326] mt-1 tabular-nums">
              {bundle
                ? `${bundle.weatherSnapshots.length} farm snapshot(s)`
                : 'No cached weather'}
            </p>
            {staleness.isWeatherStale && (
              <p className="text-[11px] font-semibold text-[#9A5B13] mt-0.5">
                Cached weather &gt; 6h old ({staleness.weatherAgeHours}h)
              </p>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-[#F6F7F4] border border-[#E2E6DF]">
            <p className="text-xs text-[#4A5A50]">Pending Queue</p>
            <p className="font-mono text-sm font-bold text-[#143326] mt-1 tabular-nums">
              {queue.length} record{queue.length === 1 ? '' : 's'} waiting
            </p>
            {queue.some((i) => i.syncState === 'conflict') && (
              <p className="text-[11px] font-semibold text-[#8E2424] mt-0.5">
                Conflict review needed before overwrite
              </p>
            )}
          </div>
        </div>

        {/* Connectivity Requirement Notice */}
        <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-[#143326]">
          <AlertTriangle className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Internet Connectivity Note:</strong> Fresh weather forecasts, external satellite/ARC feeds, and online Gemini AI chat/visual diagnostics require an active internet connection. Cached snapshots show their exact download time, and offline changes never silently overwrite newer server records.
          </p>
        </div>

        {statusMessage && (
          <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl px-4 py-3 text-sm text-[#143326] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#1B4332] shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-[#FDF2F2] border border-[#E8B4B4] rounded-xl px-4 py-3 text-sm text-[#8E2424]">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Download Selected Farms Pack */}
      <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#143326]">
              1. Save Farm Information, Plans & Guides Locally
            </h2>
            <p className="text-xs text-[#4A5A50]">
              Choose which farms to store on this device. Saved business plans and learning guides are always included.
            </p>
          </div>
          <button
            type="button"
            disabled={!isOnline || downloading}
            onClick={handleDownloadPack}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#143326] hover:bg-[#1B4332] disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>
              {downloading ? 'Downloading...' : 'Download Offline Pack'}
            </span>
          </button>
        </div>

        {selectableFarms.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectableFarms.map((farm) => {
              const checked = selectedFarmIds.includes(farm.id);
              return (
                <label
                  key={farm.id}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer ${
                    checked
                      ? 'bg-[#EDF5EF] border-[#1B4332]'
                      : 'bg-white border-[#D4DDD2]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleFarmSelect(farm.id)}
                    className="mt-1 w-4 h-4 accent-[#1B4332]"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#143326] truncate">{farm.name}</p>
                    <p className="text-xs text-[#4A5A50] truncate">
                      {farm.province} · <span className="font-mono">{farm.farmSizeHectares} ha</span>
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-[#4A5A50]">
            No registered farms linked yet. Downloading the offline pack will still store your saved business plans and official farming guides.
          </p>
        )}
      </section>

      {/* Pending Synchronisation Queue & Conflict Resolution */}
      <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#143326]">
              2. Pending Synchronisation Queue ({queue.length})
            </h2>
            <p className="text-xs text-[#4A5A50]">
              Each record carries a unique mutation ID to prevent duplicates and compares timestamps so newer server data is never silently overwritten.
            </p>
          </div>
        </div>

        {queue.length === 0 ? (
          <p className="text-sm text-[#4A5A50] py-2">
            No pending offline records. Capture a crop activity, livestock event, or incident offline below or in any farm module while offline.
          </p>
        ) : (
          <div className="divide-y divide-[#E2E6DF]">
            {queue.map((item) => (
              <div key={item.clientMutationId} className="py-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`font-mono font-bold uppercase ${
                          item.syncState === 'conflict' || item.syncState === 'error'
                            ? 'text-[#8E2424]'
                            : 'text-[#1B4332]'
                        }`}
                      >
                        {item.syncState === 'conflict'
                          ? 'CONFLICT DETECTED'
                          : item.syncState === 'error'
                          ? 'SYNC ERROR'
                          : 'PENDING SYNC'}
                      </span>
                      <span className="text-[#4A5A50] font-mono tabular-nums">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                      {item.farmName && (
                        <span className="text-[#35443B] font-semibold">· {item.farmName}</span>
                      )}
                    </div>
                    <p className="font-semibold text-sm text-[#143326]">{item.label}</p>
                    <p className="text-[11px] font-mono text-[#4A5A50]">
                      Mutation ID: {item.clientMutationId}
                      {item.forceOverwrite ? ' · Marked to overwrite server' : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {item.syncState === 'conflict' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDiscardItem(item.clientMutationId)}
                          className="px-3 py-1.5 rounded-lg border border-[#D4DDD2] text-xs font-semibold text-[#143326] hover:bg-[#F6F7F4] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Keep Server (Discard Local)
                        </button>
                        <button
                          type="button"
                          disabled={!isOnline || syncing}
                          onClick={() => handleOverwriteConflict(item.clientMutationId)}
                          className="px-3 py-1.5 rounded-lg bg-[#8E2424] hover:bg-[#731C1C] disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Overwrite Server
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={!isOnline || syncing}
                          onClick={() => handleRunSync(item.clientMutationId)}
                          className="px-3 py-1.5 rounded-lg bg-[#EDF5EF] hover:bg-[#DCEBDD] disabled:opacity-50 text-[#143326] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Sync Now
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDiscardItem(item.clientMutationId)}
                          aria-label="Discard queued item"
                          className="p-1.5 rounded-lg border border-[#E8B4B4] text-[#8E2424] hover:bg-[#FDF2F2] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {item.lastError && (
                  <div className="bg-[#FDF2F2] border border-[#E8B4B4] rounded-xl p-3 text-xs text-[#8E2424] space-y-1">
                    <p className="font-semibold">{item.lastError}</p>
                    {item.serverSummary && (
                      <p className="text-[#35443B]">Server version: {item.serverSummary}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Offline Quick Capture Forms */}
      <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#143326]">
              3. Record Farming Activities & Incidents Offline
            </h2>
            <p className="text-xs text-[#4A5A50]">
              Capture field work immediately even when signal drops. Records are queued safely until connectivity returns.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 p-1 bg-[#EAEFE8] rounded-xl">
            {(
              [
                { id: 'crop_activity', label: 'Crop Activity' },
                { id: 'livestock_record', label: 'Livestock Event' },
                { id: 'farm_incident', label: 'Farm Incident' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setCaptureTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  captureTab === t.id ? 'bg-white text-[#143326]' : 'text-[#4A5A50]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {captureTab === 'crop_activity' && (
          <form onSubmit={handleQueueCropActivity} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Downloaded Crop</label>
              <select
                value={capCropId}
                onChange={(e) => setCapCropId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
              >
                {(bundle?.crops || []).length === 0 ? (
                  <option value="">Download offline pack first</option>
                ) : (
                  bundle?.crops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.cropName} — {c.farmName}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Activity</label>
              <select
                value={capActType}
                onChange={(e) => setCapActType(e.target.value as CropActivityType)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
              >
                <option value="irrigation">Irrigation</option>
                <option value="fertiliser">Fertiliser</option>
                <option value="pest">Pest Observation</option>
                <option value="disease">Disease Observation</option>
                <option value="damage">Crop Damage</option>
                <option value="harvest">Harvest</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Date & Qty</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={capActDate}
                  onChange={(e) => setCapActDate(e.target.value)}
                  className="w-full px-2.5 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={capActQty}
                  onChange={(e) => setCapActQty(e.target.value)}
                  className="w-24 px-2.5 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Unit & Notes</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={capActUnit}
                  onChange={(e) => setCapActUnit(e.target.value)}
                  placeholder="liters/kg"
                  className="w-20 px-2.5 py-2.5 rounded-xl border border-[#D4DDD2] text-xs"
                />
                <input
                  type="text"
                  value={capActNotes}
                  onChange={(e) => setCapActNotes(e.target.value)}
                  placeholder="Field notes..."
                  className="flex-1 px-2.5 py-2.5 rounded-xl border border-[#D4DDD2] text-xs"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={(bundle?.crops || []).length === 0}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#1B4332] hover:bg-[#143326] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                Queue Crop Activity
              </button>
            </div>
          </form>
        )}

        {captureTab === 'livestock_record' && (
          <form onSubmit={handleQueueLivestockRecord} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Livestock Group</label>
              <select
                value={capLivestockId}
                onChange={(e) => setCapLivestockId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
              >
                {(bundle?.livestockGroups || []).length === 0 ? (
                  <option value="">Download offline pack first</option>
                ) : (
                  bundle?.livestockGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.groupName} ({g.quantity} head)
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Event Type</label>
              <select
                value={capRecType}
                onChange={(e) => setCapRecType(e.target.value as LivestockRecordType)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
              >
                <option value="Feeding">Feeding</option>
                <option value="Birth">Birth</option>
                <option value="Death">Death</option>
                <option value="Veterinary">Veterinary</option>
                <option value="Vaccination">Vaccination</option>
                <option value="Sale">Sale</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Date</label>
              <input
                type="date"
                value={capRecDate}
                onChange={(e) => setCapRecDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Count & Notes</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={capRecCount}
                  onChange={(e) => setCapRecCount(e.target.value)}
                  className="w-20 px-2.5 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-xs"
                />
                <input
                  type="text"
                  value={capRecNotes}
                  onChange={(e) => setCapRecNotes(e.target.value)}
                  placeholder="Observation..."
                  className="flex-1 px-2.5 py-2.5 rounded-xl border border-[#D4DDD2] text-xs"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={(bundle?.livestockGroups || []).length === 0}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#1B4332] hover:bg-[#143326] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                Queue Livestock Log
              </button>
            </div>
          </form>
        )}

        {captureTab === 'farm_incident' && (
          <form onSubmit={handleQueueIncident} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Farm</label>
                <select
                  value={capIncFarmId}
                  onChange={(e) => setCapIncFarmId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                >
                  {selectableFarms.length === 0 ? (
                    <option value="">No farm downloaded</option>
                  ) : (
                    selectableFarms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Incident Type</label>
                <select
                  value={capIncType}
                  onChange={(e) => setCapIncType(e.target.value as IncidentType)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                >
                  <option value="storm_damage">Storm damage</option>
                  <option value="heavy_rainfall">Heavy rainfall</option>
                  <option value="flooding">Flooding</option>
                  <option value="drought">Drought</option>
                  <option value="pest_outbreak">Pest outbreak</option>
                  <option value="crop_disease">Crop disease</option>
                  <option value="livestock_illness">Livestock illness</option>
                  <option value="equipment_damage">Equipment damage</option>
                  <option value="infrastructure_damage">Infrastructure damage</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={capIncTitle}
                  onChange={(e) => setCapIncTitle(e.target.value)}
                  placeholder="E.g. Fence damaged by storm"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                  Affected Qty & Area (ha)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={capIncAffectedQty}
                    onChange={(e) => setCapIncAffectedQty(e.target.value)}
                    placeholder="Qty"
                    className="w-1/2 px-2.5 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-xs"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={capIncAffectedHa}
                    onChange={(e) => setCapIncAffectedHa(e.target.value)}
                    placeholder="ha"
                    className="w-1/2 px-2.5 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-6">
                <input
                  type="text"
                  value={capIncDesc}
                  onChange={(e) => setCapIncDesc(e.target.value)}
                  placeholder="Describe visible damage and immediate actions taken..."
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="min-h-[42px] px-3 py-2 rounded-xl border border-[#D4DDD2] bg-[#F6F7F4] text-xs font-semibold text-[#143326] flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4 text-[#1B4332] shrink-0" />
                  <span className="truncate">{capIncPhotoName || 'Attach Photo (JPEG/PNG)'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleIncidentPhoto}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={selectableFarms.length === 0}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#1B4332] hover:bg-[#143326] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  Queue Incident Offline
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      {/* Cached Offline Data Viewer */}
      <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#143326]">
              4. View Downloaded Offline Information
            </h2>
            <p className="text-xs text-[#4A5A50]">
              {bundle
                ? `Showing cached pack downloaded ${new Date(bundle.downloadedAt).toLocaleString()}.`
                : 'No offline pack saved on this device yet. Click Download Offline Pack above while online.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 p-1 bg-[#EAEFE8] rounded-xl">
            {(
              [
                { id: 'farms', label: `Farms (${bundle?.farms.length || 0})`, icon: Tractor },
                {
                  id: 'crops_livestock',
                  label: `Crops & Livestock (${(bundle?.crops.length || 0) + (bundle?.livestockGroups.length || 0)})`,
                  icon: Sprout,
                },
                { id: 'weather', label: `Weather (${bundle?.weatherSnapshots.length || 0})`, icon: CloudRain },
                { id: 'plans', label: `Plans (${bundle?.businessPlans.length || 0})`, icon: Briefcase },
                { id: 'guides', label: `Guides (${bundle?.learningGuides.length || 0})`, icon: BookOpen },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCacheTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  cacheTab === tab.id ? 'bg-white text-[#143326]' : 'text-[#4A5A50]'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {bundle && cacheTab === 'farms' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bundle.farms.length === 0 ? (
              <p className="text-sm text-[#4A5A50]">No farms stored in this offline pack.</p>
            ) : (
              bundle.farms.map((farm) => (
                <div key={farm.id} className="border border-[#E2E6DF] rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display font-bold text-[#143326]">{farm.name}</p>
                      <p className="text-xs text-[#4A5A50]">
                        {farm.province} · {farm.district}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold tabular-nums text-[#1B4332]">
                      {farm.farmSizeHectares} ha
                    </span>
                  </div>
                  <p className="text-xs text-[#35443B]">
                    Water: {farm.waterAvailability} · Fields: {farm.fields.length}
                  </p>
                  {farm.fields.length > 0 && (
                    <div className="pt-2 border-t border-[#E2E6DF] space-y-1">
                      {farm.fields.map((fld) => (
                        <p key={fld.id} className="text-xs font-mono text-[#4A5A50]">
                          • {fld.name}: {fld.areaHectares} ha ({fld.fieldType})
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {bundle && cacheTab === 'crops_livestock' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[#143326]">
                Cached Crops ({bundle.crops.length})
              </h3>
              {bundle.crops.length === 0 ? (
                <p className="text-xs text-[#4A5A50]">No crops cached.</p>
              ) : (
                <div className="divide-y divide-[#E2E6DF] border border-[#E2E6DF] rounded-xl px-4">
                  {bundle.crops.map((c) => (
                    <div key={c.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-semibold text-[#143326]">
                          {c.cropName} ({c.cropVariety})
                        </p>
                        <p className="text-[#4A5A50]">
                          {c.farmName} · Stage: <span className="capitalize">{c.growthStage}</span>
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <p className="font-semibold text-[#1B4332]">
                          {(c.remainingPlants ?? c.plantingQuantity).toLocaleString()} plants
                        </p>
                        <p className="text-[#4A5A50]">{c.harvestedQuantityKg.toLocaleString()} kg harvested</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[#143326]">
                Cached Livestock Groups ({bundle.livestockGroups.length})
              </h3>
              {bundle.livestockGroups.length === 0 ? (
                <p className="text-xs text-[#4A5A50]">No livestock cached.</p>
              ) : (
                <div className="divide-y divide-[#E2E6DF] border border-[#E2E6DF] rounded-xl px-4">
                  {bundle.livestockGroups.map((g) => (
                    <div key={g.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-semibold text-[#143326]">
                          {g.groupName} ({g.breed})
                        </p>
                        <p className="text-[#4A5A50]">
                          {g.farmName} · {g.healthStatus}
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <p className="font-semibold text-[#143326]">{g.quantity} head</p>
                        <p className="text-[#4A5A50]">{g.animalType}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {bundle && cacheTab === 'weather' && (
          <div className="space-y-4">
            {bundle.weatherSnapshots.length === 0 ? (
              <p className="text-sm text-[#4A5A50]">No cached weather snapshots.</p>
            ) : (
              bundle.weatherSnapshots.map((ws) => (
                <div key={ws.farmId} className="border border-[#E2E6DF] rounded-xl p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display font-bold text-sm text-[#143326]">{ws.farmName}</p>
                    <span className="font-mono text-xs text-[#4A5A50]">
                      Cached forecast timestamp: {new Date(ws.snapshotFetchedAt).toLocaleString()}
                    </span>
                  </div>
                  {ws.forecasts.length === 0 ? (
                    <p className="text-xs text-[#4A5A50]">
                      No prior forecast snapshot saved yet for this farm. Connect online and open Weather Intelligence to fetch and store one.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {ws.forecasts.slice(0, 4).map((f) => (
                        <div key={f.id} className="bg-[#F6F7F4] rounded-lg p-2.5 font-mono tabular-nums">
                          <p className="font-semibold text-[#143326]">{f.forecastDate}</p>
                          <p className="text-[#35443B]">
                            {f.tempMinC}°–{f.tempMaxC}°C · {f.predictedRainfallMm} mm
                          </p>
                          <p className="font-sans text-[11px] text-[#4A5A50] truncate">{f.conditionSummary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {bundle && cacheTab === 'plans' && (
          <div className="space-y-3">
            {bundle.businessPlans.length === 0 ? (
              <div className="text-sm text-[#4A5A50] flex flex-wrap items-center justify-between gap-2">
                <span>No saved farming business plans in offline cache yet.</span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('planner')}
                  className="text-xs font-semibold text-[#1B4332] underline cursor-pointer"
                >
                  Open Business Planner
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bundle.businessPlans.map((bp) => (
                  <div key={bp.id} className="border border-[#E2E6DF] rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display font-bold text-[#143326]">{bp.planName}</p>
                        <p className="text-xs text-[#4A5A50]">
                          {bp.province} · {bp.farmSizeHectares} ha · {bp.scaleTier.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <span className="font-mono text-xs text-[#4A5A50]">
                        {bp.updatedAt.slice(0, 10)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E2E6DF] font-mono text-xs tabular-nums">
                      <div>
                        <p className="font-sans text-[11px] text-[#4A5A50]">Startup Cost</p>
                        <p className="font-semibold text-[#143326]">
                          R {bp.calculation.estimatedStartupCostsZar.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="font-sans text-[11px] text-[#4A5A50]">Est. Revenue</p>
                        <p className="font-semibold text-[#1B4332]">
                          R {bp.calculation.estimatedRevenueZar.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="font-sans text-[11px] text-[#4A5A50]">Est. Op. Profit</p>
                        <p className="font-semibold text-[#143326]">
                          R {bp.calculation.estimatedOperatingProfitLossZar.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {bundle && cacheTab === 'guides' && (
          <div className="space-y-2">
            {bundle.learningGuides.map((g) => {
              const expanded = expandedGuideId === g.id;
              return (
                <div key={g.id} className="border border-[#E2E6DF] rounded-xl p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[#143326]">{g.displayTitle}</p>
                      <p className="text-xs text-[#4A5A50]">
                        {g.categoryLabel} · {g.estimatedMinutes} min · {g.sourceAttribution}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedGuideId(expanded ? null : g.id)}
                      className="text-xs font-semibold text-[#1B4332] underline cursor-pointer"
                    >
                      {expanded ? 'Hide Guide' : 'Read Offline'}
                    </button>
                  </div>
                  {expanded && (
                    <div className="pt-2 border-t border-[#E2E6DF] text-xs text-[#17201B] space-y-2">
                      <p className="leading-relaxed">{g.displaySummary}</p>
                      <p className="leading-relaxed whitespace-pre-line">{g.displayBody}</p>
                      {g.displaySteps.length > 0 && (
                        <ol className="list-decimal list-inside space-y-1 font-medium text-[#143326]">
                          {g.displaySteps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
