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
  onOpenFarmTransition?: () => void;
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
  onOpenFarmTransition,
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
                    ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                    : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#0B1F3A]'
                }`}
              >
                <span className="font-semibold">{a.title}:</span> {a.message}
              </div>
            ))}
          </div>
        )}

        <div className="bg-[#0B1F3A] text-white rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border border-[#163055]">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-mono uppercase tracking-wider text-[#93C5FD]">
                Prospective Farmer · {user.profile?.province || 'South Africa'}
              </p>
              {user.isDemonstration && (
                <span className="px-2 py-0.5 rounded bg-[#163055] border border-[#3B82F6]/40 text-[#E2E8F0] text-[10px] font-mono uppercase tracking-wider">
                  DEMONSTRATION DATA
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">
              Welcome, {user.profile?.fullName}
            </h1>
            <p className="text-sm text-[#CBD5E1]">
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
              className="px-4 py-2.5 rounded-xl bg-white text-[#0B1F3A] font-semibold text-sm hover:bg-[#F8FAFC] cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              Business Planner
            </button>
            <button
              type="button"
              onClick={onOpenSoilLandView}
              className="px-4 py-2.5 rounded-xl bg-[#0B3D91] text-white font-semibold text-sm hover:bg-[#082E70] cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              Land Suitability
            </button>
            <button
              type="button"
              onClick={onOpenWeatherView}
              className="px-4 py-2.5 rounded-xl bg-[#0B3D91] text-white font-semibold text-sm hover:bg-[#082E70] cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              Weather & NASA Climate
            </button>
            <button
              type="button"
              onClick={onOpenLearningView}
              className="px-4 py-2.5 rounded-xl bg-[#0B3D91] text-white font-semibold text-sm hover:bg-[#082E70] cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              Learning Centre
            </button>
            <button
              type="button"
              onClick={onOpenAdvisorView}
              className="px-4 py-2.5 rounded-xl border border-[#3B82F6]/50 text-white font-semibold text-sm hover:bg-[#163055] cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              AI Advisor
            </button>
            {onOpenFarmTransition && (
              <button
                type="button"
                onClick={onOpenFarmTransition}
                className="px-4 py-2.5 rounded-xl bg-[#174C3C] hover:bg-[#113A2E] border border-emerald-400/50 text-white font-semibold text-sm cursor-pointer whitespace-nowrap min-h-[40px]"
              >
                Register My Farm
              </button>
            )}
          </div>
        </div>

        {cachedAt && (
          <div
            className={`rounded-xl border px-4 py-3 text-xs sm:text-sm ${
              isCacheStale
                ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#0B1F3A]'
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
          <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Farming Readiness & Transition Banner */}
        {data?.learningReadiness && (
          <div
            className={`rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-4 ${
              data.learningReadiness.isReady
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-white border-[#CBD5E1] text-[#0B1F3A]'
            }`}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-[#174C3C]">
                {data.learningReadiness.isReady
                  ? 'Farming Readiness Complete'
                  : 'Farming Readiness Tracker'}
              </div>
              {data.learningReadiness.isReady ? (
                <>
                  <p className="font-display text-lg font-bold text-emerald-950">
                    {data.learningReadiness.completionMessage}
                  </p>
                  <p className="text-xs text-emerald-900">
                    All {data.learningReadiness.requiredGuidesTotal} foundational starter guides and the Practical Readiness Assessment ({data.learningReadiness.assessmentScore}/{data.learningReadiness.assessmentTotalQuestions}) are verified in your account. When you have acquired or begun managing farmland, register your farm below without losing any of your saved plans or learning progress.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[#0B1F3A]">
                    Starter Guides: {data.learningReadiness.requiredGuidesCompleted} /{' '}
                    {data.learningReadiness.requiredGuidesTotal} complete · Readiness Check:{' '}
                    {data.learningReadiness.assessmentPassed
                      ? `Passed (${data.learningReadiness.assessmentScore}/${data.learningReadiness.assessmentTotalQuestions})`
                      : 'Pending'}
                  </p>
                  <p className="text-xs text-[#475569]">
                    Complete all 3 starter guides (First-Season Readiness, Composite Soil Sampling, and Agricultural Business Planning) plus the 5-question readiness check in Learning Centre, or register your farm right away if you have already secured land.
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onOpenLearningView}
                className="px-4 py-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0B1F3A] text-xs font-semibold hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                {data.learningReadiness.isReady ? 'Review Learning' : 'Open Learning & Readiness'}
              </button>
              {onOpenFarmTransition && (
                <button
                  type="button"
                  onClick={onOpenFarmTransition}
                  className="px-4 py-2 rounded-lg bg-[#174C3C] hover:bg-[#113A2E] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  I Now Have a Farm — Register My Farm
                </button>
              )}
            </div>
          </div>
        )}

        {/* Overview Metrics */}
        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
              <p className="text-xs text-[#475569]">Saved Locations (Database)</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                {data.overview.savedLocationsCount}
              </p>
              <p className="text-xs text-[#475569] mt-0.5">Candidate areas bookmarked</p>
            </div>
            <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
              <p className="text-xs text-[#475569]">Farming Plans (Database)</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                {data.overview.farmingPlansCount}
              </p>
              <p className="text-xs text-[#475569] mt-0.5">Saved business scenarios</p>
            </div>
            <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
              <p className="text-xs text-[#475569]">Lowest Startup Budget (Estimated)</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#0B3D91] mt-1">
                {data.overview.estimatedLowestStartupZar !== null
                  ? `R${data.overview.estimatedLowestStartupZar.toLocaleString()}`
                  : 'No saved plan'}
              </p>
              <p className="text-xs text-[#475569] mt-0.5">
                {data.overview.estimatedLowestStartupZar !== null
                  ? 'Non-guaranteed estimate'
                  : 'Create a plan in Business Planner'}
              </p>
            </div>
            <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
              <p className="text-xs text-[#475569]">Learning Progress</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                {data.overview.learningProgressPercent}%
              </p>
              <p className="text-xs text-[#174C3C] mt-0.5 font-mono tabular-nums">
                {data.overview.learningCompletedCount} / {data.overview.learningTotalCount} guides completed
              </p>
            </div>
          </div>
        )}

        {/* Saved Locations & Land Suitability Recommendations */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-6 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#0B3D91]" />
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Saved Candidate Locations
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddLoc(!showAddLoc)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B3D91] hover:bg-[#082E70] text-white text-xs font-semibold cursor-pointer whitespace-nowrap min-h-[36px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showAddLoc ? 'Cancel' : 'Save Location'}</span>
                </button>
              </div>

              {showAddLoc && (
                <form
                  onSubmit={handleSaveProspectiveLocation}
                  className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-4 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
                        Province
                      </label>
                      <select
                        value={locProvince}
                        onChange={(e) => setLocProvince(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                      >
                        {provinces.map((p) => (
                          <option key={p.code} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
                        Town or Area *
                      </label>
                      <input
                        type="text"
                        required
                        value={locTown}
                        onChange={(e) => setLocTown(e.target.value)}
                        placeholder="e.g. Mooi River"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
                        District Municipality
                      </label>
                      <input
                        type="text"
                        value={locDistrict}
                        onChange={(e) => setLocDistrict(e.target.value)}
                        placeholder="e.g. uMgungundlovu"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
                        Intended Size (ha)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.1"
                        value={locHectares}
                        onChange={(e) => setLocHectares(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
                        Water Source Note
                      </label>
                      <input
                        type="text"
                        value={locWater}
                        onChange={(e) => setLocWater(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
                        Notes
                      </label>
                      <input
                        type="text"
                        value={locNotes}
                        onChange={(e) => setLocNotes(e.target.value)}
                        placeholder="Lease terms, road access..."
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={locSaving}
                    className="px-4 py-2 rounded-lg bg-[#0B3D91] hover:bg-[#082E70] text-white text-xs font-semibold cursor-pointer disabled:opacity-60 min-h-[38px]"
                  >
                    {locSaving ? 'Saving...' : 'Save Candidate Location'}
                  </button>
                </form>
              )}

              {data.savedLocations.length === 0 ? (
                <p className="text-sm text-[#475569]">
                  No candidate locations saved yet. Click Save Location to bookmark target districts.
                </p>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {data.savedLocations.map((loc) => (
                    <div key={loc.id} className="py-3.5 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[#0B1F3A] text-sm">
                            {loc.townOrArea}, {loc.province}
                          </p>
                          <p className="text-xs text-[#475569]">
                            {loc.district ? `${loc.district} · ` : ''}
                            <span className="font-mono tabular-nums">{loc.intendedHectares} ha</span> ·{' '}
                            {loc.waterSourceNote}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteProspectiveLocation(loc.id)}
                          aria-label="Remove saved location"
                          className="p-1.5 rounded-lg text-[#B91C1C] hover:bg-[#FEF2F2] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {loc.suitabilitySummary && (
                        <p className="text-xs text-[#334155]">{loc.suitabilitySummary}</p>
                      )}
                      {loc.notes && <p className="text-xs text-[#475569]">{loc.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Land Suitability Recommendations */}
            <section className="lg:col-span-6 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#0B3D91]" />
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Land Suitability Recommendations
                  </h2>
                </div>
                <select
                  value={prospectiveProvince}
                  onChange={(e) => setProspectiveProvince(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#0B1F3A]"
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
                    className="border border-[#E2E8F0] bg-[#F8FAFC] rounded-xl p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display font-bold text-[#0B1F3A]">{rec.province}</p>
                      <span className="text-xs font-mono tabular-nums text-[#0B3D91]">
                        {rec.annualRainfallMm}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569]">{rec.climateZone}</p>
                    <p className="text-xs text-[#0F172A]">
                      Key commodities: {rec.keyCommodities.join(' · ')}
                    </p>
                    <p className="text-xs text-[#334155] leading-relaxed">
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
            <section className="lg:col-span-7 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sprout className="w-5 h-5 text-[#174C3C]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  South African Farming Opportunities
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="border border-[#E2E8F0] bg-[#F8FAFC] rounded-xl p-4 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-[#174C3C]">
                        {opp.startupTier} · Min {opp.minHectares} ha
                      </p>
                      <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                        {opp.title}
                      </h3>
                      <p className="text-xs text-[#334155] leading-relaxed">{opp.summary}</p>
                    </div>
                    <div className="pt-2 border-t border-[#E2E8F0] text-xs text-[#475569] space-y-0.5">
                      <p>Regions: {opp.province}</p>
                      <p>Water: {opp.waterNeed} · Cycle: {opp.cycleDays}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="lg:col-span-5 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#0B3D91]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Suggested Starter Activities
                </h2>
              </div>
              <div className="space-y-3">
                {data.suggestedActivities.map((act) => (
                  <div key={act.id} className="border border-[#E2E8F0] bg-[#F8FAFC] rounded-xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm text-[#0B1F3A]">{act.title}</h3>
                      <span className="text-xs font-mono tabular-nums text-[#0B3D91]">
                        {act.estimatedStarterScaleHa} ha
                      </span>
                    </div>
                    <p className="text-xs text-[#475569]">
                      {act.category} · {act.estimatedCycle}
                    </p>
                    <p className="text-xs text-[#334155]">{act.whyItFits}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Farming Plans, Estimated Startup Costs, Learning Progress & Next Steps */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-6 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-[#0B3D91]" />
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Farming Plans & Estimated Startup Costs
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenPlannerView}
                  className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
                >
                  Open Planner →
                </button>
              </div>
              <p className="text-xs text-[#475569]">{data.overview.estimationNotice}</p>
              {data.farmingPlans.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#475569] space-y-2">
                  <p>No saved business scenarios yet.</p>
                  <button
                    type="button"
                    onClick={onOpenPlannerView}
                    className="px-4 py-2 rounded-lg bg-[#0B3D91] hover:bg-[#082E70] text-white text-xs font-semibold cursor-pointer"
                  >
                    Create Small / Medium / Large Scale Plan
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {data.farmingPlans.map((plan) => (
                    <div key={plan.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-[#0B1F3A]">{plan.planName}</p>
                        <p className="text-xs text-[#475569]">
                          {plan.province} · {plan.farmSizeHectares} ha · {plan.scaleTier.replace('_', ' ')}
                        </p>
                      </div>
                      <div className="text-right font-mono text-xs tabular-nums">
                        <p className="font-bold text-[#0B3D91]">
                          Est. Startup: R{plan.calculation.estimatedStartupCostsZar.toLocaleString()}
                        </p>
                        <p className="text-[#475569]">
                          Est. Operating: R{plan.calculation.estimatedOperatingCostsZar.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="lg:col-span-6 bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#174C3C]" />
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Recommended Next Steps & Learning Progress
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenLearningView}
                  className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
                >
                  Learning Centre →
                </button>
              </div>
              <div className="space-y-2.5">
                {data.recommendedNextSteps.map((step) => (
                  <div
                    key={step.id}
                    className="border border-[#E2E8F0] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 max-w-md">
                      <CheckCircle2
                        className={`w-5 h-5 shrink-0 mt-0.5 ${
                          step.completed ? 'text-[#174C3C]' : 'text-[#CBD5E1]'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#0B1F3A]">{step.title}</p>
                        <p className="text-xs text-[#475569] mt-0.5">{step.detail}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateActionTab(step.actionTab)}
                      className="px-3 py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-[#0B3D91] text-xs font-semibold cursor-pointer whitespace-nowrap"
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
                  ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                  : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#0B1F3A]'
              }`}
            >
              <span className="font-semibold">{a.title}:</span> {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#0B1F3A] text-white rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border border-[#163055]">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-mono uppercase tracking-wider text-[#93C5FD]">{roleLabel}</p>
            {(user.isDemonstration || farms.some((f) => f.isDemonstration)) && (
              <span className="px-2 py-0.5 rounded bg-[#163055] border border-[#3B82F6]/40 text-[#E2E8F0] text-[10px] font-mono uppercase tracking-wider">
                DEMONSTRATION DATA
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{user.profile?.fullName}</h1>
          <p className="text-sm text-[#CBD5E1]">
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
            className="px-3.5 py-2 rounded-xl bg-white text-[#0B1F3A] font-semibold text-xs sm:text-sm hover:bg-[#F8FAFC] cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            Farms & GPS Map
          </button>
          <button
            type="button"
            onClick={onOpenVisualView}
            className="px-3.5 py-2 rounded-xl bg-[#0B3D91] text-white font-semibold text-xs sm:text-sm hover:bg-[#082E70] cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            Visual Scan
          </button>
          <button
            type="button"
            onClick={onOpenStockView}
            className="px-3.5 py-2 rounded-xl bg-[#0B3D91] text-white font-semibold text-xs sm:text-sm hover:bg-[#082E70] cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            Stock & Valuation
          </button>
          {onOpenReportsView && (
            <button
              type="button"
              onClick={onOpenReportsView}
              className="px-3.5 py-2 rounded-xl bg-[#0B3D91] text-white font-semibold text-xs sm:text-sm hover:bg-[#082E70] cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 min-h-[40px]"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Reports & Exports</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAdvisorView}
            className="px-3.5 py-2 rounded-xl border border-[#3B82F6]/50 text-white font-semibold text-xs sm:text-sm hover:bg-[#163055] cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            AI Assistant
          </button>
        </div>
      </div>

      {/* Dashboard Filters Bar (Farm, Field, Date, Farming Category) */}
      <section className="bg-white border border-[#CBD5E1] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1F3A]">
            <Filter className="w-4 h-4 text-[#0B3D91]" />
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
            className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-[#475569] mb-1">Farm</label>
            <select
              value={filterFarmId}
              onChange={(e) => {
                const v = e.target.value;
                setFilterFarmId(v);
                setFilterFieldId('all');
                if (v !== 'all') onSelectFarm(v);
              }}
              className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white text-sm"
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
            <label className="block text-xs text-[#475569] mb-1">Field / Paddock</label>
            <select
              value={filterFieldId}
              onChange={(e) => setFilterFieldId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white text-sm"
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
            <label className="block text-xs text-[#475569] mb-1">Farming Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white text-sm"
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
            <label className="block text-xs text-[#475569] mb-1">From Date</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[#475569] mb-1">To Date</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white text-sm"
            />
          </div>
        </div>
      </section>

      {cachedAt && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs sm:text-sm ${
            isCacheStale
              ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
              : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#0B1F3A]'
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
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading && !d ? (
        <div className="bg-white border border-[#CBD5E1] rounded-2xl p-8 text-center text-sm text-[#475569]">
          Loading operational farm metrics...
        </div>
      ) : d ? (
        <>
          {/* Clear Readability KPI Summary Cards (Database vs Estimated clearly labelled) */}
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
              <p className="text-xs text-[#475569]">Farms & Hectares</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                {d.overview.totalHectares} ha
              </p>
              <p className="text-xs text-[#475569] mt-1">
                {d.overview.registeredFarmsCount} farm(s) · Database
              </p>
            </div>
            <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
              <p className="text-xs text-[#475569]">Registered Crops</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                {d.overview.registeredCropsCount}
              </p>
              <p className="text-xs text-[#475569] font-mono tabular-nums mt-1">
                {d.overview.cultivatedHectares} ha · {d.overview.totalRemainingPlants.toLocaleString()} plants
              </p>
            </div>
            <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
              <p className="text-xs text-[#475569]">Livestock Quantity</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                {d.overview.totalLivestockQuantity.toLocaleString()} head
              </p>
              <p className="text-xs text-[#475569] mt-1">Database herd ledger</p>
            </div>
            <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
              <p className="text-xs text-[#475569]">Stored Crop Stock</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                {d.overview.totalStoredCropKg.toLocaleString()} kg
              </p>
              <p className="text-xs text-[#B91C1C] font-mono tabular-nums mt-1">
                Damaged: {d.overview.totalDamagedPlants.toLocaleString()} plants
              </p>
            </div>
            <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
              <p className="text-xs text-[#475569]">Stock Value (Estimated)</p>
              <p className="font-mono text-xl font-bold tabular-nums text-[#0B3D91] mt-1">
                R{d.overview.estimatedTotalStockValueZar.toLocaleString()}
              </p>
              <p className="text-xs text-[#475569] font-mono tabular-nums mt-1">
                Actual Exp: R{d.overview.actualRecordedExpensesZar.toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
              <p className="text-xs text-[#475569]">Active Warnings</p>
              <p
                className={`font-mono text-xl font-bold tabular-nums mt-1 ${
                  d.overview.activeWarningsCount > 0 ? 'text-[#FC3D21]' : 'text-[#174C3C]'
                }`}
              >
                {d.overview.activeWarningsCount}
              </p>
              <p className="text-xs text-[#475569] mt-1">
                {d.overview.activeIncidentsCount} active incident(s)
              </p>
            </div>
          </section>

          <p className="text-xs text-[#475569] px-1">{d.overview.estimationNotice}</p>

          {/* Row 1: Weather & Warnings + Upcoming Activities + Recommended Next Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Weather Conditions & Active Agricultural Warnings */}
            <section className="bg-white border border-[#CBD5E1] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudRain className="w-5 h-5 text-[#0B3D91]" />
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Weather & Active Warnings
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenWeatherView}
                  className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
                >
                  Weather Hub →
                </button>
              </div>
              <div className="text-xs text-[#475569] space-y-1">
                <p className="font-semibold text-[#0B1F3A] text-sm">
                  {d.weatherSummary.farmName} · {d.weatherSummary.locationLabel}
                </p>
                <p>{d.weatherSummary.forecastSummary}</p>
                {d.weatherSummary.latestFarmerReport && (
                  <p className="text-[#174C3C]">
                    Latest Farmer Report ({d.weatherSummary.latestFarmerReport.observationDate}):{' '}
                    <span className="font-mono tabular-nums">
                      {d.weatherSummary.latestFarmerReport.measuredRainfallMm ?? 0} mm
                    </span>{' '}
                    ({d.weatherSummary.latestFarmerReport.qcStatus.replace(/_/g, ' ')})
                  </p>
                )}
              </div>
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                {d.weatherSummary.activeWarnings.length === 0 ? (
                  <p className="text-xs text-[#174C3C]">
                    No active agricultural warnings for the selected farms.
                  </p>
                ) : (
                  d.weatherSummary.activeWarnings.map((w) => (
                    <div
                      key={w.id}
                      className={`rounded-xl p-3 border text-xs ${
                        w.severity === 'critical'
                          ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                          : 'bg-[#FFF7ED] border-[#FED7AA] text-[#9A3412]'
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
            <section className="bg-white border border-[#CBD5E1] rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-[#0B3D91]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Upcoming Activities
                </h2>
              </div>
              {d.upcomingActivities.length === 0 ? (
                <p className="text-sm text-[#475569]">
                  No urgent upcoming harvest dates, incident follow-ups, or weather logs due.
                </p>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {d.upcomingActivities.slice(0, 5).map((act) => (
                    <div key={act.id} className="py-2.5 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#0B1F3A]">{act.title}</p>
                        <span className="text-xs font-mono tabular-nums text-[#0B3D91] shrink-0">
                          {act.dueDate}
                        </span>
                      </div>
                      <p className="text-xs text-[#475569]">
                        {act.farmName} · {act.detail}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recommended Next Actions */}
            <section className="bg-white border border-[#CBD5E1] rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#174C3C]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Recommended Next Actions
                </h2>
              </div>
              <div className="space-y-2.5">
                {d.recommendedNextActions.map((act) => (
                  <div
                    key={act.id}
                    className="border border-[#E2E8F0] rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0B1F3A]">
                        {act.priority === 'high' ? 'Priority · ' : ''}
                        {act.title}
                      </p>
                      <p className="text-xs text-[#475569] mt-0.5 line-clamp-2">{act.reason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateActionTab(act.actionTab)}
                      className="px-3 py-1.5 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-[#0B3D91] text-xs font-semibold shrink-0 cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>{ACTION_TAB_LABELS[act.actionTab] || act.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Row 2: Registered Crops & Crop Stock + Livestock & Livestock Stock */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Crops & Crop Stock */}
            <section className="bg-white border border-[#CBD5E1] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sprout className="w-5 h-5 text-[#174C3C]" />
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Registered Crops & Crop Stock
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenCropsView}
                  className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
                >
                  Manage Crops →
                </button>
              </div>
              {d.registeredCrops.length === 0 ? (
                <p className="text-sm text-[#475569]">No crops match the active filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-[#475569]">
                        <th className="py-2 pr-3 font-semibold">Crop & Field</th>
                        <th className="py-2 pr-3 font-semibold text-right">Remaining</th>
                        <th className="py-2 pr-3 font-semibold text-right">Stored kg</th>
                        <th className="py-2 font-semibold text-right">Est. Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {d.registeredCrops.slice(0, 6).map((c) => (
                        <tr key={c.id}>
                          <td className="py-2.5 pr-3">
                            <p className="font-semibold text-[#0B1F3A]">
                              {c.cropName} ({c.cropVariety})
                            </p>
                            <p className="text-[#475569]">
                              {c.farmName} · {c.fieldName} · {c.growthStage}
                            </p>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[#0B1F3A]">
                            {c.remainingPlants.toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[#0B1F3A]">
                            {c.storedKg.toLocaleString()} kg
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-[#174C3C]">
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
            <section className="bg-white border border-[#CBD5E1] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Beef className="w-5 h-5 text-[#174C3C]" />
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Livestock Stock & Valuations (Estimated)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenLivestockView}
                  className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
                >
                  Manage Livestock →
                </button>
              </div>
              {d.livestockSummary.groups.length === 0 ? (
                <p className="text-sm text-[#475569]">No livestock groups match the active filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-[#475569]">
                        <th className="py-2 pr-3 font-semibold">Group & Breed</th>
                        <th className="py-2 pr-3 font-semibold">Health</th>
                        <th className="py-2 pr-3 font-semibold text-right">Head Count</th>
                        <th className="py-2 font-semibold text-right">Est. Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {d.livestockSummary.groups.slice(0, 6).map((g) => (
                        <tr key={g.id}>
                          <td className="py-2.5 pr-3">
                            <p className="font-semibold text-[#0B1F3A]">
                              {g.groupName} ({g.animalType})
                            </p>
                            <p className="text-[#475569]">
                              {g.breed} · {g.farmName}
                            </p>
                          </td>
                          <td className="py-2.5 pr-3 text-[#334155]">{g.healthStatus}</td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[#0B1F3A]">
                            {g.quantity.toLocaleString()}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-[#174C3C]">
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
            <section className="bg-white border border-[#CBD5E1] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#FC3D21]" />
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Recent Farm Incidents
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenIncidentsView}
                  className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
                >
                  Incident Register →
                </button>
              </div>
              {d.recentIncidents.length === 0 ? (
                <p className="text-sm text-[#475569]">No incidents recorded in the active range.</p>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {d.recentIncidents.map((inc) => (
                    <div key={inc.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#0B1F3A]">{inc.title}</p>
                        <span
                          className={`text-xs font-semibold ${
                            inc.status === 'active'
                              ? 'text-[#B91C1C]'
                              : inc.status === 'monitoring'
                              ? 'text-[#B45309]'
                              : 'text-[#174C3C]'
                          }`}
                        >
                          {inc.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#475569]">
                        {inc.farmName} · {inc.occurredAt.slice(0, 10)} · Est. impact R
                        {inc.estimatedFinancialImpactZar.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent AI Insights */}
            <section className="bg-white border border-[#CBD5E1] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#0B3D91]" />
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Recent AI Agricultural Insights (Advisory)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenAdvisorView}
                  className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
                >
                  Open AI Advisor →
                </button>
              </div>
              {d.recentAiInsights.length === 0 ? (
                <p className="text-sm text-[#475569]">
                  No AI advisory summaries generated yet. Ask the AI Assistant or run a Visual Scan to build insight history.
                </p>
              ) : (
                <div className="divide-y divide-[#E2E8F0]">
                  {d.recentAiInsights.slice(0, 4).map((ai) => (
                    <div key={ai.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#0B1F3A]">{ai.title}</p>
                        <span className="text-xs font-mono text-[#475569]">
                          {ai.createdAt.slice(0, 10)}
                        </span>
                      </div>
                      <p className="text-xs text-[#334155] line-clamp-2">{ai.summary}</p>
                      <p className="text-[11px] text-[#475569]">
                        {ai.farmName || 'General'} · Advisory only (verify serious issues with an agronomist or vet)
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ANALYTICS SUITE */}
          <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#0B3D91]" />
                <div>
                  <h2 className="font-display text-xl font-bold text-[#0B1F3A]">
                    Agricultural Analytics & Farm Comparisons
                  </h2>
                  <p className="text-xs text-[#475569]">
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
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap min-h-[38px] ${
                      analyticsTab === tab.id
                        ? 'bg-[#0B3D91] text-white'
                        : 'bg-[#F8FAFC] border border-[#CBD5E1] text-[#334155] hover:bg-[#EFF6FF]'
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
                <div className="border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                  <h3 className="font-display font-bold text-[#0B1F3A] text-base">
                    Crop Performance (Remaining vs Damaged & Harvested kg)
                  </h3>
                  {d.analytics.cropPerformance.length === 0 ? (
                    <p className="text-xs text-[#475569]">No crop records available.</p>
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
                                <span className="font-semibold text-[#0B1F3A] truncate">
                                  {c.label}
                                </span>
                                <span className="font-mono tabular-nums text-[#475569] shrink-0">
                                  {c.harvestedKg.toLocaleString()} kg · Est. R
                                  {c.estimatedValueZar.toLocaleString()}
                                </span>
                              </div>
                              <div className="h-3 bg-[#E2E8F0] rounded-full overflow-hidden flex">
                                <div
                                  className="bg-[#174C3C] h-full"
                                  style={{ width: `${Math.max(3, remPct)}%` }}
                                />
                                {dmgPct > 0 && (
                                  <div
                                    className="bg-[#FC3D21] h-full"
                                    style={{ width: `${Math.max(2, dmgPct)}%` }}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                      <p className="text-[11px] text-[#475569]">
                        Green: Remaining standing plants · Red: Damaged plants
                      </p>
                    </div>
                  )}
                </div>

                {/* Livestock Performance & Production Trends */}
                <div className="border border-[#E2E8F0] rounded-xl p-4 space-y-4">
                  <h3 className="font-display font-bold text-[#0B1F3A] text-base">
                    Livestock Performance & Production Trends
                  </h3>
                  {d.analytics.livestockPerformance.length > 0 && (
                    <div className="space-y-2">
                      {d.analytics.livestockPerformance.map((l) => (
                        <div
                          key={l.animalType}
                          className="flex items-center justify-between text-xs border-b border-[#E2E8F0] pb-2"
                        >
                          <div>
                            <p className="font-semibold text-[#0B1F3A]">{l.animalType}</p>
                            <p className="text-[#475569]">
                              +{l.birthsAndPurchases} births/purchases · -{l.deathsAndSales} deaths/sales
                            </p>
                          </div>
                          <div className="text-right font-mono tabular-nums">
                            <p className="font-bold text-[#0B1F3A]">{l.headCount} head</p>
                            <p className="text-[#174C3C]">
                              Est. R{l.estimatedValueZar.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {d.analytics.productionTrends.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <p className="text-xs font-semibold text-[#0B1F3A] flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-[#0B3D91]" />
                        <span>Monthly Production Trends (Database)</span>
                      </p>
                      <div className="space-y-2">
                        {d.analytics.productionTrends.slice(-6).map((pt) => (
                          <div
                            key={pt.period}
                            className="flex items-center justify-between text-xs font-mono tabular-nums"
                          >
                            <span className="font-semibold text-[#0B1F3A]">{pt.period}</span>
                            <span className="text-[#334155]">
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
                <div className="border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-[#0B1F3A] text-base flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#0B3D91]" />
                      <span>Recent Stock Changes</span>
                    </h3>
                    <button
                      type="button"
                      onClick={onOpenStockView}
                      className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
                    >
                      Full Ledger →
                    </button>
                  </div>
                  {d.analytics.stockChanges.length === 0 ? (
                    <p className="text-xs text-[#475569]">No stock movements in selected range.</p>
                  ) : (
                    <div className="divide-y divide-[#E2E8F0]">
                      {d.analytics.stockChanges.slice(0, 8).map((sc) => (
                        <div key={sc.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                          <div>
                            <p className="font-semibold text-[#0B1F3A]">
                              {sc.itemLabel} ({sc.movementType})
                            </p>
                            <p className="text-[#475569] font-mono tabular-nums">{sc.date}</p>
                          </div>
                          <div className="text-right font-mono tabular-nums">
                            <p className="font-bold text-[#0B1F3A]">{sc.deltaLabel}</p>
                            <p className="text-[#475569]">
                              Est. R{sc.estimatedValueDeltaZar.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expense Summaries (Actual vs Estimated Budget) */}
                <div className="border border-[#E2E8F0] rounded-xl p-4 space-y-4">
                  <h3 className="font-display font-bold text-[#0B1F3A] text-base">
                    Expense Summary (Actual Database Ledger vs Estimated Budget)
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                      <p className="text-[#475569]">Total Actual Expenses (Database)</p>
                      <p className="font-mono text-lg font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                        R{d.analytics.expenseSummaries.totalActualExpensesZar.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE]">
                      <p className="text-[#0B3D91]">Planned Budget (Estimated)</p>
                      <p className="font-mono text-lg font-bold tabular-nums text-[#0B3D91] mt-0.5">
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
                            <span className="text-[#0F172A]">{cat.label}</span>
                            <span className="font-mono font-semibold tabular-nums">
                              R{cat.amountZar.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-2.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#0B3D91]"
                              style={{ width: `${Math.max(cat.amountZar > 0 ? 4 : 0, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={onOpenMixedView}
                      className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
                    >
                      Log Farm Expense →
                    </button>
                    <button
                      type="button"
                      onClick={onOpenPlannerView}
                      className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
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
                <div className="border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                  <h3 className="font-display font-bold text-[#0B1F3A] text-base">
                    Damage & Loss Summary
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#F8FAFC]">
                      <p className="text-[#475569]">Incidents</p>
                      <p className="font-mono font-bold tabular-nums text-[#0B1F3A] text-base">
                        {d.analytics.damageAndLoss.totalIncidents}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F8FAFC]">
                      <p className="text-[#475569]">Affected Plants</p>
                      <p className="font-mono font-bold tabular-nums text-[#B91C1C] text-base">
                        {d.analytics.damageAndLoss.affectedPlants.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F8FAFC]">
                      <p className="text-[#475569]">Affected Ha</p>
                      <p className="font-mono font-bold tabular-nums text-[#0B1F3A] text-base">
                        {d.analytics.damageAndLoss.affectedHectares}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA]">
                      <p className="text-[#B91C1C]">Est. Impact</p>
                      <p className="font-mono font-bold tabular-nums text-[#B91C1C] text-base">
                        R{d.analytics.damageAndLoss.estimatedFinancialImpactZar.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    {d.analytics.damageAndLoss.byIncidentType.map((row) => (
                      <div
                        key={row.typeLabel}
                        className="flex justify-between text-xs border-b border-[#E2E8F0] py-1.5"
                      >
                        <span className="font-medium text-[#0B1F3A] capitalize">
                          {row.typeLabel.replace(/_/g, ' ')} ({row.count})
                        </span>
                        <span className="font-mono tabular-nums text-[#B91C1C]">
                          Est. R{row.estimatedImpactZar.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weather Impact Summary */}
                <div className="border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                  <h3 className="font-display font-bold text-[#0B1F3A] text-base">
                    Weather Impact & Forecast vs Reported Rain
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#F8FAFC]">
                      <p className="text-[#475569]">Forecast Days</p>
                      <p className="font-mono font-bold tabular-nums text-[#0B1F3A] text-base">
                        {d.analytics.weatherImpact.storedForecastDays}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F8FAFC]">
                      <p className="text-[#475569]">Farmer Reports</p>
                      <p className="font-mono font-bold tabular-nums text-[#0B1F3A] text-base">
                        {d.analytics.weatherImpact.farmerObservationsCount}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F8FAFC]">
                      <p className="text-[#475569]">Avg Rain Diff</p>
                      <p className="font-mono font-bold tabular-nums text-[#0B3D91] text-base">
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
                            <span className="text-[#0B1F3A] font-semibold">{day.date}</span>
                            <span className="text-[#475569]">
                              Forecast: {day.forecastRainMm} mm · Reported:{' '}
                              {day.reportedRainMm != null ? `${day.reportedRainMm} mm` : 'Not logged'}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div
                              className="h-2 bg-[#0B3D91] rounded-full"
                              style={{ width: `${Math.max(2, (day.forecastRainMm / maxMm) * 100)}%` }}
                            />
                            {day.reportedRainMm != null && (
                              <div
                                className="h-2 bg-[#174C3C] rounded-full"
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
                    <tr className="border-b border-[#E2E8F0] text-[#475569]">
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
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {d.farmsSummary.map((f) => (
                      <tr key={f.id}>
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-[#0B1F3A]">{f.name}</p>
                          <p className="text-xs text-[#475569]">
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
                        <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-[#174C3C]">
                          R{f.estimatedStockValueZar.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums">
                          R{f.actualExpensesZar.toLocaleString()}
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums">
                          <span className={f.activeIncidentsCount > 0 ? 'text-[#B91C1C] font-bold' : ''}>
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
                className="bg-white border border-[#CBD5E1] hover:border-[#0B3D91] rounded-xl px-4 py-3 text-sm font-semibold text-[#0B1F3A] flex items-center justify-between cursor-pointer min-h-[44px]"
              >
                <span>{item.label}</span>
                <Activity className="w-4 h-4 text-[#0B3D91]" />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};
