import { store } from './store.ts';
import {
  LanguageCode,
  LearningCategoryCode,
  LearningMaterial,
  SanitizedUser,
} from './types.ts';

export const LEARNING_CATEGORIES: {
  code: LearningCategoryCode;
  label: string;
  description: string;
}[] = [
  {
    code: 'beginner_farming',
    label: 'Beginner Farming',
    description: 'First-season farm readiness, land checks, water verification, and starter steps.',
  },
  {
    code: 'crop_production',
    label: 'Crop Production',
    description: 'Spacing, cultivar choice, planting calendars, and field agronomy fundamentals.',
  },
  {
    code: 'soil_preparation',
    label: 'Soil Preparation',
    description: 'Composite soil sampling, pH correction, conservation tillage, and seedbed prep.',
  },
  {
    code: 'irrigation',
    label: 'Irrigation',
    description: 'Drip scheduling, borehole capacity matching, and moisture-stress prevention.',
  },
  {
    code: 'fertiliser_application',
    label: 'Fertiliser Application',
    description: 'Basal vs top-dressing nutrition aligned to laboratory soil test results.',
  },
  {
    code: 'pest_management',
    label: 'Pest Management',
    description: 'Regular scouting, integrated pest thresholds, and safe control practices.',
  },
  {
    code: 'plant_disease_awareness',
    label: 'Plant Disease Awareness',
    description: 'Spotting fungal leaf spots, blights, root rot, and sending samples to labs.',
  },
  {
    code: 'harvesting',
    label: 'Harvesting',
    description: 'Maturity signs, hygiene, field-heat removal, and reducing post-harvest losses.',
  },
  {
    code: 'livestock_management',
    label: 'Livestock Management',
    description: 'Herd identification, rotational grazing, biosecurity, and veterinary escalation.',
  },
  {
    code: 'animal_feeding',
    label: 'Animal Feeding',
    description: 'Balanced dry-matter rations, clean water intake, and winter lick supplementation.',
  },
  {
    code: 'animal_housing',
    label: 'Animal Housing',
    description: 'Ventilation, dry bedding, predator fencing, and biosecurity footbaths.',
  },
  {
    code: 'farm_equipment',
    label: 'Farm Equipment',
    description: 'Sprayer nozzle calibration, hand tool care, and personal protective equipment (PPE).',
  },
  {
    code: 'machinery_guidance',
    label: 'Machinery Guidance',
    description: 'Pre-start tractor checklists, PTO safety shields, and implement hitching.',
  },
  {
    code: 'agricultural_business_planning',
    label: 'Agricultural Business Planning',
    description: 'Input cost tracking, buyer agreements, break-even planning, and stock records.',
  },
];

export const OFFICIAL_GUIDANCE_NOTICE =
  'Field Shift Learning Centre publishes reviewed foundational South African agricultural guidance grounded in extension best practices. Always consult a qualified agronomist, extension officer, or veterinarian for site-specific diagnosis, chemical dosing, or animal treatment.';

export function createSeedLearningMaterials(): LearningMaterial[] {
  const now = '2026-09-01T08:00:00.000Z';
  const materials: LearningMaterial[] = [
    {
      id: 'learn-beginner-1',
      slug: 'first-season-farm-readiness-checklist',
      category: 'beginner_farming',
      contentType: 'step_by_step_guide',
      difficulty: 'beginner',
      illustrationKey: 'soil_crops',
      videoDurationLabel: '4 min visual lesson',
      videoSlides: [
        {
          heading: '1. Confirm Reliable Water Before Planting',
          caption: 'Measure borehole yield (litres/hour) or storage capacity for dry months before buying seed.',
          visualCue: 'Borehole pump, 5,000L buffer tank, and drip line flow check.',
          durationSeconds: 6,
        },
        {
          heading: '2. Sample 0–20 cm Topsoil for Lab Testing',
          caption: 'Collect 10–15 clean sub-samples across the plot in a zig-zag pattern before applying lime or fertiliser.',
          visualCue: 'Topsoil A-horizon sampling cross-section.',
          durationSeconds: 6,
        },
        {
          heading: '3. Identify Local Buyers Prior to Planting',
          caption: 'Confirm size, grade, and delivery frequency with at least 2–3 buyers within 50 km.',
          visualCue: 'Harvest crates and market delivery logbook.',
          durationSeconds: 6,
        },
      ],
      sourceAttribution: 'DALRRD / ARC Smallholder Extension Readiness Baseline (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 6,
      tags: ['beginner', 'water', 'soil test', 'market'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'First-Season Farm Readiness: Water, Soil & Buyers First',
          summary: 'Three foundational checks to complete before spending capital on seeds, stock, or tillage.',
          body: 'Many new farming enterprises run into cash-flow difficulty because planting begins before water reliability, soil acidity, and buyer specifications are verified. Completing these baseline checks reduces avoidable input waste.',
          steps: [
            'Verify dry-season water supply (borehole litres/hour, dam level, or municipal allocation) and size planted hectares to match.',
            'Submit a composite 0–20 cm soil sample to an accredited South African soil laboratory to measure pH and major nutrients.',
            'Confirm target buyer requirements (pack size, variety, delivery schedule) within 50 km before choosing planting dates.',
            'Set up a simple seasonal budget separating one-off equipment purchases from recurring seed, fertiliser, and labour expenses.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Agricultural Editorial Team',
          reviewedAt: '2026-09-01',
        },
        zu: {
          title: 'Ukulungiselela Isizini Yokuqala: Amanzi, Inhlabathi kanye Nabathengi',
          summary: 'Izinyathelo ezintathu ezibalulekile okufanele uzenze ngaphambi kokuthenga imbewu noma umanyolo.',
          body: 'Abalimi abaqalayo bavame ukulahlekelwa yimali uma beqala ukutshala bengakahloli amanzi, ukumuncu kwenhlabathi, kanye nezidingo zabathengi. Lezi zinyathelo zinciphisa ukumosheka kwezindleko.',
          steps: [
            'Hlola isilinganiso samanzi ngesikhathi somileyo (umthombo noma idamu) bese ulinganisa indawo ozoyitshala namanzi akhona.',
            'Thatha amasampula enhlabathi ajule nge-0–20 cm uyohlolisa elabhorethri ukuze wazi i-pH kanye nomsoco wenhlabathi.',
            'Xoxisana nabathengi basendaweni ngaphambi kokutshala ukuze wazi uhlobo nosayizi wesivuno abasifunayo.',
            'Bhala ibhajethi ehlukanisa izindleko zamathuluzi nezindleko zembewu, umanyolo kanye nabasebenzi.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift isiZulu Extension Review',
          reviewedAt: '2026-09-02',
        },
        af: {
          title: 'Eerste Seisoen Plaasgereedheid: Water, Grond en Kopers',
          summary: 'Drie noodsaaklike vooraf-kontroles voordat jy geld aan saad, bemesting of bewerking spandeer.',
          body: 'Nuwe boerderye ondervind dikwels kontantvloeidruk wanneer daar geplant word voordat waterbeskikbaarheid, grondsuurheid en markspesifikasies bevestig is.',
          steps: [
            'Meet boorgat-lewering of watertoekenning in die droë tyd en pas aangeplante hektare daarby aan.',
            'Neem saamgestelde 0–20 cm grondmonsters vir laboratorium-ontleding voordat kalk of kunsmis aangekoop word.',
            'Bevestig plaaslike kopers se verpakking- en gehaltevereistes binne 50 km voor planttyd.',
            'Stel ’n begroting op wat eenmalige toerusting skei van lopende saad-, kunsmis- en arbeidskoste.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Afrikaans Redaksie',
          reviewedAt: '2026-09-02',
        },
      },
    },
    {
      id: 'learn-soil-1',
      slug: 'composite-soil-sampling-and-ph-correction',
      category: 'soil_preparation',
      contentType: 'illustrated_guide',
      difficulty: 'beginner',
      illustrationKey: 'soil_crops',
      sourceAttribution: 'ARC Soil, Climate and Water — Standard Soil Sampling Protocol (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 7,
      tags: ['soil', 'pH', 'lime', 'sampling'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'Taking a Composite 0–20 cm Soil Sample & Reading pH',
          summary: 'How to sample uniform blocks accurately and understand why soil pH unlocks fertiliser uptake.',
          body: 'Soil fertility varies across slopes and soil colours. Mixing separate soil types in one bag gives misleading lab averages. Group uniform blocks separately and target soil pH (KCl) around 5.2–6.0 (pH water 6.0–6.8) for most grain and vegetable crops.',
          steps: [
            'Divide your farm into uniform blocks by soil colour, slope, and past crop history.',
            'Clear surface plant litter and collect 10–15 cores at 0–20 cm depth along a W-pattern using a clean spade or auger.',
            'Mix cores thoroughly in a clean plastic bucket (avoid galvanised metal buckets that contaminate zinc readings).',
            'Bag ~500 g, label farm, block, and depth, and send to your provincial agricultural laboratory 6–8 weeks before planting so lime has time to react.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Agronomy Desk',
          reviewedAt: '2026-09-01',
        },
        xh: {
          title: 'Ukuthatha Iisampulu Zomhlaba (0–20 cm) Nokuqonda I-pH',
          summary: 'Indlela yokuthatha iisampulu ezichanekileyo nokufumanisa ukuba kutheni i-pH yomhlaba ibalulekile.',
          body: 'Ukuchuma komhlaba kuyahluka ngokweenduli nemibala yomhlaba. Yahlula iibhloko ezifanayo uze uthumele iisampulu elabhoratri kwiveki ezintandathu phambi kokutyala.',
          steps: [
            'Yahlula amasimi akho ngeebhloko ezinomhlaba ofanayo.',
            'Susa ingca engaphezulu uze uthathe iisampulu ezili-10 ukuya kwezili-15 kubunzulu be-0–20 cm.',
            'Xuba kakuhle kwibhakethi yeplastiki ecocekileyo, ususe amatye neengcambu.',
            'Faka i-500 g engxoweni ebhalwe igama lefama nebhloko uyithumele elabhoratri.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift isiXhosa Extension Review',
          reviewedAt: '2026-09-03',
        },
      },
    },
    {
      id: 'learn-crop-1',
      slug: 'maize-and-leafy-vegetable-spacing-stand-establishment',
      category: 'crop_production',
      contentType: 'article',
      difficulty: 'beginner',
      illustrationKey: 'soil_crops',
      sourceAttribution: 'ARC Grain Crops & Vegetable Production Guides (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 6,
      tags: ['maize', 'cabbage', 'spinach', 'plant population'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'Crop Establishment: Row Spacing & Plant Population Basics',
          summary: 'Aligning seed spacing to seasonal rainfall or drip irrigation capacity for even emergence.',
          body: 'Over-crowding plants in low-rainfall zones causes severe moisture competition during flowering, while erratic planter depth reduces emergence uniformity. Check planter calibration and seed-to-soil moisture contact across every field.',
          steps: [
            'Match dryland maize population to local seasonal rainfall (typically 28,000–45,000 plants/ha in drier areas, higher under supplementary irrigation).',
            'Inspect seed furrow depth consistency (3–5 cm for maize depending on topsoil moisture; shallow 1–2 cm for fine vegetable seeds).',
            'Perform a 10-day emergence count per 10-metre row sample and log surviving plants in Field Shift Crops & Stock.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Agronomy Desk',
          reviewedAt: '2026-09-01',
        },
      },
    },
    {
      id: 'learn-irrigation-1',
      slug: 'drip-irrigation-scheduling-and-et0-moisture-checks',
      category: 'irrigation',
      contentType: 'step_by_step_guide',
      difficulty: 'intermediate',
      illustrationKey: 'soil_crops',
      sourceAttribution: 'Water Research Commission (WRC) Smallholder Irrigation Guidelines (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 8,
      tags: ['drip', 'evapotranspiration', 'moisture', 'pumping'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'Irrigation Scheduling Using Soil Moisture Feel & ET₀ Forecasts',
          summary: 'Prevent root waterlogging and wasted electricity by checking root-zone moisture before irrigating.',
          body: 'Fixed calendar watering wastes water and leaches nitrogen when cool overcast weather or upcoming rain reduces crop water demand. Combine Field Shift Weather ET₀ readings with a physical spade check in the root zone.',
          steps: [
            'Check the 72-hour rainfall forecast in Weather Intelligence before running pumps; pause cycles if 12 mm+ rain is imminent.',
            'Inspect 15–20 cm depth beside the drip line with a trowel or soil auger; irrigate only when topsoil begins losing moisture cohesion.',
            'Flush drip tape ends and clean screen/disc filters weekly to prevent uneven emitter clogging.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Water & Soils Team',
          reviewedAt: '2026-09-01',
        },
      },
    },
    {
      id: 'learn-fertiliser-1',
      slug: 'split-nitrogen-application-and-lab-calibrated-basal-feeding',
      category: 'fertiliser_application',
      contentType: 'article',
      difficulty: 'intermediate',
      illustrationKey: 'soil_crops',
      sourceAttribution: 'FERTASA / DALRRD Nutrient Management Principles (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 7,
      tags: ['NPK', 'top-dressing', 'fertiliser', 'timing'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'Fertiliser Application: Basal Placement vs Split Top-Dressing',
          summary: 'Applying the right nutrient source at planting and vegetative growth to avoid burn and leaching.',
          body: 'Applying all nitrogen at planting increases leaching losses during heavy summer thunderstorms. Base phosphorus and potassium rates on laboratory soil reports, and split nitrogen into planting plus active vegetative top-dressing.',
          steps: [
            'Place basal NPK fertiliser banded ~5 cm beside and below the seed rather than in direct contact with germinating seed.',
            'Apply nitrogen top-dressing when foliage is dry and soil has light moisture (avoid applying immediately ahead of forecast heavy downpours >30 mm).',
            'Record fertiliser batch, rate, and date in Crop Management to compare yield response at harvest.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Agronomy Desk',
          reviewedAt: '2026-09-01',
        },
      },
    },
    {
      id: 'learn-pest-1',
      slug: 'weekly-crop-scouting-and-ipm-thresholds',
      category: 'pest_management',
      contentType: 'illustrated_guide',
      difficulty: 'beginner',
      illustrationKey: 'pest_disease',
      videoDurationLabel: '3 min visual lesson',
      videoSlides: [
        {
          heading: '1. Walk a W-Pattern Across Each Field Weekly',
          caption: 'Inspect at least 20 plants across 5 spots — check leaf undersides and maize whorls early morning.',
          visualCue: 'Healthy vs window-pane chewed maize leaf comparison.',
          durationSeconds: 6,
        },
        {
          heading: '2. Distinguish Insect Damage from Nutrient Stress',
          caption: 'Look for frass, feeding holes, or aphids before choosing any registered intervention.',
          visualCue: 'Close-up of chewing caterpillar damage and beetle spots.',
          durationSeconds: 6,
        },
        {
          heading: '3. Record Affected Plants & Consult Extension',
          caption: 'Use Visual Analysis & Incidents to quantify affected plants and follow registered label thresholds.',
          visualCue: 'Field inspection log and qualified extension check.',
          durationSeconds: 6,
        },
      ],
      sourceAttribution: 'ARC Integrated Pest Management (IPM) Scouting Guide (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 7,
      tags: ['IPM', 'scouting', 'armyworm', 'aphids'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'Weekly Field Scouting & Integrated Pest Management (IPM)',
          summary: 'Catch early pest build-up through structured weekly scouting and protect beneficial insects.',
          body: 'Routine weekly scouting catches pest outbreaks while populations are still small and confined to field edges. Never spray unlabelled or expired mixtures; confirm pest identity and action thresholds with a qualified crop advisor or product label.',
          steps: [
            'Walk a W-shaped path through each field weekly, checking 5–10 consecutive plants at 4–5 stations.',
            'Inspect leaf undersides, growing points (whorls), and stem bases for eggs, larvae, frass, or aphids.',
            'Preserve natural predators (ladybirds, lacewings, parasitic wasps) by avoiding unnecessary broad-spectrum sprays.',
            'Upload clear close-up photos in Visual Agricultural Analysis or contact your provincial extension officer before chemical selection.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Plant Health Desk',
          reviewedAt: '2026-09-01',
        },
        zu: {
          title: 'Ukuhlolwa Kwamasimu Masonto Onke Nokulawulwa Kwezinambuzane (IPM)',
          summary: 'Bona izinambuzane zisencane ngokuhlola amasimu njalo ngesonto uvikele nezinambuzane ezisizayo.',
          body: 'Ukuhlola insimu masonto onke kusiza ukubona izinkinga zisencane emaphethelweni ensimu. Ungalokothi usebenzise amakhemikhali angabhalisiwe ngaphandle kokubonisana nochwepheshe.',
          steps: [
            'Hamba ngesimo sika-W ensimini masonto onke uhlola izitshalo ezingu-5 kuye kweziyi-10 endaweni ngayinye.',
            'Bheka ngaphansi kwamaqabunga naphakathi kwesiqu ukuze ubone amaqanda noma izibungu.',
            'Vikela izinambuzane eziwusizo ngokugwema ukufafaza ngokungadingekile.',
            'Thatha isithombe esicacile usifake ku-Visual Analysis noma uthintane nomeluleki wezolimo.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift isiZulu Extension Review',
          reviewedAt: '2026-09-04',
        },
      },
    },
    {
      id: 'learn-disease-1',
      slug: 'recognising-fungal-leaf-spots-and-blights-early',
      category: 'plant_disease_awareness',
      contentType: 'illustrated_guide',
      difficulty: 'intermediate',
      illustrationKey: 'pest_disease',
      sourceAttribution: 'ARC Plant Health & Diagnostic Clinic Guidance (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 6,
      tags: ['disease', 'fungal', 'leaf spot', 'sanitation'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'Plant Disease Awareness: Fungal Leaf Spots vs Nutrient Deficiency',
          summary: 'How lesion borders, humidity patterns, and crop rotation help separate infectious diseases from nutritional stress.',
          body: 'Nutrient deficiencies usually appear uniformly across whole blocks and show symmetrical yellowing, whereas fungal or bacterial infections often start in damp patches and show irregular lesions with dark or yellow halos. Laboratory confirmation is essential before major treatments.',
          steps: [
            'Compare lesion distribution: patchy spread after warm humid nights points toward possible fungal/bacterial pressure.',
            'Avoid working in wet foliage (early dew or rain) because hands, boots, and tools spread bacterial and fungal spores along rows.',
            'Practise 2–3 year crop rotation and remove heavily infected crop debris where recommended.',
            'Submit symptomatic samples to a diagnostic clinic when spread accelerates rather than guessing treatments.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Plant Health Desk',
          reviewedAt: '2026-09-01',
        },
      },
    },
    {
      id: 'learn-harvest-1',
      slug: 'harvest-timing-cooling-and-post-harvest-handling',
      category: 'harvesting',
      contentType: 'step_by_step_guide',
      difficulty: 'beginner',
      illustrationKey: 'farmland_hero',
      sourceAttribution: 'DALRRD Post-Harvest Handling Guidelines (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 5,
      tags: ['harvest', 'post-harvest', 'cooling', 'storage'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'Harvesting & Reducing Post-Harvest Spoilage on Farm',
          summary: 'Harvesting during cool morning hours, shading crates, and tracking stored vs spoiled kg.',
          body: 'High field heat cuts leafy vegetable shelf-life dramatically. Harvesting early in the morning, using ventilated clean crates, and tracking actual harvested vs spoiled weight protects both product quality and farm profitability.',
          steps: [
            'Harvest fresh vegetables in cool early morning hours and move filled crates immediately into shade.',
            'Sanitise harvest knives and plastic crates between blocks; avoid stacking heavy produce in deep sacks that bruise bottom layers.',
            'Weigh harvested lots and record both Stored Production and any Spoilage inside Field Shift Stock & Inventory.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Post-Harvest Team',
          reviewedAt: '2026-09-01',
        },
      },
    },
    {
      id: 'learn-livestock-1',
      slug: 'livestock-identification-biosecurity-and-vet-escalation',
      category: 'livestock_management',
      contentType: 'article',
      difficulty: 'beginner',
      illustrationKey: 'livestock_housing',
      sourceAttribution: 'South African Animal Identification & Biosecurity Standards (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 7,
      tags: ['biosecurity', 'quarantine', 'herd health', 'livestock'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'Livestock Herd Biosecurity, Quarantine & Veterinary Escalation',
          summary: 'Isolating newly purchased stock, maintaining footbaths, and knowing when to call a state or private vet.',
          body: 'Bringing unquarantined animals into an existing herd or flock is one of the fastest ways to introduce respiratory disease, foot-and-mouth risk, or resistant internal parasites. Strict quarantine and clean arrival records protect the whole farm.',
          steps: [
            'Keep newly bought animals in a separate quarantine camp for at least 21–28 days while monitoring appetite, manure, and gait.',
            'Maintain a disinfectant footbath and clean boot/vehicle log at poultry houses and kraal entrances.',
            'Log all births, deaths, vaccinations, and veterinary treatments in Livestock Management; contact a qualified veterinarian immediately for sudden deaths, fever, or lameness.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Animal Health Advisory',
          reviewedAt: '2026-09-01',
        },
      },
    },
    {
      id: 'learn-feeding-1',
      slug: 'dry-season-forage-water-and-mineral-supplementation',
      category: 'animal_feeding',
      contentType: 'article',
      difficulty: 'intermediate',
      illustrationKey: 'livestock_housing',
      sourceAttribution: 'ARC Animal Production — Winter Veld & Feeding Guidance (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 6,
      tags: ['feeding', 'veld', 'water', 'minerals'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'Animal Feeding: Clean Water, Rotational Grazing & Dry-Season Licks',
          summary: 'Balancing forage intake, water cleanliness, and winter protein/mineral supplements without feed waste.',
          body: 'Feed intake drops sharply if drinking troughs are algae-fouled or warm. During dry South African winter months, sourveld protein levels fall below maintenance requirements, making timely winter supplementation and conserved crop stover critical.',
          steps: [
            'Scrub livestock drinking troughs weekly and inspect float valves daily during summer heat.',
            'Rest grazed veld camps periodically so desirable grasses recover root reserves and seed.',
            'Introduce winter protein/phosphate licks or conserved hay gradually over 10–14 days to prevent digestive upset; verify urea lick safety (never let rain pool in urea troughs).',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Animal Nutrition Desk',
          reviewedAt: '2026-09-01',
        },
      },
    },
    {
      id: 'learn-housing-1',
      slug: 'ventilated-poultry-and-small-stock-housing-design',
      category: 'animal_housing',
      contentType: 'video_lesson',
      difficulty: 'beginner',
      illustrationKey: 'livestock_housing',
      videoDurationLabel: '4 min visual lesson',
      videoSlides: [
        {
          heading: '1. East-West Roof Orientation & Ridge Ventilation',
          caption: 'Orient houses East-West to cut midday solar heat on sidewalls and vent warm ammonia upward through ridge openings.',
          visualCue: 'Cross-ventilation ridge roof and shaded eaves diagram.',
          durationSeconds: 7,
        },
        {
          heading: '2. Dry Bedding & Moisture Drainage',
          caption: 'Maintain dry 5–8 cm wood shavings or straw; wet litter around drinkers breeds coccidiosis and foot rot.',
          visualCue: 'Dry litter layer, suspended drinkers, and raised goat slats.',
          durationSeconds: 7,
        },
        {
          heading: '3. Biosecurity Entrance & Predator Fencing',
          caption: 'Install lockable perimeter wire, footbath station, and wild-bird mesh to protect flocks.',
          visualCue: 'Biosecurity gate, boot dip, and secure fence line.',
          durationSeconds: 7,
        },
      ],
      sourceAttribution: 'SAPA / DALRRD Small-Scale Housing Best Practices (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 8,
      tags: ['poultry house', 'ventilation', 'bedding', 'goats'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'Animal Housing: Ventilation, Dry Bedding & Biosecurity Layout',
          summary: 'Designing practical shelters that prevent heat stress, ammonia build-up, and moisture-borne disease.',
          body: 'Good livestock housing does not have to be expensive, but it must stay dry underfoot, block cold winter drafts at animal height, and vent warm humid air out through high eaves or ridge openings.',
          steps: [
            'Site shelters on slightly elevated, well-drained ground away from stormwater runoff channels.',
            'Provide ridge or upper-wall ventilation above animal height with adjustable side curtains for cold nights.',
            'Keep feeders and nipple/bell drinkers at back height to stop bedding contamination and wet patches.',
            'Include a dedicated biosecurity boot-dip and handwash point at the single controlled entrance.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Livestock Engineering Desk',
          reviewedAt: '2026-09-01',
        },
      },
    },
    {
      id: 'learn-equipment-1',
      slug: 'knapsack-sprayer-calibration-and-ppe-basics',
      category: 'farm_equipment',
      contentType: 'illustrated_guide',
      difficulty: 'beginner',
      illustrationKey: 'equipment_safety',
      sourceAttribution: 'AVCASA / CropLife SA Sprayer Safety & Calibration Standards (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 7,
      tags: ['sprayer', 'calibration', 'PPE', 'safety'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'Knapsack Sprayer Calibration & Personal Protective Equipment (PPE)',
          summary: 'Measure water output with clean water first and wear mandatory PPE before handling any crop-protection label.',
          body: 'Over-dosing wastes money and burns leaves, while under-dosing causes pest resistance. Always calibrate sprayers using clean water on a measured test strip before mixing any registered product.',
          steps: [
            'Check hoses, seals, straps, and nozzle tips for leaks using clean water before every season.',
            'Calibrate output by spraying clean water over a measured 25 m × 1 m strip at steady walking pace and measuring litres used.',
            'Wear chemical-resistant nitrile gloves, closed waterproof boots, safety goggles, and clean overalls when mixing or applying registered inputs.',
            'Avoid spraying when wind exceeds 12–15 km/h or rain is forecast within 6 hours (check Weather Intelligence first).',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Safety & Equipment Desk',
          reviewedAt: '2026-09-01',
        },
      },
    },
    {
      id: 'learn-machinery-1',
      slug: 'tractor-pre-start-checks-and-pto-shield-safety',
      category: 'machinery_guidance',
      contentType: 'step_by_step_guide',
      difficulty: 'intermediate',
      illustrationKey: 'equipment_safety',
      sourceAttribution: 'South African Occupational Health & Agricultural Machinery Safety Checklist (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 6,
      tags: ['tractor', 'PTO', 'maintenance', 'safety'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'Machinery Guidance: Daily Tractor Pre-Start & PTO Shield Safety',
          summary: 'Routine fluid checks, tyre pressures, three-point hitch locks, and PTO guard verification before field work.',
          body: 'Unshielded power take-off (PTO) shafts and missing ROPS/seatbelts are leading causes of severe farm machinery injuries. A 5-minute morning walk-around protects operators and prevents costly engine breakdowns.',
          steps: [
            'Check engine oil, radiator coolant, hydraulic oil, air pre-cleaner dust bowl, and fuel water-trap before starting.',
            'Confirm tyre pressures match field vs road transport loads and verify wheel lug nuts are tight.',
            'Inspect that PTO master shields and implement shaft guards turn freely and remain securely chained; never step over a rotating PTO.',
            'Never enter wet clay fields with heavy tractors where ruts and soil compaction will damage root structure.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Safety & Equipment Desk',
          reviewedAt: '2026-09-01',
        },
      },
    },
    {
      id: 'learn-business-1',
      slug: 'farm-budgeting-startup-capex-vs-operating-cashflow',
      category: 'agricultural_business_planning',
      contentType: 'article',
      difficulty: 'beginner',
      illustrationKey: 'prospective_card',
      sourceAttribution: 'NAMC / DALRRD Smallholder Agribusiness Financial Literacy Guide (Reviewed)',
      verifiedOfficialReference: true,
      status: 'published',
      estimatedMinutes: 8,
      tags: ['budget', 'cashflow', 'break-even', 'planning'],
      createdByUserId: 'user-admin-1',
      updatedByUserId: 'user-admin-1',
      createdAt: now,
      updatedAt: now,
      translations: {
        en: {
          title: 'Agricultural Business Planning: Startup Capital vs Operating Cashflow',
          summary: 'Understanding break-even yields, hidden transport costs, and separating estimates from actual expenses.',
          body: 'Many first-time farms spend all starting capital on equipment and fencing, leaving nothing for feed, seed, labour, or electricity before the first harvest cheque arrives. Use the Field Shift Business Planner to stress-test lower yield and lower price scenarios.',
          steps: [
            'Separate one-time startup assets (fencing, housing, tools) from recurring seasonal operating costs (seed, feed, fertiliser, water, wages).',
            'Include packaging, transport to market, and post-harvest shrinkage (typically 5–15% for fresh produce) in operating assumptions.',
            'Calculate break-even output and stress-test a 20% drop in yield or selling price — never budget on best-case assumptions alone.',
            'Record every real purchase in Stock & Inventory and Mixed Farming logs to compare estimates against actual cash spent.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Agribusiness Desk',
          reviewedAt: '2026-09-01',
        },
        af: {
          title: 'Landboubesigheidsbeplanning: Aanvangskapitaal teenoor Bedryfskoste',
          summary: 'Verstaan gelykbreek-opbrengste, vervoerkoste en die skeiding tussen ramings en werklike uitgawes.',
          body: 'Nuwe boerderye spandeer soms al hul kapitaal op toerusting en omheining en bly sonder bedryfskontant vir saad, voer of arbeid voor die eerste oes. Gebruik die Besigheidsbeplanner om verskeie skale en prysaannames te toets.',
          steps: [
            'Skei eenmalige kapitaalbates van herhalende seisoenale bedryfskoste.',
            'Sluit verpakking, vervoer en oesverliese in jou bedryfsramings in.',
            'Toets ’n 20% daling in opbrengs of prys — begroot nooit net vir die beste scenario nie.',
            'Teken elke werklike uitgawe aan om ramings met werklike koste te vergelyk.',
          ],
          reviewed: true,
          reviewedBy: 'Field Shift Afrikaans Redaksie',
          reviewedAt: '2026-09-03',
        },
      },
    },
  ];

  return materials;
}

export function userCanManageLearning(user: SanitizedUser): boolean {
  return (
    user.roleCode === 'system_administrator' ||
    user.roleCode === 'agricultural_expert' ||
    user.permissions.includes('learning:manage')
  );
}

export function resolveMaterialForUser(
  material: LearningMaterial,
  user: SanitizedUser,
  requestedLang?: LanguageCode
) {
  const targetLang = requestedLang || user.preferredLanguageCode || 'en';
  const catMeta = LEARNING_CATEGORIES.find((c) => c.code === material.category);

  const reviewedLangs = (Object.entries(material.translations || {}) as [
    LanguageCode,
    LearningMaterial['translations'][LanguageCode],
  ][])
    .filter(([, tr]) => Boolean(tr && tr.reviewed))
    .map(([code]) => code);

  const exactReviewed = material.translations[targetLang];
  const canUseExact = Boolean(exactReviewed && exactReviewed.reviewed);
  const fallbackEn = material.translations.en;
  const firstAvailable = Object.values(material.translations)[0];
  const chosen = (canUseExact ? exactReviewed : null) || fallbackEn || firstAvailable;

  const progress = store.db.learningProgress.find(
    (p) => p.userId === user.id && p.materialId === material.id
  );

  const canManage = userCanManageLearning(user);

  return {
    id: material.id,
    slug: material.slug,
    category: material.category,
    categoryLabel: catMeta?.label || material.category,
    contentType: material.contentType,
    difficulty: material.difficulty,
    illustrationKey: material.illustrationKey,
    customIllustrationDataUrl: material.customIllustrationDataUrl || null,
    videoUrl: material.videoUrl || null,
    videoDurationLabel: material.videoDurationLabel,
    videoSlides: material.videoSlides || [],
    sourceAttribution: material.sourceAttribution,
    verifiedOfficialReference: material.verifiedOfficialReference,
    status: material.status,
    estimatedMinutes: material.estimatedMinutes,
    tags: material.tags,
    resolvedLanguageCode: canUseExact ? targetLang : ('en' as LanguageCode),
    isExactLanguageReviewed: canUseExact,
    availableReviewedLanguages: reviewedLangs,
    displayTitle: chosen?.title || 'Untitled Guide',
    displaySummary: chosen?.summary || '',
    displayBody: chosen?.body || '',
    displaySteps: chosen?.steps || [],
    reviewedBy: chosen?.reviewedBy,
    reviewedAt: chosen?.reviewedAt,
    ...(canManage ? { translations: material.translations } : {}),
    userProgress: {
      isSaved: progress?.isSaved || false,
      status: progress?.status || 'not_started',
      completedSteps: progress?.completedSteps || [],
      progressPercent: progress?.progressPercent || 0,
      lastAccessedAt: progress?.lastAccessedAt || null,
      completedAt: progress?.completedAt || null,
    },
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

export const REQUIRED_STARTER_GUIDE_IDS = [
  'learn-beginner-1',
  'learn-soil-1',
  'learn-business-1',
];

export const READINESS_COMPLETION_MESSAGE =
  "Congratulations! You're ready to take the next step towards starting your farming journey.";

export interface ReadinessQuestionDef {
  id: string;
  question: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
}

export const READINESS_QUESTIONS: ReadinessQuestionDef[] = [
  {
    id: 'rq-water',
    question:
      'What must you verify first before deciding how many hectares to plant in an upcoming season?',
    options: [
      { id: 'a', label: 'Dry-season water availability, borehole yield, or municipal allocation' },
      { id: 'b', label: 'Buying maximum tractor capacity regardless of irrigated area' },
      { id: 'c', label: 'Applying limestone without testing topsoil pH' },
    ],
    correctOptionId: 'a',
  },
  {
    id: 'rq-soil',
    question:
      'How should a composite 0–20 cm soil sample be collected before applying fertiliser or agricultural lime?',
    options: [
      { id: 'a', label: 'Take one handful from the farm gate in a rusty tin bucket' },
      { id: 'b', label: 'Mix 10–15 cores across each uniform block in a clean plastic bucket and send to an accredited lab' },
      { id: 'c', label: 'Skip lab testing and copy a neighbour’s fertiliser bag dosage' },
    ],
    correctOptionId: 'b',
  },
  {
    id: 'rq-market',
    question:
      'Before purchasing seed for perishable crops, what market check reduces post-harvest loss risk?',
    options: [
      { id: 'a', label: 'Wait until harvest day to locate any buyer' },
      { id: 'b', label: 'Confirm grade, pack size, and delivery schedule with potential local buyers first' },
      { id: 'c', label: 'Plant the entire farm on the same day with one cultivar' },
    ],
    correctOptionId: 'b',
  },
  {
    id: 'rq-budget',
    question:
      'Why should a starter agricultural budget separate capital equipment from seasonal operating costs?',
    options: [
      { id: 'a', label: 'So ongoing cash needs for seed, feed, water, and labour are covered during the season' },
      { id: 'b', label: 'Because operating expenses do not repeat after harvest' },
      { id: 'c', label: 'To guarantee a fixed profit regardless of weather or market prices' },
    ],
    correctOptionId: 'a',
  },
  {
    id: 'rq-rotation',
    question:
      'What is the core agronomic reason for rotating across different botanical crop families (e.g., maize followed by dry beans)?',
    options: [
      { id: 'a', label: 'It eliminates the need to monitor pests or weather forecasts' },
      { id: 'b', label: 'It helps break shared pest/disease cycles and balances soil nitrogen use' },
      { id: 'c', label: 'It keeps soil identical across every season so soil tests are never needed' },
    ],
    correctOptionId: 'b',
  },
];

export function gradeReadinessAssessment(answers: Record<string, string>): {
  score: number;
  totalQuestions: number;
  passed: boolean;
} {
  let score = 0;
  for (const q of READINESS_QUESTIONS) {
    if (answers[q.id] && answers[q.id] === q.correctOptionId) {
      score += 1;
    }
  }
  const totalQuestions = READINESS_QUESTIONS.length;
  const passed = score >= 4;
  return { score, totalQuestions, passed };
}

export function computeLearningReadiness(user: SanitizedUser) {
  const requiredMaterials = REQUIRED_STARTER_GUIDE_IDS.map((id) => {
    const mat = store.db.learningMaterials.find((m) => m.id === id);
    const prog = store.db.learningProgress.find(
      (p) => p.userId === user.id && p.materialId === id
    );
    const completed = prog?.status === 'completed';
    const title = mat?.translations?.en?.title || id;
    return { id, title, completed };
  });

  const requiredGuidesCompleted = requiredMaterials.filter((m) => m.completed).length;
  const requiredGuidesTotal = requiredMaterials.length;
  const requiredGuidesMet =
    requiredGuidesTotal > 0 && requiredGuidesCompleted >= requiredGuidesTotal;

  const profile = store.db.userProfiles.find((p) => p.userId === user.id);
  const assessment = profile?.readinessAssessment || null;
  const assessmentPassed = Boolean(assessment?.passed);
  const assessmentScore = assessment?.score || 0;
  const assessmentTotalQuestions = assessment?.totalQuestions || READINESS_QUESTIONS.length;

  const missingRequirements: string[] = [];
  for (const item of requiredMaterials) {
    if (!item.completed) {
      missingRequirements.push(`Complete foundational guide: "${item.title}"`);
    }
  }
  if (!assessmentPassed) {
    missingRequirements.push(
      `Pass the Practical Readiness Check (${READINESS_QUESTIONS.length} questions, minimum 4/5 required)`
    );
  }

  const isReady = requiredGuidesMet && assessmentPassed;

  return {
    requiredGuideIds: REQUIRED_STARTER_GUIDE_IDS,
    requiredGuideTitles: requiredMaterials,
    requiredGuidesCompleted,
    requiredGuidesTotal,
    requiredGuidesMet,
    assessmentPassed,
    assessmentScore,
    assessmentTotalQuestions,
    assessmentCompletedAt: assessment?.completedAt || null,
    isReady,
    completionMessage: isReady ? READINESS_COMPLETION_MESSAGE : null,
    missingRequirements,
    assessmentQuestions: READINESS_QUESTIONS.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
    })),
  };
}

export function buildLearningCentrePayload(params: {
  user: SanitizedUser;
  languageCode?: LanguageCode;
  includeDrafts?: boolean;
}) {
  const canManage = userCanManageLearning(params.user);
  const visibleMaterials = store.db.learningMaterials.filter((m) =>
    canManage && params.includeDrafts ? true : m.status === 'published'
  );

  const resolved = visibleMaterials
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((m) => resolveMaterialForUser(m, params.user, params.languageCode));

  const publishedItems = resolved.filter((m) => m.status === 'published');
  const completedCount = publishedItems.filter((m) => m.userProgress.status === 'completed').length;
  const inProgressCount = publishedItems.filter((m) => m.userProgress.status === 'in_progress').length;
  const savedCount = resolved.filter((m) => m.userProgress.isSaved).length;
  const overallPercent =
    publishedItems.length > 0 ? Math.round((completedCount / publishedItems.length) * 100) : 0;

  const learningReadiness = computeLearningReadiness(params.user);

  return {
    categories: LEARNING_CATEGORIES,
    materials: resolved,
    canManageContent: canManage,
    learnerStats: {
      totalPublished: publishedItems.length,
      completedCount,
      inProgressCount,
      savedCount,
      overallPercent,
    },
    learningReadiness,
    officialGuidanceNotice: OFFICIAL_GUIDANCE_NOTICE,
  };
}
