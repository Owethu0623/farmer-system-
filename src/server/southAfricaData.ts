export interface DistrictInfo {
  name: string;
  localMunicipalities: string[];
  center: { lat: number; lng: number };
}

export interface ProvinceInfo {
  code: string;
  name: string;
  climateZone: string;
  annualRainfallMm: string;
  keyCommodities: string[];
  districts: DistrictInfo[];
}

export const SOUTH_AFRICA_PROVINCES: ProvinceInfo[] = [
  {
    code: 'KZN',
    name: 'KwaZulu-Natal',
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
