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

export interface Role {
  id: string;
  code: RoleCode;
  name: string;
  description: string;
  createdAt: string;
}

export interface Language {
  id: string;
  code: LanguageCode;
  name: string;
  nativeName: string;
  hasAudioSupport: boolean;
  hasSignLanguageSupport: boolean;
  isActive: boolean;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  roleId: string;
  preferredLanguageCode: LanguageCode;
  isActive: boolean;
  isEmailVerified: boolean;
  onboardingCompleted: boolean;
  activationToken: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectiveFarmerData {
  preferredFarmingType: string;
  intendedLandSizeHectares: number;
  landAccessStatus: string;
  availableResources: string[];
  farmingExperience: string;
  agriculturalInterests: string[];
  farmingGoals: string[];
  notes?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface UserPermission {
  id: string;
  roleId: string;
  userId: string | null;
  permissionKey: string;
  isAllowed: boolean;
  createdAt: string;
}

export interface FarmingType {
  id: string;
  code: string;
  name: string;
  category: 'Crops' | 'Orchards' | 'Livestock' | 'Mixed';
  description: string;
}

export interface Farm {
  id: string;
  ownerId: string;
  name: string;
  farmingActivities: string[];
  farmSizeHectares: number;
  yearsOfExperience: number;
  waterAvailability: string;
  existingCrops: string[];
  existingLivestock: string[];
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
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

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface FarmBoundary {
  id: string;
  farmId: string;
  boundaryWkt: string;
  geojson: GeoJsonPolygon;
  calculatedAreaHectares: number;
  perimeterMeters: number;
  source: 'drawn_polygon' | 'vertex_edited' | 'user_sketch' | 'survey_upload';
  updatedAt: string;
}

export interface Field {
  id: string;
  farmId: string;
  name: string;
  farmingTypeId: string | null;
  cropOrLivestock: string;
  areaHectares: number;
  soilType: string;
  irrigationType: string;
  fieldWkt: string | null;
  geojson: GeoJsonPolygon | null;
  status: 'active' | 'fallow' | 'preparing';
  notes: string;
  createdAt: string;
  updatedAt: string;
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

export interface CropRecord {
  id: string;
  farmId: string;
  fieldId: string | null;
  ownerId: string;
  cropName: string;
  cropVariety: string;
  plantingDate: string;
  plantingQuantity: number;
  damagedPlants: number;
  cultivatedAreaHectares: number;
  soilInformation: string;
  irrigationMethod: string;
  fertiliserInformation: string;
  expectedHarvestingDate: string;
  growthStage: CropGrowthStage;
  harvestedQuantityKg: number;
  estimatedValueZar: number;
  status: 'active' | 'harvested' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface CropActivity {
  id: string;
  cropId: string;
  farmId: string;
  fieldId: string | null;
  actorUserId: string | null;
  activityType: CropActivityType;
  activityDate: string;
  quantity: number;
  unit: string;
  valueZar: number;
  notes: string;
  snapshot?: Record<string, unknown> | null;
  createdAt: string;
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

export interface LivestockGroup {
  id: string;
  farmId: string;
  fieldId: string | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface LivestockRecord {
  id: string;
  livestockGroupId: string;
  farmId: string;
  actorUserId: string | null;
  recordType: LivestockRecordType;
  recordDate: string;
  quantityChange: number;
  productionAmount: number;
  productionUnit: string;
  valueZar: number;
  notes: string;
  createdAt: string;
}

export type MixedEntryCategory =
  | 'feed_production'
  | 'shared_land'
  | 'water_management'
  | 'combined_expense'
  | 'combined_production';

export interface MixedFarmingEntry {
  id: string;
  farmId: string;
  ownerId: string;
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

export interface NotificationPreference {
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

export interface NotificationDeliveryAttempt {
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

export interface Notification {
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

export type ExpertSpecialisation =
  | 'agronomist'
  | 'soil_specialist'
  | 'livestock_specialist'
  | 'veterinarian'
  | 'agricultural_consultant';

export interface ExpertProfile {
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

export interface FarmAccessGrant {
  id: string;
  farmId: string;
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

export type ExpertConcernCategory =
  | 'farm_info'
  | 'crop_concern'
  | 'soil_info'
  | 'livestock_concern'
  | 'ai_review'
  | 'incident_assistance'
  | 'general_guidance';

export interface ExpertFeedbackRecord {
  id: string;
  expertUserId: string;
  expertName: string;
  expertSpecialisation: ExpertSpecialisation;
  farmId: string;
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

export type OrganisationType =
  | 'cooperative'
  | 'agricultural_company'
  | 'extension_agency'
  | 'research_body';

export interface OrganisationProfile {
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

export type OrganisationMemberRole = 'owner' | 'manager' | 'analyst' | 'advisor';

export interface OrganisationMembership {
  id: string;
  organisationId: string;
  userId: string;
  orgRole: OrganisationMemberRole;
  status: 'active' | 'inactive';
  joinedAt: string;
}

export interface AuditLog {
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

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface SoilReport {
  id: string;
  farmId: string;
  fieldId: string | null;
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

export interface VisualAnalysisRecord {
  id: string;
  farmId: string;
  fieldId: string | null;
  livestockGroupId: string | null;
  cropId: string | null;
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

export interface CropStockMovement {
  id: string;
  cropId: string;
  farmId: string;
  actorUserId: string | null;
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

export interface StockPriceSetting {
  id: string;
  farmId: string;
  entityType: 'crop_plant' | 'crop_harvest' | 'livestock';
  entityId: string;
  unitLabel: string;
  unitPriceZar: number;
  priceSource: string;
  updatedByUserId: string | null;
  updatedAt: string;
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

export interface IncidentFollowUp {
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

export interface FarmIncident {
  id: string;
  farmId: string;
  fieldId: string | null;
  cropId: string | null;
  livestockGroupId: string | null;
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
  followUps: IncidentFollowUp[];
  createdAt: string;
  updatedAt: string;
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

export interface WeatherForecastRecord {
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

export interface FarmerWeatherObservation {
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

export type BusinessScaleTier = 'small_scale' | 'medium_scale' | 'large_scale';

export interface BusinessPlanScenario {
  id: string;
  ownerId: string;
  farmId: string | null;
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

export interface LearningMaterial {
  id: string;
  slug: string;
  category: LearningCategoryCode;
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
  translations: Partial<Record<LanguageCode, LearningTranslation>>;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserLearningProgress {
  id: string;
  userId: string;
  materialId: string;
  isSaved: boolean;
  status: 'not_started' | 'in_progress' | 'completed';
  completedSteps: number[];
  progressPercent: number;
  lastAccessedAt: string;
  completedAt: string | null;
}

export interface AiInsightRecord {
  id: string;
  userId: string;
  farmId: string | null;
  category: 'advisory' | 'analytics' | 'visual_analysis' | 'weather_summary';
  title: string;
  summary: string;
  recommendations: string[];
  languageCode: LanguageCode;
  poweredBy: 'gemini' | 'grounded_fallback' | 'deterministic_summary';
  createdAt: string;
}

export interface SavedProspectiveLocation {
  id: string;
  userId: string;
  province: string;
  district: string;
  townOrArea: string;
  intendedHectares: number;
  waterSourceNote: string;
  notes: string;
  createdAt: string;
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

export interface GeneratedReportRecord {
  id: string;
  userId: string;
  roleCode: RoleCode;
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

export interface TranslationOverrideRecord {
  id: string;
  languageCode: LanguageCode;
  key: string;
  value: string;
  reviewed: boolean;
  updatedByUserId: string | null;
  updatedAt: string;
}

export interface SystemAnnouncement {
  id: string;
  title: string;
  message: string;
  targetRole: RoleCode | 'all';
  severity: 'info' | 'advisory' | 'warning';
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface SystemConfig {
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
}

export interface DatabaseSchema {
  roles: Role[];
  languages: Language[];
  users: User[];
  userProfiles: UserProfile[];
  userPermissions: UserPermission[];
  farmingTypes: FarmingType[];
  farms: Farm[];
  farmLocations: FarmLocation[];
  farmBoundaries: FarmBoundary[];
  fields: Field[];
  crops: CropRecord[];
  cropActivities: CropActivity[];
  livestockGroups: LivestockGroup[];
  livestockRecords: LivestockRecord[];
  mixedFarmingEntries: MixedFarmingEntry[];
  soilReports: SoilReport[];
  visualAnalyses: VisualAnalysisRecord[];
  cropStockMovements: CropStockMovement[];
  stockPriceSettings: StockPriceSetting[];
  farmIncidents: FarmIncident[];
  weatherForecastRecords: WeatherForecastRecord[];
  weatherObservations: FarmerWeatherObservation[];
  businessPlans: BusinessPlanScenario[];
  learningMaterials: LearningMaterial[];
  learningProgress: UserLearningProgress[];
  aiInsightRecords: AiInsightRecord[];
  savedProspectiveLocations: SavedProspectiveLocation[];
  generatedReports: GeneratedReportRecord[];
  translationOverrides: TranslationOverrideRecord[];
  systemConfig: SystemConfig;
  systemAnnouncements: SystemAnnouncement[];
  expertProfiles: ExpertProfile[];
  farmAccessGrants: FarmAccessGrant[];
  expertFeedbacks: ExpertFeedbackRecord[];
  organisations: OrganisationProfile[];
  organisationMemberships: OrganisationMembership[];
  notifications: Notification[];
  notificationPreferences: NotificationPreference[];
  notificationDeliveries: NotificationDeliveryAttempt[];
  auditLogs: AuditLog[];
  sessions: Session[];
  passwordResetTokens: PasswordResetToken[];
  processedSyncIds: {
    clientMutationId: string;
    userId: string;
    mutationType: string;
    serverEntityId: string | null;
    syncedAt: string;
  }[];
}

export interface SanitizedUser {
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
