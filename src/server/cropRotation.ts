import { buildFieldSummary, normalizeTextureFromLegacy } from './soilLandIntelligence.ts';
import { SOUTH_AFRICA_PROVINCES } from './southAfricaData.ts';
import { store } from './store.ts';
import { SoilProvenanceType } from './types.ts';
import { fetchNasaPowerClimateComparison, fetchNasaPowerSummary } from './weather.ts';

export type FarmerPriorityCode =
  | 'improve_soil_health'
  | 'conserve_water'
  | 'adapt_to_climate'
  | 'diversify_crops'
  | 'long_term_resilience'
  | 'spread_market_risk';

export const FARMER_PRIORITY_OPTIONS: {
  code: FarmerPriorityCode;
  label: string;
  description: string;
}[] = [
  {
    code: 'improve_soil_health',
    label: 'Improve soil health',
    description: 'Prioritises biological nitrogen fixation, organic residue cover, and soil structure recovery.',
  },
  {
    code: 'conserve_water',
    label: 'Conserve water',
    description: 'Favours low-to-moderate water-demand crops, moisture-saving cover, and drought spacing.',
  },
  {
    code: 'adapt_to_climate',
    label: 'Adapt to changing climate conditions',
    description: 'Adjusts species away from recent heat-stress, frost-risk, or dry-spell vulnerabilities.',
  },
  {
    code: 'diversify_crops',
    label: 'Diversify crops',
    description: 'Maximises distinct botanical families and breaks pest, weed, and fungal host continuity.',
  },
  {
    code: 'long_term_resilience',
    label: 'Improve long-term farm resilience',
    description: 'Balances root depth, soil fertility stability, and lower chemical-input dependence.',
  },
  {
    code: 'spread_market_risk',
    label: 'Spread income and market risk',
    description: 'Combines complementary grain, oilseed, legume, or horticultural market channels.',
  },
];

export interface CropRotationCatalogItem {
  id: string;
  name: string;
  category: 'Cereal' | 'Legume' | 'Oilseed' | 'Vegetable / Cover';
  botanicalFamily: string;
  familyGroupLabel: string;
  preferredSeason: 'Main Summer' | 'Cool / Transition' | 'Year-round';
  waterNeed: 'Low' | 'Moderate' | 'High';
  waterRequirementMmRange: string;
  idealPhRange: [number, number];
  typicalCycleDays: string;
  nitrogenRole:
    | 'Nitrogen-fixing legume'
    | 'Heavy nitrogen feeder'
    | 'Moderate feeder'
    | 'Deep-rooting scavenger';
  residueContribution: 'Low' | 'Moderate' | 'High';
  temperatureSensitivity: string;
  soilPreferences: string;
  growthCharacteristics: string;
  nitrogenCharacteristics: string;
  rotationConsiderations: string;
  diseaseAndPestConsiderations: string;
  agronomicReference: string;
  summary: string;
  suitableRegimes: ('summer' | 'winter' | 'all_year' | 'semi_arid')[];
  preferredTextures: ('Sandy' | 'Loam' | 'Clay Loam' | 'Clay')[];
  drainageTolerance: 'sensitive_to_poor' | 'tolerant_of_moderate' | 'broad';
  droughtToleranceScore: number; // 1-10
  marketSpreadCategory: 'staple_grain' | 'protein_legume' | 'oilseed_cash' | 'fresh_market' | 'fodder_cover';
  benefits: string[];
  risks: string[];
  plantingChecklist: string[];
}

export const SOUTH_AFRICA_ROTATION_CATALOG: CropRotationCatalogItem[] = [
  {
    id: 'maize',
    name: 'Maize (Dryland / Irrigated)',
    category: 'Cereal',
    botanicalFamily: 'Poaceae',
    familyGroupLabel: 'Cereal Grain (Poaceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'Moderate',
    waterRequirementMmRange: '450–650 mm/season (sensitive at flowering/silking)',
    idealPhRange: [5.5, 7.0],
    typicalCycleDays: '120–150 days',
    nitrogenRole: 'Heavy nitrogen feeder',
    residueContribution: 'High',
    temperatureSensitivity: 'Frost-sensitive; heat stress above 33°C during pollination reduces grain set (cultivar-dependent).',
    soilPreferences: 'Deep well-drained Loam or Sandy Loam (effective depth >=75 cm); tolerates mild acidity down to pH(H2O) 5.5.',
    growthCharacteristics: 'Tall C4 summer cereal with fibrous shallow-to-mid root system; high biomass stover production.',
    nitrogenCharacteristics: 'High nitrogen demand (~20–25 kg N per tonne expected grain); pairs strongly after Fabaceae legumes.',
    rotationConsiderations: 'Avoid back-to-back continuous maize; rotate with Soybeans, Dry Beans, Cowpeas, or Sunflower.',
    diseaseAndPestConsiderations: 'Stalk borer, fall armyworm, grey leaf spot, and northern corn leaf blight build up under continuous Poaceae.',
    agronomicReference: 'ARC-Grain Crops & DALRRD Summer Grain Production Guidelines',
    summary: 'Staple South African summer grain crop producing strong erosion-protecting stover residue when paired with legumes.',
    suitableRegimes: ['summer', 'all_year'],
    preferredTextures: ['Loam', 'Clay Loam', 'Sandy'],
    drainageTolerance: 'tolerant_of_moderate',
    droughtToleranceScore: 5,
    marketSpreadCategory: 'staple_grain',
    benefits: [
      'High stover residue shields topsoil from wind and convective storm erosion.',
      'Broad domestic grain and silage market channels across South Africa.',
    ],
    risks: [
      'Moisture stress during tasselling and silking sharply reduces kernel set.',
      'Continuous maize monocropping escalates stalk borer and foliar blight pressure.',
    ],
    plantingChecklist: [
      'Confirm composite topsoil pH (5.5–7.0) and apply agricultural lime 6+ weeks pre-plant if acidic.',
      'Match cultivar maturity and target plant population to realistic seasonal moisture.',
      'Band basal phosphorus at planting and split nitrogen top-dressing at V4–V6 stage.',
    ],
  },
  {
    id: 'wheat',
    name: 'Wheat (Winter / Irrigated Cereal)',
    category: 'Cereal',
    botanicalFamily: 'Poaceae',
    familyGroupLabel: 'Cool-Season Cereal Grain (Poaceae)',
    preferredSeason: 'Cool / Transition',
    waterNeed: 'Moderate',
    waterRequirementMmRange: '350–500 mm/season (winter rain or winter irrigation)',
    idealPhRange: [5.5, 7.2],
    typicalCycleDays: '125–155 days',
    nitrogenRole: 'Heavy nitrogen feeder',
    residueContribution: 'High',
    temperatureSensitivity: 'Cool-season C3 cereal; tolerates winter cold during tillering, sensitive to frost at flowering and heat >30°C during grain fill.',
    soilPreferences: 'Loam to Clay Loam with moderate-to-good drainage; avoid severe waterlogging and sub-pH 5.0.',
    growthCharacteristics: 'Cool-season tillering cereal forming dense ground-covering winter canopy and persistent straw stubble.',
    nitrogenCharacteristics: 'High nitrogen consumer; benefits measurably from residual nitrogen after Lupin or Canola break crops.',
    rotationConsiderations: 'Proven in Western Cape Swartland/Overberg rotations with Canola and Lupin, or summer-rainfall irrigated rotations.',
    diseaseAndPestConsiderations: 'Take-all root rot (Gaeumannomyces graminis), Fusarium crown rot, and Russian wheat aphid intensify in wheat-after-wheat.',
    agronomicReference: 'ARC-Small Grain Institute & Winter Cereal Trust Guidelines',
    summary: 'Primary cool-season cereal for winter-rainfall Western Cape or irrigated winter blocks when rotated with broadleaf break crops.',
    suitableRegimes: ['winter', 'all_year'],
    preferredTextures: ['Loam', 'Clay Loam', 'Clay'],
    drainageTolerance: 'tolerant_of_moderate',
    droughtToleranceScore: 6,
    marketSpreadCategory: 'staple_grain',
    benefits: [
      'Dense straw residue conserves summer moisture and suppresses weeds when retained as mulch.',
      'Stabilises winter ground cover against wind and seasonal front erosion.',
    ],
    risks: [
      'Dryland grain fails in summer-rainfall provinces without stored soil moisture or active irrigation.',
      'Consecutive Poaceae (wheat-after-wheat or maize-after-wheat) elevates take-all and crown-rot carryover.',
    ],
    plantingChecklist: [
      'In summer-rainfall zones, verify full irrigation allocation before committing to winter wheat.',
      'Use a 2-year broadleaf break (Canola, Lupin, or Legumes) to suppress take-all root disease.',
      'Scout early tillering stages for Russian wheat aphid and stripe/leaf rust.',
    ],
  },
  {
    id: 'sorghum',
    name: 'Grain Sorghum',
    category: 'Cereal',
    botanicalFamily: 'Poaceae',
    familyGroupLabel: 'Drought-Hardy Cereal (Poaceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'Low',
    waterRequirementMmRange: '320–480 mm/season (high dry-spell recovery)',
    idealPhRange: [5.5, 7.5],
    typicalCycleDays: '110–135 days',
    nitrogenRole: 'Heavy nitrogen feeder',
    residueContribution: 'Moderate',
    temperatureSensitivity: 'Heat-tolerant warm-season cereal (optimal 22–34°C); slow emergence below 18°C soil temp and frost-sensitive.',
    soilPreferences: 'Adapts across Sandy Loam to heavy Clay and mildly alkaline soils better than maize.',
    growthCharacteristics: 'Deep branching fibrous roots and waxy leaves pause growth during dry spells and resume after rain.',
    nitrogenCharacteristics: 'Moderate-to-high nitrogen demand; thrives following nitrogen-fixing cowpeas or dry beans.',
    rotationConsiderations: 'Strong water-conserving substitute for maize in drier regions; avoid following maize directly because both are Poaceae.',
    diseaseAndPestConsiderations: 'Sugarcane aphid, sorghum midge, downy mildew, and bird damage near roosting wetlands.',
    agronomicReference: 'ARC-Grain Crops & DALRRD Sorghum Advisory',
    summary: 'Drought-resilient summer cereal suited to semi-arid zones, warmer summers, or erratic mid-season rainfall.',
    suitableRegimes: ['summer', 'semi_arid', 'all_year'],
    preferredTextures: ['Sandy', 'Loam', 'Clay Loam', 'Clay'],
    drainageTolerance: 'broad',
    droughtToleranceScore: 9,
    marketSpreadCategory: 'staple_grain',
    benefits: [
      'Tolerates mid-season dry spells and high daytime heat far better than dryland maize.',
      'Adapts to heavier clays and higher pH soils where legumes struggle.',
    ],
    risks: [
      'Quelea and dove grain losses near open water require prompt harvest timing.',
      'Shares Poaceae family with maize — insert a legume or sunflower break between cereals.',
    ],
    plantingChecklist: [
      'Wait until 0–10 cm soil temperature exceeds 18°C for even emergence.',
      'Control grass weeds early and scout weekly for aphids during booting.',
      'Alternate with Cowpeas or Sunflower rather than following Maize directly.',
    ],
  },
  {
    id: 'soybeans',
    name: 'Soybeans',
    category: 'Legume',
    botanicalFamily: 'Fabaceae',
    familyGroupLabel: 'Protein Oilseed Legume (Fabaceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'Moderate',
    waterRequirementMmRange: '450–600 mm/season',
    idealPhRange: [5.8, 7.0],
    typicalCycleDays: '115–140 days',
    nitrogenRole: 'Nitrogen-fixing legume',
    residueContribution: 'Moderate',
    temperatureSensitivity: 'Warm-season legume; high temperatures >35°C during flowering cause pod abortion; frost-sensitive.',
    soilPreferences: 'Well-to-moderately drained Loam or Clay Loam (pH 5.8–7.0); poor nodulation in acid soils <5.4.',
    growthCharacteristics: 'Deep taproot improves soil aeration; dense canopy shades mid-season weeds before autumn leaf drop.',
    nitrogenCharacteristics: 'Fixes atmospheric N via Bradyrhizobium japonicum, lowering N fertiliser needs for following maize/wheat.',
    rotationConsiderations: 'Gold-standard alternating crop with Maize; avoid planting immediately before/after Dry Beans, Sunflower, or Canola (shared Sclerotinia).',
    diseaseAndPestConsiderations: 'Soybean rust in humid KZN/Mpumalanga, Sclerotinia stem rot in cool wet canopies, and pod bollworm.',
    agronomicReference: 'Oilseeds Advisory Committee & ARC-Grain Crops Soybean Guide',
    summary: 'Commercial nitrogen-fixing oilseed legume widely rotated with South African summer cereals.',
    suitableRegimes: ['summer', 'all_year'],
    preferredTextures: ['Loam', 'Clay Loam'],
    drainageTolerance: 'tolerant_of_moderate',
    droughtToleranceScore: 5,
    marketSpreadCategory: 'protein_legume',
    benefits: [
      'Contributes biological nitrogen carryover and cuts synthetic N costs for the next cereal.',
      'Disrupts maize stalk-borer and cereal leaf-blight cycles.',
    ],
    risks: [
      'Pod shattering if harvest is delayed during dry autumn winds.',
      'Susceptible to soybean rust in humid eastern regions without fungicide scouting.',
    ],
    plantingChecklist: [
      'Inoculate seed with viable Bradyrhizobium japonicum out of direct sunlight.',
      'Verify soil P, Ca, and molybdenum status; avoid fields with recent Sclerotinia outbreaks.',
      'Match maturity group (MG 4–7) to local frost-free window.',
    ],
  },
  {
    id: 'dry_beans',
    name: 'Dry Beans / Speckled Sugar Beans',
    category: 'Legume',
    botanicalFamily: 'Fabaceae',
    familyGroupLabel: 'Edible Pulse Legume (Fabaceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'Moderate',
    waterRequirementMmRange: '350–500 mm/season (shorter 90–115d window)',
    idealPhRange: [5.8, 7.0],
    typicalCycleDays: '90–115 days',
    nitrogenRole: 'Nitrogen-fixing legume',
    residueContribution: 'Low',
    temperatureSensitivity: 'Frost-sensitive; pollen fertility drops sharply above 32°C daytime heat at flowering.',
    soilPreferences: 'Well-drained Loam or Sandy Loam; highly sensitive to waterlogging, surface crusting, and pH <5.6.',
    growthCharacteristics: 'Compact bushy or semi-determinate legume with rapid 90–115 day turnover leaving modest residue.',
    nitrogenCharacteristics: 'Fixes modest-to-moderate nitrogen with Phaseolus Rhizobium; requires small starter N on low-OM soils.',
    rotationConsiderations: 'High-value rotational partner after Maize or Sorghum; leave >=2–3 years between Dry Beans, Soybeans, or Sunflower.',
    diseaseAndPestConsiderations: 'Common bacterial blight, halo blight, anthracnose, and Sclerotinia white mould in wet poorly drained blocks.',
    agronomicReference: 'Dry Bean Producers Organisation (DPO) & ARC Production Guidelines',
    summary: 'Shorter-cycle summer pulse legume ideal for breaking cereal disease pressure and spreading farm cash income.',
    suitableRegimes: ['summer', 'all_year'],
    preferredTextures: ['Loam', 'Sandy'],
    drainageTolerance: 'sensitive_to_poor',
    droughtToleranceScore: 5,
    marketSpreadCategory: 'protein_legume',
    benefits: [
      'Shorter 90–115 day cycle allows flexible planting dates after mid-spring rain onset.',
      'Strong dry-pulse retail demand and rapid cash-flow diversification.',
    ],
    risks: [
      'Root rot and bacterial blight escalate rapidly on poorly drained clay soils.',
      'Low post-harvest residue leaves bare topsoil unless followed by a cover crop or mulch.',
    ],
    plantingChecklist: [
      'Plant only certified disease-free seed treated with Phaseolus Rhizobium inoculant.',
      'Avoid poorly drained low-lying basins and verify pH >=5.8.',
      'Avoid rotating directly after Soybean, Cowpea, or Sunflower.',
    ],
  },
  {
    id: 'lupin',
    name: 'Sweet Lupin (Narrow-Leafed / Broad-Leafed)',
    category: 'Legume',
    botanicalFamily: 'Fabaceae',
    familyGroupLabel: 'Acid-Tolerant Cool Legume (Fabaceae)',
    preferredSeason: 'Cool / Transition',
    waterNeed: 'Low',
    waterRequirementMmRange: '280–450 mm/season (winter-rainfall / cool conditions)',
    idealPhRange: [5.0, 6.6],
    typicalCycleDays: '130–160 days',
    nitrogenRole: 'Nitrogen-fixing legume',
    residueContribution: 'Moderate',
    temperatureSensitivity: 'Cool-season legume; tolerates light winter frosts better than dry beans, sensitive to severe heat >30°C at pod fill.',
    soilPreferences: 'Thrives on well-drained Sandy to Sandy Loam acidic soils (pH 5.0–6.5); struggles on alkaline calcareous or waterlogged clays.',
    growthCharacteristics: 'Strong deep taproot breaks compacted plough pans and mobilises bound soil phosphorus.',
    nitrogenCharacteristics: 'High biological nitrogen fixer (Bradyrhizobium lupini); proven nitrogen booster before winter wheat.',
    rotationConsiderations: 'Key broadleaf legume in Western Cape wheat–canola–lupin systems; leave >=3 years between consecutive lupin crops.',
    diseaseAndPestConsiderations: 'Anthracnose, Pleiochaeta brown leaf spot, and root rot on waterlogged soils.',
    agronomicReference: 'Western Cape Dept of Agriculture (Elsenburg) & Protein Research Foundation',
    summary: 'Deep-rooted cool-season legume adapted to acidic sandy/loam soils that fixes nitrogen and breaks cereal take-all cycles.',
    suitableRegimes: ['winter', 'all_year'],
    preferredTextures: ['Sandy', 'Loam'],
    drainageTolerance: 'sensitive_to_poor',
    droughtToleranceScore: 7,
    marketSpreadCategory: 'protein_legume',
    benefits: [
      'Outperforms beans and soybeans on slightly acidic sandy/loam soils (pH 5.0–6.4).',
      'Deep taproot scavenges subsoil P and breaks winter cereal root diseases.',
    ],
    risks: [
      'High mortality on poorly drained clay soils or alkaline calcareous soils (pH >7.0).',
      'Anthracnose can cause severe yield loss if infected seed is planted.',
    ],
    plantingChecklist: [
      'Confirm soil is well drained and check pH (<6.8) to avoid iron/manganese deficiency.',
      'Use certified anthracnose-free sweet lupin seed inoculated with Group G/S Bradyrhizobium.',
      'Plant in cool autumn/early-winter moisture; keep 3+ year break before repeating lupin.',
    ],
  },
  {
    id: 'cowpeas',
    name: 'Cowpeas (Morogo / Grain)',
    category: 'Legume',
    botanicalFamily: 'Fabaceae',
    familyGroupLabel: 'Heat-Hardy Legume (Fabaceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'Low',
    waterRequirementMmRange: '250–420 mm/season',
    idealPhRange: [5.5, 7.2],
    typicalCycleDays: '75–105 days',
    nitrogenRole: 'Nitrogen-fixing legume',
    residueContribution: 'Moderate',
    temperatureSensitivity: 'Thrives in warm-to-hot summers (22–36°C); highly frost-sensitive.',
    soilPreferences: 'Tolerates sandy low-fertility soils well provided drainage is moderate to good.',
    growthCharacteristics: 'Spreading ground-hugging vine/semi-bush canopy rapidly shades soil, cutting surface evaporation and weed germination.',
    nitrogenCharacteristics: 'Robust native-adapted Rhizobium nitrogen fixation even in warmer sandy soils.',
    rotationConsiderations: 'Ideal soil-cover & N-restoration break after Maize or Sorghum in dryland or smallholder systems.',
    diseaseAndPestConsiderations: 'Aphids, pod-borers, and root-knot nematodes if rotated too tightly with susceptible solanaceous crops.',
    agronomicReference: 'ARC-Vegetable, Industrial & Medicinal Plants & DALRRD Cowpea Guide',
    summary: 'Drought-hardy indigenous-adapted legume delivering nitrogen, rapid soil cover, leafy morogo, grain, or fodder.',
    suitableRegimes: ['summer', 'semi_arid', 'all_year'],
    preferredTextures: ['Sandy', 'Loam', 'Clay Loam'],
    drainageTolerance: 'tolerant_of_moderate',
    droughtToleranceScore: 9,
    marketSpreadCategory: 'protein_legume',
    benefits: [
      'Exceptional drought tolerance and rapid ground cover to cool topsoil during heatwaves.',
      'Dual-purpose food, cash pulse, and high-protein livestock fodder flexibility.',
    ],
    risks: [
      'Aphids and pod-sucking bugs spike during mid-summer dry spells.',
      'Poor cold tolerance limits planting to frost-free summer windows.',
    ],
    plantingChecklist: [
      'Seed only after spring soil warms above 18°C on well-drained beds.',
      'Avoid following other Fabaceae legumes directly.',
      'Scout flower buds early for aphids and blister beetles.',
    ],
  },
  {
    id: 'sunflower',
    name: 'Sunflower',
    category: 'Oilseed',
    botanicalFamily: 'Asteraceae',
    familyGroupLabel: 'Deep-Root Oilseed (Asteraceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'Low',
    waterRequirementMmRange: '320–500 mm/season (deep moisture scavenger)',
    idealPhRange: [6.0, 7.5],
    typicalCycleDays: '105–130 days',
    nitrogenRole: 'Deep-rooting scavenger',
    residueContribution: 'Low',
    temperatureSensitivity: 'Heat-tolerant warm-season broadleaf; late planting tolerates cool autumn maturation better than maize.',
    soilPreferences: 'Deep Loam, Clay Loam, or Sandy Clay Loam (>=75 cm); avoid poorly drained shallow clays.',
    growthCharacteristics: 'Taproot reaches 1.5–2.0 m to recover leached subsoil nitrates and residual moisture missed by cereals.',
    nitrogenCharacteristics: 'Low-to-moderate N requirement; acts as a deep nutrient scavenger rather than fixer.',
    rotationConsiderations: 'Distinct Asteraceae break after Poaceae cereals; leave 3–4 years between Sunflower, Soybeans, Dry Beans, or Canola for Sclerotinia control.',
    diseaseAndPestConsiderations: 'Sclerotinia head/stem rot, Alternaria leaf spot, and bird damage in ripening heads.',
    agronomicReference: 'ARC-Grain Crops Sunflower Manual & Oilseeds Advisory Committee',
    summary: 'Deep-rooted drought-resilient oilseed broadleaf that scavenges subsoil moisture and diversifies market risk.',
    suitableRegimes: ['summer', 'semi_arid', 'all_year'],
    preferredTextures: ['Loam', 'Clay Loam', 'Clay'],
    drainageTolerance: 'sensitive_to_poor',
    droughtToleranceScore: 8,
    marketSpreadCategory: 'oilseed_cash',
    benefits: [
      'Explores deeper subsoil moisture & nitrates left below maize/sorghum root zones.',
      'Lower input cost and flexible later summer planting window.',
    ],
    risks: [
      'Leaves low surface residue and drier subsoil for the very next dryland crop.',
      'Shares Sclerotinia pathogen risk with soybeans, dry beans, and canola.',
    ],
    plantingChecklist: [
      'Confirm >=75 cm rooting depth and >=3-year gap from Sclerotinia hosts.',
      'Adjust plant density conservatively (30,000–45,000 plants/ha) in drier regions.',
      'Follow with residue-rich cereal or cover crop to rebuild topsoil ground cover.',
    ],
  },
  {
    id: 'canola',
    name: 'Canola / Mustard Break Crop',
    category: 'Oilseed',
    botanicalFamily: 'Brassicaceae',
    familyGroupLabel: 'Cool-Season Oilseed (Brassicaceae)',
    preferredSeason: 'Cool / Transition',
    waterNeed: 'Moderate',
    waterRequirementMmRange: '350–480 mm/season (cool winter/spring moisture)',
    idealPhRange: [5.8, 7.0],
    typicalCycleDays: '125–155 days',
    nitrogenRole: 'Deep-rooting scavenger',
    residueContribution: 'Moderate',
    temperatureSensitivity: 'Cool-season crop; heat >28°C during flowering/pod fill cuts oil %; frost-tolerant at rosette stage.',
    soilPreferences: 'Well-to-moderately drained Loam, Sandy Loam, or Clay Loam (pH 5.8–7.0).',
    growthCharacteristics: 'Deep taproot loosens compacted layers; biofumigant brassica root exudates suppress cereal root pathogens.',
    nitrogenCharacteristics: 'Moderate-to-high N and sulfur demand; leaves clean weed-suppressed seedbed for subsequent wheat.',
    rotationConsiderations: 'Cornerstone break crop in Wheat–Canola–Lupin rotations; wait 3–4 years before repeating Brassicaceae.',
    diseaseAndPestConsiderations: 'Blackleg (Phoma), Sclerotinia stem rot, clubroot in acid soils, and diamondback moth.',
    agronomicReference: 'Protein Research Foundation & Western Cape Canola Working Group',
    summary: 'Cool-season brassica oilseed break crop proven to suppress winter cereal root diseases and loosen topsoil.',
    suitableRegimes: ['winter', 'all_year'],
    preferredTextures: ['Loam', 'Clay Loam', 'Sandy'],
    drainageTolerance: 'sensitive_to_poor',
    droughtToleranceScore: 6,
    marketSpreadCategory: 'oilseed_cash',
    benefits: [
      'Biofumigant brassica roots break wheat take-all and cereal root-rot complexes.',
      'Deep taproot improves water infiltration into compacted subsoils.',
    ],
    risks: [
      'Unsuitable for dry summer-rainfall winters without verified winter irrigation.',
      'Diamondback moth and Sclerotinia require weekly flowering inspections.',
    ],
    plantingChecklist: [
      'Confirm autumn rain onset (Western Cape) or winter irrigation allocation.',
      'Include sulfur alongside nitrogen top-dressing and verify pH >=5.8.',
      'Keep a 3-to-4-year gap before planting canola, cabbage, or mustard again.',
    ],
  },
  {
    id: 'cabbage_brassica',
    name: 'Cabbage / Kale (Brassicas)',
    category: 'Vegetable / Cover',
    botanicalFamily: 'Brassicaceae',
    familyGroupLabel: 'Leafy Brassica (Brassicaceae)',
    preferredSeason: 'Cool / Transition',
    waterNeed: 'High',
    waterRequirementMmRange: '450–600 mm (frequent irrigation)',
    idealPhRange: [6.0, 6.8],
    typicalCycleDays: '75–105 days',
    nitrogenRole: 'Heavy nitrogen feeder',
    residueContribution: 'Low',
    temperatureSensitivity: 'Prefers cool-to-mild temps (12–25°C); extreme heat causes bolting and tipburn.',
    soilPreferences: 'Fertile Loam / Clay Loam with good drainage and pH >=6.0 (suppresses clubroot).',
    growthCharacteristics: 'Shallow fibrous roots requiring uniform topsoil moisture and high fertility.',
    nitrogenCharacteristics: 'Heavy feeder; ideally follows a legume or composted bed.',
    rotationConsiderations: 'Strict 2–3 year break before repeating any Brassicaceae (cabbage, kale, canola).',
    diseaseAndPestConsiderations: 'Clubroot, black rot, diamondback moth, and aphids.',
    agronomicReference: 'ARC-VOPI & Provincial Vegetable Extension Guides',
    summary: 'Irrigated cool/shoulder-season vegetable providing strong local market turnover and non-cereal family rotation.',
    suitableRegimes: ['winter', 'all_year', 'summer'],
    preferredTextures: ['Loam', 'Clay Loam'],
    drainageTolerance: 'sensitive_to_poor',
    droughtToleranceScore: 2,
    marketSpreadCategory: 'fresh_market',
    benefits: [
      'Brassicaceae rotation disrupts cereal and Solanaceae pest/nematode complexes.',
      'Short 75–105 day turnover improves irrigated cash flow.',
    ],
    risks: [
      'High water sensitivity — moisture gaps split heads and raise pest pressure.',
      'Clubroot escalates rapidly if planted on acidic (pH <5.8) or brassica-repeated beds.',
    ],
    plantingChecklist: [
      'Verify reliable drip/sprinkler capacity before transplanting.',
      'Lime acidic topsoils above pH 6.0 and avoid consecutive Brassicaceae.',
      'Scout undersides of leaves twice weekly for diamondback moth larvae.',
    ],
  },
  {
    id: 'tomatoes',
    name: 'Tomatoes / Peppers (Solanaceae)',
    category: 'Vegetable / Cover',
    botanicalFamily: 'Solanaceae',
    familyGroupLabel: 'Fruiting Vegetable (Solanaceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'High',
    waterRequirementMmRange: '500–700 mm (drip irrigation recommended)',
    idealPhRange: [5.8, 6.8],
    typicalCycleDays: '90–120 days',
    nitrogenRole: 'Moderate feeder',
    residueContribution: 'Low',
    temperatureSensitivity: 'Very frost-sensitive; blossom drop occurs above 33°C daytime heat or <10°C nights.',
    soilPreferences: 'Deep well-drained Loam or Sandy Loam; avoid heavy poorly drained clays.',
    growthCharacteristics: 'Intensive trellised horticultural crop requiring potassium/calcium balance and mulch.',
    nitrogenCharacteristics: 'Balanced N-P-K and Ca feeder; excessive N reduces fruit firmness.',
    rotationConsiderations: 'Strict 3–4 year gap from tomatoes, potatoes, peppers, or brinjals.',
    diseaseAndPestConsiderations: 'Bacterial wilt, early/late blight, Tuta absoluta, and root-knot nematodes.',
    agronomicReference: 'ARC-VOPI Tomato & Pepper Production Manual',
    summary: 'High-value irrigated fruiting crop suited to frost-free or summer windows with drip irrigation and market buyers.',
    suitableRegimes: ['summer', 'all_year'],
    preferredTextures: ['Loam', 'Sandy'],
    drainageTolerance: 'sensitive_to_poor',
    droughtToleranceScore: 2,
    marketSpreadCategory: 'fresh_market',
    benefits: [
      'High market return potential per hectare under drip irrigation.',
      'Distinct botanical family away from Poaceae grains and Fabaceae legumes.',
    ],
    risks: [
      'Severe blight, wilt, and nematode loss if soil is poorly drained or recently grew potatoes/peppers.',
      'High capital/labour exposure under heatwaves or erratic water.',
    ],
    plantingChecklist: [
      'Confirm 3-season Solanaceae-free history and root-knot nematode freedom.',
      'Use drip irrigation plus organic or plastic mulch to prevent soil splash.',
      'Secure off-take buyers prior to nursery seedling orders.',
    ],
  },
  {
    id: 'spinach_swiss_chard',
    name: 'Spinach / Swiss Chard',
    category: 'Vegetable / Cover',
    botanicalFamily: 'Amaranthaceae',
    familyGroupLabel: 'Leafy Greens (Amaranthaceae)',
    preferredSeason: 'Cool / Transition',
    waterNeed: 'Moderate',
    waterRequirementMmRange: '300–450 mm (light frequent watering)',
    idealPhRange: [6.0, 7.2],
    typicalCycleDays: '50–75 days',
    nitrogenRole: 'Moderate feeder',
    residueContribution: 'Low',
    temperatureSensitivity: 'Cool/mild optimum (10–25°C); bolts in sustained >30°C heat.',
    soilPreferences: 'Well-drained Sandy Loam to Loam (pH 6.0–7.2).',
    growthCharacteristics: 'Fast multi-cut leafy green providing quick canopy cover and regular local harvest.',
    nitrogenCharacteristics: 'Moderate N feeder responding cleanly to compost or legume residue.',
    rotationConsiderations: 'Avoid repeating directly after beetroot or Swiss chard; good bridge crop.',
    diseaseAndPestConsiderations: 'Cercospora leaf spot, downy mildew, and leaf miners.',
    agronomicReference: 'ARC-VOPI & DALRRD Leafy Vegetable Guidelines',
    summary: 'Rapid 50–75 day irrigated leafy green bridging main-season grain/legume cycles.',
    suitableRegimes: ['winter', 'all_year', 'summer'],
    preferredTextures: ['Sandy', 'Loam'],
    drainageTolerance: 'tolerant_of_moderate',
    droughtToleranceScore: 4,
    marketSpreadCategory: 'fresh_market',
    benefits: [
      'Shortest crop cycle (50–75 days) creates rapid cash flow between main seasons.',
      'Amaranthaceae family avoids sharing cereal, legume, or brassica pathogens.',
    ],
    risks: [
      'Requires frequent light irrigation on sandy topsoils.',
      'Perishable harvest requires immediate same-day cooling and local sales.',
    ],
    plantingChecklist: [
      'Schedule light irrigation every 2–4 days during dry spells.',
      'Avoid following beetroot (Amaranthaceae) directly.',
      'Plan cooling/packing workflow before first leaf cut.',
    ],
  },
  {
    id: 'winter_wheat_oats',
    name: 'Winter Oats / Cover Cereal',
    category: 'Vegetable / Cover',
    botanicalFamily: 'Poaceae',
    familyGroupLabel: 'Cool-Season Cover / Fodder Cereal (Poaceae)',
    preferredSeason: 'Cool / Transition',
    waterNeed: 'Low',
    waterRequirementMmRange: '220–380 mm (winter rain or residual autumn moisture)',
    idealPhRange: [5.2, 7.2],
    typicalCycleDays: '100–135 days',
    nitrogenRole: 'Moderate feeder',
    residueContribution: 'High',
    temperatureSensitivity: 'Cold-hardy cool-season cover; withstands moderate Highveld winter frost.',
    soilPreferences: 'Broadly adaptable (Sandy to Clay Loam), more acid-tolerant than wheat.',
    growthCharacteristics: 'Fast winter biomass producer that traps residual soil nitrates and shields bare soil from winter wind erosion.',
    nitrogenCharacteristics: 'Scavenges residual N over winter and returns high-carbon organic mulch residue.',
    rotationConsiderations: 'Valuable winter soil-protection cover between summer crops; share Poaceae family so pair with legumes or brassicas.',
    diseaseAndPestConsiderations: 'Oat crown rust and aphids; terminate cleanly before seeding summer maize to avoid nitrogen tie-up.',
    agronomicReference: 'ARC-Animal Production & Conservation Agriculture Cover Crop Guides',
    summary: 'Resilient cool-season cover or fodder cereal protecting bare winter soil and building organic residue.',
    suitableRegimes: ['winter', 'all_year', 'summer'],
    preferredTextures: ['Sandy', 'Loam', 'Clay Loam', 'Clay'],
    drainageTolerance: 'broad',
    droughtToleranceScore: 7,
    marketSpreadCategory: 'fodder_cover',
    benefits: [
      'Protects bare winter topsoil from dust storms and traps residual nitrates.',
      'Builds high organic mulch cover for moisture conservation in the next summer crop.',
    ],
    risks: [
      'Needs stored autumn moisture or winter irrigation to establish on summer-rainfall dryland.',
      'Belongs to Poaceae — terminate 3–4 weeks early if summer maize follows.',
    ],
    plantingChecklist: [
      'Establish into late-summer residual moisture or light winter irrigation.',
      'In conservation tillage, roll/terminate cover before seed set to retain protective mulch.',
      'Consider mixing with vetch/clover or following with a legume.',
    ],
  },
  {
    id: 'sweet_potato',
    name: 'Sweet Potato (Vines / Storage Roots)',
    category: 'Vegetable / Cover',
    botanicalFamily: 'Convolvulaceae',
    familyGroupLabel: 'Trailing Root & Ground-Cover Crop (Convolvulaceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'Low',
    waterRequirementMmRange: '350–500 mm/season (drought-tolerant once vines establish)',
    idealPhRange: [5.5, 6.8],
    typicalCycleDays: '110–150 days',
    nitrogenRole: 'Moderate feeder',
    residueContribution: 'High',
    temperatureSensitivity: 'Warm-season root crop (optimum 21–30°C); foliage killed by frost (<=2°C) and tubers chill-injured below 10°C soil temp.',
    soilPreferences: 'Well-drained Sandy to Sandy Loam ridges; heavy waterlogged clay causes misshapen roots and tuber rot.',
    growthCharacteristics: 'Fast-spreading trailing vine canopy blankets topsoil within 5–6 weeks, reducing soil evaporation and suppressing weeds.',
    nitrogenCharacteristics: 'Low-to-moderate N requirement; excess nitrogen drives excessive leafy vine growth at the expense of storage roots.',
    rotationConsiderations: 'Convolvulaceae family cleanly breaks cereal (Poaceae), legume (Fabaceae), brassica, and solanaceous (potato/tomato) disease cycles.',
    diseaseAndPestConsiderations: 'Sweet potato weevil (Cylas spp.) in cracked dry soils and root-knot nematodes; use certified virus-indexed vine cuttings.',
    agronomicReference: 'ARC-Vegetable, Industrial & Medicinal Plants (Roodeplaat) Sweet Potato Guide',
    summary: 'Heat-hardy, low-water storage root crop whose dense trailing vine canopy conserves soil moisture and breaks Solanaceae/Poaceae pest cycles.',
    suitableRegimes: ['summer', 'semi_arid', 'all_year'],
    preferredTextures: ['Sandy', 'Loam'],
    drainageTolerance: 'sensitive_to_poor',
    droughtToleranceScore: 8,
    marketSpreadCategory: 'fresh_market',
    benefits: [
      'Convolvulaceae family breaks both Solanaceae (potato/tomato) and Poaceae (maize/sorghum) disease & pest hosts.',
      'Dense trailing vine cover shields topsoil from high solar radiation and cuts soil surface evaporation.',
      'Recovers strongly from mid-season dry spells once root system is established.',
    ],
    risks: [
      'Heavy clay or poorly drained soils restrict root expansion and increase rot risk.',
      'Soil cracking during dry periods exposes storage roots to sweet potato weevil.',
    ],
    plantingChecklist: [
      'Prepare raised ridges (30–40 cm high) on Sandy/Loam soils to guarantee drainage and root shape.',
      'Use certified disease- and weevil-free vine cuttings rather than sprouting old infected tubers.',
      'Avoid over-applying nitrogen fertiliser so energy goes into marketable storage roots rather than vines.',
    ],
  },
];

export interface ScoreComponentItem {
  key: string;
  label: string;
  weightPercent: number;
  rawScore: number; // 0-100
  weightedPoints: number;
  rationale: string;
}

export interface SequenceEvaluationResult {
  sequenceId: string;
  strategyName: string;
  seasons: {
    seasonNumber: number;
    seasonLabel: string;
    plantingWindow: string;
    cropId: string;
    cropName: string;
    category: string;
    botanicalFamily: string;
    nitrogenRole: string;
    waterNeed: 'Low' | 'Moderate' | 'High';
    residueContribution: 'Low' | 'Moderate' | 'High';
    suitabilityLevel: 'Strong Fit' | 'Conditional Fit' | 'Caution';
    suitabilityReasons: string[];
    benefits: string[];
    risks: string[];
    plantingChecklist: string[];
  }[];
  decisionSupportScore: number; // 0-100
  scoreBreakdown: {
    formula: string;
    statusLabel: string;
    components: ScoreComponentItem[];
  };
  indicators: {
    botanicalDiversityCount: number;
    distinctFamilies: string[];
    legumeIncluded: boolean;
    estimatedNitrogenSupport: 'High (Biological N Fixation)' | 'Moderate' | 'Low (External N Needed)';
    residueCoverRating: 'High Cover' | 'Moderate Cover' | 'Low Cover';
    waterResilienceRating: 'High' | 'Moderate' | 'Low';
    climateResilienceRating: 'High' | 'Moderate' | 'Low';
    soilMoistureSuitability: 'Well Aligned' | 'Conditional' | 'Mismatch / Stress Risk';
  };
  sourceTags: {
    indicator: string;
    sourceCategory:
      | 'NASA Observation'
      | 'NASA Model Wetness (GWETROOT/GWETTOP)'
      | 'Farmer-Provided Soil / Field'
      | 'Laboratory Soil Report'
      | 'Agronomic Rule Estimate'
      | 'Simulated Outcome';
    detail: string;
  }[];
  whyRecommended: string;
  influencingInputs: {
    nasaObservations: string[];
    soilAndFieldInputs: string[];
    cropAndHistoryFactors: string[];
    farmerPriorityFactors: string[];
  };
  soilHealthConsiderations: string[];
  waterConsiderations: string[];
  climateConsiderations: string[];
  warnings: string[];
  tradeOffs: string[];
  missingInformation: string[];
  nextSteps: string[];
  whenAlternativePreferred: string;
}

interface ScenarioContextResolved {
  siteLabel: string;
  farmId: string | null;
  fieldId: string | null;
  fieldName: string | null;
  province: string;
  latitude: number;
  longitude: number;
  rainfallRegime: string;
  regimeKey: 'summer' | 'winter' | 'all_year' | 'semi_arid';
  farmSizeHectares: number;
  waterAvailability: string;
  hasIrrigation: boolean;
  isLimitedWater: boolean;
  soilTexture: 'Sandy' | 'Loam' | 'Clay Loam' | 'Clay' | 'Unknown';
  organicMatterLevel: 'Low' | 'Medium' | 'High' | 'Unknown';
  soilDrainage: 'Poor' | 'Moderate' | 'Good' | 'Unknown';
  waterHoldingCharacteristic: 'Low' | 'Moderate' | 'High' | 'Unknown';
  soilPh: number | null;
  effectivePhForRules: number;
  soilDataSource: string;
  hasLabReport: boolean;
  previousSeasonCrop: string;
  twoSeasonsAgoCrop: string;
  currentCrop: string;
  priorities: FarmerPriorityCode[];
  nasaAvailable: boolean;
  nasaUnavailableReason: string | null;
  recentAnnualMm: number | null;
  baselineAnnualMm: number | null;
  rainDeltaMm: number | null;
  avgMaxTempC: number | null;
  avgMeanTempC: number | null;
  avgSolar: number | null;
  avgEvlandMmDay: number | null;
  avgVpdKpa: number | null;
  past30DaysNasaMm: number | null;
  past60DaysNasaMm: number | null;
  gwetRootRecent: number | null;
  gwetTopRecent: number | null;
  gwetProfRecent: number | null;
  drySpellDays60d: number | null;
  hotDays32c: number | null;
  frostDays2c: number | null;
  recurringDryYearsCount: number;
  dataConfidence: 'Moderate-High' | 'Moderate' | 'Lower Confidence';
  missingInfoList: string[];
}

function resolveCropFamilyFromText(cropText: string): string | null {
  const lower = cropText.trim().toLowerCase();
  if (!lower) return null;
  if (lower.includes('sweet potato') || lower.includes('sweet_potato') || lower.includes('patat') || lower.includes('batatas')) {
    return 'Convolvulaceae';
  }
  const direct = SOUTH_AFRICA_ROTATION_CATALOG.find(
    (c) => lower.includes(c.id) || lower.includes(c.name.toLowerCase().split(' ')[0])
  );
  if (direct) return direct.botanicalFamily;
  if (lower.includes('maize') || lower.includes('corn') || lower.includes('wheat') || lower.includes('oat') || lower.includes('sorghum') || lower.includes('barley')) return 'Poaceae';
  if (lower.includes('bean') || lower.includes('soy') || lower.includes('lupin') || lower.includes('cowpea') || lower.includes('lucerne') || lower.includes('pea')) return 'Fabaceae';
  if (lower.includes('cabbage') || lower.includes('canola') || lower.includes('kale') || lower.includes('mustard')) return 'Brassicaceae';
  if (lower.includes('sunflower')) return 'Asteraceae';
  if (lower.includes('tomato') || lower.includes('potato') || lower.includes('pepper')) return 'Solanaceae';
  if (lower.includes('spinach') || lower.includes('chard') || lower.includes('beet')) return 'Amaranthaceae';
  return null;
}

function normalizePriorities(inputPriorities?: string[], legacyPriorityText?: string): FarmerPriorityCode[] {
  const validCodes = new Set<FarmerPriorityCode>(FARMER_PRIORITY_OPTIONS.map((p) => p.code));
  const picked: FarmerPriorityCode[] = [];
  if (Array.isArray(inputPriorities)) {
    for (const raw of inputPriorities) {
      if (validCodes.has(raw as FarmerPriorityCode) && !picked.includes(raw as FarmerPriorityCode)) {
        picked.push(raw as FarmerPriorityCode);
      }
    }
  }
  if (picked.length === 0 && legacyPriorityText) {
    const l = legacyPriorityText.toLowerCase();
    if (l.includes('soil') || l.includes('nitrogen') || l.includes('health')) picked.push('improve_soil_health');
    if (l.includes('water') || l.includes('drought')) picked.push('conserve_water');
    if (l.includes('climate')) picked.push('adapt_to_climate');
    if (l.includes('divers')) picked.push('diversify_crops');
    if (l.includes('resilien')) picked.push('long_term_resilience');
    if (l.includes('market') || l.includes('income')) picked.push('spread_market_risk');
  }
  if (picked.length === 0) {
    picked.push('improve_soil_health', 'conserve_water', 'adapt_to_climate');
  }
  return picked.slice(0, 3);
}

async function resolveScenarioContext(input: {
  farmId?: string | null;
  fieldId?: string | null;
  province?: string;
  waterAvailability?: string;
  soilType?: string;
  soilTexture?: string;
  organicMatterLevel?: string;
  soilDrainage?: string;
  waterHoldingCharacteristic?: string;
  soilPh?: number;
  farmSizeHectares?: number;
  previousSeasonCrop?: string;
  twoSeasonsAgoCrop?: string;
  farmerPriority?: string;
  farmerPriorities?: string[];
}): Promise<ScenarioContextResolved> {
  const farm = input.farmId ? store.db.farms.find((f) => f.id === input.farmId) : undefined;
  const location = farm ? store.db.farmLocations.find((l) => l.farmId === farm.id) : undefined;
  const farmFields = farm ? store.db.fields.filter((fl) => fl.farmId === farm.id) : [];
  const fieldObj = input.fieldId
    ? farmFields.find((fl) => fl.id === input.fieldId) || farmFields[0]
    : farmFields[0];

  const farmReports = farm
    ? store.db.soilReports
        .filter((r) => r.farmId === farm.id)
        .sort((a, b) => b.sampleDate.localeCompare(a.sampleDate))
    : [];
  const labReport =
    (fieldObj ? farmReports.find((r) => r.fieldId === fieldObj.id) : undefined) || farmReports[0];

  const fieldSummary = fieldObj ? buildFieldSummary(fieldObj, farmReports) : null;

  const provinceName = location?.province || input.province || 'Free State';
  const prov =
    SOUTH_AFRICA_PROVINCES.find((p) => p.name === provinceName) || SOUTH_AFRICA_PROVINCES[0];

  const lat = location?.latitude ?? prov.centerLat;
  const lng = location?.longitude ?? prov.centerLng;
  const waterAvailability =
    input.waterAvailability ||
    fieldObj?.irrigationType ||
    farm?.waterAvailability ||
    'Seasonal Rainfall Only (Dryland)';
  const waterLower = waterAvailability.toLowerCase();
  const hasIrrigation =
    waterLower.includes('irrigat') ||
    waterLower.includes('borehole') ||
    waterLower.includes('dam') ||
    waterLower.includes('river') ||
    waterLower.includes('drip') ||
    waterLower.includes('pivot') ||
    waterLower.includes('sprinkler') ||
    waterLower.includes('municipal');
  const isLimitedWater =
    !hasIrrigation &&
    (waterLower.includes('rain') ||
      waterLower.includes('dry') ||
      waterLower.includes('seasonal') ||
      waterLower.includes('unverified'));

  const soilTexture = normalizeTextureFromLegacy(
    input.soilType || labReport?.soilTextureClass || fieldSummary?.soilType,
    input.soilTexture || fieldSummary?.soilTexture
  );

  const organicMatterLevel: ScenarioContextResolved['organicMatterLevel'] =
    input.organicMatterLevel === 'Low' ||
    input.organicMatterLevel === 'Medium' ||
    input.organicMatterLevel === 'High' ||
    input.organicMatterLevel === 'Unknown'
      ? input.organicMatterLevel
      : fieldSummary?.organicMatterLevel && fieldSummary.organicMatterLevel !== 'Unknown'
        ? fieldSummary.organicMatterLevel
        : labReport?.organicMatterPercent != null
          ? labReport.organicMatterPercent < 1.5
            ? 'Low'
            : labReport.organicMatterPercent < 3.0
              ? 'Medium'
              : 'High'
          : 'Unknown';

  const soilDrainage: ScenarioContextResolved['soilDrainage'] =
    input.soilDrainage === 'Poor' ||
    input.soilDrainage === 'Moderate' ||
    input.soilDrainage === 'Good' ||
    input.soilDrainage === 'Unknown'
      ? input.soilDrainage
      : fieldSummary?.soilDrainage && fieldSummary.soilDrainage !== 'Unknown'
        ? fieldSummary.soilDrainage
        : labReport?.drainageClass
          ? labReport.drainageClass.toLowerCase().includes('poor') ||
            labReport.drainageClass.toLowerCase().includes('imperfect')
            ? 'Poor'
            : labReport.drainageClass.toLowerCase().includes('moderately')
              ? 'Moderate'
              : 'Good'
          : 'Unknown';

  const waterHoldingCharacteristic: ScenarioContextResolved['waterHoldingCharacteristic'] =
    input.waterHoldingCharacteristic === 'Low' ||
    input.waterHoldingCharacteristic === 'Moderate' ||
    input.waterHoldingCharacteristic === 'High' ||
    input.waterHoldingCharacteristic === 'Unknown'
      ? input.waterHoldingCharacteristic
      : fieldSummary?.waterHoldingCharacteristic &&
          fieldSummary.waterHoldingCharacteristic !== 'Unknown'
        ? fieldSummary.waterHoldingCharacteristic
        : labReport?.waterHoldingCapacityMmPerM != null
          ? labReport.waterHoldingCapacityMmPerM < 105
            ? 'Low'
            : labReport.waterHoldingCapacityMmPerM < 140
              ? 'Moderate'
              : 'High'
          : 'Unknown';

  const soilPh =
    typeof input.soilPh === 'number' && Number.isFinite(input.soilPh)
      ? Number(input.soilPh.toFixed(1))
      : fieldSummary?.soilPhMeasured ?? labReport?.soilPhWater ?? null;

  const effectivePhForRules = soilPh ?? 6.1;

  const soilDataSource =
    typeof input.soilPh === 'number' && Number.isFinite(input.soilPh)
      ? `Farmer-provided soil pH (${soilPh}) & texture (${soilTexture})`
      : labReport
        ? `Laboratory soil report (${labReport.laboratoryName}, ${labReport.sampleDate})`
        : fieldSummary && soilTexture !== 'Unknown'
          ? `Farmer-provided field soil profile (${fieldSummary.fieldName}: ${soilTexture}, drainage ${soilDrainage})`
          : 'Unverified soil profile (no laboratory report or complete field soil profile attached)';

  const farmSizeHectares =
    typeof input.farmSizeHectares === 'number' && input.farmSizeHectares > 0
      ? input.farmSizeHectares
      : fieldObj?.areaHectares || farm?.farmSizeHectares || 5;

  const rainfallLower = prov.rainfallRegime.toLowerCase();
  const isWinterRain = rainfallLower.includes('winter');
  const isSemiArid = rainfallLower.includes('arid') || prov.annualRainfallMm.includes('200');
  const regimeKey: ScenarioContextResolved['regimeKey'] = isWinterRain
    ? 'winter'
    : isSemiArid
      ? 'semi_arid'
      : rainfallLower.includes('all-year')
        ? 'all_year'
        : 'summer';

  const siteLabel = farm
    ? fieldObj
      ? `${farm.name} — ${fieldObj.name}`
      : farm.name
    : `${prov.name} Candidate Site`;

  const [nasaClimate, nasaDaily] = await Promise.all([
    fetchNasaPowerClimateComparison(lat, lng, {
      province: prov.name,
      locationLabel: siteLabel,
      waterAvailability,
    }),
    fetchNasaPowerSummary(lat, lng),
  ]);

  const missingInfoList: string[] = [];
  if (!labReport && soilPh === null) {
    missingInfoList.push(
      'Laboratory soil pH(H2O/KCl), Bray-1 Phosphorus, and Exchangeable Potassium have not been tested — using cautious mid-range assumptions for pH checks.'
    );
  }
  if (soilTexture === 'Unknown') {
    missingInfoList.push('Field soil texture is marked Unknown — classify Sandy/Loam/Clay to refine drainage and water-retention scoring.');
  }
  if (soilDrainage === 'Unknown') {
    missingInfoList.push('Field drainage status is Unknown — check for standing water after rain before selecting root-rot-sensitive legumes.');
  }
  const previousSeasonCrop =
    input.previousSeasonCrop?.trim() || fieldSummary?.previousSeasonCrop || '';
  const twoSeasonsAgoCrop =
    input.twoSeasonsAgoCrop?.trim() || fieldSummary?.twoSeasonsAgoCrop || '';
  const currentCrop = fieldSummary?.currentCrop || '';

  if (!previousSeasonCrop) {
    missingInfoList.push(
      'Previous season crop history on this field is unrecorded — enter last 1–2 seasons so pest/pathogen carry-over rules can be enforced precisely.'
    );
  }
  if (!nasaClimate.serviceAvailable) {
    missingInfoList.push(
      'Live NASA POWER climate archive could not be retrieved right now — seasonal suitability relies on provincial climate baseline rules at reduced confidence.'
    );
  }

  const dataConfidence: ScenarioContextResolved['dataConfidence'] =
    labReport && nasaClimate.serviceAvailable && Boolean(previousSeasonCrop)
      ? 'Moderate-High'
      : (soilTexture !== 'Unknown' || Boolean(previousSeasonCrop)) && nasaClimate.serviceAvailable
        ? 'Moderate'
        : 'Lower Confidence';

  return {
    siteLabel,
    farmId: farm?.id || null,
    fieldId: fieldObj?.id || null,
    fieldName: fieldObj?.name || null,
    province: prov.name,
    latitude: lat,
    longitude: lng,
    rainfallRegime: prov.rainfallRegime,
    regimeKey,
    farmSizeHectares,
    waterAvailability,
    hasIrrigation,
    isLimitedWater,
    soilTexture,
    organicMatterLevel,
    soilDrainage,
    waterHoldingCharacteristic,
    soilPh,
    effectivePhForRules,
    soilDataSource,
    hasLabReport: Boolean(labReport),
    previousSeasonCrop,
    twoSeasonsAgoCrop,
    currentCrop,
    priorities: normalizePriorities(input.farmerPriorities, input.farmerPriority),
    nasaAvailable: nasaClimate.serviceAvailable,
    nasaUnavailableReason: nasaClimate.unavailableReason,
    recentAnnualMm: nasaClimate.recentMetrics?.meanAnnualRainfallMm ?? null,
    baselineAnnualMm: nasaClimate.baselineMetrics?.meanAnnualRainfallMm ?? null,
    rainDeltaMm: nasaClimate.delta?.annualRainfallChangeMm ?? null,
    avgMaxTempC: nasaClimate.recentMetrics?.avgMaxTempC ?? nasaDaily.avgMaxTempC ?? null,
    avgMeanTempC: nasaClimate.recentMetrics?.avgMeanTempC ?? nasaDaily.avgMeanTempC ?? null,
    avgSolar: nasaClimate.recentMetrics?.avgSolarIrradiance ?? nasaDaily.avgSolarIrradiance ?? null,
    avgEvlandMmDay: nasaClimate.recentMetrics?.avgEvlandMmDay ?? nasaDaily.avgEvlandMmDay ?? null,
    avgVpdKpa: nasaDaily.avgVpdKpa ?? null,
    past30DaysNasaMm: nasaDaily.past30DaysNasaMm ?? null,
    past60DaysNasaMm: nasaDaily.past60DaysNasaMm ?? null,
    gwetRootRecent: nasaDaily.gwetRootRecent ?? nasaClimate.recentMetrics?.avgGwetRoot ?? null,
    gwetTopRecent: nasaDaily.gwetTopRecent ?? nasaClimate.recentMetrics?.avgGwetTop ?? null,
    gwetProfRecent: nasaDaily.gwetProfRecent ?? nasaClimate.recentMetrics?.avgGwetProf ?? null,
    drySpellDays60d: nasaDaily.nasaDrySpellDays ?? null,
    hotDays32c: nasaDaily.nasaHotDays32c ?? null,
    frostDays2c: nasaDaily.nasaFrostDays2c ?? null,
    recurringDryYearsCount: nasaClimate.recurringDryYears.totalDryYearsCount,
    dataConfidence,
    missingInfoList,
  };
}

export function evaluateCropForContext(
  crop: CropRotationCatalogItem,
  ctx: ScenarioContextResolved
) {
  const phVal = ctx.effectivePhForRules;
  const phMatch = phVal >= crop.idealPhRange[0] && phVal <= crop.idealPhRange[1];
  const phNear = phVal >= crop.idealPhRange[0] - 0.5 && phVal <= crop.idealPhRange[1] + 0.5;
  const regimeMatch =
    crop.suitableRegimes.includes(ctx.regimeKey) ||
    (ctx.hasIrrigation && crop.suitableRegimes.includes('all_year'));

  const waterConflict = crop.waterNeed === 'High' && !ctx.hasIrrigation && ctx.isLimitedWater;
  const moistureStretch =
    crop.waterNeed === 'Moderate' &&
    !ctx.hasIrrigation &&
    (ctx.regimeKey === 'semi_arid' ||
      (ctx.recentAnnualMm !== null && ctx.recentAnnualMm < 440) ||
      (ctx.gwetRootRecent !== null && ctx.gwetRootRecent < 0.30));

  const poorDrainageConflict =
    ctx.soilDrainage === 'Poor' && crop.drainageTolerance === 'sensitive_to_poor';
  const textureMatched =
    ctx.soilTexture === 'Unknown' || crop.preferredTextures.includes(ctx.soilTexture);

  let scoreLabel: 'High Fit' | 'Moderate Fit' | 'Marginal Fit' = 'High Fit';
  if (waterConflict || poorDrainageConflict || (!phNear && !regimeMatch)) {
    scoreLabel = 'Marginal Fit';
  } else if (!phMatch || !regimeMatch || moistureStretch || !textureMatched) {
    scoreLabel = 'Moderate Fit';
  }

  const reasons: string[] = [];
  reasons.push(
    regimeMatch
      ? `Matches ${ctx.province} ${ctx.rainfallRegime} climate pattern.`
      : `Off-season moisture risk under pure ${ctx.rainfallRegime} unless reliable irrigation is confirmed.`
  );
  reasons.push(
    ctx.soilPh !== null
      ? phMatch
        ? `Soil pH ${ctx.soilPh} sits inside target range (${crop.idealPhRange[0]}–${crop.idealPhRange[1]}).`
        : phNear
          ? `Soil pH ${ctx.soilPh} sits near boundary (${crop.idealPhRange[0]}–${crop.idealPhRange[1]}); pre-plant amendment review advised.`
          : `Soil pH ${ctx.soilPh} falls outside target ${crop.idealPhRange[0]}–${crop.idealPhRange[1]} range.`
      : `Soil pH is untested (assumed ~${phVal}); confirm via lab test against target ${crop.idealPhRange[0]}–${crop.idealPhRange[1]}.`
  );
  if (waterConflict) {
    reasons.push(`High crop water demand (${crop.waterRequirementMmRange}) conflicts with "${ctx.waterAvailability}".`);
  } else if (moistureStretch) {
    reasons.push(
      `Low NASA moisture signal (${ctx.recentAnnualMm ?? 'low'} mm/yr · GWETROOT ${ctx.gwetRootRecent ?? '—'}) suggests drought-buffered spacing or supplemental water.`
    );
  }
  if (poorDrainageConflict) {
    reasons.push(`Field reports Poor drainage, increasing root-rot risk for ${crop.name}.`);
  }

  return {
    crop,
    scoreLabel,
    reasons,
    waterConflict,
    poorDrainageConflict,
    regimeMatch,
    phMatch,
  };
}

function evaluateThreeCropSequence(params: {
  sequenceId: string;
  strategyName: string;
  crops: [CropRotationCatalogItem, CropRotationCatalogItem, CropRotationCatalogItem];
  ctx: ScenarioContextResolved;
}): SequenceEvaluationResult {
  const { sequenceId, strategyName, crops, ctx } = params;
  const [c1, c2, c3] = crops;
  const prevFamily = resolveCropFamilyFromText(ctx.previousSeasonCrop);
  const twoAgoFamily = resolveCropFamilyFromText(ctx.twoSeasonsAgoCrop);
  const isWinterRain = ctx.regimeKey === 'winter';

  const seasonDefs: {
    num: number;
    label: string;
    window: string;
    crop: CropRotationCatalogItem;
    priorFamily: string | null;
  }[] = [
    {
      num: 1,
      label: isWinterRain ? 'Season 1: Cool / Winter Main Cycle' : 'Season 1: Primary Growing Season',
      window: isWinterRain ? 'April – June' : 'October – December',
      crop: c1,
      priorFamily: prevFamily,
    },
    {
      num: 2,
      label: isWinterRain ? 'Season 2: Warm / Residual Moisture Cycle' : 'Season 2: Cool / Shoulder Window',
      window: isWinterRain ? 'September – November' : 'March – May',
      crop: c2,
      priorFamily: c1.botanicalFamily,
    },
    {
      num: 3,
      label: isWinterRain ? 'Season 3: Follow-up Winter Cycle' : 'Season 3: Follow-up Primary Season',
      window: isWinterRain ? 'April – June (Next Year)' : 'October – December (Next Year)',
      crop: c3,
      priorFamily: c2.botanicalFamily,
    },
  ];

  const seasonEvaluations = seasonDefs.map((sd) => ({
    sd,
    eval: evaluateCropForContext(sd.crop, ctx),
  }));

  // 1. Climate & Water Fit (Weight 28%)
  let climateWaterPts = 0;
  for (const { sd, eval: ev } of seasonEvaluations) {
    let s = 33.3;
    if (!ev.regimeMatch) s -= ctx.hasIrrigation ? 6 : 16;
    if (ev.waterConflict) s -= 20;
    else if (ev.scoreLabel === 'Moderate Fit') s -= 6;
    // Drought pressure bonus/penalty from NASA POWER
    const dryTrend = (ctx.rainDeltaMm ?? 0) < -30 || ctx.recurringDryYearsCount >= 4 || (ctx.gwetRootRecent !== null && ctx.gwetRootRecent < 0.35);
    if (dryTrend && !ctx.hasIrrigation) {
      if (sd.crop.droughtToleranceScore >= 7) s += 4;
      else if (sd.crop.droughtToleranceScore <= 4) s -= 10;
    }
    climateWaterPts += Math.max(0, Math.min(34, s));
  }
  const climateAndWaterScore = Math.round(Math.min(100, climateWaterPts));

  // 2. Soil & Moisture Fit (Weight 22%)
  let soilPts = 0;
  for (const { sd, eval: ev } of seasonEvaluations) {
    let s = 33.3;
    if (!ev.phMatch) s -= 7;
    if (ev.poorDrainageConflict) s -= 18;
    if (ctx.soilTexture !== 'Unknown' && !sd.crop.preferredTextures.includes(ctx.soilTexture)) s -= 6;
    if (ctx.soilTexture === 'Sandy' && ctx.waterHoldingCharacteristic === 'Low' && sd.crop.waterNeed === 'High') {
      s -= 10;
    }
    soilPts += Math.max(0, Math.min(34, s));
  }
  const soilAndMoistureScore = Math.round(Math.min(100, soilPts));

  // 3. Botanical Diversity & Pathology Break (Weight 20%)
  const distinctFamilies = Array.from(new Set(crops.map((c) => c.botanicalFamily)));
  let diversityScore = distinctFamilies.length === 3 ? 88 : distinctFamilies.length === 2 ? 62 : 28;
  // Bonus if Season 1 breaks the field's recorded previous season family
  if (prevFamily && prevFamily !== c1.botanicalFamily) diversityScore += 12;
  if (prevFamily && prevFamily === c1.botanicalFamily) diversityScore -= 24;
  if (twoAgoFamily && twoAgoFamily === c1.botanicalFamily && prevFamily === c1.botanicalFamily) {
    diversityScore -= 15;
  }
  // Consecutive same family inside the 3-season sequence
  if (c1.botanicalFamily === c2.botanicalFamily) diversityScore -= 18;
  if (c2.botanicalFamily === c3.botanicalFamily) diversityScore -= 18;
  // Shared Sclerotinia host adjacency (e.g. Soybean/DryBean + Sunflower/Canola adjacent)
  const sclerotiniaHosts = new Set(['soybeans', 'dry_beans', 'sunflower', 'canola']);
  if (sclerotiniaHosts.has(c1.id) && sclerotiniaHosts.has(c2.id)) diversityScore -= 8;
  if (sclerotiniaHosts.has(c2.id) && sclerotiniaHosts.has(c3.id)) diversityScore -= 8;
  diversityScore = Math.max(10, Math.min(100, Math.round(diversityScore)));

  // 4. Soil Health, Nitrogen Fixation & Ground Cover Residue (Weight 15%)
  const legumeCount = crops.filter((c) => c.nitrogenRole === 'Nitrogen-fixing legume').length;
  const highResidueCount = crops.filter((c) => c.residueContribution === 'High').length;
  const modResidueCount = crops.filter((c) => c.residueContribution === 'Moderate').length;
  let soilResilienceScore = 40;
  if (legumeCount >= 1) soilResilienceScore += 28;
  if (legumeCount >= 2 && distinctFamilies.length >= 2) soilResilienceScore += 6;
  soilResilienceScore += highResidueCount * 14 + modResidueCount * 7;
  if (ctx.organicMatterLevel === 'Low' && highResidueCount === 0 && modResidueCount === 0) {
    soilResilienceScore -= 18;
  }
  soilResilienceScore = Math.max(15, Math.min(100, Math.round(soilResilienceScore)));

  // 5. Farmer Priority Alignment (Weight 15%)
  let priorityPts = 0;
  const avgDrought = (c1.droughtToleranceScore + c2.droughtToleranceScore + c3.droughtToleranceScore) / 3;
  const distinctMarkets = new Set(crops.map((c) => c.marketSpreadCategory)).size;
  for (const prio of ctx.priorities) {
    if (prio === 'improve_soil_health') {
      priorityPts += (legumeCount >= 1 ? 55 : 15) + (highResidueCount + modResidueCount >= 2 ? 45 : 20);
    } else if (prio === 'conserve_water') {
      priorityPts += Math.min(100, Math.round((avgDrought / 9) * 100));
    } else if (prio === 'adapt_to_climate') {
      priorityPts += Math.min(100, Math.round(climateAndWaterScore * 0.65 + (avgDrought / 9) * 35));
    } else if (prio === 'diversify_crops') {
      priorityPts += distinctFamilies.length === 3 ? 100 : distinctFamilies.length === 2 ? 62 : 25;
    } else if (prio === 'long_term_resilience') {
      priorityPts += Math.round((soilResilienceScore + diversityScore) / 2);
    } else if (prio === 'spread_market_risk') {
      priorityPts += distinctMarkets >= 3 ? 98 : distinctMarkets === 2 ? 72 : 35;
    }
  }
  const priorityAlignmentScore = Math.round(
    Math.max(15, Math.min(100, priorityPts / Math.max(1, ctx.priorities.length)))
  );

  const components: ScoreComponentItem[] = [
    {
      key: 'climate_water',
      label: 'Climate & Water Alignment',
      weightPercent: 28,
      rawScore: climateAndWaterScore,
      weightedPoints: Number((climateAndWaterScore * 0.28).toFixed(1)),
      rationale: `${ctx.province} ${ctx.rainfallRegime}, NASA recent rainfall (${ctx.recentAnnualMm ?? '—'} mm/yr), Tmax (${ctx.avgMaxTempC ?? '—'}°C), and "${ctx.waterAvailability}".`,
    },
    {
      key: 'soil_moisture',
      label: 'Soil & Moisture Compatibility',
      weightPercent: 22,
      rawScore: soilAndMoistureScore,
      weightedPoints: Number((soilAndMoistureScore * 0.22).toFixed(1)),
      rationale: `Texture ${ctx.soilTexture}, drainage ${ctx.soilDrainage}, pH ${ctx.soilPh ?? 'untested'}, NASA GWETROOT ${ctx.gwetRootRecent ?? '—'}.`,
    },
    {
      key: 'diversity_pathology',
      label: 'Botanical Diversity & Disease-Break',
      weightPercent: 20,
      rawScore: diversityScore,
      weightedPoints: Number((diversityScore * 0.2).toFixed(1)),
      rationale: `${distinctFamilies.length} botanical families (${distinctFamilies.join(' → ')})${
        prevFamily ? `; follows field history family ${prevFamily}` : ''
      }.`,
    },
    {
      key: 'soil_health_residue',
      label: 'Nitrogen Fixation & Residue Cover',
      weightPercent: 15,
      rawScore: soilResilienceScore,
      weightedPoints: Number((soilResilienceScore * 0.15).toFixed(1)),
      rationale: `${legumeCount} legume cycle(s), ${highResidueCount} high-residue + ${modResidueCount} moderate-residue crop(s).`,
    },
    {
      key: 'priorities',
      label: 'Farmer Priority Alignment',
      weightPercent: 15,
      rawScore: priorityAlignmentScore,
      weightedPoints: Number((priorityAlignmentScore * 0.15).toFixed(1)),
      rationale: `Weighted against selected priorities: ${ctx.priorities
        .map((p) => FARMER_PRIORITY_OPTIONS.find((o) => o.code === p)?.label || p)
        .join(', ')}.`,
    },
  ];

  const decisionSupportScore = Math.round(
    components.reduce((s, c) => s + c.weightedPoints, 0)
  );

  // Build warnings & trade-offs honestly
  const warnings: string[] = [];
  const tradeOffs: string[] = [];

  if (prevFamily && prevFamily === c1.botanicalFamily) {
    warnings.push(
      `Season 1 repeats botanical family ${c1.botanicalFamily} immediately after recorded previous crop (${ctx.previousSeasonCrop}), raising pest and root-disease carryover risk.`
    );
  }
  if (c1.botanicalFamily === c2.botanicalFamily || c2.botanicalFamily === c3.botanicalFamily) {
    warnings.push(
      `Adjacent seasons in this sequence repeat the same botanical family — consider swapping one crop to achieve 3 distinct families.`
    );
  }
  if (legumeCount === 0) {
    warnings.push(
      'No nitrogen-fixing legume (Fabaceae) is included; soil biological N recovery is low and external nitrogen fertiliser demand will stay high.'
    );
  }
  if (sclerotiniaHosts.has(c1.id) && sclerotiniaHosts.has(c2.id)) {
    warnings.push(
      `${c1.name} followed directly by ${c2.name} puts two Sclerotinia-susceptible broadleaf crops back-to-back in wet conditions.`
    );
  }
  if (sclerotiniaHosts.has(c2.id) && sclerotiniaHosts.has(c3.id)) {
    warnings.push(
      `${c2.name} followed directly by ${c3.name} puts two Sclerotinia-susceptible broadleaf crops back-to-back.`
    );
  }
  if (seasonEvaluations.some((e) => e.eval.waterConflict)) {
    warnings.push(
      `One or more crops require high irrigation water which conflicts with "${ctx.waterAvailability}".`
    );
  }
  if (seasonEvaluations.some((e) => e.eval.poorDrainageConflict)) {
    warnings.push(
      'Field reports Poor drainage; drainage-sensitive legumes/brassicas face root-rot risk without raised beds or contour drains.'
    );
  }
  if (!ctx.nasaAvailable) {
    warnings.push(
      'NASA POWER climate telemetry is currently unavailable; climate fit relies on regional province defaults until live data reconnects.'
    );
  }
  if (ctx.dataConfidence === 'Lower Confidence') {
    warnings.push(
      'Lower-confidence evaluation: key local soil lab parameters (pH, P, K) or field crop history are still missing.'
    );
  }

  // Trade-offs
  const lowResidueCount = crops.filter((c) => c.residueContribution === 'Low').length;
  if (lowResidueCount >= 2) {
    tradeOffs.push(
      'Low post-harvest stubble residue across multiple seasons reduces natural soil evaporation shielding and leaves topsoil more exposed.'
    );
  }
  if (legumeCount >= 1 && crops.some((c) => c.droughtToleranceScore >= 8)) {
    tradeOffs.push(
      'Drought-hardy rotations protect yield stability under erratic rainfall but can offer narrower commercial off-take contracts than high-input maize/vegetables.'
    );
  }
  if (crops.some((c) => c.preferredSeason === 'Cool / Transition') && ctx.regimeKey === 'summer' && !ctx.hasIrrigation) {
    tradeOffs.push(
      'Including a Cool / Transition crop in a dryland summer-rainfall zone depends heavily on leftover autumn soil moisture or protective cover termination rather than full grain harvest.'
    );
  }
  if (tradeOffs.length === 0) {
    tradeOffs.push(
      'Multi-family diversity strengthens soil biology and breaks disease cycles, though it requires managing different planting dates, inoculants, and buyer channels across seasons.'
    );
  }

  const residueCoverRating: SequenceEvaluationResult['indicators']['residueCoverRating'] =
    highResidueCount >= 2 || (highResidueCount === 1 && modResidueCount >= 1)
      ? 'High Cover'
      : highResidueCount + modResidueCount >= 2
        ? 'Moderate Cover'
        : 'Low Cover';

  const waterResilienceRating: SequenceEvaluationResult['indicators']['waterResilienceRating'] =
    avgDrought >= 7 && !seasonEvaluations.some((e) => e.eval.waterConflict)
      ? 'High'
      : avgDrought >= 4.8 && !seasonEvaluations.some((e) => e.eval.waterConflict)
        ? 'Moderate'
        : 'Low';

  const climateResilienceRating: SequenceEvaluationResult['indicators']['climateResilienceRating'] =
    climateAndWaterScore >= 75 && distinctFamilies.length >= 2
      ? 'High'
      : climateAndWaterScore >= 52
        ? 'Moderate'
        : 'Low';

  const soilMoistureSuitability: SequenceEvaluationResult['indicators']['soilMoistureSuitability'] =
    soilAndMoistureScore >= 75
      ? 'Well Aligned'
      : soilAndMoistureScore >= 52
        ? 'Conditional'
        : 'Mismatch / Stress Risk';

  const seasons = seasonEvaluations.map(({ sd, eval: ev }) => {
    const familyBroken = Boolean(sd.priorFamily && sd.priorFamily !== sd.crop.botanicalFamily);
    const sameAsPrev = Boolean(sd.priorFamily && sd.priorFamily === sd.crop.botanicalFamily);
    const suitabilityLevel: 'Strong Fit' | 'Conditional Fit' | 'Caution' =
      ev.scoreLabel === 'High Fit' && !sameAsPrev
        ? 'Strong Fit'
        : ev.scoreLabel === 'Marginal Fit' || sameAsPrev
          ? 'Caution'
          : 'Conditional Fit';

    const rotationNote = sd.priorFamily
      ? familyBroken
        ? `Rotates botanical family from ${sd.priorFamily} to ${sd.crop.botanicalFamily} (${sd.crop.nitrogenRole}) to break pest and pathogen carryover.`
        : `Caution: repeats ${sd.crop.botanicalFamily} immediately after ${sd.priorFamily}; increases soil-borne disease carryover risk.`
      : `Establishes rotation with ${sd.crop.familyGroupLabel} (${sd.crop.nitrogenRole}).`;

    return {
      seasonNumber: sd.num,
      seasonLabel: sd.label,
      plantingWindow: sd.window,
      cropId: sd.crop.id,
      cropName: sd.crop.name,
      category: sd.crop.category,
      botanicalFamily: sd.crop.botanicalFamily,
      nitrogenRole: sd.crop.nitrogenRole,
      waterNeed: sd.crop.waterNeed,
      residueContribution: sd.crop.residueContribution,
      suitabilityLevel,
      suitabilityReasons: [rotationNote, ...ev.reasons],
      benefits: sd.crop.benefits,
      risks: sd.crop.risks,
      plantingChecklist: sd.crop.plantingChecklist,
    };
  });

  const priorityLabels = ctx.priorities.map(
    (p) => FARMER_PRIORITY_OPTIONS.find((o) => o.code === p)?.label || p
  );

  return {
    sequenceId,
    strategyName,
    seasons,
    decisionSupportScore,
    scoreBreakdown: {
      formula:
        'Score = 0.28×ClimateWater + 0.22×SoilMoisture + 0.20×DiversityBreak + 0.15×NitrogenResidue + 0.15×PriorityFit',
      statusLabel:
        'Decision-Support Estimate Only — NOT a laboratory soil measurement or guaranteed yield/financial prediction.',
      components,
    },
    indicators: {
      botanicalDiversityCount: distinctFamilies.length,
      distinctFamilies,
      legumeIncluded: legumeCount > 0,
      estimatedNitrogenSupport:
        legumeCount > 0 ? 'High (Biological N Fixation)' : 'Low (External N Needed)',
      residueCoverRating,
      waterResilienceRating,
      climateResilienceRating,
      soilMoistureSuitability,
    },
    sourceTags: [
      {
        indicator: 'Historical Rainfall & Tmax Trends',
        sourceCategory: 'NASA Observation',
        detail: ctx.nasaAvailable
          ? `NASA POWER 2001–2024 monthly grid (${ctx.recentAnnualMm ?? '—'} mm/yr recent vs ${ctx.baselineAnnualMm ?? '—'} mm/yr baseline; Tmax ${ctx.avgMaxTempC ?? '—'}°C)`
          : 'NASA POWER monthly archive unavailable — regional fallback',
      },
      {
        indicator: 'Root-Zone & Surface Soil Wetness (GWETROOT / GWETTOP)',
        sourceCategory: 'NASA Model Wetness (GWETROOT/GWETTOP)',
        detail:
          ctx.gwetRootRecent !== null
            ? `Model-derived MERRA-2 soil wetness fraction: GWETROOT ${ctx.gwetRootRecent}, GWETTOP ${ctx.gwetTopRecent ?? '—'} (NOT a physical probe)`
            : 'Model soil wetness unavailable',
      },
      {
        indicator: 'Soil Texture, Drainage & pH',
        sourceCategory: ctx.hasLabReport
          ? 'Laboratory Soil Report'
          : 'Farmer-Provided Soil / Field',
        detail: ctx.soilDataSource,
      },
      {
        indicator: '3-Season Score, Nitrogen Support & Resilience Ratings',
        sourceCategory: 'Simulated Outcome',
        detail:
          'Rule-based multi-season agronomic simulation combining crop family, water, and priority weights — not measured yield.',
      },
    ],
    whyRecommended: `Recommended for ${ctx.siteLabel} because it achieves ${distinctFamilies.length} distinct botanical families (${distinctFamilies.join(' → ')}), aligns with "${priorityLabels.join(', ')}", and matches ${ctx.waterAvailability} under ${ctx.province} seasonal conditions.`,
    influencingInputs: {
      nasaObservations: [
        ctx.nasaAvailable
          ? `NASA POWER recent mean annual rainfall: ${ctx.recentAnnualMm ?? '—'} mm/yr (vs ${ctx.baselineAnnualMm ?? '—'} mm/yr baseline; ${ctx.recurringDryYearsCount} dry year(s) in 2001–2024)`
          : 'NASA POWER historical rainfall unavailable (using province baseline)',
        `NASA 60d recent rainfall: ${ctx.past60DaysNasaMm ?? '—'} mm · Mean T2M / Tmax: ${ctx.avgMeanTempC ?? '—'}°C / ${ctx.avgMaxTempC ?? '—'}°C · Solar: ${ctx.avgSolar ?? '—'} MJ/m²/d · EVLAND: ${ctx.avgEvlandMmDay ?? '—'} mm/d`,
        `Model soil wetness: GWETROOT ${ctx.gwetRootRecent ?? '—'}, GWETTOP ${ctx.gwetTopRecent ?? '—'}, GWETPROF ${ctx.gwetProfRecent ?? '—'} · Derived VPD: ${ctx.avgVpdKpa ?? '—'} kPa`,
      ],
      soilAndFieldInputs: [
        `Texture: ${ctx.soilTexture} · Drainage: ${ctx.soilDrainage} · Organic Matter: ${ctx.organicMatterLevel}`,
        `Water-holding: ${ctx.waterHoldingCharacteristic} · Soil pH: ${ctx.soilPh ?? 'Untested (assumed 6.1)'}`,
        `Water access: ${ctx.waterAvailability}`,
      ],
      cropAndHistoryFactors: [
        ctx.previousSeasonCrop
          ? `Follows field history: 1 season ago "${ctx.previousSeasonCrop}"${
              ctx.twoSeasonsAgoCrop ? `, 2 seasons ago "${ctx.twoSeasonsAgoCrop}"` : ''
            }`
          : 'No prior field crop history entered — Season 1 disease-break checks assume clean start',
        `Sequence includes ${legumeCount} nitrogen-fixing legume(s) and ${highResidueCount} high-residue cover crop(s)`,
      ],
      farmerPriorityFactors: priorityLabels,
    },
    soilHealthConsiderations: [
      `Botanical diversity across 3 seasons: ${distinctFamilies.length} families (${distinctFamilies.join(' → ')}).`,
      legumeCount > 0
        ? `Includes nitrogen-fixing legume (${crops
            .filter((c) => c.nitrogenRole === 'Nitrogen-fixing legume')
            .map((c) => c.name)
            .join(', ')}) to support biological nitrogen recovery when inoculated properly.`
        : 'No legume included — budget external nitrogen inputs or swap one season for Soybeans, Dry Beans, Lupin, or Cowpeas.',
      `Residue & ground cover rating: ${residueCoverRating} (${crops
        .map((c) => `${c.name.split(' ')[0]}: ${c.residueContribution}`)
        .join('; ')}).`,
    ],
    waterConsiderations: [
      `Evaluated against "${ctx.waterAvailability}" and ${ctx.province} ${ctx.rainfallRegime}.`,
      `Water resilience indicator: ${waterResilienceRating} (NASA 60d rainfall ${ctx.past60DaysNasaMm ?? '—'} mm; EVLAND ${ctx.avgEvlandMmDay ?? '—'} mm/day; GWETROOT ${ctx.gwetRootRecent ?? '—'}).`,
    ],
    climateConsiderations: [
      `Multi-year trend context: ${ctx.rainDeltaMm !== null ? `${ctx.rainDeltaMm >= 0 ? '+' : ''}${ctx.rainDeltaMm} mm/yr rainfall shift (2020–2024 vs 2001–2015)` : 'Regional climate baseline'}; mean Tmax ${ctx.avgMaxTempC ?? '—'}°C (T2M ${ctx.avgMeanTempC ?? '—'}°C).`,
      `High heat days (>=32°C) in past 60d: ${ctx.hotDays32c ?? '—'}; frost-risk nights (<=2°C): ${ctx.frostDays2c ?? '—'}; VPD ${ctx.avgVpdKpa ?? '—'} kPa.`,
    ],
    warnings,
    tradeOffs,
    missingInformation: ctx.missingInfoList,
    nextSteps: [
      !ctx.hasLabReport
        ? 'Submit a 0–20 cm composite soil test to an accredited South African laboratory for verified pH(KCl), P, K, and organic carbon.'
        : 'Review soil test P, K, and lime recommendations against Season 1 basal fertiliser rates.',
      !ctx.previousSeasonCrop
        ? 'Record the previous 1–2 seasons crops on this field in Soil & Field Intelligence so disease-break warnings remain accurate.'
        : `Verify weed-control herbicide carryover (residual chemistry) from "${ctx.previousSeasonCrop}" before seeding ${c1.name}.`,
      `Save this strategy or test an alternative swap in the 3-Season Rotation Simulator before purchasing seed or inoculant.`,
    ],
    whenAlternativePreferred:
      waterResilienceRating === 'High'
        ? 'If reliable borehole or pivot irrigation is confirmed alongside soil pH >= 6.0, higher-margin intensive horticultural or commercial soybean-maize rotations may generate stronger cash returns.'
        : 'If seasonal rains fall below average (<80% of baseline) or borehole flow drops, switch Season 1/3 toward the Sorghum – Cowpeas – Sunflower drought-resilient strategy.',
  };
}

function generateCandidateSequences(
  ctx: ScenarioContextResolved,
  selectedCropIds: string[]
): { id: string; name: string; cropIds: [string, string, string] }[] {
  const byId = (id: string) => SOUTH_AFRICA_ROTATION_CATALOG.find((c) => c.id === id);

  const candidates: { id: string; name: string; cropIds: [string, string, string] }[] = [];

  if (ctx.regimeKey === 'winter') {
    candidates.push(
      {
        id: 'strat-wc-core',
        name: 'Winter Cereal – Canola – Lupin Proven Break Rotation',
        cropIds: ['wheat', 'canola', 'lupin'],
      },
      {
        id: 'strat-wc-soil',
        name: 'Lupin – Wheat – Oats Cover Soil Resilience Rotation',
        cropIds: ['lupin', 'wheat', 'winter_wheat_oats'],
      },
      {
        id: 'strat-wc-div',
        name: 'Canola – Wheat – Dry Beans / Irrigated Diversity Rotation',
        cropIds: ['canola', 'wheat', ctx.hasIrrigation ? 'dry_beans' : 'lupin'],
      },
      {
        id: 'strat-wc-veg',
        name: 'Irrigated Cool-Season Vegetable & Legume Diversification',
        cropIds: ['cabbage_brassica', 'dry_beans', 'spinach_swiss_chard'],
      }
    );
  } else if (ctx.regimeKey === 'semi_arid' || (ctx.rainDeltaMm !== null && ctx.rainDeltaMm < -45 && !ctx.hasIrrigation)) {
    candidates.push(
      {
        id: 'strat-arid-core',
        name: 'Drought-Resilient Sorghum – Cowpeas – Sunflower Strategy',
        cropIds: ['sorghum', 'cowpeas', 'sunflower'],
      },
      {
        id: 'strat-arid-soil',
        name: 'Soil-Cover Cowpeas – Sorghum – Winter Oats Moisture Shield',
        cropIds: ['cowpeas', 'sorghum', 'winter_wheat_oats'],
      },
      {
        id: 'strat-arid-balanced',
        name: 'Moisture-Buffered Sweet Potato – Cowpeas – Sorghum Ground-Cover Strategy',
        cropIds: ['sweet_potato', 'cowpeas', 'sorghum'],
      },
      {
        id: 'strat-summer-classic',
        name: 'Maize – Dry Beans – Sunflower Classic Rotation',
        cropIds: ['maize', 'dry_beans', 'sunflower'],
      }
    );
  } else {
    candidates.push(
      {
        id: 'strat-sum-legume-oilseed',
        name: 'Maize – Soybeans / Dry Beans – Sunflower Soil & Market Rotation',
        cropIds: ['maize', ctx.soilPh !== null && ctx.soilPh < 5.7 ? 'cowpeas' : 'soybeans', 'sunflower'],
      },
      {
        id: 'strat-sum-water-resilient',
        name: 'Water-Resilient Sorghum – Cowpeas – Sunflower Climate Buffer',
        cropIds: ['sorghum', 'cowpeas', 'sunflower'],
      },
      {
        id: 'strat-sum-soil-health',
        name: 'Soil-Restoration Dry Beans – Maize – Winter Oats Cover Sequence',
        cropIds: ['dry_beans', 'maize', 'winter_wheat_oats'],
      },
      {
        id: 'strat-sum-root-cover',
        name: 'Root-Canopy Sweet Potato – Cowpeas – Sorghum Moisture Shield',
        cropIds: ['sweet_potato', 'cowpeas', 'sorghum'],
      },
      {
        id: 'strat-sum-irrigated-veg',
        name: 'Irrigated Diversified Horticulture & Legume Cycle',
        cropIds: ['cabbage_brassica', 'dry_beans', 'spinach_swiss_chard'],
      }
    );
  }

  // Also ensure a candidate built cleanly from user-checked comparison crops if >=3 valid distinct crops selected
  const validSelected = selectedCropIds.filter((id) => Boolean(byId(id)));
  if (validSelected.length >= 3) {
    const customTriplet: [string, string, string] = [
      validSelected[0],
      validSelected[1],
      validSelected[2],
    ];
    const sig = customTriplet.join('|');
    if (!candidates.some((c) => c.cropIds.join('|') === sig)) {
      candidates.push({
        id: 'strat-user-selected',
        name: 'Farmer-Selected 3-Crop Diversified Rotation',
        cropIds: customTriplet,
      });
    }
  }

  return candidates;
}

export async function analyzeCropRotationScenario(input: {
  farmId?: string | null;
  fieldId?: string | null;
  province?: string;
  waterAvailability?: string;
  soilType?: string;
  soilTexture?: string;
  organicMatterLevel?: string;
  soilDrainage?: string;
  waterHoldingCharacteristic?: string;
  soilPh?: number;
  farmSizeHectares?: number;
  previousSeasonCrop?: string;
  twoSeasonsAgoCrop?: string;
  farmerPriority?: string;
  farmerPriorities?: string[];
  selectedCrops?: string[];
}) {
  const ctx = await resolveScenarioContext(input);

  const requestedIds = Array.from(
    new Set((input.selectedCrops || []).filter((id) => typeof id === 'string' && id.trim()))
  ).slice(0, 6);

  const selectedCatalogItems =
    requestedIds.length > 0
      ? requestedIds
          .map((id) => SOUTH_AFRICA_ROTATION_CATALOG.find((c) => c.id === id))
          .filter((c): c is CropRotationCatalogItem => Boolean(c))
      : ctx.regimeKey === 'winter'
        ? ['wheat', 'canola', 'lupin', 'dry_beans', 'spinach_swiss_chard']
            .map((id) => SOUTH_AFRICA_ROTATION_CATALOG.find((c) => c.id === id)!)
            .filter(Boolean)
        : ['maize', 'soybeans', 'dry_beans', 'sorghum', 'sunflower', 'cowpeas']
            .map((id) => SOUTH_AFRICA_ROTATION_CATALOG.find((c) => c.id === id)!)
            .filter(Boolean);

  const evaluated = selectedCatalogItems.map((c) => evaluateCropForContext(c, ctx));

  const candidateSpecs = generateCandidateSequences(ctx, requestedIds);
  const evaluatedStrategies = candidateSpecs
    .map((spec) => {
      const c1 = SOUTH_AFRICA_ROTATION_CATALOG.find((c) => c.id === spec.cropIds[0])!;
      const c2 = SOUTH_AFRICA_ROTATION_CATALOG.find((c) => c.id === spec.cropIds[1])!;
      const c3 = SOUTH_AFRICA_ROTATION_CATALOG.find((c) => c.id === spec.cropIds[2])!;
      return evaluateThreeCropSequence({
        sequenceId: spec.id,
        strategyName: spec.name,
        crops: [c1, c2, c3],
        ctx,
      });
    })
    .sort((a, b) => b.decisionSupportScore - a.decisionSupportScore);

  const topStrategies = evaluatedStrategies.slice(0, 3);
  const primaryStrategy = topStrategies[0];

  const soilHealthImplications = primaryStrategy
    ? primaryStrategy.soilHealthConsiderations
    : ['Evaluate botanical family diversity and nitrogen-fixing legumes before planting.'];

  const climateAndMoistureAlignment = ctx.nasaAvailable
    ? `NASA POWER 2020–2024 vs 2001–2015 analysis at ${ctx.latitude.toFixed(2)}°, ${ctx.longitude.toFixed(2)}° shows ${ctx.recentAnnualMm ?? '—'} mm/yr recent mean rainfall (baseline ${ctx.baselineAnnualMm ?? '—'} mm/yr), ${ctx.avgMaxTempC ?? '—'}°C mean Tmax, 60-day rainfall ${ctx.past60DaysNasaMm ?? '—'} mm, and model root-zone wetness GWETROOT ${ctx.gwetRootRecent ?? '—'}. ${
        (ctx.rainDeltaMm ?? 0) < -30 && !ctx.hasIrrigation
          ? 'Lower recent rainfall and limited irrigation favour sorghum, cowpeas, or sunflower with residue retention.'
          : ctx.hasIrrigation
            ? 'Confirmed water access buffers rainfall variability, provided irrigation flow and salinity are verified.'
            : 'Match dryland planting strictly to verified topsoil wetting rather than fixed calendar dates.'
      }`
    : `NASA POWER multi-year grid data could not be retrieved right now (${ctx.nasaUnavailableReason || 'service offline'}). Alignment uses provincial climate regime (${ctx.rainfallRegime}) and stated water access (${ctx.waterAvailability}) with reduced confidence.`;

  return {
    generatedAt: new Date().toISOString(),
    dataConfidence: ctx.dataConfidence,
    siteContext: {
      label: ctx.siteLabel,
      farmId: ctx.farmId,
      fieldId: ctx.fieldId,
      fieldName: ctx.fieldName,
      province: ctx.province,
      rainfallRegime: ctx.rainfallRegime,
      farmSizeHectares: ctx.farmSizeHectares,
      waterAvailability: ctx.waterAvailability,
      soilType: ctx.soilTexture,
      soilTexture: ctx.soilTexture,
      organicMatterLevel: ctx.organicMatterLevel,
      soilDrainage: ctx.soilDrainage,
      waterHoldingCharacteristic: ctx.waterHoldingCharacteristic,
      soilPh: ctx.soilPh ?? ctx.effectivePhForRules,
      soilPhMeasured: ctx.soilPh,
      previousSeasonCrop: ctx.previousSeasonCrop,
      twoSeasonsAgoCrop: ctx.twoSeasonsAgoCrop,
      soilDataSource: ctx.soilDataSource,
      farmerPriority: ctx.priorities.join(', '),
      farmerPriorities: ctx.priorities,
    },
    climateSource: {
      provider: ctx.nasaAvailable
        ? 'NASA POWER Monthly & Daily Agroclimatology API (power.larc.nasa.gov)'
        : 'NASA POWER Unavailable (Provincial Baseline Fallback)',
      available: ctx.nasaAvailable,
      note: ctx.nasaAvailable
        ? `Live NASA POWER satellite/reanalysis feed at ${ctx.latitude.toFixed(3)}°, ${ctx.longitude.toFixed(3)}° (2001–2015 baseline vs 2020–2024 recent + 60-day GWETROOT/GWETTOP).`
        : ctx.nasaUnavailableReason || 'NASA POWER unavailable.',
      recentAnnualRainfallMm: ctx.recentAnnualMm,
      baselineAnnualRainfallMm: ctx.baselineAnnualMm,
      avgMaxTempC: ctx.avgMaxTempC,
      avgSolarIrradiance: ctx.avgSolar,
      past30DaysNasaMm: ctx.past30DaysNasaMm,
      past60DaysNasaMm: ctx.past60DaysNasaMm,
      gwetRootRecent: ctx.gwetRootRecent,
      gwetTopRecent: ctx.gwetTopRecent,
      drySpellDays60d: ctx.drySpellDays60d,
      hotDays32c: ctx.hotDays32c,
      frostDays2c: ctx.frostDays2c,
      recurringDryYearsCount: ctx.recurringDryYearsCount,
    },
    comparedCrops: evaluated.map(({ crop, scoreLabel, reasons }) => ({
      cropId: crop.id,
      cropName: crop.name,
      category: crop.category,
      botanicalFamily: crop.botanicalFamily,
      waterNeed: crop.waterNeed,
      idealPhRange: crop.idealPhRange,
      suitabilityScoreLabel: scoreLabel,
      suitabilityReason: reasons.join(' '),
      keyBenefits: crop.benefits,
      keyRisks: crop.risks,
      plantingChecklist: crop.plantingChecklist,
    })),
    threeSeasonRotation: primaryStrategy ? primaryStrategy.seasons : [],
    topStrategies,
    soilHealthImplications,
    climateAndMoistureAlignment,
    assumptions: [
      `Water access evaluated as reported: "${ctx.waterAvailability}".`,
      `Soil baseline: ${ctx.soilTexture}, drainage ${ctx.soilDrainage}, OM ${ctx.organicMatterLevel}, ${
        ctx.soilPh !== null ? `pH ${ctx.soilPh}` : `pH untested (rule default ${ctx.effectivePhForRules})`
      } (${ctx.soilDataSource}).`,
      `Climate grid metrics cover ~0.5° × 0.625° regional NASA POWER cells (~55 km) and GWETROOT/GWETTOP are model-derived wetness fractions, not field probe readings.`,
      `Evaluated across 3 sequential seasons on ${ctx.farmSizeHectares} ha.`,
    ],
    limitations: [
      'Weighted rotation scores (0–100) are transparent decision-support estimates — NOT laboratory fertility tests, guaranteed yields, or profit predictions.',
      'Cool/transition season feasibility in summer-rainfall provinces depends heavily on stored soil moisture or confirmed irrigation.',
      ...ctx.missingInfoList,
    ],
    disclaimer:
      'Decision-support planning tool only. Field Shift makes NO guarantee of crop yield, survival, rainfall onset, or net financial profit. Confirm soil fertility with an accredited laboratory test before committing capital.',
  };
}

export async function simulateRotationSequence(input: {
  farmId?: string | null;
  fieldId?: string | null;
  province?: string;
  waterAvailability?: string;
  soilType?: string;
  soilTexture?: string;
  organicMatterLevel?: string;
  soilDrainage?: string;
  waterHoldingCharacteristic?: string;
  soilPh?: number;
  farmSizeHectares?: number;
  previousSeasonCrop?: string;
  twoSeasonsAgoCrop?: string;
  farmerPriorities?: string[];
  season1CropId: string;
  season2CropId: string;
  season3CropId: string;
  strategyName?: string;
}) {
  const ctx = await resolveScenarioContext(input);
  const c1 = SOUTH_AFRICA_ROTATION_CATALOG.find((c) => c.id === input.season1CropId);
  const c2 = SOUTH_AFRICA_ROTATION_CATALOG.find((c) => c.id === input.season2CropId);
  const c3 = SOUTH_AFRICA_ROTATION_CATALOG.find((c) => c.id === input.season3CropId);

  if (!c1 || !c2 || !c3) {
    throw new Error('All three seasons must reference valid South African rotation catalog crops.');
  }

  const simulation = evaluateThreeCropSequence({
    sequenceId: `sim-${c1.id}-${c2.id}-${c3.id}`,
    strategyName:
      input.strategyName?.trim() || `${c1.name.split(' ')[0]} → ${c2.name.split(' ')[0]} → ${c3.name.split(' ')[0]}`,
    crops: [c1, c2, c3],
    ctx,
  });

  return {
    generatedAt: new Date().toISOString(),
    dataConfidence: ctx.dataConfidence,
    siteContext: {
      label: ctx.siteLabel,
      province: ctx.province,
      waterAvailability: ctx.waterAvailability,
      soilTexture: ctx.soilTexture,
      soilDrainage: ctx.soilDrainage,
      soilPhMeasured: ctx.soilPh,
      previousSeasonCrop: ctx.previousSeasonCrop,
      farmerPriorities: ctx.priorities,
    },
    simulation,
    disclaimer:
      'Simulated 3-season decision-support output only — NOT a laboratory measurement or guaranteed yield prediction. Saved plans remain proposed plans and never auto-create planted crop activities.',
  };
}
