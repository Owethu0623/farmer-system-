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

export type NotificationCategory =
  | 'weather_warning'
  | 'agricultural_incident'
  | 'upcoming_activity'
  | 'crop_reminder'
  | 'livestock_reminder'
  | 'stock_change'
  | 'ai_recommendation'
  | 'expert_feedback'
  | 'organisation_communication'
  | 'account_security'
  | 'advisory'
  | 'system'
  | 'opportunity'
  | 'weather';

export type NotificationPreferenceKey =
  | 'weather_warning'
  | 'agricultural_incident'
  | 'upcoming_activity'
  | 'crop_reminder'
  | 'livestock_reminder'
  | 'stock_change'
  | 'ai_recommendation'
  | 'expert_feedback'
  | 'organisation_communication'
  | 'account_security';

export interface NotificationPreferenceItem {
  userId: string;
  channels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  categories: Record<NotificationPreferenceKey, boolean>;
  quietHoursStart: string;
  quietHoursEnd: string;
  updatedAt: string;
}

export interface NotificationDeliveryItem {
  id: string;
  notificationId: string;
  userId: string;
  category: NotificationCategory;
  channel: 'in_app' | 'email' | 'sms' | 'push';
  status:
    | 'delivered_in_app'
    | 'queued_provider'
    | 'skipped_user_disabled'
    | 'skipped_provider_unconfigured';
  targetMasked: string;
  providerNote: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  isMandatorySecurity?: boolean;
  languageCode?: LanguageCode;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
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
  auditHistory?: AuditLogItem[];
}

export type WeatherSourceCategory =
  | 'verified_station_measurement'
  | 'farmer_reported_observation'
  | 'forecast_information'
  | 'ai_generated_estimate';

export type RainfallIntensity = 'none' | 'light' | 'moderate' | 'heavy' | 'extreme';

export type WindObservationLevel =
  | 'calm'
  | 'light_breeze'
  | 'moderate_wind'
  | 'strong_wind'
  | 'gale';

export interface WeatherForecastRecordItem {
  id: string;
  farmId: string;
  forecastDate: string;
  fetchedAt: string;
  sourceName: string;
  sourceCategory: 'forecast_information';
  verifiedStationName: string | null;
  verifiedStationRainMm: number | null;
  verifiedStationTempC: number | null;
  predictedRainfallMm: number;
  predictedTempMinC: number;
  predictedTempMaxC: number;
  predictedWindMaxKmh: number;
  weatherDescription: string;
}

export interface FarmerWeatherObservationItem {
  id: string;
  farmId: string;
  ownerId: string;
  farmLocationLabel: string;
  latitude: number;
  longitude: number;
  observationDate: string;
  rainfallOccurred: boolean;
  rainfallIntensity: RainfallIntensity;
  measuredRainfallMm: number | null;
  temperatureC: number | null;
  windObservation: WindObservationLevel;
  windSpeedEstimateKmh: number | null;
  notes: string;
  sourceCategory: 'farmer_reported_observation';
  qcStatus: 'pending_qc' | 'qc_passed_reference' | 'qc_flagged_outlier';
  qcNotes: string;
  comparedForecastRecordId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeatherComparisonRow {
  observationId: string;
  observationDate: string;
  farmLocationLabel: string;
  reportedRainfallOccurred: boolean;
  reportedIntensity: RainfallIntensity;
  reportedRainfallMm: number | null;
  reportedTemperatureC: number | null;
  reportedWind: WindObservationLevel;
  reportedWindEstimateKmh: number | null;
  qcStatus: 'pending_qc' | 'qc_passed_reference' | 'qc_flagged_outlier';
  qcNotes: string;
  forecastRecord: WeatherForecastRecordItem | null;
  verifiedStationAvailable: boolean;
  verifiedStationRainMm: number | null;
  verifiedStationTempC: number | null;
  rainfallDiffMm: number | null;
  rainEventMatch: 'matched' | 'forecast_rain_not_observed' | 'unexpected_rain_observed' | 'no_forecast_record';
  tempDiffC: number | null;
  windComparisonNote: string;
}

export interface LocalWeatherFeedbackOverview {
  farmId: string;
  farmName: string;
  farmLocationLabel: string;
  verifiedStationStatus: {
    connected: boolean;
    stationName: string | null;
    note: string;
  };
  calibrationPolicyNotice: string;
  forecastRecords: WeatherForecastRecordItem[];
  observations: FarmerWeatherObservationItem[];
  comparisons: WeatherComparisonRow[];
  summary: {
    sourceCategory: 'ai_generated_estimate' | 'forecast_information';
    poweredBy: 'gemini' | 'deterministic_summary';
    generatedAt: string;
    totalObservations: number;
    qcPassedCount: number;
    flaggedOutliersCount: number;
    avgRainfallVarianceMm: number | null;
    rainAgreementRatePercent: number | null;
    narrative: string;
    caveats: string[];
  };
}

export type BusinessScaleTier = 'small_scale' | 'medium_scale' | 'large_scale';

export interface BusinessPlanCalculation {
  estimatedStartupCostsZar: number;
  estimatedOperatingCostsZar: number;
  totalYearOneOutlayZar: number;
  estimatedProductionQty: number;
  productionUnit: string;
  estimatedRevenueZar: number;
  estimatedOperatingProfitLossZar: number;
  estimatedNetYearOneZar: number;
  breakEvenUnits: number | null;
  breakEvenPriceZar: number | null;
  costPerHectareZar: number;
  revenuePerHectareZar: number;
  costBreakdown: {
    key: string;
    label: string;
    categoryType: 'startup_capex' | 'operating_cost';
    amountZar: number;
    sharePercent: number;
  }[];
  resourceRequirements: {
    waterDemandM3: number;
    waterDemandLiters: number;
    labourWorkers: number;
    farmSizeHectares: number;
    summaryText: string;
  };
  actualFarmExpensesZar: number | null;
  actualExpensesNote: string;
  disclaimer: string;
}

export interface BusinessPlanScenarioItem {
  id: string;
  ownerId: string;
  farmId: string | null;
  farmName?: string | null;
  planName: string;
  farmingType: string;
  scaleTier: BusinessScaleTier;
  province: string;
  district: string;
  farmSizeHectares: number;
  productionGoals: string;
  marketChannel: string;
  equipmentCostZar: number;
  equipmentNotes: string;
  seedsPlantingCostZar: number;
  fertilisersCostZar: number;
  feedCostZar: number;
  waterCostZar: number;
  waterDemandM3: number;
  labourWorkers: number;
  labourCostZar: number;
  infrastructureCostZar: number;
  operatingExpensesZar: number;
  expectedProductionQty: number;
  productionUnit: string;
  sellingPricePerUnitZar: number;
  assumptionsNotes: string;
  createdAt: string;
  updatedAt: string;
  calculation: BusinessPlanCalculation;
}

export interface BusinessEnterpriseTemplate {
  code: string;
  name: string;
  category: string;
  productionUnit: string;
  defaultMarketChannel: string;
  scenarios: Record<
    BusinessScaleTier,
    {
      label: string;
      farmSizeHectares: number;
      productionGoals: string;
      equipmentCostZar: number;
      equipmentNotes: string;
      seedsPlantingCostZar: number;
      fertilisersCostZar: number;
      feedCostZar: number;
      waterCostZar: number;
      waterDemandM3: number;
      labourWorkers: number;
      labourCostZar: number;
      infrastructureCostZar: number;
      operatingExpensesZar: number;
      expectedProductionQty: number;
      sellingPricePerUnitZar: number;
      assumptionsNotes: string;
    }
  >;
}

export interface BusinessPlannerOverviewPayload {
  templates: BusinessEnterpriseTemplate[];
  savedPlans: BusinessPlanScenarioItem[];
  farmActualExpenses: {
    farmId: string;
    farmName: string;
    mixedExpensesZar: number;
    livestockCostsZar: number;
    cropActivityCostsZar: number;
    totalActualRecordedExpensesZar: number;
  }[];
  disclaimer: string;
}

export type LearningCategoryCode =
  | 'beginner_farming'
  | 'crop_production'
  | 'soil_preparation'
  | 'irrigation'
  | 'fertiliser_application'
  | 'pest_management'
  | 'plant_disease_awareness'
  | 'harvesting'
  | 'livestock_management'
  | 'animal_feeding'
  | 'animal_housing'
  | 'farm_equipment'
  | 'machinery_guidance'
  | 'agricultural_business_planning';

export type LearningContentType =
  | 'article'
  | 'step_by_step_guide'
  | 'illustrated_guide'
  | 'video_lesson';

export type LearningDifficulty = 'beginner' | 'intermediate' | 'experienced';

export interface LearningTranslation {
  title: string;
  summary: string;
  body: string;
  steps: string[];
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface VideoLessonSlide {
  heading: string;
  caption: string;
  visualCue: string;
  durationSeconds: number;
}

export interface LearningMaterialViewItem {
  id: string;
  slug: string;
  category: LearningCategoryCode;
  categoryLabel: string;
  contentType: LearningContentType;
  difficulty: LearningDifficulty;
  illustrationKey: string;
  customIllustrationDataUrl?: string | null;
  videoUrl?: string | null;
  videoDurationLabel?: string;
  videoSlides?: VideoLessonSlide[];
  sourceAttribution: string;
  verifiedOfficialReference: boolean;
  status: 'published' | 'draft' | 'archived';
  estimatedMinutes: number;
  tags: string[];
  resolvedLanguageCode: LanguageCode;
  isExactLanguageReviewed: boolean;
  availableReviewedLanguages: LanguageCode[];
  displayTitle: string;
  displaySummary: string;
  displayBody: string;
  displaySteps: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  translations?: Partial<Record<LanguageCode, LearningTranslation>>;
  userProgress: {
    isSaved: boolean;
    status: 'not_started' | 'in_progress' | 'completed';
    completedSteps: number[];
    progressPercent: number;
    lastAccessedAt: string | null;
    completedAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LearningCategoryMeta {
  code: LearningCategoryCode;
  label: string;
  description: string;
}

export interface LearningCentrePayload {
  categories: LearningCategoryMeta[];
  materials: LearningMaterialViewItem[];
  canManageContent: boolean;
  learnerStats: {
    totalPublished: number;
    completedCount: number;
    inProgressCount: number;
    savedCount: number;
    overallPercent: number;
  };
  officialGuidanceNotice: string;
}

export interface AiInsightItem {
  id: string;
  userId: string;
  farmId: string | null;
  farmName?: string | null;
  category: 'advisory' | 'analytics' | 'visual_analysis' | 'weather_summary';
  title: string;
  summary: string;
  recommendations: string[];
  languageCode: LanguageCode;
  poweredBy: 'gemini' | 'grounded_fallback' | 'deterministic_summary';
  createdAt: string;
}

export interface SavedProspectiveLocationItem {
  id: string;
  userId: string;
  province: string;
  district: string;
  townOrArea: string;
  intendedHectares: number;
  waterSourceNote: string;
  notes: string;
  createdAt: string;
  climateZone?: string;
  annualRainfallMm?: string;
  suitabilitySummary?: string;
}

export interface SystemAnnouncementItem {
  id: string;
  title: string;
  message: string;
  targetRole: RoleCode | 'all';
  severity: 'info' | 'advisory' | 'warning';
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
}

export interface ExistingFarmerDashboardPayload {
  mode: 'existing_farmer';
  filtersApplied: {
    farmId: string;
    fieldId: string;
    startDate: string;
    endDate: string;
    category: string;
  };
  overview: {
    registeredFarmsCount: number;
    totalHectares: number;
    cultivatedHectares: number;
    grazingHectares: number;
    farmingTypes: string[];
    registeredCropsCount: number;
    totalRemainingPlants: number;
    totalDamagedPlants: number;
    totalStoredCropKg: number;
    totalLivestockQuantity: number;
    activeIncidentsCount: number;
    activeWarningsCount: number;
    estimatedCropStockValueZar: number;
    estimatedLivestockValueZar: number;
    estimatedTotalStockValueZar: number;
    actualRecordedExpensesZar: number;
    estimationNotice: string;
  };
  farmsSummary: {
    id: string;
    name: string;
    province: string;
    district: string;
    totalHectares: number;
    fieldCount: number;
    farmingTypes: string[];
    cropsCount: number;
    livestockCount: number;
    estimatedStockValueZar: number;
    actualExpensesZar: number;
    activeIncidentsCount: number;
  }[];
  registeredCrops: {
    id: string;
    farmId: string;
    farmName: string;
    fieldName: string;
    cropName: string;
    cropVariety: string;
    growthStage: CropGrowthStage;
    cultivatedAreaHectares: number;
    remainingPlants: number;
    damagedPlants: number;
    harvestedKg: number;
    storedKg: number;
    expectedHarvestingDate: string;
    estimatedValueZar: number;
  }[];
  livestockSummary: {
    byAnimalType: { animalType: LivestockAnimalType; quantity: number; estimatedValueZar: number }[];
    groups: {
      id: string;
      farmId: string;
      farmName: string;
      groupName: string;
      animalType: LivestockAnimalType;
      breed: string;
      quantity: number;
      healthStatus: LivestockHealthStatus;
      estimatedValueZar: number;
    }[];
  };
  weatherSummary: {
    farmName: string;
    locationLabel: string;
    forecastSummary: string;
    latestTemperatureC: number | null;
    latestRainForecastMm: number | null;
    latestFarmerReport: FarmerWeatherObservationItem | null;
    activeWarnings: {
      id: string;
      title: string;
      severity: 'info' | 'warning' | 'critical';
      source: string;
      detail: string;
    }[];
  };
  upcomingActivities: {
    id: string;
    dueDate: string;
    farmName: string;
    category: 'harvest' | 'incident_follow_up' | 'weather_check' | 'soil_sampling';
    title: string;
    detail: string;
  }[];
  recentIncidents: FarmIncidentItem[];
  recentAiInsights: AiInsightItem[];
  recommendedNextActions: {
    id: string;
    priority: 'high' | 'medium' | 'normal';
    title: string;
    reason: string;
    actionTab: 'farms' | 'crops' | 'livestock' | 'soil' | 'weather' | 'visual' | 'stock' | 'incidents' | 'planner' | 'learning' | 'advisor';
    actionLabel: string;
  }[];
  analytics: {
    cropPerformance: {
      label: string;
      plantedQty: number;
      remainingQty: number;
      damagedQty: number;
      harvestedKg: number;
      estimatedValueZar: number;
    }[];
    livestockPerformance: {
      animalType: string;
      headCount: number;
      birthsAndPurchases: number;
      deathsAndSales: number;
      estimatedValueZar: number;
    }[];
    productionTrends: {
      period: string;
      harvestKg: number;
      livestockUnits: number;
      mixedFeedKg: number;
    }[];
    stockChanges: {
      id: string;
      date: string;
      itemLabel: string;
      movementType: string;
      deltaLabel: string;
      estimatedValueDeltaZar: number;
    }[];
    expenseSummaries: {
      mixedExpensesZar: number;
      cropActivityExpensesZar: number;
      livestockExpensesZar: number;
      totalActualExpensesZar: number;
      estimatedPlannedBudgetZar: number;
      byCategory: { label: string; amountZar: number }[];
    };
    damageAndLoss: {
      totalIncidents: number;
      activeIncidents: number;
      affectedPlants: number;
      affectedLivestock: number;
      affectedHectares: number;
      estimatedFinancialImpactZar: number;
      byIncidentType: { typeLabel: string; count: number; estimatedImpactZar: number }[];
    };
    weatherImpact: {
      storedForecastDays: number;
      farmerObservationsCount: number;
      avgRainfallVarianceMm: number | null;
      weatherIncidentsCount: number;
      recentDays: {
        date: string;
        forecastRainMm: number;
        reportedRainMm: number | null;
      }[];
    };
  };
  announcements: SystemAnnouncementItem[];
}

export interface ProspectiveDashboardPayload {
  mode: 'prospective_farmer';
  overview: {
    savedLocationsCount: number;
    farmingPlansCount: number;
    estimatedLowestStartupZar: number | null;
    learningCompletedCount: number;
    learningTotalCount: number;
    learningProgressPercent: number;
    estimationNotice: string;
  };
  opportunities: FarmingOpportunity[];
  savedLocations: SavedProspectiveLocationItem[];
  landSuitabilityRecommendations: {
    province: string;
    climateZone: string;
    annualRainfallMm: string;
    keyCommodities: string[];
    soilAndWaterGuidance: string;
  }[];
  suggestedActivities: {
    id: string;
    title: string;
    category: string;
    whyItFits: string;
    estimatedCycle: string;
    estimatedStarterScaleHa: number;
  }[];
  farmingPlans: BusinessPlanScenarioItem[];
  learningProgress: {
    totalPublished: number;
    completedCount: number;
    inProgressCount: number;
    savedCount: number;
    overallPercent: number;
    recentMaterials: LearningMaterialViewItem[];
  };
  recommendedNextSteps: {
    id: string;
    title: string;
    detail: string;
    completed: boolean;
    actionTab: 'planner' | 'learning' | 'advisor';
    actionLabel: string;
  }[];
  recentAiInsights: AiInsightItem[];
  announcements: SystemAnnouncementItem[];
}

export type ReportTypeCode =
  | 'farm_profiles'
  | 'crop_production'
  | 'livestock_production'
  | 'stock_levels'
  | 'stock_valuation'
  | 'agricultural_incidents'
  | 'damage_and_losses'
  | 'weather_observations'
  | 'ai_insights'
  | 'business_planning'
  | 'farm_expenses'
  | 'farm_performance';

export interface ReportTypeMeta {
  code: ReportTypeCode;
  label: string;
  description: string;
  containsEstimates: boolean;
}

export interface GeneratedReportResult {
  reportId: string;
  reportType: ReportTypeCode;
  reportTitle: string;
  generatedAt: string;
  generatedBy: string;
  farmLabel: string;
  isAggregatedOrganisationReport: boolean;
  privacyNotice: string;
  estimationNotice: string;
  filters: {
    farmId: string;
    startDate: string;
    endDate: string;
    farmingCategory: string;
  };
  kpis: { label: string; value: string; dataClassification: 'Database Record' | 'Estimated Value' | 'AI Advisory' }[];
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  rows: Record<string, string | number>[];
}

export interface GeneratedReportHistoryItem {
  id: string;
  reportType: ReportTypeCode;
  reportTitle: string;
  farmId: string | 'all';
  farmLabel: string;
  isAggregatedOrganisationReport: boolean;
  startDate: string;
  endDate: string;
  farmingCategory: string;
  rowCount: number;
  containsEstimatedValues: boolean;
  summaryHeadline: string;
  createdAt: string;
}

export interface AdminPortalOverviewPayload {
  stats: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    prospectiveFarmers: number;
    existingFarmers: number;
    agriculturalExperts: number;
    registeredOrganisations: number;
    systemAdministrators: number;
    totalRegisteredFarms: number;
    totalHectares: number;
    totalIncidentsReported: number;
  };
  farmsByProvince: {
    province: string;
    farmCount: number;
    totalHectares: number;
    incidentCount: number;
  }[];
  registrationTrends: {
    period: string;
    newUsers: number;
    newFarms: number;
  }[];
  recentActivity: AuditLogItem[];
  privacyNotice: string;
}

export interface AdminFarmOversightPayload {
  privacyNotice: string;
  hasPrivateRecordPermission: boolean;
  farms: {
    farmReferenceCode: string;
    farmId: string;
    farmNameDisplay: string;
    province: string;
    districtMunicipality: string;
    farmingCategories: string[];
    farmSizeHectares: number;
    waterAvailability: string;
    status: string;
    fieldCount: number;
    incidentCount: number;
    activeIncidentCount: number;
    createdAt: string;
  }[];
  byCategory: { category: string; farmCount: number }[];
  byProvince: { province: string; farmCount: number; hectares: number }[];
  reportedIncidentsSummary: {
    id: string;
    farmReferenceCode: string;
    province: string;
    incidentType: IncidentType;
    status: IncidentStatus;
    occurredAt: string;
    affectedAreaHectares: number;
  }[];
}

export interface AdminLanguageAuditRow {
  code: LanguageCode;
  name: string;
  nativeName: string;
  isActive: boolean;
  hasAudioSupport: boolean;
  hasSignLanguageSupport: boolean;
  totalUiKeys: number;
  translatedUiKeys: number;
  reviewedUiKeys: number;
  missingUiKeys: string[];
  learningMaterialsReviewedCount: number;
  totalPublishedMaterials: number;
}

export interface AdminTranslationEntry {
  key: string;
  englishDefault: string;
  currentValue: string;
  isMissing: boolean;
  isOverridden: boolean;
  reviewed: boolean;
  updatedAt: string | null;
}

export interface SystemConfigPayload {
  config: {
    application: {
      platformName: string;
      defaultLanguageCode: LanguageCode;
      allowSelfRegistration: boolean;
      maintenanceMode: boolean;
      maxMediaUploadMb: number;
      sessionTimeoutHours: number;
    };
    notifications: {
      inAppAlertsEnabled: boolean;
      emailDigestEnabled: boolean;
      rainfallAlertThresholdMm: number;
      heatAlertThresholdC: number;
      incidentEscalationNotify: boolean;
    };
    agriculturalReference: {
      supportedCategories: string[];
      defaultExtensionDeskEmail: string;
      soilLabGuidanceNote: string;
      valuationDisclaimerText: string;
      diagnosticSafetyNotice: string;
    };
    ai: {
      aiEnabled: boolean;
      primaryModel: string;
      fallbackModel: string;
      visualAnalysisEnabled: boolean;
      weatherAiSummaryEnabled: boolean;
      advisorySafetyDisclaimer: string;
    };
    updatedByUserId: string | null;
    updatedAt: string;
  };
  integrations: {
    id: string;
    name: string;
    status: 'connected' | 'not_configured' | 'active';
    detail: string;
  }[];
  announcements: SystemAnnouncementItem[];
}

export type ExpertSpecialisation =
  | 'agronomist'
  | 'soil_specialist'
  | 'livestock_specialist'
  | 'veterinarian'
  | 'agricultural_consultant';

export interface ExpertProfileItem {
  userId: string;
  specialisation: ExpertSpecialisation;
  secondarySpecialisations: ExpertSpecialisation[];
  qualifications: string;
  professionalBodyNumber: string;
  yearsExperience: number;
  provincesServed: string[];
  languagesSpoken: LanguageCode[];
  bio: string;
  availabilityStatus: 'available' | 'limited' | 'unavailable';
  updatedAt: string;
}

export interface FarmAccessScopes {
  overview: boolean;
  crops: boolean;
  soil: boolean;
  livestock: boolean;
  incidents: boolean;
  aiInsights: boolean;
  weather: boolean;
  financialSummary: boolean;
}

export interface FarmAccessGrantItem {
  id: string;
  farmId: string;
  farmName?: string;
  farmerUserId: string;
  granteeType: 'expert' | 'organisation';
  granteeUserId: string | null;
  organisationId: string | null;
  granteeLabel: string;
  scopes: FarmAccessScopes;
  authorisedBasis: string;
  status: 'active' | 'revoked';
  grantedAt: string;
  revokedAt: string | null;
}

export interface CollaborationDirectoryPayload {
  experts: {
    userId: string;
    fullName: string;
    province: string;
    district: string;
    specialisation: ExpertSpecialisation;
    qualifications: string;
    yearsExperience: number;
    availabilityStatus: string;
  }[];
  organisations: {
    id: string;
    name: string;
    organisationType: OrganisationType;
    province: string;
    district: string;
    primaryFocus: string;
  }[];
}

export type ExpertConcernCategory =
  | 'farm_info'
  | 'crop_concern'
  | 'soil_info'
  | 'livestock_concern'
  | 'ai_review'
  | 'incident_assistance'
  | 'general_guidance';

export interface ExpertFeedbackItem {
  id: string;
  expertUserId: string;
  expertName: string;
  expertSpecialisation: ExpertSpecialisation;
  farmId: string;
  farmName?: string;
  incidentId: string | null;
  cropId: string | null;
  livestockGroupId: string | null;
  soilReportId: string | null;
  aiInsightId: string | null;
  concernCategory: ExpertConcernCategory;
  subject: string;
  assessment: string;
  recommendations: string[];
  status: 'pending_review' | 'in_progress' | 'completed';
  farmerAcknowledged: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpertConcernQueueItem {
  id: string;
  concernType: 'incident' | 'crop_concern' | 'livestock_concern' | 'ai_review';
  farmId: string;
  farmName: string;
  province: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium' | 'normal';
  createdAt: string;
  linkedIncidentId?: string | null;
  linkedCropId?: string | null;
  linkedLivestockGroupId?: string | null;
  linkedAiInsightId?: string | null;
  hasExpertFeedback: boolean;
}

export interface ExpertOverviewPayload {
  profile: ExpertProfileItem;
  stats: {
    assignedFarmersCount: number;
    authorisedFarmsCount: number;
    pendingReviewsCount: number;
    openConcernsCount: number;
    recentFeedbackCount: number;
    completedConsultationsCount: number;
  };
  assignedFarms: {
    farmId: string;
    farmName: string;
    farmerUserId: string;
    farmerName: string;
    province: string;
    district: string;
    farmSizeHectares: number;
    farmingActivities: string[];
    scopes: FarmAccessScopes;
    authorisedBasis: string;
    grantedAt: string;
    openIncidentsCount: number;
    cropsCount: number;
    livestockHeadCount: number;
  }[];
  openConcerns: ExpertConcernQueueItem[];
  recentFeedback: ExpertFeedbackItem[];
  activityRecords: AuditLogItem[];
}

export interface ExpertFarmReviewPayload {
  farm: FarmItem;
  farmerName: string;
  scopes: FarmAccessScopes;
  crops: CropItem[];
  soilReports: SoilReportItem[];
  livestockGroups: LivestockGroupItem[];
  incidents: FarmIncidentItem[];
  aiInsights: AiInsightItem[];
  feedbackHistory: ExpertFeedbackItem[];
}

export type OrganisationType =
  | 'cooperative'
  | 'agricultural_company'
  | 'extension_agency'
  | 'research_body';

export type OrganisationMemberRole = 'owner' | 'manager' | 'analyst' | 'advisor';

export interface OrganisationProfileItem {
  id: string;
  name: string;
  organisationType: OrganisationType;
  registrationNumber: string;
  province: string;
  district: string;
  primaryFocus: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganisationMemberView {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  roleName: string;
  orgRole: OrganisationMemberRole;
  status: 'active' | 'inactive';
  joinedAt: string;
}

export interface OrganisationOverviewPayload {
  organisation: OrganisationProfileItem | null;
  privacyNotice: string;
  members: OrganisationMemberView[];
  kpis: {
    totalAuthorisedFarms: number;
    totalHectares: number;
    totalFields: number;
    activeFarmingCategories: number;
    totalLivestockHead: number;
    totalHarvestedKg: number;
    openIncidentsCount: number;
  };
  authorisedFarms: {
    farmId: string;
    farmReferenceCode: string;
    province: string;
    district: string;
    hectares: number;
    fieldCount: number;
    farmingCategories: string[];
    waterAvailability: string;
    cropsCount: number;
    harvestedKg: number;
    livestockHead: number;
    activeIncidentsCount: number;
    authorisedBasis: string;
  }[];
  farmingCategoriesSummary: { category: string; farmCount: number; hectares: number }[];
  provincialDistribution: {
    province: string;
    farmCount: number;
    hectares: number;
    cropCount: number;
    livestockHead: number;
    incidentsCount: number;
  }[];
  cropDistribution: { cropName: string; farmsCount: number; hectares: number; harvestedKg: number }[];
  livestockDistribution: { animalType: string; groupsCount: number; headCount: number }[];
  weatherComparisons: {
    province: string;
    farmReferenceCode: string;
    forecastRainMm: number | null;
    farmerReportedRainMm: number | null;
    avgTempC: number | null;
    observationDate: string | null;
    qcStatus: string | null;
  }[];
  trendAnalysis: {
    period: string;
    harvestKg: number;
    incidentsCount: number;
    weatherObservationsCount: number;
  }[];
}

export interface NotificationFeedPayload {
  notifications: NotificationItem[];
  unreadCount: number;
  deliveries: NotificationDeliveryItem[];
  integrationReadiness: {
    channel: 'in_app' | 'email' | 'sms' | 'push';
    configured: boolean;
    providerLabel: string;
    detail: string;
  }[];
}

export interface OfflineWeatherSnapshot {
  farmId: string;
  farmName: string;
  snapshotFetchedAt: string;
  forecasts: WeatherForecastRecordItem[];
  recentObservations: FarmerWeatherObservationItem[];
}

export interface OfflineBundlePayload {
  bundleVersion: number;
  userId: string;
  downloadedAt: string;
  staleAfterHours: number;
  weatherStaleAfterHours: number;
  internetRequiredNotice: string;
  farms: FarmItem[];
  crops: CropItem[];
  cropActivities: CropActivityItem[];
  livestockGroups: LivestockGroupItem[];
  livestockRecords: LivestockRecordItem[];
  stockOverview: StockOverviewPayload;
  incidents: FarmIncidentItem[];
  weatherSnapshots: OfflineWeatherSnapshot[];
  businessPlans: BusinessPlanScenarioItem[];
  learningGuides: LearningMaterialViewItem[];
}

export type OfflineMutationType =
  | 'crop_activity'
  | 'livestock_record'
  | 'mixed_entry'
  | 'farm_incident'
  | 'weather_observation'
  | 'crop_stock_movement'
  | 'business_plan_upsert'
  | 'crop_update';

export interface OfflineQueuedMutation {
  clientMutationId: string;
  userId: string;
  mutationType: OfflineMutationType;
  label: string;
  farmId?: string | null;
  farmName?: string | null;
  createdAt: string;
  baseUpdatedAt?: string | null;
  forceOverwrite?: boolean;
  payload: Record<string, unknown>;
  syncState: 'pending' | 'syncing' | 'conflict' | 'error';
  lastError?: string | null;
  serverUpdatedAt?: string | null;
  serverSummary?: string | null;
}

export interface OfflineSyncResultItem {
  clientMutationId: string;
  mutationType: string;
  status: 'synced' | 'already_synced' | 'conflict' | 'error';
  serverEntityId: string | null;
  message: string;
  serverUpdatedAt?: string | null;
  serverSummary?: string | null;
}

export interface OfflineSyncBatchResponse {
  results: OfflineSyncResultItem[];
  syncedAt: string;
}

export interface PopiaPrivacySummaryPayload {
  popiaComplianceNotice: string;
  sessionTimeoutHours: number;
  maxMediaUploadMb: number;
  activeSessionsCount: number;
  activeSharingGrantsCount: number;
  ownedFarmsCount: number;
  storedMediaCount: number;
  retentionSchedule: { category: string; rule: string }[];
  protectedCategories: string[];
}
