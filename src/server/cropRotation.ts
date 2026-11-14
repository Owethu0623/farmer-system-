import { SOUTH_AFRICA_PROVINCES } from './southAfricaData.ts';
import { store } from './store.ts';
import { fetchNasaPowerClimateComparison } from './weather.ts';

export interface CropRotationCatalogItem {
  id: string;
  name: string;
  botanicalFamily: string;
  familyGroupLabel: string;
  preferredSeason: 'Main Summer' | 'Cool / Transition' | 'Year-round';
  waterNeed: 'Low' | 'Moderate' | 'High';
  idealPhRange: [number, number];
  typicalCycleDays: string;
  nitrogenRole:
    | 'Nitrogen-fixing legume'
    | 'Heavy nitrogen feeder'
    | 'Moderate feeder'
    | 'Deep-rooting scavenger';
  summary: string;
  suitableRegimes: ('summer' | 'winter' | 'all_year' | 'semi_arid')[];
  benefits: string[];
  risks: string[];
  plantingChecklist: string[];
}

export const SOUTH_AFRICA_ROTATION_CATALOG: CropRotationCatalogItem[] = [
  {
    id: 'maize',
    name: 'Maize (Dryland / Irrigated)',
    botanicalFamily: 'Poaceae',
    familyGroupLabel: 'Grass / Cereal Grain (Poaceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'Moderate',
    idealPhRange: [5.5, 7.0],
    typicalCycleDays: '120–150 days',
    nitrogenRole: 'Heavy nitrogen feeder',
    summary: 'Staple South African summer grain crop requiring timely nitrogen top-dressing and clean weed control during the first 6 weeks.',
    suitableRegimes: ['summer', 'all_year'],
    benefits: [
      'Strong residue cover (stover) helps protect topsoil from wind and storm erosion.',
      'Broad domestic grain and silage market channels across South Africa.',
    ],
    risks: [
      'High moisture sensitivity at tasselling/silking (mid-summer dry spells sharply lower grain fill).',
      'Continuous maize monocropping builds stalk borer, fall armyworm, and grey leaf spot pressure.',
    ],
    plantingChecklist: [
      'Verify composite topsoil pH (water 5.5–7.0) and apply agricultural lime 6+ weeks pre-plant if acidic.',
      'Match cultivar maturity (short vs medium season) and target plants/ha to confirmed summer rainfall or irrigation.',
      'Band basal phosphorus at planting and split nitrogen top-dressing at V4–V6 leaf stage.',
    ],
  },
  {
    id: 'dry_beans',
    name: 'Dry Beans / Speckled Sugar Beans',
    botanicalFamily: 'Fabaceae',
    familyGroupLabel: 'Legume (Fabaceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'Moderate',
    idealPhRange: [5.8, 7.0],
    typicalCycleDays: '90–115 days',
    nitrogenRole: 'Nitrogen-fixing legume',
    summary: 'High-value summer rotational legume that fixes atmospheric nitrogen and breaks cereal pest and disease cycles.',
    suitableRegimes: ['summer', 'all_year'],
    benefits: [
      'Symbiotic Rhizobium nodulation improves residual soil nitrogen for the following grain or leafy crop.',
      'Breaks grass-family weed and cereal root disease cycles after maize or sorghum.',
    ],
    risks: [
      'Vulnerable to waterlogging and bacterial blight in humid, poorly drained heavy clays.',
      'Requires neutral-to-mildly acidic soil (pH < 5.5 sharply suppresses nodulation).',
    ],
    plantingChecklist: [
      'Inoculate seed with the correct Phaseolus Rhizobium inoculant immediately before planting.',
      'Avoid planting after another Fabaceae crop (soybean/cowpea/lucerne) to prevent Sclerotinia and root rot buildup.',
      'Ensure well-drained seedbed without surface crusting so seedlings emerge cleanly.',
    ],
  },
  {
    id: 'soybeans',
    name: 'Soybeans',
    botanicalFamily: 'Fabaceae',
    familyGroupLabel: 'Legume (Fabaceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'Moderate',
    idealPhRange: [5.8, 7.0],
    typicalCycleDays: '115–140 days',
    nitrogenRole: 'Nitrogen-fixing legume',
    summary: 'Commercial oilseed legume widely rotated with Highveld and KwaZulu-Natal summer maize.',
    suitableRegimes: ['summer', 'all_year'],
    benefits: [
      'Reduces synthetic nitrogen requirements for a subsequent Poaceae cereal crop.',
      'Provides deep taproot aeration and interrupts maize monoculture pests.',
    ],
    risks: [
      'Pod shatter risk if harvesting is delayed under hot, dry autumn winds.',
      'Susceptible to soybean rust in high-humidity eastern regions without preventative scouting.',
    ],
    plantingChecklist: [
      'Pre-inoculate seed with Bradyrhizobium japonicum and protect from direct sunlight before seeding.',
      'Test soil phosphorus and molybdenum levels prior to planting.',
      'Scout weekly during flowering and pod-fill for bollworm and foliar rust.',
    ],
  },
  {
    id: 'sorghum',
    name: 'Grain Sorghum',
    botanicalFamily: 'Poaceae',
    familyGroupLabel: 'Grass / Cereal Grain (Poaceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'Low',
    idealPhRange: [5.5, 7.5],
    typicalCycleDays: '110–135 days',
    nitrogenRole: 'Heavy nitrogen feeder',
    summary: 'Drought-resilient summer cereal suited to semi-arid zones or warmer summers with erratic mid-season rain.',
    suitableRegimes: ['summer', 'semi_arid', 'all_year'],
    benefits: [
      'Tolerates temporary moisture stress better than dryland maize.',
      'Adapts to slightly heavier or alkaline soils compared to legumes.',
    ],
    risks: [
      'Bird (quelea/dove) grain damage near roosting wetlands unless harvest timing is tightly managed.',
      'Belongs to Poaceae — do not plant immediately after maize without breaking grass-family pests.',
    ],
    plantingChecklist: [
      'Wait for stable 18°C+ topsoil temperature before planting for rapid, even emergence.',
      'Maintain strict aphid scouting from booting to soft-dough stage.',
      'Avoid following maize directly in a strict rotation unless organic matter / cover crop is interposed.',
    ],
  },
  {
    id: 'sunflower',
    name: 'Sunflower',
    botanicalFamily: 'Asteraceae',
    familyGroupLabel: 'Oilseed Broadleaf (Asteraceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'Low',
    idealPhRange: [6.0, 7.5],
    typicalCycleDays: '105–130 days',
    nitrogenRole: 'Deep-rooting scavenger',
    summary: 'Deep-rooted drought-tolerant oilseed broadleaf that scavenges subsoil moisture and nutrients left below cereal root zones.',
    suitableRegimes: ['summer', 'semi_arid', 'all_year'],
    benefits: [
      'Deep taproot accesses moisture and leached nitrogen/potassium up to 1.5 m when soil profile allows.',
      'Different botanical family (Asteraceae) from both maize (Poaceae) and beans (Fabaceae).',
    ],
    risks: [
      'Susceptible to Sclerotinia head/stem rot if rotated too closely (<3 years) with soybeans, dry beans, or canola.',
      'Heavy taproot extraction leaves drier subsoil for the very next dryland crop if winter rain is low.',
    ],
    plantingChecklist: [
      'Allow at least 2–3 seasons between Sclerotinia-host crops (soybean/dry bean/canola/sunflower) on damp sites.',
      'Check soil depth (minimum 75–90 cm) to get full deep-root drought resilience benefit.',
      'Plant at uniform low density matched to moisture expectations.',
    ],
  },
  {
    id: 'cowpeas',
    name: 'Cowpeas (Morogo / Grain)',
    botanicalFamily: 'Fabaceae',
    familyGroupLabel: 'Legume (Fabaceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'Low',
    idealPhRange: [5.5, 7.2],
    typicalCycleDays: '75–105 days',
    nitrogenRole: 'Nitrogen-fixing legume',
    summary: 'Hardy indigenous-adapted summer legume delivering dual-purpose leafy morogo, dried grain, or livestock fodder under low rainfall.',
    suitableRegimes: ['summer', 'semi_arid', 'all_year'],
    benefits: [
      'Drought-hardy legume that builds soil organic nitrogen and shades soil weeds rapidly.',
      'Strong dual-purpose fit for smallholder food security and mixed crop-livestock systems.',
    ],
    risks: [
      'Aphid and pod-borer outbreaks during dry spells require early field scouting.',
      'Sensible spacing needed if intercropped so runners do not smother companion crops.',
    ],
    plantingChecklist: [
      'Plant after summer soil warmth exceeds 18°C in well-drained beds.',
      'Rotate away from other legumes in the immediately preceding or following season.',
      'Time leafy harvest early (4–6 weeks) if cultivating as dual-purpose morogo plus grain.',
    ],
  },
  {
    id: 'cabbage_brassica',
    name: 'Cabbage / Kale (Brassicas)',
    botanicalFamily: 'Brassicaceae',
    familyGroupLabel: 'Leafy Brassica (Brassicaceae)',
    preferredSeason: 'Cool / Transition',
    waterNeed: 'High',
    idealPhRange: [6.0, 6.8],
    typicalCycleDays: '75–105 days',
    nitrogenRole: 'Heavy nitrogen feeder',
    summary: 'Cool-season / irrigated high-demand leafy vegetable crop providing a distinct botanical break from cereals and Solanaceae.',
    suitableRegimes: ['winter', 'all_year', 'summer'],
    benefits: [
      'Brassicaceae roots help break root-knot nematode and fungal cycles when alternated carefully.',
      'Strong turnover in local fresh produce markets when irrigation is consistent.',
    ],
    risks: [
      'High water sensitivity — moisture stress causes split heads and bitter leaves.',
      'Clubroot and diamondback moth intensify rapidly if brassicas repeat in consecutive seasons.',
    ],
    plantingChecklist: [
      'Verify reliable irrigation flow before transplanting seedlings.',
      'Correct topsoil pH above 6.0 if acidic to suppress clubroot risk.',
      'Maintain a strict 2-year gap before planting any other Brassicaceae (cabbage/canola/mustard) on the same plot.',
    ],
  },
  {
    id: 'tomatoes',
    name: 'Tomatoes / Peppers (Solanaceae)',
    botanicalFamily: 'Solanaceae',
    familyGroupLabel: 'Fruiting Vegetable (Solanaceae)',
    preferredSeason: 'Main Summer',
    waterNeed: 'High',
    idealPhRange: [5.8, 6.8],
    typicalCycleDays: '90–120 days',
    nitrogenRole: 'Moderate feeder',
    summary: 'High-value irrigated fruiting crop suited to frost-free or summer growing windows with drip irrigation.',
    suitableRegimes: ['summer', 'all_year'],
    benefits: [
      'High revenue potential per hectare where drip irrigation, trellising, and cold-chain markets exist.',
      'Non-grass botanical family helps disrupt cereal and brassica pest complexes.',
    ],
    risks: [
      'Severe bacterial wilt, early/late blight, and nematode buildup if planted after potatoes, chillies, or eggplants.',
      'Frost injury and fruit cracking under erratic overhead watering or extreme heatwaves.',
    ],
    plantingChecklist: [
      'Confirm plot has not grown Solanaceae (tomatoes, potatoes, peppers) for at least 3 seasons.',
      'Install drip irrigation and plastic or organic mulch to limit soil-splash blights.',
      'Secure off-take buyers before transplanting to prevent post-harvest spoilage losses.',
    ],
  },
  {
    id: 'spinach_swiss_chard',
    name: 'Spinach / Swiss Chard',
    botanicalFamily: 'Amaranthaceae',
    familyGroupLabel: 'Leafy Greens (Amaranthaceae)',
    preferredSeason: 'Cool / Transition',
    waterNeed: 'Moderate',
    idealPhRange: [6.0, 7.2],
    typicalCycleDays: '50–75 days',
    nitrogenRole: 'Moderate feeder',
    summary: 'Fast-cycling leafy green suited to shoulder/cool seasons, providing rapid harvests between main summer cycles.',
    suitableRegimes: ['winter', 'all_year', 'summer'],
    benefits: [
      'Short 50–75 day cycle fills cash-flow and soil-cover gaps between primary summer crops.',
      'Amaranthaceae family avoids sharing most brassica or cereal soil diseases.',
    ],
    risks: [
      'Bolting risk if planted into peak mid-summer heatwaves without shade or cooling irrigation.',
      'Short post-harvest shelf life requires same-day harvest cooling and local buyers.',
    ],
    plantingChecklist: [
      'Confirm frequent light irrigation (every 2–4 days in sandy topsoils).',
      'Harvest outer leaves cleanly to sustain multi-cut yields over 8–12 weeks.',
      'Avoid following beetroot (same Amaranthaceae family) directly.',
    ],
  },
  {
    id: 'winter_wheat_oats',
    name: 'Winter Oats / Cover Cereal (or Wheat)',
    botanicalFamily: 'Poaceae',
    familyGroupLabel: 'Cool-Season Cereal / Cover (Poaceae)',
    preferredSeason: 'Cool / Transition',
    waterNeed: 'Low',
    idealPhRange: [5.5, 7.2],
    typicalCycleDays: '110–145 days',
    nitrogenRole: 'Moderate feeder',
    summary: 'Cool-season grain or winter fodder cover crop ideal in winter-rainfall Cape zones or irrigated/residual-moisture winter blocks.',
    suitableRegimes: ['winter', 'all_year', 'summer'],
    benefits: [
      'Protects bare winter soil from cold wind erosion and traps residual nitrates after summer crops.',
      'Fits Western Cape winter rains or cool irrigated Highveld fodder strips.',
    ],
    risks: [
      'Minimal grain yield in dry summer-rainfall zones without supplementary winter irrigation.',
      'Same family (Poaceae) as maize/sorghum — alternate with Fabaceae or Brassicaceae if disease carryover exists.',
    ],
    plantingChecklist: [
      'In summer-rainfall zones without winter water, establish late-summer oats strictly as mulch/grazing cover while topsoil moisture remains.',
      'In Western Cape winter-rainfall areas, align seeding to first steady autumn rains (April–May).',
      'Pair with field peas/vetch or follow with broadleaf legumes to diversify soil biology.',
    ],
  },
  {
    id: 'canola',
    name: 'Canola / Mustard Break Crop',
    botanicalFamily: 'Brassicaceae',
    familyGroupLabel: 'Cool-Season Oilseed (Brassicaceae)',
    preferredSeason: 'Cool / Transition',
    waterNeed: 'Moderate',
    idealPhRange: [5.8, 7.0],
    typicalCycleDays: '125–155 days',
    nitrogenRole: 'Deep-rooting scavenger',
    summary: 'Cool-season broadleaf break crop widely proven in Western Cape wheat rotations to break take-all cereal root disease.',
    suitableRegimes: ['winter', 'all_year'],
    benefits: [
      'Proven break-crop boosting subsequent winter wheat/barley yields by disrupting cereal root diseases.',
      'Deep root system loosens compacted topsoil layers.',
    ],
    risks: [
      'Unsuitable for frost-heavy dry interior winters without winter rainfall or irrigation.',
      'Diamondback moth and Sclerotinia monitoring needed during flowering.',
    ],
    plantingChecklist: [
      'Confirm winter moisture supply or winter-rainfall zone (e.g. Western Cape Swartland/Overberg).',
      'Include sulfur nutrition alongside nitrogen at vegetative stage.',
      'Maintain a 3-to-4-year gap before planting Brassicaceae on the same field.',
    ],
  },
];

export async function analyzeCropRotationScenario(input: {
  farmId?: string | null;
  province?: string;
  waterAvailability?: string;
  soilType?: string;
  soilPh?: number;
  farmSizeHectares?: number;
  farmerPriority?: string;
  selectedCrops?: string[];
}) {
  const farm = input.farmId ? store.db.farms.find((f) => f.id === input.farmId) : undefined;
  const location = farm ? store.db.farmLocations.find((l) => l.farmId === farm.id) : undefined;
  const labReport = farm
    ? store.db.soilReports
        .filter((r) => r.farmId === farm.id)
        .sort((a, b) => b.sampleDate.localeCompare(a.sampleDate))[0]
    : undefined;

  const provinceName = location?.province || input.province || 'Free State';
  const prov =
    SOUTH_AFRICA_PROVINCES.find((p) => p.name === provinceName) ||
    SOUTH_AFRICA_PROVINCES[0];

  const lat = location?.latitude ?? prov.centerLat;
  const lng = location?.longitude ?? prov.centerLng;
  const waterAvailability =
    input.waterAvailability || farm?.waterAvailability || 'Seasonal Rainfall Only (Dryland)';
  const waterLower = waterAvailability.toLowerCase();
  const hasIrrigation =
    waterLower.includes('irrigat') ||
    waterLower.includes('borehole') ||
    waterLower.includes('dam') ||
    waterLower.includes('river') ||
    waterLower.includes('drip') ||
    waterLower.includes('pivot');
  const isLimitedWater =
    waterLower.includes('rain') ||
    waterLower.includes('dry') ||
    waterLower.includes('seasonal') ||
    waterLower.includes('unverified');

  const soilType = input.soilType || labReport?.soilTextureClass || 'Sandy Loam (Assumed)';
  const soilPh =
    typeof input.soilPh === 'number' && Number.isFinite(input.soilPh)
      ? Number(input.soilPh.toFixed(1))
      : labReport?.soilPhWater ?? 6.1;
  const soilDataSource = input.soilPh
    ? 'User-entered soil assumption'
    : labReport
      ? `Farm lab report (${labReport.laboratoryName}, ${labReport.sampleDate})`
      : 'Default SA regional assumption (no lab test attached)';

  const farmSizeHectares =
    typeof input.farmSizeHectares === 'number' && input.farmSizeHectares > 0
      ? input.farmSizeHectares
      : farm?.farmSizeHectares || 5;

  const farmerPriority =
    input.farmerPriority || 'Balanced soil health, input resilience, and rotational diversity';

  const rainfallLower = prov.rainfallRegime.toLowerCase();
  const isWinterRain = rainfallLower.includes('winter');
  const isSemiArid = rainfallLower.includes('arid') || prov.annualRainfallMm.includes('200');
  const regimeKey: 'summer' | 'winter' | 'all_year' | 'semi_arid' = isWinterRain
    ? 'winter'
    : isSemiArid
      ? 'semi_arid'
      : rainfallLower.includes('all-year')
        ? 'all_year'
        : 'summer';

  const requestedIds = Array.from(
    new Set((input.selectedCrops || []).filter((id) => typeof id === 'string' && id.trim()))
  ).slice(0, 5);

  const selectedCatalogItems =
    requestedIds.length > 0
      ? requestedIds
          .map((id) => SOUTH_AFRICA_ROTATION_CATALOG.find((c) => c.id === id))
          .filter((c): c is CropRotationCatalogItem => Boolean(c))
      : isWinterRain
        ? ['winter_wheat_oats', 'canola', 'dry_beans', 'spinach_swiss_chard', 'cabbage_brassica']
            .map((id) => SOUTH_AFRICA_ROTATION_CATALOG.find((c) => c.id === id)!)
            .filter(Boolean)
        : ['maize', 'dry_beans', 'sunflower', 'cabbage_brassica', 'spinach_swiss_chard']
            .map((id) => SOUTH_AFRICA_ROTATION_CATALOG.find((c) => c.id === id)!)
            .filter(Boolean);

  const siteLabel = farm ? farm.name : `${prov.name} Candidate Site`;

  const nasaClimate = await fetchNasaPowerClimateComparison(lat, lng, {
    province: prov.name,
    locationLabel: siteLabel,
    waterAvailability,
    primaryCrops: selectedCatalogItems.map((c) => c.name),
  });

  const recentAnnualMm = nasaClimate.recentMetrics?.meanAnnualRainfallMm ?? null;
  const baselineAnnualMm = nasaClimate.baselineMetrics?.meanAnnualRainfallMm ?? null;
  const avgMaxTempC = nasaClimate.recentMetrics?.avgMaxTempC ?? null;
  const avgSolar = nasaClimate.recentMetrics?.avgSolarIrradiance ?? null;
  const rainDeficitShift = (nasaClimate.delta?.annualRainfallChangeMm ?? 0) < -30;

  const evaluateCrop = (crop: CropRotationCatalogItem) => {
    const phMatch = soilPh >= crop.idealPhRange[0] && soilPh <= crop.idealPhRange[1];
    const phNear = soilPh >= crop.idealPhRange[0] - 0.5 && soilPh <= crop.idealPhRange[1] + 0.5;
    const regimeMatch =
      crop.suitableRegimes.includes(regimeKey) ||
      (hasIrrigation && crop.suitableRegimes.includes('all_year'));
    const waterConflict = crop.waterNeed === 'High' && !hasIrrigation && isLimitedWater;
    const moistureStretch =
      crop.waterNeed === 'Moderate' &&
      !hasIrrigation &&
      (isSemiArid || (recentAnnualMm !== null && recentAnnualMm < 430));

    let scoreLabel: 'High Fit' | 'Moderate Fit' | 'Marginal Fit' = 'High Fit';
    if (waterConflict || (!phNear && !regimeMatch)) {
      scoreLabel = 'Marginal Fit';
    } else if (!phMatch || !regimeMatch || moistureStretch) {
      scoreLabel = 'Moderate Fit';
    }

    const reasons: string[] = [];
    reasons.push(
      regimeMatch
        ? `Matches ${prov.name} ${prov.rainfallRegime} growing cycle.`
        : `Seasonal mismatch risk under pure ${prov.rainfallRegime} without off-season irrigation.`
    );
    reasons.push(
      phMatch
        ? `Topsoil pH ${soilPh} sits inside target range (${crop.idealPhRange[0]}–${crop.idealPhRange[1]}).`
        : phNear
          ? `Topsoil pH ${soilPh} is near boundary (${crop.idealPhRange[0]}–${crop.idealPhRange[1]}); pre-plant lime or buffering review advised.`
          : `Topsoil pH ${soilPh} falls outside optimal ${crop.idealPhRange[0]}–${crop.idealPhRange[1]} range.`
    );
    if (waterConflict) {
      reasons.push(`High irrigation requirement conflicts with "${waterAvailability}".`);
    } else if (moistureStretch) {
      reasons.push(
        `Low NASA recent rainfall (~${recentAnnualMm ?? 'low'} mm/yr) suggests conservative plant population or supplementary water.`
      );
    } else {
      reasons.push(`Water demand (${crop.waterNeed}) aligns with "${waterAvailability}".`);
    }

    return {
      crop,
      scoreLabel,
      reasons,
    };
  };

  const evaluated = selectedCatalogItems.map(evaluateCrop);

  const pickSeasonCrop = (
    preferredSeason: 'Main Summer' | 'Cool / Transition',
    usedFamilies: string[],
    usedCropIds: string[]
  ) => {
    const scoreWeight = (s: 'High Fit' | 'Moderate Fit' | 'Marginal Fit') =>
      s === 'High Fit' ? 3 : s === 'Moderate Fit' ? 2 : 1;

    const ranked = [...evaluated].sort((a, b) => {
      const aSeasonBonus =
        a.crop.preferredSeason === preferredSeason || a.crop.preferredSeason === 'Year-round'
          ? 4
          : 0;
      const bSeasonBonus =
        b.crop.preferredSeason === preferredSeason || b.crop.preferredSeason === 'Year-round'
          ? 4
          : 0;
      const aFamilyPenalty = usedFamilies.includes(a.crop.botanicalFamily) ? -5 : 0;
      const bFamilyPenalty = usedFamilies.includes(b.crop.botanicalFamily) ? -5 : 0;
      const aUsedPenalty = usedCropIds.includes(a.crop.id) ? -6 : 0;
      const bUsedPenalty = usedCropIds.includes(b.crop.id) ? -6 : 0;

      const scoreA =
        scoreWeight(a.scoreLabel) * 2 + aSeasonBonus + aFamilyPenalty + aUsedPenalty;
      const scoreB =
        scoreWeight(b.scoreLabel) * 2 + bSeasonBonus + bFamilyPenalty + bUsedPenalty;
      return scoreB - scoreA;
    });

    return ranked[0] || evaluated[0];
  };

  const priorityLower = farmerPriority.toLowerCase();
  const s1Target: 'Main Summer' | 'Cool / Transition' = isWinterRain
    ? 'Cool / Transition'
    : 'Main Summer';
  const s2Target: 'Main Summer' | 'Cool / Transition' =
    s1Target === 'Main Summer' ? 'Cool / Transition' : 'Main Summer';
  const s3Target: 'Main Summer' | 'Cool / Transition' = s1Target;

  // Prefer non-legume or cereal for Season 1 if soil recovery isn't sole priority, then break family in S2 & S3
  const season1Pick =
    evaluated.find(
      (e) =>
        e.crop.preferredSeason === s1Target &&
        e.scoreLabel !== 'Marginal Fit' &&
        (priorityLower.includes('soil')
          ? e.crop.nitrogenRole === 'Nitrogen-fixing legume'
          : e.crop.botanicalFamily === 'Poaceae')
    ) || pickSeasonCrop(s1Target, [], []);

  const season2Pick = pickSeasonCrop(
    s2Target,
    [season1Pick.crop.botanicalFamily],
    [season1Pick.crop.id]
  );

  const season3Pick = pickSeasonCrop(
    s3Target,
    [season1Pick.crop.botanicalFamily, season2Pick.crop.botanicalFamily],
    [season1Pick.crop.id, season2Pick.crop.id]
  );

  const buildSeasonEntry = (
    num: number,
    seasonLabel: string,
    plantingWindow: string,
    pick: ReturnType<typeof evaluateCrop>,
    prevFamily?: string
  ) => {
    const suitabilityLevel: 'Strong Fit' | 'Conditional Fit' | 'Caution' =
      pick.scoreLabel === 'High Fit' && prevFamily !== pick.crop.botanicalFamily
        ? 'Strong Fit'
        : pick.scoreLabel === 'Marginal Fit' || prevFamily === pick.crop.botanicalFamily
          ? 'Caution'
          : 'Conditional Fit';

    const rotationReason =
      prevFamily && prevFamily !== pick.crop.botanicalFamily
        ? `Rotates botanical family from ${prevFamily} to ${pick.crop.botanicalFamily} (${pick.crop.nitrogenRole}) to interrupt pest/disease carry-over.`
        : prevFamily === pick.crop.botanicalFamily
          ? `Notice: repeats ${pick.crop.botanicalFamily} family from the prior season because your selected list contains limited non-${prevFamily} options; consider adding a legume or broadleaf break crop.`
          : `Initiates sequence with ${pick.crop.familyGroupLabel} (${pick.crop.nitrogenRole}).`;

    return {
      seasonNumber: num,
      seasonLabel,
      plantingWindow,
      recommendedCropId: pick.crop.id,
      recommendedCropName: pick.crop.name,
      botanicalFamily: pick.crop.botanicalFamily,
      nitrogenRole: pick.crop.nitrogenRole,
      suitabilityLevel,
      suitabilityReasons: [rotationReason, ...pick.reasons],
      benefits: pick.crop.benefits,
      risks: pick.crop.risks,
      plantingChecklist: pick.crop.plantingChecklist,
    };
  };

  const threeSeasonRotation = [
    buildSeasonEntry(
      1,
      isWinterRain ? 'Season 1: Cool / Winter Main Cycle' : 'Season 1: Primary Rainy Season',
      isWinterRain ? 'April – June' : 'October – December',
      season1Pick
    ),
    buildSeasonEntry(
      2,
      isWinterRain ? 'Season 2: Warm / Residual Moisture Window' : 'Season 2: Cool / Shoulder Window',
      isWinterRain ? 'September – November' : 'March – May',
      season2Pick,
      season1Pick.crop.botanicalFamily
    ),
    buildSeasonEntry(
      3,
      isWinterRain ? 'Season 3: Follow-up Winter Cycle' : 'Season 3: Follow-up Main Rainy Season',
      isWinterRain ? 'April – June (Next Year)' : 'October – December (Next Year)',
      season3Pick,
      season2Pick.crop.botanicalFamily
    ),
  ];

  const distinctFamilies = new Set(threeSeasonRotation.map((s) => s.botanicalFamily));
  const hasLegume = threeSeasonRotation.some((s) => s.nitrogenRole === 'Nitrogen-fixing legume');

  const soilHealthImplications = [
    `Botanical diversity across planned sequence: ${distinctFamilies.size} distinct crop family/families represented (${Array.from(distinctFamilies).join(' → ')}). Rotating across Poaceae, Fabaceae, Brassicaceae, Asteraceae, or Amaranthaceae slows soil-borne pathogen escalation.`,
    hasLegume
      ? 'Includes a nitrogen-fixing legume (Fabaceae) to contribute biological nitrogen and reduce fertiliser dependence in the following cereal or leafy cycle (confirm Rhizobium inoculant compatibility).'
      : 'No nitrogen-fixing legume (Fabaceae) was placed in the 3-season rotation. Consider substituting Dry Beans, Soybeans, or Cowpeas in one cycle to rebuild organic nitrogen.',
    `Topsoil texture & pH (${soilType}, pH ${soilPh}): ${
      soilPh < 5.6
        ? 'Moderately acidic reaction limits phosphorus availability and legume nodulation; factor agricultural lime before legume planting.'
        : soilPh > 7.4
          ? 'Slightly alkaline pH can tie up zinc and iron; monitor foliar micronutrients and organic compost additions.'
          : 'Balanced topsoil pH supports broad nutrient availability across cereal and broadleaf stages.'
    }`,
  ];

  const climateAndMoistureAlignment = nasaClimate.serviceAvailable
    ? `NASA POWER 2020–2024 vs 2001–2015 analysis at ${lat.toFixed(2)}°, ${lng.toFixed(2)}° shows ${recentAnnualMm ?? '—'} mm/yr recent mean rainfall (baseline ${baselineAnnualMm ?? '—'} mm/yr), ${avgMaxTempC ?? '—'}°C mean daily Tmax, and ${avgSolar ?? '—'} MJ/m²/day solar radiation. ${
        rainDeficitShift && !hasIrrigation
          ? 'Because recent grid rainfall has trended lower than baseline and this scenario lacks full irrigation, prioritise drought-tolerant spacing and mulch retention during dry shoulder windows.'
          : hasIrrigation
            ? 'Confirmed water access buffers rainfall timing variability, provided irrigation flow is audited before cool-season crops.'
            : 'Match dryland planting strictly to confirmed spring/autumn topsoil wetting rather than fixed calendar dates.'
      }`
    : `NASA POWER multi-year grid data could not be retrieved right now (${nasaClimate.unavailableReason || 'service offline'}). Alignment above uses provincial climate regime (${prov.climateZone}, ${prov.annualRainfallMm}) and stated water access (${waterAvailability}).`;

  return {
    generatedAt: new Date().toISOString(),
    siteContext: {
      label: siteLabel,
      province: prov.name,
      rainfallRegime: prov.rainfallRegime,
      farmSizeHectares,
      waterAvailability,
      soilType,
      soilPh,
      soilDataSource,
      farmerPriority,
    },
    climateSource: {
      provider: nasaClimate.source,
      available: nasaClimate.serviceAvailable,
      note: nasaClimate.serviceAvailable
        ? `Live NASA POWER monthly satellite archive (2001–2015 baseline vs 2020–2024 recent at ${nasaClimate.coordinatesLabel}).`
        : nasaClimate.unavailableReason || 'NASA POWER unavailable.',
      recentAnnualRainfallMm: recentAnnualMm,
      baselineAnnualRainfallMm: baselineAnnualMm,
      avgMaxTempC,
      avgSolarIrradiance: avgSolar,
    },
    comparedCrops: evaluated.map(({ crop, scoreLabel, reasons }) => ({
      cropId: crop.id,
      cropName: crop.name,
      botanicalFamily: crop.botanicalFamily,
      waterNeed: crop.waterNeed,
      idealPhRange: crop.idealPhRange,
      suitabilityScoreLabel: scoreLabel,
      suitabilityReason: reasons.join(' '),
      keyBenefits: crop.benefits,
      keyRisks: crop.risks,
      plantingChecklist: crop.plantingChecklist,
    })),
    threeSeasonRotation,
    soilHealthImplications,
    climateAndMoistureAlignment,
    assumptions: [
      `Water access evaluated as reported: "${waterAvailability}".`,
      `Soil baseline used: ${soilType}, pH ${soilPh} (${soilDataSource}).`,
      `Climate grid metrics cover ~0.5° × 0.625° regional NASA POWER cells (~55 km) and may differ from micro-slope frost pockets or hail corridors.`,
      `Rotation covers ${farmSizeHectares} ha across up to 3 sequential growing seasons.`,
    ],
    limitations: [
      'Suitability scoring uses regional climate regime, stated water access, soil pH/texture, and botanical family pathology rules — it is not a laboratory nutrient prescription.',
      'Cool/transition season feasibility in summer-rainfall provinces depends heavily on stored soil moisture or active borehole/dam irrigation.',
      'Market absorption, cultivar selection, and chemical MRL regulations must be confirmed with local buyers and a qualified agronomist prior to planting.',
    ],
    disclaimer:
      'Decision-support planning tool only. Field Shift makes NO guarantee of crop yield, survival, rainfall onset, or net financial profit. Confirm soil fertility with an accredited laboratory test before committing capital.',
  };
}
