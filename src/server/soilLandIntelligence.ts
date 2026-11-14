import { SOUTH_AFRICA_PROVINCES } from './southAfricaData.ts';
import { store } from './store.ts';
import { Farm, FarmLocation, Field, LocationSource, SoilReport } from './types.ts';

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

export interface SoilLandIntelligencePayload {
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

export function computeLandSuitability(params: {
  farm: Farm;
  location: FarmLocation;
  fields: Field[];
  latestLabReport: SoilReport | null;
  soilGrids: SoilGridsParsed;
  selectedFarmingType?: string;
}): SuitabilityOption[] {
  const { farm, location, fields, latestLabReport, soilGrids, selectedFarmingType } = params;
  const prov = SOUTH_AFRICA_PROVINCES.find((p) => p.name === location.province);
  const ph = latestLabReport?.soilPhWater ?? soilGrids.phWater;
  const phSource = latestLabReport?.soilPhWater != null
    ? `Lab measured pH ${latestLabReport.soilPhWater} (${latestLabReport.laboratoryName}, ${latestLabReport.sampleDate})`
    : soilGrids.phWater != null
    ? `Mapped satellite estimate pH ${soilGrids.phWater} (SoilGrids 250m — not lab tested)`
    : null;

  const water = farm.waterAvailability.toLowerCase();
  const hasIrrigationWater =
    water.includes('borehole') ||
    water.includes('river') ||
    water.includes('dam') ||
    water.includes('irrigation') ||
    water.includes('municipal');
  const effectiveHa =
    store.db.farmBoundaries.find((b) => b.farmId === farm.id)?.calculatedAreaHectares ??
    farm.farmSizeHectares;
  const rainfallText = prov?.annualRainfallMm || '500 - 800 mm';
  const isArid = location.province === 'Northern Cape';

  const baseMissing: string[] = [];
  if (!latestLabReport) {
    baseMissing.push('No farmer-uploaded laboratory soil report (P, K, N, Zn, and KCl pH remain unverified at field level).');
  } else {
    if (latestLabReport.phosphorusMgKg === null) baseMissing.push('Phosphorus (Bray-1) laboratory figure missing.');
    if (latestLabReport.nitrogenMgKg === null) baseMissing.push('Mineral nitrogen measurement missing.');
  }
  if (!store.db.farmBoundaries.some((b) => b.farmId === farm.id)) {
    baseMissing.push('Drawn farm polygon boundary not saved yet (relying on registered farm size).');
  }
  const hasWaterVolume = store.db.mixedFarmingEntries.some(
    (e) => e.farmId === farm.id && e.waterLiters > 0
  );
  if (!hasWaterVolume) {
    baseMissing.push('Seasonal borehole yield (liters/hour) or irrigation flow log has not been recorded.');
  }

  const options: SuitabilityOption[] = [];

  // Option 1: High-Value Irrigated Horticulture
  options.push({
    id: 'suit-horticulture',
    farmingOption: 'Irrigated Leafy & Fruiting Vegetables (Spinach, Cabbage, Tomatoes)',
    category: 'Horticulture / Crops',
    suitabilityLevel:
      hasIrrigationWater && (ph === null || (ph >= 5.7 && ph <= 7.4))
        ? 'Well Suited'
        : hasIrrigationWater
        ? 'Conditionally Suitable'
        : 'Needs Remediation / Assessment',
    whySuitable: hasIrrigationWater
      ? `Farm reports ${farm.waterAvailability} across ${effectiveHa} ha in ${location.districtMunicipality}, enabling staggered drip-irrigated vegetable beds with short 45–90 day cash-flow cycles.`
      : `Location climate (${prov?.climateZone || location.province}) supports warm-season vegetables, though current water supply (${farm.waterAvailability}) restricts reliable dry-season production.`,
    supportingInformation: [
      `Farm area: ${effectiveHa} ha (${fields.length} mapped field${fields.length === 1 ? '' : 's'})`,
      `Registered water: ${farm.waterAvailability}`,
      ...(phSource ? [phSource] : []),
      ...(latestLabReport?.organicMatterPercent != null
        ? [`Lab organic matter: ${latestLabReport.organicMatterPercent}%`]
        : []),
    ],
    missingInformation: [
      ...baseMissing,
      'Irrigation water salinity (EC) and sodium adsorption ratio (SAR) test.',
    ],
    possibleLimitations: [
      ...(ph !== null && ph < 5.7 ? [`Soil acidity (pH ${ph}) can limit calcium uptake and cause tipburn in cabbage.`] : []),
      ...(!hasIrrigationWater ? ['Rain-fed-only supply causes high risk of harvest failure during mid-summer dry spells.'] : []),
      'Frost window or summer heatwaves require shade-netting or frost protection planning.',
    ],
    additionalAssessmentsRequired: [
      '0–20 cm composite soil fertility test per vegetable block before basal fertiliser.',
      'Borehole/dam water EC & pH analysis before investing in drip fertigation.',
    ],
  });

  // Option 2: Summer Grain & Legume Rotation
  options.push({
    id: 'suit-grain',
    farmingOption: 'Maize & Legume Rotation (Dryland or Supplementary Irrigated)',
    category: 'Field Crops',
    suitabilityLevel:
      !isArid && effectiveHa >= 3 && (ph === null || ph >= 5.5)
        ? 'Well Suited'
        : !isArid
        ? 'Conditionally Suitable'
        : 'Needs Remediation / Assessment',
    whySuitable: isArid
      ? `Northern Cape arid rainfall (${rainfallText}) limits dryland grain unless flood/pivot irrigation from river/borehole is confirmed.`
      : `${location.province} (${rainfallText}) aligns with summer grain production on ${effectiveHa} ha; rotating maize with soybeans or dry beans builds soil nitrogen and maize stover supports livestock.`,
    supportingInformation: [
      `Province rainfall pattern: ${rainfallText} (${prov?.climateZone || 'Regional'})`,
      `Available land: ${effectiveHa} ha`,
      ...(phSource ? [phSource] : []),
      ...(latestLabReport?.phosphorusMgKg != null
        ? [`Lab Phosphorus: ${latestLabReport.phosphorusMgKg} mg/kg`]
        : []),
    ],
    missingInformation: baseMissing,
    possibleLimitations: [
      ...(effectiveHa < 5 ? ['Smaller hectarage limits economies of scale for mechanised grain harvesting.'] : []),
      ...(ph !== null && ph < 5.5 ? [`Low pH (${ph}) increases aluminium toxicity risk; agricultural lime required before planting.`] : []),
      'Mid-season dry spells in January can reduce pollination if supplementary irrigation is absent.',
    ],
    additionalAssessmentsRequired: [
      'Subsoil (20–40 cm) compaction and pH(KCl) check to calculate exact dolomitic lime requirement.',
      'Local silo or feed-lot offtake verification prior to seed purchase.',
    ],
  });

  // Option 3: Mixed Crop-Livestock Grazing Integration
  options.push({
    id: 'suit-mixed-livestock',
    farmingOption: 'Integrated Grazing Livestock (Beef Cattle / Boer Goats) + Fodder Crops',
    category: 'Livestock & Mixed Farming',
    suitabilityLevel:
      effectiveHa >= 5 && (hasIrrigationWater || !isArid)
        ? 'Well Suited'
        : 'Conditionally Suitable',
    whySuitable: `Combining hardy South African breeds (Nguni/Bonsmara cattle or Boer goats) with crop residues, planted pastures, or lucerne spreads seasonal risk across ${effectiveHa} ha.`,
    supportingInformation: [
      `Total farm land: ${effectiveHa} ha`,
      `Water access: ${farm.waterAvailability}`,
      `Farmer experience: ${farm.yearsOfExperience} years`,
      `Regional livestock commodities: ${(prov?.keyCommodities || []).join(', ')}`,
    ],
    missingInformation: [
      ...baseMissing,
      'Veld carrying capacity (ha per Large Stock Unit / LSU) from provincial extension officer.',
    ],
    possibleLimitations: [
      ...(effectiveHa < 10 ? ['Small land size requires planted fodder or hay supplementation rather than pure extensive veld grazing.'] : []),
      'Overgrazing risk during dry winter months without fenced rotational paddocks.',
    ],
    additionalAssessmentsRequired: [
      'Grazing camp condition & botanical grass-cover inspection to set safe stocking rate.',
      'Dipping, tick-borne disease, and winter feed-budget plan.',
    ],
  });

  // Option 4: Perennial Orchard / Agro-forestry (conditional)
  options.push({
    id: 'suit-orchard',
    farmingOption: 'Perennial Fruit / Citrus / Nut Orchards (Site-Dependent)',
    category: 'Orchards',
    suitabilityLevel:
      hasIrrigationWater &&
      (latestLabReport?.drainageClass === 'Well Drained' || !latestLabReport) &&
      !isArid
        ? 'Conditionally Suitable'
        : 'Needs Remediation / Assessment',
    whySuitable: `Permanent orchards offer high long-term returns where ${farm.waterAvailability} is reliable and soils drain cleanly without root-zone waterlogging.`,
    supportingInformation: [
      `Water source: ${farm.waterAvailability}`,
      ...(latestLabReport
        ? [`Lab drainage class: ${latestLabReport.drainageClass} (${latestLabReport.soilTextureClass})`]
        : ['Soil drainage not yet verified via profile pit']),
    ],
    missingInformation: [
      ...baseMissing,
      '1.2 m soil profile pit inspection for plinthic/clay hardpans and root-depth verification.',
      'Registered Catchment Management Agency water-use entitlement for perennial irrigation.',
    ],
    possibleLimitations: [
      'Requires 3–5 years capital investment before commercial harvest.',
      'Sensitive to winter frost pockets and poorly drained clay subsoils.',
    ],
    additionalAssessmentsRequired: [
      'Dig 1.2 m soil profile pits across proposed orchard blocks (ARC-ISCW standard).',
      'Minimum 10-year frost frequency review for your exact valley elevation.',
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
  selectedFarmingType?: string
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
  const latestLabReport = reports[0] || null;

  const prov = SOUTH_AFRICA_PROVINCES.find((p) => p.name === location.province);
  const regionalProfile = getProvinceSoilTemperatureProfile(location.province);

  const remote = await fetchRemoteElevationAndSoilGrids(location.latitude, location.longitude);
  const elevationMeters = remote.elevationMeters ?? location.elevationMeters ?? null;
  if (remote.elevationMeters !== null) {
    location.elevationMeters = remote.elevationMeters;
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
      labValue: latestLabReport?.soilPhWater != null ? `${latestLabReport.soilPhWater}` : null,
      mappedEstimate: remote.soilGrids.phWater != null ? `~${remote.soilGrids.phWater}` : null,
      unit: 'pH',
      sourceType:
        latestLabReport?.soilPhWater != null
          ? 'laboratory_measurement'
          : remote.soilGrids.phWater != null
          ? 'mapped_estimate'
          : 'not_measured',
      sourceNote:
        latestLabReport?.soilPhWater != null
          ? `Lab (${latestLabReport.laboratoryName}, ${latestLabReport.sampleDate})`
          : remote.soilGrids.phWater != null
          ? 'ISRIC SoilGrids 250m Mapped Estimate'
          : 'Awaiting lab sample',
    },
    {
      key: 'texture',
      label: 'Soil Texture',
      labValue: latestLabReport
        ? `${latestLabReport.soilTextureClass}${
            latestLabReport.clayPercent != null
              ? ` (${latestLabReport.clayPercent}% clay / ${latestLabReport.sandPercent ?? '?'}% sand)`
              : ''
          }`
        : null,
      mappedEstimate: mappedTexture
        ? `${mappedTexture} (${remote.soilGrids.clayPct}% clay / ${remote.soilGrids.sandPct}% sand)`
        : null,
      unit: 'Class & %',
      sourceType: latestLabReport
        ? 'laboratory_measurement'
        : mappedTexture
        ? 'mapped_estimate'
        : 'not_measured',
      sourceNote: latestLabReport
        ? `Lab (${latestLabReport.laboratoryName})`
        : mappedTexture
        ? 'ISRIC SoilGrids 250m Mapped Estimate'
        : 'Not measured yet',
    },
    {
      key: 'om',
      label: 'Soil Organic Matter',
      labValue:
        latestLabReport?.organicMatterPercent != null
          ? `${latestLabReport.organicMatterPercent}%`
          : null,
      mappedEstimate:
        remote.soilGrids.organicMatterPct != null ? `~${remote.soilGrids.organicMatterPct}%` : null,
      unit: '% OM',
      sourceType:
        latestLabReport?.organicMatterPercent != null
          ? 'laboratory_measurement'
          : remote.soilGrids.organicMatterPct != null
          ? 'mapped_estimate'
          : 'not_measured',
      sourceNote:
        latestLabReport?.organicMatterPercent != null
          ? `Lab sample (${latestLabReport.sampleDate})`
          : remote.soilGrids.organicMatterPct != null
          ? 'Derived from SoilGrids Organic Carbon'
          : 'Awaiting lab test',
    },
    {
      key: 'fertility',
      label: 'Fertility & CEC Indicator',
      labValue: latestLabReport
        ? `${latestLabReport.fertilityRating}${
            latestLabReport.cecCmolKg != null ? ` (CEC ${latestLabReport.cecCmolKg} cmol/kg)` : ''
          }`
        : null,
      mappedEstimate:
        remote.soilGrids.cecCmolKg != null
          ? `CEC ~${remote.soilGrids.cecCmolKg} cmol/kg`
          : null,
      unit: 'cmol(+)/kg',
      sourceType: latestLabReport
        ? 'laboratory_measurement'
        : remote.soilGrids.cecCmolKg != null
        ? 'mapped_estimate'
        : 'not_measured',
      sourceNote: latestLabReport
        ? `Lab measurement`
        : remote.soilGrids.cecCmolKg != null
        ? 'ISRIC SoilGrids CEC Estimate'
        : 'Requires lab CEC test',
    },
    {
      key: 'nutrients',
      label: 'Primary Nutrients (N · P · K)',
      labValue:
        latestLabReport &&
        (latestLabReport.nitrogenMgKg != null ||
          latestLabReport.phosphorusMgKg != null ||
          latestLabReport.potassiumMgKg != null)
          ? `N ${latestLabReport.nitrogenMgKg ?? '—'} · P ${latestLabReport.phosphorusMgKg ?? '—'} · K ${latestLabReport.potassiumMgKg ?? '—'} mg/kg`
          : null,
      mappedEstimate:
        remote.soilGrids.nitrogenGKg != null
          ? `Total N ~${remote.soilGrids.nitrogenGKg} g/kg (P & K require lab test)`
          : null,
      unit: 'mg/kg',
      sourceType:
        latestLabReport &&
        (latestLabReport.phosphorusMgKg != null || latestLabReport.potassiumMgKg != null)
          ? 'laboratory_measurement'
          : remote.soilGrids.nitrogenGKg != null
          ? 'mapped_estimate'
          : 'not_measured',
      sourceNote: latestLabReport
        ? `Lab Extractable Nutrients`
        : 'P & K cannot be estimated by satellite; upload lab test',
    },
    {
      key: 'drainage',
      label: 'Soil Drainage',
      labValue: latestLabReport ? latestLabReport.drainageClass : null,
      mappedEstimate: mappedDrainage,
      unit: 'Class',
      sourceType: latestLabReport
        ? 'laboratory_measurement'
        : mappedDrainage
        ? 'mapped_estimate'
        : 'not_measured',
      sourceNote: latestLabReport ? 'Field & lab soil assessment' : 'Inferred from mapped clay %',
    },
    {
      key: 'awc',
      label: 'Water-Holding Capacity (AWC)',
      labValue:
        latestLabReport?.waterHoldingCapacityMmPerM != null
          ? `${latestLabReport.waterHoldingCapacityMmPerM} mm/m`
          : null,
      mappedEstimate: mappedAwc != null ? `~${mappedAwc} mm/m` : null,
      unit: 'mm/m',
      sourceType:
        latestLabReport?.waterHoldingCapacityMmPerM != null
          ? 'laboratory_measurement'
          : mappedAwc != null
          ? 'mapped_estimate'
          : 'not_measured',
      sourceNote:
        latestLabReport?.waterHoldingCapacityMmPerM != null
          ? 'Laboratory soil retention test'
          : mappedAwc != null
          ? 'Estimated from mapped texture class'
          : 'Not measured yet',
    },
  ];

  const loggedWaterLiters = store.db.mixedFarmingEntries
    .filter((e) => e.farmId === farmId)
    .reduce((s, e) => s + e.waterLiters, 0);

  const suitabilityOptions = computeLandSuitability({
    farm,
    location,
    fields,
    latestLabReport,
    soilGrids: remote.soilGrids,
    selectedFarmingType,
  });

  return {
    farmId: farm.id,
    farmName: farm.name,
    fetchedAt: new Date().toISOString(),
    coordinates: {
      latitude: location.latitude,
      longitude: location.longitude,
      locationSource: location.locationSource,
    },
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
    },
    dataSources: [
      {
        id: 'src-lab',
        name: 'Farmer-Uploaded Laboratory Soil Reports',
        providerType: 'laboratory',
        status: latestLabReport ? 'farmer_uploaded' : 'unavailable',
        summary: latestLabReport
          ? `${reports.length} lab report(s) uploaded. Latest: ${latestLabReport.laboratoryName} (${latestLabReport.sampleDate}).`
          : 'No laboratory soil report uploaded yet for this farm. Upload a report to replace mapped estimates with actual field measurements.',
        lastUpdated: latestLabReport ? latestLabReport.sampleDate : null,
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
        id: 'src-arc',
        name: 'Agricultural Research Council (ARC-ISCW) Land Type Reference',
        providerType: 'national_dataset',
        status: 'reference_only',
        summary: `${regionalProfile.arcLandTypeRef}. Broad land-type context; does not replace farm-level sampling.`,
        lastUpdated: null,
      },
      {
        id: 'src-dalrrd',
        name: 'Department of Agriculture (DALRRD) Geospatial & Land Capability Adapter',
        providerType: 'national_dataset',
        status: 'reference_only',
        summary: `Configured for ${location.province} / ${location.districtMunicipality}. Connect institutional WFS endpoint via DALRRD_SOIL_WFS_URL when licensed access is provisioned.`,
        lastUpdated: null,
      },
    ],
    hasLabReport: Boolean(latestLabReport),
    latestLabReport,
    allLabReports: reports,
    soilMetrics,
    suitabilityOptions,
  };
}
