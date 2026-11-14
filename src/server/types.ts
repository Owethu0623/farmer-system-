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

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: 'advisory' | 'system' | 'opportunity' | 'weather';
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
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
  notifications: Notification[];
  auditLogs: AuditLog[];
  sessions: Session[];
  passwordResetTokens: PasswordResetToken[];
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
