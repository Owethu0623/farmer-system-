export type RoleCode =
  | 'prospective_farmer'
  | 'existing_farmer'
  | 'agricultural_expert'
  | 'organisation_manager'
  | 'system_administrator';

export type LanguageCode =
  | 'en'
  | 'af'
  | 'zu'
  | 'xh'
  | 'nso'
  | 'st'
  | 'tn'
  | 'ss'
  | 've'
  | 'ts'
  | 'nr'
  | 'sasl';

export interface LanguageOption {
  id: string;
  code: LanguageCode;
  name: string;
  nativeName: string;
  hasAudioSupport: boolean;
  hasSignLanguageSupport: boolean;
  isActive: boolean;
}

export interface ProspectiveFarmerData {
  preferredFarmingType: string;
  intendedLandSizeHectares: number;
  landAccessStatus: string;
  availableResources: string[];
  farmingExperience: string;
  agriculturalInterests: string[];
  farmingGoals: string[];
}

export interface UserProfile {
  id: string;
  userId: string;
  fullName: string;
  phoneNumber: string;
  province: string;
  district: string;
  farmerExperienceYears: number;
  accessibilityLargeText: boolean;
  accessibilityAudioGuidance: boolean;
  accessibilityVoiceInput: boolean;
  prospectiveData: ProspectiveFarmerData | null;
  bio: string;
}

export interface AuthUser {
  id: string;
  email: string;
  roleCode: RoleCode;
  roleName: string;
  preferredLanguageCode: LanguageCode;
  isActive: boolean;
  isEmailVerified: boolean;
  onboardingCompleted: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  profile: UserProfile | null;
  permissions: string[];
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export type LocationSource = 'gps' | 'manual_map_pin' | 'municipal_center';

export interface FarmLocation {
  id: string;
  farmId: string;
  province: string;
  districtMunicipality: string;
  localMunicipality: string;
  townOrVillage: string;
  latitude: number;
  longitude: number;
  locationSource: LocationSource;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAccuracyMeters: number | null;
  gpsCapturedAt: string | null;
  centroidWkt: string;
  elevationMeters: number;
}

export interface FarmBoundary {
  id: string;
  farmId: string;
  boundaryWkt: string;
  geojson: GeoJsonPolygon;
  calculatedAreaHectares: number;
  perimeterMeters: number;
  source: string;
  updatedAt: string;
}

export interface FieldItem {
  id: string;
  farmId: string;
  name: string;
  farmingTypeId: string | null;
  cropOrLivestock: string;
  areaHectares: number;
  soilType: string;
  irrigationType: string;
  geojson?: GeoJsonPolygon | null;
  status: 'active' | 'fallow' | 'preparing';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FarmItem {
  id: string;
  ownerId: string;
  ownerName?: string;
  name: string;
  farmingActivities: string[];
  farmSizeHectares: number;
  yearsOfExperience: number;
  waterAvailability: string;
  existingCrops: string[];
  existingLivestock: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  location: FarmLocation | null;
  boundary: FarmBoundary | null;
  fields: FieldItem[];
}

export type CropGrowthStage =
  | 'planted'
  | 'germination'
  | 'vegetative'
  | 'flowering'
  | 'fruiting'
  | 'mature'
  | 'harvested';

export type CropActivityType =
  | 'stage_update'
  | 'irrigation'
  | 'fertiliser'
  | 'pest'
  | 'disease'
  | 'damage'
  | 'harvest'
  | 'record_edit';

export interface CropItem {
  id: string;
  farmId: string;
  fieldId: string | null;
  farmName?: string;
  fieldName?: string;
  ownerId: string;
  cropName: string;
  cropVariety: string;
  plantingDate: string;
  plantingQuantity: number;
  damagedPlants: number;
  remainingPlants?: number;
  cultivatedAreaHectares: number;
  soilInformation: string;
  irrigationMethod: string;
  fertiliserInformation: string;
  expectedHarvestingDate: string;
  growthStage: CropGrowthStage;
  harvestedQuantityKg: number;
  estimatedValueZar: number;
  status: string;
  activityCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CropActivityItem {
  id: string;
  cropId: string;
  farmId: string;
  fieldId: string | null;
  activityType: CropActivityType;
  activityDate: string;
  quantity: number;
  unit: string;
  valueZar: number;
  notes: string;
  snapshot?: Record<string, unknown> | null;
  createdAt: string;
}

export interface CropAnalytics {
  totalRegisteredCrops: number;
  totalCultivatedHectares: number;
  totalPlanted: number;
  damagedPlants: number;
  remainingPlants: number;
  totalHarvestedKg: number;
  estimatedHarvestValueZar: number;
  byCrop: {
    id: string;
    cropName: string;
    cropVariety: string;
    cultivatedAreaHectares: number;
    harvestedQuantityKg: number;
    estimatedValueZar: number;
    remainingPlants: number;
    growthStage: CropGrowthStage;
  }[];
  timeline: {
    month: string;
    harvestKg: number;
    activitiesCount: number;
    valueZar: number;
  }[];
}

export type LivestockAnimalType = 'Cattle' | 'Sheep' | 'Goats' | 'Pigs' | 'Poultry';

export type LivestockHealthStatus =
  | 'Healthy'
  | 'Under Observation'
  | 'Treatment'
  | 'Quarantine';

export type LivestockRecordType =
  | 'Birth'
  | 'Death'
  | 'Purchase'
  | 'Sale'
  | 'Transfer'
  | 'Feeding'
  | 'Veterinary'
  | 'Vaccination'
  | 'Production';

export interface LivestockGroupItem {
  id: string;
  farmId: string;
  fieldId: string | null;
  farmName?: string;
  fieldName?: string | null;
  ownerId: string;
  animalType: LivestockAnimalType;
  groupName: string;
  breed: string;
  quantity: number;
  identificationNumber: string;
  registrationDate: string;
  healthStatus: LivestockHealthStatus;
  feedingInformation: string;
  grazingInformation: string;
  housingInformation: string;
  estimatedUnitValueZar: number;
  totalValueZar?: number;
  recordCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LivestockRecordItem {
  id: string;
  livestockGroupId: string;
  farmId: string;
  recordType: LivestockRecordType;
  recordDate: string;
  quantityChange: number;
  productionAmount: number;
  productionUnit: string;
  valueZar: number;
  notes: string;
  createdAt: string;
}

export interface LivestockAnalytics {
  totalAnimals: number;
  byCategory: { category: LivestockAnimalType; count: number; valueZar: number }[];
  births: number;
  deaths: number;
  purchases: number;
  sales: number;
  estimatedLivestockValueZar: number;
  recordCount: number;
}

export type MixedEntryCategory =
  | 'feed_production'
  | 'shared_land'
  | 'water_management'
  | 'combined_expense'
  | 'combined_production';

export interface MixedFarmingEntryItem {
  id: string;
  farmId: string;
  farmName?: string;
  entryCategory: MixedEntryCategory;
  title: string;
  entryDate: string;
  relatedCropId: string | null;
  relatedLivestockId: string | null;
  expenseZar: number;
  productionQuantity: number;
  productionUnit: string;
  waterLiters: number;
  notes: string;
  createdAt: string;
}

export interface MixedFarmingSummary {
  totalFarmAreaHa: number;
  cropCultivatedHa: number;
  grazingFieldsHa: number;
  cropValueZar: number;
  livestockValueZar: number;
  combinedAssetAndHarvestValueZar: number;
  combinedExpensesZar: number;
  totalWaterManagedLiters: number;
  totalFeedProducedKg: number;
  totalCrops: number;
  totalLivestockHead: number;
}

export interface ProvinceInfo {
  code: string;
  name: string;
  climateZone: string;
  annualRainfallMm: string;
  keyCommodities: string[];
  districts: {
    name: string;
    localMunicipalities: string[];
    center: { lat: number; lng: number };
  }[];
}

export interface FarmingOpportunity {
  id: string;
  title: string;
  province: string;
  minHectares: number;
  startupTier: string;
  waterNeed: string;
  cycleDays: string;
  summary: string;
}

export interface BeginnerGuide {
  id: string;
  step: string;
  title: string;
  duration: string;
  summary: string;
  checklist: string[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: 'advisory' | 'system' | 'opportunity' | 'weather';
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  verifiedUsers: number;
  totalFarms: number;
  totalFields: number;
  totalHectares: number;
  totalCrops?: number;
  totalLivestockHead?: number;
  byRole: { roleCode: RoleCode; roleName: string; count: number }[];
}

export interface AuditLogItem {
  id: string;
  actorUserId: string | null;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

export interface SoilReportItem {
  id: string;
  farmId: string;
  fieldId: string | null;
  fieldName?: string | null;
  ownerId: string;
  laboratoryName: string;
  sampleCode: string;
  sampleDate: string;
  sampleDepthCm: string;
  soilPhWater: number | null;
  soilPhKcl: number | null;
  soilTextureClass: string;
  clayPercent: number | null;
  siltPercent: number | null;
  sandPercent: number | null;
  organicMatterPercent: number | null;
  nitrogenMgKg: number | null;
  phosphorusMgKg: number | null;
  potassiumMgKg: number | null;
  calciumMgKg: number | null;
  magnesiumMgKg: number | null;
  cecCmolKg: number | null;
  fertilityRating: 'Low' | 'Moderate' | 'High' | 'Very High';
  drainageClass: 'Well Drained' | 'Moderately Well Drained' | 'Imperfectly Drained' | 'Poorly Drained';
  waterHoldingCapacityMmPerM: number | null;
  attachmentFileName: string | null;
  attachmentSummary: string;
  notes: string;
  createdAt: string;
}

export interface SoilMetricPoint {
  key: string;
  label: string;
  labValue: string | null;
  mappedEstimate: string | null;
  unit: string;
  sourceType: 'laboratory_measurement' | 'mapped_estimate' | 'not_measured';
  sourceNote: string;
}

export interface SuitabilityOption {
  id: string;
  farmingOption: string;
  category: string;
  suitabilityLevel: 'Well Suited' | 'Conditionally Suitable' | 'Needs Remediation / Assessment';
  whySuitable: string;
  supportingInformation: string[];
  missingInformation: string[];
  possibleLimitations: string[];
  additionalAssessmentsRequired: string[];
}

export interface SoilLandIntelligence {
  farmId: string;
  farmName: string;
  fetchedAt: string;
  coordinates: { latitude: number; longitude: number; locationSource: LocationSource };
  landIntelligence: {
    elevationMeters: number | null;
    elevationSource: string;
    terrainProfile: string;
    climateZone: string;
    annualRainfallPattern: string;
    temperaturePattern: string;
    environmentalConditions: string;
    waterAvailabilitySummary: string;
  };
  dataSources: {
    id: string;
    name: string;
    providerType: 'laboratory' | 'satellite_grid' | 'national_dataset';
    status: 'connected' | 'reference_only' | 'unavailable' | 'farmer_uploaded';
    summary: string;
    lastUpdated: string | null;
  }[];
  hasLabReport: boolean;
  latestLabReport: SoilReportItem | null;
  allLabReports: SoilReportItem[];
  soilMetrics: SoilMetricPoint[];
  suitabilityOptions: SuitabilityOption[];
}

export interface AgriculturalWarning {
  id: string;
  category:
    | 'heavy_rainfall'
    | 'flooding'
    | 'waterlogging'
    | 'drought'
    | 'extreme_heat'
    | 'frost'
    | 'strong_wind'
    | 'spraying'
    | 'planting'
    | 'irrigation';
  severity: 'High' | 'Moderate' | 'Advisory';
  title: string;
  whatIsHappening: string;
  affectedFarm: string;
  possibleImpact: string;
  recommendedPrecautions: string[];
}

export interface WeatherIntelligence {
  farmId: string;
  farmName: string;
  locationLabel: string;
  coordinates: { latitude: number; longitude: number };
  serviceAvailable: boolean;
  unavailableReason: string | null;
  source: string;
  sawsIntegrationStatus: string;
  lastUpdated: string | null;
  isCachedFallback: boolean;
  current: {
    temperatureC: number | null;
    apparentTempC: number | null;
    humidityPercent: number | null;
    windSpeedKmh: number | null;
    windGustsKmh: number | null;
    windDirectionDeg: number | null;
    precipitationMm: number | null;
    weatherDescription: string;
  } | null;
  hourly: {
    time: string;
    temperatureC: number;
    precipitationMm: number;
    precipProbabilityPercent: number | null;
    windSpeedKmh: number;
    humidityPercent: number | null;
  }[];
  daily: {
    date: string;
    tempMaxC: number;
    tempMinC: number;
    precipitationMm: number;
    precipProbabilityPercent: number | null;
    windMaxKmh: number;
    et0EvapotranspirationMm: number | null;
    weatherDescription: string;
  }[];
  historicalRainfall: {
    past14DaysMm: number | null;
    past30DaysMm: number | null;
    seasonalClimateNote: string;
    historicalDays: { date: string; precipitationMm: number; tempMaxC: number; tempMinC: number }[];
  };
  operationsWindow: {
    sprayingStatus: 'Suitable' | 'Caution' | 'Avoid' | 'Unknown';
    sprayingReason: string;
    plantingStatus: 'Suitable' | 'Caution' | 'Avoid' | 'Unknown';
    plantingReason: string;
    irrigationStatus: 'Needed' | 'Moderate' | 'Pause (Rain Expected)' | 'Unknown';
    irrigationReason: string;
  };
  warnings: AgriculturalWarning[];
}

export interface AiStructuredResponse {
  answer: string;
  supportingInformation: string[];
  assumptions: string[];
  missingInformation: string[];
  uncertaintyNote: string;
  suggestedActions: string[];
  languageName: string;
  poweredBy: 'gemini' | 'grounded_fallback';
  farmName: string | null;
  generatedAt: string;
}

export interface AiFarmAnalyticsReport {
  farmName: string;
  generatedAt: string;
  poweredBy: 'gemini' | 'grounded_fallback';
  farmPerformanceSummary: string;
  cropPerformanceInsights: string;
  livestockPerformanceInsights: string;
  weatherImpactSummary: string;
  stockSummary: string;
  productionEstimates: string;
  expenseSummary: string;
  agriculturalOpportunities: string[];
  suggestedNextActions: string[];
  supportingInformation: string[];
  assumptionsAndMissingInfo: string[];
}

export type VisualAnalysisCategory =
  | 'crop_condition'
  | 'plant_disease'
  | 'pest_damage'
  | 'soil_field_condition'
  | 'flooding'
  | 'waterlogging'
  | 'livestock_appearance'
  | 'animal_health'
  | 'equipment_damage'
  | 'infrastructure_damage';

export interface VisualAnalysisItem {
  id: string;
  farmId: string;
  farmName?: string;
  fieldId: string | null;
  fieldName?: string | null;
  livestockGroupId: string | null;
  livestockGroupName?: string | null;
  cropId: string | null;
  cropName?: string | null;
  ownerId: string;
  category: VisualAnalysisCategory;
  mediaType: 'image' | 'video';
  mediaFileName: string;
  mediaMimeType: string;
  analyzedFramesCount: number;
  mediaPreviewDataUrl: string | null;
  userQuestion: string;
  possibleFindings: string[];
  explanation: string;
  possibleCauses: string[];
  confidenceLevel: 'Low' | 'Moderate' | 'High';
  uncertaintyNote: string;
  recommendedActions: string[];
  safetyDisclaimer: string;
  poweredBy: 'gemini' | 'grounded_fallback';
  linkedIncidentId: string | null;
  linkedRecordNote: string | null;
  analyzedAt: string;
  createdAt: string;
}

export type CropStockMovementType =
  | 'planting'
  | 'damage'
  | 'harvest'
  | 'storage_in'
  | 'sale'
  | 'spoilage'
  | 'adjustment';

export interface CropStockRow {
  cropId: string;
  farmId: string;
  farmName: string;
  fieldName: string;
  cropName: string;
  cropVariety: string;
  growthStage: CropGrowthStage;
  originalPlantedQty: number;
  damagedPlants: number;
  remainingPlants: number;
  harvestedKg: number;
  storedProductionKg: number;
  soldKg: number;
  spoilageKg: number;
  plantUnitPriceZar: number;
  harvestUnitPriceZar: number;
  priceSource: string;
  initialPlantedValueZar: number;
  damagedStockValueZar: number;
  remainingStandingValueZar: number;
  estimatedHarvestValueZar: number;
  storedStockValueZar: number;
  salesValueZar: number;
  netStockValueChangeZar: number;
  calculationAssumption: string;
  valuationDate: string;
}

export interface LivestockStockRow {
  livestockGroupId: string;
  farmId: string;
  farmName: string;
  fieldName: string | null;
  animalType: LivestockAnimalType;
  groupName: string;
  breed: string;
  healthStatus: LivestockHealthStatus;
  currentQuantity: number;
  births: number;
  deaths: number;
  purchases: number;
  sales: number;
  productionTotal: number;
  productionUnit: string;
  unitPriceZar: number;
  priceSource: string;
  remainingValueZar: number;
  deathLossValueZar: number;
  netValueChangeZar: number;
  calculationAssumption: string;
  valuationDate: string;
}

export interface CropStockMovementItem {
  id: string;
  cropId: string;
  cropName?: string;
  farmId: string;
  farmName?: string;
  movementType: CropStockMovementType;
  movementDate: string;
  quantityDelta: number;
  unit: string;
  unitPriceZar: number;
  totalValueZar: number;
  resultingRemainingPlants: number | null;
  resultingStoredKg: number | null;
  notes: string;
  incidentId: string | null;
  createdAt: string;
}

export interface StockOverviewPayload {
  valuationDate: string;
  pricingDisclaimer: string;
  totals: {
    totalCropStockValueZar: number;
    totalLivestockValueZar: number;
    totalHarvestValueZar: number;
    totalStoredProductionValueZar: number;
    totalDamagedStockValueZar: number;
    totalRemainingStockValueZar: number;
    netStockValueChangeZar: number;
    totalPlantedUnits: number;
    totalDamagedUnits: number;
    totalRemainingUnits: number;
    totalLivestockHead: number;
  };
  cropStocks: CropStockRow[];
  livestockStocks: LivestockStockRow[];
  cropMovements: CropStockMovementItem[];
  livestockMovements: (LivestockRecordItem & { groupName?: string; farmName?: string })[];
}

export type IncidentType =
  | 'heavy_rainfall'
  | 'flooding'
  | 'storm_damage'
  | 'drought'
  | 'pest_outbreak'
  | 'crop_disease'
  | 'livestock_illness'
  | 'livestock_death'
  | 'equipment_damage'
  | 'infrastructure_damage';

export type IncidentStatus = 'active' | 'monitoring' | 'resolved';

export interface IncidentFollowUpItem {
  id: string;
  incidentId: string;
  actorUserId: string | null;
  actorName: string;
  followUpDate: string;
  statusAfter: IncidentStatus;
  actionTaken: string;
  notes: string;
  createdAt: string;
}

export interface FarmIncidentItem {
  id: string;
  farmId: string;
  farmName?: string;
  fieldId: string | null;
  fieldName?: string | null;
  cropId: string | null;
  cropName?: string | null;
  livestockGroupId: string | null;
  livestockGroupName?: string | null;
  visualAnalysisId: string | null;
  ownerId: string;
  incidentType: IncidentType;
  title: string;
  occurredAt: string;
  description: string;
  mediaFileName: string | null;
  mediaType: 'image' | 'video' | null;
  mediaPreviewDataUrl: string | null;
  affectedQuantity: number;
  affectedUnit: string;
  affectedAreaHectares: number;
  originalRecordedQuantity: number | null;
  remainingRecordedQuantity: number | null;
  estimatedFinancialImpactZar: number;
  recommendedActions: string[];
  status: IncidentStatus;
  followUps: IncidentFollowUpItem[];
  createdAt: string;
  updatedAt: string;
}

export interface IncidentDashboardPayload {
  summary: {
    totalIncidents: number;
    activeCount: number;
    monitoringCount: number;
    resolvedCount: number;
    totalFinancialImpactZar: number;
    totalAffectedCropPlants: number;
    totalAffectedLivestockHead: number;
    totalAffectedHectares: number;
  };
  incidents: FarmIncidentItem[];
}

