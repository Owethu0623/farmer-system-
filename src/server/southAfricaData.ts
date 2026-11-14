export interface DistrictInfo {
  name: string;
  localMunicipalities: string[];
  center: { lat: number; lng: number };
}

export interface ProvinceInfo {
  code: string;
  name: string;
  capital: string;
  centerLat: number;
  centerLng: number;
  rainfallRegime: string;
  climateZone: string;
  annualRainfallMm: string;
  keyCommodities: string[];
  districts: DistrictInfo[];
}

export const SOUTH_AFRICA_PROVINCES: ProvinceInfo[] = [
  {
    code: 'KZN',
    name: 'KwaZulu-Natal',
    capital: 'Pietermaritzburg',
    centerLat: -29.6006,
    centerLng: 30.3794,
    rainfallRegime: 'Summer Rainfall',
    climateZone: 'Subtropical Coastal & Midland Grasslands',
    annualRainfallMm: '750 - 1,100 mm',
    keyCommodities: ['Sugarcane', 'Maize', 'Macadamia', 'Beef Cattle', 'Vegetables', 'Timber'],
    districts: [
      {
        name: 'uMgungundlovu District',
        localMunicipalities: ['Msunduzi', 'uMngeni', 'uMshwathi', 'Mkhambathini', 'Richmond'],
        center: { lat: -29.6006, lng: 30.3794 },
      },
      {
        name: 'King Cetshwayo District',
        localMunicipalities: ['uMhlathuze', 'uMlalazi', 'Mthonjaneni', 'Nkandla'],
        center: { lat: -28.7807, lng: 31.8944 },
      },
      {
        name: 'Harry Gwala District',
        localMunicipalities: ['Greater Kokstad', 'Ubuhlebezwe', 'uMzimkhulu', 'Dr Nkosazana Dlamini Zuma'],
        center: { lat: -30.5472, lng: 29.4241 },
      },
    ],
  },
  {
    code: 'MP',
    name: 'Mpumalanga',
    capital: 'Mbombela',
    centerLat: -25.4753,
    centerLng: 30.9694,
    rainfallRegime: 'Summer Rainfall',
    climateZone: 'Highveld Summer Rainfall & Subtropical Lowveld',
    annualRainfallMm: '650 - 1,050 mm',
    keyCommodities: ['Maize', 'Soybeans', 'Citrus', 'Avocados', 'Vegetables', 'Beef Cattle'],
    districts: [
      {
        name: 'Ehlanzeni District',
        localMunicipalities: ['Mbombela', 'Nkomazi', 'Thaba Chweu', 'Bushbuckridge'],
        center: { lat: -25.4753, lng: 30.9694 },
      },
      {
        name: 'Gert Sibande District',
        localMunicipalities: ['Msukaligwa', 'Lekwa', 'Govan Mbeki', 'Pixley Ka Seme', 'Mkhondo'],
        center: { lat: -26.5204, lng: 29.9844 },
      },
      {
        name: 'Nkangala District',
        localMunicipalities: ['Emalahleni', 'Steve Tshwete', 'Thembisile Hani', 'Victor Khanye'],
        center: { lat: -25.7714, lng: 29.4648 },
      },
    ],
  },
  {
    code: 'LP',
    name: 'Limpopo',
    capital: 'Polokwane',
    centerLat: -23.9045,
    centerLng: 29.4689,
    rainfallRegime: 'Summer Rainfall',
    climateZone: 'Savanna Bushveld & Subtropical Escarpment',
    annualRainfallMm: '400 - 850 mm',
    keyCommodities: ['Citrus', 'Tomatoes', 'Potatoes', 'Mangoes', 'Avocados', 'Goats & Beef'],
    districts: [
      {
        name: 'Capricorn District',
        localMunicipalities: ['Polokwane', 'Molemole', 'Lepelle-Nkumpi', 'Blouberg'],
        center: { lat: -23.9045, lng: 29.4689 },
      },
      {
        name: 'Mopani District',
        localMunicipalities: ['Greater Tzaneen', 'Greater Letaba', 'Ba-Phalaborwa', 'Maruleng'],
        center: { lat: -23.8332, lng: 30.1635 },
      },
      {
        name: 'Vhembe District',
        localMunicipalities: ['Thulamela', 'Makhado', 'Collins Chabane', 'Musina'],
        center: { lat: -22.9761, lng: 30.4518 },
      },
    ],
  },
  {
    code: 'EC',
    name: 'Eastern Cape',
    capital: 'Bhisho',
    centerLat: -32.7854,
    centerLng: 27.3924,
    rainfallRegime: 'All-Year & Summer Rainfall',
    climateZone: 'Coastal Temperate, Karoo & Subtropical East',
    annualRainfallMm: '350 - 900 mm',
    keyCommodities: ['Citrus', 'Mohair & Goats', 'Sheep', 'Dairy', 'Maize', 'Chicory'],
    districts: [
      {
        name: 'Sarah Baartman District',
        localMunicipalities: ['Sundays River Valley', 'Makana', 'Kouga', 'Blue Crane Route'],
        center: { lat: -33.4601, lng: 25.6358 },
      },
      {
        name: 'OR Tambo District',
        localMunicipalities: ['King Sabata Dalindyebo', 'Nyandeni', 'Mhlontlo', 'Ingquza Hill'],
        center: { lat: -31.5889, lng: 28.7844 },
      },
      {
        name: 'Amathole District',
        localMunicipalities: ['Amahlathi', 'Raymond Mhlaba', 'Mnquma', 'Great Kei'],
        center: { lat: -32.7854, lng: 27.3924 },
      },
    ],
  },
  {
    code: 'WC',
    name: 'Western Cape',
    capital: 'Cape Town',
    centerLat: -33.6462,
    centerLng: 19.4485,
    rainfallRegime: 'Winter Rainfall',
    climateZone: 'Mediterranean Winter Rainfall & Klein Karoo',
    annualRainfallMm: '300 - 800 mm',
    keyCommodities: ['Pome & Stone Fruit', 'Wine & Table Grapes', 'Wheat', 'Vegetables', 'Dairy'],
    districts: [
      {
        name: 'Cape Winelands District',
        localMunicipalities: ['Stellenbosch', 'Drakenstein', 'Breede Valley', 'Witzenberg', 'Langeberg'],
        center: { lat: -33.6462, lng: 19.4485 },
      },
      {
        name: 'Overberg District',
        localMunicipalities: ['Theewaterskloof', 'Overstrand', 'Cape Agulhas', 'Swellendam'],
        center: { lat: -34.2128, lng: 19.4339 },
      },
      {
        name: 'West Coast District',
        localMunicipalities: ['Swartland', 'Bergrivier', 'Cederberg', 'Matzikama'],
        center: { lat: -32.9896, lng: 18.7299 },
      },
    ],
  },
  {
    code: 'FS',
    name: 'Free State',
    capital: 'Bloemfontein',
    centerLat: -28.2308,
    centerLng: 28.3071,
    rainfallRegime: 'Summer Rainfall',
    climateZone: 'Highveld Semi-Arid Summer Grain Belt',
    annualRainfallMm: '450 - 700 mm',
    keyCommodities: ['Maize', 'Wheat', 'Soybeans', 'Sunflower', 'Beef Cattle', 'Sheep'],
    districts: [
      {
        name: 'Thabo Mofutsanyana District',
        localMunicipalities: ['Dihlabeng', 'Maluti-a-Phofung', 'Setsoto', 'Mantsopa'],
        center: { lat: -28.2308, lng: 28.3071 },
      },
      {
        name: 'Fezile Dabi District',
        localMunicipalities: ['Moqhaka', 'Metsimaholo', 'Ngwathe', 'Mafube'],
        center: { lat: -27.6504, lng: 27.2349 },
      },
      {
        name: 'Lejweleputswa District',
        localMunicipalities: ['Matjhabeng', 'Nala', 'Tswelopele', 'Masilonyana'],
        center: { lat: -27.9774, lng: 26.7351 },
      },
    ],
  },
  {
    code: 'NW',
    name: 'North West',
    capital: 'Mahikeng',
    centerLat: -25.8652,
    centerLng: 25.6442,
    rainfallRegime: 'Summer Rainfall',
    climateZone: 'Semi-Arid Bushveld & Summer Grain Savanna',
    annualRainfallMm: '350 - 650 mm',
    keyCommodities: ['Maize', 'Sunflower', 'Groundnuts', 'Beef Cattle', 'Lucerne', 'Poultry'],
    districts: [
      {
        name: 'Ngaka Modiri Molema District',
        localMunicipalities: ['Mahikeng', 'Ditsobotla', 'Ramotshere Moiloa', 'Ratlou'],
        center: { lat: -25.8652, lng: 25.6442 },
      },
      {
        name: 'Bojanala Platinum District',
        localMunicipalities: ['Rustenburg', 'Madibeng', 'Moses Kotane', 'Kgetlengrivier'],
        center: { lat: -25.6544, lng: 27.2421 },
      },
      {
        name: 'Dr Kenneth Kaunda District',
        localMunicipalities: ['JB Marks', 'City of Matlosana', 'Maquassi Hills'],
        center: { lat: -26.7145, lng: 27.0970 },
      },
    ],
  },
  {
    code: 'GP',
    name: 'Gauteng',
    capital: 'Johannesburg',
    centerLat: -26.1103,
    centerLng: 27.7725,
    rainfallRegime: 'Summer Rainfall',
    climateZone: 'Highveld Peri-Urban & Intensive Agriculture',
    annualRainfallMm: '600 - 750 mm',
    keyCommodities: ['Hydroponic & Tunnel Vegetables', 'Poultry & Eggs', 'Piggery', 'Maize', 'Dairy'],
    districts: [
      {
        name: 'West Rand District',
        localMunicipalities: ['Mogale City', 'Rand West City', 'Merafong City'],
        center: { lat: -26.1103, lng: 27.7725 },
      },
      {
        name: 'Sedibeng District',
        localMunicipalities: ['Emfuleni', 'Midvaal', 'Lesedi'],
        center: { lat: -26.6498, lng: 28.0061 },
      },
      {
        name: 'City of Tshwane Metro',
        localMunicipalities: ['Cullinan / Dinokeng', 'Bronkhorstspruit', 'Hammanskraal'],
        center: { lat: -25.6701, lng: 28.5236 },
      },
    ],
  },
  {
    code: 'NC',
    name: 'Northern Cape',
    capital: 'Kimberley',
    centerLat: -28.7282,
    centerLng: 24.7499,
    rainfallRegime: 'Semi-Arid Summer Rainfall',
    climateZone: 'Arid Karoo & Orange River Irrigated Corridor',
    annualRainfallMm: '120 - 350 mm',
    keyCommodities: ['Table Grapes', 'Dates', 'Pecans', 'Lucerne', 'Sheep', 'Game & Goats'],
    districts: [
      {
        name: 'ZF Mgcawu District',
        localMunicipalities: ['Dawid Kruiper', 'Kai !Garib', 'Kheis', 'Tsantsabane'],
        center: { lat: -28.4478, lng: 21.2561 },
      },
      {
        name: 'Pixley ka Seme District',
        localMunicipalities: ['Emthanjeni', 'Umsobomvu', 'Siyathemba', 'Siyancuma'],
        center: { lat: -30.6484, lng: 24.0123 },
      },
      {
        name: 'Frances Baard District',
        localMunicipalities: ['Sol Plaatje', 'Phokwane', 'Dikgatlong', 'Magareng'],
        center: { lat: -28.7282, lng: 24.7499 },
      },
    ],
  },
];

export const FARMING_OPPORTUNITIES = [
  {
    id: 'opp-veg-tunnel',
    title: 'High-Value Spinach, Cabbage & Tunnel Tomatoes',
    province: 'All Provinces (Peri-Urban & Irrigated)',
    minHectares: 0.5,
    startupTier: 'Entry Friendly',
    waterNeed: 'Borehole or Municipal Drip Irrigation',
    cycleDays: '45 - 90 days',
    summary: 'Fast cash-flow horticulture suitable for 0.5–3 ha plots near district towns, schools, and local fresh produce markets.',
  },
  {
    id: 'opp-poultry-layers',
    title: 'Free-Range Layer & Broiler Micro-Enterprise',
    province: 'Gauteng, KwaZulu-Natal, Limpopo, North West',
    minHectares: 0.25,
    startupTier: 'Low Land Footprint',
    waterNeed: 'Clean Borehole or Municipal Supply',
    cycleDays: '42 days (broilers)',
    summary: 'High-demand protein enterprise requiring strict biosecurity, ventilated housing, and reliable feed procurement.',
  },
  {
    id: 'opp-dryland-maize',
    title: 'Dryland White & Yellow Maize Rotation with Soybeans',
    province: 'Free State, Mpumalanga, North West, KwaZulu-Natal',
    minHectares: 5,
    startupTier: 'Medium Scale',
    waterNeed: 'Summer Rainfall (550mm+)',
    cycleDays: '130 - 150 days',
    summary: 'Summer grain rotation restoring nitrogen through soybeans while supplying regional silos and livestock feed mills.',
  },
  {
    id: 'opp-nguni-goats',
    title: 'Climate-Resilient Boer Goats & Nguni Cattle',
    province: 'Eastern Cape, Limpopo, KwaZulu-Natal, Northern Cape',
    minHectares: 10,
    startupTier: 'Veld & Grazing Based',
    waterNeed: 'Livestock Troughs / Dam / Borehole',
    cycleDays: 'Year-round rotational grazing',
    summary: 'Indigenous hardy breeds adapted to South African bushveld heat, tick tolerance, and variable rainfall.',
  },
  {
    id: 'opp-citrus-subtrop',
    title: 'Export Citrus, Avocados & Macadamia Orchards',
    province: 'Limpopo, Mpumalanga, Eastern Cape, Western Cape',
    minHectares: 3,
    startupTier: 'Long-Term Capital',
    waterNeed: 'Registered Water Rights / River / Dam',
    cycleDays: '3 - 5 years to full yield',
    summary: 'High-margin perennial orchards suited to frost-free valleys with drip irrigation and cooperative packhouse access.',
  },
];

export const BEGINNER_GUIDES = [
  {
    id: 'guide-soil-test',
    step: '01',
    title: 'Test Your Soil Before Buying Seed',
    duration: '3 min read',
    summary: 'Send 500g composite soil samples from 0–20cm depth to your provincial agricultural lab to measure pH, phosphorus, and potassium before spending on fertilizer.',
    checklist: [
      'Take 10–15 small samples across your plot in a zig-zag pattern',
      'Mix in a clean plastic bucket and remove stones or roots',
      'Check target pH (6.0–6.8 for most vegetables and maize)',
    ],
  },
  {
    id: 'guide-water-budget',
    step: '02',
    title: 'Verify Borehole Yield & Seasonal Water Rights',
    duration: '4 min read',
    summary: 'Never plant more hectares than your driest winter month water supply can sustain. Match drip irrigation lines to borehole liters-per-hour.',
    checklist: [
      'Measure borehole recovery rate (liters per hour)',
      'Install a 5,000L–10,000L storage tank as a pressure buffer',
      'Register water use with your Catchment Management Agency if required',
    ],
  },
  {
    id: 'guide-market-first',
    step: '03',
    title: 'Secure Local Offtake Before Planting',
    duration: '3 min read',
    summary: 'Speak to local fresh produce markets, spaza networks, school nutrition buyers, and packhouses before selecting planting dates and crop varieties.',
    checklist: [
      'List 3 reliable buyers within 50km of your plot',
      'Stagger planting every 2 weeks to avoid harvest gluts',
      'Record input costs per bed or hectare from day one',
    ],
  },
];

export const SA_COORDINATE_BOUNDS = {
  minLat: -35.0,
  maxLat: -21.8,
  minLng: 16.0,
  maxLng: 33.5,
} as const;

export interface SaCoordinateValidationResult {
  valid: boolean;
  lat: number | null;
  lng: number | null;
  error?: string;
}

/**
 * Validates that GPS coordinates are finite numbers within South Africa's geographic bounds.
 * Prevents (0,0) null-island or foreign coordinates from corrupting spatial/weather queries.
 */
export function validateSaCoordinates(latRaw: unknown, lngRaw: unknown): SaCoordinateValidationResult {
  if (latRaw === undefined || latRaw === null || latRaw === '' || lngRaw === undefined || lngRaw === null || lngRaw === '') {
    return { valid: false, lat: null, lng: null, error: 'Latitude and longitude are required.' };
  }
  const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
  const lng = typeof lngRaw === 'number' ? lngRaw : Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valid: false, lat: null, lng: null, error: 'Coordinates must be valid numbers.' };
  }
  if (
    lat < SA_COORDINATE_BOUNDS.minLat ||
    lat > SA_COORDINATE_BOUNDS.maxLat ||
    lng < SA_COORDINATE_BOUNDS.minLng ||
    lng > SA_COORDINATE_BOUNDS.maxLng
  ) {
    return {
      valid: false,
      lat,
      lng,
      error: `Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}) lie outside South Africa (lat ${SA_COORDINATE_BOUNDS.minLat} to ${SA_COORDINATE_BOUNDS.maxLat}, lng ${SA_COORDINATE_BOUNDS.minLng} to ${SA_COORDINATE_BOUNDS.maxLng}).`,
    };
  }
  return { valid: true, lat, lng };
}

/**
 * Estimates typical agricultural elevation (meters above sea level) by South African province/zone
 * when real topographic DEM data is unavailable offline.
 */
export function estimateSaElevationMeters(province?: string, lat?: number, lng?: number): number {
  const p = (province || '').toLowerCase();
  if (p.includes('gauteng')) return 1550;
  if (p.includes('free state')) return 1420;
  if (p.includes('mpumalanga')) return lng !== undefined && lng > 30.6 ? 680 : 1480;
  if (p.includes('north west')) return 1280;
  if (p.includes('northern cape')) return 980;
  if (p.includes('limpopo')) return lat !== undefined && lat > -23.5 ? 620 : 1120;
  if (p.includes('kwazulu')) return lng !== undefined && lng > 31.0 ? 220 : 960;
  if (p.includes('eastern cape')) return lng !== undefined && lng < 26.5 ? 450 : 620;
  if (p.includes('western cape')) return lng !== undefined && lng < 19.2 ? 140 : 320;
  return 950;
}

export interface SaSeasonalGuidance {
  regime: 'Winter Rainfall (Mediterranean)' | 'Summer Rainfall (Interior Highveld)' | 'All-Year / Subtropical Coastal';
  seasonLabel: string;
  plantingWindow: string;
  recommendedCrops: string[];
  livestockAdvisory: string;
}

export function getSaSeasonalGuidance(province: string, month: number): SaSeasonalGuidance {
  const p = province.toLowerCase();
  const isWinterRain = p.includes('western cape');
  const isCoastalSubtrop = p.includes('kwazulu') || p.includes('eastern cape') || p.includes('limpopo');

  const seasonLabel =
    month >= 9 && month <= 11
      ? 'Spring (Sep–Nov)'
      : month === 12 || month <= 2
      ? 'Summer (Dec–Feb)'
      : month >= 3 && month <= 5
      ? 'Autumn (Mar–May)'
      : 'Winter (Jun–Aug)';

  if (isWinterRain) {
    return {
      regime: 'Winter Rainfall (Mediterranean)',
      seasonLabel,
      plantingWindow:
        month >= 4 && month <= 6
          ? 'Peak winter grain (wheat, barley, canola) & cover-crop planting window'
          : month >= 9 && month <= 11
          ? 'Irrigated summer vegetables, vineyard canopy care, and stone fruit thinning'
          : 'Orchard pruning, dam storage review, and soil conditioning',
      recommendedCrops:
        month >= 4 && month <= 8
          ? ['Winter Wheat', 'Canola', 'Lupins', 'Brassicas', 'Cover Oats']
          : ['Table/Wine Grapes (maintenance)', 'Stone Fruit', 'Irrigated Tomatoes', 'Onions'],
      livestockAdvisory: 'Monitor winter camp drainage in Boland/Overberg; supplement trace minerals on dry summer stubble.',
    };
  }

  if (isCoastalSubtrop && !p.includes('free state')) {
    return {
      regime: 'All-Year / Subtropical Coastal',
      seasonLabel,
      plantingWindow:
        month >= 9 && month <= 12
          ? 'Main summer maize, dry beans, macadamia flush, and subtropical horticulture'
          : month >= 3 && month <= 5
          ? 'Cool-season vegetables (cabbage, spinach, onions) and sugarcane planting'
          : 'Frost-free coastal horticulture & winter dry-season irrigation scheduling',
      recommendedCrops:
        month >= 9 || month <= 2
          ? ['Maize', 'Dry Beans', 'Butternut', 'Tomatoes', 'Subtropical Fruit']
          : ['Cabbage', 'Spinach', 'Carrots', 'Potatoes', 'Green Beans'],
      livestockAdvisory: 'Maintain high-frequency tick/dipping control in humid summer; reserve hay bales for Jun–Aug dry spell.',
    };
  }

  return {
    regime: 'Summer Rainfall (Interior Highveld)',
    seasonLabel,
    plantingWindow:
      month >= 10 && month <= 12
        ? 'Primary dryland maize, soybean, sunflower & sorghum planting window'
        : month >= 1 && month <= 3
        ? 'Late-season forage crops (sorghum/oats) and top-dressing checks'
        : month >= 5 && month <= 8
        ? 'Highveld frost season: soil sampling, lime incorporation & winter wheat under irrigation'
        : 'Pre-rain soil ripping, seed/fertilizer procurement & planter calibration',
    recommendedCrops:
      month >= 9 && month <= 12
        ? ['White & Yellow Maize', 'Soybeans', 'Sunflower', 'Dry Beans', 'Sorghum']
        : ['Irrigated Winter Wheat', 'Spinach', 'Cabbage', 'Oats Forage'],
    livestockAdvisory:
      month >= 5 && month <= 8
        ? 'Highveld winter protein licks and firebreak maintenance critical for beef cattle and sheep.'
        : 'Rotational veld camps to match spring grass flush and prevent Haemonchus/internal parasites after rain.',
  };
}

