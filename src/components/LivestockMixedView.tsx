import React, { useCallback, useEffect, useState } from 'react';
import {
  Edit3,
  History,
  Layers,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  enqueueOfflineMutation,
  isLikelyOfflineError,
  loadOfflineBundle,
} from '../lib/offlineSync';
import {
  FarmItem,
  LivestockAnalytics,
  LivestockAnimalType,
  LivestockGroupItem,
  LivestockHealthStatus,
  LivestockRecordItem,
  LivestockRecordType,
  MixedEntryCategory,
  MixedFarmingEntryItem,
  MixedFarmingSummary,
} from '../types';

interface LivestockMixedViewProps {
  userId?: string;
  initialSection: 'livestock' | 'mixed';
  farms: FarmItem[];
  selectedFarmId: string | null;
  onDataChanged: () => void;
}

const ANIMAL_TYPES: LivestockAnimalType[] = ['Cattle', 'Sheep', 'Goats', 'Pigs', 'Poultry'];
const HEALTH_STATUSES: LivestockHealthStatus[] = [
  'Healthy',
  'Under Observation',
  'Treatment',
  'Quarantine',
];
const RECORD_TYPES: LivestockRecordType[] = [
  'Birth',
  'Death',
  'Purchase',
  'Sale',
  'Transfer',
  'Feeding',
  'Veterinary',
  'Vaccination',
  'Production',
];

const MIXED_CATEGORIES: { value: MixedEntryCategory; label: string }[] = [
  { value: 'feed_production', label: 'Feed Production & Crop Residue' },
  { value: 'shared_land', label: 'Shared Land & Grazing Allocation' },
  { value: 'water_management', label: 'Water Management (Crops & Troughs)' },
  { value: 'combined_expense', label: 'Combined Farm Expense' },
  { value: 'combined_production', label: 'Combined Production Record' },
];

export const LivestockMixedView: React.FC<LivestockMixedViewProps> = ({
  userId,
  initialSection,
  farms,
  selectedFarmId,
  onDataChanged,
}) => {
  const [section, setSection] = useState<'livestock' | 'mixed'>(initialSection);
  const [farmFilter, setFarmFilter] = useState<string>(selectedFarmId || 'all');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  // Livestock state
  const [groups, setGroups] = useState<LivestockGroupItem[]>([]);
  const [livestockStats, setLivestockStats] = useState<LivestockAnalytics | null>(null);
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [gFarmId, setGFarmId] = useState(farms[0]?.id || '');
  const [gAnimalType, setGAnimalType] = useState<LivestockAnimalType>('Cattle');
  const [gName, setGName] = useState('');
  const [gBreed, setGBreed] = useState('');
  const [gQuantity, setGQuantity] = useState(10);
  const [gIdNum, setGIdNum] = useState('');
  const [gRegDate, setGRegDate] = useState(new Date().toISOString().slice(0, 10));
  const [gHealth, setGHealth] = useState<LivestockHealthStatus>('Healthy');
  const [gFeeding, setGFeeding] = useState('Rotational veld grazing + mineral lick');
  const [gGrazing, setGGrazing] = useState('Upper rotational paddock');
  const [gHousing, setGHousing] = useState('Open handling kraal & shelter');
  const [gUnitValue, setGUnitValue] = useState(12000);
  const [savingGroup, setSavingGroup] = useState(false);

  // Livestock Event Record Modal & History
  const [recordTarget, setRecordTarget] = useState<LivestockGroupItem | null>(null);
  const [recType, setRecType] = useState<LivestockRecordType>('Birth');
  const [recDate, setRecDate] = useState(new Date().toISOString().slice(0, 10));
  const [recCount, setRecCount] = useState(1);
  const [recProdAmt, setRecProdAmt] = useState(0);
  const [recProdUnit, setRecProdUnit] = useState('eggs');
  const [recValueZar, setRecValueZar] = useState(0);
  const [recNotes, setRecNotes] = useState('');
  const [savingRec, setSavingRec] = useState(false);

  const [historyGroup, setHistoryGroup] = useState<LivestockGroupItem | null>(null);
  const [historyRecords, setHistoryRecords] = useState<LivestockRecordItem[]>([]);

  // Mixed Farming state
  const [mixedSummary, setMixedSummary] = useState<MixedFarmingSummary | null>(null);
  const [mixedEntries, setMixedEntries] = useState<MixedFarmingEntryItem[]>([]);
  const [showMixedModal, setShowMixedModal] = useState(false);
  const [mFarmId, setMFarmId] = useState(farms[0]?.id || '');
  const [mCategory, setMCategory] = useState<MixedEntryCategory>('feed_production');
  const [mTitle, setMTitle] = useState('');
  const [mDate, setMDate] = useState(new Date().toISOString().slice(0, 10));
  const [mExpense, setMExpense] = useState(0);
  const [mProdQty, setMProdQty] = useState(0);
  const [mProdUnit, setMProdUnit] = useState('kg');
  const [mWaterLiters, setMWaterLiters] = useState(0);
  const [mNotes, setMNotes] = useState('');
  const [savingMixed, setSavingMixed] = useState(false);

  const loadAll = useCallback(async () => {
    const qs = farmFilter !== 'all' ? `?farmId=${encodeURIComponent(farmFilter)}` : '';
    try {
      const [gList, lStats, mSum, mList] = await Promise.all([
        apiRequest<LivestockGroupItem[]>(`/api/livestock${qs}`),
        apiRequest<LivestockAnalytics>(`/api/livestock/analytics${qs}`),
        apiRequest<MixedFarmingSummary>(`/api/mixed-farming/summary${qs}`),
        apiRequest<MixedFarmingEntryItem[]>(`/api/mixed-farming${qs}`),
      ]);
      setGroups(gList);
      setLivestockStats(lStats);
      setMixedSummary(mSum);
      setMixedEntries(mList);
    } catch (err: unknown) {
      if (userId && isLikelyOfflineError(err)) {
        const bundle = await loadOfflineBundle(userId);
        if (bundle) {
          const filtered =
            farmFilter !== 'all'
              ? bundle.livestockGroups.filter((g) => g.farmId === farmFilter)
              : bundle.livestockGroups;
          setGroups(filtered);
          setNotice(
            `Offline mode: showing cached livestock herds downloaded at ${new Date(bundle.downloadedAt).toLocaleString()}.`
          );
          return;
        }
      }
      setError(err instanceof Error ? err.message : 'Unable to load livestock and mixed farming records.');
    }
  }, [farmFilter, userId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openCreateGroup = () => {
    const defaultFarm = farms.find((f) => f.id === farmFilter) || farms[0];
    setGroupModalMode('create');
    setEditingGroupId(null);
    setGFarmId(defaultFarm?.id || '');
    setGAnimalType('Cattle');
    setGName('');
    setGBreed('Nguni');
    setGQuantity(12);
    setGIdNum('');
    setGRegDate(new Date().toISOString().slice(0, 10));
    setGHealth('Healthy');
    setGFeeding('Rotational veld grazing + mineral lick');
    setGGrazing('North grazing camp');
    setGHousing('Steel handling kraal');
    setGUnitValue(13500);
  };

  const openEditGroup = (g: LivestockGroupItem) => {
    setGroupModalMode('edit');
    setEditingGroupId(g.id);
    setGFarmId(g.farmId);
    setGAnimalType(g.animalType);
    setGName(g.groupName);
    setGBreed(g.breed);
    setGQuantity(g.quantity);
    setGIdNum(g.identificationNumber);
    setGRegDate(g.registrationDate);
    setGHealth(g.healthStatus);
    setGFeeding(g.feedingInformation);
    setGGrazing(g.grazingInformation);
    setGHousing(g.housingInformation);
    setGUnitValue(g.estimatedUnitValueZar);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGroup(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        farmId: gFarmId,
        animalType: gAnimalType,
        groupName: gName,
        breed: gBreed,
        quantity: gQuantity,
        identificationNumber: gIdNum,
        registrationDate: gRegDate,
        healthStatus: gHealth,
        feedingInformation: gFeeding,
        grazingInformation: gGrazing,
        housingInformation: gHousing,
        estimatedUnitValueZar: gUnitValue,
      };
      if (groupModalMode === 'create') {
        await apiRequest('/api/livestock', { method: 'POST', body: JSON.stringify(payload) });
      } else if (groupModalMode === 'edit' && editingGroupId) {
        await apiRequest(`/api/livestock/${editingGroupId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }
      setGroupModalMode(null);
      await loadAll();
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save livestock group.');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    setError(null);
    try {
      await apiRequest(`/api/livestock/${id}`, { method: 'DELETE' });
      await loadAll();
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete livestock group.');
    }
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordTarget) return;
    setSavingRec(true);
    setError(null);
    setNotice(null);
    const recPayload = {
      recordType: recType,
      recordDate: recDate,
      count: recCount,
      productionAmount: recProdAmt,
      productionUnit: recProdUnit,
      valueZar: recValueZar,
      notes: recNotes,
    };

    const queueRecordOffline = async () => {
      if (!userId) return false;
      await enqueueOfflineMutation({
        userId,
        mutationType: 'livestock_record',
        label: `${recType} — ${recordTarget.groupName}`,
        farmId: recordTarget.farmId,
        farmName: recordTarget.farmName || null,
        baseUpdatedAt: recordTarget.updatedAt,
        payload: {
          livestockGroupId: recordTarget.id,
          ...recPayload,
        },
      });
      setRecordTarget(null);
      setNotice('Offline mode: livestock event saved locally and queued for sync.');
      return true;
    };

    try {
      const simulatedOffline =
        typeof window !== 'undefined' &&
        window.localStorage.getItem('fieldshift_simulated_offline') === 'true';
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || simulatedOffline) {
        if (await queueRecordOffline()) return;
      }
      await apiRequest(`/api/livestock/${recordTarget.id}/records`, {
        method: 'POST',
        body: JSON.stringify(recPayload),
      });
      setRecordTarget(null);
      await loadAll();
      onDataChanged();
    } catch (err: unknown) {
      if (isLikelyOfflineError(err) && (await queueRecordOffline())) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not save livestock record.');
    } finally {
      setSavingRec(false);
    }
  };

  const openHistory = async (g: LivestockGroupItem) => {
    setHistoryGroup(g);
    try {
      const list = await apiRequest<LivestockRecordItem[]>(`/api/livestock/${g.id}/records`);
      setHistoryRecords(list);
    } catch (err: unknown) {
      if (userId && isLikelyOfflineError(err)) {
        const bundle = await loadOfflineBundle(userId);
        if (bundle) {
          setHistoryRecords(
            bundle.livestockRecords.filter((r) => r.livestockGroupId === g.id)
          );
          return;
        }
      }
      setHistoryRecords([]);
    }
  };

  const handleSaveMixed = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMixed(true);
    setError(null);
    setNotice(null);
    const mixedPayload = {
      farmId: mFarmId,
      entryCategory: mCategory,
      title: mTitle,
      entryDate: mDate,
      expenseZar: mExpense,
      productionQuantity: mProdQty,
      productionUnit: mProdUnit,
      waterLiters: mWaterLiters,
      notes: mNotes,
    };

    const queueMixedOffline = async () => {
      if (!userId) return false;
      const fName = farms.find((f) => f.id === mFarmId)?.name || null;
      await enqueueOfflineMutation({
        userId,
        mutationType: 'mixed_entry',
        label: `Mixed log: ${mTitle}`,
        farmId: mFarmId,
        farmName: fName,
        payload: mixedPayload,
      });
      setShowMixedModal(false);
      setNotice('Offline mode: mixed farming entry saved locally and queued for sync.');
      return true;
    };

    try {
      const simulatedOffline =
        typeof window !== 'undefined' &&
        window.localStorage.getItem('fieldshift_simulated_offline') === 'true';
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || simulatedOffline) {
        if (await queueMixedOffline()) return;
      }
      await apiRequest('/api/mixed-farming', {
        method: 'POST',
        body: JSON.stringify(mixedPayload),
      });
      setShowMixedModal(false);
      await loadAll();
      onDataChanged();
    } catch (err: unknown) {
      if (isLikelyOfflineError(err) && (await queueMixedOffline())) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not save mixed farming entry.');
    } finally {
      setSavingMixed(false);
    }
  };

  const handleDeleteMixed = async (id: string) => {
    setError(null);
    try {
      await apiRequest(`/api/mixed-farming/${id}`, { method: 'DELETE' });
      await loadAll();
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete mixed farming entry.');
    }
  };

  const maxCatCount = Math.max(
    1,
    ...(livestockStats?.byCategory.map((c) => c.count) || [1])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-[#143326]">
            {section === 'livestock'
              ? 'Livestock Management & Herd Ledger'
              : 'Mixed Farming Integration'}
          </h1>
          <p className="text-sm text-[#4A5A50]">
            {section === 'livestock'
              ? 'Manage Cattle, Sheep, Goats, Pigs, and Poultry across farms with births, deaths, sales, vet & production records.'
              : 'Coordinate shared land, grazing camps, crop-to-feed production, water management, and combined farm finances.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#EAEFE8] rounded-xl">
            <button
              type="button"
              onClick={() => setSection('livestock')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                section === 'livestock' ? 'bg-white text-[#143326] shadow-sm' : 'text-[#4A5A50]'
              }`}
            >
              Livestock
            </button>
            <button
              type="button"
              onClick={() => setSection('mixed')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                section === 'mixed' ? 'bg-white text-[#143326] shadow-sm' : 'text-[#4A5A50]'
              }`}
            >
              Mixed Farming
            </button>
          </div>

          <select
            value={farmFilter}
            onChange={(e) => setFarmFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm font-semibold"
          >
            <option value="all">All Registered Farms</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          {farms.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (section === 'livestock') openCreateGroup();
                else {
                  setMFarmId(farms[0]?.id || '');
                  setMTitle('');
                  setShowMixedModal(true);
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white font-semibold text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{section === 'livestock' ? 'Register Livestock' : 'Add Mixed Log'}</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="bg-[#EDF5EF] border border-[#BFD6C5] text-[#143326] rounded-xl px-4 py-3 text-sm">
          {notice}
        </div>
      )}

      {error && (
        <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* LIVESTOCK SECTION */}
      {section === 'livestock' && (
        <div className="space-y-6">
          {livestockStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
                <p className="text-xs text-[#4A5A50]">Total Animals</p>
                <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
                  {livestockStats.totalAnimals.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
                <p className="text-xs text-[#4A5A50]">Births</p>
                <p className="font-mono text-xl font-bold tabular-nums text-[#1B4332] mt-1">
                  +{livestockStats.births}
                </p>
              </div>
              <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
                <p className="text-xs text-[#4A5A50]">Deaths</p>
                <p className="font-mono text-xl font-bold tabular-nums text-[#8E2424] mt-1">
                  -{livestockStats.deaths}
                </p>
              </div>
              <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
                <p className="text-xs text-[#4A5A50]">Purchases</p>
                <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
                  +{livestockStats.purchases}
                </p>
              </div>
              <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
                <p className="text-xs text-[#4A5A50]">Sales</p>
                <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
                  -{livestockStats.sales}
                </p>
              </div>
              <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
                <p className="text-xs text-[#4A5A50]">Est. Livestock Value</p>
                <p className="font-mono text-xl font-bold tabular-nums text-[#1B4332] mt-1">
                  R {livestockStats.estimatedLivestockValueZar.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Category Breakdown Chart */}
          {livestockStats && (
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <h2 className="font-display font-bold text-base text-[#143326]">
                Animals by Category
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                {livestockStats.byCategory.map((cat) => {
                  const pct = cat.count > 0 ? Math.max(8, Math.round((cat.count / maxCatCount) * 100)) : 0;
                  return (
                    <div key={cat.category} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-[#143326]">{cat.category}</span>
                        <span className="font-mono tabular-nums text-[#35443B]">{cat.count}</span>
                      </div>
                      <div className="h-2.5 bg-[#EFF3EE] rounded-full overflow-hidden">
                        <div className="h-full bg-[#1B4332] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="font-mono text-[11px] tabular-nums text-[#4A5A50]">
                        R {cat.valueZar.toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Livestock Groups Table */}
          <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#143326]">
              Registered Herds, Flocks & Individual Animals ({groups.length})
            </h2>

            {groups.length === 0 ? (
              <p className="text-sm text-[#4A5A50] py-6">
                No livestock registered yet. Click Register Livestock to add cattle, sheep, goats, pigs, or poultry.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E6DF] text-xs text-[#4A5A50]">
                      <th className="py-2.5 pr-4 font-semibold">Group / Animal</th>
                      <th className="py-2.5 pr-4 font-semibold">Farm & ID</th>
                      <th className="py-2.5 pr-4 font-semibold">Health & Housing</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Quantity</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Est. Value</th>
                      <th className="py-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E6DF]">
                    {groups.map((g) => (
                      <tr key={g.id} className="hover:bg-[#FAFBF9]">
                        <td className="py-3.5 pr-4">
                          <p className="font-semibold text-[#143326]">{g.groupName}</p>
                          <p className="text-xs text-[#4A5A50]">
                            {g.animalType} · {g.breed}
                          </p>
                        </td>
                        <td className="py-3.5 pr-4 text-xs text-[#35443B]">
                          <p className="font-medium">{g.farmName}</p>
                          <p className="font-mono text-[#4A5A50]">
                            {g.identificationNumber || 'No tag ID'}
                          </p>
                        </td>
                        <td className="py-3.5 pr-4 text-xs">
                          <p className="font-semibold text-[#1B4332]">{g.healthStatus}</p>
                          <p className="text-[#4A5A50]">{g.grazingInformation}</p>
                        </td>
                        <td className="py-3.5 pr-4 text-right font-mono font-bold tabular-nums text-[#143326]">
                          {g.quantity.toLocaleString()}
                        </td>
                        <td className="py-3.5 pr-4 text-right font-mono tabular-nums text-[#2D6A4F]">
                          R {(g.quantity * g.estimatedUnitValueZar).toLocaleString()}
                        </td>
                        <td className="py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setRecordTarget(g);
                                setRecType('Birth');
                                setRecCount(1);
                                setRecProdAmt(0);
                                setRecValueZar(0);
                                setRecNotes('');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#EDF5EF] hover:bg-[#DCEBDD] text-[#143326] text-xs font-semibold cursor-pointer"
                            >
                              Add Record
                            </button>
                            <button
                              type="button"
                              onClick={() => openHistory(g)}
                              title="View records ledger"
                              className="p-1.5 rounded-lg border border-[#D4DDD2] hover:bg-[#F6F7F4] cursor-pointer"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditGroup(g)}
                              title="Edit livestock"
                              className="p-1.5 rounded-lg border border-[#D4DDD2] hover:bg-[#F6F7F4] cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(g.id)}
                              title="Delete livestock"
                              className="p-1.5 rounded-lg border border-[#E8B4B4] hover:bg-[#FDF2F2] text-[#8E2424] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MIXED FARMING SECTION */}
      {section === 'mixed' && (
        <div className="space-y-6">
          {mixedSummary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
                <p className="text-xs text-[#4A5A50]">Shared Land Allocation</p>
                <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
                  {mixedSummary.cropCultivatedHa} ha crops · {mixedSummary.grazingFieldsHa} ha grazing
                </p>
                <p className="text-xs text-[#4A5A50] mt-1">
                  Out of {mixedSummary.totalFarmAreaHa} ha farm total
                </p>
              </div>
              <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
                <p className="text-xs text-[#4A5A50]">Combined Farm Output & Stock</p>
                <p className="font-mono text-xl font-bold tabular-nums text-[#1B4332] mt-1">
                  R {mixedSummary.combinedAssetAndHarvestValueZar.toLocaleString()}
                </p>
                <p className="text-xs text-[#4A5A50] mt-1">
                  Crops R {mixedSummary.cropValueZar.toLocaleString()} · Livestock R{' '}
                  {mixedSummary.livestockValueZar.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
                <p className="text-xs text-[#4A5A50]">Feed Production & Water</p>
                <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
                  {mixedSummary.totalFeedProducedKg.toLocaleString()} kg feed
                </p>
                <p className="text-xs text-[#4A5A50] mt-1">
                  {mixedSummary.totalWaterManagedLiters.toLocaleString()} L water tracked
                </p>
              </div>
              <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
                <p className="text-xs text-[#4A5A50]">Combined Expenses Logged</p>
                <p className="font-mono text-xl font-bold tabular-nums text-[#8E2424] mt-1">
                  R {mixedSummary.combinedExpensesZar.toLocaleString()}
                </p>
                <p className="text-xs text-[#4A5A50] mt-1">
                  {mixedSummary.totalCrops} crops · {mixedSummary.totalLivestockHead} animals
                </p>
              </div>
            </div>
          )}

          <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#1B4332]" />
              <h2 className="font-display text-lg font-bold text-[#143326]">
                Mixed Farming Activity & Resource Ledger ({mixedEntries.length})
              </h2>
            </div>

            {mixedEntries.length === 0 ? (
              <p className="text-sm text-[#4A5A50] py-6">
                No mixed farming logs yet. Add feed production, water distribution, shared land, or combined expense entries.
              </p>
            ) : (
              <div className="divide-y divide-[#E2E6DF]">
                {mixedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="py-4 flex flex-wrap items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[#2D6A4F] capitalize">
                        {entry.entryCategory.replace(/_/g, ' ')} · {entry.farmName} ·{' '}
                        <span className="font-mono">{entry.entryDate}</span>
                      </p>
                      <p className="font-semibold text-[#143326]">{entry.title}</p>
                      {entry.notes && <p className="text-xs text-[#4A5A50]">{entry.notes}</p>}
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div className="font-mono text-xs tabular-nums space-y-0.5">
                        {entry.expenseZar > 0 && (
                          <p className="text-[#8E2424] font-semibold">
                            -R {entry.expenseZar.toLocaleString()}
                          </p>
                        )}
                        {entry.productionQuantity > 0 && (
                          <p className="text-[#1B4332] font-semibold">
                            +{entry.productionQuantity.toLocaleString()} {entry.productionUnit}
                          </p>
                        )}
                        {entry.waterLiters > 0 && (
                          <p className="text-[#35443B]">
                            {entry.waterLiters.toLocaleString()} L water
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMixed(entry.id)}
                        className="p-1.5 rounded-lg border border-[#E8B4B4] text-[#8E2424] hover:bg-[#FDF2F2] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Register / Edit Livestock Modal */}
      {groupModalMode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E2E6DF] rounded-2xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#143326]">
                {groupModalMode === 'create' ? 'Register Livestock' : 'Edit Livestock Record'}
              </h3>
              <button
                type="button"
                onClick={() => setGroupModalMode(null)}
                className="p-2 rounded-lg hover:bg-[#F1F3EF] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Farm</label>
                  <select
                    value={gFarmId}
                    onChange={(e) => setGFarmId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white"
                  >
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Animal Type</label>
                  <select
                    value={gAnimalType}
                    onChange={(e) => setGAnimalType(e.target.value as LivestockAnimalType)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white"
                  >
                    {ANIMAL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Group or Animal Name</label>
                  <input
                    type="text"
                    required
                    value={gName}
                    onChange={(e) => setGName(e.target.value)}
                    placeholder="e.g. Nguni Breeding Herd or Bull #104"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Breed</label>
                  <input
                    type="text"
                    required
                    value={gBreed}
                    onChange={(e) => setGBreed(e.target.value)}
                    placeholder="e.g. Nguni, Dorper, Boer Goat"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={gQuantity}
                    onChange={(e) => setGQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">ID / Ear Tag</label>
                  <input
                    type="text"
                    value={gIdNum}
                    onChange={(e) => setGIdNum(e.target.value)}
                    placeholder="Tag / Batch"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Health Status</label>
                  <select
                    value={gHealth}
                    onChange={(e) => setGHealth(e.target.value as LivestockHealthStatus)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-xs"
                  >
                    {HEALTH_STATUSES.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Unit Value (ZAR)</label>
                  <input
                    type="number"
                    min={0}
                    value={gUnitValue}
                    onChange={(e) => setGUnitValue(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Feeding Info</label>
                  <input
                    type="text"
                    value={gFeeding}
                    onChange={(e) => setGFeeding(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Grazing Info</label>
                  <input
                    type="text"
                    value={gGrazing}
                    onChange={(e) => setGGrazing(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Housing Info</label>
                  <input
                    type="text"
                    value={gHousing}
                    onChange={(e) => setGHousing(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setGroupModalMode(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#D4DDD2] text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGroup}
                  className="px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
                >
                  {savingGroup ? 'Saving...' : 'Save Livestock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Livestock Record Modal */}
      {recordTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E6DF] rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-[#143326]">
                  Add Livestock Record
                </h3>
                <p className="text-xs text-[#4A5A50]">
                  {recordTarget.groupName} (Current Qty: {recordTarget.quantity})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecordTarget(null)}
                className="p-1.5 rounded-lg hover:bg-[#F1F3EF] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Event Type</label>
                  <select
                    value={recType}
                    onChange={(e) => setRecType(e.target.value as LivestockRecordType)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                  >
                    {RECORD_TYPES.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Date</label>
                  <input
                    type="date"
                    value={recDate}
                    onChange={(e) => setRecDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">
                    {['Birth', 'Death', 'Purchase', 'Sale', 'Transfer'].includes(recType)
                      ? 'Number of Animals'
                      : 'Production / Dose Amount'}
                  </label>
                  {['Birth', 'Death', 'Purchase', 'Sale', 'Transfer'].includes(recType) ? (
                    <input
                      type="number"
                      min={1}
                      value={recCount}
                      onChange={(e) => setRecCount(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-sm"
                    />
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        value={recProdAmt}
                        onChange={(e) => setRecProdAmt(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-sm"
                      />
                      <input
                        type="text"
                        value={recProdUnit}
                        onChange={(e) => setRecProdUnit(e.target.value)}
                        placeholder="unit"
                        className="w-24 px-2 py-2.5 rounded-xl border border-[#D4DDD2] text-xs"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Value / Cost (ZAR)</label>
                  <input
                    type="number"
                    min={0}
                    value={recValueZar}
                    onChange={(e) => setRecValueZar(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-semibold">Notes</label>
                <textarea
                  rows={2}
                  value={recNotes}
                  onChange={(e) => setRecNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRecordTarget(null)}
                  className="px-4 py-2 rounded-xl border border-[#D4DDD2] text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRec}
                  className="px-5 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
                >
                  {savingRec ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Livestock Ledger History Modal */}
      {historyGroup && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E6DF] rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#143326]">
                Records Ledger — {historyGroup.groupName}
              </h3>
              <button
                type="button"
                onClick={() => setHistoryGroup(null)}
                className="p-1.5 rounded-lg hover:bg-[#F1F3EF] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto divide-y divide-[#E2E6DF] flex-1">
              {historyRecords.length === 0 ? (
                <p className="text-sm text-[#4A5A50] py-6">No records logged yet.</p>
              ) : (
                historyRecords.map((r) => (
                  <div key={r.id} className="py-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="font-semibold text-[#143326]">{r.recordType}</span>
                      <span className="font-mono text-xs text-[#4A5A50]">{r.recordDate}</span>
                    </div>
                    {r.notes && <p className="text-xs text-[#35443B]">{r.notes}</p>}
                    <p className="font-mono text-xs text-[#2D6A4F]">
                      {r.quantityChange !== 0
                        ? `Head change: ${r.quantityChange > 0 ? '+' : ''}${r.quantityChange}`
                        : ''}
                      {r.productionAmount > 0
                        ? ` Output: ${r.productionAmount} ${r.productionUnit}`
                        : ''}
                      {r.valueZar > 0 ? ` · R ${r.valueZar.toLocaleString()}` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Mixed Farming Log Modal */}
      {showMixedModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E6DF] rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#143326]">
                Log Mixed Farming Activity
              </h3>
              <button
                type="button"
                onClick={() => setShowMixedModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#F1F3EF] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMixed} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Farm</label>
                  <select
                    value={mFarmId}
                    onChange={(e) => setMFarmId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                  >
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Category</label>
                  <select
                    value={mCategory}
                    onChange={(e) => setMCategory(e.target.value as MixedEntryCategory)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                  >
                    {MIXED_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-sm font-semibold">Description / Title</label>
                  <input
                    type="text"
                    required
                    value={mTitle}
                    onChange={(e) => setMTitle(e.target.value)}
                    placeholder="e.g. Lucerne hay baled for cattle"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Date</label>
                  <input
                    type="date"
                    value={mDate}
                    onChange={(e) => setMDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Expense (ZAR)</label>
                  <input
                    type="number"
                    min={0}
                    value={mExpense}
                    onChange={(e) => setMExpense(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Production Qty</label>
                  <input
                    type="number"
                    min={0}
                    value={mProdQty}
                    onChange={(e) => setMProdQty(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold">Water (Liters)</label>
                  <input
                    type="number"
                    min={0}
                    value={mWaterLiters}
                    onChange={(e) => setMWaterLiters(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-semibold">Unit & Notes</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mProdUnit}
                    onChange={(e) => setMProdUnit(e.target.value)}
                    placeholder="kg / bales"
                    className="w-28 px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                  <input
                    type="text"
                    value={mNotes}
                    onChange={(e) => setMNotes(e.target.value)}
                    placeholder="Additional notes..."
                    className="flex-1 px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowMixedModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#D4DDD2] text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMixed}
                  className="px-5 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
                >
                  {savingMixed ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
