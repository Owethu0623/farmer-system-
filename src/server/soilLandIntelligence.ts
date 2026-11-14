import { estimateSaElevationMeters, SOUTH_AFRICA_PROVINCES } from './southAfricaData.ts';
import { store } from './store.ts';
import {
  Farm,
  FarmLocation,
  Field,
  LocationSource,
  SoilProvenanceType,
  SoilReport,
} from './types.ts';
import { fetchNasaPowerClimateComparison, fetchNasaPowerSummary } from './weather.ts';

export interface SoilMetricPoint {
  key: string;
  label: string;
  labValue: string | null;
  mappedEstimate: string | null;
  unit: string;
  sourceType: 'laboratory_measurement' | 'mapped_estimate' | 'not_measured';
  sourceNote: string;
}

export interface SoilProvenanceEntry {
  key: string;
  label: string;
  displayValue: string;
  provenance: SoilProvenanceType;
  provenanceLabel: string;
  detailNote: string;
}

export interface FieldSoilHistorySummary {
  fieldId: string;
  fieldName: string;
  areaHectares: number;
  irrigationType: string;
  soilType: string;
  soilTexture: 'Sandy' | 'Loam' | 'Clay Loam' | 'Clay' | 'Unknown';
  organicMatterLevel: 'Low' | 'Medium' | 'High' | 'Unknown';
  soilDrainage: 'Poor' | 'Moderate' | 'Good' | 'Unknown';
  waterHoldingCharacteristic: 'Low' | 'Moderate' | 'High' | 'Unknown';
  soilPhMeasured: number | null;
  nitrogenMeasuredMgKg: number | null;
  phosphorusMeasuredMgKg: number | null;
  potassiumMeasuredMgKg: number | null;
  currentCrop: string;
  previousSeasonCrop: string;
  twoSeasonsAgoCrop: string;
  farmingSystem: string;
  soilValueProvenance: Record<string, SoilProvenanceType>;
}

export interface SuitabilityOption {
  id: string;
  farmingOption: string;
  category: string;
  suitabilityLevel: 'Well Suited' | 'Conditionally Suitable' | 'Needs Remediation / Assessment';
  confidenceLevel: 'Moderate-High' | 'Moderate' | 'Lower Confidence';
  whySuitable: string;
  supportingInformation: string[];
  missingInformation: string[];
  possibleLimitations: string[];
  additionalAssessmentsRequired: string[];
}

export interface SoilLandIntelligencePayload {
  farmId: string;
  farmName: string;
  selectedFieldId: string | null;
  selectedFieldName: string | null;
  fetchedAt: string;
  coordinates: { latitude: number; longitude: number; locationSource: LocationSource };
  fieldsSummary: FieldSoilHistorySummary[];
  selectedFieldProfile: FieldSoilHistorySummary | null;
  soilProvenanceMatrix: SoilProvenanceEntry[];
  missingMeasurementsGuidance: string[];
  dataConfidenceLevel: 'Moderate-High' | 'Moderate' | 'Lower Confidence';
  landIntelligence: {
    elevationMeters: number | null;
    elevationSource: string;
    terrainProfile: string;
    climateZone: string;
    annualRainfallPattern: string;
    temperaturePattern: string;
    environmentalConditions: string;
    waterAvailabilitySummary: string;
    nasaGwetRoot: number | null;
    nasaGwetTop: number | null;
    nasaSoilWetnessNote: string;
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
  latestLabReport: (SoilReport & { fieldName?: string | null }) | null;
  allLabReports: (SoilReport & { fieldName?: string | null })[];
  soilMetrics: SoilMetricPoint[];
  suitabilityOptions: SuitabilityOption[];
}

interface SoilGridsParsed {
  available: boolean;
  note: string;
  phWater: number | null;
  clayPct: number | null;
  sandPct: number | null;
  siltPct: number | null;
  organicMatterPct: number | null;
  nitrogenGKg: number | null;
  cecCmolKg: number | null;
}

const SOIL_REMOTE_CACHE = new Map<
  string,
  {
    timestampMs: number;
    elevationMeters: number | null;
    elevationSource: string;
    soilGrids: SoilGridsParsed;
  }
>();

const CACHE_TTL_MS = 60 * 60 * 1000;

const PROVENANCE_LABELS: Record<SoilProvenanceType, string> = {
  farmer_provided: 'Farmer-Provided',
  laboratory_measured: 'Laboratory-Measured',
  external_dataset: 'External Dataset (ISRIC/NASA)',
  estimated: 'Estimated / Inferred',
  unknown: 'Unknown / Not Recorded',
};

export function normalizeTextureFromLegacy(
  soilType?: string | null,
  explicitTexture?: string | null
): 'Sandy' | 'Loam' | 'Clay Loam' | 'Clay' | 'Unknown' {
  if (
    explicitTexture === 'Sandy' ||
    explicitTexture === 'Loam' ||
    explicitTexture === 'Clay Loam' ||
    explicitTexture === 'Clay' ||
    explicitTexture === 'Unknown'
  ) {
    return explicitTexture;
  }
  const s = (soilType || '').toLowerCase();
  if (!s || s === 'unknown') return 'Unknown';
  if (s.includes('clay loam') || s.includes('sandy clay')) return 'Clay Loam';
  if (s.includes('clay')) return 'Clay';
  if (s.includes('loam')) return 'Loam';
  if (s.includes('sand')) return 'Sandy';
  return 'Unknown';
}

export function buildFieldSummary(field: Field, labReportsForFarm: SoilReport[]): FieldSoilHistorySummary {
  const fieldLab =
    labReportsForFarm.find((r) => r.fieldId === field.id) || labReportsForFarm[0] || null;

  const texture = normalizeTextureFromLegacy(field.soilType, field.soilTexture);
  const omLevel: 'Low' | 'Medium' | 'High' | 'Unknown' = field.organicMatterLevel || 'Unknown';
  const drainage: 'Poor' | 'Moderate' | 'Good' | 'Unknown' = field.soilDrainage || 'Unknown';
  const whc: 'Low' | 'Moderate' | 'High' | 'Unknown' =
    field.waterHoldingCharacteristic || 'Unknown';

  const provMap: Record<string, SoilProvenanceType> = {
    ...(field.soilValueProvenance || {}),
  };
  if (!provMap.soilTexture) {
    provMap.soilTexture =
      field.soilTexture && field.soilTexture !== 'Unknown'
        ? 'farmer_provided'
        : field.soilType && field.soilType.toLowerCase() !== 'unknown'
          ? 'farmer_provided'
          : 'unknown';
  }
  if (!provMap.soilPh) {
    provMap.soilPh =
      field.soilPhMeasured != null
        ? 'farmer_provided'
        : fieldLab?.soilPhWater != null
          ? 'laboratory_measured'
          : 'unknown';
  }
  if (!provMap.organicMatter) {
    provMap.organicMatter =
      field.organicMatterLevel && field.organicMatterLevel !== 'Unknown'
        ? 'farmer_provided'
        : fieldLab?.organicMatterPercent != null
          ? 'laboratory_measured'
          : 'unknown';
  }
  if (!provMap.soilDrainage) {
    provMap.soilDrainage =
      drainage !== 'Unknown'
        ? 'farmer_provided'
        : fieldLab?.drainageClass
          ? 'laboratory_measured'
          : 'unknown';
  }
  if (!provMap.waterHolding) {
    provMap.waterHolding =
      whc !== 'Unknown'
        ? 'farmer_provided'
        : fieldLab?.waterHoldingCapacityMmPerM != null
          ? 'laboratory_measured'
          : 'unknown';
  }

  return {
    fieldId: field.id,
    fieldName: field.name,
    areaHectares: field.areaHectares,
    irrigationType: field.irrigationType,
    soilType: field.soilType,
    soilTexture: texture,
    organicMatterLevel: omLevel,
    soilDrainage: drainage,
    waterHoldingCharacteristic: whc,
    soilPhMeasured: field.soilPhMeasured ?? fieldLab?.soilPhWater ?? null,
    nitrogenMeasuredMgKg: field.nitrogenMeasuredMgKg ?? fieldLab?.nitrogenMgKg ?? null,
    phosphorusMeasuredMgKg: field.phosphorusMeasuredMgKg ?? fieldLab?.phosphorusMgKg ?? null,
    potassiumMeasuredMgKg: field.potassiumMeasuredMgKg ?? fieldLab?.potassiumMgKg ?? null,
    currentCrop: field.currentCrop || field.cropOrLivestock || '',
    previousSeasonCrop: field.previousSeasonCrop || '',
    twoSeasonsAgoCrop: field.twoSeasonsAgoCrop || '',
    farmingSystem: field.farmingSystem || 'Mixed Crop & Soil Management',
    soilValueProvenance: provMap,
  };
}

function classifyTexture(clay: number | null, sand: number | null, silt: number | null): string | null {
  if (clay === null || sand === null || silt === null) return null;
  if (clay >= 40) return 'Clay';
  if (clay >= 27 && sand <= 45) return 'Clay Loam';
  if (clay >= 20 && sand >= 45) return 'Sandy Clay Loam';
  if (sand >= 70 && clay < 15) return 'Sandy Loam / Loamy Sand';
  if (silt >= 50) return 'Silt Loam';
  return 'Loam';
}

function estimateAwcMmPerM(texture: string | null): number | null {
  if (!texture) return null;
  const lower = texture.toLowerCase();
  if (lower.includes('clay loam') || lower.includes('silt')) return 145;
  if (lower.includes('sandy clay')) return 130;
  if (lower.includes('clay')) return 125;
  if (lower.includes('sandy')) return 90;
  return 135;
}

function estimateDrainageFromClay(clay: number | null): string | null {
  if (clay === null) return null;
  if (clay >= 45) return 'Moderately Well to Imperfectly Drained (Mapped Estimate)';
  if (clay <= 18) return 'Excessively / Rapidly Drained (Mapped Estimate)';
  return 'Well Drained (Mapped Estimate)';
}

function getProvinceSoilTemperatureProfile(provinceName: string): {
  terrain: string;
  tempPattern: string;
  envConditions: string;
  arcLandTypeRef: string;
} {
  switch (provinceName) {
    case 'KwaZulu-Natal':
      return {
        terrain: 'Rolling Midlands escarpment & humid subtropical coastal valleys',
        tempPattern: 'Summer 18–30°C · Winter 6–22°C (light valley frost possible Jun–Jul)',
        envConditions: 'High summer humidity, convective afternoon thunderstorms, leached acidic uplands common',
        arcLandTypeRef: 'ARC-ISCW Midlands Hutton/Clovelly Soil Association Reference',
      };
    case 'Western Cape':
      return {
        terrain: 'Folded coastal plains, Mediterranean valleys & semi-arid Klein Karoo',
        tempPattern: 'Summer 16–32°C · Winter 6–17°C (wet winter cold fronts)',
        envConditions: 'Winter rainfall regime, dry windy summers (Southeaster), high irrigation demand Dec–Mar',
        arcLandTypeRef: 'ARC-ISCW Winter Rainfall & Swartland/Winelands Shale Reference',
      };
    case 'Mpumalanga':
      return {
        terrain: 'Highveld plateau grasslands transitioning into warm subtropical Lowveld',
        tempPattern: 'Highveld: 12–26°C summer, frost May–Aug · Lowveld: 18–34°C',
        envConditions: 'Distinct elevation gradient; Highveld acidity vs frost-free irrigated Lowveld valleys',
        arcLandTypeRef: 'ARC-ISCW Highveld Avalon/Hutton & Lowveld Granite Reference',
      };
    case 'Limpopo':
      return {
        terrain: 'Bushveld savannas, escarpment foothills & irrigated river valleys',
        tempPattern: 'Summer 20–34°C · Winter 8–24°C (largely frost-free)',
        envConditions: 'High evaporative demand; reliable irrigation essential outside Nov–Mar peak rains',
        arcLandTypeRef: 'ARC-ISCW Bushveld Shortlands & Escarpment Hutton Reference',
      };
    case 'Free State':
      return {
        terrain: 'Broad flat-to-gently-undulating Highveld plains',
        tempPattern: 'Summer 15–30°C · Winter -2–17°C (moderate-to-severe winter frost)',
        envConditions: 'Windy spring transition, deep sandy-loam Avalon/Bainsvlei grain soils, frost May–Sep',
        arcLandTypeRef: 'ARC-ISCW Summer Grain Belt Plinthic Avalon/Clovelly Reference',
      };
    case 'North West':
      return {
        terrain: 'Semi-arid savanna plains and bushveld ridges',
        tempPattern: 'Summer 18–34°C · Winter 2–21°C (dry sunny winters)',
        envConditions: 'Variable summer onset rains, periodic mid-season dry spells in Jan',
        arcLandTypeRef: 'ARC-ISCW Hutton/Clovelly Semi-Arid Savanna Reference',
      };
    case 'Eastern Cape':
      return {
        terrain: 'Coastal terraces, river valleys, Amathole uplands & interior Karoo',
        tempPattern: 'Coastal: 14–27°C · Interior Karoo/Uplands: 2–32°C',
        envConditions: 'Bimodal spring/autumn rains in east; arid grazing bushveld in western interior',
        arcLandTypeRef: 'ARC-ISCW Coastal Oakleaf & Karoo Duplex Reference',
      };
    case 'Northern Cape':
      return {
        terrain: 'Arid Karoo plains, Kalahari sands & Orange River alluvial corridor',
        tempPattern: 'Summer 20–38°C · Winter 0–20°C (intense solar radiation)',
        envConditions: 'Very low annual rainfall (<300 mm); farming depends on Orange River or deep borehole water',
        arcLandTypeRef: 'ARC-ISCW Arid Calcic & Alluvial River Terrace Reference',
      };
    default:
      return {
        terrain: 'Highveld undulating plateau & peri-urban agricultural corridors',
        tempPattern: 'Summer 15–29°C · Winter 2–19°C (morning frost Jun–Jul)',
        envConditions: 'Summer thunderstorm rainfall; strong peri-urban fresh market access',
        arcLandTypeRef: 'ARC-ISCW Highveld Red Apedal Hutton Reference',
      };
  }
}

async function fetchRemoteElevationAndSoilGrids(lat: number, lng: number): Promise<{
  elevationMeters: number | null;
  elevationSource: string;
  soilGrids: SoilGridsParsed;
}> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = SOIL_REMOTE_CACHE.get(key);
  if (cached && Date.now() - cached.timestampMs < CACHE_TTL_MS) {
    return {
      elevationMeters: cached.elevationMeters,
      elevationSource: cached.elevationSource,
      soilGrids: cached.soilGrids,
    };
  }

  let elevationMeters: number | null = null;
  let elevationSource = 'Stored farm reference';

  let soilGrids: SoilGridsParsed = {
    available: false,
    note: 'ISRIC SoilGrids 250m service temporarily unavailable or rate-limited.',
    phWater: null,
    clayPct: null,
    sandPct: null,
    siltPct: null,
    organicMatterPct: null,
    nitrogenGKg: null,
    cecCmolKg: null,
  };

  const elevPromise = (async () => {
    try {
      const elevRes = await fetch(
        `https://api.open-meteo.com/v1/elevation?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (elevRes.ok) {
        const elevJson = (await elevRes.json()) as { elevation?: number[] };
        if (Array.isArray(elevJson.elevation) && typeof elevJson.elevation[0] === 'number') {
          elevationMeters = Math.round(elevJson.elevation[0]);
          elevationSource = 'Open-Meteo Copernicus DEM Elevation API';
        }
      }
    } catch {
      // keep fallback
    }
  })();

  const sgPromise = (async () => {
    try {
      const sgUrl =
        `https://rest.isric.org/soilgrids/v2.0/properties/query` +
        `?lon=${encodeURIComponent(lng)}&lat=${encodeURIComponent(lat)}` +
        `&property=phh2o&property=clay&property=sand&property=silt&property=soc&property=nitrogen&property=cec` +
        `&depth=0-5cm&depth=5-15cm&value=mean`;
      const sgRes = await fetch(sgUrl, { signal: AbortSignal.timeout(3500) });
      if (sgRes.ok) {
        const sgJson = (await sgRes.json()) as {
          properties?: {
            layers?: {
              name: string;
              depths?: { label: string; values?: { mean?: number | null } }[];
            }[];
          };
        };
        const layers = sgJson.properties?.layers || [];
        const readLayerMean = (name: string): number | null => {
          const layer = layers.find((l) => l.name === name);
          if (!layer?.depths?.length) return null;
          const vals = layer.depths
            .map((d) => d.values?.mean)
            .filter((v): v is number => typeof v === 'number');
          if (!vals.length) return null;
          return vals.reduce((a, b) => a + b, 0) / vals.length;
        };

        const rawPh = readLayerMean('phh2o');
        const rawClay = readLayerMean('clay');
        const rawSand = readLayerMean('sand');
        const rawSilt = readLayerMean('silt');
        const rawSoc = readLayerMean('soc');
        const rawN = readLayerMean('nitrogen');
        const rawCec = readLayerMean('cec');

        if (rawPh !== null || rawClay !== null) {
          const ocPct = rawSoc !== null ? rawSoc / 100 : null;
          soilGrids = {
            available: true,
            note: 'ISRIC SoilGrids v2.0 (250m global satellite/pedometric estimate, 0–15 cm mean)',
            phWater: rawPh !== null ? Number((rawPh / 10).toFixed(1)) : null,
            clayPct: rawClay !== null ? Number((rawClay / 10).toFixed(1)) : null,
            sandPct: rawSand !== null ? Number((rawSand / 10).toFixed(1)) : null,
            siltPct: rawSilt !== null ? Number((rawSilt / 10).toFixed(1)) : null,
            organicMatterPct: ocPct !== null ? Number((ocPct * 1.724).toFixed(2)) : null,
            nitrogenGKg: rawN !== null ? Number((rawN / 100).toFixed(2)) : null,
            cecCmolKg: rawCec !== null ? Number((rawCec / 10).toFixed(1)) : null,
          };
        }
      }
    } catch {
      // Graceful degradation; never fabricate SoilGrids values
    }
  })();

  await Promise.all([elevPromise, sgPromise]);

  SOIL_REMOTE_CACHE.set(key, {
    timestampMs: Date.now(),
    elevationMeters,
    elevationSource,
    soilGrids,
  });

  return { elevationMeters, elevationSource, soilGrids };
}

function buildSoilProvenanceAndGuidance(params: {
  selectedField: FieldSoilHistorySummary | null;
  latestLabReport: SoilReport | null;
  soilGrids: SoilGridsParsed;
  mappedTexture: string | null;
  mappedAwc: number | null;
  mappedDrainage: string | null;
  waterAvailability: string;
}): {
  matrix: SoilProvenanceEntry[];
  missingGuidance: string[];
  confidenceLevel: 'Moderate-High' | 'Moderate' | 'Lower Confidence';
} {
  const {
    selectedField,
    latestLabReport,
    soilGrids,
    mappedTexture,
    mappedAwc,
    mappedDrainage,
    waterAvailability,
  } = params;

  const missingGuidance: string[] = [];
  const matrix: SoilProvenanceEntry[] = [];

  // 1. Soil Texture
  if (latestLabReport?.soilTextureClass) {
    matrix.push({
      key: 'texture',
      label: 'Soil Texture',
      displayValue: `${latestLabReport.soilTextureClass}${
        latestLabReport.clayPercent != null ? ` (${latestLabReport.clayPercent}% clay)` : ''
      }`,
      provenance: 'laboratory_measured',
      provenanceLabel: PROVENANCE_LABELS.laboratory_measured,
      detailNote: `Lab particle-size report (${latestLabReport.laboratoryName}, ${latestLabReport.sampleDate})`,
    });
  } else if (selectedField && selectedField.soilTexture !== 'Unknown') {
    matrix.push({
      key: 'texture',
      label: 'Soil Texture',
      displayValue: selectedField.soilTexture,
      provenance: 'farmer_provided',
      provenanceLabel: PROVENANCE_LABELS.farmer_provided,
      detailNote: `Recorded on field "${selectedField.fieldName}"`,
    });
  } else if (mappedTexture) {
    matrix.push({
      key: 'texture',
      label: 'Soil Texture',
      displayValue: `${mappedTexture} (${soilGrids.clayPct}% clay / ${soilGrids.sandPct}% sand)`,
      provenance: 'external_dataset',
      provenanceLabel: PROVENANCE_LABELS.external_dataset,
      detailNote: 'ISRIC SoilGrids 250m global prediction (confirm with hand-feel/lab test)',
    });
    missingGuidance.push('Record field soil texture class (Sandy / Loam / Clay Loam / Clay) or submit a particle-size lab test.');
  } else {
    matrix.push({
      key: 'texture',
      label: 'Soil Texture',
      displayValue: 'Unknown',
      provenance: 'unknown',
      provenanceLabel: PROVENANCE_LABELS.unknown,
      detailNote: 'No farmer entry, lab report, or SoilGrids grid data available',
    });
    missingGuidance.push('Field soil texture is unknown — classify topsoil texture before selecting deep-rooted or water-sensitive crops.');
  }

  // 2. Soil pH
  if (latestLabReport?.soilPhWater != null) {
    matrix.push({
      key: 'ph',
      label: 'Soil pH (H₂O)',
      displayValue: `${latestLabReport.soilPhWater}`,
      provenance: 'laboratory_measured',
      provenanceLabel: PROVENANCE_LABELS.laboratory_measured,
      detailNote: `Accredited lab sample (${latestLabReport.sampleCode})`,
    });
  } else if (selectedField?.soilPhMeasured != null) {
    matrix.push({
      key: 'ph',
      label: 'Soil pH (H₂O)',
      displayValue: `${selectedField.soilPhMeasured}`,
      provenance: 'farmer_provided',
      provenanceLabel: PROVENANCE_LABELS.farmer_provided,
      detailNote: 'Entered on field soil profile',
    });
  } else if (soilGrids.phWater != null) {
    matrix.push({
      key: 'ph',
      label: 'Soil pH (H₂O)',
      displayValue: `~${soilGrids.phWater}`,
      provenance: 'external_dataset',
      provenanceLabel: PROVENANCE_LABELS.external_dataset,
      detailNote: 'ISRIC SoilGrids 250m mapped estimate; local lime history can shift actual pH sharply',
    });
    missingGuidance.push('Collect a 0–20 cm composite topsoil sample for accredited lab pH(H₂O & KCl) before legume or brassica planting.');
  } else {
    matrix.push({
      key: 'ph',
      label: 'Soil pH (H₂O)',
      displayValue: 'Unknown (not tested)',
      provenance: 'unknown',
      provenanceLabel: PROVENANCE_LABELS.unknown,
      detailNote: 'Cannot determine lime need without soil pH testing',
    });
    missingGuidance.push('Laboratory topsoil pH test is missing — high priority before committing capital to acid-sensitive legumes (dry beans, soybeans).');
  }

  // 3. Organic Matter Level
  if (latestLabReport?.organicMatterPercent != null) {
    const omPct = latestLabReport.organicMatterPercent;
    const band = omPct < 1.5 ? 'Low' : omPct < 3.0 ? 'Medium' : 'High';
    matrix.push({
      key: 'om',
      label: 'Organic Matter',
      displayValue: `${omPct}% (${band})`,
      provenance: 'laboratory_measured',
      provenanceLabel: PROVENANCE_LABELS.laboratory_measured,
      detailNote: `Lab organic carbon/matter measurement (${latestLabReport.sampleDate})`,
    });
  } else if (selectedField && selectedField.organicMatterLevel !== 'Unknown') {
    matrix.push({
      key: 'om',
      label: 'Organic Matter',
      displayValue: `${selectedField.organicMatterLevel} (Field Assessment)`,
      provenance: 'farmer_provided',
      provenanceLabel: PROVENANCE_LABELS.farmer_provided,
      detailNote: `Entered on field "${selectedField.fieldName}"`,
    });
  } else if (soilGrids.organicMatterPct != null) {
    matrix.push({
      key: 'om',
      label: 'Organic Matter',
      displayValue: `~${soilGrids.organicMatterPct}%`,
      provenance: 'external_dataset',
      provenanceLabel: PROVENANCE_LABELS.external_dataset,
      detailNote: 'Estimated from ISRIC SoilGrids soil organic carbon',
    });
    missingGuidance.push('Verify field organic matter level (Low/Medium/High) or request Walkley-Black organic carbon on your next lab test.');
  } else {
    matrix.push({
      key: 'om',
      label: 'Organic Matter',
      displayValue: 'Unknown',
      provenance: 'unknown',
      provenanceLabel: PROVENANCE_LABELS.unknown,
      detailNote: 'Not recorded',
    });
    missingGuidance.push('Organic matter status is unknown — consider residue retention and organic cover crops until tested.');
  }

  // 4. Soil Drainage
  if (latestLabReport?.drainageClass) {
    matrix.push({
      key: 'drainage',
      label: 'Soil Drainage',
      displayValue: latestLabReport.drainageClass,
      provenance: 'laboratory_measured',
      provenanceLabel: PROVENANCE_LABELS.laboratory_measured,
      detailNote: 'Recorded on laboratory/profile report',
    });
  } else if (selectedField && selectedField.soilDrainage !== 'Unknown') {
    matrix.push({
      key: 'drainage',
      label: 'Soil Drainage',
      displayValue: `${selectedField.soilDrainage} Drainage`,
      provenance: 'farmer_provided',
      provenanceLabel: PROVENANCE_LABELS.farmer_provided,
      detailNote: `Observed on field "${selectedField.fieldName}"`,
    });
  } else if (mappedDrainage) {
    matrix.push({
      key: 'drainage',
      label: 'Soil Drainage',
      displayValue: mappedDrainage,
      provenance: 'estimated',
      provenanceLabel: PROVENANCE_LABELS.estimated,
      detailNote: 'Inferred from mapped clay %; check field puddles or 1.2 m profile pit for mottling',
    });
    missingGuidance.push('Inspect field drainage after heavy rain (Poor / Moderate / Good) to avoid waterlogging losses in legumes or lupin.');
  } else {
    matrix.push({
      key: 'drainage',
      label: 'Soil Drainage',
      displayValue: 'Unknown',
      provenance: 'unknown',
      provenanceLabel: PROVENANCE_LABELS.unknown,
      detailNote: 'Drainage class not recorded',
    });
    missingGuidance.push('Field drainage status is unknown — observe infiltration speed or dig a test pit before planting root-rot-sensitive crops.');
  }

  // 5. Water-Holding Characteristic
  if (latestLabReport?.waterHoldingCapacityMmPerM != null) {
    matrix.push({
      key: 'whc',
      label: 'Water-Holding Characteristic',
      displayValue: `${latestLabReport.waterHoldingCapacityMmPerM} mm/m`,
      provenance: 'laboratory_measured',
      provenanceLabel: PROVENANCE_LABELS.laboratory_measured,
      detailNote: 'Lab soil moisture retention test',
    });
  } else if (selectedField && selectedField.waterHoldingCharacteristic !== 'Unknown') {
    matrix.push({
      key: 'whc',
      label: 'Water-Holding Characteristic',
      displayValue: `${selectedField.waterHoldingCharacteristic} Retention`,
      provenance: 'farmer_provided',
      provenanceLabel: PROVENANCE_LABELS.farmer_provided,
      detailNote: `Recorded on field "${selectedField.fieldName}"`,
    });
  } else if (mappedAwc != null) {
    matrix.push({
      key: 'whc',
      label: 'Water-Holding Characteristic',
      displayValue: `~${mappedAwc} mm/m`,
      provenance: 'estimated',
      provenanceLabel: PROVENANCE_LABELS.estimated,
      detailNote: 'Estimated from mapped texture class',
    });
  } else {
    matrix.push({
      key: 'whc',
      label: 'Water-Holding Characteristic',
      displayValue: 'Unknown',
      provenance: 'unknown',
      provenanceLabel: PROVENANCE_LABELS.unknown,
      detailNote: 'No soil moisture retention data entered',
    });
  }

  // 6. Primary Nutrients (N, P, K)
  if (
    latestLabReport &&
    (latestLabReport.nitrogenMgKg != null ||
      latestLabReport.phosphorusMgKg != null ||
      latestLabReport.potassiumMgKg != null)
  ) {
    matrix.push({
      key: 'npk',
      label: 'Primary Nutrients (N · P · K)',
      displayValue: `N ${latestLabReport.nitrogenMgKg ?? '—'} · P ${latestLabReport.phosphorusMgKg ?? '—'} · K ${latestLabReport.potassiumMgKg ?? '—'} mg/kg`,
      provenance: 'laboratory_measured',
      provenanceLabel: PROVENANCE_LABELS.laboratory_measured,
      detailNote: `Accredited lab extractable nutrients (${latestLabReport.sampleDate})`,
    });
  } else if (
    selectedField &&
    (selectedField.nitrogenMeasuredMgKg != null ||
      selectedField.phosphorusMeasuredMgKg != null ||
      selectedField.potassiumMeasuredMgKg != null)
  ) {
    matrix.push({
      key: 'npk',
      label: 'Primary Nutrients (N · P · K)',
      displayValue: `N ${selectedField.nitrogenMeasuredMgKg ?? '—'} · P ${selectedField.phosphorusMeasuredMgKg ?? '—'} · K ${selectedField.potassiumMeasuredMgKg ?? '—'} mg/kg`,
      provenance: 'farmer_provided',
      provenanceLabel: PROVENANCE_LABELS.farmer_provided,
      detailNote: 'Farmer-entered field nutrient test values',
    });
  } else {
    matrix.push({
      key: 'npk',
      label: 'Primary Nutrients (N · P · K)',
      displayValue: 'Not measured (P & K require laboratory soil test)',
      provenance: 'unknown',
      provenanceLabel: PROVENANCE_LABELS.unknown,
      detailNote: 'Satellite grids cannot reliably measure plant-available Bray-1 P or exchangeable K',
    });
    missingGuidance.push('Submit a laboratory N-P-K soil analysis — satellite datasets cannot determine plant-available phosphorus or potassium.');
  }

  // 7. Crop History (Current + Previous 1-2 Seasons)
  const hasCropHistory =
    Boolean(selectedField?.previousSeasonCrop) || Boolean(selectedField?.twoSeasonsAgoCrop);
  matrix.push({
    key: 'crop_history',
    label: 'Field Crop History (2 Seasons)',
    displayValue: selectedField
      ? [
          selectedField.currentCrop ? `Current: ${selectedField.currentCrop}` : null,
          selectedField.previousSeasonCrop ? `1 Season Ago: ${selectedField.previousSeasonCrop}` : null,
          selectedField.twoSeasonsAgoCrop ? `2 Seasons Ago: ${selectedField.twoSeasonsAgoCrop}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Not recorded for this field'
      : 'Select a specific field/camp to track crop history',
    provenance: hasCropHistory ? 'farmer_provided' : 'unknown',
    provenanceLabel: hasCropHistory ? PROVENANCE_LABELS.farmer_provided : PROVENANCE_LABELS.unknown,
    detailNote: hasCropHistory
      ? 'Used to detect monocropping and shared family pest/disease risks'
      : 'Record previous 1–2 seasons crops so rotation recommendations avoid repeating botanical families',
  });
  if (!hasCropHistory) {
    missingGuidance.push('Previous 1–2 season crops on this field are not recorded yet — add crop history to improve disease-break accuracy.');
  }

  if (waterAvailability.toLowerCase().includes('unverified')) {
    missingGuidance.push('Confirm farm/field water availability and borehole/dam reliability.');
  }

  const labOrFarmerCount = matrix.filter(
    (m) => m.provenance === 'laboratory_measured' || m.provenance === 'farmer_provided'
  ).length;
  const confidenceLevel: 'Moderate-High' | 'Moderate' | 'Lower Confidence' =
    latestLabReport && labOrFarmerCount >= 5
      ? 'Moderate-High'
      : labOrFarmerCount >= 3
        ? 'Moderate'
        : 'Lower Confidence';

  return { matrix, missingGuidance, confidenceLevel };
}

export function computeLandSuitability(params: {
  farm: Farm;
  location: FarmLocation;
  fields: Field[];
  selectedField: FieldSoilHistorySummary | null;
  latestLabReport: SoilReport | null;
  soilGrids: SoilGridsParsed;
  nasaGwetRoot: number | null;
  nasaRainfallDeltaMm: number | null;
  selectedFarmingType?: string;
}): SuitabilityOption[] {
  const {
    farm,
    location,
    fields,
    selectedField,
    latestLabReport,
    soilGrids,
    nasaGwetRoot,
    nasaRainfallDeltaMm,
    selectedFarmingType,
  } = params;
  const prov = SOUTH_AFRICA_PROVINCES.find((p) => p.name === location.province);
  const ph =
    selectedField?.soilPhMeasured ?? latestLabReport?.soilPhWater ?? soilGrids.phWater ?? null;
  const phSource =
    latestLabReport?.soilPhWater != null
      ? `Lab measured pH ${latestLabReport.soilPhWater} (${latestLabReport.laboratoryName}, ${latestLabReport.sampleDate})`
      : selectedField?.soilPhMeasured != null
        ? `Farmer-entered field pH ${selectedField.soilPhMeasured}`
        : soilGrids.phWater != null
          ? `External SoilGrids 250m estimate pH ~${soilGrids.phWater} (unverified)`
          : null;

  const drainageStr = (
    selectedField?.soilDrainage !== 'Unknown' && selectedField?.soilDrainage
      ? selectedField.soilDrainage
      : latestLabReport?.drainageClass || 'Unknown'
  ).toLowerCase();
  const poorDrainage = drainageStr.includes('poor');
  const fieldTexture = selectedField?.soilTexture || 'Unknown';
  const sandyRisk = fieldTexture === 'Sandy';

  const water = (selectedField?.irrigationType || farm.waterAvailability).toLowerCase();
  const hasIrrigationWater =
    water.includes('borehole') ||
    water.includes('river') ||
    water.includes('dam') ||
    water.includes('drip') ||
    water.includes('pivot') ||
    water.includes('irrigat') ||
    water.includes('municipal');

  const effectiveHa =
    selectedField?.areaHectares ??
    store.db.farmBoundaries.find((b) => b.farmId === farm.id)?.calculatedAreaHectares ??
    farm.farmSizeHectares;
  const rainfallText = prov?.annualRainfallMm || '500 - 800 mm';
  const isArid = location.province === 'Northern Cape' || rainfallText.includes('200');
  const isWinterRain = (prov?.rainfallRegime || '').toLowerCase().includes('winter');

  const hasLabVerification = Boolean(latestLabReport);
  const confidenceLevel: SuitabilityOption['confidenceLevel'] =
    hasLabVerification && selectedField && selectedField.soilTexture !== 'Unknown'
      ? 'Moderate-High'
      : selectedField && selectedField.soilTexture !== 'Unknown'
        ? 'Moderate'
        : 'Lower Confidence';

  const baseMissing: string[] = [];
  if (!latestLabReport) {
    baseMissing.push(
      'Lower-confidence rating: no accredited laboratory soil report (pH KCl, P, K, OM%) is attached yet.'
    );
  }
  if (!selectedField || selectedField.soilDrainage === 'Unknown') {
    baseMissing.push('Field-level drainage class not verified.');
  }
  if (!selectedField || !selectedField.previousSeasonCrop) {
    baseMissing.push('Prior 1–2 season crop history not recorded for disease-break checks.');
  }

  const gwetNote =
    nasaGwetRoot !== null
      ? `NASA model root-zone soil wetness (GWETROOT): ${nasaGwetRoot} (${
          nasaGwetRoot < 0.35 ? 'dry profile' : nasaGwetRoot < 0.6 ? 'moderate profile' : 'moist profile'
        })`
      : 'NASA soil wetness check unavailable';

  const options: SuitabilityOption[] = [];

  // 1. Summer Cereal-Legume Climate-Resilient Rotation
  options.push({
    id: 'suit-cereal-legume-rotation',
    farmingOption: 'Cereal – Legume – Oilseed Climate-Adaptive Rotation (Maize / Dry Beans or Soybeans / Sunflower)',
    category: 'Summer Field Rotation',
    suitabilityLevel:
      !isArid && !isWinterRain && !poorDrainage && (ph === null || ph >= 5.5)
        ? hasLabVerification
          ? 'Well Suited'
          : 'Conditionally Suitable'
        : !isArid
          ? 'Conditionally Suitable'
          : 'Needs Remediation / Assessment',
    confidenceLevel,
    whySuitable: isWinterRain
      ? `${location.province} experiences winter-dominant rainfall; dryland summer maize/beans face acute summer moisture deficit unless supplementary irrigation is confirmed.`
      : isArid
        ? `Arid conditions (${rainfallText}) limit dryland maize unless pivot/drip irrigation is confirmed; drought-tolerant sorghum + cowpeas are safer.`
        : `${location.province} (${rainfallText}) supports a 3-family rotational sequence on ${effectiveHa} ha, breaking stalk-borer/soil disease cycles while fixing nitrogen.`,
    supportingInformation: [
      `Field / Farm scope: ${selectedField ? `${selectedField.fieldName} (${effectiveHa} ha, ${fieldTexture})` : `${effectiveHa} ha farm`}`,
      `Water status: ${selectedField?.irrigationType || farm.waterAvailability}`,
      gwetNote,
      ...(phSource ? [phSource] : []),
    ],
    missingInformation: baseMissing,
    possibleLimitations: [
      ...(poorDrainage ? ['Poor drainage heightens root-rot risk in dry beans and soybeans.'] : []),
      ...(sandyRisk ? ['Sandy soil has low water retention; favour drought-hardy legumes (cowpeas) and mulch cover.'] : []),
      ...(nasaRainfallDeltaMm !== null && nasaRainfallDeltaMm < -30
        ? [`NASA 2020–2024 vs 2001–2015 rainfall shift (${nasaRainfallDeltaMm} mm/yr) raises dry-spell risk at maize flowering.`]
        : []),
    ],
    additionalAssessmentsRequired: [
      '0–20 cm composite soil test for pH(KCl), P, and Ca/Mg prior to inoculating legume seed.',
      'Confirm field drainage and soil depth (>=75 cm for sunflower taproots).',
    ],
  });

  // 2. Drought-Resilient Semi-Arid / Water-Conserving Rotation
  options.push({
    id: 'suit-drought-resilient',
    farmingOption: 'Water-Conserving Drought-Resilient Rotation (Grain Sorghum / Cowpeas / Sunflower)',
    category: 'Water-Limited & Dry-Spell Adaptation',
    suitabilityLevel:
      !poorDrainage && (ph === null || ph >= 5.4)
        ? 'Well Suited'
        : 'Conditionally Suitable',
    confidenceLevel,
    whySuitable: `Combines drought-tolerant sorghum (Poaceae), deep-rooting sunflower (Asteraceae), and hardy nitrogen-fixing cowpeas (Fabaceae) suited to ${
      nasaGwetRoot !== null && nasaGwetRoot < 0.35
        ? 'low current root-zone moisture (GWETROOT)'
        : `${rainfallText} rainfall variability`
    }.`,
    supportingInformation: [
      `Low-to-moderate crop water demand across all 3 botanical families`,
      gwetNote,
      `Water source: ${selectedField?.irrigationType || farm.waterAvailability}`,
    ],
    missingInformation: baseMissing,
    possibleLimitations: [
      'Sorghum faces quelea/bird grain damage near wetlands if harvest is delayed.',
      'Do not repeat sunflower and soybeans/beans in consecutive wet seasons (shared Sclerotinia host risk).',
    ],
    additionalAssessmentsRequired: [
      'Verify minimum 75 cm effective rooting depth for sunflower and sorghum.',
      'Confirm local grain sorghum / cowpea buyer specifications.',
    ],
  });

  // 3. Winter-Rainfall / Cool-Season Wheat – Canola – Lupin Rotation
  options.push({
    id: 'suit-winter-break-rotation',
    farmingOption: 'Cool-Season Cereal & Break-Crop Rotation (Wheat / Canola / Sweet Lupin)',
    category: 'Winter-Rainfall or Cool Irrigated Rotation',
    suitabilityLevel:
      (isWinterRain || hasIrrigationWater) && !poorDrainage
        ? hasLabVerification
          ? 'Well Suited'
          : 'Conditionally Suitable'
        : 'Needs Remediation / Assessment',
    confidenceLevel,
    whySuitable:
      isWinterRain || hasIrrigationWater
        ? `Alternating wheat (Poaceae) with canola (Brassicaceae) and sweet lupin (Fabaceae) disrupts take-all root disease and suits ${isWinterRain ? 'Western Cape winter fronts' : 'cool irrigated blocks'}.`
        : `Dryland winter wheat/canola/lupin in ${location.province} faces severe winter drought because rainfall falls mainly in summer (${rainfallText}) and irrigation is not confirmed.`,
    supportingInformation: [
      `Province rainfall pattern: ${prov?.rainfallRegime || location.province}`,
      `Lupin tolerates slightly acidic sandy-loam soils (pH 5.0–6.5) better than dry beans`,
      ...(phSource ? [phSource] : []),
    ],
    missingInformation: [
      ...baseMissing,
      'Cool-season frost dates and winter irrigation flow rate (if outside Western Cape).',
    ],
    possibleLimitations: [
      ...(poorDrainage ? ['Lupin and canola are sensitive to winter waterlogging on poorly drained clay soils.'] : []),
      ...(!isWinterRain && !hasIrrigationWater
        ? ['Unsuitable for dryland winter grain in summer-rainfall provinces without winter moisture storage.']
        : []),
    ],
    additionalAssessmentsRequired: [
      'Confirm Bradyrhizobium lupini inoculant availability and sulfur status for canola.',
      'Check boron/manganese levels if field soil pH exceeds 6.8 (lupin chlorosis risk).',
    ],
  });

  // 4. Soil-Health Cover & High-Value Vegetable Rotation (Irrigated Plots)
  options.push({
    id: 'suit-irrigated-soil-cover',
    farmingOption: 'Irrigated Soil-Building Crop & Cover Rotation (Cabbage / Dry Beans / Spinach + Winter Oats)',
    category: 'Intensive Irrigated Soil Resilience',
    suitabilityLevel:
      hasIrrigationWater && (ph === null || (ph >= 5.8 && ph <= 7.2))
        ? 'Well Suited'
        : hasIrrigationWater
          ? 'Conditionally Suitable'
          : 'Needs Remediation / Assessment',
    confidenceLevel,
    whySuitable: hasIrrigationWater
      ? `Reliable irrigation (${selectedField?.irrigationType || farm.waterAvailability}) allows multi-family vegetable rotations punctuated by legume and cover-cereal soil restoration.`
      : `High water requirement of brassicas and leafy greens conflicts with rain-fed-only water status (${selectedField?.irrigationType || farm.waterAvailability}).`,
    supportingInformation: [
      `Water access: ${selectedField?.irrigationType || farm.waterAvailability}`,
      `Soil organic matter status: ${selectedField?.organicMatterLevel || 'Unknown'}`,
    ],
    missingInformation: [
      ...baseMissing,
      'Irrigation water salinity (EC) & sodium adsorption ratio (SAR) test.',
    ],
    possibleLimitations: [
      ...(ph !== null && ph < 5.8
        ? [`Topsoil pH (${ph}) is below the 6.0 threshold preferred by cabbage (raises clubroot risk).`]
        : []),
      'Repeating Brassicaceae (cabbage/canola) within 2–3 years sharply elevates clubroot pathogen pressure.',
    ],
    additionalAssessmentsRequired: [
      'Borehole/dam water EC & pH analysis before drip fertigation.',
      'Topsoil compost/mulch plan where organic matter is low.',
    ],
  });

  if (selectedFarmingType) {
    const q = selectedFarmingType.toLowerCase();
    options.sort((a, b) => {
      const aMatch =
        a.farmingOption.toLowerCase().includes(q) || a.category.toLowerCase().includes(q) ? 1 : 0;
      const bMatch =
        b.farmingOption.toLowerCase().includes(q) || b.category.toLowerCase().includes(q) ? 1 : 0;
      return bMatch - aMatch;
    });
  }

  return options;
}

export async function getFarmSoilAndLandIntelligence(
  farmId: string,
  selectedFarmingType?: string,
  fieldId?: string | null
): Promise<SoilLandIntelligencePayload> {
  const farm = store.db.farms.find((f) => f.id === farmId);
  const location = store.db.farmLocations.find((l) => l.farmId === farmId);
  if (!farm || !location) {
    throw new Error('Farm location not found.');
  }

  const fields = store.db.fields.filter((fl) => fl.farmId === farmId);
  const reports = store.db.soilReports
    .filter((r) => r.farmId === farmId)
    .sort((a, b) => b.sampleDate.localeCompare(a.sampleDate))
    .map((r) => ({
      ...r,
      fieldName: r.fieldId ? fields.find((fl) => fl.id === r.fieldId)?.name || null : null,
    }));

  const targetFieldObj =
    (fieldId ? fields.find((fl) => fl.id === fieldId) : undefined) || fields[0] || null;

  const selectedFieldSummary = targetFieldObj
    ? buildFieldSummary(targetFieldObj, reports)
    : null;
  const fieldsSummary = fields.map((fl) => buildFieldSummary(fl, reports));

  const fieldSpecificReport = targetFieldObj
    ? reports.find((r) => r.fieldId === targetFieldObj.id) || reports[0] || null
    : reports[0] || null;

  const prov = SOUTH_AFRICA_PROVINCES.find((p) => p.name === location.province);
  const regionalProfile = getProvinceSoilTemperatureProfile(location.province);

  const [remote, nasaPower, nasaClimate] = await Promise.all([
    fetchRemoteElevationAndSoilGrids(location.latitude, location.longitude),
    fetchNasaPowerSummary(location.latitude, location.longitude).catch(() => null),
    fetchNasaPowerClimateComparison(location.latitude, location.longitude, {
      province: location.province,
      locationLabel: farm.name,
      waterAvailability: farm.waterAvailability,
    }).catch(() => null),
  ]);

  const elevationMeters =
    remote.elevationMeters ??
    (location.elevationMeters > 0
      ? location.elevationMeters
      : estimateSaElevationMeters(location.province, location.latitude, location.longitude));
  if (remote.elevationMeters !== null && location.elevationMeters !== remote.elevationMeters) {
    location.elevationMeters = remote.elevationMeters;
    store.save();
  }

  const mappedTexture = classifyTexture(
    remote.soilGrids.clayPct,
    remote.soilGrids.sandPct,
    remote.soilGrids.siltPct
  );
  const mappedAwc = estimateAwcMmPerM(mappedTexture);
  const mappedDrainage = estimateDrainageFromClay(remote.soilGrids.clayPct);

  const soilMetrics: SoilMetricPoint[] = [
    {
      key: 'ph',
      label: 'Soil pH (H₂O)',
      labValue:
        fieldSpecificReport?.soilPhWater != null
          ? `${fieldSpecificReport.soilPhWater}`
          : selectedFieldSummary?.soilPhMeasured != null
            ? `${selectedFieldSummary.soilPhMeasured} (Farmer)`
            : null,
      mappedEstimate: remote.soilGrids.phWater != null ? `~${remote.soilGrids.phWater}` : null,
      unit: 'pH',
      sourceType:
        fieldSpecificReport?.soilPhWater != null
          ? 'laboratory_measurement'
          : remote.soilGrids.phWater != null
            ? 'mapped_estimate'
            : 'not_measured',
      sourceNote:
        fieldSpecificReport?.soilPhWater != null
          ? `Lab (${fieldSpecificReport.laboratoryName}, ${fieldSpecificReport.sampleDate})`
          : selectedFieldSummary?.soilPhMeasured != null
            ? 'Farmer-provided field measurement'
            : remote.soilGrids.phWater != null
              ? 'ISRIC SoilGrids 250m Mapped Estimate'
              : 'Awaiting lab sample',
    },
    {
      key: 'texture',
      label: 'Soil Texture',
      labValue: fieldSpecificReport
        ? `${fieldSpecificReport.soilTextureClass}${
            fieldSpecificReport.clayPercent != null
              ? ` (${fieldSpecificReport.clayPercent}% clay / ${fieldSpecificReport.sandPercent ?? '?'}% sand)`
              : ''
          }`
        : selectedFieldSummary && selectedFieldSummary.soilTexture !== 'Unknown'
          ? `${selectedFieldSummary.soilTexture} (Farmer)`
          : null,
      mappedEstimate: mappedTexture
        ? `${mappedTexture} (${remote.soilGrids.clayPct}% clay / ${remote.soilGrids.sandPct}% sand)`
        : null,
      unit: 'Class & %',
      sourceType: fieldSpecificReport
        ? 'laboratory_measurement'
        : mappedTexture
          ? 'mapped_estimate'
          : 'not_measured',
      sourceNote: fieldSpecificReport
        ? `Lab (${fieldSpecificReport.laboratoryName})`
        : mappedTexture
          ? 'ISRIC SoilGrids 250m Mapped Estimate'
          : 'Not measured yet',
    },
    {
      key: 'om',
      label: 'Soil Organic Matter',
      labValue:
        fieldSpecificReport?.organicMatterPercent != null
          ? `${fieldSpecificReport.organicMatterPercent}%`
          : selectedFieldSummary && selectedFieldSummary.organicMatterLevel !== 'Unknown'
            ? `${selectedFieldSummary.organicMatterLevel} (Farmer)`
            : null,
      mappedEstimate:
        remote.soilGrids.organicMatterPct != null ? `~${remote.soilGrids.organicMatterPct}%` : null,
      unit: '% OM',
      sourceType:
        fieldSpecificReport?.organicMatterPercent != null
          ? 'laboratory_measurement'
          : remote.soilGrids.organicMatterPct != null
            ? 'mapped_estimate'
            : 'not_measured',
      sourceNote:
        fieldSpecificReport?.organicMatterPercent != null
          ? `Lab sample (${fieldSpecificReport.sampleDate})`
          : remote.soilGrids.organicMatterPct != null
            ? 'Derived from SoilGrids Organic Carbon'
            : 'Awaiting lab test',
    },
    {
      key: 'fertility',
      label: 'Fertility & CEC Indicator',
      labValue: fieldSpecificReport
        ? `${fieldSpecificReport.fertilityRating}${
            fieldSpecificReport.cecCmolKg != null ? ` (CEC ${fieldSpecificReport.cecCmolKg} cmol/kg)` : ''
          }`
        : null,
      mappedEstimate:
        remote.soilGrids.cecCmolKg != null
          ? `CEC ~${remote.soilGrids.cecCmolKg} cmol/kg`
          : null,
      unit: 'cmol(+)/kg',
      sourceType: fieldSpecificReport
        ? 'laboratory_measurement'
        : remote.soilGrids.cecCmolKg != null
          ? 'mapped_estimate'
          : 'not_measured',
      sourceNote: fieldSpecificReport
        ? 'Lab measurement'
        : remote.soilGrids.cecCmolKg != null
          ? 'ISRIC SoilGrids CEC Estimate'
          : 'Requires lab CEC test',
    },
    {
      key: 'nutrients',
      label: 'Primary Nutrients (N · P · K)',
      labValue:
        fieldSpecificReport &&
        (fieldSpecificReport.nitrogenMgKg != null ||
          fieldSpecificReport.phosphorusMgKg != null ||
          fieldSpecificReport.potassiumMgKg != null)
          ? `N ${fieldSpecificReport.nitrogenMgKg ?? '—'} · P ${fieldSpecificReport.phosphorusMgKg ?? '—'} · K ${fieldSpecificReport.potassiumMgKg ?? '—'} mg/kg`
          : null,
      mappedEstimate:
        remote.soilGrids.nitrogenGKg != null
          ? `Total N ~${remote.soilGrids.nitrogenGKg} g/kg (P & K require lab test)`
          : null,
      unit: 'mg/kg',
      sourceType:
        fieldSpecificReport &&
        (fieldSpecificReport.phosphorusMgKg != null || fieldSpecificReport.potassiumMgKg != null)
          ? 'laboratory_measurement'
          : remote.soilGrids.nitrogenGKg != null
            ? 'mapped_estimate'
            : 'not_measured',
      sourceNote: fieldSpecificReport
        ? 'Lab Extractable Nutrients'
        : 'P & K cannot be estimated by satellite; upload lab test',
    },
    {
      key: 'drainage',
      label: 'Soil Drainage',
      labValue:
        fieldSpecificReport?.drainageClass ||
        (selectedFieldSummary && selectedFieldSummary.soilDrainage !== 'Unknown'
          ? `${selectedFieldSummary.soilDrainage} Drainage (Farmer)`
          : null),
      mappedEstimate: mappedDrainage,
      unit: 'Class',
      sourceType: fieldSpecificReport
        ? 'laboratory_measurement'
        : mappedDrainage
          ? 'mapped_estimate'
          : 'not_measured',
      sourceNote: fieldSpecificReport ? 'Field & lab soil assessment' : 'Inferred from mapped clay %',
    },
    {
      key: 'awc',
      label: 'Water-Holding Capacity (AWC)',
      labValue:
        fieldSpecificReport?.waterHoldingCapacityMmPerM != null
          ? `${fieldSpecificReport.waterHoldingCapacityMmPerM} mm/m`
          : selectedFieldSummary && selectedFieldSummary.waterHoldingCharacteristic !== 'Unknown'
            ? `${selectedFieldSummary.waterHoldingCharacteristic} (Farmer)`
            : null,
      mappedEstimate: mappedAwc != null ? `~${mappedAwc} mm/m` : null,
      unit: 'mm/m',
      sourceType:
        fieldSpecificReport?.waterHoldingCapacityMmPerM != null
          ? 'laboratory_measurement'
          : mappedAwc != null
            ? 'mapped_estimate'
            : 'not_measured',
      sourceNote:
        fieldSpecificReport?.waterHoldingCapacityMmPerM != null
          ? 'Laboratory soil retention test'
          : mappedAwc != null
            ? 'Estimated from mapped texture class'
            : 'Not measured yet',
    },
  ];

  const { matrix, missingGuidance, confidenceLevel } = buildSoilProvenanceAndGuidance({
    selectedField: selectedFieldSummary,
    latestLabReport: fieldSpecificReport,
    soilGrids: remote.soilGrids,
    mappedTexture,
    mappedAwc,
    mappedDrainage,
    waterAvailability: selectedFieldSummary?.irrigationType || farm.waterAvailability,
  });

  const loggedWaterLiters = store.db.mixedFarmingEntries
    .filter((e) => e.farmId === farmId)
    .reduce((s, e) => s + e.waterLiters, 0);

  const nasaGwetRoot = nasaPower?.gwetRootRecent ?? null;
  const nasaGwetTop = nasaPower?.gwetTopRecent ?? null;

  const suitabilityOptions = computeLandSuitability({
    farm,
    location,
    fields,
    selectedField: selectedFieldSummary,
    latestLabReport: fieldSpecificReport,
    soilGrids: remote.soilGrids,
    nasaGwetRoot,
    nasaRainfallDeltaMm: nasaClimate?.delta?.annualRainfallChangeMm ?? null,
    selectedFarmingType,
  });

  return {
    farmId: farm.id,
    farmName: farm.name,
    selectedFieldId: selectedFieldSummary?.fieldId || null,
    selectedFieldName: selectedFieldSummary?.fieldName || null,
    fetchedAt: new Date().toISOString(),
    coordinates: {
      latitude: location.latitude,
      longitude: location.longitude,
      locationSource: location.locationSource,
    },
    fieldsSummary,
    selectedFieldProfile: selectedFieldSummary,
    soilProvenanceMatrix: matrix,
    missingMeasurementsGuidance: missingGuidance,
    dataConfidenceLevel: confidenceLevel,
    landIntelligence: {
      elevationMeters,
      elevationSource: remote.elevationSource,
      terrainProfile: `${regionalProfile.terrain} (${location.districtMunicipality})`,
      climateZone: prov?.climateZone || 'South African Regional Climate',
      annualRainfallPattern: prov?.annualRainfallMm || '500 - 800 mm',
      temperaturePattern: regionalProfile.tempPattern,
      environmentalConditions: regionalProfile.envConditions,
      waterAvailabilitySummary: `${farm.waterAvailability}${
        loggedWaterLiters > 0
          ? ` · ${loggedWaterLiters.toLocaleString()} L recorded in farm water logs`
          : ''
      }`,
      nasaGwetRoot,
      nasaGwetTop,
      nasaSoilWetnessNote:
        nasaGwetRoot !== null
          ? `NASA POWER 14-day mean GWETROOT ${nasaGwetRoot} / GWETTOP ${nasaGwetTop ?? '—'} (0–1 model-derived soil wetness index; NOT an on-farm sensor reading).`
          : 'NASA POWER model soil wetness unavailable right now.',
    },
    dataSources: [
      {
        id: 'src-lab',
        name: 'Farmer-Uploaded Laboratory Soil Reports',
        providerType: 'laboratory',
        status: fieldSpecificReport ? 'farmer_uploaded' : 'unavailable',
        summary: fieldSpecificReport
          ? `${reports.length} lab report(s) uploaded. Active: ${fieldSpecificReport.laboratoryName} (${fieldSpecificReport.sampleDate}).`
          : 'No laboratory soil report uploaded yet for this farm/field. Upload a report to replace mapped/estimated values with verified measurements.',
        lastUpdated: fieldSpecificReport ? fieldSpecificReport.sampleDate : null,
      },
      {
        id: 'src-soilgrids',
        name: 'ISRIC SoilGrids v2.0 Geospatial Soil Dataset',
        providerType: 'satellite_grid',
        status: remote.soilGrids.available ? 'connected' : 'unavailable',
        summary: remote.soilGrids.note,
        lastUpdated: remote.soilGrids.available ? new Date().toISOString() : null,
      },
      {
        id: 'src-nasa-soil',
        name: 'NASA POWER Soil Wetness Estimates (GWETROOT & GWETTOP)',
        providerType: 'satellite_grid',
        status: nasaPower?.serviceAvailable ? 'connected' : 'unavailable',
        summary:
          nasaPower?.serviceAvailable
            ? `Model-derived root-zone wetness (${nasaGwetRoot ?? '—'}) and surface wetness (${nasaGwetTop ?? '—'}) at ${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°.`
            : 'NASA POWER soil wetness feed unavailable.',
        lastUpdated: nasaPower?.lastUpdated || null,
      },
      {
        id: 'src-arc',
        name: 'Agricultural Research Council (ARC-ISCW) Land Type Reference',
        providerType: 'national_dataset',
        status: 'reference_only',
        summary: `${regionalProfile.arcLandTypeRef}. Broad land-type context; does not replace farm-level sampling.`,
        lastUpdated: null,
      },
    ],
    hasLabReport: Boolean(fieldSpecificReport),
    latestLabReport: fieldSpecificReport,
    allLabReports: reports,
    soilMetrics,
    suitabilityOptions,
  };
}

export async function getSiteSoilAndLandIntelligence(params: {
  province: string;
  district?: string;
  townOrArea?: string;
  latitude?: number;
  longitude?: number;
  siteName?: string;
  farmSizeHectares?: number;
  waterAvailability?: string;
  selectedFarmingType?: string;
}): Promise<SoilLandIntelligencePayload> {
  const prov =
    SOUTH_AFRICA_PROVINCES.find((p) => p.name === params.province) ||
    SOUTH_AFRICA_PROVINCES[0];
  const lat =
    typeof params.latitude === 'number' && Number.isFinite(params.latitude)
      ? params.latitude
      : prov.centerLat;
  const lng =
    typeof params.longitude === 'number' && Number.isFinite(params.longitude)
      ? params.longitude
      : prov.centerLng;
  const siteId = `site-${prov.code}`;
  const district = params.district || prov.districts[0]?.name || prov.capital;
  const town = params.townOrArea || prov.capital;
  const waterAvailability =
    params.waterAvailability || 'Candidate Site Water Access Unverified';

  const syntheticFarm: Farm = {
    id: siteId,
    ownerId: 'site-preview',
    name: params.siteName || `${prov.name} Candidate Site (${town})`,
    farmingActivities: params.selectedFarmingType
      ? [params.selectedFarmingType]
      : ['Mixed Planning'],
    farmSizeHectares:
      typeof params.farmSizeHectares === 'number' && params.farmSizeHectares > 0
        ? params.farmSizeHectares
        : 5,
    yearsOfExperience: 0,
    waterAvailability,
    existingCrops: [],
    existingLivestock: [],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const syntheticLocation: FarmLocation = {
    id: `loc-${siteId}`,
    farmId: siteId,
    province: prov.name,
    districtMunicipality: district,
    localMunicipality: town,
    townOrVillage: town,
    latitude: lat,
    longitude: lng,
    locationSource: 'municipal_center',
    gpsLatitude: null,
    gpsLongitude: null,
    gpsAccuracyMeters: null,
    gpsCapturedAt: null,
    centroidWkt: `POINT(${lng} ${lat})`,
    elevationMeters: estimateSaElevationMeters(prov.name, lat, lng),
  };

  const regionalProfile = getProvinceSoilTemperatureProfile(prov.name);
  const [remote, nasaPower, nasaClimate] = await Promise.all([
    fetchRemoteElevationAndSoilGrids(lat, lng),
    fetchNasaPowerSummary(lat, lng).catch(() => null),
    fetchNasaPowerClimateComparison(lat, lng, {
      province: prov.name,
      locationLabel: town,
      waterAvailability,
    }).catch(() => null),
  ]);
  const elevationMeters =
    remote.elevationMeters ?? estimateSaElevationMeters(prov.name, lat, lng);

  const mappedTexture = classifyTexture(
    remote.soilGrids.clayPct,
    remote.soilGrids.sandPct,
    remote.soilGrids.siltPct
  );
  const mappedAwc = estimateAwcMmPerM(mappedTexture);
  const mappedDrainage = estimateDrainageFromClay(remote.soilGrids.clayPct);

  const soilMetrics: SoilMetricPoint[] = [
    {
      key: 'ph',
      label: 'Soil pH (H₂O)',
      labValue: null,
      mappedEstimate: remote.soilGrids.phWater != null ? `~${remote.soilGrids.phWater}` : null,
      unit: 'pH',
      sourceType: remote.soilGrids.phWater != null ? 'mapped_estimate' : 'not_measured',
      sourceNote:
        remote.soilGrids.phWater != null
          ? 'ISRIC SoilGrids 250m Mapped Estimate (candidate site)'
          : 'Requires on-site composite lab sample',
    },
    {
      key: 'texture',
      label: 'Soil Texture',
      labValue: null,
      mappedEstimate: mappedTexture
        ? `${mappedTexture} (${remote.soilGrids.clayPct}% clay / ${remote.soilGrids.sandPct}% sand)`
        : null,
      unit: 'Class & %',
      sourceType: mappedTexture ? 'mapped_estimate' : 'not_measured',
      sourceNote: mappedTexture
        ? 'ISRIC SoilGrids 250m Mapped Estimate'
        : 'Requires on-site particle size test',
    },
    {
      key: 'om',
      label: 'Soil Organic Matter',
      labValue: null,
      mappedEstimate:
        remote.soilGrids.organicMatterPct != null ? `~${remote.soilGrids.organicMatterPct}%` : null,
      unit: '% OM',
      sourceType: remote.soilGrids.organicMatterPct != null ? 'mapped_estimate' : 'not_measured',
      sourceNote:
        remote.soilGrids.organicMatterPct != null
          ? 'Derived from SoilGrids Organic Carbon'
          : 'Awaiting lab sample',
    },
    {
      key: 'fertility',
      label: 'Fertility & CEC Indicator',
      labValue: null,
      mappedEstimate:
        remote.soilGrids.cecCmolKg != null
          ? `CEC ~${remote.soilGrids.cecCmolKg} cmol/kg`
          : null,
      unit: 'cmol(+)/kg',
      sourceType: remote.soilGrids.cecCmolKg != null ? 'mapped_estimate' : 'not_measured',
      sourceNote:
        remote.soilGrids.cecCmolKg != null
          ? 'ISRIC SoilGrids CEC Estimate'
          : 'Requires lab CEC test',
    },
    {
      key: 'nutrients',
      label: 'Primary Nutrients (N · P · K)',
      labValue: null,
      mappedEstimate:
        remote.soilGrids.nitrogenGKg != null
          ? `Total N ~${remote.soilGrids.nitrogenGKg} g/kg (P & K require lab test)`
          : null,
      unit: 'mg/kg',
      sourceType: remote.soilGrids.nitrogenGKg != null ? 'mapped_estimate' : 'not_measured',
      sourceNote: 'P & K cannot be estimated by satellite; take a 0–20 cm soil sample before lease/purchase',
    },
    {
      key: 'drainage',
      label: 'Soil Drainage',
      labValue: null,
      mappedEstimate: mappedDrainage,
      unit: 'Class',
      sourceType: mappedDrainage ? 'mapped_estimate' : 'not_measured',
      sourceNote: 'Inferred from mapped clay %; confirm with a test pit on site',
    },
    {
      key: 'awc',
      label: 'Water-Holding Capacity (AWC)',
      labValue: null,
      mappedEstimate: mappedAwc != null ? `~${mappedAwc} mm/m` : null,
      unit: 'mm/m',
      sourceType: mappedAwc != null ? 'mapped_estimate' : 'not_measured',
      sourceNote: mappedAwc != null ? 'Estimated from mapped texture class' : 'Not measured yet',
    },
  ];

  const { matrix, missingGuidance, confidenceLevel } = buildSoilProvenanceAndGuidance({
    selectedField: null,
    latestLabReport: null,
    soilGrids: remote.soilGrids,
    mappedTexture,
    mappedAwc,
    mappedDrainage,
    waterAvailability,
  });

  const nasaGwetRoot = nasaPower?.gwetRootRecent ?? null;
  const nasaGwetTop = nasaPower?.gwetTopRecent ?? null;

  const suitabilityOptions = computeLandSuitability({
    farm: syntheticFarm,
    location: syntheticLocation,
    fields: [],
    selectedField: null,
    latestLabReport: null,
    soilGrids: remote.soilGrids,
    nasaGwetRoot,
    nasaRainfallDeltaMm: nasaClimate?.delta?.annualRainfallChangeMm ?? null,
    selectedFarmingType: params.selectedFarmingType,
  });

  return {
    farmId: syntheticFarm.id,
    farmName: syntheticFarm.name,
    selectedFieldId: null,
    selectedFieldName: null,
    fetchedAt: new Date().toISOString(),
    coordinates: {
      latitude: lat,
      longitude: lng,
      locationSource: 'municipal_center',
    },
    fieldsSummary: [],
    selectedFieldProfile: null,
    soilProvenanceMatrix: matrix,
    missingMeasurementsGuidance: missingGuidance,
    dataConfidenceLevel: confidenceLevel,
    landIntelligence: {
      elevationMeters,
      elevationSource: remote.elevationSource,
      terrainProfile: `${regionalProfile.terrain} (${district})`,
      climateZone: prov.climateZone,
      annualRainfallPattern: prov.annualRainfallMm,
      temperaturePattern: regionalProfile.tempPattern,
      environmentalConditions: regionalProfile.envConditions,
      waterAvailabilitySummary: waterAvailability,
      nasaGwetRoot,
      nasaGwetTop,
      nasaSoilWetnessNote:
        nasaGwetRoot !== null
          ? `NASA POWER 14-day mean GWETROOT ${nasaGwetRoot} / GWETTOP ${nasaGwetTop ?? '—'} (0–1 model-derived soil wetness index; NOT an on-farm sensor reading).`
          : 'NASA POWER model soil wetness unavailable right now.',
    },
    dataSources: [
      {
        id: 'src-lab',
        name: 'Site Soil Laboratory Sample Status',
        providerType: 'laboratory',
        status: 'unavailable',
        summary: 'Candidate site preview — collect a 0–20 cm soil sample before buying land or committing input capital.',
        lastUpdated: null,
      },
      {
        id: 'src-soilgrids',
        name: 'ISRIC SoilGrids v2.0 Geospatial Soil Dataset',
        providerType: 'satellite_grid',
        status: remote.soilGrids.available ? 'connected' : 'unavailable',
        summary: remote.soilGrids.note,
        lastUpdated: remote.soilGrids.available ? new Date().toISOString() : null,
      },
      {
        id: 'src-nasa-soil',
        name: 'NASA POWER Soil Wetness Estimates (GWETROOT & GWETTOP)',
        providerType: 'satellite_grid',
        status: nasaPower?.serviceAvailable ? 'connected' : 'unavailable',
        summary:
          nasaPower?.serviceAvailable
            ? `Model-derived root-zone wetness (${nasaGwetRoot ?? '—'}) and surface wetness (${nasaGwetTop ?? '—'}).`
            : 'NASA POWER soil wetness feed unavailable.',
        lastUpdated: nasaPower?.lastUpdated || null,
      },
      {
        id: 'src-arc',
        name: 'Agricultural Research Council (ARC-ISCW) Land Type Reference',
        providerType: 'national_dataset',
        status: 'reference_only',
        summary: `${regionalProfile.arcLandTypeRef}. Broad land-type context; does not replace site inspection.`,
        lastUpdated: null,
      },
    ],
    hasLabReport: false,
    latestLabReport: null,
    allLabReports: [],
    soilMetrics,
    suitabilityOptions,
  };
}
