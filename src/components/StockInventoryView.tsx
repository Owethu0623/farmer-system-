import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownUp,
  Beef,
  Calculator,
  CheckCircle2,
  Edit3,
  History,
  Info,
  Package,
  Sprout,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  enqueueOfflineMutation,
  getOfflineStaleness,
  isLikelyOfflineError,
  loadOfflineBundle,
} from '../lib/offlineSync';
import { getSastDateString } from '../lib/saTime';
import {
  CropStockMovementType,
  CropStockRow,
  FarmItem,
  LivestockRecordType,
  LivestockStockRow,
  StockOverviewPayload,
} from '../types';

interface StockInventoryViewProps {
  userId?: string;
  farms: FarmItem[];
  selectedFarmId: string | null;
  onSelectFarm: (farmId: string | null) => void;
  onDataChanged: () => void;
}

const MOVEMENT_TYPE_LABELS: Record<CropStockMovementType, string> = {
  planting: 'Additional Planting (+plants)',
  damage: 'Crop Damage (-remaining plants)',
  harvest: 'Harvest (+kg production & storage)',
  storage_in: 'Into Storage (+kg)',
  sale: 'Produce Sale (-stored kg)',
  spoilage: 'Storage Spoilage / Loss (-stored kg)',
  adjustment: 'Manual Stock Audit Adjustment',
};

export const StockInventoryView: React.FC<StockInventoryViewProps> = ({
  userId,
  farms,
  selectedFarmId,
  onSelectFarm,
  onDataChanged,
}) => {
  const [overview, setOverview] = useState<StockOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isCacheStale, setIsCacheStale] = useState(false);
  const [ledgerTab, setLedgerTab] = useState<'crops' | 'livestock'>('crops');

  // Price editing modal
  const [priceModal, setPriceModal] = useState<{
    farmId: string;
    entityType: 'crop_plant' | 'crop_harvest' | 'livestock';
    entityId: string;
    title: string;
    unitLabel: string;
    currentPrice: number;
    currentSource: string;
  } | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [priceSourceInput, setPriceSourceInput] = useState('');

  // Crop movement modal
  const [moveCrop, setMoveCrop] = useState<CropStockRow | null>(null);
  const [moveType, setMoveType] = useState<CropStockMovementType>('sale');
  const [moveDate, setMoveDate] = useState(getSastDateString());
  const [moveQty, setMoveQty] = useState('');
  const [moveUnit, setMoveUnit] = useState('kg');
  const [movePrice, setMovePrice] = useState('');
  const [moveNotes, setMoveNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Livestock movement modal
  const [moveLivestock, setMoveLivestock] = useState<LivestockStockRow | null>(null);
  const [lvkRecType, setLvkRecType] = useState<LivestockRecordType>('Sale');
  const [lvkRecDate, setLvkRecDate] = useState(getSastDateString());
  const [lvkCount, setLvkCount] = useState('1');
  const [lvkProdAmount, setLvkProdAmount] = useState('0');
  const [lvkProdUnit, setLvkProdUnit] = useState('eggs');
  const [lvkValueZar, setLvkValueZar] = useState('0');
  const [lvkNotes, setLvkNotes] = useState('');

  const loadStockOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = selectedFarmId ? `?farmId=${encodeURIComponent(selectedFarmId)}` : '';
      const data = await apiRequest<StockOverviewPayload>(`/api/stock/overview${qs}`);
      setOverview(data);
      setCachedAt(null);
      setIsCacheStale(false);
    } catch (err: unknown) {
      if (userId && isLikelyOfflineError(err)) {
        const bundle = await loadOfflineBundle(userId);
        if (bundle?.stockOverview) {
          const staleness = getOfflineStaleness(bundle);
          const raw = bundle.stockOverview;
          const cropStocks = selectedFarmId
            ? raw.cropStocks.filter((c) => c.farmId === selectedFarmId)
            : raw.cropStocks;
          const livestockStocks = selectedFarmId
            ? raw.livestockStocks.filter((l) => l.farmId === selectedFarmId)
            : raw.livestockStocks;
          const cropMovements = selectedFarmId
            ? raw.cropMovements.filter((m) => m.farmId === selectedFarmId)
            : raw.cropMovements;
          const livestockMovements = selectedFarmId
            ? raw.livestockMovements.filter((m) => m.farmId === selectedFarmId)
            : raw.livestockMovements;
          const totalCropStockValueZar = Number(
            cropStocks.reduce((s, r) => s + r.remainingStandingValueZar, 0).toFixed(2)
          );
          const totalLivestockValueZar = Number(
            livestockStocks.reduce((s, r) => s + r.remainingValueZar, 0).toFixed(2)
          );
          const totalHarvestValueZar = Number(
            cropStocks.reduce((s, r) => s + r.estimatedHarvestValueZar, 0).toFixed(2)
          );
          const totalStoredProductionValueZar = Number(
            cropStocks.reduce((s, r) => s + r.storedStockValueZar, 0).toFixed(2)
          );
          const totalDamagedStockValueZar = Number(
            (
              cropStocks.reduce((s, r) => s + r.damagedStockValueZar, 0) +
              livestockStocks.reduce((s, r) => s + r.deathLossValueZar, 0)
            ).toFixed(2)
          );
          const totalRemainingStockValueZar = Number(
            (totalCropStockValueZar + totalStoredProductionValueZar + totalLivestockValueZar).toFixed(2)
          );
          const netStockValueChangeZar = Number(
            (
              cropStocks.reduce((s, r) => s + r.netStockValueChangeZar, 0) +
              livestockStocks.reduce((s, r) => s + r.netValueChangeZar, 0)
            ).toFixed(2)
          );
          setOverview({
            ...raw,
            totals: {
              totalCropStockValueZar,
              totalLivestockValueZar,
              totalHarvestValueZar,
              totalStoredProductionValueZar,
              totalDamagedStockValueZar,
              totalRemainingStockValueZar,
              netStockValueChangeZar,
              totalPlantedUnits: cropStocks.reduce((s, r) => s + r.originalPlantedQty, 0),
              totalDamagedUnits: cropStocks.reduce((s, r) => s + r.damagedPlants, 0),
              totalRemainingUnits: cropStocks.reduce((s, r) => s + r.remainingPlants, 0),
              totalLivestockHead: livestockStocks.reduce((s, r) => s + r.currentQuantity, 0),
            },
            cropStocks,
            livestockStocks,
            cropMovements,
            livestockMovements,
          });
          setCachedAt(bundle.downloadedAt);
          setIsCacheStale(staleness.isBundleStale);
          setSuccessMsg(
            `Offline mode: viewing cached stock snapshot from ${new Date(
              bundle.downloadedAt
            ).toLocaleString()}. New movements will queue for sync.`
          );
          return;
        }
      }
      setError(err instanceof Error ? err.message : 'Unable to load stock & valuation data.');
    } finally {
      setLoading(false);
    }
  }, [selectedFarmId, userId]);

  useEffect(() => {
    loadStockOverview();
  }, [loadStockOverview]);

  const handleOpenCropMovement = (row: CropStockRow, defaultType: CropStockMovementType = 'sale') => {
    setMoveCrop(row);
    setMoveType(defaultType);
    setMoveDate(getSastDateString());
    setMoveQty('');
    const isPlantMove = defaultType === 'damage' || defaultType === 'planting';
    setMoveUnit(isPlantMove ? 'plants' : 'kg');
    setMovePrice(
      String(isPlantMove ? row.plantUnitPriceZar : row.harvestUnitPriceZar)
    );
    setMoveNotes('');
  };

  const handleSubmitPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceModal) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/api/stock/prices', {
        method: 'PUT',
        body: JSON.stringify({
          farmId: priceModal.farmId,
          entityType: priceModal.entityType,
          entityId: priceModal.entityId,
          unitPriceZar: Number(priceInput) || 0,
          unitLabel: priceModal.unitLabel,
          priceSource: priceSourceInput.trim() || 'Farmer-entered unit price',
        }),
      });
      setPriceModal(null);
      setSuccessMsg('Farmer unit price updated and valuations recalculated.');
      await loadStockOverview();
      onDataChanged();
    } catch (err: unknown) {
      if (isLikelyOfflineError(err)) {
        setError('Updating stock unit prices requires an active internet connection.');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to update price.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveCrop) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/stock/crops/${moveCrop.cropId}/movements`, {
        method: 'POST',
        body: JSON.stringify({
          movementType: moveType,
          movementDate: moveDate,
          quantity: Number(moveQty) || 0,
          unit: moveUnit,
          unitPriceZar: movePrice !== '' ? Number(movePrice) : undefined,
          notes: moveNotes,
        }),
      });
      setMoveCrop(null);
      setSuccessMsg('Stock movement recorded in historical ledger.');
      await loadStockOverview();
      onDataChanged();
    } catch (err: unknown) {
      if (userId && isLikelyOfflineError(err)) {
        await enqueueOfflineMutation({
          userId,
          mutationType: 'crop_stock_movement',
          label: `${moveType} (${moveQty || 0} ${moveUnit}) for ${moveCrop.cropName}`,
          farmId: moveCrop.farmId,
          farmName: moveCrop.farmName,
          payload: {
            cropId: moveCrop.cropId,
            movementType: moveType,
            movementDate: moveDate,
            quantity: Number(moveQty) || 0,
            unit: moveUnit,
            unitPriceZar: movePrice !== '' ? Number(movePrice) : undefined,
            notes: moveNotes,
          },
        });
        setMoveCrop(null);
        setSuccessMsg('Offline: stock movement saved locally and queued for synchronisation.');
        onDataChanged();
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to record stock movement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenLivestockMovement = (row: LivestockStockRow) => {
    setMoveLivestock(row);
    setLvkRecType('Sale');
    setLvkRecDate(getSastDateString());
    setLvkCount('1');
    setLvkProdAmount('0');
    setLvkProdUnit(row.animalType === 'Poultry' ? 'eggs' : row.animalType === 'Cattle' ? 'liters' : 'kg');
    setLvkValueZar(String(row.unitPriceZar));
    setLvkNotes('');
  };

  const handleSubmitLivestockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveLivestock) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/api/livestock/${moveLivestock.livestockGroupId}/records`, {
        method: 'POST',
        body: JSON.stringify({
          recordType: lvkRecType,
          recordDate: lvkRecDate,
          count: Number(lvkCount) || 0,
          productionAmount: Number(lvkProdAmount) || 0,
          productionUnit: lvkProdUnit,
          valueZar: Number(lvkValueZar) || 0,
          notes: lvkNotes || `Livestock ${lvkRecType} recorded via Stock & Inventory`,
        }),
      });
      setMoveLivestock(null);
      setSuccessMsg('Livestock movement recorded in historical ledger.');
      await loadStockOverview();
      onDataChanged();
    } catch (err: unknown) {
      if (userId && isLikelyOfflineError(err)) {
        await enqueueOfflineMutation({
          userId,
          mutationType: 'livestock_record',
          label: `${lvkRecType} (${lvkCount || 0} head) for ${moveLivestock.groupName}`,
          farmId: moveLivestock.farmId,
          farmName: moveLivestock.farmName,
          payload: {
            livestockGroupId: moveLivestock.livestockGroupId,
            recordType: lvkRecType,
            recordDate: lvkRecDate,
            count: Number(lvkCount) || 0,
            productionAmount: Number(lvkProdAmount) || 0,
            productionUnit: lvkProdUnit,
            valueZar: Number(lvkValueZar) || 0,
            notes: lvkNotes || `Livestock ${lvkRecType} recorded via Stock & Inventory`,
          },
        });
        setMoveLivestock(null);
        setSuccessMsg('Offline: livestock stock movement saved locally and queued for sync.');
        onDataChanged();
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to record livestock movement.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditPriceForCrop = (row: CropStockRow, kind: 'crop_plant' | 'crop_harvest') => {
    setPriceModal({
      farmId: row.farmId,
      entityType: kind,
      entityId: row.cropId,
      title:
        kind === 'crop_plant'
          ? `${row.cropName} — Standing Plant Unit Price`
          : `${row.cropName} — Harvested Produce Price per kg`,
      unitLabel: kind === 'crop_plant' ? 'plant' : 'kg',
      currentPrice: kind === 'crop_plant' ? row.plantUnitPriceZar : row.harvestUnitPriceZar,
      currentSource: 'Farmer-entered unit price',
    });
    setPriceInput(String(kind === 'crop_plant' ? row.plantUnitPriceZar : row.harvestUnitPriceZar));
    setPriceSourceInput('Farmer-entered local buyer / input cost price');
  };

  const openEditPriceForLivestock = (row: LivestockStockRow) => {
    setPriceModal({
      farmId: row.farmId,
      entityType: 'livestock',
      entityId: row.livestockGroupId,
      title: `${row.groupName} (${row.animalType}) — Unit Value per Head`,
      unitLabel: 'head',
      currentPrice: row.unitPriceZar,
      currentSource: row.priceSource,
    });
    setPriceInput(String(row.unitPriceZar));
    setPriceSourceInput(row.priceSource);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#143326]">
            Agricultural Stock & Inventory Valuation
          </h1>
          <p className="text-sm text-[#4A5A50]">
            Track standing plants, damaged stock, stored harvest, sales, livestock movements, and farmer-entered valuations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#4A5A50]">Filter Farm:</label>
          <select
            value={selectedFarmId || ''}
            onChange={(e) => onSelectFarm(e.target.value || null)}
            className="px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm font-semibold text-[#143326]"
          >
            <option value="">All Accessible Farms</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pricing Transparency & Valuation Date Banner */}
      {cachedAt && (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs ${
            isCacheStale
              ? 'bg-[#FFF6EB] border-[#E6C98A] text-[#7A4A0B]'
              : 'bg-[#EDF5EF] border-[#BFD6C5] text-[#143326]'
          }`}
        >
          <strong>Offline Cached Stock Snapshot ({isCacheStale ? 'Outdated Cache' : 'Saved Locally'}):</strong>{' '}
          Downloaded <span className="font-mono">{new Date(cachedAt).toLocaleString()}</span>.
        </div>
      )}
      {overview && (
        <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-2xl p-4 flex flex-wrap items-start justify-between gap-3 text-xs text-[#143326]">
          <div className="flex items-start gap-2.5 max-w-3xl">
            <Info className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Transparent Farmer-Entered Valuation</p>
              <p className="text-[#2D4B3B] mt-0.5 leading-relaxed">{overview.pricingDisclaimer}</p>
            </div>
          </div>
          <span className="font-mono tabular-nums text-[#1B4332] font-semibold">
            Valuation Date: {new Date(overview.valuationDate).toLocaleString()}
          </span>
        </div>
      )}

      {error && (
        <div className="bg-[#FDF2F2] border border-[#E8B4B4] rounded-xl px-4 py-3 text-sm text-[#8E2424]">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl px-4 py-3 text-sm text-[#143326] flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#1B4332]" />
            {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading || !overview ? (
        <div className="bg-white border border-[#E2E6DF] rounded-2xl p-8 text-center text-sm text-[#4A5A50]">
          Calculating crop, harvest, and livestock inventory valuations...
        </div>
      ) : (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-4">
              <p className="text-xs text-[#4A5A50]">Remaining Stock Value</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
                R{overview.totals.totalRemainingStockValueZar.toLocaleString()}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-[#4A5A50] mt-1">
                Crops + Stored + Livestock
              </p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-4">
              <p className="text-xs text-[#4A5A50]">Crop Stock Value</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#1B4332] mt-1">
                R{overview.totals.totalCropStockValueZar.toLocaleString()}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-[#4A5A50] mt-1">
                {overview.totals.totalRemainingUnits.toLocaleString()} plants left
              </p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-4">
              <p className="text-xs text-[#4A5A50]">Livestock Stock Value</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#1B4332] mt-1">
                R{overview.totals.totalLivestockValueZar.toLocaleString()}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-[#4A5A50] mt-1">
                {overview.totals.totalLivestockHead.toLocaleString()} total head
              </p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-4">
              <p className="text-xs text-[#4A5A50]">Est. Harvest Value</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
                R{overview.totals.totalHarvestValueZar.toLocaleString()}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-[#4A5A50] mt-1">
                Stored: R{overview.totals.totalStoredProductionValueZar.toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-4">
              <p className="text-xs text-[#4A5A50]">Damaged / Loss Value</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#8E2424] mt-1">
                R{overview.totals.totalDamagedStockValueZar.toLocaleString()}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-[#8E2424] mt-1">
                {overview.totals.totalDamagedUnits.toLocaleString()} damaged plants
              </p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-4">
              <p className="text-xs text-[#4A5A50]">Net Value Change</p>
              <p
                className={`font-mono text-xl font-bold tabular-nums mt-1 flex items-center gap-1 ${
                  overview.totals.netStockValueChangeZar >= 0 ? 'text-[#1B4332]' : 'text-[#8E2424]'
                }`}
              >
                {overview.totals.netStockValueChangeZar >= 0 ? (
                  <TrendingUp className="w-4 h-4 shrink-0" />
                ) : (
                  <TrendingDown className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {overview.totals.netStockValueChangeZar >= 0 ? '+' : ''}R
                  {overview.totals.netStockValueChangeZar.toLocaleString()}
                </span>
              </p>
              <p className="text-[11px] text-[#4A5A50] mt-1">From initial stock baseline</p>
            </div>
          </div>

          {/* Crop Stock Valuation & Quantities */}
          <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sprout className="w-5 h-5 text-[#1B4332]" />
              <h2 className="font-display text-lg font-bold text-[#143326]">
                Crop Stock, Harvest Storage & Valuation ({overview.cropStocks.length})
              </h2>
            </div>

            {overview.cropStocks.length === 0 ? (
              <p className="text-sm text-[#4A5A50]">No crops registered under this filter yet.</p>
            ) : (
              <div className="space-y-4">
                {overview.cropStocks.map((row) => (
                  <div
                    key={row.cropId}
                    className="border border-[#E2E6DF] rounded-xl p-4 space-y-3 bg-[#FAFBFA]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display font-bold text-[#143326]">
                          {row.cropName} ({row.cropVariety})
                        </h3>
                        <p className="text-xs text-[#4A5A50]">
                          {row.farmName} · {row.fieldName} · Stage: {row.growthStage}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditPriceForCrop(row, 'crop_plant')}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#D4DDD2] bg-white hover:bg-[#EDF2EC] text-xs font-semibold text-[#143326] flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Plant Price (R{row.plantUnitPriceZar.toFixed(2)})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditPriceForCrop(row, 'crop_harvest')}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#D4DDD2] bg-white hover:bg-[#EDF2EC] text-xs font-semibold text-[#143326] flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Harvest Price (R{row.harvestUnitPriceZar.toFixed(2)}/kg)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenCropMovement(row, 'sale')}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1B4332] text-white hover:bg-[#2D6A4F] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowDownUp className="w-3.5 h-3.5" />
                          <span>Record Movement</span>
                        </button>
                      </div>
                    </div>

                    {/* Quantity & Value Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2 border-t border-[#E2E6DF] text-xs">
                      <div>
                        <p className="text-[#4A5A50]">Original Planted</p>
                        <p className="font-mono font-bold tabular-nums text-[#143326] mt-0.5">
                          {row.originalPlantedQty.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#4A5A50]">Damaged Plants</p>
                        <p className="font-mono font-bold tabular-nums text-[#8E2424] mt-0.5">
                          {row.damagedPlants.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#4A5A50]">Remaining Plants</p>
                        <p className="font-mono font-bold tabular-nums text-[#1B4332] mt-0.5">
                          {row.remainingPlants.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#4A5A50]">Harvested / Stored</p>
                        <p className="font-mono font-bold tabular-nums text-[#143326] mt-0.5">
                          {row.harvestedKg.toLocaleString()} / {row.storedProductionKg.toLocaleString()} kg
                        </p>
                      </div>
                      <div>
                        <p className="text-[#4A5A50]">Sold Qty & Revenue</p>
                        <p className="font-mono font-bold tabular-nums text-[#143326] mt-0.5">
                          {row.soldKg.toLocaleString()} kg (R{row.salesValueZar.toLocaleString()})
                        </p>
                      </div>
                      <div>
                        <p className="text-[#4A5A50]">Remaining + Stored Val</p>
                        <p className="font-mono font-bold tabular-nums text-[#1B4332] mt-0.5">
                          R{(row.remainingStandingValueZar + row.storedStockValueZar).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#4A5A50]">Damaged Loss Val</p>
                        <p className="font-mono font-bold tabular-nums text-[#8E2424] mt-0.5">
                          R{row.damagedStockValueZar.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Explicit Valuation Breakdown (Quantity, Unit Price, Total Value, Valuation Date) */}
                    <div className="bg-white border border-[#E2E6DF] rounded-lg p-3 overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-[#E2E6DF] text-[#4A5A50]">
                            <th className="py-1 pr-3 font-semibold">Valuation Component</th>
                            <th className="py-1 pr-3 font-semibold">Quantity</th>
                            <th className="py-1 pr-3 font-semibold">Unit Price</th>
                            <th className="py-1 pr-3 font-semibold">Total Value</th>
                            <th className="py-1 font-semibold">Valuation Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E6DF] font-mono tabular-nums text-[#143326]">
                          <tr>
                            <td className="py-1.5 pr-3 font-sans font-medium">Standing Crop Stock</td>
                            <td className="py-1.5 pr-3">{row.remainingPlants.toLocaleString()} plants</td>
                            <td className="py-1.5 pr-3">R{row.plantUnitPriceZar.toFixed(2)} / plant</td>
                            <td className="py-1.5 pr-3 font-bold text-[#1B4332]">R{row.remainingStandingValueZar.toLocaleString()}</td>
                            <td className="py-1.5 text-[#4A5A50]">{new Date(row.valuationDate).toLocaleDateString()}</td>
                          </tr>
                          <tr>
                            <td className="py-1.5 pr-3 font-sans font-medium">Stored Production</td>
                            <td className="py-1.5 pr-3">{row.storedProductionKg.toLocaleString()} kg</td>
                            <td className="py-1.5 pr-3">R{row.harvestUnitPriceZar.toFixed(2)} / kg</td>
                            <td className="py-1.5 pr-3 font-bold text-[#1B4332]">R{row.storedStockValueZar.toLocaleString()}</td>
                            <td className="py-1.5 text-[#4A5A50]">{new Date(row.valuationDate).toLocaleDateString()}</td>
                          </tr>
                          <tr>
                            <td className="py-1.5 pr-3 font-sans font-medium">Damaged Stock Loss</td>
                            <td className="py-1.5 pr-3">{row.damagedPlants.toLocaleString()} plants</td>
                            <td className="py-1.5 pr-3">R{row.plantUnitPriceZar.toFixed(2)} / plant</td>
                            <td className="py-1.5 pr-3 font-bold text-[#8E2424]">R{row.damagedStockValueZar.toLocaleString()}</td>
                            <td className="py-1.5 text-[#4A5A50]">{new Date(row.valuationDate).toLocaleDateString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Calculation Assumptions & Price Source */}
                    <div className="text-[11px] text-[#4A5A50] flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E2E6DF]">
                      <span className="flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                        <span>{row.calculationAssumption}</span>
                      </span>
                      <span className="font-mono">Price source: {row.priceSource}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Livestock Stock & Valuation */}
          <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Beef className="w-5 h-5 text-[#1B4332]" />
              <h2 className="font-display text-lg font-bold text-[#143326]">
                Livestock Herd, Flock & Production Valuation ({overview.livestockStocks.length})
              </h2>
            </div>

            {overview.livestockStocks.length === 0 ? (
              <p className="text-sm text-[#4A5A50]">No livestock groups registered under this filter.</p>
            ) : (
              <div className="space-y-4">
                {overview.livestockStocks.map((row) => (
                  <div
                    key={row.livestockGroupId}
                    className="border border-[#E2E6DF] rounded-xl p-4 space-y-3 bg-[#FAFBFA]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display font-bold text-[#143326]">
                          {row.groupName} — {row.animalType} ({row.breed})
                        </h3>
                        <p className="text-xs text-[#4A5A50]">
                          {row.farmName} {row.fieldName ? `· ${row.fieldName}` : ''} · Health: {row.healthStatus}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditPriceForLivestock(row)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#D4DDD2] bg-white hover:bg-[#EDF2EC] text-xs font-semibold text-[#143326] flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Unit Price (R{row.unitPriceZar.toLocaleString()}/head)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenLivestockMovement(row)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1B4332] text-white hover:bg-[#2D6A4F] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowDownUp className="w-3.5 h-3.5" />
                          <span>Record Movement</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2 border-t border-[#E2E6DF] text-xs">
                      <div>
                        <p className="text-[#4A5A50]">Current Herd/Flock</p>
                        <p className="font-mono font-bold tabular-nums text-[#143326] mt-0.5">
                          {row.currentQuantity.toLocaleString()} head
                        </p>
                      </div>
                      <div>
                        <p className="text-[#4A5A50]">Births / Purchases</p>
                        <p className="font-mono font-bold tabular-nums text-[#1B4332] mt-0.5">
                          +{row.births} / +{row.purchases}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#4A5A50]">Deaths / Sales</p>
                        <p className="font-mono font-bold tabular-nums text-[#8E2424] mt-0.5">
                          -{row.deaths} / -{row.sales}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#4A5A50]">Production Logged</p>
                        <p className="font-mono font-bold tabular-nums text-[#143326] mt-0.5">
                          {row.productionTotal.toLocaleString()} {row.productionUnit}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#4A5A50]">Unit Price / Total</p>
                        <p className="font-mono font-bold tabular-nums text-[#1B4332] mt-0.5">
                          R{row.unitPriceZar.toLocaleString()} · R{row.remainingValueZar.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#4A5A50]">Mortality Loss Val</p>
                        <p className="font-mono font-bold tabular-nums text-[#8E2424] mt-0.5">
                          R{row.deathLossValueZar.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#4A5A50]">Net Value Change</p>
                        <p
                          className={`font-mono font-bold tabular-nums mt-0.5 ${
                            row.netValueChangeZar >= 0 ? 'text-[#1B4332]' : 'text-[#8E2424]'
                          }`}
                        >
                          {row.netValueChangeZar >= 0 ? '+' : ''}R{row.netValueChangeZar.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#4A5A50] pt-2 border-t border-[#E2E6DF] flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                        <span>{row.calculationAssumption}</span>
                      </span>
                      <span className="font-mono">
                        Valuation Date: {new Date(row.valuationDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Historical Stock Movements Ledger */}
          <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#1B4332]" />
                <h2 className="font-display text-lg font-bold text-[#143326]">
                  Immutable Historical Stock Movements
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLedgerTab('crops')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                    ledgerTab === 'crops'
                      ? 'bg-[#1B4332] text-white border-[#1B4332]'
                      : 'bg-white text-[#17201B] border-[#D4DDD2]'
                  }`}
                >
                  Crop Movements ({overview.cropMovements.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTab('livestock')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                    ledgerTab === 'livestock'
                      ? 'bg-[#1B4332] text-white border-[#1B4332]'
                      : 'bg-white text-[#17201B] border-[#D4DDD2]'
                  }`}
                >
                  Livestock Movements ({overview.livestockMovements.length})
                </button>
              </div>
            </div>

            {ledgerTab === 'crops' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E6DF] text-[#4A5A50]">
                      <th className="py-2 pr-3 font-semibold">Date</th>
                      <th className="py-2 pr-3 font-semibold">Crop / Farm</th>
                      <th className="py-2 pr-3 font-semibold">Movement</th>
                      <th className="py-2 pr-3 font-semibold">Delta</th>
                      <th className="py-2 pr-3 font-semibold">Unit Price / Total</th>
                      <th className="py-2 pr-3 font-semibold">Remaining / Stored</th>
                      <th className="py-2 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E6DF]">
                    {overview.cropMovements.map((m) => (
                      <tr key={m.id}>
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-[#4A5A50]">
                          {m.movementDate}
                        </td>
                        <td className="py-2.5 pr-3">
                          <p className="font-semibold text-[#143326]">{m.cropName}</p>
                          <p className="text-[11px] text-[#4A5A50]">{m.farmName}</p>
                        </td>
                        <td className="py-2.5 pr-3 font-semibold text-[#17201B] capitalize">
                          {m.movementType.replace('_', ' ')}
                        </td>
                        <td
                          className={`py-2.5 pr-3 font-mono font-bold tabular-nums ${
                            m.quantityDelta < 0 ? 'text-[#8E2424]' : 'text-[#1B4332]'
                          }`}
                        >
                          {m.quantityDelta > 0 ? '+' : ''}
                          {m.quantityDelta.toLocaleString()} {m.unit}
                        </td>
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-[#143326]">
                          R{m.unitPriceZar.toFixed(2)} · R{m.totalValueZar.toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-[#35443B]">
                          {m.resultingRemainingPlants !== null
                            ? `${m.resultingRemainingPlants.toLocaleString()} plants`
                            : '—'}{' '}
                          / {m.resultingStoredKg !== null ? `${m.resultingStoredKg.toLocaleString()} kg` : '—'}
                        </td>
                        <td className="py-2.5 text-[#35443B]">{m.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E6DF] text-[#4A5A50]">
                      <th className="py-2 pr-3 font-semibold">Date</th>
                      <th className="py-2 pr-3 font-semibold">Group / Farm</th>
                      <th className="py-2 pr-3 font-semibold">Type</th>
                      <th className="py-2 pr-3 font-semibold">Head Change</th>
                      <th className="py-2 pr-3 font-semibold">Production</th>
                      <th className="py-2 pr-3 font-semibold">Value</th>
                      <th className="py-2 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E6DF]">
                    {overview.livestockMovements.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-[#4A5A50]">
                          {r.recordDate}
                        </td>
                        <td className="py-2.5 pr-3">
                          <p className="font-semibold text-[#143326]">{r.groupName}</p>
                          <p className="text-[11px] text-[#4A5A50]">{r.farmName}</p>
                        </td>
                        <td className="py-2.5 pr-3 font-semibold text-[#17201B]">{r.recordType}</td>
                        <td
                          className={`py-2.5 pr-3 font-mono font-bold tabular-nums ${
                            r.quantityChange < 0 ? 'text-[#8E2424]' : 'text-[#1B4332]'
                          }`}
                        >
                          {r.quantityChange > 0 ? `+${r.quantityChange}` : r.quantityChange}
                        </td>
                        <td className="py-2.5 pr-3 font-mono tabular-nums">
                          {r.productionAmount > 0 ? `${r.productionAmount} ${r.productionUnit}` : '—'}
                        </td>
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-[#143326]">
                          R{r.valueZar.toLocaleString()}
                        </td>
                        <td className="py-2.5 text-[#35443B]">{r.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Edit Farmer Unit Price Modal */}
      {priceModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitPrice}
            className="bg-white border border-[#E2E6DF] rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#143326]">
                Set Farmer Unit Price
              </h3>
              <button type="button" onClick={() => setPriceModal(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-[#4A5A50]" />
              </button>
            </div>
            <p className="text-xs text-[#4A5A50]">{priceModal.title}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                  Unit Price (ZAR per {priceModal.unitLabel})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                  Price Basis / Buyer Note
                </label>
                <input
                  type="text"
                  value={priceSourceInput}
                  onChange={(e) => setPriceSourceInput(e.target.value)}
                  placeholder="E.g. Farmer local abattoir quote / packhouse buyer contract"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPriceModal(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#D4DDD2] text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
              >
                Save Unit Price
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Record Crop Stock Movement Modal */}
      {moveCrop && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitMovement}
            className="bg-white border border-[#E2E6DF] rounded-2xl max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#143326] flex items-center gap-2">
                <Package className="w-5 h-5 text-[#1B4332]" />
                <span>Record Crop Stock Movement</span>
              </h3>
              <button type="button" onClick={() => setMoveCrop(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-[#4A5A50]" />
              </button>
            </div>
            <p className="text-xs text-[#4A5A50]">
              {moveCrop.cropName} ({moveCrop.cropVariety}) · Remaining plants:{' '}
              <span className="font-mono font-bold text-[#143326]">
                {moveCrop.remainingPlants.toLocaleString()}
              </span>{' '}
              · Stored kg:{' '}
              <span className="font-mono font-bold text-[#143326]">
                {moveCrop.storedProductionKg.toLocaleString()} kg
              </span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                  Movement Type
                </label>
                <select
                  value={moveType}
                  onChange={(e) => {
                    const nextType = e.target.value as CropStockMovementType;
                    setMoveType(nextType);
                    const isPlant = nextType === 'damage' || nextType === 'planting';
                    setMoveUnit(isPlant ? 'plants' : 'kg');
                    setMovePrice(
                      String(isPlant ? moveCrop.plantUnitPriceZar : moveCrop.harvestUnitPriceZar)
                    );
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm font-semibold"
                >
                  {(Object.keys(MOVEMENT_TYPE_LABELS) as CropStockMovementType[]).map((mt) => (
                    <option key={mt} value={mt}>
                      {MOVEMENT_TYPE_LABELS[mt]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={moveDate}
                    onChange={(e) => setMoveDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={moveType === 'adjustment' ? undefined : '0.01'}
                    step="0.01"
                    required
                    value={moveQty}
                    onChange={(e) => setMoveQty(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Unit</label>
                  <input
                    type="text"
                    required
                    value={moveUnit}
                    onChange={(e) => setMoveUnit(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                  Unit Price (ZAR per {moveUnit})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={movePrice}
                  onChange={(e) => setMovePrice(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Notes</label>
                <input
                  type="text"
                  required
                  value={moveNotes}
                  onChange={(e) => setMoveNotes(e.target.value)}
                  placeholder="Buyer name, storage shed, or field block reference..."
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMoveCrop(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#D4DDD2] text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
              >
                Record Movement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Record Livestock Stock Movement Modal */}
      {moveLivestock && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitLivestockMovement}
            className="bg-white border border-[#E2E6DF] rounded-2xl max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#143326] flex items-center gap-2">
                <Beef className="w-5 h-5 text-[#1B4332]" />
                <span>Record Livestock Stock Movement</span>
              </h3>
              <button type="button" onClick={() => setMoveLivestock(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-[#4A5A50]" />
              </button>
            </div>
            <p className="text-xs text-[#4A5A50]">
              {moveLivestock.groupName} ({moveLivestock.animalType} · {moveLivestock.breed}) · Current Herd:{' '}
              <span className="font-mono font-bold text-[#143326]">
                {moveLivestock.currentQuantity.toLocaleString()} head
              </span>
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                    Movement Type
                  </label>
                  <select
                    value={lvkRecType}
                    onChange={(e) => {
                      const next = e.target.value as LivestockRecordType;
                      setLvkRecType(next);
                      if (next === 'Production' || next === 'Veterinary' || next === 'Feeding' || next === 'Vaccination') {
                        setLvkCount('0');
                      } else {
                        setLvkCount('1');
                        setLvkValueZar(String(moveLivestock.unitPriceZar));
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm font-semibold"
                  >
                    <option value="Birth">Birth (+head)</option>
                    <option value="Purchase">Purchase (+head)</option>
                    <option value="Sale">Sale (-head)</option>
                    <option value="Death">Death (-head)</option>
                    <option value="Transfer">Transfer (-head)</option>
                    <option value="Production">Production (eggs / milk / wool)</option>
                    <option value="Veterinary">Veterinary Treatment</option>
                    <option value="Vaccination">Vaccination</option>
                    <option value="Feeding">Feeding Log</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={lvkRecDate}
                    onChange={(e) => setLvkRecDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                    Head Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={lvkCount}
                    onChange={(e) => {
                      setLvkCount(e.target.value);
                      const c = Number(e.target.value) || 0;
                      if (c > 0 && ['Sale', 'Purchase', 'Birth', 'Death'].includes(lvkRecType)) {
                        setLvkValueZar(String(c * moveLivestock.unitPriceZar));
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                    Production Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={lvkProdAmount}
                    onChange={(e) => setLvkProdAmount(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                    Prod. Unit
                  </label>
                  <input
                    type="text"
                    value={lvkProdUnit}
                    onChange={(e) => setLvkProdUnit(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                  Total Value / Cost (ZAR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={lvkValueZar}
                  onChange={(e) => setLvkValueZar(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Notes</label>
                <input
                  type="text"
                  required
                  value={lvkNotes}
                  onChange={(e) => setLvkNotes(e.target.value)}
                  placeholder="Auction buyer, newborn tag IDs, vet reference, or daily yield..."
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMoveLivestock(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#D4DDD2] text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
              >
                Record Movement
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
