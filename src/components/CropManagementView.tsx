import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Edit3,
  History,
  Plus,
  Sprout,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  enqueueOfflineMutation,
  isLikelyOfflineError,
  loadOfflineBundle,
} from '../lib/offlineSync';
import { getSastDateString } from '../lib/saTime';
import {
  CropActivityItem,
  CropActivityType,
  CropAnalytics,
  CropGrowthStage,
  CropItem,
  FarmItem,
  ProvinceInfo,
} from '../types';
import { CropRotationPlannerPanel } from './CropRotationPlannerPanel';

interface CropManagementViewProps {
  userId?: string;
  farms: FarmItem[];
  provinces?: ProvinceInfo[];
  selectedFarmId: string | null;
  onSelectFarmFilter: (farmId: string | null) => void;
  onDataChanged: () => void;
}

const GROWTH_STAGES: { value: CropGrowthStage; label: string }[] = [
  { value: 'planted', label: 'Planted' },
  { value: 'germination', label: 'Germination' },
  { value: 'vegetative', label: 'Vegetative' },
  { value: 'flowering', label: 'Flowering' },
  { value: 'fruiting', label: 'Fruiting / Cobbing' },
  { value: 'mature', label: 'Mature' },
  { value: 'harvested', label: 'Harvested' },
];

const ACTIVITY_TYPES: { value: CropActivityType; label: string; unitHint: string }[] = [
  { value: 'stage_update', label: 'Growth Stage Update', unitHint: 'stage' },
  { value: 'irrigation', label: 'Irrigation Activity', unitHint: 'liters' },
  { value: 'fertiliser', label: 'Fertiliser Application', unitHint: 'kg' },
  { value: 'pest', label: 'Pest Incident', unitHint: 'plants' },
  { value: 'disease', label: 'Disease Incident', unitHint: 'plants' },
  { value: 'damage', label: 'Crop Damage', unitHint: 'plants' },
  { value: 'harvest', label: 'Harvesting Record', unitHint: 'kg' },
];

export const CropManagementView: React.FC<CropManagementViewProps> = ({
  userId,
  farms,
  provinces = [],
  selectedFarmId,
  onSelectFarmFilter,
  onDataChanged,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'crops' | 'rotation'>('crops');
  const [farmFilter, setFarmFilter] = useState<string>(selectedFarmId || 'all');
  const [crops, setCrops] = useState<CropItem[]>([]);
  const [analytics, setAnalytics] = useState<CropAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Register / Edit Crop Modal
  const [cropModalMode, setCropModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingCropId, setEditingCropId] = useState<string | null>(null);
  const [formFarmId, setFormFarmId] = useState<string>(farms[0]?.id || '');
  const [formFieldId, setFormFieldId] = useState<string>('');
  const [cropName, setCropName] = useState('');
  const [cropVariety, setCropVariety] = useState('');
  const [plantingDate, setPlantingDate] = useState('2026-10-01');
  const [plantingQuantity, setPlantingQuantity] = useState(10000);
  const [cultivatedArea, setCultivatedArea] = useState(1.5);
  const [soilInfo, setSoilInfo] = useState('Loam · pH 6.4');
  const [irrigationMethod, setIrrigationMethod] = useState('Drip Irrigation');
  const [fertiliserInfo, setFertiliserInfo] = useState('NPK 2:3:2 basal');
  const [expectedHarvestDate, setExpectedHarvestDate] = useState('2027-01-15');
  const [growthStage, setGrowthStage] = useState<CropGrowthStage>('planted');
  const [estimatedValueZar, setEstimatedValueZar] = useState(25000);
  const [savingCrop, setSavingCrop] = useState(false);

  // Activity Modal
  const [activityTargetCrop, setActivityTargetCrop] = useState<CropItem | null>(null);
  const [activityType, setActivityType] = useState<CropActivityType>('irrigation');
  const [activityDate, setActivityDate] = useState(getSastDateString());
  const [activityQty, setActivityQty] = useState(0);
  const [activityUnit, setActivityUnit] = useState('liters');
  const [activityValZar, setActivityValZar] = useState(0);
  const [activityNotes, setActivityNotes] = useState('');
  const [newStage, setNewStage] = useState<CropGrowthStage>('vegetative');
  const [savingActivity, setSavingActivity] = useState(false);

  // History Drawer
  const [historyCrop, setHistoryCrop] = useState<CropItem | null>(null);
  const [historyLogs, setHistoryLogs] = useState<CropActivityItem[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = farmFilter !== 'all' ? `?farmId=${encodeURIComponent(farmFilter)}` : '';
      const [cropList, stats] = await Promise.all([
        apiRequest<CropItem[]>(`/api/crops${qs}`),
        apiRequest<CropAnalytics>(`/api/crops/analytics${qs}`),
      ]);
      setCrops(cropList);
      setAnalytics(stats);
    } catch (err: unknown) {
      if (userId && isLikelyOfflineError(err)) {
        const bundle = await loadOfflineBundle(userId);
        if (bundle) {
          const cachedCrops =
            farmFilter !== 'all'
              ? bundle.crops.filter((c) => c.farmId === farmFilter)
              : bundle.crops;
          const cachedActs = (bundle.cropActivities || []).filter(
            (a) => farmFilter === 'all' || a.farmId === farmFilter
          );
          setCrops(cachedCrops);
          const totalPlanted = cachedCrops.reduce((s, c) => s + (c.plantingQuantity || 0), 0);
          const damagedPlants = cachedCrops.reduce((s, c) => s + (c.damagedPlants || 0), 0);
          setAnalytics({
            totalRegisteredCrops: cachedCrops.length,
            totalCultivatedHectares: Number(
              cachedCrops.reduce((s, c) => s + (c.cultivatedAreaHectares || 0), 0).toFixed(2)
            ),
            totalPlanted,
            damagedPlants,
            remainingPlants: Math.max(0, totalPlanted - damagedPlants),
            totalHarvestedKg: Number(
              cachedCrops.reduce((s, c) => s + (c.harvestedQuantityKg || 0), 0).toFixed(1)
            ),
            estimatedHarvestValueZar: Number(
              cachedCrops.reduce((s, c) => s + (c.estimatedValueZar || 0), 0).toFixed(2)
            ),
            byCrop: cachedCrops.map((c) => ({
              id: c.id,
              cropName: c.cropName,
              cropVariety: c.cropVariety,
              cultivatedAreaHectares: c.cultivatedAreaHectares,
              harvestedQuantityKg: c.harvestedQuantityKg,
              estimatedValueZar: c.estimatedValueZar,
              remainingPlants: Math.max(0, (c.plantingQuantity || 0) - (c.damagedPlants || 0)),
              growthStage: c.growthStage,
            })),
            timeline: Array.from(
              cachedActs.reduce((map, act) => {
                const month = (act.activityDate || '').slice(0, 7) || 'Unknown';
                const cur = map.get(month) || { month, harvestKg: 0, activitiesCount: 0, valueZar: 0 };
                cur.activitiesCount += 1;
                if (act.activityType === 'harvest') cur.harvestKg += Number(act.quantity || 0);
                cur.valueZar += Number(act.valueZar || 0);
                map.set(month, cur);
                return map;
              }, new Map<string, { month: string; harvestKg: number; activitiesCount: number; valueZar: number }>()).values()
            ).sort((a, b) => a.month.localeCompare(b.month)),
          });
          setNotice(`Showing cached crops downloaded at ${new Date(bundle.downloadedAt).toLocaleString()} (offline mode).`);
          setError(null);
          return;
        }
      }
      setError(err instanceof Error ? err.message : 'Unable to load crop data.');
    } finally {
      setLoading(false);
    }
  }, [farmFilter, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableFields = useMemo(() => {
    const f = farms.find((x) => x.id === formFarmId);
    return f?.fields || [];
  }, [farms, formFarmId]);

  const openCreateModal = () => {
    const defaultFarm = farms.find((f) => f.id === farmFilter) || farms[0];
    setCropModalMode('create');
    setEditingCropId(null);
    setFormFarmId(defaultFarm?.id || '');
    setFormFieldId(defaultFarm?.fields[0]?.id || '');
    setCropName('');
    setCropVariety('');
    setPlantingDate(getSastDateString());
    setPlantingQuantity(20000);
    setCultivatedArea(1.5);
    setSoilInfo('Red Loam · pH 6.3');
    setIrrigationMethod('Pressure-Compensated Drip');
    setFertiliserInfo('NPK 2:3:2 + LAN top-dressing');
    setExpectedHarvestDate('2027-02-15');
    setGrowthStage('planted');
    setEstimatedValueZar(35000);
  };

  const openEditModal = (crop: CropItem) => {
    setCropModalMode('edit');
    setEditingCropId(crop.id);
    setFormFarmId(crop.farmId);
    setFormFieldId(crop.fieldId || '');
    setCropName(crop.cropName);
    setCropVariety(crop.cropVariety);
    setPlantingDate(crop.plantingDate);
    setPlantingQuantity(crop.plantingQuantity);
    setCultivatedArea(crop.cultivatedAreaHectares);
    setSoilInfo(crop.soilInformation);
    setIrrigationMethod(crop.irrigationMethod);
    setFertiliserInfo(crop.fertiliserInformation);
    setExpectedHarvestDate(crop.expectedHarvestingDate);
    setGrowthStage(crop.growthStage);
    setEstimatedValueZar(crop.estimatedValueZar);
  };

  const handleSaveCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (
      !Number.isFinite(plantingQuantity) ||
      plantingQuantity < 0 ||
      !Number.isFinite(cultivatedArea) ||
      cultivatedArea < 0 ||
      !Number.isFinite(estimatedValueZar) ||
      estimatedValueZar < 0
    ) {
      setError('Planting quantity, cultivated area, and estimated value must be valid non-negative numbers.');
      return;
    }
    if (expectedHarvestDate && plantingDate && expectedHarvestDate < plantingDate) {
      setError('Expected harvest date cannot be earlier than the planting date.');
      return;
    }
    setSavingCrop(true);
    try {
      const payload = {
        farmId: formFarmId,
        fieldId: formFieldId || null,
        cropName,
        cropVariety,
        plantingDate,
        plantingQuantity,
        cultivatedAreaHectares: cultivatedArea,
        soilInformation: soilInfo,
        irrigationMethod,
        fertiliserInformation: fertiliserInfo,
        expectedHarvestingDate: expectedHarvestDate,
        growthStage,
        estimatedValueZar,
      };
      if (cropModalMode === 'create') {
        await apiRequest('/api/crops', { method: 'POST', body: JSON.stringify(payload) });
      } else if (cropModalMode === 'edit' && editingCropId) {
        await apiRequest(`/api/crops/${editingCropId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }
      setCropModalMode(null);
      await loadData();
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save crop.');
    } finally {
      setSavingCrop(false);
    }
  };

  const handleDeleteCrop = async (cropId: string) => {
    setError(null);
    try {
      await apiRequest(`/api/crops/${cropId}`, { method: 'DELETE' });
      await loadData();
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete crop.');
    }
  };

  const openActivityModal = (crop: CropItem) => {
    setActivityTargetCrop(crop);
    setActivityType('irrigation');
    setActivityUnit('liters');
    setActivityDate(getSastDateString());
    setActivityQty(0);
    setActivityValZar(0);
    setActivityNotes('');
    setNewStage(crop.growthStage);
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityTargetCrop) return;
    setSavingActivity(true);
    setError(null);
    setNotice(null);
    const activityPayload = {
      activityType,
      activityDate,
      quantity: activityQty,
      unit: activityUnit,
      valueZar: activityValZar,
      notes: activityNotes,
      newGrowthStage: activityType === 'stage_update' ? newStage : undefined,
    };

    const queueActivityOffline = async () => {
      if (!userId) return false;
      await enqueueOfflineMutation({
        userId,
        mutationType: 'crop_activity',
        label: `${activityType.replace(/_/g, ' ')} — ${activityTargetCrop.cropName}`,
        farmId: activityTargetCrop.farmId,
        farmName: activityTargetCrop.farmName || null,
        baseUpdatedAt: activityTargetCrop.updatedAt,
        payload: {
          cropId: activityTargetCrop.id,
          ...activityPayload,
        },
      });
      setActivityTargetCrop(null);
      setNotice('Offline mode: crop activity saved locally and queued for sync.');
      return true;
    };

    try {
      const simulatedOffline =
        typeof window !== 'undefined' &&
        window.localStorage.getItem('fieldshift_simulated_offline') === 'true';
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || simulatedOffline) {
        if (await queueActivityOffline()) return;
      }
      await apiRequest(`/api/crops/${activityTargetCrop.id}/activities`, {
        method: 'POST',
        body: JSON.stringify(activityPayload),
      });
      setActivityTargetCrop(null);
      await loadData();
      onDataChanged();
    } catch (err: unknown) {
      if (isLikelyOfflineError(err) && (await queueActivityOffline())) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not record crop activity.');
    } finally {
      setSavingActivity(false);
    }
  };

  const openHistory = async (crop: CropItem) => {
    setHistoryCrop(crop);
    try {
      const logs = await apiRequest<CropActivityItem[]>(`/api/crops/${crop.id}/activities`);
      setHistoryLogs(logs);
    } catch (err: unknown) {
      if (userId && isLikelyOfflineError(err)) {
        const bundle = await loadOfflineBundle(userId);
        if (bundle) {
          setHistoryLogs(bundle.cropActivities.filter((a) => a.cropId === crop.id));
          return;
        }
      }
      setHistoryLogs([]);
    }
  };

  const maxChartHa = Math.max(1, ...(analytics?.byCrop.map((c) => c.cultivatedAreaHectares) || [1]));
  const maxTimelineQty = Math.max(
    1,
    ...(analytics?.timeline.map((t) => t.harvestKg || t.activitiesCount * 1000) || [1])
  );

  const activeFarmForRotation = useMemo(
    () =>
      farms.find((f) => f.id === (farmFilter !== 'all' ? farmFilter : selectedFarmId)) ||
      farms[0] ||
      null,
    [farms, farmFilter, selectedFarmId]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
            Crop Management, Rotation & Analytics
          </h1>
          <p className="text-sm text-[#475569] mt-0.5">
            Track planting quantities, growth stages, irrigation, fertiliser, pests, harvests, and 3-season botanical crop rotation scenarios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={farmFilter}
            onChange={(e) => {
              setFarmFilter(e.target.value);
              onSelectFarmFilter(e.target.value === 'all' ? null : e.target.value);
            }}
            className="px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-semibold text-[#0F172A] min-h-[42px]"
          >
            <option value="all">All Registered Farms</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          {farms.length > 0 && activeSubTab === 'crops' && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white font-semibold text-sm cursor-pointer min-h-[42px] whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Register Crop</span>
            </button>
          )}
        </div>
      </div>

      {/* Segmented Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-[#CBD5E1] rounded-xl w-fit max-w-full">
        <button
          type="button"
          onClick={() => setActiveSubTab('crops')}
          className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold cursor-pointer sm:whitespace-nowrap text-left transition-colors ${
            activeSubTab === 'crops'
              ? 'bg-[#0B3D91] text-white'
              : 'text-[#334155] hover:bg-[#F8FAFC]'
          }`}
        >
          Registered Crops & Activity Logs
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('rotation')}
          className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold cursor-pointer sm:whitespace-nowrap text-left transition-colors ${
            activeSubTab === 'rotation'
              ? 'bg-[#0B3D91] text-white'
              : 'text-[#334155] hover:bg-[#F8FAFC]'
          }`}
        >
          3-Season Crop Rotation & Scenario Planner
        </button>
      </div>

      {activeSubTab === 'rotation' && (
        <CropRotationPlannerPanel
          farmId={activeFarmForRotation?.id || null}
          province={activeFarmForRotation?.location?.province}
          waterAvailability={activeFarmForRotation?.waterAvailability}
          farmSizeHectares={activeFarmForRotation?.farmSizeHectares}
          provinces={provinces}
        />
      )}

      {activeSubTab === 'crops' && (
        <>

      {notice && (
        <div className="bg-[#ECF5F2] border border-[#A7D7C5] text-[#174C3C] rounded-xl px-4 py-3 text-sm">
          {notice}
        </div>
      )}

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Crop Analytics Summary KPIs */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#475569]">Registered Crops</p>
            <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-1">
              {analytics.totalRegisteredCrops}
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#475569]">Cultivated Area</p>
            <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-1">
              {analytics.totalCultivatedHectares} ha
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#475569]">Planted Count</p>
            <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-1">
              {analytics.totalPlanted.toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#475569]">Damaged Plants</p>
            <p className="font-mono text-xl font-bold tabular-nums text-[#B91C1C] mt-1">
              {analytics.damagedPlants.toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#475569]">Remaining Plants</p>
            <p className="font-mono text-xl font-bold tabular-nums text-[#174C3C] mt-1">
              {analytics.remainingPlants.toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#475569]">Harvested Output</p>
            <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-1">
              {analytics.totalHarvestedKg.toLocaleString()} kg
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#475569]">Est. Harvest Value</p>
            <p className="font-mono text-xl font-bold tabular-nums text-[#174C3C] mt-1">
              R {analytics.estimatedHarvestValueZar.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Charts Row */}
      {analytics && analytics.byCrop.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cultivated Area & Value by Crop */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sprout className="w-4 h-4 text-[#174C3C]" />
                <h2 className="font-display font-bold text-base text-[#0B1F3A]">
                  Cultivated Hectares & Est. Value by Crop
                </h2>
              </div>
              <span className="text-xs text-[#475569]">Area (ha)</span>
            </div>

            <div className="space-y-3">
              {analytics.byCrop.map((item) => {
                const widthPct = Math.max(6, Math.round((item.cultivatedAreaHectares / maxChartHa) * 100));
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#0B1F3A]">
                        {item.cropName} · <span className="font-normal text-[#475569]">{item.cropVariety}</span>
                      </span>
                      <span className="font-mono tabular-nums text-[#334155]">
                        {item.cultivatedAreaHectares} ha · R {item.estimatedValueZar.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-3 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#174C3C] rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Crop Performance Over Time */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0B3D91]" />
                <h2 className="font-display font-bold text-base text-[#0B1F3A]">
                  Crop Performance & Activity Timeline
                </h2>
              </div>
              <span className="text-xs text-[#475569]">Monthly Harvest & Logs</span>
            </div>

            {analytics.timeline.length === 0 ? (
              <p className="text-sm text-[#475569] py-8 text-center">
                Record irrigation, fertiliser, or harvesting activities to view monthly trends.
              </p>
            ) : (
              <div className="flex items-end gap-4 h-44 pt-4 pb-2 px-2 border-b border-[#E2E8F0]">
                {analytics.timeline.map((pt) => {
                  const metric = pt.harvestKg > 0 ? pt.harvestKg : pt.activitiesCount * 1000;
                  const barH = Math.max(18, Math.round((metric / maxTimelineQty) * 120));
                  return (
                    <div key={pt.month} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="font-mono text-[11px] tabular-nums text-[#334155]">
                        {pt.harvestKg > 0
                          ? `${pt.harvestKg.toLocaleString()} kg`
                          : `${pt.activitiesCount} log${pt.activitiesCount === 1 ? '' : 's'}`}
                      </span>
                      <div
                        className="w-full max-w-[44px] bg-[#0B3D91] rounded-t-md"
                        style={{ height: `${barH}px` }}
                      />
                      <span className="font-mono text-[11px] text-[#475569]">{pt.month}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Crops Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
          Registered Crops ({crops.length})
        </h2>

        {loading ? (
          <p className="text-sm text-[#475569]">Loading crop records...</p>
        ) : crops.length === 0 ? (
          <p className="text-sm text-[#475569] py-6">
            No crops registered yet. Click Register Crop to capture your first planting.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-xs text-[#475569]">
                  <th className="py-2.5 pr-4 font-semibold">Crop & Variety</th>
                  <th className="py-2.5 pr-4 font-semibold">Farm / Field</th>
                  <th className="py-2.5 pr-4 font-semibold">Stage & Dates</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Area</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Remaining Plants</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Harvest / Est. Value</th>
                  <th className="py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {crops.map((crop) => {
                  const remaining =
                    crop.remainingPlants ?? Math.max(0, crop.plantingQuantity - crop.damagedPlants);
                  return (
                    <tr key={crop.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-3.5 pr-4">
                        <p className="font-semibold text-[#0B1F3A]">{crop.cropName}</p>
                        <p className="text-xs text-[#475569]">
                          {crop.cropVariety} · {crop.irrigationMethod}
                        </p>
                      </td>
                      <td className="py-3.5 pr-4 text-xs text-[#334155]">
                        <p className="font-medium">{crop.farmName}</p>
                        <p className="text-[#475569]">{crop.fieldName}</p>
                      </td>
                      <td className="py-3.5 pr-4 text-xs">
                        <p className="font-semibold text-[#174C3C] capitalize">
                          {crop.growthStage}
                        </p>
                        <p className="text-[#475569] font-mono tabular-nums">
                          Planted {crop.plantingDate} · Exp {crop.expectedHarvestingDate}
                        </p>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono tabular-nums text-[#0F172A]">
                        {crop.cultivatedAreaHectares} ha
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono tabular-nums">
                        <p className="font-semibold text-[#0B1F3A]">{remaining.toLocaleString()}</p>
                        {crop.damagedPlants > 0 && (
                          <p className="text-[11px] text-[#B91C1C]">
                            -{crop.damagedPlants.toLocaleString()} damaged
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-right font-mono tabular-nums">
                        <p className="font-semibold text-[#0B1F3A]">
                          {crop.harvestedQuantityKg.toLocaleString()} kg
                        </p>
                        <p className="text-[11px] text-[#174C3C]">
                          R {crop.estimatedValueZar.toLocaleString()}
                        </p>
                      </td>
                      <td className="py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openActivityModal(crop)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#0B3D91] text-xs font-semibold cursor-pointer min-h-[34px]"
                          >
                            Log Activity
                          </button>
                          <button
                            type="button"
                            onClick={() => openHistory(crop)}
                            title="View historical logs"
                            className="p-2 rounded-lg border border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#334155] cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(crop)}
                            title="Update crop"
                            className="p-2 rounded-lg border border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#334155] cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCrop(crop.id)}
                            title="Remove crop"
                            className="p-2 rounded-lg border border-[#FECACA] hover:bg-[#FEF2F2] text-[#B91C1C] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {/* Register / Update Crop Modal */}
      {cropModalMode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#CBD5E1] rounded-2xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#0B1F3A]">
                {cropModalMode === 'create' ? 'Register Crop Planting' : 'Update Crop Record'}
              </h3>
              <button
                type="button"
                onClick={() => setCropModalMode(null)}
                className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#334155] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCrop} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Farm</label>
                  <select
                    value={formFarmId}
                    onChange={(e) => {
                      setFormFarmId(e.target.value);
                      const f = farms.find((x) => x.id === e.target.value);
                      setFormFieldId(f?.fields[0]?.id || '');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white"
                  >
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Field</label>
                  <select
                    value={formFieldId}
                    onChange={(e) => setFormFieldId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white"
                  >
                    <option value="">General Farm Block</option>
                    {availableFields.map((fld) => (
                      <option key={fld.id} value={fld.id}>
                        {fld.name} ({fld.areaHectares} ha)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Crop Name</label>
                  <input
                    type="text"
                    required
                    value={cropName}
                    onChange={(e) => setCropName(e.target.value)}
                    placeholder="e.g. Yellow Maize, Tomatoes"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Crop Variety</label>
                  <input
                    type="text"
                    required
                    value={cropVariety}
                    onChange={(e) => setCropVariety(e.target.value)}
                    placeholder="e.g. PAN 6Q-308B, Rodade"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Planting Date</label>
                  <input
                    type="date"
                    required
                    value={plantingDate}
                    onChange={(e) => setPlantingDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Expected Harvest</label>
                  <input
                    type="date"
                    required
                    value={expectedHarvestDate}
                    onChange={(e) => setExpectedHarvestDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Planting Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={plantingQuantity}
                    onChange={(e) => setPlantingQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Area (ha)</label>
                  <input
                    type="number"
                    min={0.05}
                    step={0.05}
                    value={cultivatedArea}
                    onChange={(e) => setCultivatedArea(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Soil Information</label>
                  <input
                    type="text"
                    value={soilInfo}
                    onChange={(e) => setSoilInfo(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Irrigation Method</label>
                  <input
                    type="text"
                    value={irrigationMethod}
                    onChange={(e) => setIrrigationMethod(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-1">
                  <label className="block text-sm font-semibold">Growth Stage</label>
                  <select
                    value={growthStage}
                    onChange={(e) => setGrowthStage(e.target.value as CropGrowthStage)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm"
                  >
                    {GROWTH_STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <label className="block text-sm font-semibold">Est. Value (ZAR)</label>
                  <input
                    type="number"
                    min={0}
                    value={estimatedValueZar}
                    onChange={(e) => setEstimatedValueZar(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] font-mono text-sm"
                  />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <label className="block text-sm font-semibold">Fertiliser Info</label>
                  <input
                    type="text"
                    value={fertiliserInfo}
                    onChange={(e) => setFertiliserInfo(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCropModalMode(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#CBD5E1] text-sm font-semibold text-[#334155] cursor-pointer min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCrop}
                  className="px-5 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold cursor-pointer min-h-[40px]"
                >
                  {savingCrop ? 'Saving...' : 'Save Crop Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Crop Activity / Incident / Harvest Modal */}
      {activityTargetCrop && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#CBD5E1] rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Log Crop Activity
                </h3>
                <p className="text-xs text-[#475569]">
                  {activityTargetCrop.cropName} ({activityTargetCrop.cropVariety})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivityTargetCrop(null)}
                className="p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveActivity} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Activity Type</label>
                  <select
                    value={activityType}
                    onChange={(e) => {
                      const next = e.target.value as CropActivityType;
                      setActivityType(next);
                      const hint = ACTIVITY_TYPES.find((a) => a.value === next)?.unitHint || 'kg';
                      setActivityUnit(hint);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm"
                  >
                    {ACTIVITY_TYPES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Date</label>
                  <input
                    type="date"
                    required
                    value={activityDate}
                    onChange={(e) => setActivityDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] font-mono text-sm"
                  />
                </div>
              </div>

              {activityType === 'stage_update' ? (
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">New Growth Stage</label>
                  <select
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value as CropGrowthStage)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm"
                  >
                    {GROWTH_STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold">Quantity</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={activityQty}
                      onChange={(e) => setActivityQty(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold">Unit</label>
                    <input
                      type="text"
                      value={activityUnit}
                      onChange={(e) => setActivityUnit(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold">Value / Cost (ZAR)</label>
                    <input
                      type="number"
                      min={0}
                      value={activityValZar}
                      onChange={(e) => setActivityValZar(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] font-mono text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-sm font-semibold">Notes / Details</label>
                <textarea
                  rows={2}
                  value={activityNotes}
                  onChange={(e) => setActivityNotes(e.target.value)}
                  placeholder="Describe observations, application rates, or buyer delivery..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#CBD5E1] text-sm"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActivityTargetCrop(null)}
                  className="px-4 py-2 rounded-xl border border-[#CBD5E1] text-sm font-semibold text-[#334155] cursor-pointer min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingActivity}
                  className="px-5 py-2 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold cursor-pointer min-h-[40px]"
                >
                  {savingActivity ? 'Recording...' : 'Record Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Historical Record Viewer Modal */}
      {historyCrop && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#CBD5E1] rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Historical Records — {historyCrop.cropName}
                </h3>
                <p className="text-xs text-[#475569]">
                  Complete audit trail of activities, incidents, harvests, and record updates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryCrop(null)}
                className="p-1.5 rounded-lg hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto divide-y divide-[#E2E8F0] flex-1">
              {historyLogs.length === 0 ? (
                <p className="text-sm text-[#475569] py-6">No historical logs recorded yet.</p>
              ) : (
                historyLogs.map((log) => (
                  <div key={log.id} className="py-3 space-y-1 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#0B1F3A] capitalize">
                        {log.activityType.replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-[#475569] flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{log.activityDate}</span>
                      </span>
                    </div>
                    <p className="text-xs text-[#334155]">{log.notes}</p>
                    {(log.quantity > 0 || log.valueZar > 0) && (
                      <p className="font-mono text-xs tabular-nums text-[#174C3C]">
                        {log.quantity > 0 ? `${log.quantity.toLocaleString()} ${log.unit}` : ''}{' '}
                        {log.valueZar > 0 ? `· R ${log.valueZar.toLocaleString()}` : ''}
                      </p>
                    )}
                    {log.snapshot && (
                      <p className="text-[11px] font-mono text-[#475569]">
                        Archived prior state: {String(log.snapshot.cropName || '')} (
                        {String(log.snapshot.growthStage || '')},{' '}
                        {String(log.snapshot.cultivatedAreaHectares || '')} ha)
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
