import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  AiInsightRecord,
  AuditLog,
  BusinessPlanScenario,
  CropActivity,
  CropRecord,
  CropStockMovement,
  DatabaseSchema,
  ExpertFeedbackRecord,
  ExpertProfile,
  FarmAccessGrant,
  FarmIncident,
  FarmerWeatherObservation,
  LanguageCode,
  LivestockGroup,
  LivestockRecord,
  MixedFarmingEntry,
  Notification,
  NotificationDeliveryAttempt,
  NotificationPreference,
  OrganisationMembership,
  OrganisationProfile,
  RoleCode,
  SavedProspectiveLocation,
  SoilReport,
  StockPriceSetting,
  SystemAnnouncement,
  SystemConfig,
  VisualAnalysisRecord,
  WeatherForecastRecord,
} from './types.ts';
import { createSeedLearningMaterials } from './learningCentre.ts';
import {
  calculatePolygonAreaHectares,
  calculatePolygonPerimeterMeters,
  createBoxPolygonFromCentroid,
  pointToWkt,
  polygonToWkt,
} from './spatial.ts';

const DATA_FILE_PATH =
  process.env.DATA_FILE_PATH || path.resolve(process.cwd(), 'data', 'fieldshift-db.json');

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const ROLE_PERMISSION_MAP: Record<RoleCode, string[]> = {
  prospective_farmer: [
    'profile:read',
    'profile:update',
    'opportunities:discover',
    'suitability:explore',
    'business:plan',
    'learning:access',
    'reports:generate',
    'reports:export',
    'ai:advise',
  ],
  existing_farmer: [
    'profile:read',
    'profile:update',
    'farms:create',
    'farms:read_own',
    'farms:update_own',
    'farms:delete_own',
    'fields:manage_own',
    'crops:manage_own',
    'livestock:manage_own',
    'mixed:manage_own',
    'business:plan',
    'learning:access',
    'reports:generate',
    'reports:export',
    'ai:advise',
  ],
  agricultural_expert: [
    'profile:read',
    'profile:update',
    'farms:read_regional',
    'fields:review',
    'advisory:publish',
    'business:plan',
    'learning:access',
    'learning:manage',
    'reports:generate',
    'reports:export',
    'ai:advise',
  ],
  organisation_manager: [
    'profile:read',
    'profile:update',
    'farms:read_portfolio',
    'analytics:view_portfolio',
    'notifications:broadcast',
    'business:plan',
    'learning:access',
    'reports:generate',
    'reports:export',
    'reports:organisation_aggregate',
    'ai:advise',
  ],
  system_administrator: [
    'profile:read',
    'profile:update',
    'admin:portal_access',
    'admin:users_read',
    'admin:users_manage',
    'admin:roles_assign',
    'admin:permissions_manage',
    'admin:stats_view',
    'admin:audit_read',
    'admin:oversight_aggregated',
    'admin:languages_manage',
    'admin:config_manage',
    'business:plan',
    'learning:access',
    'learning:manage',
    'reports:generate',
    'reports:export',
    'ai:advise',
  ],
};

export function createDefaultSystemConfig(): SystemConfig {
  const now = new Date().toISOString();
  return {
    application: {
      platformName: 'Field Shift South Africa',
      defaultLanguageCode: 'en',
      allowSelfRegistration: true,
      maintenanceMode: false,
      maxMediaUploadMb: 12,
      sessionTimeoutHours: 168,
    },
    notifications: {
      inAppAlertsEnabled: true,
      emailDigestEnabled: false,
      rainfallAlertThresholdMm: 35,
      heatAlertThresholdC: 35,
      incidentEscalationNotify: true,
    },
    agriculturalReference: {
      supportedCategories: [
        'Field Crops',
        'Horticulture & Vegetables',
        'Orchards & Subtropical',
        'Livestock & Grazing',
        'Poultry & Small Stock',
        'Mixed Farming',
      ],
      defaultExtensionDeskEmail: 'extension@fieldshift.co.za',
      soilLabGuidanceNote:
        'Use accredited South African laboratories (e.g. ARC-SCW, Cedara, Elsenburg) with 0–20 cm composite topsoil cores.',
      valuationDisclaimerText:
        'Estimated stock values and business plans use user-entered prices or South African reference assumptions and do not guarantee market returns.',
      diagnosticSafetyNotice:
        'Visual AI and weather summaries provide decision support only and never replace certified veterinary or agronomic inspection.',
    },
    ai: {
      aiEnabled: true,
      primaryModel: 'gemini-4-hydrogen',
      fallbackModel: 'gemini-3.1-flash-lite',
      visualAnalysisEnabled: true,
      weatherAiSummaryEnabled: true,
      advisorySafetyDisclaimer:
        'AI insights are grounded in your farm records for guidance only. Always verify chemical labels and consult a qualified veterinarian or agronomist for serious issues.',
    },
    updatedByUserId: 'user-admin-1',
    updatedAt: now,
  };
}

function createSeedSystemAnnouncements(): SystemAnnouncement[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'ann-seed-1',
      title: 'Summer Rainy Season Field & Drainage Readiness',
      message:
        'Record farm rain-gauge readings after heavy storms in Weather Feedback and inspect low-lying contour drains to minimise waterlogging.',
      targetRole: 'all',
      severity: 'advisory',
      isActive: true,
      createdByUserId: 'user-admin-1',
      createdAt: now,
      expiresAt: null,
    },
  ];
}

function createSeedAiInsights(): AiInsightRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'ai-seed-1',
      userId: 'user-existing-1',
      farmId: 'farm-umgeni-1',
      category: 'analytics',
      title: 'Maize Top-Dressing & Drainage Follow-Up',
      summary:
        'Based on Cedara soil report CED-2026-4418A (pH H2O 6.2) and active storm-damage records on Upper Maize Block, prioritise clearing contour furrow outlets before applying LAN top-dressing.',
      recommendations: [
        'Complete follow-up count on hail-damaged plants in Upper Maize Block and update incident status.',
        'Schedule nitrogen split application only when topsoil moisture is below field capacity.',
      ],
      languageCode: 'en',
      poweredBy: 'grounded_fallback',
      createdAt: now,
    },
    {
      id: 'ai-seed-2',
      userId: 'user-prospective-1',
      farmId: null,
      category: 'advisory',
      title: 'Free State 2–4 ha Horticulture Water & Frost Planning',
      summary:
        'In Thabo Mofutsanyana District, winter night frost and spring rainfall variability mean leafy brassicas and drip-irrigated spinach require verified borehole storage buffer before planting.',
      recommendations: [
        'Verify borehole delivery rate (L/hr) and install a 5,000 L buffer tank.',
        'Compare small-scale vs medium-scale scenarios in the Business Planner before purchasing inputs.',
      ],
      languageCode: 'en',
      poweredBy: 'grounded_fallback',
      createdAt: now,
    },
  ];
}

function createSeedSavedLocations(): SavedProspectiveLocation[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'spl-seed-1',
      userId: 'user-prospective-1',
      province: 'Free State',
      district: 'Thabo Mofutsanyana District',
      townOrArea: 'Bethlehem Municipal Commonage',
      intendedHectares: 4,
      waterSourceNote: 'Existing shared borehole line + 5,000 L tank proposed',
      notes: 'Evaluating 5-year municipal lease plot close to fresh market buyers.',
      createdAt: now,
    },
    {
      id: 'spl-seed-2',
      userId: 'user-prospective-1',
      province: 'KwaZulu-Natal',
      district: 'uMgungundlovu District',
      townOrArea: 'Howick Smallholder Peri-Urban Belt',
      intendedHectares: 2,
      waterSourceNote: 'High summer rainfall (750–1,100 mm) + stream abstraction permit check',
      notes: 'Benchmarking frost-free shoulder season vegetable options.',
      createdAt: now,
    },
  ];
}

function createSeedSoilReports(): SoilReport[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'soilrep-umgeni-1',
      farmId: 'farm-umgeni-1',
      fieldId: 'fld-1',
      ownerId: 'user-existing-1',
      laboratoryName: 'KZN Cedara Soil Fertility & Analytical Lab',
      sampleCode: 'CED-2026-4418A',
      sampleDate: '2026-08-14',
      sampleDepthCm: '0-20 cm',
      soilPhWater: 6.2,
      soilPhKcl: 5.4,
      soilTextureClass: 'Clay Loam (Hutton Form)',
      clayPercent: 32,
      siltPercent: 24,
      sandPercent: 44,
      organicMatterPercent: 2.9,
      nitrogenMgKg: 38,
      phosphorusMgKg: 26,
      potassiumMgKg: 165,
      calciumMgKg: 1120,
      magnesiumMgKg: 245,
      cecCmolKg: 11.4,
      fertilityRating: 'Moderate',
      drainageClass: 'Well Drained',
      waterHoldingCapacityMmPerM: 145,
      attachmentFileName: 'cedara-soil-report-umgeni-aug2026.csv',
      attachmentSummary: 'Composite 15-core sample across Upper Maize Block; dolomitic lime applied 1.5 t/ha post-test.',
      notes: 'Phosphorus adequate for maize target 6 t/ha; nitrogen top-dressing recommended at V5 stage.',
      createdAt: now,
    },
  ];
}

function createSeedVisualStockAndIncidents(): {
  visualAnalyses: VisualAnalysisRecord[];
  cropStockMovements: CropStockMovement[];
  stockPriceSettings: StockPriceSetting[];
  farmIncidents: FarmIncident[];
} {
  const now = new Date().toISOString();

  const stockPriceSettings: StockPriceSetting[] = [
    {
      id: 'sprice-maize-plant',
      farmId: 'farm-umgeni-1',
      entityType: 'crop_plant',
      entityId: 'crop-maize-1',
      unitLabel: 'plant',
      unitPriceZar: 0.61,
      priceSource: 'Farmer-entered standing crop valuation (input + expected yield basis)',
      updatedByUserId: 'user-existing-1',
      updatedAt: now,
    },
    {
      id: 'sprice-maize-harvest',
      farmId: 'farm-umgeni-1',
      entityType: 'crop_harvest',
      entityId: 'crop-maize-1',
      unitLabel: 'kg',
      unitPriceZar: 4.35,
      priceSource: 'Farmer-entered yellow maize grain reference price',
      updatedByUserId: 'user-existing-1',
      updatedAt: now,
    },
    {
      id: 'sprice-spinach-plant',
      farmId: 'farm-umgeni-1',
      entityType: 'crop_plant',
      entityId: 'crop-spinach-2',
      unitLabel: 'plant',
      unitPriceZar: 1.9,
      priceSource: 'Farmer-entered standing vegetable valuation',
      updatedByUserId: 'user-existing-1',
      updatedAt: now,
    },
    {
      id: 'sprice-spinach-harvest',
      farmId: 'farm-umgeni-1',
      entityType: 'crop_harvest',
      entityId: 'crop-spinach-2',
      unitLabel: 'kg',
      unitPriceZar: 9.0,
      priceSource: 'Farmer-entered fresh produce market crate average',
      updatedByUserId: 'user-existing-1',
      updatedAt: now,
    },
    {
      id: 'sprice-cabbage-plant',
      farmId: 'farm-umgeni-1',
      entityType: 'crop_plant',
      entityId: 'crop-cabbage-3',
      unitLabel: 'head',
      unitPriceZar: 8.5,
      priceSource: 'Farmer-entered cabbage head valuation',
      updatedByUserId: 'user-existing-1',
      updatedAt: now,
    },
    {
      id: 'sprice-cabbage-harvest',
      farmId: 'farm-umgeni-1',
      entityType: 'crop_harvest',
      entityId: 'crop-cabbage-3',
      unitLabel: 'kg',
      unitPriceZar: 8.5,
      priceSource: 'Farmer-entered wholesale market price',
      updatedByUserId: 'user-existing-1',
      updatedAt: now,
    },
    {
      id: 'sprice-citrus-plant',
      farmId: 'farm-mkhambathini-2',
      entityType: 'crop_plant',
      entityId: 'crop-citrus-4',
      unitLabel: 'tree',
      unitPriceZar: 85.0,
      priceSource: 'Farmer-entered producing orchard tree annual crop value',
      updatedByUserId: 'user-existing-1',
      updatedAt: now,
    },
    {
      id: 'sprice-citrus-harvest',
      farmId: 'farm-mkhambathini-2',
      entityType: 'crop_harvest',
      entityId: 'crop-citrus-4',
      unitLabel: 'kg',
      unitPriceZar: 11.0,
      priceSource: 'Farmer-entered packhouse export/local blend price',
      updatedByUserId: 'user-existing-1',
      updatedAt: now,
    },
  ];

  const cropStockMovements: CropStockMovement[] = [
    {
      id: 'csm-1',
      cropId: 'crop-maize-1',
      farmId: 'farm-umgeni-1',
      actorUserId: 'user-existing-1',
      movementType: 'planting',
      movementDate: '2026-09-18',
      quantityDelta: 420000,
      unit: 'plants',
      unitPriceZar: 0.61,
      totalValueZar: 256200,
      resultingRemainingPlants: 420000,
      resultingStoredKg: 0,
      notes: 'Initial maize planting across North Contour Maize Block (10.5 ha).',
      incidentId: null,
      createdAt: now,
    },
    {
      id: 'csm-2',
      cropId: 'crop-maize-1',
      farmId: 'farm-umgeni-1',
      actorUserId: 'user-existing-1',
      movementType: 'damage',
      movementDate: '2026-11-02',
      quantityDelta: -14000,
      unit: 'plants',
      unitPriceZar: 0.61,
      totalValueZar: 8540,
      resultingRemainingPlants: 406000,
      resultingStoredKg: 0,
      notes: 'Early stalk borer damage recorded along north headland.',
      incidentId: 'inc-umgeni-pest-1',
      createdAt: now,
    },
    {
      id: 'csm-3',
      cropId: 'crop-spinach-2',
      farmId: 'farm-umgeni-1',
      actorUserId: 'user-existing-1',
      movementType: 'planting',
      movementDate: '2026-08-12',
      quantityDelta: 64000,
      unit: 'plants',
      unitPriceZar: 1.9,
      totalValueZar: 121600,
      resultingRemainingPlants: 64000,
      resultingStoredKg: 0,
      notes: 'Fordhook Giant spinach planted on drip terrace.',
      incidentId: null,
      createdAt: now,
    },
    {
      id: 'csm-4',
      cropId: 'crop-spinach-2',
      farmId: 'farm-umgeni-1',
      actorUserId: 'user-existing-1',
      movementType: 'damage',
      movementDate: '2026-10-19',
      quantityDelta: -2100,
      unit: 'plants',
      unitPriceZar: 1.9,
      totalValueZar: 3990,
      resultingRemainingPlants: 61900,
      resultingStoredKg: 0,
      notes: 'Hail and wind bruising on lower terrace rows.',
      incidentId: 'inc-umgeni-storm-2',
      createdAt: now,
    },
    {
      id: 'csm-5',
      cropId: 'crop-spinach-2',
      farmId: 'farm-umgeni-1',
      actorUserId: 'user-existing-1',
      movementType: 'harvest',
      movementDate: '2026-11-08',
      quantityDelta: 14200,
      unit: 'kg',
      unitPriceZar: 9.0,
      totalValueZar: 127800,
      resultingRemainingPlants: 61900,
      resultingStoredKg: 14200,
      notes: 'Harvested spinach bunches graded into cold room.',
      incidentId: null,
      createdAt: now,
    },
    {
      id: 'csm-6',
      cropId: 'crop-spinach-2',
      farmId: 'farm-umgeni-1',
      actorUserId: 'user-existing-1',
      movementType: 'sale',
      movementDate: '2026-11-09',
      quantityDelta: -11500,
      unit: 'kg',
      unitPriceZar: 9.0,
      totalValueZar: 103500,
      resultingRemainingPlants: 61900,
      resultingStoredKg: 2700,
      notes: 'Sold 11,500 kg crates to Pietermaritzburg Fresh Produce Market.',
      incidentId: null,
      createdAt: now,
    },
    {
      id: 'csm-7',
      cropId: 'crop-cabbage-3',
      farmId: 'farm-umgeni-1',
      actorUserId: 'user-existing-1',
      movementType: 'harvest',
      movementDate: '2026-11-10',
      quantityDelta: 6400,
      unit: 'kg',
      unitPriceZar: 8.5,
      totalValueZar: 54400,
      resultingRemainingPlants: 46150,
      resultingStoredKg: 6400,
      notes: 'First cut Conquistador F1 cabbage placed in packhouse.',
      incidentId: null,
      createdAt: now,
    },
    {
      id: 'csm-8',
      cropId: 'crop-citrus-4',
      farmId: 'farm-mkhambathini-2',
      actorUserId: 'user-existing-1',
      movementType: 'harvest',
      movementDate: '2026-07-20',
      quantityDelta: 28500,
      unit: 'kg',
      unitPriceZar: 11.0,
      totalValueZar: 313500,
      resultingRemainingPlants: 3555,
      resultingStoredKg: 4200,
      notes: 'Winter Navel orange harvest; 24,300 kg dispatched and 4,200 kg held in cold storage.',
      incidentId: null,
      createdAt: now,
    },
  ];

  const farmIncidents: FarmIncident[] = [
    {
      id: 'inc-umgeni-pest-1',
      farmId: 'farm-umgeni-1',
      fieldId: 'fld-1',
      cropId: 'crop-maize-1',
      livestockGroupId: null,
      visualAnalysisId: null,
      ownerId: 'user-existing-1',
      incidentType: 'pest_outbreak',
      title: 'Early Stalk Borer Pressure on North Maize Edge',
      occurredAt: '2026-11-02T07:30:00Z',
      description:
        'Scouting found pin-hole leaf feeding along the northern windbreak edge of North Contour Maize Block affecting 14,000 of the 420,000 originally planted maize stands.',
      mediaFileName: null,
      mediaType: null,
      mediaPreviewDataUrl: null,
      affectedQuantity: 14000,
      affectedUnit: 'plants',
      affectedAreaHectares: 0.35,
      originalRecordedQuantity: 420000,
      remainingRecordedQuantity: 406000,
      estimatedFinancialImpactZar: 8540,
      recommendedActions: [
        'Inspect adjacent rows at 7-day intervals for new egg batches.',
        'Consult local KZN extension agronomist before applying targeted control.',
      ],
      status: 'monitoring',
      followUps: [
        {
          id: 'fu-1',
          incidentId: 'inc-umgeni-pest-1',
          actorUserId: 'user-existing-1',
          actorName: 'Nomsa Dlamini',
          followUpDate: '2026-11-08',
          statusAfter: 'monitoring',
          actionTaken: 'Cleared border weeds and inspected whorl damage across rows 1–12.',
          notes: 'Damage stabilized; no spread beyond initial 0.35 ha zone.',
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'inc-umgeni-storm-2',
      farmId: 'farm-umgeni-1',
      fieldId: 'fld-2',
      cropId: 'crop-spinach-2',
      livestockGroupId: null,
      visualAnalysisId: null,
      ownerId: 'user-existing-1',
      incidentType: 'storm_damage',
      title: 'Afternoon Thunderstorm Wind & Light Hail Bruising',
      occurredAt: '2026-10-19T16:15:00Z',
      description:
        'Brief convective hail shower bruised outer leaves on 2,100 Swiss Chard plants on Lower Dam Vegetable Terrace.',
      mediaFileName: null,
      mediaType: null,
      mediaPreviewDataUrl: null,
      affectedQuantity: 2100,
      affectedUnit: 'plants',
      affectedAreaHectares: 0.12,
      originalRecordedQuantity: 64000,
      remainingRecordedQuantity: 61900,
      estimatedFinancialImpactZar: 3990,
      recommendedActions: [
        'Harvest undamaged inner leaves early and divert bruised trimmings to poultry feed.',
        'Check drip lateral emitters for silt clogging after storm runoff.',
      ],
      status: 'resolved',
      followUps: [
        {
          id: 'fu-2',
          incidentId: 'inc-umgeni-storm-2',
          actorUserId: 'user-existing-1',
          actorName: 'Nomsa Dlamini',
          followUpDate: '2026-10-22',
          statusAfter: 'resolved',
          actionTaken: 'Salvaged trimmed leaves for Layer Flock B and flushed drip lines.',
          notes: 'Remaining 61,900 stands recovered cleanly.',
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];

  const visualAnalyses: VisualAnalysisRecord[] = [];

  return { visualAnalyses, cropStockMovements, stockPriceSettings, farmIncidents };
}

function createSeedCropsAndLivestock(): {
  crops: CropRecord[];
  cropActivities: CropActivity[];
  livestockGroups: LivestockGroup[];
  livestockRecords: LivestockRecord[];
  mixedFarmingEntries: MixedFarmingEntry[];
} {
  const now = new Date().toISOString();

  const crops: CropRecord[] = [
    {
      id: 'crop-maize-1',
      farmId: 'farm-umgeni-1',
      fieldId: 'fld-1',
      ownerId: 'user-existing-1',
      cropName: 'Yellow Maize',
      cropVariety: 'PAN 6Q-308B',
      plantingDate: '2026-09-18',
      plantingQuantity: 420000,
      damagedPlants: 14000,
      cultivatedAreaHectares: 10.5,
      soilInformation: 'Hutton Red Loam · pH 6.2 · Lime applied Aug 2026',
      irrigationMethod: 'Rain-fed + Supplementary Sprinkler',
      fertiliserInformation: 'NPK 2:3:2 (22) + LAN top-dressing at 5 weeks',
      expectedHarvestingDate: '2027-02-20',
      growthStage: 'vegetative',
      harvestedQuantityKg: 0,
      estimatedValueZar: 248000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'crop-spinach-2',
      farmId: 'farm-umgeni-1',
      fieldId: 'fld-2',
      ownerId: 'user-existing-1',
      cropName: 'Swiss Chard (Spinach)',
      cropVariety: 'Fordhook Giant',
      plantingDate: '2026-08-12',
      plantingQuantity: 64000,
      damagedPlants: 2100,
      cultivatedAreaHectares: 1.6,
      soilInformation: 'Alluvial Sandy Clay Loam · High organic compost',
      irrigationMethod: 'Pressure-Compensated Drip',
      fertiliserInformation: 'Organic chicken manure + calcium nitrate fertigation',
      expectedHarvestingDate: '2026-11-30',
      growthStage: 'harvested',
      harvestedQuantityKg: 14200,
      estimatedValueZar: 127800,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'crop-cabbage-3',
      farmId: 'farm-umgeni-1',
      fieldId: 'fld-2',
      ownerId: 'user-existing-1',
      cropName: 'Green Cabbage',
      cropVariety: 'Conquistador F1',
      plantingDate: '2026-09-05',
      plantingQuantity: 48000,
      damagedPlants: 1850,
      cultivatedAreaHectares: 1.6,
      soilInformation: 'Alluvial Sandy Clay Loam · pH 6.5',
      irrigationMethod: 'Pressure-Compensated Drip',
      fertiliserInformation: '3:1:5 granular + Boron foliar spray',
      expectedHarvestingDate: '2026-12-10',
      growthStage: 'mature',
      harvestedQuantityKg: 6400,
      estimatedValueZar: 54400,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'crop-citrus-4',
      farmId: 'farm-mkhambathini-2',
      fieldId: 'fld-4',
      ownerId: 'user-existing-1',
      cropName: 'Navel Oranges',
      cropVariety: 'Bahianinha',
      plantingDate: '2023-07-15',
      plantingQuantity: 3600,
      damagedPlants: 45,
      cultivatedAreaHectares: 6.5,
      soilInformation: 'Well-drained Sandy Loam · pH 6.1',
      irrigationMethod: 'Micro-jet Orchard Irrigation',
      fertiliserInformation: 'Potassium nitrate + zinc/manganese foliar program',
      expectedHarvestingDate: '2027-06-15',
      growthStage: 'flowering',
      harvestedQuantityKg: 28500,
      estimatedValueZar: 313500,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const cropActivities: CropActivity[] = [
    {
      id: 'cact-1',
      cropId: 'crop-maize-1',
      farmId: 'farm-umgeni-1',
      fieldId: 'fld-1',
      actorUserId: 'user-existing-1',
      activityType: 'fertiliser',
      activityDate: '2026-10-24',
      quantity: 1200,
      unit: 'kg',
      valueZar: 16800,
      notes: 'LAN (28) top-dressing applied across North Contour Maize Block.',
      createdAt: now,
    },
    {
      id: 'cact-2',
      cropId: 'crop-maize-1',
      farmId: 'farm-umgeni-1',
      fieldId: 'fld-1',
      actorUserId: 'user-existing-1',
      activityType: 'pest',
      activityDate: '2026-11-02',
      quantity: 14000,
      unit: 'plants',
      valueZar: 0,
      notes: 'Early stalk borer scouting; targeted biological control applied on north edge.',
      createdAt: now,
    },
    {
      id: 'cact-3',
      cropId: 'crop-spinach-2',
      farmId: 'farm-umgeni-1',
      fieldId: 'fld-2',
      actorUserId: 'user-existing-1',
      activityType: 'harvest',
      activityDate: '2026-11-08',
      quantity: 14200,
      unit: 'kg',
      valueZar: 127800,
      notes: 'Bundled fresh bunches delivered to Pietermaritzburg Fresh Produce Market.',
      createdAt: now,
    },
    {
      id: 'cact-4',
      cropId: 'crop-cabbage-3',
      farmId: 'farm-umgeni-1',
      fieldId: 'fld-2',
      actorUserId: 'user-existing-1',
      activityType: 'irrigation',
      activityDate: '2026-11-10',
      quantity: 42000,
      unit: 'liters',
      valueZar: 0,
      notes: 'Drip cycle run 3.5 hours before morning heat.',
      createdAt: now,
    },
  ];

  const livestockGroups: LivestockGroup[] = [
    {
      id: 'lvk-nguni-1',
      farmId: 'farm-umgeni-1',
      fieldId: 'fld-3',
      ownerId: 'user-existing-1',
      animalType: 'Cattle',
      groupName: 'Midlands Nguni Breeding Herd',
      breed: 'Indigenous Nguni',
      quantity: 28,
      identificationNumber: 'KZN-ND-001 to 028',
      registrationDate: '2024-03-10',
      healthStatus: 'Healthy',
      feedingInformation: 'Rotational veld grazing + maize stover winter lick',
      grazingInformation: 'Upper Veld Rotational Camp (10.3 ha, 30-day cycle)',
      housingInformation: 'Open steel-pipe handling kraal with shade shelter',
      estimatedUnitValueZar: 14500,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lvk-layers-2',
      farmId: 'farm-umgeni-1',
      fieldId: null,
      ownerId: 'user-existing-1',
      animalType: 'Poultry',
      groupName: 'Free-Range Layer Flock B',
      breed: 'Lohmann Brown',
      quantity: 180,
      identificationNumber: 'BATCH-LAY-2026B',
      registrationDate: '2026-04-01',
      healthStatus: 'Healthy',
      feedingInformation: 'Layer mash (115g/bird/day) + chopped spinach trimmings',
      grazingInformation: 'Enclosed kikuyu scratch run adjacent to shed',
      housingInformation: 'Insulated deep-litter poultry house with nest boxes',
      estimatedUnitValueZar: 165,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lvk-goats-3',
      farmId: 'farm-mkhambathini-2',
      fieldId: null,
      ownerId: 'user-existing-1',
      animalType: 'Goats',
      groupName: 'Camperdown Boer Goat Flock',
      breed: 'Improved Boer Goat',
      quantity: 35,
      identificationNumber: 'MKH-BG-101 to 135',
      registrationDate: '2025-01-20',
      healthStatus: 'Healthy',
      feedingInformation: 'Acacia bushveld browse + mineral block',
      grazingInformation: '6 ha hillside bush camp',
      housingInformation: 'Raised slatted-floor goat shelter',
      estimatedUnitValueZar: 3200,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const livestockRecords: LivestockRecord[] = [
    {
      id: 'lrec-1',
      livestockGroupId: 'lvk-nguni-1',
      farmId: 'farm-umgeni-1',
      actorUserId: 'user-existing-1',
      recordType: 'Birth',
      recordDate: '2026-09-22',
      quantityChange: 4,
      productionAmount: 0,
      productionUnit: 'head',
      valueZar: 22000,
      notes: '4 healthy spring calves tagged and weighed.',
      createdAt: now,
    },
    {
      id: 'lrec-2',
      livestockGroupId: 'lvk-nguni-1',
      farmId: 'farm-umgeni-1',
      actorUserId: 'user-existing-1',
      recordType: 'Vaccination',
      recordDate: '2026-10-14',
      quantityChange: 0,
      productionAmount: 28,
      productionUnit: 'doses',
      valueZar: 1960,
      notes: 'Annual Anthrax & Blackquarter vaccination completed by district vet.',
      createdAt: now,
    },
    {
      id: 'lrec-3',
      livestockGroupId: 'lvk-layers-2',
      farmId: 'farm-umgeni-1',
      actorUserId: 'user-existing-1',
      recordType: 'Production',
      recordDate: '2026-11-11',
      quantityChange: 0,
      productionAmount: 4320,
      productionUnit: 'eggs',
      valueZar: 12960,
      notes: '30-day egg tray collection (90% laying rate).',
      createdAt: now,
    },
    {
      id: 'lrec-4',
      livestockGroupId: 'lvk-goats-3',
      farmId: 'farm-mkhambathini-2',
      actorUserId: 'user-existing-1',
      recordType: 'Sale',
      recordDate: '2026-10-28',
      quantityChange: -5,
      productionAmount: 5,
      productionUnit: 'head',
      valueZar: 16500,
      notes: 'Sold 5 weaned bucklings at local Pietermaritzburg livestock auction.',
      createdAt: now,
    },
  ];

  const mixedFarmingEntries: MixedFarmingEntry[] = [
    {
      id: 'mix-1',
      farmId: 'farm-umgeni-1',
      ownerId: 'user-existing-1',
      entryCategory: 'feed_production',
      title: 'Maize Stover & Spinach Trimming Allocation to Livestock',
      entryDate: '2026-11-05',
      relatedCropId: 'crop-spinach-2',
      relatedLivestockId: 'lvk-layers-2',
      expenseZar: 0,
      productionQuantity: 620,
      productionUnit: 'kg feed',
      waterLiters: 0,
      notes: 'Fresh vegetable trimmings fed daily to Free-Range Layer Flock B, lowering feed bill.',
      createdAt: now,
    },
    {
      id: 'mix-2',
      farmId: 'farm-umgeni-1',
      ownerId: 'user-existing-1',
      entryCategory: 'water_management',
      title: 'Solar Borehole Pump Distribution (Drip + Cattle Troughs)',
      entryDate: '2026-11-09',
      relatedCropId: null,
      relatedLivestockId: null,
      expenseZar: 1450,
      productionQuantity: 0,
      productionUnit: '',
      waterLiters: 68000,
      notes: '65% allocated to Lower Dam Vegetable Terrace drip lines, 35% to Upper Veld troughs.',
      createdAt: now,
    },
    {
      id: 'mix-3',
      farmId: 'farm-umgeni-1',
      ownerId: 'user-existing-1',
      entryCategory: 'combined_expense',
      title: 'Monthly Diesel, Borehole Maintenance & Kraal Fencing',
      entryDate: '2026-11-01',
      relatedCropId: null,
      relatedLivestockId: null,
      expenseZar: 8400,
      productionQuantity: 0,
      productionUnit: '',
      waterLiters: 0,
      notes: 'Shared farm infrastructure upkeep across maize block and cattle paddocks.',
      createdAt: now,
    },
  ];

  return {
    crops,
    cropActivities,
    livestockGroups,
    livestockRecords,
    mixedFarmingEntries,
  };
}

function createInitialSeed(): DatabaseSchema {
  const now = new Date().toISOString();
  const roles = [
    {
      id: 'role-prospective',
      code: 'prospective_farmer' as RoleCode,
      name: 'Prospective Farmer',
      description: 'Aspiring farmer discovering land suitability, opportunities, and beginner guidance.',
      createdAt: now,
    },
    {
      id: 'role-existing',
      code: 'existing_farmer' as RoleCode,
      name: 'Existing Farmer',
      description: 'Farm owner or operator managing farms, spatial boundaries, fields, crops, and livestock.',
      createdAt: now,
    },
    {
      id: 'role-expert',
      code: 'agricultural_expert' as RoleCode,
      name: 'Agricultural Expert',
      description: 'Agronomist or extension officer reviewing farms and advising farmers.',
      createdAt: now,
    },
    {
      id: 'role-org',
      code: 'organisation_manager' as RoleCode,
      name: 'Organisation Manager',
      description: 'Cooperative or agribusiness manager overseeing regional farm portfolios.',
      createdAt: now,
    },
    {
      id: 'role-admin',
      code: 'system_administrator' as RoleCode,
      name: 'System Administrator',
      description: 'Platform administrator managing users, roles, account activation, and audit logs.',
      createdAt: now,
    },
  ];

  const languages = [
    { id: 'lang-en', code: 'en' as LanguageCode, name: 'English', nativeName: 'English', hasAudioSupport: true, hasSignLanguageSupport: false, isActive: true },
    { id: 'lang-af', code: 'af' as LanguageCode, name: 'Afrikaans', nativeName: 'Afrikaans', hasAudioSupport: true, hasSignLanguageSupport: false, isActive: true },
    { id: 'lang-zu', code: 'zu' as LanguageCode, name: 'isiZulu', nativeName: 'isiZulu', hasAudioSupport: true, hasSignLanguageSupport: false, isActive: true },
    { id: 'lang-xh', code: 'xh' as LanguageCode, name: 'isiXhosa', nativeName: 'isiXhosa', hasAudioSupport: true, hasSignLanguageSupport: false, isActive: true },
    { id: 'lang-nso', code: 'nso' as LanguageCode, name: 'Sepedi', nativeName: 'Sepedi (Sesotho sa Leboa)', hasAudioSupport: true, hasSignLanguageSupport: false, isActive: true },
    { id: 'lang-st', code: 'st' as LanguageCode, name: 'Sesotho', nativeName: 'Sesotho', hasAudioSupport: true, hasSignLanguageSupport: false, isActive: true },
    { id: 'lang-tn', code: 'tn' as LanguageCode, name: 'Setswana', nativeName: 'Setswana', hasAudioSupport: true, hasSignLanguageSupport: false, isActive: true },
    { id: 'lang-ss', code: 'ss' as LanguageCode, name: 'siSwati', nativeName: 'siSwati', hasAudioSupport: true, hasSignLanguageSupport: false, isActive: true },
    { id: 'lang-ve', code: 've' as LanguageCode, name: 'Tshivenda', nativeName: 'Tshivenḓa', hasAudioSupport: true, hasSignLanguageSupport: false, isActive: true },
    { id: 'lang-ts', code: 'ts' as LanguageCode, name: 'Xitsonga', nativeName: 'Xitsonga', hasAudioSupport: true, hasSignLanguageSupport: false, isActive: true },
    { id: 'lang-nr', code: 'nr' as LanguageCode, name: 'isiNdebele', nativeName: 'isiNdebele', hasAudioSupport: true, hasSignLanguageSupport: false, isActive: true },
    { id: 'lang-sasl', code: 'sasl' as LanguageCode, name: 'South African Sign Language', nativeName: 'SASL (Visual & Sign Guide)', hasAudioSupport: false, hasSignLanguageSupport: true, isActive: true },
  ];

  const farmingTypes = [
    { id: 'ft-maize', code: 'grain_maize', name: 'Maize & Dryland Grain', category: 'Crops' as const, description: 'White and yellow maize, sorghum, sunflower, and soybean production.' },
    { id: 'ft-veg', code: 'horticulture_veg', name: 'Vegetables & Horticulture', category: 'Crops' as const, description: 'Spinach, cabbage, tomatoes, onions, potatoes, and tunnel crops.' },
    { id: 'ft-citrus', code: 'citrus_orchards', name: 'Citrus & Subtropical Fruit', category: 'Orchards' as const, description: 'Oranges, lemons, avocados, macadamia, and mangoes.' },
    { id: 'ft-cattle', code: 'beef_cattle', name: 'Beef & Nguni Cattle', category: 'Livestock' as const, description: 'Rotational veld grazing, Nguni, Bonsmara, and Brahman cattle.' },
    { id: 'ft-smallstock', code: 'small_stock', name: 'Goats & Sheep', category: 'Livestock' as const, description: 'Boer goats, Dorper sheep, and hardy small-stock pastoralism.' },
    { id: 'ft-poultry', code: 'poultry_eggs', name: 'Poultry & Layers', category: 'Livestock' as const, description: 'Broiler and free-range layer production.' },
    { id: 'ft-mixed', code: 'mixed_farming', name: 'Mixed Crop & Livestock', category: 'Mixed' as const, description: 'Integrated crop-livestock systems maximizing resilience.' },
  ];

  const demoPassword = hashPassword('FieldShift2026!');

  const users = [
    {
      id: 'user-prospective-1',
      email: 'thabo.mokoena@fieldshift.co.za',
      passwordHash: demoPassword.hash,
      passwordSalt: demoPassword.salt,
      roleId: 'role-prospective',
      preferredLanguageCode: 'st' as LanguageCode,
      isActive: true,
      isEmailVerified: true,
      onboardingCompleted: true,
      activationToken: null,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-existing-1',
      email: 'nomsa.dlamini@fieldshift.co.za',
      passwordHash: demoPassword.hash,
      passwordSalt: demoPassword.salt,
      roleId: 'role-existing',
      preferredLanguageCode: 'zu' as LanguageCode,
      isActive: true,
      isEmailVerified: true,
      onboardingCompleted: true,
      activationToken: null,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-expert-1',
      email: 'pieter.vandermerwe@fieldshift.co.za',
      passwordHash: demoPassword.hash,
      passwordSalt: demoPassword.salt,
      roleId: 'role-expert',
      preferredLanguageCode: 'af' as LanguageCode,
      isActive: true,
      isEmailVerified: true,
      onboardingCompleted: true,
      activationToken: null,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-org-1',
      email: 'lindiwe.nkosi@fieldshift.co.za',
      passwordHash: demoPassword.hash,
      passwordSalt: demoPassword.salt,
      roleId: 'role-org',
      preferredLanguageCode: 'ss' as LanguageCode,
      isActive: true,
      isEmailVerified: true,
      onboardingCompleted: true,
      activationToken: null,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-admin-1',
      email: 'admin@fieldshift.co.za',
      passwordHash: demoPassword.hash,
      passwordSalt: demoPassword.salt,
      roleId: 'role-admin',
      preferredLanguageCode: 'en' as LanguageCode,
      isActive: true,
      isEmailVerified: true,
      onboardingCompleted: true,
      activationToken: null,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const userProfiles = [
    {
      id: 'prof-1',
      userId: 'user-prospective-1',
      fullName: 'Thabo Mokoena',
      phoneNumber: '+27 82 410 3921',
      province: 'Free State',
      district: 'Thabo Mofutsanyana District',
      farmerExperienceYears: 1,
      accessibilityLargeText: false,
      accessibilityAudioGuidance: true,
      accessibilityVoiceInput: false,
      prospectiveData: {
        preferredFarmingType: 'Vegetables & Horticulture',
        intendedLandSizeHectares: 4,
        landAccessStatus: 'Leasing / Municipal Commonage',
        availableResources: ['Borehole Water', 'Basic Hand Tools', 'Local Cooperative Access'],
        farmingExperience: 'Home garden & seasonal assistant (1 year)',
        agriculturalInterests: ['Spinach & Cabbage', 'Drip Irrigation', 'Local Market Supply'],
        farmingGoals: ['Generate steady monthly income', 'Transition to full-time commercial production'],
      },
      bio: 'Aspiring horticulture farmer based near Bethlehem.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prof-2',
      userId: 'user-existing-1',
      fullName: 'Nomsa Dlamini',
      phoneNumber: '+27 83 729 1844',
      province: 'KwaZulu-Natal',
      district: 'uMgungundlovu District',
      farmerExperienceYears: 11,
      accessibilityLargeText: false,
      accessibilityAudioGuidance: false,
      accessibilityVoiceInput: false,
      prospectiveData: null,
      bio: 'Mixed maize, vegetable, and Nguni cattle producer in the KwaZulu-Natal Midlands.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prof-3',
      userId: 'user-expert-1',
      fullName: 'Dr. Pieter van der Merwe',
      phoneNumber: '+27 82 551 9034',
      province: 'Western Cape',
      district: 'Cape Winelands District',
      farmerExperienceYears: 18,
      accessibilityLargeText: false,
      accessibilityAudioGuidance: false,
      accessibilityVoiceInput: false,
      prospectiveData: null,
      bio: 'Soil scientist & precision irrigation specialist advising emerging and commercial growers.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prof-4',
      userId: 'user-org-1',
      fullName: 'Lindiwe Nkosi',
      phoneNumber: '+27 79 304 8812',
      province: 'Mpumalanga',
      district: 'Ehlanzeni District',
      farmerExperienceYears: 9,
      accessibilityLargeText: false,
      accessibilityAudioGuidance: false,
      accessibilityVoiceInput: false,
      prospectiveData: null,
      bio: 'Operations Manager at Lowveld Growers Cooperative supporting 42 smallholder farms.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prof-5',
      userId: 'user-admin-1',
      fullName: 'Sipho Khumalo',
      phoneNumber: '+27 82 001 4400',
      province: 'Gauteng',
      district: 'City of Tshwane Metro',
      farmerExperienceYears: 6,
      accessibilityLargeText: false,
      accessibilityAudioGuidance: false,
      accessibilityVoiceInput: false,
      prospectiveData: null,
      bio: 'Platform System Administrator for Field Shift South Africa.',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const userPermissions = Object.entries(ROLE_PERMISSION_MAP).flatMap(([roleCode, keys]) => {
    const role = roles.find((r) => r.code === roleCode)!;
    return keys.map((key, idx) => ({
      id: `perm-${role.id}-${idx}`,
      roleId: role.id,
      userId: null,
      permissionKey: key,
      isAllowed: true,
      createdAt: now,
    }));
  });

  const farm1Poly = createBoxPolygonFromCentroid(-29.5412, 30.2815, 24);
  const farm2Poly = createBoxPolygonFromCentroid(-29.6221, 30.4150, 12.5);

  const farms = [
    {
      id: 'farm-umgeni-1',
      ownerId: 'user-existing-1',
      name: 'uMngeni Valley Homestead Farm',
      farmingActivities: ['Maize & Dryland Grain', 'Vegetables & Horticulture', 'Beef & Nguni Cattle'],
      farmSizeHectares: 24,
      yearsOfExperience: 11,
      waterAvailability: 'Borehole & Perennial Stream',
      existingCrops: ['Yellow Maize', 'Swiss Chard (Spinach)', 'Cabbage'],
      existingLivestock: ['Nguni Cattle (28 head)', 'Free-Range Layers (180)'],
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'farm-mkhambathini-2',
      ownerId: 'user-existing-1',
      name: 'Mkhambathini Citrus & Goat Plot',
      farmingActivities: ['Citrus & Subtropical Fruit', 'Goats & Sheep'],
      farmSizeHectares: 12.5,
      yearsOfExperience: 5,
      waterAvailability: 'Earth Dam & Drip Line',
      existingCrops: ['Navel Oranges', 'Butternut Squash'],
      existingLivestock: ['Boer Goats (35 head)'],
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const farmLocations = [
    {
      id: 'loc-1',
      farmId: 'farm-umgeni-1',
      province: 'KwaZulu-Natal',
      districtMunicipality: 'uMgungundlovu District',
      localMunicipality: 'uMngeni',
      townOrVillage: 'Howick / KwaMevana',
      latitude: -29.5412,
      longitude: 30.2815,
      locationSource: 'manual_map_pin' as const,
      gpsLatitude: null,
      gpsLongitude: null,
      gpsAccuracyMeters: null,
      gpsCapturedAt: null,
      centroidWkt: pointToWkt(-29.5412, 30.2815),
      elevationMeters: 1062,
    },
    {
      id: 'loc-2',
      farmId: 'farm-mkhambathini-2',
      province: 'KwaZulu-Natal',
      districtMunicipality: 'uMgungundlovu District',
      localMunicipality: 'Mkhambathini',
      townOrVillage: 'Camperdown',
      latitude: -29.6221,
      longitude: 30.4150,
      locationSource: 'manual_map_pin' as const,
      gpsLatitude: null,
      gpsLongitude: null,
      gpsAccuracyMeters: null,
      gpsCapturedAt: null,
      centroidWkt: pointToWkt(-29.6221, 30.4150),
      elevationMeters: 785,
    },
  ];

  const farmBoundaries = [
    {
      id: 'bnd-1',
      farmId: 'farm-umgeni-1',
      boundaryWkt: polygonToWkt(farm1Poly),
      geojson: farm1Poly,
      calculatedAreaHectares: calculatePolygonAreaHectares(farm1Poly),
      perimeterMeters: calculatePolygonPerimeterMeters(farm1Poly),
      source: 'drawn_polygon' as const,
      updatedAt: now,
    },
    {
      id: 'bnd-2',
      farmId: 'farm-mkhambathini-2',
      boundaryWkt: polygonToWkt(farm2Poly),
      geojson: farm2Poly,
      calculatedAreaHectares: calculatePolygonAreaHectares(farm2Poly),
      perimeterMeters: calculatePolygonPerimeterMeters(farm2Poly),
      source: 'drawn_polygon' as const,
      updatedAt: now,
    },
  ];

  const fields = [
    {
      id: 'fld-1',
      farmId: 'farm-umgeni-1',
      name: 'North Contour Maize Block',
      farmingTypeId: 'ft-maize',
      cropOrLivestock: 'Yellow Maize (PAN 6Q-308B)',
      areaHectares: 10.5,
      soilType: 'Hutton Red Loam',
      irrigationType: 'Rain-fed + Supplementary Sprinkler',
      fieldWkt: null,
      geojson: createBoxPolygonFromCentroid(-29.5405, 30.2810, 10.5),
      status: 'active' as const,
      notes: 'Limed in August; good germination after early October rains.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'fld-2',
      farmId: 'farm-umgeni-1',
      name: 'Lower Dam Vegetable Terrace',
      farmingTypeId: 'ft-veg',
      cropOrLivestock: 'Swiss Chard & Green Cabbage',
      areaHectares: 3.2,
      soilType: 'Alluvial Sandy Clay Loam',
      irrigationType: 'Pressure-Compensated Drip',
      fieldWkt: null,
      geojson: createBoxPolygonFromCentroid(-29.5420, 30.2820, 3.2),
      status: 'active' as const,
      notes: 'Weekly harvesting for Pietermaritzburg fresh produce buyers.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'fld-3',
      farmId: 'farm-umgeni-1',
      name: 'Upper Veld Rotational Camp',
      farmingTypeId: 'ft-cattle',
      cropOrLivestock: 'Nguni Cattle Grazing (28 head)',
      areaHectares: 10.3,
      soilType: 'Kikuyu & Natural Veld Pasture',
      irrigationType: 'Solar Borehole Trough',
      fieldWkt: null,
      geojson: createBoxPolygonFromCentroid(-29.5415, 30.2800, 10.3),
      status: 'active' as const,
      notes: '30-day rotational paddock schedule.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'fld-4',
      farmId: 'farm-mkhambathini-2',
      name: 'East Slope Citrus Block A',
      farmingTypeId: 'ft-citrus',
      cropOrLivestock: 'Navel Oranges (4-year trees)',
      areaHectares: 6.5,
      soilType: 'Well-drained Sandy Loam',
      irrigationType: 'Micro-jet Orchard Irrigation',
      fieldWkt: null,
      geojson: createBoxPolygonFromCentroid(-29.6221, 30.4150, 6.5),
      status: 'active' as const,
      notes: 'Scheduled foliar micronutrient spray next week.',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const notifications: Notification[] = [
    {
      id: 'notif-1',
      userId: 'user-existing-1',
      title: 'Isixwayiso Sesimo Sezulu — uMgungundlovu',
      message:
        'Izulu elinamandla ntambama lilindeleke eHowick kuleli sonto. Misa ukuchelela eNorth Contour Maize Block ukonga amanzi nogesi.',
      category: 'weather_warning',
      priority: 'high',
      isMandatorySecurity: false,
      languageCode: 'zu',
      relatedEntityType: 'Farm',
      relatedEntityId: 'farm-umgeni-1',
      isRead: false,
      actionUrl: 'weather',
      createdAt: now,
    },
    {
      id: 'notif-1b',
      userId: 'user-existing-1',
      title: 'Izeluleko Zochwepheshe — Umhlabathi Nezitshalo',
      message:
        'UDkt. Pieter van der Merwe ubuzeze umbiko womhlabathi CED-2026-4418A futhi wancoma ukuhlola imisele yamanzi ngaphambi kokufaka umanyolo we-LAN.',
      category: 'expert_feedback',
      priority: 'normal',
      isMandatorySecurity: false,
      languageCode: 'zu',
      relatedEntityType: 'ExpertFeedback',
      relatedEntityId: 'ef-seed-1',
      isRead: false,
      actionUrl: 'soil',
      createdAt: now,
    },
    {
      id: 'notif-1c',
      userId: 'user-existing-1',
      title: 'Ukuhlolwa Kwesigameko Sesinambuzane',
      message:
        'Qapha uhlangothi lwasenyakatho lwe-North Contour Maize Block ngenxa yezibungu (stalk borer).',
      category: 'agricultural_incident',
      priority: 'high',
      isMandatorySecurity: false,
      languageCode: 'zu',
      relatedEntityType: 'FarmIncident',
      relatedEntityId: 'inc-umgeni-pest-1',
      isRead: false,
      actionUrl: 'incidents',
      createdAt: now,
    },
    {
      id: 'notif-2',
      userId: 'user-prospective-1',
      title: 'Monyetla o Mocha wa Temo — Thabo Mofutsanyana',
      message:
        'Ditsha tsa temo ya meroho tsa masepala (2–5 ha) di butswe bakeng sa borapolasi ba qalang.',
      category: 'upcoming_activity',
      priority: 'normal',
      isMandatorySecurity: false,
      languageCode: 'st',
      relatedEntityType: 'Opportunity',
      relatedEntityId: null,
      isRead: false,
      actionUrl: 'dashboard',
      createdAt: now,
    },
    {
      id: 'notif-3',
      userId: 'user-admin-1',
      title: 'Platform Seeded & Operational',
      message: 'All 12 official South African languages and 5 role permission policies are active.',
      category: 'account_security',
      priority: 'normal',
      isMandatorySecurity: true,
      languageCode: 'en',
      relatedEntityType: 'System',
      relatedEntityId: null,
      isRead: false,
      actionUrl: 'admin',
      createdAt: now,
    },
    {
      id: 'notif-4',
      userId: 'user-expert-1',
      title: 'Oop Boerdery-insident Toegewys (uMngeni Valley)',
      message:
        'Vroeë stamboorderdruk aangemeld op North Contour Maize Block. Boer het toegang verleen vir agronomiese hersiening.',
      category: 'agricultural_incident',
      priority: 'high',
      isMandatorySecurity: false,
      languageCode: 'af',
      relatedEntityType: 'FarmIncident',
      relatedEntityId: 'inc-umgeni-pest-1',
      isRead: false,
      actionUrl: 'dashboard',
      createdAt: now,
    },
    {
      id: 'notif-5',
      userId: 'user-org-1',
      title: 'Kwatiso ya Kopharashini — Tshekatsheko ya Masimo',
      message:
        'Amapulazi ama-2 e-KwaZulu-Natal ahlinzeka ngedatha yemikhakha evikelekile ngaphansi kwesivumelwano sokusebenzisana.',
      category: 'organisation_communication',
      priority: 'normal',
      isMandatorySecurity: false,
      languageCode: 'ss',
      relatedEntityType: 'Organisation',
      relatedEntityId: 'org-lowveld-1',
      isRead: false,
      actionUrl: 'dashboard',
      createdAt: now,
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'audit-1',
      actorUserId: 'user-admin-1',
      actorEmail: 'admin@fieldshift.co.za',
      action: 'SYSTEM_SEED_INITIALIZED',
      entityType: 'System',
      entityId: '001',
      details: { roles: roles.length, languages: languages.length, farms: farms.length },
      ipAddress: '127.0.0.1',
      createdAt: now,
    },
  ];

  const { crops, cropActivities, livestockGroups, livestockRecords, mixedFarmingEntries } =
    createSeedCropsAndLivestock();
  const soilReports = createSeedSoilReports();
  const { visualAnalyses, cropStockMovements, stockPriceSettings, farmIncidents } =
    createSeedVisualStockAndIncidents();
  const { weatherForecastRecords, weatherObservations } = createSeedWeatherFeedback();
  const businessPlans = createSeedBusinessPlans();
  const learningMaterials = createSeedLearningMaterials();
  const {
    expertProfiles,
    organisations,
    organisationMemberships,
    farmAccessGrants,
    expertFeedbacks,
    notificationPreferences,
    notificationDeliveries,
  } = createSeedPortalsAndNotifications();

  return {
    roles,
    languages,
    users,
    userProfiles,
    userPermissions,
    farmingTypes,
    farms,
    farmLocations,
    farmBoundaries,
    fields,
    crops,
    cropActivities,
    livestockGroups,
    livestockRecords,
    mixedFarmingEntries,
    soilReports,
    visualAnalyses,
    cropStockMovements,
    stockPriceSettings,
    farmIncidents,
    weatherForecastRecords,
    weatherObservations,
    businessPlans,
    learningMaterials,
    learningProgress: [],
    aiInsightRecords: createSeedAiInsights(),
    savedProspectiveLocations: createSeedSavedLocations(),
    generatedReports: [],
    translationOverrides: [],
    systemConfig: createDefaultSystemConfig(),
    systemAnnouncements: createSeedSystemAnnouncements(),
    expertProfiles,
    farmAccessGrants,
    expertFeedbacks,
    organisations,
    organisationMemberships,
    notifications,
    notificationPreferences,
    notificationDeliveries,
    auditLogs,
    sessions: [],
    passwordResetTokens: [],
    processedSyncIds: [],
  };
}

function createSeedPortalsAndNotifications(): {
  expertProfiles: ExpertProfile[];
  organisations: OrganisationProfile[];
  organisationMemberships: OrganisationMembership[];
  farmAccessGrants: FarmAccessGrant[];
  expertFeedbacks: ExpertFeedbackRecord[];
  notificationPreferences: NotificationPreference[];
  notificationDeliveries: NotificationDeliveryAttempt[];
} {
  const now = new Date().toISOString();

  const expertProfiles: ExpertProfile[] = [
    {
      userId: 'user-expert-1',
      specialisation: 'agronomist',
      secondarySpecialisations: ['soil_specialist'],
      qualifications: 'Ph.D. Agronomy & Soil Fertility (Stellenbosch University)',
      professionalBodyNumber: 'SACNASP Pr.Sci.Nat. 400218/08',
      yearsExperience: 18,
      provincesServed: ['Western Cape', 'KwaZulu-Natal', 'Free State'],
      languagesSpoken: ['af', 'en', 'zu'],
      bio: 'Senior soil fertility, contour drainage, and dryland grain agronomist advising smallholder and commercial producers across South Africa.',
      availabilityStatus: 'available',
      updatedAt: now,
    },
  ];

  const organisations: OrganisationProfile[] = [
    {
      id: 'org-lowveld-1',
      name: 'Lowveld & Midlands Growers Cooperative',
      organisationType: 'cooperative',
      registrationNumber: 'COOP-2019/044120/24',
      province: 'Mpumalanga',
      district: 'Ehlanzeni District',
      primaryFocus: 'Horticulture, Subtropical Citrus & Mixed Smallholder Support',
      contactEmail: 'operations@lowveldglowers.co.za',
      contactPhone: '+27 13 752 4410',
      description:
        'Agricultural cooperative coordinating extension intelligence, bulk input planning, and regional market readiness while safeguarding member farmer privacy.',
      ownerUserId: 'user-org-1',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const organisationMemberships: OrganisationMembership[] = [
    {
      id: 'orgmem-1',
      organisationId: 'org-lowveld-1',
      userId: 'user-org-1',
      orgRole: 'owner',
      status: 'active',
      joinedAt: now,
    },
  ];

  const farmAccessGrants: FarmAccessGrant[] = [
    {
      id: 'grant-exp-umgeni',
      farmId: 'farm-umgeni-1',
      farmerUserId: 'user-existing-1',
      granteeType: 'expert',
      granteeUserId: 'user-expert-1',
      organisationId: null,
      granteeLabel: 'Dr. Pieter van der Merwe (Agronomist / Soil Specialist)',
      scopes: {
        overview: true,
        crops: true,
        soil: true,
        livestock: true,
        incidents: true,
        aiInsights: true,
        weather: true,
        financialSummary: false,
      },
      authorisedBasis: 'Farmer explicit advisory grant',
      status: 'active',
      grantedAt: now,
      revokedAt: null,
    },
    {
      id: 'grant-exp-mkhambathini',
      farmId: 'farm-mkhambathini-2',
      farmerUserId: 'user-existing-1',
      granteeType: 'expert',
      granteeUserId: 'user-expert-1',
      organisationId: null,
      granteeLabel: 'Dr. Pieter van der Merwe (Agronomist / Soil Specialist)',
      scopes: {
        overview: true,
        crops: true,
        soil: true,
        livestock: true,
        incidents: true,
        aiInsights: true,
        weather: true,
        financialSummary: false,
      },
      authorisedBasis: 'Farmer explicit advisory grant',
      status: 'active',
      grantedAt: now,
      revokedAt: null,
    },
    {
      id: 'grant-org-umgeni',
      farmId: 'farm-umgeni-1',
      farmerUserId: 'user-existing-1',
      granteeType: 'organisation',
      granteeUserId: 'user-org-1',
      organisationId: 'org-lowveld-1',
      granteeLabel: 'Lowveld & Midlands Growers Cooperative',
      scopes: {
        overview: true,
        crops: true,
        soil: true,
        livestock: true,
        incidents: true,
        aiInsights: false,
        weather: true,
        financialSummary: false,
      },
      authorisedBasis: 'Cooperative member oversight consent (non-financial)',
      status: 'active',
      grantedAt: now,
      revokedAt: null,
    },
    {
      id: 'grant-org-mkhambathini',
      farmId: 'farm-mkhambathini-2',
      farmerUserId: 'user-existing-1',
      granteeType: 'organisation',
      granteeUserId: 'user-org-1',
      organisationId: 'org-lowveld-1',
      granteeLabel: 'Lowveld & Midlands Growers Cooperative',
      scopes: {
        overview: true,
        crops: true,
        soil: true,
        livestock: true,
        incidents: true,
        aiInsights: false,
        weather: true,
        financialSummary: false,
      },
      authorisedBasis: 'Cooperative member oversight consent (non-financial)',
      status: 'active',
      grantedAt: now,
      revokedAt: null,
    },
  ];

  const expertFeedbacks: ExpertFeedbackRecord[] = [
    {
      id: 'ef-seed-1',
      expertUserId: 'user-expert-1',
      expertName: 'Dr. Pieter van der Merwe',
      expertSpecialisation: 'agronomist',
      farmId: 'farm-umgeni-1',
      incidentId: null,
      cropId: 'crop-maize-1',
      livestockGroupId: null,
      soilReportId: 'soilrep-umgeni-1',
      aiInsightId: 'ai-seed-1',
      concernCategory: 'soil_info',
      subject: 'Cedara Soil Report CED-2026-4418A & AI Top-Dressing Validation',
      assessment:
        'Soil pH (H2O 6.2, KCl 5.4) and phosphorus (26 mg/kg) are well suited for yellow maize after your August dolomitic lime application. Confirmed the AI insight warning to clear contour outlets before applying LAN top-dressing.',
      recommendations: [
        'Delay LAN 28 top-dressing until standing surface water drains after heavy convective storms.',
        'Recheck topsoil pH in 12 months to verify lime reaction across the 0–20 cm horizon.',
      ],
      status: 'completed',
      farmerAcknowledged: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'ef-seed-2',
      expertUserId: 'user-expert-1',
      expertName: 'Dr. Pieter van der Merwe',
      expertSpecialisation: 'agronomist',
      farmId: 'farm-umgeni-1',
      incidentId: 'inc-umgeni-pest-1',
      cropId: 'crop-maize-1',
      livestockGroupId: null,
      soilReportId: null,
      aiInsightId: null,
      concernCategory: 'incident_assistance',
      subject: 'Follow-Up Guidance on Stalk Borer North Headland Edge',
      assessment:
        'Pin-hole feeding on 14,000 border stands represents ~3.3% incidence. Good decision clearing border grass hosts; monitor interior rows before escalating treatment.',
      recommendations: [
        'Inspect 20 consecutive maize whorls in 5 interior transects over the next 7 days.',
        'If threshold exceeds 10% fresh whorl damage, request registered target-specific control advice from your local registered pest control advisor.',
      ],
      status: 'in_progress',
      farmerAcknowledged: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    expertProfiles,
    organisations,
    organisationMemberships,
    farmAccessGrants,
    expertFeedbacks,
    notificationPreferences: [],
    notificationDeliveries: [],
  };
}

function createSeedWeatherFeedback(): {
  weatherForecastRecords: WeatherForecastRecord[];
  weatherObservations: FarmerWeatherObservation[];
} {
  const now = new Date();
  const dayOffsetIso = (daysAgo: number) => {
    const d = new Date(now.getTime() - daysAgo * 86400000);
    return d.toISOString().slice(0, 10);
  };
  const d3 = dayOffsetIso(3);
  const d1 = dayOffsetIso(1);

  const weatherForecastRecords: WeatherForecastRecord[] = [
    {
      id: 'wfc-seed-1',
      farmId: 'farm-umgeni-1',
      forecastDate: d3,
      fetchedAt: `${d3}T06:00:00.000Z`,
      sourceName: 'Open-Meteo Coordinate Weather Forecast Snapshot',
      sourceCategory: 'forecast_information',
      verifiedStationName: null,
      verifiedStationRainMm: null,
      verifiedStationTempC: null,
      predictedRainfallMm: 14.5,
      predictedTempMinC: 13.0,
      predictedTempMaxC: 24.5,
      predictedWindMaxKmh: 22.0,
      weatherDescription: 'Afternoon thundershowers expected',
    },
    {
      id: 'wfc-seed-2',
      farmId: 'farm-umgeni-1',
      forecastDate: d1,
      fetchedAt: `${d1}T06:00:00.000Z`,
      sourceName: 'Open-Meteo Coordinate Weather Forecast Snapshot',
      sourceCategory: 'forecast_information',
      verifiedStationName: null,
      verifiedStationRainMm: null,
      verifiedStationTempC: null,
      predictedRainfallMm: 4.0,
      predictedTempMinC: 12.2,
      predictedTempMaxC: 26.0,
      predictedWindMaxKmh: 16.5,
      weatherDescription: 'Partly cloudy with light evening shower risk',
    },
  ];

  const weatherObservations: FarmerWeatherObservation[] = [
    {
      id: 'wobs-seed-1',
      farmId: 'farm-umgeni-1',
      ownerId: 'user-existing-1',
      farmLocationLabel: 'Howick West, uMngeni, KwaZulu-Natal',
      latitude: -29.5412,
      longitude: 30.2814,
      observationDate: d3,
      rainfallOccurred: true,
      rainfallIntensity: 'heavy',
      measuredRainfallMm: 21.0,
      temperatureC: 22.5,
      windObservation: 'moderate_wind',
      windSpeedEstimateKmh: 25,
      notes: 'Manual rain gauge near North Maize Block measured 21 mm during a sharp 45-minute afternoon storm.',
      sourceCategory: 'farmer_reported_observation',
      qcStatus: 'qc_passed_reference',
      qcNotes: 'Passed basic plausibility check as a farmer-reported observation. Not a verified weather-station measurement; retained only for potential quality-controlled calibration review.',
      comparedForecastRecordId: 'wfc-seed-1',
      createdAt: `${d3}T18:15:00.000Z`,
      updatedAt: `${d3}T18:15:00.000Z`,
    },
    {
      id: 'wobs-seed-2',
      farmId: 'farm-umgeni-1',
      ownerId: 'user-existing-1',
      farmLocationLabel: 'Howick West, uMngeni, KwaZulu-Natal',
      latitude: -29.5412,
      longitude: 30.2814,
      observationDate: d1,
      rainfallOccurred: false,
      rainfallIntensity: 'none',
      measuredRainfallMm: 0,
      temperatureC: 25.0,
      windObservation: 'light_breeze',
      windSpeedEstimateKmh: 14,
      notes: 'Storm cells stayed south over Pietermaritzburg; zero rain on farm gauge.',
      sourceCategory: 'farmer_reported_observation',
      qcStatus: 'qc_passed_reference',
      qcNotes: 'Passed basic plausibility check as a farmer-reported observation. Not a verified weather-station measurement; retained only for potential quality-controlled calibration review.',
      comparedForecastRecordId: 'wfc-seed-2',
      createdAt: `${d1}T17:45:00.000Z`,
      updatedAt: `${d1}T17:45:00.000Z`,
    },
  ];

  return { weatherForecastRecords, weatherObservations };
}

function createSeedBusinessPlans(): BusinessPlanScenario[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'bplan-seed-prospective-1',
      ownerId: 'user-prospective-1',
      farmId: null,
      planName: 'Thabo Mofutsanyana 2 ha Mixed Spinach & Cabbage Starter Plan',
      farmingType: 'horticulture_veg',
      scaleTier: 'small_scale',
      province: 'Free State',
      district: 'Thabo Mofutsanyana District',
      farmSizeHectares: 2,
      productionGoals: 'Supply local retail and school buyers with staggered leafy vegetables across 2 ha.',
      marketChannel: 'Local Fresh Produce Market & School Nutrition Buyers',
      equipmentCostZar: 24000,
      equipmentNotes: 'Two knapsack sprayers, crates, digital scale, drip tape fittings.',
      seedsPlantingCostZar: 17500,
      fertilisersCostZar: 21000,
      feedCostZar: 0,
      waterCostZar: 11500,
      waterDemandM3: 7800,
      labourWorkers: 3,
      labourCostZar: 82000,
      infrastructureCostZar: 42000,
      operatingExpensesZar: 24000,
      expectedProductionQty: 32000,
      productionUnit: 'kg',
      sellingPricePerUnitZar: 8.5,
      assumptionsNotes: 'Planning estimate assuming staggered planting and 10% post-harvest loss allowance; non-guaranteed.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'bplan-seed-existing-1',
      ownerId: 'user-existing-1',
      farmId: 'farm-umgeni-1',
      planName: 'uMngeni Homestead Seasonal Expansion Scenario (5 ha Vegetables)',
      farmingType: 'horticulture_veg',
      scaleTier: 'medium_scale',
      province: 'KwaZulu-Natal',
      district: 'uMgungundlovu District',
      farmSizeHectares: 5,
      productionGoals: 'Expand drip-irrigated vegetable terrace output alongside existing maize and Nguni cattle.',
      marketChannel: 'Pietermaritzburg Fresh Produce Market & Regional Wholesalers',
      equipmentCostZar: 78000,
      equipmentNotes: 'Boom sprayer upgrade, vegetable bed former, sorting shed tables.',
      seedsPlantingCostZar: 41000,
      fertilisersCostZar: 48000,
      feedCostZar: 0,
      waterCostZar: 26000,
      waterDemandM3: 18500,
      labourWorkers: 6,
      labourCostZar: 175000,
      infrastructureCostZar: 95000,
      operatingExpensesZar: 62000,
      expectedProductionQty: 92000,
      productionUnit: 'kg',
      sellingPricePerUnitZar: 8.4,
      assumptionsNotes: 'Linked to uMngeni Homestead Farm to benchmark estimates against recorded expenses.',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

class FieldShiftStore {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadOrSeed();
  }

  private loadOrSeed(): DatabaseSchema {
    try {
      const dir = path.dirname(DATA_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE_PATH)) {
        const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.roles)) {
          let migrated = false;
          const seedModules = createSeedCropsAndLivestock();
          const seedVsi = createSeedVisualStockAndIncidents();

          if (!Array.isArray(parsed.crops)) {
            parsed.crops = seedModules.crops;
            parsed.cropActivities = seedModules.cropActivities;
            migrated = true;
          }
          if (!Array.isArray(parsed.cropActivities)) {
            parsed.cropActivities = seedModules.cropActivities;
            migrated = true;
          }
          if (!Array.isArray(parsed.livestockGroups)) {
            parsed.livestockGroups = seedModules.livestockGroups;
            parsed.livestockRecords = seedModules.livestockRecords;
            migrated = true;
          }
          if (!Array.isArray(parsed.livestockRecords)) {
            parsed.livestockRecords = seedModules.livestockRecords;
            migrated = true;
          }
          if (!Array.isArray(parsed.mixedFarmingEntries)) {
            parsed.mixedFarmingEntries = seedModules.mixedFarmingEntries;
            migrated = true;
          }
          if (!Array.isArray(parsed.soilReports)) {
            parsed.soilReports = createSeedSoilReports();
            migrated = true;
          }
          if (!Array.isArray(parsed.visualAnalyses)) {
            parsed.visualAnalyses = seedVsi.visualAnalyses;
            migrated = true;
          }
          if (!Array.isArray(parsed.cropStockMovements)) {
            parsed.cropStockMovements = seedVsi.cropStockMovements;
            migrated = true;
          }
          if (!Array.isArray(parsed.stockPriceSettings)) {
            parsed.stockPriceSettings = seedVsi.stockPriceSettings;
            migrated = true;
          }
          if (!Array.isArray(parsed.farmIncidents)) {
            parsed.farmIncidents = seedVsi.farmIncidents;
            migrated = true;
          }
          if (!Array.isArray(parsed.weatherForecastRecords) || !Array.isArray(parsed.weatherObservations)) {
            const seedWf = createSeedWeatherFeedback();
            if (!Array.isArray(parsed.weatherForecastRecords)) {
              parsed.weatherForecastRecords = seedWf.weatherForecastRecords;
            }
            if (!Array.isArray(parsed.weatherObservations)) {
              parsed.weatherObservations = seedWf.weatherObservations;
            }
            migrated = true;
          }
          if (!Array.isArray(parsed.businessPlans)) {
            parsed.businessPlans = createSeedBusinessPlans();
            migrated = true;
          }
          if (!Array.isArray(parsed.learningMaterials)) {
            parsed.learningMaterials = createSeedLearningMaterials();
            migrated = true;
          }
          if (!Array.isArray(parsed.learningProgress)) {
            parsed.learningProgress = [];
            migrated = true;
          }
          if (!Array.isArray(parsed.aiInsightRecords)) {
            parsed.aiInsightRecords = createSeedAiInsights();
            migrated = true;
          }
          if (!Array.isArray(parsed.savedProspectiveLocations)) {
            parsed.savedProspectiveLocations = createSeedSavedLocations();
            migrated = true;
          }
          if (!Array.isArray(parsed.generatedReports)) {
            parsed.generatedReports = [];
            migrated = true;
          }
          if (!Array.isArray(parsed.translationOverrides)) {
            parsed.translationOverrides = [];
            migrated = true;
          }
          if (!parsed.systemConfig) {
            parsed.systemConfig = createDefaultSystemConfig();
            migrated = true;
          }
          if (!Array.isArray(parsed.systemAnnouncements)) {
            parsed.systemAnnouncements = createSeedSystemAnnouncements();
            migrated = true;
          }
          if (
            !Array.isArray(parsed.expertProfiles) ||
            !Array.isArray(parsed.organisations) ||
            !Array.isArray(parsed.farmAccessGrants) ||
            !Array.isArray(parsed.expertFeedbacks)
          ) {
            const seedPortals = createSeedPortalsAndNotifications();
            if (!Array.isArray(parsed.expertProfiles)) {
              parsed.expertProfiles = seedPortals.expertProfiles;
            }
            if (!Array.isArray(parsed.organisations)) {
              parsed.organisations = seedPortals.organisations;
            }
            if (!Array.isArray(parsed.organisationMemberships)) {
              parsed.organisationMemberships = seedPortals.organisationMemberships;
            }
            if (!Array.isArray(parsed.farmAccessGrants)) {
              parsed.farmAccessGrants = seedPortals.farmAccessGrants;
            }
            if (!Array.isArray(parsed.expertFeedbacks)) {
              parsed.expertFeedbacks = seedPortals.expertFeedbacks;
            }
            if (!Array.isArray(parsed.notificationPreferences)) {
              parsed.notificationPreferences = seedPortals.notificationPreferences;
            }
            if (!Array.isArray(parsed.notificationDeliveries)) {
              parsed.notificationDeliveries = seedPortals.notificationDeliveries;
            }
            migrated = true;
          }
          if (!Array.isArray(parsed.notificationPreferences)) {
            parsed.notificationPreferences = [];
            migrated = true;
          }
          if (!Array.isArray(parsed.notificationDeliveries)) {
            parsed.notificationDeliveries = [];
            migrated = true;
          }
          if (Array.isArray(parsed.farmLocations)) {
            for (const loc of parsed.farmLocations) {
              if (!loc.locationSource) {
                loc.locationSource = 'manual_map_pin';
                loc.gpsLatitude = loc.gpsLatitude ?? null;
                loc.gpsLongitude = loc.gpsLongitude ?? null;
                loc.gpsAccuracyMeters = loc.gpsAccuracyMeters ?? null;
                loc.gpsCapturedAt = loc.gpsCapturedAt ?? null;
                migrated = true;
              }
            }
          }
          // Ensure existing users receive updated role permissions and least-privilege admin defaults
          if (Array.isArray(parsed.users) && Array.isArray(parsed.roles) && Array.isArray(parsed.userPermissions)) {
            const legacyAdminPermCount = parsed.userPermissions.length;
            parsed.userPermissions = parsed.userPermissions.filter((p) => p.permissionKey !== 'farms:read_all');
            if (parsed.userPermissions.length !== legacyAdminPermCount) {
              migrated = true;
            }
            for (const u of parsed.users) {
              const role = parsed.roles.find((r) => r.id === u.roleId);
              if (role) {
                const expectedPerms = ROLE_PERMISSION_MAP[role.code] || [];
                for (const key of expectedPerms) {
                  const has = parsed.userPermissions.some(
                    (p) => p.userId === u.id && p.permissionKey === key
                  );
                  if (!has) {
                    parsed.userPermissions.push({
                      id: `perm-${crypto.randomUUID()}`,
                      roleId: role.id,
                      userId: u.id,
                      permissionKey: key,
                      isAllowed: true,
                      createdAt: new Date().toISOString(),
                    });
                    migrated = true;
                  }
                }
              }
            }
          }

          if (!Array.isArray(parsed.processedSyncIds)) {
            parsed.processedSyncIds = [];
            migrated = true;
          }
          const nowMs = Date.now();
          if (Array.isArray(parsed.sessions)) {
            const validSessions = parsed.sessions.filter(
              (s) => s.expiresAt && new Date(s.expiresAt).getTime() > nowMs
            );
            if (validSessions.length !== parsed.sessions.length) {
              parsed.sessions = validSessions;
              migrated = true;
            }
          }
          if (Array.isArray(parsed.passwordResetTokens)) {
            const validTokens = parsed.passwordResetTokens.filter(
              (t) => !t.usedAt && t.expiresAt && new Date(t.expiresAt).getTime() > nowMs - 86400000
            );
            if (validTokens.length !== parsed.passwordResetTokens.length) {
              parsed.passwordResetTokens = validTokens;
              migrated = true;
            }
          }

          const full = parsed as DatabaseSchema;
          if (migrated) {
            this.persist(full);
          }
          return full;
        }
      }
    } catch (err) {
      console.error('Failed to load existing store, initializing fresh seed:', err);
    }

    const seeded = createInitialSeed();
    this.persist(seeded);
    return seeded;
  }

  private persist(snapshot: DatabaseSchema = this.data): void {
    try {
      const dir = path.dirname(DATA_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${DATA_FILE_PATH}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), 'utf-8');
      fs.renameSync(tmpPath, DATA_FILE_PATH);
    } catch (err) {
      console.error('Failed to persist store:', err);
    }
  }

  public get db(): DatabaseSchema {
    return this.data;
  }

  public save(): void {
    this.persist(this.data);
  }

  public logAudit(
    actorUserId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    details: Record<string, unknown>,
    ipAddress = '127.0.0.1'
  ): void {
    const actor = actorUserId ? this.data.users.find((u) => u.id === actorUserId) : null;
    this.data.auditLogs.unshift({
      id: `audit-${crypto.randomUUID()}`,
      actorUserId,
      actorEmail: actor?.email || 'system',
      action,
      entityType,
      entityId,
      details,
      ipAddress,
      createdAt: new Date().toISOString(),
    });
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
    this.save();
  }
}

export const store = new FieldShiftStore();
