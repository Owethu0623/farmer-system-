import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Beef,
  BookOpen,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  CloudRain,
  Compass,
  FileSpreadsheet,
  Filter,
  Layers,
  MapPin,
  Package,
  Plus,
  Sparkles,
  Sprout,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { getOfflineStaleness, isLikelyOfflineError, loadOfflineBundle } from '../lib/offlineSync';
import {
  AuthUser,
  ExistingFarmerDashboardPayload,
  FarmItem,
  LanguageCode,
  ProspectiveDashboardPayload,
  ProvinceInfo,
} from '../types';
import { SpeakButton } from './AccessibilityControls';

interface RoleDashboardProps {
  user: AuthUser;
  farms: FarmItem[];
  selectedFarmId: string | null;
  onSelectFarm: (id: string) => void;
  onOpenFarmsView: () => void;
  onOpenCropsView: () => void;
  onOpenLivestockView: () => void;
  onOpenMixedView: () => void;
  onOpenSoilLandView: () => void;
  onOpenWeatherView: () => void;
  onOpenVisualView: () => void;
  onOpenStockView: () => void;
  onOpenIncidentsView: () => void;
  onOpenPlannerView: () => void;
  onOpenLearningView: () => void;
  onOpenAdvisorView: () => void;
  onOpenReportsView?: () => void;
  refreshKey: number;
  provinces: ProvinceInfo[];
  languageCode: LanguageCode;
  isSpeaking: boolean;
  speechSupported: boolean;
  onSpeak: (txt: string) => void;
  onStopSpeaking: () => void;
}

type AnalyticsTab = 'production' | 'stock_finance' | 'damage_weather' | 'comparisons';

const ACTION_TAB_LABELS: Record<string, string> = {
  farms: 'Farms & Map',
  crops: 'Crops',
  livestock: 'Livestock',
  soil: 'Soil & Land',
  weather: 'Weather',
  visual: 'Visual Analysis',
  stock: 'Stock & Valuation',
  incidents: 'Incidents',
  planner: 'Business Planner',
  learning: 'Learning Centre',
  advisor: 'AI Assistant',
};

export const RoleDashboard: React.FC<RoleDashboardProps> = ({
  user,
  farms,
  selectedFarmId,
  onSelectFarm,
  onOpenFarmsView,
  onOpenCropsView,
  onOpenLivestockView,
  onOpenMixedView,
  onOpenSoilLandView,
  onOpenWeatherView,
  onOpenVisualView,
  onOpenStockView,
  onOpenIncidentsView,
  onOpenPlannerView,
  onOpenLearningView,
  onOpenAdvisorView,
  onOpenReportsView,
  refreshKey,
  provinces,
  languageCode,
  isSpeaking,
  speechSupported,
  onSpeak,
  onStopSpeaking,
}) => {
  // Dashboard filters (Existing / Expert / Org)
  const [filterFarmId, setFilterFarmId] = useState<string>('all');
  const [filterFieldId, setFilterFieldId] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('production');

  // Prospective filter & add location form
  const [prospectiveProvince, setProspectiveProvince] = useState<string>(
    user.profile?.province || provinces[0]?.name || 'KwaZulu-Natal'
  );
  const [showAddLoc, setShowAddLoc] = useState(false);
  const [locProvince, setLocProvince] = useState(user.profile?.province || 'KwaZulu-Natal');
  const [locDistrict, setLocDistrict] = useState('');
  const [locTown, setLocTown] = useState('');
  const [locHectares, setLocHectares] = useState('2');
  const [locWater, setLocWater] = useState('Borehole / River Access');
  const [locNotes, setLocNotes] = useState('');
  const [locSaving, setLocSaving] = useState(false);

  const [existingPayload, setExistingPayload] = useState<ExistingFarmerDashboardPayload | null>(null);
  const [prospectivePayload, setProspectivePayload] = useState<ProspectiveDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isCacheStale, setIsCacheStale] = useState(false);

  const availableFields = useMemo(() => {
    if (filterFarmId === 'all') {
      return farms.flatMap((f) => f.fields.map((fl) => ({ ...fl, farmName: f.name })));
    }
    const target = farms.find((f) => f.id === filterFarmId);
    return target ? target.fields.map((fl) => ({ ...fl, farmName: target.name })) : [];
  }, [farms, filterFarmId]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (user.roleCode === 'prospective_farmer') {
        if (prospectiveProvince) qs.set('province', prospectiveProvince);
        const data = await apiRequest<ProspectiveDashboardPayload>(
          `/api/dashboard/overview?${qs.toString()}`
        );
        setProspectivePayload(data);
      } else {
        if (filterFarmId) qs.set('farmId', filterFarmId);
        if (filterFieldId) qs.set('fieldId', filterFieldId);
        if (filterStartDate) qs.set('startDate', filterStartDate);
        if (filterEndDate) qs.set('endDate', filterEndDate);
        if (filterCategory) qs.set('category', filterCategory);
        const data = await apiRequest<ExistingFarmerDashboardPayload>(
          `/api/dashboard/overview?${qs.toString()}`
        );
        setExistingPayload(data);
      }
      setCachedAt(null);
      setIsCacheStale(false);
    } catch (err: unknown) {
      if (isLikelyOfflineError(err)) {
        const bundle = await loadOfflineBundle(user.id);
        if (bundle) {
          const staleness = getOfflineStaleness(bundle);
          setCachedAt(bundle.downloadedAt);
          setIsCacheStale(staleness.isBundleStale);
          if (user.roleCode === 'prospective_farmer') {
            const plans = bundle.businessPlans || [];
            const completedGuides = (bundle.learningGuides || []).filter(
              (g) => g.userProgress?.status === 'completed'
            ).length;
            const totalGuides = (bundle.learningGuides || []).length;
            const startups = plans
              .map((p) => p.calculation.estimatedStartupCostsZar)
              .filter((n) => Number.isFinite(n));
            setProspectivePayload({
              mode: 'prospective_farmer',
              overview: {
                savedLocationsCount: 0,
                farmingPlansCount: plans.length,
                estimatedLowestStartupZar: startups.length > 0 ? Math.min(...startups) : null,
                learningCompletedCount: completedGuides,
                learningTotalCount: totalGuides,
                learningProgressPercent:
                  totalGuides > 0 ? Math.round((completedGuides / totalGuides) * 100) : 0,
                estimationNotice:
                  'Offline cached snapshot — startup estimates and saved business plans are loaded from local device storage.',
              },
              opportunities: [],
              savedLocations: [],
              landSuitabilityRecommendations: [],
              suggestedActivities: [],
              farmingPlans: plans,
              learningProgress: {
                totalPublished: totalGuides,
                completedCount: completedGuides,
                inProgressCount: (bundle.learningGuides || []).filter(
                  (g) => g.userProgress?.status === 'in_progress'
                ).length,
                savedCount: (bundle.learningGuides || []).filter(
                  (g) => g.userProgress?.isSaved
                ).length,
                overallPercent:
                  totalGuides > 0 ? Math.round((completedGuides / totalGuides) * 100) : 0,
                recentMaterials: (bundle.learningGuides || []).slice(0, 4),
              },
              recommendedNextSteps: [
                {
                  id: 'offline-planner',
                  title: 'Review or Draft Business Plan Offline',
                  detail: 'Create or adjust scenarios and sync automatically when online.',
                  completed: plans.length > 0,
                  actionTab: 'planner',
                  actionLabel: 'Open Planner',
                },
                {
                  id: 'offline-learning',
                  title: 'Read Cached Learning Guides',
                  detail: `${totalGuides} guide(s) stored in your offline pack.`,
                  completed: completedGuides > 0,
                  actionTab: 'learning',
                  actionLabel: 'Open Learning',
                },
              ],
              recentAiInsights: [],
              announcements: [],
            });
            setLoading(false);
            return;
          } else {
            const targetFarms =
              filterFarmId && filterFarmId !== 'all'
                ? bundle.farms.filter((f) => f.id === filterFarmId)
                : bundle.farms;
            const farmIdSet = new Set(targetFarms.map((f) => f.id));
            const crops = (bundle.crops || []).filter(
              (c) => farmIdSet.has(c.farmId) && (filterFieldId === 'all' || c.fieldId === filterFieldId)
            );
            const livestock = (bundle.livestockGroups || []).filter((l) => farmIdSet.has(l.farmId));
            const incidents = (bundle.incidents || []).filter((i) => farmIdSet.has(i.farmId));
            const cropStocks = (bundle.stockOverview?.cropStocks || []).filter((s) =>
              farmIdSet.has(s.farmId)
            );
            const livestockStocks = (bundle.stockOverview?.livestockStocks || []).filter((s) =>
              farmIdSet.has(s.farmId)
            );
            const totalHectares = Number(
              targetFarms.reduce((acc, f) => acc + (f.farmSizeHectares || 0), 0).toFixed(2)
            );
            const cultivatedHectares = Number(
              crops.reduce((acc, c) => acc + (c.cultivatedAreaHectares || 0), 0).toFixed(2)
            );
            const estCropVal = cropStocks.reduce(
              (acc, r) => acc + r.remainingStandingValueZar + r.storedStockValueZar,
              0
            );
            const estLiveVal = livestockStocks.reduce((acc, r) => acc + r.remainingValueZar, 0);
            const firstSnap = bundle.weatherSnapshots?.[0] || null;
            const firstFc = firstSnap?.forecasts?.[0] || null;
            const firstObs = firstSnap?.recentObservations?.[0] || null;

            setExistingPayload({
              mode: 'existing_farmer',
              filtersApplied: {
                farmId: filterFarmId,
                fieldId: filterFieldId,
                startDate: filterStartDate,
                endDate: filterEndDate,
                category: filterCategory,
              },
              overview: {
                registeredFarmsCount: targetFarms.length,
                totalHectares,
                cultivatedHectares,
                grazingHectares: Number(Math.max(0, totalHectares - cultivatedHectares).toFixed(2)),
                farmingTypes: Array.from(
                  new Set(targetFarms.flatMap((f) => f.farmingActivities || []))
                ),
                registeredCropsCount: crops.length,
                totalRemainingPlants: crops.reduce(
                  (acc, c) => acc + Math.max(0, c.plantingQuantity - (c.damagedPlants || 0)),
                  0
                ),
                totalDamagedPlants: crops.reduce((acc, c) => acc + (c.damagedPlants || 0), 0),
                totalStoredCropKg: cropStocks.reduce((acc, r) => acc + r.storedProductionKg, 0),
                totalLivestockQuantity: livestock.reduce((acc, l) => acc + l.quantity, 0),
                activeIncidentsCount: incidents.filter((i) => i.status !== 'resolved').length,
                activeWarningsCount: 0,
                estimatedCropStockValueZar: Math.round(estCropVal),
                estimatedLivestockValueZar: Math.round(estLiveVal),
                estimatedTotalStockValueZar: Math.round(estCropVal + estLiveVal),
                actualRecordedExpensesZar: 0,
                estimationNotice:
                  'Offline cached snapshot — metrics reflect locally saved farm records from your last sync. Fresh weather forecasts, external SoilGrids/ARC data, and online AI require internet.',
              },
              farmsSummary: targetFarms.map((f) => ({
                id: f.id,
                name: f.name,
                province: f.location?.province || 'South Africa',
                district: f.location?.districtMunicipality || 'Local District',
                totalHectares: f.farmSizeHectares || 0,
                fieldCount: f.fields.length,
                farmingTypes: f.farmingActivities || [],
                cropsCount: crops.filter((c) => c.farmId === f.id).length,
                livestockCount: livestock
                  .filter((l) => l.farmId === f.id)
                  .reduce((acc, l) => acc + l.quantity, 0),
                estimatedStockValueZar: Math.round(
                  cropStocks
                    .filter((s) => s.farmId === f.id)
                    .reduce((a, s) => a + s.remainingStandingValueZar + s.storedStockValueZar, 0) +
                    livestockStocks
                      .filter((s) => s.farmId === f.id)
                      .reduce((a, s) => a + s.remainingValueZar, 0)
                ),
                actualExpensesZar: 0,
                activeIncidentsCount: incidents.filter(
                  (i) => i.farmId === f.id && i.status !== 'resolved'
                ).length,
              })),
              registeredCrops: crops.map((c) => ({
                id: c.id,
                farmId: c.farmId,
                farmName: c.farmName || targetFarms.find((f) => f.id === c.farmId)?.name || 'Farm',
                fieldName: c.fieldName || 'Field',
                cropName: c.cropName,
                cropVariety: c.cropVariety,
                growthStage: c.growthStage,
                cultivatedAreaHectares: c.cultivatedAreaHectares,
                remainingPlants: Math.max(0, c.plantingQuantity - (c.damagedPlants || 0)),
                damagedPlants: c.damagedPlants || 0,
                harvestedKg:
                  cropStocks.find((s) => s.cropId === c.id)?.harvestedKg ?? c.harvestedQuantityKg ?? 0,
                storedKg: cropStocks.find((s) => s.cropId === c.id)?.storedProductionKg || 0,
                expectedHarvestingDate: c.expectedHarvestingDate,
                estimatedValueZar:
                  cropStocks.find((s) => s.cropId === c.id)?.remainingStandingValueZar || 0,
              })),
              livestockSummary: {
                byAnimalType: (['Cattle', 'Sheep', 'Goats', 'Pigs', 'Poultry'] as const)
                  .map((animalType) => {
                    const matching = livestock.filter((l) => l.animalType === animalType);
                    return {
                      animalType,
                      quantity: matching.reduce((acc, l) => acc + l.quantity, 0),
                      estimatedValueZar: Number(
                        matching
                          .reduce(
                            (acc, l) =>
                              acc +
                              (livestockStocks.find((s) => s.livestockGroupId === l.id)?.remainingValueZar ??
                                l.quantity * l.estimatedUnitValueZar),
                            0
                          )
                          .toFixed(2)
                      ),
                    };
                  })
                  .filter((row) => row.quantity > 0),
                groups: livestock.map((l) => ({
                  id: l.id,
                  farmId: l.farmId,
                  farmName: l.farmName || targetFarms.find((f) => f.id === l.farmId)?.name || 'Farm',
                  groupName: l.groupName,
                  animalType: l.animalType,
                  breed: l.breed,
                  quantity: l.quantity,
                  healthStatus: l.healthStatus,
                  estimatedValueZar:
                    livestockStocks.find((s) => s.livestockGroupId === l.id)?.remainingValueZar || 0,
                })),
              },
              weatherSummary: {
                farmName: firstSnap?.farmName || targetFarms[0]?.name || 'Farm',
                locationLabel: 'Offline Weather Snapshot',
                forecastSummary: firstFc
                  ? `Cached ${firstFc.forecastDate}: ${firstFc.weatherDescription}, ${firstFc.predictedRainfallMm} mm expected.`
                  : 'Connect to the internet to fetch fresh weather forecasts.',
                latestTemperatureC: firstFc ? firstFc.predictedTempMaxC : null,
                latestRainForecastMm: firstFc ? firstFc.predictedRainfallMm : null,
                latestFarmerReport: firstObs,
                activeWarnings: [],
              },
              upcomingActivities: [],
              recentIncidents: incidents.slice(0, 6),
              recentAiInsights: [],
              recommendedNextActions: [
                {
                  id: 'offline-act',
                  priority: 'normal',
                  title: 'Record Activities or Incidents Offline',
                  reason: 'Any crop, livestock, stock, or incident logs you save offline will queue for sync.',
                  actionTab: 'incidents',
                  actionLabel: 'Open Incidents',
                },
              ],
              analytics: {
                cropPerformance: cropStocks.map((s) => ({
                  label: s.cropName,
                  plantedQty: s.originalPlantedQty,
                  remainingQty: s.remainingPlants,
                  damagedQty: s.damagedPlants,
                  harvestedKg: s.harvestedKg,
                  estimatedValueZar: s.remainingStandingValueZar,
                })),
                livestockPerformance: (['Cattle', 'Sheep', 'Goats', 'Pigs', 'Poultry'] as const)
                  .map((animalType) => {
                    const matchingStocks = livestockStocks.filter((s) => s.animalType === animalType);
                    const matchingGroups = livestock.filter((l) => l.animalType === animalType);
                    const headCount = matchingGroups.reduce((acc, g) => acc + g.quantity, 0);
                    return {
                      animalType,
                      headCount,
                      birthsAndPurchases: matchingStocks.reduce((acc, s) => acc + s.births + s.purchases, 0),
                      deathsAndSales: matchingStocks.reduce((acc, s) => acc + s.deaths + s.sales, 0),
                      estimatedValueZar: Number(
                        matchingStocks.reduce((acc, s) => acc + s.remainingValueZar, 0).toFixed(2)
                      ),
                    };
                  })
                  .filter((r) => r.headCount > 0 || r.birthsAndPurchases > 0 || r.deathsAndSales > 0),
                productionTrends: [],
                stockChanges: [],
                expenseSummaries: {
                  mixedExpensesZar: 0,
                  cropActivityExpensesZar: 0,
                  livestockExpensesZar: 0,
                  totalActualExpensesZar: 0,
                  estimatedPlannedBudgetZar: 0,
                  byCategory: [],
                },
                damageAndLoss: {
                  totalIncidents: incidents.length,
                  activeIncidents: incidents.filter((i) => i.status !== 'resolved').length,
                  affectedPlants: incidents
                    .filter((i) => i.cropId)
                    .reduce((acc, i) => acc + (i.affectedQuantity || 0), 0),
                  affectedLivestock: incidents
                    .filter((i) => i.livestockGroupId)
                    .reduce((acc, i) => acc + (i.affectedQuantity || 0), 0),
                  affectedHectares: Number(
                    incidents.reduce((acc, i) => acc + (i.affectedAreaHectares || 0), 0).toFixed(2)
                  ),
                  estimatedFinancialImpactZar: incidents.reduce(
                    (acc, i) => acc + (i.estimatedFinancialImpactZar || 0),
                    0
                  ),
                  byIncidentType: [],
                },
                weatherImpact: {
                  storedForecastDays: firstSnap?.forecasts?.length || 0,
                  farmerObservationsCount: firstSnap?.recentObservations?.length || 0,
                  avgRainfallVarianceMm: null,
                  weatherIncidentsCount: 0,
                  recentDays: (firstSnap?.forecasts || []).slice(0, 5).map((f) => ({
                    date: f.forecastDate,
                    forecastRainMm: f.predictedRainfallMm,
                    reportedRainMm: null,
                  })),
                },
              },
              announcements: [],
            });
            setLoading(false);
            return;
          }
        }
      }
      setError(err instanceof Error ? err.message : 'Unable to load dashboard overview.');
    } finally {
      setLoading(false);
    }
  }, [
    user.id,
    user.roleCode,
    prospectiveProvince,
    filterFarmId,
    filterFieldId,
    filterStartDate,
    filterEndDate,
    filterCategory,
  ]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, refreshKey]);

  const navigateActionTab = (tab: string) => {
    switch (tab) {
      case 'farms':
        onOpenFarmsView();
        break;
      case 'crops':
        onOpenCropsView();
        break;
      case 'livestock':
        onOpenLivestockView();
        break;
      case 'soil':
        onOpenSoilLandView();
        break;
      case 'weather':
        onOpenWeatherView();
        break;
      case 'visual':
        onOpenVisualView();
        break;
      case 'stock':
        onOpenStockView();
        break;
      case 'incidents':
        onOpenIncidentsView();
        break;
      case 'planner':
        onOpenPlannerView();
        break;
      case 'learning':
        onOpenLearningView();
        break;
      case 'advisor':
      default:
        onOpenAdvisorView();
        break;
    }
  };

  const handleSaveProspectiveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locTown.trim()) return;
    setLocSaving(true);
    try {
      await apiRequest('/api/prospective/locations', {
        method: 'POST',
        body: JSON.stringify({
          province: locProvince,
          district: locDistrict,
          townOrArea: locTown,
          intendedHectares: Number(locHectares) || 1,
          waterSourceNote: locWater,
          notes: locNotes,
        }),
      });
      setLocDistrict('');
      setLocTown('');
      setLocNotes('');
      setShowAddLoc(false);
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save candidate location.');
    } finally {
      setLocSaving(false);
    }
  };

  const handleDeleteProspectiveLocation = async (id: string) => {
    try {
      await apiRequest(`/api/prospective/locations/${id}`, { method: 'DELETE' });
      await loadDashboard();
    } catch {
      // ignore
    }
  };

  // =========================================================================
  // 1. PROSPECTIVE FARMER DASHBOARD
  // =========================================================================
  if (user.roleCode === 'prospective_farmer') {
    const pd = user.profile?.prospectiveData;
    const data = prospectivePayload;

    return (
      <div className="space-y-6">
        {data && data.announcements.length > 0 && (
          <div className="space-y-2">
            {data.announcements.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border px-4 py-3 text-sm ${
                  a.severity === 'warning'
                    ? 'bg-[#FFF6EB] border-[#F0D3A8] text-[#6B440B]'
                    : 'bg-[#EDF5EF] border-[#BFD6C5] text-[#143326]'
                }`}
              >
                <span className="font-semibold">{a.title}:</span> {a.message}
              </div>
            ))}
          </div>
        )}

        <div className="bg-[#143326] text-white rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-mono uppercase tracking-wider text-[#B7DEC4]">
                Prospective Farmer · {user.profile?.province || 'South Africa'}
              </p>
              {user.isDemonstration && (
                <span className="px-2 py-0.5 rounded bg-[#2D6A4F] text-[#E4F0E7] text-[10px] font-mono uppercase tracking-wider">
                  Demonstration Account
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">
              Welcome, {user.profile?.fullName}
            </h1>
            <p className="text-sm text-[#DCE8DF]">
              Planning {pd?.intendedLandSizeHectares || 2} ha in{' '}
              {pd?.preferredFarmingType || 'Mixed Horticulture'} ·{' '}
              {pd?.landAccessStatus || 'Exploring land options'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <SpeakButton
              text={`Welcome ${user.profile?.fullName}. You have ${
                data?.overview.savedLocationsCount ?? 0
              } saved locations, ${data?.overview.farmingPlansCount ?? 0} farming plans, and ${
                data?.overview.learningProgressPercent ?? 0
              } percent learning progress.`}
              languageCode={languageCode}
              isSpeaking={isSpeaking}
              onSpeak={onSpeak}
              onStop={onStopSpeaking}
              supported={speechSupported}
            />
            <button
              type="button"
              onClick={onOpenPlannerView}
              className="px-4 py-2.5 rounded-xl bg-white text-[#143326] font-semibold text-sm hover:bg-[#EDF2EC] cursor-pointer whitespace-nowrap"
            >
              Business Planner
            </button>
            <button
              type="button"
              onClick={onOpenLearningView}
              className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer whitespace-nowrap"
            >
              Learning Centre
            </button>
            {onOpenReportsView && (
              <button
                type="button"
                onClick={onOpenReportsView}
                className="px-4 py-2.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-sm hover:bg-[#40916C] cursor-pointer whitespace-nowrap"
              >
                Reports
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAdvisorView}
              className="px-4 py-2.5 rounded-xl border border-[#8EB89D] text-white font-semibold text-sm hover:bg-[#1B4332] cursor-pointer whitespace-nowrap"
            >
              AI Advisor
            </button>
          </div>
        </div>

        {cachedAt && (
          <div
            className={`rounded-xl border px-4 py-3 text-xs sm:text-sm ${
              isCacheStale
                ? 'bg-[#FFF6EB] border-[#F0D3A8] text-[#6B440B]'
                : 'bg-[#F6F7F4] border-[#D4DDD2] text-[#35443B]'
            }`}
          >
            <span className="font-semibold">
              {isCacheStale ? 'Outdated Offline Snapshot' : 'Viewing Saved Offline Snapshot'}
            </span>{' '}
            · Last downloaded <span className="font-mono">{new Date(cachedAt).toLocaleString()}</span>.
            Fresh weather forecasts, external lookups, and online AI analysis require internet connectivity.
          </div>
        )}

        {error && (
          <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Overview Metrics */}
        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Saved Locations (Database)</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#143326] mt-1">
                {data.overview.savedLocationsCount}
              </p>
              <p className="text-xs text-[#4A5A50] mt-0.5">Candidate areas bookmarked</p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Farming Plans (Database)</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#143326] mt-1">
                {data.overview.farmingPlansCount}
              </p>
              <p className="text-xs text-[#4A5A50] mt-0.5">Saved business scenarios</p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Lowest Startup Budget (Estimated)</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#1B4332] mt-1">
                {data.overview.estimatedLowestStartupZar !== null
                  ? `R${data.overview.estimatedLowestStartupZar.toLocaleString()}`
                  : 'No saved plan'}
              </p>
              <p className="text-xs text-[#4A5A50] mt-0.5">
                {data.overview.estimatedLowestStartupZar !== null
                  ? 'Non-guaranteed estimate'
                  : 'Create a plan in Business Planner'}
              </p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Learning Progress</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#143326] mt-1">
                {data.overview.learningProgressPercent}%
              </p>
              <p className="text-xs text-[#2D6A4F] mt-0.5 font-mono tabular-nums">
                {data.overview.learningCompletedCount} / {data.overview.learningTotalCount} guides completed
              </p>
            </div>
          </div>
        )}

        {/* Saved Locations & Land Suitability Recommendations */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-6 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#1B4332]" />
                  <h2 className="font-display text-lg font-bold text-[#143326]">
                    Saved Candidate Locations
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddLoc(!showAddLoc)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showAddLoc ? 'Cancel' : 'Save Location'}</span>
                </button>
              </div>

              {showAddLoc && (
                <form
                  onSubmit={handleSaveProspectiveLocation}
                  className="bg-[#F6F7F4] border border-[#D4DDD2] rounded-xl p-4 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#143326] mb-1">
                        Province
                      </label>
                      <select
                        value={locProvince}
                        onChange={(e) => setLocProvince(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-sm"
                      >
                        {provinces.map((p) => (
                          <option key={p.code} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#143326] mb-1">
                        Town or Area *
                      </label>
                      <input
                        type="text"
                        required
                        value={locTown}
                        onChange={(e) => setLocTown(e.target.value)}
                        placeholder="e.g. Mooi River"
                        className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#143326] mb-1">
                        District Municipality
                      </label>
                      <input
                        type="text"
                        value={locDistrict}
                        onChange={(e) => setLocDistrict(e.target.value)}
                        placeholder="e.g. uMgungundlovu"
                        className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#143326] mb-1">
                        Intended Size (ha)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.1"
                        value={locHectares}
                        onChange={(e) => setLocHectares(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#143326] mb-1">
                        Water Source Note
                      </label>
                      <input
                        type="text"
                        value={locWater}
                        onChange={(e) => setLocWater(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#143326] mb-1">
                        Notes
                      </label>
                      <input
                        type="text"
                        value={locNotes}
                        onChange={(e) => setLocNotes(e.target.value)}
                        placeholder="Lease terms, road access..."
                        className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={locSaving}
                    className="px-4 py-2 rounded-lg bg-[#1B4332] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {locSaving ? 'Saving...' : 'Save Candidate Location'}
                  </button>
                </form>
              )}

              {data.savedLocations.length === 0 ? (
                <p className="text-sm text-[#4A5A50]">
                  No candidate locations saved yet. Click Save Location to bookmark target districts.
                </p>
              ) : (
                <div className="divide-y divide-[#E2E6DF]">
                  {data.savedLocations.map((loc) => (
                    <div key={loc.id} className="py-3.5 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[#143326] text-sm">
                            {loc.townOrArea}, {loc.province}
                          </p>
                          <p className="text-xs text-[#4A5A50]">
                            {loc.district ? `${loc.district} · ` : ''}
                            <span className="font-mono tabular-nums">{loc.intendedHectares} ha</span> ·{' '}
                            {loc.waterSourceNote}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteProspectiveLocation(loc.id)}
                          aria-label="Remove saved location"
                          className="p-1.5 rounded-lg text-[#8E2424] hover:bg-[#FDF2F2] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {loc.suitabilitySummary && (
                        <p className="text-xs text-[#35443B]">{loc.suitabilitySummary}</p>
                      )}
                      {loc.notes && <p className="text-xs text-[#4A5A50]">{loc.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Land Suitability Recommendations */}
            <section className="lg:col-span-6 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#1B4332]" />
                  <h2 className="font-display text-lg font-bold text-[#143326]">
                    Land Suitability Recommendations
                  </h2>
                </div>
                <select
                  value={prospectiveProvince}
                  onChange={(e) => setProspectiveProvince(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#D4DDD2] bg-white text-xs font-semibold"
                >
                  {provinces.map((p) => (
                    <option key={p.code} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                {data.landSuitabilityRecommendations.map((rec) => (
                  <div
                    key={rec.province}
                    className="border border-[#E2E6DF] rounded-xl p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display font-bold text-[#143326]">{rec.province}</p>
                      <span className="text-xs font-mono tabular-nums text-[#2D6A4F]">
                        {rec.annualRainfallMm}
                      </span>
                    </div>
                    <p className="text-xs text-[#4A5A50]">{rec.climateZone}</p>
                    <p className="text-xs text-[#17201B]">
                      Key commodities: {rec.keyCommodities.join(' · ')}
                    </p>
                    <p className="text-xs text-[#35443B] leading-relaxed">
                      {rec.soilAndWaterGuidance}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Farming Opportunities & Suggested Activities */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sprout className="w-5 h-5 text-[#1B4332]" />
                <h2 className="font-display text-lg font-bold text-[#143326]">
                  South African Farming Opportunities
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="border border-[#E2E6DF] rounded-xl p-4 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-[#2D6A4F]">
                        {opp.startupTier} · Min {opp.minHectares} ha
                      </p>
                      <h3 className="font-display text-base font-bold text-[#143326]">
                        {opp.title}
                      </h3>
                      <p className="text-xs text-[#415047] leading-relaxed">{opp.summary}</p>
                    </div>
                    <div className="pt-2 border-t border-[#E2E6DF] text-xs text-[#4A5A50] space-y-0.5">
                      <p>Regions: {opp.province}</p>
                      <p>Water: {opp.waterNeed} · Cycle: {opp.cycleDays}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="lg:col-span-5 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#1B4332]" />
                <h2 className="font-display text-lg font-bold text-[#143326]">
                  Suggested Starter Activities
                </h2>
              </div>
              <div className="space-y-3">
                {data.suggestedActivities.map((act) => (
                  <div key={act.id} className="border border-[#E2E6DF] rounded-xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm text-[#143326]">{act.title}</h3>
                      <span className="text-xs font-mono tabular-nums text-[#2D6A4F]">
                        {act.estimatedStarterScaleHa} ha
                      </span>
                    </div>
                    <p className="text-xs text-[#4A5A50]">
                      {act.category} · {act.estimatedCycle}
                    </p>
                    <p className="text-xs text-[#35443B]">{act.whyItFits}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Farming Plans, Estimated Startup Costs, Learning Progress & Next Steps */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-6 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-[#1B4332]" />
                  <h2 className="font-display text-lg font-bold text-[#143326]">
                    Farming Plans & Estimated Startup Costs
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenPlannerView}
                  className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                >
                  Open Planner →
                </button>
              </div>
              <p className="text-xs text-[#4A5A50]">{data.overview.estimationNotice}</p>
              {data.farmingPlans.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#F6F7F4] text-sm text-[#4A5A50] space-y-2">
                  <p>No saved business scenarios yet.</p>
                  <button
                    type="button"
                    onClick={onOpenPlannerView}
                    className="px-4 py-2 rounded-lg bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
                  >
                    Create Small / Medium / Large Scale Plan
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E6DF]">
                  {data.farmingPlans.map((plan) => (
                    <div key={plan.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-[#143326]">{plan.planName}</p>
                        <p className="text-xs text-[#4A5A50]">
                          {plan.province} · {plan.farmSizeHectares} ha · {plan.scaleTier.replace('_', ' ')}
                        </p>
                      </div>
                      <div className="text-right font-mono text-xs tabular-nums">
                        <p className="font-bold text-[#1B4332]">
                          Est. Startup: R{plan.calculation.estimatedStartupCostsZar.toLocaleString()}
                        </p>
                        <p className="text-[#4A5A50]">
                          Est. Operating: R{plan.calculation.estimatedOperatingCostsZar.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="lg:col-span-6 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#1B4332]" />
                  <h2 className="font-display text-lg font-bold text-[#143326]">
                    Recommended Next Steps & Learning Progress
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenLearningView}
                  className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                >
                  Learning Centre →
                </button>
              </div>
              <div className="space-y-2.5">
                {data.recommendedNextSteps.map((step) => (
                  <div
                    key={step.id}
                    className="border border-[#E2E6DF] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 max-w-md">
                      <CheckCircle2
                        className={`w-5 h-5 shrink-0 mt-0.5 ${
                          step.completed ? 'text-[#1B4332]' : 'text-[#B5C0B8]'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#143326]">{step.title}</p>
                        <p className="text-xs text-[#4A5A50] mt-0.5">{step.detail}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateActionTab(step.actionTab)}
                      className="px-3 py-1.5 rounded-lg bg-[#EDF5EF] text-[#143326] text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      {step.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. EXISTING FARMER / EXPERT / ORGANISATION COMPREHENSIVE DASHBOARD
  // =========================================================================
  const d = existingPayload;
  const roleLabel =
    user.roleCode === 'agricultural_expert'
      ? 'Agricultural Expert Advisory Dashboard'
      : user.roleCode === 'organisation_manager'
      ? 'Organisation Portfolio Dashboard'
      : 'Existing Farmer Operations Dashboard';

  return (
    <div className="space-y-6">
      {d && d.announcements.length > 0 && (
        <div className="space-y-2">
          {d.announcements.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border px-4 py-3 text-sm ${
                a.severity === 'warning'
                  ? 'bg-[#FFF6EB] border-[#F0D3A8] text-[#6B440B]'
                  : 'bg-[#EDF5EF] border-[#BFD6C5] text-[#143326]'
              }`}
            >
              <span className="font-semibold">{a.title}:</span> {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#143326] text-white rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-mono uppercase tracking-wider text-[#B7DEC4]">{roleLabel}</p>
            {(user.isDemonstration || farms.some((f) => f.isDemonstration)) && (
              <span className="px-2 py-0.5 rounded bg-[#2D6A4F] text-[#E4F0E7] text-[10px] font-mono uppercase tracking-wider">
                Demonstration Data
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{user.profile?.fullName}</h1>
          <p className="text-sm text-[#DCE8DF]">
            <span className="font-mono font-bold tabular-nums">
              {d?.overview.registeredFarmsCount ?? farms.length}
            </span>{' '}
            registered farm{(d?.overview.registeredFarmsCount ?? farms.length) === 1 ? '' : 's'} ·{' '}
            <span className="font-mono font-bold tabular-nums">
              {d?.overview.totalHectares ?? 0} ha
            </span>{' '}
            total · Farming types: {(d?.overview.farmingTypes || ['Mixed Farming']).join(', ')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {d && (
            <SpeakButton
              text={`Dashboard summary for ${user.profile?.fullName}. You manage ${d.overview.registeredFarmsCount} farms totalling ${d.overview.totalHectares} hectares, ${d.overview.registeredCropsCount} crops, ${d.overview.totalLivestockQuantity} animals, and ${d.overview.activeWarningsCount} active warnings.`}
              languageCode={languageCode}
              isSpeaking={isSpeaking}
              onSpeak={onSpeak}
              onStop={onStopSpeaking}
              supported={speechSupported}
            />
          )}
          <button
            type="button"
            onClick={onOpenFarmsView}
            className="px-3.5 py-2 rounded-xl bg-white text-[#143326] font-semibold text-xs sm:text-sm hover:bg-[#EDF2EC] cursor-pointer whitespace-nowrap"
          >
            Farms & GPS Map
          </button>
          <button
            type="button"
            onClick={onOpenVisualView}
            className="px-3.5 py-2 rounded-xl bg-[#2D6A4F] text-white font-semibold text-xs sm:text-sm hover:bg-[#40916C] cursor-pointer whitespace-nowrap"
          >
            Visual Scan
          </button>
          <button
            type="button"
            onClick={onOpenStockView}
            className="px-3.5 py-2 rounded-xl bg-[#2D6A4F] text-white font-semibold text-xs sm:text-sm hover:bg-[#40916C] cursor-pointer whitespace-nowrap"
          >
            Stock & Valuation
          </button>
          {onOpenReportsView && (
            <button
              type="button"
              onClick={onOpenReportsView}
              className="px-3.5 py-2 rounded-xl bg-[#2D6A4F] text-white font-semibold text-xs sm:text-sm hover:bg-[#40916C] cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Reports & Exports</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAdvisorView}
            className="px-3.5 py-2 rounded-xl border border-[#8EB89D] text-white font-semibold text-xs sm:text-sm hover:bg-[#1B4332] cursor-pointer whitespace-nowrap"
          >
            AI Assistant
          </button>
        </div>
      </div>

      {/* Dashboard Filters Bar (Farm, Field, Date, Farming Category) */}
      <section className="bg-white border border-[#E2E6DF] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#143326]">
            <Filter className="w-4 h-4 text-[#2D6A4F]" />
            <span>Filter Dashboard & Analytics</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setFilterFarmId('all');
              setFilterFieldId('all');
              setFilterStartDate('');
              setFilterEndDate('');
              setFilterCategory('all');
            }}
            className="text-xs font-semibold text-[#2D6A4F] hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-[#4A5A50] mb-1">Farm</label>
            <select
              value={filterFarmId}
              onChange={(e) => {
                const v = e.target.value;
                setFilterFarmId(v);
                setFilterFieldId('all');
                if (v !== 'all') onSelectFarm(v);
              }}
              className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
            >
              <option value="all">All Accessible Farms ({farms.length})</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#4A5A50] mb-1">Field / Paddock</label>
            <select
              value={filterFieldId}
              onChange={(e) => setFilterFieldId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
            >
              <option value="all">All Fields ({availableFields.length})</option>
              {availableFields.map((fl) => (
                <option key={fl.id} value={fl.id}>
                  {fl.name} ({fl.farmName})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#4A5A50] mb-1">Farming Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
            >
              <option value="all">All Categories</option>
              <option value="crops">Crop Production</option>
              <option value="livestock">Livestock Management</option>
              <option value="mixed">Mixed Farming</option>
              <option value="weather">Weather & Rainfall</option>
              <option value="incidents">Incidents & Damage</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#4A5A50] mb-1">From Date</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[#4A5A50] mb-1">To Date</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
            />
          </div>
        </div>
      </section>

      {cachedAt && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs sm:text-sm ${
            isCacheStale
              ? 'bg-[#FFF6EB] border-[#F0D3A8] text-[#6B440B]'
              : 'bg-[#F6F7F4] border-[#D4DDD2] text-[#35443B]'
          }`}
        >
          <span className="font-semibold">
            {isCacheStale ? 'Outdated Offline Dashboard Cache' : 'Viewing Offline Farm Snapshot'}
          </span>{' '}
          · Last synced <span className="font-mono">{new Date(cachedAt).toLocaleString()}</span>.
          {isCacheStale ? ' Data is older than 24 hours — reconnect to refresh.' : ''}{' '}
          Fresh weather forecasts, external SoilGrids/ARC data, and online AI analysis require internet connectivity.
        </div>
      )}

      {error && (
        <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading && !d ? (
        <div className="bg-white border border-[#E2E6DF] rounded-2xl p-8 text-center text-sm text-[#4A5A50]">
          Loading operational farm metrics...
        </div>
      ) : d ? (
        <>
          {/* Clear Readability KPI Summary Cards (Database vs Estimated clearly labelled) */}
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Farms & Hectares</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
                {d.overview.totalHectares} ha
              </p>
              <p className="text-xs text-[#4A5A50] mt-1">
                {d.overview.registeredFarmsCount} farm(s) · Database
              </p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Registered Crops</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
                {d.overview.registeredCropsCount}
              </p>
              <p className="text-xs text-[#4A5A50] font-mono tabular-nums mt-1">
                {d.overview.cultivatedHectares} ha · {d.overview.totalRemainingPlants.toLocaleString()} plants
              </p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Livestock Quantity</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
                {d.overview.totalLivestockQuantity.toLocaleString()} head
              </p>
              <p className="text-xs text-[#4A5A50] mt-1">Database herd ledger</p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Stored Crop Stock</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#143326] mt-1">
                {d.overview.totalStoredCropKg.toLocaleString()} kg
              </p>
              <p className="text-xs text-[#8E2424] font-mono tabular-nums mt-1">
                Damaged: {d.overview.totalDamagedPlants.toLocaleString()} plants
              </p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Stock Value (Estimated)</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#1B4332] mt-1">
                R{d.overview.estimatedTotalStockValueZar.toLocaleString()}
              </p>
              <p className="text-xs text-[#4A5A50] font-mono tabular-nums mt-1">
                Actual Exp: R{d.overview.actualRecordedExpensesZar.toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
              <p className="text-xs text-[#4A5A50]">Active Warnings</p>
              <p
                className={`font-mono text-xl font-bold tabular-nums mt-1 ${
                  d.overview.activeWarningsCount > 0 ? 'text-[#9A5B13]' : 'text-[#1B4332]'
                }`}
              >
                {d.overview.activeWarningsCount}
              </p>
              <p className="text-xs text-[#4A5A50] mt-1">
                {d.overview.activeIncidentsCount} active incident(s)
              </p>
            </div>
          </section>

          <p className="text-xs text-[#4A5A50] px-1">{d.overview.estimationNotice}</p>

          {/* Row 1: Weather & Warnings + Upcoming Activities + Recommended Next Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Weather Conditions & Active Agricultural Warnings */}
            <section className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudRain className="w-5 h-5 text-[#1B4332]" />
                  <h2 className="font-display text-lg font-bold text-[#143326]">
                    Weather & Active Warnings
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenWeatherView}
                  className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                >
                  Weather Hub →
                </button>
              </div>
              <div className="text-xs text-[#4A5A50] space-y-1">
                <p className="font-semibold text-[#143326] text-sm">
                  {d.weatherSummary.farmName} · {d.weatherSummary.locationLabel}
                </p>
                <p>{d.weatherSummary.forecastSummary}</p>
                {d.weatherSummary.latestFarmerReport && (
                  <p className="text-[#2D6A4F]">
                    Latest Farmer Report ({d.weatherSummary.latestFarmerReport.observationDate}):{' '}
                    <span className="font-mono tabular-nums">
                      {d.weatherSummary.latestFarmerReport.measuredRainfallMm ?? 0} mm
                    </span>{' '}
                    ({d.weatherSummary.latestFarmerReport.qcStatus.replace(/_/g, ' ')})
                  </p>
                )}
              </div>
              <div className="space-y-2 pt-2 border-t border-[#E2E6DF]">
                {d.weatherSummary.activeWarnings.length === 0 ? (
                  <p className="text-xs text-[#2D6A4F]">
                    No active agricultural warnings for the selected farms.
                  </p>
                ) : (
                  d.weatherSummary.activeWarnings.map((w) => (
                    <div
                      key={w.id}
                      className={`rounded-xl p-3 border text-xs ${
                        w.severity === 'critical'
                          ? 'bg-[#FDF2F2] border-[#E8B4B4] text-[#8E2424]'
                          : 'bg-[#FFF6EB] border-[#F0D3A8] text-[#6B440B]'
                      }`}
                    >
                      <p className="font-semibold">{w.title}</p>
                      <p className="mt-0.5">{w.detail}</p>
                      <p className="mt-1 opacity-80">Source: {w.source}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Upcoming Activities */}
            <section className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-[#1B4332]" />
                <h2 className="font-display text-lg font-bold text-[#143326]">
                  Upcoming Activities
                </h2>
              </div>
              {d.upcomingActivities.length === 0 ? (
                <p className="text-sm text-[#4A5A50]">
                  No urgent upcoming harvest dates, incident follow-ups, or weather logs due.
                </p>
              ) : (
                <div className="divide-y divide-[#E2E6DF]">
                  {d.upcomingActivities.slice(0, 5).map((act) => (
                    <div key={act.id} className="py-2.5 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#143326]">{act.title}</p>
                        <span className="text-xs font-mono tabular-nums text-[#2D6A4F] shrink-0">
                          {act.dueDate}
                        </span>
                      </div>
                      <p className="text-xs text-[#4A5A50]">
                        {act.farmName} · {act.detail}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recommended Next Actions */}
            <section className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#1B4332]" />
                <h2 className="font-display text-lg font-bold text-[#143326]">
                  Recommended Next Actions
                </h2>
              </div>
              <div className="space-y-2.5">
                {d.recommendedNextActions.map((act) => (
                  <div
                    key={act.id}
                    className="border border-[#E2E6DF] rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#143326]">
                        {act.priority === 'high' ? 'Priority · ' : ''}
                        {act.title}
                      </p>
                      <p className="text-xs text-[#4A5A50] mt-0.5 line-clamp-2">{act.reason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateActionTab(act.actionTab)}
                      className="px-3 py-1.5 rounded-lg bg-[#EDF5EF] hover:bg-[#DCEBDD] text-[#143326] text-xs font-semibold shrink-0 cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>{ACTION_TAB_LABELS[act.actionTab] || act.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Row 2: Registered Crops & Crop Stock + Livestock & Livestock Stock + Recent Incidents + Recent AI Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Crops & Crop Stock */}
            <section className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sprout className="w-5 h-5 text-[#1B4332]" />
                  <h2 className="font-display text-lg font-bold text-[#143326]">
                    Registered Crops & Crop Stock
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenCropsView}
                  className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                >
                  Manage Crops →
                </button>
              </div>
              {d.registeredCrops.length === 0 ? (
                <p className="text-sm text-[#4A5A50]">No crops match the active filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E6DF] text-[#4A5A50]">
                        <th className="py-2 pr-3 font-semibold">Crop & Field</th>
                        <th className="py-2 pr-3 font-semibold text-right">Remaining</th>
                        <th className="py-2 pr-3 font-semibold text-right">Stored kg</th>
                        <th className="py-2 font-semibold text-right">Est. Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E6DF]">
                      {d.registeredCrops.slice(0, 6).map((c) => (
                        <tr key={c.id}>
                          <td className="py-2.5 pr-3">
                            <p className="font-semibold text-[#143326]">
                              {c.cropName} ({c.cropVariety})
                            </p>
                            <p className="text-[#4A5A50]">
                              {c.farmName} · {c.fieldName} · {c.growthStage}
                            </p>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[#143326]">
                            {c.remainingPlants.toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[#143326]">
                            {c.storedKg.toLocaleString()} kg
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-[#1B4332]">
                            R{c.estimatedValueZar.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Livestock Quantities & Livestock Stock */}
            <section className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Beef className="w-5 h-5 text-[#1B4332]" />
                  <h2 className="font-display text-lg font-bold text-[#143326]">
                    Livestock Stock & Valuations (Estimated)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenLivestockView}
                  className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                >
                  Manage Livestock →
                </button>
              </div>
              {d.livestockSummary.groups.length === 0 ? (
                <p className="text-sm text-[#4A5A50]">No livestock groups match the active filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E6DF] text-[#4A5A50]">
                        <th className="py-2 pr-3 font-semibold">Group & Breed</th>
                        <th className="py-2 pr-3 font-semibold">Health</th>
                        <th className="py-2 pr-3 font-semibold text-right">Head Count</th>
                        <th className="py-2 font-semibold text-right">Est. Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E6DF]">
                      {d.livestockSummary.groups.slice(0, 6).map((g) => (
                        <tr key={g.id}>
                          <td className="py-2.5 pr-3">
                            <p className="font-semibold text-[#143326]">
                              {g.groupName} ({g.animalType})
                            </p>
                            <p className="text-[#4A5A50]">
                              {g.breed} · {g.farmName}
                            </p>
                          </td>
                          <td className="py-2.5 pr-3 text-[#35443B]">{g.healthStatus}</td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[#143326]">
                            {g.quantity.toLocaleString()}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-[#1B4332]">
                            R{g.estimatedValueZar.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Recent Incidents */}
            <section className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#9A5B13]" />
                  <h2 className="font-display text-lg font-bold text-[#143326]">
                    Recent Farm Incidents
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenIncidentsView}
                  className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                >
                  Incident Register →
                </button>
              </div>
              {d.recentIncidents.length === 0 ? (
                <p className="text-sm text-[#4A5A50]">No incidents recorded in the active range.</p>
              ) : (
                <div className="divide-y divide-[#E2E6DF]">
                  {d.recentIncidents.map((inc) => (
                    <div key={inc.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#143326]">{inc.title}</p>
                        <span
                          className={`text-xs font-semibold ${
                            inc.status === 'active'
                              ? 'text-[#8E2424]'
                              : inc.status === 'monitoring'
                              ? 'text-[#9A5B13]'
                              : 'text-[#1B4332]'
                          }`}
                        >
                          {inc.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#4A5A50]">
                        {inc.farmName} · {inc.occurredAt.slice(0, 10)} · Est. impact R
                        {inc.estimatedFinancialImpactZar.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent AI Insights */}
            <section className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#1B4332]" />
                  <h2 className="font-display text-lg font-bold text-[#143326]">
                    Recent AI Agricultural Insights (Advisory)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenAdvisorView}
                  className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                >
                  Open AI Advisor →
                </button>
              </div>
              {d.recentAiInsights.length === 0 ? (
                <p className="text-sm text-[#4A5A50]">
                  No AI advisory summaries generated yet. Ask the AI Assistant or run a Visual Scan to build insight history.
                </p>
              ) : (
                <div className="divide-y divide-[#E2E6DF]">
                  {d.recentAiInsights.slice(0, 4).map((ai) => (
                    <div key={ai.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#143326]">{ai.title}</p>
                        <span className="text-xs font-mono text-[#4A5A50]">
                          {ai.createdAt.slice(0, 10)}
                        </span>
                      </div>
                      <p className="text-xs text-[#35443B] line-clamp-2">{ai.summary}</p>
                      <p className="text-[11px] text-[#4A5A50]">
                        {ai.farmName || 'General'} · Advisory only (verify serious issues with an agronomist or vet)
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ANALYTICS SUITE (Clear Sub-Tabs for Older Farmer Readability) */}
          <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E6DF] pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#1B4332]" />
                <div>
                  <h2 className="font-display text-xl font-bold text-[#143326]">
                    Agricultural Analytics & Farm Comparisons
                  </h2>
                  <p className="text-xs text-[#4A5A50]">
                    Select a section below to inspect database trends, stock movements, expenses, damage, and weather impact.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'production', label: 'Crops, Livestock & Trends' },
                    { id: 'stock_finance', label: 'Stock Changes & Expenses' },
                    { id: 'damage_weather', label: 'Damage & Weather Impact' },
                    { id: 'comparisons', label: 'Farm Comparisons' },
                  ] as { id: AnalyticsTab; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAnalyticsTab(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      analyticsTab === tab.id
                        ? 'bg-[#1B4332] text-white'
                        : 'bg-[#F6F7F4] text-[#35443B] hover:bg-[#EDF2EC]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {analyticsTab === 'production' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Crop Performance Chart */}
                <div className="border border-[#E2E6DF] rounded-xl p-4 space-y-3">
                  <h3 className="font-display font-bold text-[#143326] text-base">
                    Crop Performance (Remaining vs Damaged & Harvested kg)
                  </h3>
                  {d.analytics.cropPerformance.length === 0 ? (
                    <p className="text-xs text-[#4A5A50]">No crop records available.</p>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const maxVal = Math.max(
                          1,
                          ...d.analytics.cropPerformance.map((c) => Math.max(c.plantedQty, 1))
                        );
                        return d.analytics.cropPerformance.map((c) => {
                          const remPct = Math.round((c.remainingQty / maxVal) * 100);
                          const dmgPct = Math.round((c.damagedQty / maxVal) * 100);
                          return (
                            <div key={c.label} className="space-y-1 text-xs">
                              <div className="flex justify-between gap-2">
                                <span className="font-semibold text-[#143326] truncate">
                                  {c.label}
                                </span>
                                <span className="font-mono tabular-nums text-[#4A5A50] shrink-0">
                                  {c.harvestedKg.toLocaleString()} kg · Est. R
                                  {c.estimatedValueZar.toLocaleString()}
                                </span>
                              </div>
                              <div className="h-3 bg-[#EDF2EC] rounded-full overflow-hidden flex">
                                <div
                                  className="bg-[#2D6A4F] h-full"
                                  style={{ width: `${Math.max(3, remPct)}%` }}
                                />
                                {dmgPct > 0 && (
                                  <div
                                    className="bg-[#C05621] h-full"
                                    style={{ width: `${Math.max(2, dmgPct)}%` }}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                      <p className="text-[11px] text-[#4A5A50]">
                        Green: Remaining standing plants · Amber/Red: Damaged plants
                      </p>
                    </div>
                  )}
                </div>

                {/* Livestock Performance & Production Trends */}
                <div className="border border-[#E2E6DF] rounded-xl p-4 space-y-4">
                  <h3 className="font-display font-bold text-[#143326] text-base">
                    Livestock Performance & Production Trends
                  </h3>
                  {d.analytics.livestockPerformance.length > 0 && (
                    <div className="space-y-2">
                      {d.analytics.livestockPerformance.map((l) => (
                        <div
                          key={l.animalType}
                          className="flex items-center justify-between text-xs border-b border-[#EDF2EC] pb-2"
                        >
                          <div>
                            <p className="font-semibold text-[#143326]">{l.animalType}</p>
                            <p className="text-[#4A5A50]">
                              +{l.birthsAndPurchases} births/purchases · -{l.deathsAndSales} deaths/sales
                            </p>
                          </div>
                          <div className="text-right font-mono tabular-nums">
                            <p className="font-bold text-[#143326]">{l.headCount} head</p>
                            <p className="text-[#2D6A4F]">
                              Est. R{l.estimatedValueZar.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {d.analytics.productionTrends.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <p className="text-xs font-semibold text-[#143326] flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-[#2D6A4F]" />
                        <span>Monthly Production Trends (Database)</span>
                      </p>
                      <div className="space-y-2">
                        {d.analytics.productionTrends.slice(-6).map((pt) => (
                          <div
                            key={pt.period}
                            className="flex items-center justify-between text-xs font-mono tabular-nums"
                          >
                            <span className="font-semibold text-[#143326]">{pt.period}</span>
                            <span className="text-[#35443B]">
                              Harvest: {pt.harvestKg.toLocaleString()} kg · Livestock: {pt.livestockUnits} · Feed:{' '}
                              {pt.mixedFeedKg.toLocaleString()} kg
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {analyticsTab === 'stock_finance' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stock Changes */}
                <div className="border border-[#E2E6DF] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-[#143326] text-base flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#1B4332]" />
                      <span>Recent Stock Changes</span>
                    </h3>
                    <button
                      type="button"
                      onClick={onOpenStockView}
                      className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                    >
                      Full Ledger →
                    </button>
                  </div>
                  {d.analytics.stockChanges.length === 0 ? (
                    <p className="text-xs text-[#4A5A50]">No stock movements in selected range.</p>
                  ) : (
                    <div className="divide-y divide-[#EDF2EC]">
                      {d.analytics.stockChanges.slice(0, 8).map((sc) => (
                        <div key={sc.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                          <div>
                            <p className="font-semibold text-[#143326]">
                              {sc.itemLabel} ({sc.movementType})
                            </p>
                            <p className="text-[#4A5A50] font-mono tabular-nums">{sc.date}</p>
                          </div>
                          <div className="text-right font-mono tabular-nums">
                            <p className="font-bold text-[#143326]">{sc.deltaLabel}</p>
                            <p className="text-[#4A5A50]">
                              Est. R{sc.estimatedValueDeltaZar.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expense Summaries (Actual vs Estimated Budget) */}
                <div className="border border-[#E2E6DF] rounded-xl p-4 space-y-4">
                  <h3 className="font-display font-bold text-[#143326] text-base">
                    Expense Summary (Actual Database Ledger vs Estimated Budget)
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-[#F6F7F4]">
                      <p className="text-[#4A5A50]">Total Actual Expenses (Database)</p>
                      <p className="font-mono text-lg font-bold tabular-nums text-[#143326] mt-0.5">
                        R{d.analytics.expenseSummaries.totalActualExpensesZar.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#EDF5EF]">
                      <p className="text-[#4A5A50]">Planned Budget (Estimated)</p>
                      <p className="font-mono text-lg font-bold tabular-nums text-[#1B4332] mt-0.5">
                        R{d.analytics.expenseSummaries.estimatedPlannedBudgetZar.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {d.analytics.expenseSummaries.byCategory.map((cat) => {
                      const maxExp = Math.max(
                        1,
                        ...d.analytics.expenseSummaries.byCategory.map((x) => x.amountZar)
                      );
                      const pct = Math.round((cat.amountZar / maxExp) * 100);
                      return (
                        <div key={cat.label} className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[#17201B]">{cat.label}</span>
                            <span className="font-mono font-semibold tabular-nums">
                              R{cat.amountZar.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-2.5 bg-[#EDF2EC] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#1B4332]"
                              style={{ width: `${Math.max(cat.amountZar > 0 ? 4 : 0, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onOpenMixedView}
                      className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                    >
                      Log Farm Expense →
                    </button>
                    <button
                      type="button"
                      onClick={onOpenPlannerView}
                      className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                    >
                      Compare in Business Planner →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {analyticsTab === 'damage_weather' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Damage & Loss Summary */}
                <div className="border border-[#E2E6DF] rounded-xl p-4 space-y-3">
                  <h3 className="font-display font-bold text-[#143326] text-base">
                    Damage & Loss Summary
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#F6F7F4]">
                      <p className="text-[#4A5A50]">Incidents</p>
                      <p className="font-mono font-bold tabular-nums text-[#143326] text-base">
                        {d.analytics.damageAndLoss.totalIncidents}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F7F4]">
                      <p className="text-[#4A5A50]">Affected Plants</p>
                      <p className="font-mono font-bold tabular-nums text-[#8E2424] text-base">
                        {d.analytics.damageAndLoss.affectedPlants.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F7F4]">
                      <p className="text-[#4A5A50]">Affected Ha</p>
                      <p className="font-mono font-bold tabular-nums text-[#143326] text-base">
                        {d.analytics.damageAndLoss.affectedHectares}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#FDF2F2]">
                      <p className="text-[#8E2424]">Est. Impact</p>
                      <p className="font-mono font-bold tabular-nums text-[#8E2424] text-base">
                        R{d.analytics.damageAndLoss.estimatedFinancialImpactZar.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    {d.analytics.damageAndLoss.byIncidentType.map((row) => (
                      <div
                        key={row.typeLabel}
                        className="flex justify-between text-xs border-b border-[#EDF2EC] py-1.5"
                      >
                        <span className="font-medium text-[#143326] capitalize">
                          {row.typeLabel.replace(/_/g, ' ')} ({row.count})
                        </span>
                        <span className="font-mono tabular-nums text-[#8E2424]">
                          Est. R{row.estimatedImpactZar.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weather Impact Summary */}
                <div className="border border-[#E2E6DF] rounded-xl p-4 space-y-3">
                  <h3 className="font-display font-bold text-[#143326] text-base">
                    Weather Impact & Forecast vs Reported Rain
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#F6F7F4]">
                      <p className="text-[#4A5A50]">Forecast Days</p>
                      <p className="font-mono font-bold tabular-nums text-[#143326] text-base">
                        {d.analytics.weatherImpact.storedForecastDays}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F7F4]">
                      <p className="text-[#4A5A50]">Farmer Reports</p>
                      <p className="font-mono font-bold tabular-nums text-[#143326] text-base">
                        {d.analytics.weatherImpact.farmerObservationsCount}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F7F4]">
                      <p className="text-[#4A5A50]">Avg Rain Diff</p>
                      <p className="font-mono font-bold tabular-nums text-[#1B4332] text-base">
                        {d.analytics.weatherImpact.avgRainfallVarianceMm != null
                          ? `${d.analytics.weatherImpact.avgRainfallVarianceMm > 0 ? '+' : ''}${d.analytics.weatherImpact.avgRainfallVarianceMm} mm`
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 pt-1">
                    {d.analytics.weatherImpact.recentDays.map((day) => {
                      const maxMm = Math.max(
                        10,
                        ...d.analytics.weatherImpact.recentDays.map((x) =>
                          Math.max(x.forecastRainMm, x.reportedRainMm ?? 0)
                        )
                      );
                      return (
                        <div key={day.date} className="space-y-1 text-xs">
                          <div className="flex justify-between font-mono tabular-nums">
                            <span className="text-[#143326] font-semibold">{day.date}</span>
                            <span className="text-[#4A5A50]">
                              Forecast: {day.forecastRainMm} mm · Reported:{' '}
                              {day.reportedRainMm != null ? `${day.reportedRainMm} mm` : 'Not logged'}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div
                              className="h-2 bg-[#4A7C59] rounded-full"
                              style={{ width: `${Math.max(2, (day.forecastRainMm / maxMm) * 100)}%` }}
                            />
                            {day.reportedRainMm != null && (
                              <div
                                className="h-2 bg-[#143326] rounded-full"
                                style={{
                                  width: `${Math.max(2, (day.reportedRainMm / maxMm) * 100)}%`,
                                }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {analyticsTab === 'comparisons' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E6DF] text-[#4A5A50]">
                      <th className="py-2.5 pr-4 font-semibold">Farm & Province</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Hectares</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Fields</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Crops</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Livestock</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Est. Stock Value</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Actual Expenses</th>
                      <th className="py-2.5 font-semibold text-right">Active Incidents</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E6DF]">
                    {d.farmsSummary.map((f) => (
                      <tr key={f.id}>
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-[#143326]">{f.name}</p>
                          <p className="text-xs text-[#4A5A50]">
                            {f.district}, {f.province}
                          </p>
                        </td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">
                          {f.totalHectares} ha
                        </td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">{f.fieldCount}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">{f.cropsCount}</td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">
                          {f.livestockCount}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-[#1B4332]">
                          R{f.estimatedStockValueZar.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">
                          R{f.actualExpensesZar.toLocaleString()}
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums">
                          <span className={f.activeIncidentsCount > 0 ? 'text-[#8E2424] font-bold' : ''}>
                            {f.activeIncidentsCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Quick Operational Links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Soil & Land', fn: onOpenSoilLandView },
              { label: 'Mixed Farming', fn: onOpenMixedView },
              { label: 'Business Planner', fn: onOpenPlannerView },
              { label: 'Learning Centre', fn: onOpenLearningView },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.fn}
                className="bg-white border border-[#E2E6DF] hover:border-[#1B4332] rounded-xl px-4 py-3 text-sm font-semibold text-[#143326] flex items-center justify-between cursor-pointer"
              >
                <span>{item.label}</span>
                <Activity className="w-4 h-4 text-[#2D6A4F]" />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};
