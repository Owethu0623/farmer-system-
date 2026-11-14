import { sastDaysAgo } from './saTime.ts';
import {
  calculatePolygonAreaHectares,
  calculatePolygonPerimeterMeters,
  createBoxPolygonFromCentroid,
  pointToWkt,
  polygonToWkt,
} from './spatial.ts';
import {
  AiInsightRecord,
  BusinessPlanScenario,
  ConsultationRequest,
  CropActivity,
  CropRecord,
  CropStockMovement,
  DatabaseSchema,
  ExpertFeedbackRecord,
  ExpertProfile,
  Farm,
  FarmAccessGrant,
  FarmBoundary,
  FarmIncident,
  FarmLocation,
  FarmerWeatherObservation,
  Field,
  LanguageCode,
  LivestockGroup,
  LivestockRecord,
  MixedFarmingEntry,
  Notification,
  OrganisationMembership,
  OrganisationProfile,
  OrganisationProgrammeActivity,
  OrganisationProject,
  OrganisationSpecialistAssignment,
  RoleCode,
  SavedProspectiveLocation,
  SoilReport,
  StockPriceSetting,
  User,
  UserProfile,
  WeatherForecastRecord,
} from './types.ts';

export const DEMO_SEED_VERSION = 2;

export const ALL_DEMO_USER_IDS = new Set([
  'user-prospective-1',
  'user-prospective-demo-2',
  'user-existing-1',
  'user-existing-demo-2',
  'user-existing-ec-3',
  'user-existing-gp-4',
  'user-existing-lp-5',
  'user-existing-mp-6',
  'user-existing-nc-7',
  'user-existing-nw-8',
  'user-expert-1',
  'user-expert-soil-2',
  'user-expert-livestock-3',
  'user-expert-vet-4',
  'user-expert-water-5',
  'user-expert-econ-6',
  'user-expert-pest-7',
  'user-expert-ext-8',
  'user-expert-hort-9',
  'user-org-1',
  'user-org-demo-2',
  'user-admin-1',
]);

export const ALL_DEMO_FARM_IDS = new Set([
  'farm-umgeni-1',
  'farm-mkhambathini-2',
  'farm-bethlehem-demo-3',
  'farm-winelands-demo-4',
  'farm-amatole-demo-5',
  'farm-roodeplaat-demo-6',
  'farm-levubu-demo-7',
  'farm-lowveld-demo-8',
  'farm-upington-demo-9',
  'farm-lichtenburg-demo-10',
]);

function upsertById<T extends { id: string }>(arr: T[], item: T): void {
  if (!arr.some((existing) => existing.id === item.id)) {
    arr.push(item);
  }
}

export function applyDemoSeedFoundation(
  db: DatabaseSchema,
  rolePermissionMap: Record<RoleCode, string[]>,
  hashPasswordFn: (password: string) => { hash: string; salt: string }
): boolean {
  let changed = false;
  const now = new Date().toISOString();
  const demoPw = hashPasswordFn('FieldShift2026!');

  const ensureArray = <K extends keyof DatabaseSchema>(key: K) => {
    if (!Array.isArray(db[key])) {
      (db as unknown as Record<string, unknown>)[key as string] = [];
      changed = true;
    }
  };

  ensureArray('consultationRequests');
  ensureArray('organisationProjects');
  ensureArray('organisationProgrammeActivities');
  ensureArray('organisationSpecialistAssignments');

  const roleIdByCode = new Map(db.roles.map((r) => [r.code, r.id]));

  // 1. Ensure existing demo specialist does NOT falsely claim real SACNASP registration
  for (const ep of db.expertProfiles) {
    if (ALL_DEMO_USER_IDS.has(ep.userId) && ep.isDemonstration !== false) {
      if (
        ep.professionalBodyNumber &&
        ep.professionalBodyNumber.includes('400218/08')
      ) {
        ep.professionalBodyNumber = '';
        ep.verificationStatus = 'demo_unverified';
        ep.regulatedService = true;
        ep.regulatoryBodyName = 'SACNASP / Extension Reference (Demonstration Unverified)';
        ep.verificationNote =
          'DEMONSTRATION DATA — Demonstration specialist profile only. Does not hold real SACNASP registration or statutory accreditation.';
        ep.isDemonstration = true;
        changed = true;
      } else if (ep.isDemonstration === undefined) {
        ep.isDemonstration = true;
        ep.verificationStatus = ep.verificationStatus || 'demo_unverified';
        ep.verificationNote =
          ep.verificationNote ||
          'DEMONSTRATION DATA — Demonstration specialist profile without external regulatory accreditation.';
        changed = true;
      }
    }
  }

  // 2. Additional Demo Users & Profiles across all 9 provinces + all 9 specialist categories + prospective + org
  const demoUsersToEnsure: {
    id: string;
    email: string;
    roleCode: RoleCode;
    lang: LanguageCode;
    fullName: string;
    phone: string;
    province: string;
    district: string;
    expYears: number;
    bio: string;
    prospectiveData?: UserProfile['prospectiveData'];
  }[] = [
    // Prospective farmer #2 (Gauteng & North West candidate)
    {
      id: 'user-prospective-demo-2',
      email: 'lerato.molefe@fieldshift.co.za',
      roleCode: 'prospective_farmer',
      lang: 'tn',
      fullName: 'Lerato Molefe (Demonstration Prospective Farmer)',
      phone: '+27 83 512 9040',
      province: 'Gauteng',
      district: 'West Rand District',
      expYears: 2,
      bio: 'DEMONSTRATION ACCOUNT: Aspiring peri-urban hydroponic & tunnel herb producer evaluating Magaliesburg and Brits plots.',
      prospectiveData: {
        preferredFarmingType: 'Vegetables & Horticulture',
        intendedLandSizeHectares: 1.5,
        landAccessStatus: 'Negotiating 10-year agro-hub lease',
        availableResources: ['Municipal Water Connection', 'Tunnel Shade Net Deposit', 'Agronomist Mentorship'],
        farmingExperience: 'Completed agricultural college short course (2 years)',
        agriculturalInterests: ['Baby Spinach', 'Culinary Herbs', 'High-Density Drip Tunnels'],
        farmingGoals: ['Supply Gauteng formal retail packhouses', 'Validate water quality before lease signature'],
        notes: 'DEMONSTRATION DATA — Prospective tunnel farming feasibility case.',
      },
    },
    // Existing farmers across remaining 6 provinces
    {
      id: 'user-existing-ec-3',
      email: 'sipho.ndlovu@fieldshift.co.za',
      roleCode: 'existing_farmer',
      lang: 'xh',
      fullName: 'Sipho Ndlovu (Demonstration Farmer)',
      phone: '+27 82 440 1982',
      province: 'Eastern Cape',
      district: 'Amathole District',
      expYears: 16,
      bio: 'DEMONSTRATION ACCOUNT: Livestock and lucerne producer in the Amathole highlands, Eastern Cape.',
    },
    {
      id: 'user-existing-gp-4',
      email: 'anele.khumalo@fieldshift.co.za',
      roleCode: 'existing_farmer',
      lang: 'nr',
      fullName: 'Anele Khumalo (Demonstration Farmer)',
      phone: '+27 83 901 3341',
      province: 'Gauteng',
      district: 'City of Tshwane Metro',
      expYears: 7,
      bio: 'DEMONSTRATION ACCOUNT: Emerging commercial drip-irrigated tomato and pepper grower north of Pretoria.',
    },
    {
      id: 'user-existing-lp-5',
      email: 'rendani.mudau@fieldshift.co.za',
      roleCode: 'existing_farmer',
      lang: 've',
      fullName: 'Rendani Mudau (Demonstration Farmer)',
      phone: '+27 82 775 2190',
      province: 'Limpopo',
      district: 'Vhembe District',
      expYears: 12,
      bio: 'DEMONSTRATION ACCOUNT: Subtropical avocado and macadamia grower in the Levubu valley, Limpopo.',
    },
    {
      id: 'user-existing-mp-6',
      email: 'bongani.nkosi@fieldshift.co.za',
      roleCode: 'existing_farmer',
      lang: 'ss',
      fullName: 'Bongani Nkosi (Demonstration Farmer)',
      phone: '+27 79 661 8832',
      province: 'Mpumalanga',
      district: 'Ehlanzeni District',
      expYears: 10,
      bio: 'DEMONSTRATION ACCOUNT: Irrigated sugarcane and Boer goat mixed farmer near Malelane, Mpumalanga.',
    },
    {
      id: 'user-existing-nc-7',
      email: 'pieter.nel@fieldshift.co.za',
      roleCode: 'existing_farmer',
      lang: 'af',
      fullName: 'Pieter Nel (Demonstration Farmer)',
      phone: '+27 82 318 4512',
      province: 'Northern Cape',
      district: 'ZF Mgcawu District',
      expYears: 19,
      bio: 'DEMONSTRATION ACCOUNT: Orange River centre-pivot lucerne and Dorper sheep producer near Upington.',
    },
    {
      id: 'user-existing-nw-8',
      email: 'kagiso.modise@fieldshift.co.za',
      roleCode: 'existing_farmer',
      lang: 'tn',
      fullName: 'Kagiso Modise (Demonstration Farmer)',
      phone: '+27 83 228 6095',
      province: 'North West',
      district: 'Ngaka Modiri Molema District',
      expYears: 9,
      bio: 'DEMONSTRATION ACCOUNT: Dryland sunflower and Drakensberger cattle producer near Lichtenburg, North West.',
    },
    // Specialists covering categories 2..9 (user-expert-1 is agronomist)
    {
      id: 'user-expert-soil-2',
      email: 'nomvula.cele@fieldshift.co.za',
      roleCode: 'agricultural_expert',
      lang: 'zu',
      fullName: 'Nomvula Cele (Demo Soil Scientist)',
      phone: '+27 82 910 2201',
      province: 'KwaZulu-Natal',
      district: 'uMgungundlovu District',
      expYears: 11,
      bio: 'DEMONSTRATION SPECIALIST: Soil classification, acidity correction, and soil-lab interpretation.',
    },
    {
      id: 'user-expert-livestock-3',
      email: 'hendrik.cronje@fieldshift.co.za',
      roleCode: 'agricultural_expert',
      lang: 'af',
      fullName: 'Hendrik Cronje (Demo Livestock Specialist)',
      phone: '+27 82 910 2202',
      province: 'Free State',
      district: 'Thabo Mofutsanyana District',
      expYears: 15,
      bio: 'DEMONSTRATION SPECIALIST: Ruminant nutrition, veld carrying capacity, and herd genetics planning.',
    },
    {
      id: 'user-expert-vet-4',
      email: 'dr.thandi.nkosi@fieldshift.co.za',
      roleCode: 'agricultural_expert',
      lang: 'ss',
      fullName: 'Thandi Nkosi (Demo Veterinary Advisor)',
      phone: '+27 82 910 2203',
      province: 'Mpumalanga',
      district: 'Ehlanzeni District',
      expYears: 12,
      bio: 'DEMONSTRATION SPECIALIST: Herd biosecurity, vaccination scheduling, and tick-borne disease prevention (demonstration profile — non-accredited).',
    },
    {
      id: 'user-expert-water-5',
      email: 'mornay.adams@fieldshift.co.za',
      roleCode: 'agricultural_expert',
      lang: 'af',
      fullName: 'Mornay Adams (Demo Irrigation & Water Specialist)',
      phone: '+27 82 910 2204',
      province: 'Western Cape',
      district: 'Cape Winelands District',
      expYears: 13,
      bio: 'DEMONSTRATION SPECIALIST: Drip/micro-jet scheduling, centre-pivot efficiency, and borehole water budgeting.',
    },
    {
      id: 'user-expert-econ-6',
      email: 'lindiwe.sithole@fieldshift.co.za',
      roleCode: 'agricultural_expert',
      lang: 'nso',
      fullName: 'Lindiwe Sithole (Demo Agricultural Economist)',
      phone: '+27 82 910 2205',
      province: 'Gauteng',
      district: 'City of Tshwane Metro',
      expYears: 10,
      bio: 'DEMONSTRATION SPECIALIST: Enterprise gross-margin budgeting, break-even modelling, and market channel planning.',
    },
    {
      id: 'user-expert-pest-7',
      email: 'johan.pretorius@fieldshift.co.za',
      roleCode: 'agricultural_expert',
      lang: 'af',
      fullName: 'Johan Pretorius (Demo Pest & Disease Specialist)',
      phone: '+27 82 910 2206',
      province: 'Limpopo',
      district: 'Vhembe District',
      expYears: 14,
      bio: 'DEMONSTRATION SPECIALIST: Integrated Pest Management (IPM), scouting thresholds, and orchard phytosanitary hygiene.',
    },
    {
      id: 'user-expert-ext-8',
      email: 'tshilidzi.ramabulana@fieldshift.co.za',
      roleCode: 'agricultural_expert',
      lang: 'ts',
      fullName: 'Tshilidzi Ramabulana (Demo Extension Officer)',
      phone: '+27 82 910 2207',
      province: 'Limpopo',
      district: 'Vhembe District',
      expYears: 9,
      bio: 'DEMONSTRATION SPECIALIST: Community extension, smallholder training days, and seasonal planting readiness.',
    },
    {
      id: 'user-expert-hort-9',
      email: 'claire.marais@fieldshift.co.za',
      roleCode: 'agricultural_expert',
      lang: 'en',
      fullName: 'Claire Marais (Demo Horticultural Specialist)',
      phone: '+27 82 910 2208',
      province: 'Eastern Cape',
      district: 'Amathole District',
      expYears: 11,
      bio: 'DEMONSTRATION SPECIALIST: Protected-tunnel vegetables, deciduous fruit pruning, and cold-chain post-harvest care.',
    },
    // Second Org team member (analyst)
    {
      id: 'user-org-demo-2',
      email: 'siyabonga.mthembu@fieldshift.co.za',
      roleCode: 'organisation_manager',
      lang: 'zu',
      fullName: 'Siyabonga Mthembu (Demo Cooperative Analyst)',
      phone: '+27 79 304 8819',
      province: 'KwaZulu-Natal',
      district: 'uMgungundlovu District',
      expYears: 6,
      bio: 'DEMONSTRATION ACCOUNT: Regional monitoring and evaluation analyst at Lowveld & Midlands Growers Cooperative.',
    },
  ];

  for (const spec of demoUsersToEnsure) {
    const roleId = roleIdByCode.get(spec.roleCode);
    if (!roleId) continue;

    if (!db.users.some((u) => u.id === spec.id)) {
      const u: User = {
        id: spec.id,
        email: spec.email,
        passwordHash: demoPw.hash,
        passwordSalt: demoPw.salt,
        roleId,
        preferredLanguageCode: spec.lang,
        isActive: true,
        isEmailVerified: true,
        onboardingCompleted: true,
        isDemonstration: true,
        activationToken: null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      };
      db.users.push(u);

      const p: UserProfile = {
        id: `prof-${spec.id}`,
        userId: spec.id,
        fullName: spec.fullName,
        phoneNumber: spec.phone,
        province: spec.province,
        district: spec.district,
        farmerExperienceYears: spec.expYears,
        accessibilityLargeText: false,
        accessibilityAudioGuidance: false,
        accessibilityVoiceInput: false,
        prospectiveData: spec.prospectiveData || null,
        bio: spec.bio,
        createdAt: now,
        updatedAt: now,
      };
      db.userProfiles.push(p);

      const perms = rolePermissionMap[spec.roleCode] || [];
      for (const key of perms) {
        db.userPermissions.push({
          id: `perm-${spec.id}-${key}`,
          roleId,
          userId: spec.id,
          permissionKey: key,
          isAllowed: true,
          createdAt: now,
        });
      }
      changed = true;
    }
  }

  // 3. Seed all 9 Specialist Profiles clearly marked as DEMONSTRATION DATA
  const demoExpertProfiles: ExpertProfile[] = [
    {
      userId: 'user-expert-soil-2',
      specialisation: 'soil_specialist',
      secondarySpecialisations: ['agronomist'],
      qualifications: 'M.Sc. Soil Science (Demonstration Academic Background)',
      professionalBodyNumber: '',
      verificationStatus: 'demo_unverified',
      regulatedService: true,
      regulatoryBodyName: 'SACNASP Soil Science Practice (Demonstration Unverified)',
      verificationNote:
        'DEMONSTRATION DATA — Simulated soil scientist profile. Does not represent verified SACNASP registration.',
      isDemonstration: true,
      yearsExperience: 11,
      provincesServed: ['KwaZulu-Natal', 'Eastern Cape', 'Mpumalanga'],
      languagesSpoken: ['zu', 'en', 'xh'],
      bio: 'Advises demonstration growers on interpreting accredited South African soil laboratory reports and lime/phosphorus corrections.',
      availabilityStatus: 'available',
      updatedAt: now,
    },
    {
      userId: 'user-expert-livestock-3',
      specialisation: 'livestock_specialist',
      secondarySpecialisations: ['extension_officer'],
      qualifications: 'M.Sc. Animal Production (Demonstration Academic Background)',
      professionalBodyNumber: '',
      verificationStatus: 'demo_unverified',
      regulatedService: false,
      regulatoryBodyName: 'Animal Production Advisory (Demonstration Unverified)',
      verificationNote:
        'DEMONSTRATION DATA — Simulated livestock specialist profile without real accreditation.',
      isDemonstration: true,
      yearsExperience: 15,
      provincesServed: ['Free State', 'Northern Cape', 'North West', 'Eastern Cape'],
      languagesSpoken: ['af', 'en', 'st'],
      bio: 'Specialises in extensive beef, Dorper sheep, and Dohne Merino rotational veld stocking plans.',
      availabilityStatus: 'available',
      updatedAt: now,
    },
    {
      userId: 'user-expert-vet-4',
      specialisation: 'veterinarian',
      secondarySpecialisations: ['livestock_specialist'],
      qualifications: 'B.V.Sc. Veterinary Science Reference (Demonstration Profile Only)',
      professionalBodyNumber: '',
      verificationStatus: 'demo_unverified',
      regulatedService: true,
      regulatoryBodyName: 'South African Veterinary Council (SAVC) — Regulated Profession',
      verificationNote:
        'DEMONSTRATION DATA — Veterinarians provide statutory regulated clinical services in South Africa. This demo account is NOT SAVC-registered and must not be used for real diagnosis or prescriptions.',
      isDemonstration: true,
      yearsExperience: 12,
      provincesServed: ['Mpumalanga', 'KwaZulu-Natal', 'Limpopo'],
      languagesSpoken: ['ss', 'zu', 'en'],
      bio: 'Supports demonstration herd health calendars, dipping records, and biosecurity checklists.',
      availabilityStatus: 'limited',
      updatedAt: now,
    },
    {
      userId: 'user-expert-water-5',
      specialisation: 'irrigation_water_specialist',
      secondarySpecialisations: ['horticultural_specialist'],
      qualifications: 'B.Eng. Agricultural Water Engineering Reference (Demonstration Profile)',
      professionalBodyNumber: '',
      verificationStatus: 'demo_unverified',
      regulatedService: true,
      regulatoryBodyName: 'ECSA / SABI Irrigation Design Reference (Demonstration Unverified)',
      verificationNote:
        'DEMONSTRATION DATA — Simulated irrigation specialist profile without real statutory registration.',
      isDemonstration: true,
      yearsExperience: 13,
      provincesServed: ['Western Cape', 'Northern Cape', 'Limpopo'],
      languagesSpoken: ['af', 'en'],
      bio: 'Advises on drip scheduling, centre-pivot ET0 balancing, and water storage resilience.',
      availabilityStatus: 'available',
      updatedAt: now,
    },
    {
      userId: 'user-expert-econ-6',
      specialisation: 'agricultural_economist',
      secondarySpecialisations: ['extension_officer'],
      qualifications: 'M.Com. Agricultural Economics Reference (Demonstration Profile)',
      professionalBodyNumber: '',
      verificationStatus: 'demo_unverified',
      regulatedService: false,
      regulatoryBodyName: 'Agricultural Business Advisory (Demonstration Unverified)',
      verificationNote:
        'DEMONSTRATION DATA — Simulated agricultural economist profile. Financial projections are planning estimates only.',
      isDemonstration: true,
      yearsExperience: 10,
      provincesServed: ['Gauteng', 'Free State', 'North West', 'KwaZulu-Natal'],
      languagesSpoken: ['nso', 'en', 'tn', 'st'],
      bio: 'Supports startup feasibility stress-testing, input cost benchmarking, and cooperative market readiness.',
      availabilityStatus: 'available',
      updatedAt: now,
    },
    {
      userId: 'user-expert-pest-7',
      specialisation: 'pest_disease_specialist',
      secondarySpecialisations: ['agronomist'],
      qualifications: 'M.Sc. Plant Pathology & Entomology Reference (Demonstration Profile)',
      professionalBodyNumber: '',
      verificationStatus: 'demo_unverified',
      regulatedService: true,
      regulatoryBodyName: 'Act 36 of 1947 Pest Control Reference (Demonstration Unverified)',
      verificationNote:
        'DEMONSTRATION DATA — Simulated IPM specialist. Always verify registered Act 36 labels and licensed pest control operators in practice.',
      isDemonstration: true,
      yearsExperience: 14,
      provincesServed: ['Limpopo', 'Mpumalanga', 'Gauteng', 'Western Cape'],
      languagesSpoken: ['af', 'en'],
      bio: 'Reviews pest scouting records, visual plant stress symptoms, and integrated pest management plans.',
      availabilityStatus: 'available',
      updatedAt: now,
    },
    {
      userId: 'user-expert-ext-8',
      specialisation: 'extension_officer',
      secondarySpecialisations: ['agronomist', 'livestock_specialist'],
      qualifications: 'B.Agric. Extension & Rural Development Reference (Demonstration Profile)',
      professionalBodyNumber: '',
      verificationStatus: 'demo_unverified',
      regulatedService: false,
      regulatoryBodyName: 'Agricultural Extension Support (Demonstration Unverified)',
      verificationNote:
        'DEMONSTRATION DATA — Simulated extension officer profile.',
      isDemonstration: true,
      yearsExperience: 9,
      provincesServed: ['Limpopo', 'Eastern Cape', 'KwaZulu-Natal', 'Mpumalanga'],
      languagesSpoken: ['ts', 've', 'nso', 'en'],
      bio: 'Coordinates farmer field days, seasonal readiness workshops, and multilingual onboarding support.',
      availabilityStatus: 'available',
      updatedAt: now,
    },
    {
      userId: 'user-expert-hort-9',
      specialisation: 'horticultural_specialist',
      secondarySpecialisations: ['irrigation_water_specialist'],
      qualifications: 'M.Sc. Horticulture Reference (Demonstration Profile)',
      professionalBodyNumber: '',
      verificationStatus: 'demo_unverified',
      regulatedService: false,
      regulatoryBodyName: 'Horticultural Production Advisory (Demonstration Unverified)',
      verificationNote:
        'DEMONSTRATION DATA — Simulated horticultural specialist profile.',
      isDemonstration: true,
      yearsExperience: 11,
      provincesServed: ['Eastern Cape', 'Western Cape', 'Gauteng', 'KwaZulu-Natal'],
      languagesSpoken: ['en', 'xh', 'af'],
      bio: 'Advises on high-value vegetables, deciduous stone fruit, citrus pruning, and cold-chain handling.',
      availabilityStatus: 'available',
      updatedAt: now,
    },
  ];

  for (const ep of demoExpertProfiles) {
    if (!db.expertProfiles.some((x) => x.userId === ep.userId)) {
      db.expertProfiles.push(ep);
      changed = true;
    }
  }

  // 4. Add remaining 6 provinces' Farms, Locations (with description & confirmed=true), Boundaries & Fields
  const extraDemoFarms: {
    farm: Farm;
    location: Omit<FarmLocation, 'centroidWkt'>;
    fields: Omit<Field, 'fieldWkt' | 'geojson' | 'createdAt' | 'updatedAt'>[];
  }[] = [
    {
      farm: {
        id: 'farm-amatole-demo-5',
        ownerId: 'user-existing-ec-3',
        name: 'Amathole Nguni & Woolveld Demo Station',
        farmingActivities: ['Beef & Nguni Cattle', 'Goats & Sheep', 'Mixed Crop & Livestock'],
        farmSizeHectares: 64,
        yearsOfExperience: 16,
        waterAvailability: 'Mountain Stream & Earth Stock Dams',
        existingCrops: ['Dryland Lucerne Fodder'],
        existingLivestock: ['Dohne Merino Sheep (95 head)', 'Nguni/Bonsmara Cross Cattle (36 head)'],
        status: 'active',
        isDemonstration: true,
        createdAt: now,
        updatedAt: now,
      },
      location: {
        id: 'loc-5-demo',
        farmId: 'farm-amatole-demo-5',
        province: 'Eastern Cape',
        districtMunicipality: 'Amathole District',
        localMunicipality: 'Amahlathi',
        townOrVillage: 'Stutterheim / Kubusi Valley',
        locationDescription: 'Highveld sweet-sourveld foothills 6 km west of Stutterheim along R352 gravel access.',
        locationConfirmed: true,
        latitude: -32.568,
        longitude: 27.419,
        locationSource: 'manual_map_pin',
        gpsLatitude: -32.568,
        gpsLongitude: 27.419,
        gpsAccuracyMeters: 12,
        gpsCapturedAt: now,
        elevationMeters: 865,
      },
      fields: [
        {
          id: 'fld-7-demo',
          farmId: 'farm-amatole-demo-5',
          name: 'Kubusi Grazing Camp A',
          farmingTypeId: 'ft-smallstock',
          cropOrLivestock: 'Dohne Merino Sheep & Beef Camp',
          areaHectares: 46,
          soilType: 'Dolerite Clay Loam Veld',
          irrigationType: 'Natural Stock Dam & Trough',
          status: 'active',
          notes: '4-paddock rotational resting camp for winter lambing.',
        },
        {
          id: 'fld-8-demo',
          farmId: 'farm-amatole-demo-5',
          name: 'Lower Valley Lucerne Hay Block',
          farmingTypeId: 'ft-mixed',
          cropOrLivestock: 'Dryland Lucerne Fodder',
          areaHectares: 18,
          soilType: 'Alluvial Loam',
          irrigationType: 'Rain-fed Valley Bottom',
          status: 'active',
          notes: 'Baled for winter supplementary ewe feeding.',
        },
      ],
    },
    {
      farm: {
        id: 'farm-roodeplaat-demo-6',
        ownerId: 'user-existing-gp-4',
        name: 'Roodeplaat Peri-Urban Vegetable Demo Hub',
        farmingActivities: ['Vegetables & Horticulture'],
        farmSizeHectares: 6.5,
        yearsOfExperience: 7,
        waterAvailability: 'Borehole & Canal Water Allocation',
        existingCrops: ['Roma Tomatoes', 'Green Bell Peppers'],
        existingLivestock: [],
        status: 'active',
        isDemonstration: true,
        createdAt: now,
        updatedAt: now,
      },
      location: {
        id: 'loc-6-demo',
        farmId: 'farm-roodeplaat-demo-6',
        province: 'Gauteng',
        districtMunicipality: 'City of Tshwane Metro',
        localMunicipality: 'Tshwane North',
        townOrVillage: 'Kameeldrift / Roodeplaat',
        locationDescription: 'Plot 14 Roodeplaat agricultural belt north-east of Pretoria.',
        locationConfirmed: true,
        latitude: -25.619,
        longitude: 28.362,
        locationSource: 'gps',
        gpsLatitude: -25.619,
        gpsLongitude: 28.362,
        gpsAccuracyMeters: 8,
        gpsCapturedAt: now,
        elevationMeters: 1218,
      },
      fields: [
        {
          id: 'fld-9-demo',
          farmId: 'farm-roodeplaat-demo-6',
          name: 'Shade-Net Tomato Block 1',
          farmingTypeId: 'ft-veg',
          cropOrLivestock: 'Roma & Jam Tomatoes',
          areaHectares: 3.5,
          soilType: 'Red Sandy Clay Loam',
          irrigationType: 'Pressure-Compensated Drip + Fertigation',
          status: 'active',
          notes: 'Treellised beds supplying Tshwane Fresh Produce Market.',
        },
        {
          id: 'fld-10-demo',
          farmId: 'farm-roodeplaat-demo-6',
          name: 'Open Drip Pepper Block 2',
          farmingTypeId: 'ft-veg',
          cropOrLivestock: 'Green Bell Peppers',
          areaHectares: 3.0,
          soilType: 'Sandy Loam',
          irrigationType: 'Drip Line with Mulch Film',
          status: 'active',
          notes: 'Weekly IPM scouting for thrips and whitefly.',
        },
      ],
    },
    {
      farm: {
        id: 'farm-levubu-demo-7',
        ownerId: 'user-existing-lp-5',
        name: 'Levubu Subtropical Orchard Demo Farm',
        farmingActivities: ['Citrus & Subtropical Fruit'],
        farmSizeHectares: 18.0,
        yearsOfExperience: 12,
        waterAvailability: 'Weir Gravity Canal & Micro-Sprinkler',
        existingCrops: ['Hass Avocados', 'Beaumont Macadamias'],
        existingLivestock: [],
        status: 'active',
        isDemonstration: true,
        createdAt: now,
        updatedAt: now,
      },
      location: {
        id: 'loc-7-demo',
        farmId: 'farm-levubu-demo-7',
        province: 'Limpopo',
        districtMunicipality: 'Vhembe District',
        localMunicipality: 'Thulamela',
        townOrVillage: 'Levubu / Piesanghoek',
        locationDescription: 'Soutpansberg southern foothills irrigated avocado & macadamia terrace.',
        locationConfirmed: true,
        latitude: -23.089,
        longitude: 30.281,
        locationSource: 'manual_map_pin',
        gpsLatitude: null,
        gpsLongitude: null,
        gpsAccuracyMeters: null,
        gpsCapturedAt: null,
        elevationMeters: 745,
      },
      fields: [
        {
          id: 'fld-11-demo',
          farmId: 'farm-levubu-demo-7',
          name: 'South Slope Hass Orchard',
          farmingTypeId: 'ft-citrus',
          cropOrLivestock: 'Hass Avocados (Mature Trees)',
          areaHectares: 9.5,
          soilType: 'Deep Red Ferralsol Clay Loam',
          irrigationType: 'Micro-sprinkler Under-tree',
          status: 'active',
          notes: 'Phytophthora trunk management and boron foliar nutrition applied.',
        },
        {
          id: 'fld-12-demo',
          farmId: 'farm-levubu-demo-7',
          name: 'East Terrace Macadamia Block',
          farmingTypeId: 'ft-citrus',
          cropOrLivestock: 'Beaumont Macadamias',
          areaHectares: 8.5,
          soilType: 'Well-Drained Hutton Loam',
          irrigationType: 'Micro-jet Orchard System',
          status: 'active',
          notes: 'Nut-borer trap monitoring active.',
        },
      ],
    },
    {
      farm: {
        id: 'farm-lowveld-demo-8',
        ownerId: 'user-existing-mp-6',
        name: 'Onderberg Irrigated Cane & Goat Demo Unit',
        farmingActivities: ['Maize & Dryland Grain', 'Goats & Sheep', 'Mixed Crop & Livestock'],
        farmSizeHectares: 32.0,
        yearsOfExperience: 10,
        waterAvailability: 'Komati River Irrigation Board Pump',
        existingCrops: ['Irrigated Sugarcane'],
        existingLivestock: ['Improved Boer Goats (48 head)'],
        status: 'active',
        isDemonstration: true,
        createdAt: now,
        updatedAt: now,
      },
      location: {
        id: 'loc-8-demo',
        farmId: 'farm-lowveld-demo-8',
        province: 'Mpumalanga',
        districtMunicipality: 'Ehlanzeni District',
        localMunicipality: 'Nkomazi',
        townOrVillage: 'Malelane / Jeppes Reef',
        locationDescription: 'Subtropical Lowveld irrigated cane plot adjacent to Nkomazi smallholder corridor.',
        locationConfirmed: true,
        latitude: -25.495,
        longitude: 31.518,
        locationSource: 'geocoded_search',
        gpsLatitude: null,
        gpsLongitude: null,
        gpsAccuracyMeters: null,
        gpsCapturedAt: null,
        elevationMeters: 312,
      },
      fields: [
        {
          id: 'fld-13-demo',
          farmId: 'farm-lowveld-demo-8',
          name: 'Block A Irrigated Sugarcane',
          farmingTypeId: 'ft-mixed',
          cropOrLivestock: 'Sugarcane (N41)',
          areaHectares: 22.0,
          soilType: 'Basaltic Clay Loam',
          irrigationType: 'Subsurface & Dragline Sprinkler',
          status: 'active',
          notes: 'Ratoon 3 crop managed with scheduled dry-off before mill delivery.',
        },
        {
          id: 'fld-14-demo',
          farmId: 'farm-lowveld-demo-8',
          name: 'Bushveld Goat Browse Camp',
          farmingTypeId: 'ft-smallstock',
          cropOrLivestock: 'Boer Goats (48 head)',
          areaHectares: 10.0,
          soilType: 'Granitic Bushveld Sandy Loam',
          irrigationType: 'Canal Trough Supply',
          status: 'active',
          notes: 'Acacia browse + cane tops chopped for dry-season roughage.',
        },
      ],
    },
    {
      farm: {
        id: 'farm-upington-demo-9',
        ownerId: 'user-existing-nc-7',
        name: 'Gariep Pivot Lucerne & Dorper Demo Farm',
        farmingActivities: ['Mixed Crop & Livestock', 'Goats & Sheep'],
        farmSizeHectares: 48.0,
        yearsOfExperience: 19,
        waterAvailability: 'Orange River Canal Irrigation Quota',
        existingCrops: ['Irrigated Lucerne'],
        existingLivestock: ['Dorper Sheep Flock (140 head)'],
        status: 'active',
        isDemonstration: true,
        createdAt: now,
        updatedAt: now,
      },
      location: {
        id: 'loc-9-demo',
        farmId: 'farm-upington-demo-9',
        province: 'Northern Cape',
        districtMunicipality: 'ZF Mgcawu District',
        localMunicipality: 'Dawid Kruiper',
        townOrVillage: 'Upington / Kanoneiland',
        locationDescription: 'Alluvial Orange River canal irrigation plot 12 km south-west of Upington.',
        locationConfirmed: true,
        latitude: -28.545,
        longitude: 21.148,
        locationSource: 'manual_map_pin',
        gpsLatitude: null,
        gpsLongitude: null,
        gpsAccuracyMeters: null,
        gpsCapturedAt: null,
        elevationMeters: 792,
      },
      fields: [
        {
          id: 'fld-15-demo',
          farmId: 'farm-upington-demo-9',
          name: 'Centre Pivot 1 Lucerne',
          farmingTypeId: 'ft-mixed',
          cropOrLivestock: 'SA Standard Lucerne',
          areaHectares: 24.0,
          soilType: 'Alluvial Silt Loam',
          irrigationType: 'Centre Pivot Irrigation',
          status: 'active',
          notes: '6-cut seasonal hay schedule.',
        },
        {
          id: 'fld-16-demo',
          farmId: 'farm-upington-demo-9',
          name: 'Karoo Shrub Dorper Camp',
          farmingTypeId: 'ft-smallstock',
          cropOrLivestock: 'Dorper Sheep (140 head)',
          areaHectares: 24.0,
          soilType: 'Arid Sandy Karoo Soil',
          irrigationType: 'Solar Borehole & Canal Pipeline',
          status: 'active',
          notes: 'Low-rainfall hardy mutton flock with mineral supplementation.',
        },
      ],
    },
    {
      farm: {
        id: 'farm-lichtenburg-demo-10',
        ownerId: 'user-existing-nw-8',
        name: 'Ditsobotla Sunflower & Beef Demo Farm',
        farmingActivities: ['Maize & Dryland Grain', 'Beef & Nguni Cattle'],
        farmSizeHectares: 55.0,
        yearsOfExperience: 9,
        waterAvailability: 'Summer Dryland + Dolomitic Borehole',
        existingCrops: ['High-Oleic Sunflower'],
        existingLivestock: ['Drakensberger Cattle (38 head)'],
        status: 'active',
        isDemonstration: true,
        createdAt: now,
        updatedAt: now,
      },
      location: {
        id: 'loc-10-demo',
        farmId: 'farm-lichtenburg-demo-10',
        province: 'North West',
        districtMunicipality: 'Ngaka Modiri Molema District',
        localMunicipality: 'Ditsobotla',
        townOrVillage: 'Lichtenburg / Coligny Road',
        locationDescription: 'Western Highveld deep sandy loam grain & cattle unit east of Lichtenburg.',
        locationConfirmed: true,
        latitude: -26.152,
        longitude: 26.178,
        locationSource: 'manual_map_pin',
        gpsLatitude: null,
        gpsLongitude: null,
        gpsAccuracyMeters: null,
        gpsCapturedAt: null,
        elevationMeters: 1478,
      },
      fields: [
        {
          id: 'fld-17-demo',
          farmId: 'farm-lichtenburg-demo-10',
          name: 'West Dryland Sunflower Block',
          farmingTypeId: 'ft-maize',
          cropOrLivestock: 'Oilseed Sunflower',
          areaHectares: 30.0,
          soilType: 'Deep Hutton Sandy Loam',
          irrigationType: 'Dryland Summer Rainfall',
          status: 'active',
          notes: 'Planted into zero-till maize residue for moisture conservation.',
        },
        {
          id: 'fld-18-demo',
          farmId: 'farm-lichtenburg-demo-10',
          name: 'Dolomite Veld Cattle Camp',
          farmingTypeId: 'ft-cattle',
          cropOrLivestock: 'Drakensberger Cattle (38 head)',
          areaHectares: 25.0,
          soilType: 'Dolomitic Grassland',
          irrigationType: 'Windpump & Dolomite Borehole',
          status: 'active',
          notes: 'Phosphate-salt lick supplemented year-round.',
        },
      ],
    },
  ];

  // Confirm location descriptions on initial 4 demo farms too
  for (const loc of db.farmLocations) {
    if (loc.locationConfirmed === undefined) {
      loc.locationConfirmed = true;
      changed = true;
    }
    if (!loc.locationDescription) {
      loc.locationDescription = `${loc.townOrVillage}, ${loc.localMunicipality} (${loc.province})`;
      changed = true;
    }
  }

  for (const entry of extraDemoFarms) {
    if (!db.farms.some((f) => f.id === entry.farm.id)) {
      db.farms.push(entry.farm);
      changed = true;
    }
    if (!db.farmLocations.some((l) => l.farmId === entry.farm.id)) {
      const fullLoc: FarmLocation = {
        ...entry.location,
        centroidWkt: pointToWkt(entry.location.latitude, entry.location.longitude),
      };
      db.farmLocations.push(fullLoc);
      changed = true;
    }
    if (!db.farmBoundaries.some((b) => b.farmId === entry.farm.id)) {
      const poly = createBoxPolygonFromCentroid(
        entry.location.latitude,
        entry.location.longitude,
        entry.farm.farmSizeHectares
      );
      const bnd: FarmBoundary = {
        id: `bnd-${entry.farm.id}`,
        farmId: entry.farm.id,
        boundaryWkt: polygonToWkt(poly),
        geojson: poly,
        calculatedAreaHectares: calculatePolygonAreaHectares(poly),
        perimeterMeters: calculatePolygonPerimeterMeters(poly),
        source: 'drawn_polygon',
        updatedAt: now,
      };
      db.farmBoundaries.push(bnd);
      changed = true;
    }
    entry.fields.forEach((f, idx) => {
      if (!db.fields.some((existing) => existing.id === f.id)) {
        const offsetLat = idx === 0 ? 0.0012 : -0.0012;
        const offsetLng = idx === 0 ? -0.0012 : 0.0012;
        const fieldPoly = createBoxPolygonFromCentroid(
          entry.location.latitude + offsetLat,
          entry.location.longitude + offsetLng,
          f.areaHectares
        );
        db.fields.push({
          ...f,
          fieldWkt: polygonToWkt(fieldPoly),
          geojson: fieldPoly,
          createdAt: now,
          updatedAt: now,
        });
        changed = true;
      }
    });
  }

  // 5. Connected Crops, Crop Activities, Stock Price Settings & Stock Movements for ALL demo farms
  const additionalCrops: CropRecord[] = [
    // Free State (farm-bethlehem-demo-3)
    {
      id: 'crop-beth-maize-5',
      farmId: 'farm-bethlehem-demo-3',
      fieldId: 'fld-5-demo',
      ownerId: 'user-existing-demo-2',
      cropName: 'White Maize',
      cropVariety: 'PAN 5R-591R',
      plantingDate: '2026-10-12',
      plantingQuantity: 760000,
      damagedPlants: 18000,
      cultivatedAreaHectares: 20,
      soilInformation: 'Avalon Sandy Loam · pH 5.8 · Pre-plant NPK',
      irrigationMethod: 'Dryland Summer Rainfall',
      fertiliserInformation: '3:2:1 (25) + Zn at planting + LAN side-dress',
      expectedHarvestingDate: '2027-04-20',
      growthStage: 'vegetative',
      harvestedQuantityKg: 0,
      estimatedValueZar: 412000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'crop-beth-soya-6',
      farmId: 'farm-bethlehem-demo-3',
      fieldId: 'fld-5-demo',
      ownerId: 'user-existing-demo-2',
      cropName: 'Soybeans',
      cropVariety: 'DM 5953 RSF',
      plantingDate: '2026-10-25',
      plantingQuantity: 3600000,
      damagedPlants: 45000,
      cultivatedAreaHectares: 12,
      soilInformation: 'Avalon Sandy Loam · Inoculated Bradyrhizobium',
      irrigationMethod: 'Dryland Summer Rainfall',
      fertiliserInformation: 'MAP starter + Molybdenum seed treatment',
      expectedHarvestingDate: '2027-03-28',
      growthStage: 'germination',
      harvestedQuantityKg: 0,
      estimatedValueZar: 215000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    // Western Cape (farm-winelands-demo-4)
    {
      id: 'crop-wc-plums-7',
      farmId: 'farm-winelands-demo-4',
      fieldId: 'fld-6-demo',
      ownerId: 'user-existing-demo-2',
      cropName: 'African Delight Plums',
      cropVariety: 'African Delight',
      plantingDate: '2022-07-10',
      plantingQuantity: 6200,
      damagedPlants: 80,
      cultivatedAreaHectares: 8,
      soilInformation: 'Alluvial Loam · pH 6.3 · Winter cover crop',
      irrigationMethod: 'Scheme Drip Irrigation',
      fertiliserInformation: 'Calcium nitrate + potassium sulphate fertigation',
      expectedHarvestingDate: '2027-02-15',
      growthStage: 'fruiting',
      harvestedQuantityKg: 24500,
      estimatedValueZar: 441000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    // Eastern Cape (farm-amatole-demo-5)
    {
      id: 'crop-ec-lucerne-8',
      farmId: 'farm-amatole-demo-5',
      fieldId: 'fld-8-demo',
      ownerId: 'user-existing-ec-3',
      cropName: 'Dryland Lucerne',
      cropVariety: 'WL 414',
      plantingDate: '2025-04-15',
      plantingQuantity: 18000,
      damagedPlants: 400,
      cultivatedAreaHectares: 18,
      soilInformation: 'Alluvial Loam · pH 6.4 · Calcitic lime incorporated',
      irrigationMethod: 'Rain-fed Valley Bottom',
      fertiliserInformation: 'Superphosphate annual top-dress',
      expectedHarvestingDate: '2027-01-30',
      growthStage: 'mature',
      harvestedQuantityKg: 32000,
      estimatedValueZar: 112000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    // Gauteng (farm-roodeplaat-demo-6)
    {
      id: 'crop-gp-tomatoes-9',
      farmId: 'farm-roodeplaat-demo-6',
      fieldId: 'fld-9-demo',
      ownerId: 'user-existing-gp-4',
      cropName: 'Roma Tomatoes',
      cropVariety: 'Star 9037',
      plantingDate: '2026-08-20',
      plantingQuantity: 56000,
      damagedPlants: 1400,
      cultivatedAreaHectares: 3.5,
      soilInformation: 'Red Sandy Clay Loam · pH 6.4 · Composted beds',
      irrigationMethod: 'Pressure-Compensated Drip + Fertigation',
      fertiliserInformation: 'Soluble NPK + Calcium Nitrate weekly fertigation',
      expectedHarvestingDate: '2026-12-18',
      growthStage: 'fruiting',
      harvestedQuantityKg: 18600,
      estimatedValueZar: 223200,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    // Limpopo (farm-levubu-demo-7)
    {
      id: 'crop-lp-avos-10',
      farmId: 'farm-levubu-demo-7',
      fieldId: 'fld-11-demo',
      ownerId: 'user-existing-lp-5',
      cropName: 'Hass Avocados',
      cropVariety: 'Hass on Duke 7',
      plantingDate: '2021-09-01',
      plantingQuantity: 2850,
      damagedPlants: 32,
      cultivatedAreaHectares: 9.5,
      soilInformation: 'Deep Red Ferralsol Clay Loam · pH 5.9',
      irrigationMethod: 'Micro-sprinkler Under-tree',
      fertiliserInformation: 'Zinc, Boron + Potassium Sulphate orchard schedule',
      expectedHarvestingDate: '2027-05-15',
      growthStage: 'fruiting',
      harvestedQuantityKg: 38400,
      estimatedValueZar: 844800,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    // Mpumalanga (farm-lowveld-demo-8)
    {
      id: 'crop-mp-cane-11',
      farmId: 'farm-lowveld-demo-8',
      fieldId: 'fld-13-demo',
      ownerId: 'user-existing-mp-6',
      cropName: 'Irrigated Sugarcane',
      cropVariety: 'N41',
      plantingDate: '2025-09-10',
      plantingQuantity: 220000,
      damagedPlants: 3200,
      cultivatedAreaHectares: 22.0,
      soilInformation: 'Basaltic Clay Loam · pH 6.6',
      irrigationMethod: 'Dragline Sprinkler',
      fertiliserInformation: '5:1:5 (46) granular split application',
      expectedHarvestingDate: '2027-06-10',
      growthStage: 'vegetative',
      harvestedQuantityKg: 145000,
      estimatedValueZar: 174000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    // Northern Cape (farm-upington-demo-9)
    {
      id: 'crop-nc-lucerne-12',
      farmId: 'farm-upington-demo-9',
      fieldId: 'fld-15-demo',
      ownerId: 'user-existing-nc-7',
      cropName: 'Irrigated Lucerne',
      cropVariety: 'SA Standard',
      plantingDate: '2025-03-10',
      plantingQuantity: 48000,
      damagedPlants: 600,
      cultivatedAreaHectares: 24.0,
      soilInformation: 'Alluvial Silt Loam · pH 7.1',
      irrigationMethod: 'Centre Pivot Irrigation',
      fertiliserInformation: 'Phosphate & Gypsum maintenance dressing',
      expectedHarvestingDate: '2026-12-22',
      growthStage: 'mature',
      harvestedQuantityKg: 68000,
      estimatedValueZar: 258400,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    // North West (farm-lichtenburg-demo-10)
    {
      id: 'crop-nw-sunflower-13',
      farmId: 'farm-lichtenburg-demo-10',
      fieldId: 'fld-17-demo',
      ownerId: 'user-existing-nw-8',
      cropName: 'Oilseed Sunflower',
      cropVariety: 'PAN 7160 CLP',
      plantingDate: '2026-11-01',
      plantingQuantity: 1050000,
      damagedPlants: 21000,
      cultivatedAreaHectares: 30.0,
      soilInformation: 'Deep Hutton Sandy Loam · pH 6.0',
      irrigationMethod: 'Dryland Summer Rainfall',
      fertiliserInformation: '2:3:4 (30) + Boron at planting',
      expectedHarvestingDate: '2027-04-05',
      growthStage: 'germination',
      harvestedQuantityKg: 0,
      estimatedValueZar: 318000,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const c of additionalCrops) {
    if (!db.crops.some((x) => x.id === c.id)) {
      db.crops.push(c);
      changed = true;
    }
  }

  // Ensure every additional crop has StockPriceSettings + reconciled CropStockMovements + CropActivities
  const cropFinanceSpecs: {
    crop: CropRecord;
    plantUnitPrice: number;
    harvestUnitPrice: number;
    plantUnitLabel: string;
    soldKg: number;
    actExpenseZar: number;
    actNote: string;
  }[] = [
    {
      crop: additionalCrops[0],
      plantUnitPrice: 0.56,
      harvestUnitPrice: 4.15,
      plantUnitLabel: 'plant',
      soldKg: 0,
      actExpenseZar: 38400,
      actNote: 'Highveld planter calibration, 3:2:1 NPK starter and LAN allocation.',
    },
    {
      crop: additionalCrops[1],
      plantUnitPrice: 0.06,
      harvestUnitPrice: 8.6,
      plantUnitLabel: 'plant',
      soldKg: 0,
      actExpenseZar: 21900,
      actNote: 'Bradyrhizobium inoculant + MAP starter application.',
    },
    {
      crop: additionalCrops[2],
      plantUnitPrice: 72.0,
      harvestUnitPrice: 18.0,
      plantUnitLabel: 'tree',
      soldKg: 21000,
      actExpenseZar: 31500,
      actNote: 'Fruit thinning, drip fertigation and packhouse grade-out.',
    },
    {
      crop: additionalCrops[3],
      plantUnitPrice: 5.5,
      harvestUnitPrice: 3.5,
      plantUnitLabel: 'crown',
      soldKg: 14000,
      actExpenseZar: 16200,
      actNote: 'Spring cut baling & 18,000 kg retained on-farm as winter sheep hay.',
    },
    {
      crop: additionalCrops[4],
      plantUnitPrice: 3.9,
      harvestUnitPrice: 12.0,
      plantUnitLabel: 'plant',
      soldKg: 16200,
      actExpenseZar: 24800,
      actNote: 'Calcium nitrate fertigation & Tshwane market crates dispatched.',
    },
    {
      crop: additionalCrops[5],
      plantUnitPrice: 290.0,
      harvestUnitPrice: 22.0,
      plantUnitLabel: 'tree',
      soldKg: 34000,
      actExpenseZar: 44600,
      actNote: 'Zinc/boron foliar feed & export packhouse delivery.',
    },
    {
      crop: additionalCrops[6],
      plantUnitPrice: 0.85,
      harvestUnitPrice: 1.2,
      plantUnitLabel: 'stool',
      soldKg: 145000,
      actExpenseZar: 52000,
      actNote: 'Previous mill cane delivery & ratoon 5:1:5 fertiliser dressing.',
    },
    {
      crop: additionalCrops[7],
      plantUnitPrice: 5.2,
      harvestUnitPrice: 3.8,
      plantUnitLabel: 'crown',
      soldKg: 52000,
      actExpenseZar: 29400,
      actNote: 'Centre-pivot gypsum dressing & 16,000 kg retained for Dorper ewes.',
    },
    {
      crop: additionalCrops[8],
      plantUnitPrice: 0.31,
      harvestUnitPrice: 9.2,
      plantUnitLabel: 'plant',
      soldKg: 0,
      actExpenseZar: 34500,
      actNote: 'Zero-till planter pass + boron starter dressing.',
    },
  ];

  for (const spec of cropFinanceSpecs) {
    const { crop } = spec;
    const pSetId = `sp-plant-${crop.id}`;
    if (!db.stockPriceSettings.some((s) => s.id === pSetId)) {
      db.stockPriceSettings.push({
        id: pSetId,
        farmId: crop.farmId,
        entityType: 'crop_plant',
        entityId: crop.id,
        unitLabel: spec.plantUnitLabel,
        unitPriceZar: spec.plantUnitPrice,
        priceSource: 'DEMONSTRATION DATA — Regional reference valuation per standing unit',
        updatedByUserId: crop.ownerId,
        updatedAt: now,
      });
      changed = true;
    }
    const hSetId = `sp-harv-${crop.id}`;
    if (!db.stockPriceSettings.some((s) => s.id === hSetId)) {
      db.stockPriceSettings.push({
        id: hSetId,
        farmId: crop.farmId,
        entityType: 'crop_harvest',
        entityId: crop.id,
        unitLabel: 'kg',
        unitPriceZar: spec.harvestUnitPrice,
        priceSource: 'DEMONSTRATION DATA — Regional reference market price per kg',
        updatedByUserId: crop.ownerId,
        updatedAt: now,
      });
      changed = true;
    }

    const remainPlants = Math.max(0, crop.plantingQuantity - crop.damagedPlants);
    const plantMoveId = `csm-plant-${crop.id}`;
    if (!db.cropStockMovements.some((m) => m.id === plantMoveId)) {
      db.cropStockMovements.push({
        id: plantMoveId,
        cropId: crop.id,
        farmId: crop.farmId,
        actorUserId: crop.ownerId,
        movementType: 'planting',
        movementDate: crop.plantingDate,
        quantityDelta: crop.plantingQuantity,
        unit: 'plants',
        unitPriceZar: spec.plantUnitPrice,
        totalValueZar: Number((crop.plantingQuantity * spec.plantUnitPrice).toFixed(2)),
        resultingRemainingPlants: crop.plantingQuantity,
        resultingStoredKg: 0,
        notes: `Initial ${crop.cropName} establishment.`,
        incidentId: null,
        createdAt: now,
      });
      changed = true;
    }

    if (crop.damagedPlants > 0) {
      const dmgId = `csm-dmg-${crop.id}`;
      if (!db.cropStockMovements.some((m) => m.id === dmgId)) {
        db.cropStockMovements.push({
          id: dmgId,
          cropId: crop.id,
          farmId: crop.farmId,
          actorUserId: crop.ownerId,
          movementType: 'damage',
          movementDate: sastDaysAgo(14),
          quantityDelta: -crop.damagedPlants,
          unit: 'plants',
          unitPriceZar: spec.plantUnitPrice,
          totalValueZar: Number((crop.damagedPlants * spec.plantUnitPrice).toFixed(2)),
          resultingRemainingPlants: remainPlants,
          resultingStoredKg: 0,
          notes: `Field stand reduction (${crop.damagedPlants.toLocaleString()} units) reconciled to remaining stand.`,
          incidentId: null,
          createdAt: now,
        });
        changed = true;
      }
    }

    if (crop.harvestedQuantityKg > 0) {
      const harvId = `csm-harv-${crop.id}`;
      if (!db.cropStockMovements.some((m) => m.id === harvId)) {
        db.cropStockMovements.push({
          id: harvId,
          cropId: crop.id,
          farmId: crop.farmId,
          actorUserId: crop.ownerId,
          movementType: 'harvest',
          movementDate: sastDaysAgo(9),
          quantityDelta: crop.harvestedQuantityKg,
          unit: 'kg',
          unitPriceZar: spec.harvestUnitPrice,
          totalValueZar: Number((crop.harvestedQuantityKg * spec.harvestUnitPrice).toFixed(2)),
          resultingRemainingPlants: remainPlants,
          resultingStoredKg: crop.harvestedQuantityKg,
          notes: `Harvested ${crop.harvestedQuantityKg.toLocaleString()} kg ${crop.cropName}.`,
          incidentId: null,
          createdAt: now,
        });
        changed = true;
      }
      if (spec.soldKg > 0) {
        const saleId = `csm-sale-${crop.id}`;
        const storedAfter = Math.max(0, crop.harvestedQuantityKg - spec.soldKg);
        if (!db.cropStockMovements.some((m) => m.id === saleId)) {
          db.cropStockMovements.push({
            id: saleId,
            cropId: crop.id,
            farmId: crop.farmId,
            actorUserId: crop.ownerId,
            movementType: 'sale',
            movementDate: sastDaysAgo(6),
            quantityDelta: -spec.soldKg,
            unit: 'kg',
            unitPriceZar: spec.harvestUnitPrice,
            totalValueZar: Number((spec.soldKg * spec.harvestUnitPrice).toFixed(2)),
            resultingRemainingPlants: remainPlants,
            resultingStoredKg: storedAfter,
            notes: `Dispatched ${spec.soldKg.toLocaleString()} kg; ${storedAfter.toLocaleString()} kg held in storage.`,
            incidentId: null,
            createdAt: now,
          });
          changed = true;
        }
      }
    }

    const actId = `cact-demo-${crop.id}`;
    if (!db.cropActivities.some((a) => a.id === actId)) {
      db.cropActivities.push({
        id: actId,
        cropId: crop.id,
        farmId: crop.farmId,
        fieldId: crop.fieldId,
        actorUserId: crop.ownerId,
        activityType: 'fertiliser',
        activityDate: sastDaysAgo(18),
        quantity: Math.round(crop.cultivatedAreaHectares * 220),
        unit: 'kg',
        valueZar: spec.actExpenseZar,
        notes: spec.actNote,
        snapshot: null,
        createdAt: now,
      });
      changed = true;
    }
  }

  // 6. Connected Livestock Groups & Reconciled Movements across FS, EC, MP, NC, NW
  const extraLivestockGroups: LivestockGroup[] = [
    {
      id: 'lvk-beth-cattle-4',
      farmId: 'farm-bethlehem-demo-3',
      fieldId: 'fld-5-demo',
      ownerId: 'user-existing-demo-2',
      animalType: 'Cattle',
      groupName: 'Saulspoort Bonsmara Herd',
      breed: 'SA Bonsmara',
      quantity: 42,
      identificationNumber: 'FS-BONS-001 to 042',
      registrationDate: '2024-06-15',
      healthStatus: 'Healthy',
      feedingInformation: 'Maize stover grazing + winter protein lick',
      grazingInformation: 'Natural Sourveld Paddocks (16 ha)',
      housingInformation: 'Covered handling crush & calf shelter',
      estimatedUnitValueZar: 16200,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lvk-ec-sheep-5',
      farmId: 'farm-amatole-demo-5',
      fieldId: 'fld-7-demo',
      ownerId: 'user-existing-ec-3',
      animalType: 'Sheep',
      groupName: 'Amathole Dohne Merino Flock',
      breed: 'Dohne Merino',
      quantity: 95,
      identificationNumber: 'EC-DM-001 to 095',
      registrationDate: '2024-02-10',
      healthStatus: 'Under Observation',
      feedingInformation: 'Rotational grassveld + home-baled lucerne hay',
      grazingInformation: 'Kubusi Grazing Camp A (46 ha)',
      housingInformation: 'Stone shearing & lambing shed',
      estimatedUnitValueZar: 2450,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lvk-ec-cattle-6',
      farmId: 'farm-amatole-demo-5',
      fieldId: 'fld-7-demo',
      ownerId: 'user-existing-ec-3',
      animalType: 'Cattle',
      groupName: 'Kubusi Beef Herd',
      breed: 'Nguni × Bonsmara',
      quantity: 36,
      identificationNumber: 'EC-NG-001 to 036',
      registrationDate: '2024-04-01',
      healthStatus: 'Healthy',
      feedingInformation: 'Rotational sweet-sourveld + winter energy block',
      grazingInformation: 'Kubusi Grazing Camp A',
      housingInformation: 'Dip tank & crush kraal',
      estimatedUnitValueZar: 14800,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lvk-mp-goats-7',
      farmId: 'farm-lowveld-demo-8',
      fieldId: 'fld-14-demo',
      ownerId: 'user-existing-mp-6',
      animalType: 'Goats',
      groupName: 'Onderberg Boer Goat Flock',
      breed: 'Improved Boer Goat',
      quantity: 48,
      identificationNumber: 'MP-BG-001 to 048',
      registrationDate: '2025-02-14',
      healthStatus: 'Healthy',
      feedingInformation: 'Acacia bushveld browse + cane-top silage',
      grazingInformation: 'Bushveld Goat Browse Camp (10 ha)',
      housingInformation: 'Elevated timber shelter against tick load',
      estimatedUnitValueZar: 3100,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lvk-nc-dorper-8',
      farmId: 'farm-upington-demo-9',
      fieldId: 'fld-16-demo',
      ownerId: 'user-existing-nc-7',
      animalType: 'Sheep',
      groupName: 'Gariep Dorper Breeding Flock',
      breed: 'SA Dorper',
      quantity: 140,
      identificationNumber: 'NC-DRP-001 to 140',
      registrationDate: '2024-05-01',
      healthStatus: 'Healthy',
      feedingInformation: 'Karoo shrub camp + irrigated lucerne hay',
      grazingInformation: 'Karoo Shrub Dorper Camp (24 ha)',
      housingInformation: 'Shaded Karoo handling pens',
      estimatedUnitValueZar: 2650,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'lvk-nw-cattle-9',
      farmId: 'farm-lichtenburg-demo-10',
      fieldId: 'fld-18-demo',
      ownerId: 'user-existing-nw-8',
      animalType: 'Cattle',
      groupName: 'Ditsobotla Drakensberger Herd',
      breed: 'Drakensberger',
      quantity: 38,
      identificationNumber: 'NW-DRK-001 to 038',
      registrationDate: '2024-08-12',
      healthStatus: 'Healthy',
      feedingInformation: 'Dolomitic grassland + phosphate-salt lick',
      grazingInformation: 'Dolomite Veld Cattle Camp (25 ha)',
      housingInformation: 'Steel cattle race & spray race',
      estimatedUnitValueZar: 15800,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const lg of extraLivestockGroups) {
    if (!db.livestockGroups.some((x) => x.id === lg.id)) {
      db.livestockGroups.push(lg);
      changed = true;
    }
  }

  const extraLivestockRecords: LivestockRecord[] = [
    {
      id: 'lrec-demo-5',
      livestockGroupId: 'lvk-beth-cattle-4',
      farmId: 'farm-bethlehem-demo-3',
      actorUserId: 'user-existing-demo-2',
      recordType: 'Birth',
      recordDate: sastDaysAgo(26),
      quantityChange: 5,
      productionAmount: 0,
      productionUnit: 'head',
      valueZar: 28000,
      notes: '5 spring Bonsmara calves tagged and colostrum verified.',
      createdAt: now,
    },
    {
      id: 'lrec-demo-6',
      livestockGroupId: 'lvk-ec-sheep-5',
      farmId: 'farm-amatole-demo-5',
      actorUserId: 'user-existing-ec-3',
      recordType: 'Veterinary',
      recordDate: sastDaysAgo(8),
      quantityChange: 0,
      productionAmount: 95,
      productionUnit: 'head',
      valueZar: 4850,
      notes: 'FAMACHA scoring and targeted Haemonchus drenching after wet spell.',
      createdAt: now,
    },
    {
      id: 'lrec-demo-7',
      livestockGroupId: 'lvk-ec-sheep-5',
      farmId: 'farm-amatole-demo-5',
      actorUserId: 'user-existing-ec-3',
      recordType: 'Death',
      recordDate: sastDaysAgo(7),
      quantityChange: -2,
      productionAmount: 0,
      productionUnit: 'head',
      valueZar: 4900,
      notes: '2 lambs lost to cold wet snap before shearing shed shelter.',
      createdAt: now,
    },
    {
      id: 'lrec-demo-8',
      livestockGroupId: 'lvk-mp-goats-7',
      farmId: 'farm-lowveld-demo-8',
      actorUserId: 'user-existing-mp-6',
      recordType: 'Vaccination',
      recordDate: sastDaysAgo(12),
      quantityChange: 0,
      productionAmount: 48,
      productionUnit: 'doses',
      valueZar: 2640,
      notes: 'Pulpy kidney & heartwater preventive dipping programme.',
      createdAt: now,
    },
    {
      id: 'lrec-demo-9',
      livestockGroupId: 'lvk-nc-dorper-8',
      farmId: 'farm-upington-demo-9',
      actorUserId: 'user-existing-nc-7',
      recordType: 'Sale',
      recordDate: sastDaysAgo(11),
      quantityChange: -18,
      productionAmount: 18,
      productionUnit: 'head',
      valueZar: 47700,
      notes: 'Slaughter lambs sold via Northern Cape abattoir agent.',
      createdAt: now,
    },
    {
      id: 'lrec-demo-10',
      livestockGroupId: 'lvk-nw-cattle-9',
      farmId: 'farm-lichtenburg-demo-10',
      actorUserId: 'user-existing-nw-8',
      recordType: 'Feeding',
      recordDate: sastDaysAgo(5),
      quantityChange: 0,
      productionAmount: 1200,
      productionUnit: 'kg',
      valueZar: 8900,
      notes: 'Winter phosphate-urea lick replenishment.',
      createdAt: now,
    },
  ];

  for (const lr of extraLivestockRecords) {
    upsertById(db.livestockRecords, lr);
  }

  // 7. Mixed Farming / Operational Expenses across the additional provinces
  const extraMixedEntries: MixedFarmingEntry[] = [
    {
      id: 'mix-demo-fs-1',
      farmId: 'farm-bethlehem-demo-3',
      ownerId: 'user-existing-demo-2',
      entryCategory: 'combined_expense',
      title: 'Highveld Planter Diesel & Conservation Tillage Service',
      entryDate: sastDaysAgo(16),
      relatedCropId: 'crop-beth-maize-5',
      relatedLivestockId: null,
      expenseZar: 18600,
      productionQuantity: 0,
      productionUnit: '',
      waterLiters: 0,
      notes: 'Tractor planting pass & borehole pump servicing.',
      createdAt: now,
    },
    {
      id: 'mix-demo-wc-2',
      farmId: 'farm-winelands-demo-4',
      ownerId: 'user-existing-demo-2',
      entryCategory: 'water_management',
      title: 'Breede Valley Irrigation Water Quota & Pump Electricity',
      entryDate: sastDaysAgo(10),
      relatedCropId: 'crop-wc-plums-7',
      relatedLivestockId: null,
      expenseZar: 12400,
      productionQuantity: 0,
      productionUnit: '',
      waterLiters: 420000,
      notes: 'Scheme drip schedule adjusted using ET0 forecast.',
      createdAt: now,
    },
    {
      id: 'mix-demo-ec-3',
      farmId: 'farm-amatole-demo-5',
      ownerId: 'user-existing-ec-3',
      entryCategory: 'feed_production',
      title: 'Valley Lucerne Hay Allocated to Dohne Merino Lambing Ewes',
      entryDate: sastDaysAgo(9),
      relatedCropId: 'crop-ec-lucerne-8',
      relatedLivestockId: 'lvk-ec-sheep-5',
      expenseZar: 3200,
      productionQuantity: 4500,
      productionUnit: 'kg hay',
      waterLiters: 0,
      notes: '180 round bales moved into lambing camp store.',
      createdAt: now,
    },
    {
      id: 'mix-demo-gp-4',
      farmId: 'farm-roodeplaat-demo-6',
      ownerId: 'user-existing-gp-4',
      entryCategory: 'water_management',
      title: 'Roodeplaat Borehole Solar Pump & Filter Flushing',
      entryDate: sastDaysAgo(4),
      relatedCropId: 'crop-gp-tomatoes-9',
      relatedLivestockId: null,
      expenseZar: 4100,
      productionQuantity: 0,
      productionUnit: '',
      waterLiters: 145000,
      notes: 'Daily drip fertigation runtime 2.5 hours.',
      createdAt: now,
    },
    {
      id: 'mix-demo-nc-5',
      farmId: 'farm-upington-demo-9',
      ownerId: 'user-existing-nc-7',
      entryCategory: 'feed_production',
      title: 'Pivot Lucerne Cut Allocated to Dorper Ewes & Abattoir Finish',
      entryDate: sastDaysAgo(8),
      relatedCropId: 'crop-nc-lucerne-12',
      relatedLivestockId: 'lvk-nc-dorper-8',
      expenseZar: 6800,
      productionQuantity: 6200,
      productionUnit: 'kg hay',
      waterLiters: 680000,
      notes: 'Orange River canal quota applied on pivot schedule.',
      createdAt: now,
    },
  ];
  for (const m of extraMixedEntries) upsertById(db.mixedFarmingEntries, m);

  // 8. Soil Reports (select farms have measured lab reports; others explicitly remain unmeasured!)
  const extraSoilReports: SoilReport[] = [
    {
      id: 'soilrep-bethlehem-demo-2',
      farmId: 'farm-bethlehem-demo-3',
      fieldId: 'fld-5-demo',
      ownerId: 'user-existing-demo-2',
      laboratoryName: 'Grain Crop Analytical Reference Lab (Demonstration Entry)',
      sampleCode: 'FS-DEMO-2026-104',
      sampleDate: sastDaysAgo(45),
      sampleDepthCm: '0-20 cm',
      soilPhWater: 5.8,
      soilPhKcl: 5.0,
      soilTextureClass: 'Avalon Sandy Loam',
      clayPercent: 18,
      siltPercent: 14,
      sandPercent: 68,
      organicMatterPercent: 1.9,
      nitrogenMgKg: 28,
      phosphorusMgKg: 21,
      potassiumMgKg: 135,
      calciumMgKg: 780,
      magnesiumMgKg: 185,
      cecCmolKg: 7.6,
      fertilityRating: 'Moderate',
      drainageClass: 'Well Drained',
      waterHoldingCapacityMmPerM: 120,
      attachmentFileName: null,
      attachmentSummary: 'DEMONSTRATION LAB RECORD: Composite sample across Saulspoort dryland maize & soya block.',
      notes: 'pH KCl 5.0 indicates moderate subsoil acidity; gypsum/lime strip recommended post-harvest.',
      createdAt: now,
    },
    {
      id: 'soilrep-levubu-demo-3',
      farmId: 'farm-levubu-demo-7',
      fieldId: 'fld-11-demo',
      ownerId: 'user-existing-lp-5',
      laboratoryName: 'Subtropical Soil Fertility Lab (Demonstration Entry)',
      sampleCode: 'LP-DEMO-2026-318',
      sampleDate: sastDaysAgo(38),
      sampleDepthCm: '0-20 cm',
      soilPhWater: 5.9,
      soilPhKcl: 5.2,
      soilTextureClass: 'Deep Red Ferralsol Clay Loam',
      clayPercent: 38,
      siltPercent: 22,
      sandPercent: 40,
      organicMatterPercent: 3.4,
      nitrogenMgKg: 42,
      phosphorusMgKg: 29,
      potassiumMgKg: 195,
      calciumMgKg: 1240,
      magnesiumMgKg: 260,
      cecCmolKg: 13.1,
      fertilityRating: 'High',
      drainageClass: 'Well Drained',
      waterHoldingCapacityMmPerM: 155,
      attachmentFileName: null,
      attachmentSummary: 'DEMONSTRATION LAB RECORD: Avocado orchard topsoil fertility profile.',
      notes: 'Good organic carbon (3.4%) under orchard mulch; maintain zinc & boron foliar schedule.',
      createdAt: now,
    },
  ];
  for (const sr of extraSoilReports) upsertById(db.soilReports, sr);

  // 9. Farm Incidents across other provinces
  const extraIncidents: FarmIncident[] = [
    {
      id: 'inc-beth-drought-3',
      farmId: 'farm-bethlehem-demo-3',
      fieldId: 'fld-5-demo',
      cropId: 'crop-beth-maize-5',
      livestockGroupId: null,
      visualAnalysisId: null,
      ownerId: 'user-existing-demo-2',
      incidentType: 'drought',
      title: 'Mid-November Dry Spell Moisture Deficit on Maize Germination',
      occurredAt: `${sastDaysAgo(10)}T11:00:00Z`,
      description:
        '11 days without significant rain slowed seedling emergence along sandy ridge (~18,000 stands affected).',
      mediaFileName: null,
      mediaType: null,
      mediaPreviewDataUrl: null,
      affectedQuantity: 18000,
      affectedUnit: 'plants',
      affectedAreaHectares: 1.2,
      originalRecordedQuantity: 760000,
      remainingRecordedQuantity: 742000,
      estimatedFinancialImpactZar: 10080,
      recommendedActions: [
        'Avoid deep inter-row cultivation to preserve remaining sub-surface moisture.',
        'Monitor 7-day forecast before top-dressing nitrogen.',
      ],
      status: 'monitoring',
      followUps: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'inc-ec-sheep-4',
      farmId: 'farm-amatole-demo-5',
      fieldId: 'fld-7-demo',
      cropId: null,
      livestockGroupId: 'lvk-ec-sheep-5',
      visualAnalysisId: null,
      ownerId: 'user-existing-ec-3',
      incidentType: 'livestock_illness',
      title: 'Internal Parasite Load & Cold Snap Stress in Merino Lambs',
      occurredAt: `${sastDaysAgo(7)}T06:30:00Z`,
      description:
        'Following prolonged rain in Stutterheim, FAMACHA inspection showed anaemia risk in ewe flock and 2 lamb mortalities during overnight cold front.',
      mediaFileName: null,
      mediaType: null,
      mediaPreviewDataUrl: null,
      affectedQuantity: 14,
      affectedUnit: 'head',
      affectedAreaHectares: 0,
      originalRecordedQuantity: 97,
      remainingRecordedQuantity: 95,
      estimatedFinancialImpactZar: 4900,
      recommendedActions: [
        'Hold lambs in sheltered kraal during cold wet fronts.',
        'Coordinate faecal egg count & drench rotation with Veterinary Advisor.',
      ],
      status: 'active',
      followUps: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'inc-gp-pest-5',
      farmId: 'farm-roodeplaat-demo-6',
      fieldId: 'fld-9-demo',
      cropId: 'crop-gp-tomatoes-9',
      livestockGroupId: null,
      visualAnalysisId: null,
      ownerId: 'user-existing-gp-4',
      incidentType: 'pest_outbreak',
      title: 'Tomato Leafminer (Tuta absoluta) Trap Spike in Tunnel Rows',
      occurredAt: `${sastDaysAgo(5)}T08:15:00Z`,
      description:
        'Pheromone traps exceeded 25 moths/week in north rows of Shade-Net Tomato Block 1; 1,400 plants showing leaf mines.',
      mediaFileName: null,
      mediaType: null,
      mediaPreviewDataUrl: null,
      affectedQuantity: 1400,
      affectedUnit: 'plants',
      affectedAreaHectares: 0.25,
      originalRecordedQuantity: 56000,
      remainingRecordedQuantity: 54600,
      estimatedFinancialImpactZar: 5460,
      recommendedActions: [
        'Remove and bag heavily mined lower leaves immediately.',
        'Request Pest Specialist review of pheromone trap counts & Act 36 registered options.',
      ],
      status: 'active',
      followUps: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
  for (const inc of extraIncidents) upsertById(db.farmIncidents, inc);

  // 10. Weather Forecast Snapshots & Farmer Observations across more provinces
  const d4 = sastDaysAgo(4);
  const d2 = sastDaysAgo(2);
  const extraForecasts: WeatherForecastRecord[] = [
    {
      id: 'wfc-demo-fs-3',
      farmId: 'farm-bethlehem-demo-3',
      forecastDate: d4,
      fetchedAt: `${d4}T06:00:00.000Z`,
      sourceName: 'Open-Meteo Coordinate Weather Forecast Snapshot',
      sourceCategory: 'forecast_information',
      verifiedStationName: null,
      verifiedStationRainMm: null,
      verifiedStationTempC: null,
      predictedRainfallMm: 6.5,
      predictedTempMinC: 9.8,
      predictedTempMaxC: 27.2,
      predictedWindMaxKmh: 24.0,
      weatherDescription: 'Warm with isolated afternoon shower chance',
    },
    {
      id: 'wfc-demo-ec-4',
      farmId: 'farm-amatole-demo-5',
      forecastDate: d2,
      fetchedAt: `${d2}T06:00:00.000Z`,
      sourceName: 'Open-Meteo Coordinate Weather Forecast Snapshot',
      sourceCategory: 'forecast_information',
      verifiedStationName: null,
      verifiedStationRainMm: null,
      verifiedStationTempC: null,
      predictedRainfallMm: 18.0,
      predictedTempMinC: 7.4,
      predictedTempMaxC: 18.5,
      predictedWindMaxKmh: 31.0,
      weatherDescription: 'Cold frontal rain and brisk south-westerly wind',
    },
  ];
  for (const fc of extraForecasts) upsertById(db.weatherForecastRecords, fc);

  const extraObservations: FarmerWeatherObservation[] = [
    {
      id: 'wobs-demo-fs-3',
      farmId: 'farm-bethlehem-demo-3',
      ownerId: 'user-existing-demo-2',
      farmLocationLabel: 'Bethlehem / Saulspoort, Dihlabeng, Free State',
      latitude: -28.235,
      longitude: 28.312,
      observationDate: d4,
      rainfallOccurred: false,
      rainfallIntensity: 'none',
      measuredRainfallMm: 0,
      temperatureC: 28.0,
      windObservation: 'moderate_wind',
      windSpeedEstimateKmh: 22,
      notes: 'Virga clouds passed north-east; zero measurable rain on farm gauge.',
      sourceCategory: 'farmer_reported_observation',
      qcStatus: 'qc_passed_reference',
      qcNotes: 'Farmer-reported rain gauge reading retained for forecast variance tracking.',
      comparedForecastRecordId: 'wfc-demo-fs-3',
      createdAt: `${d4}T17:30:00.000Z`,
      updatedAt: `${d4}T17:30:00.000Z`,
    },
    {
      id: 'wobs-demo-ec-4',
      farmId: 'farm-amatole-demo-5',
      ownerId: 'user-existing-ec-3',
      farmLocationLabel: 'Stutterheim / Kubusi Valley, Amahlathi, Eastern Cape',
      latitude: -32.568,
      longitude: 27.419,
      observationDate: d2,
      rainfallOccurred: true,
      rainfallIntensity: 'heavy',
      measuredRainfallMm: 24.5,
      temperatureC: 14.0,
      windObservation: 'strong_wind',
      windSpeedEstimateKmh: 34,
      notes: 'Cold soaking frontal rain; lambs moved into stone shearing shed overnight.',
      sourceCategory: 'farmer_reported_observation',
      qcStatus: 'qc_passed_reference',
      qcNotes: 'Farmer-reported rain gauge reading retained for forecast variance tracking.',
      comparedForecastRecordId: 'wfc-demo-ec-4',
      createdAt: `${d2}T18:00:00.000Z`,
      updatedAt: `${d2}T18:00:00.000Z`,
    },
  ];
  for (const obs of extraObservations) upsertById(db.weatherObservations, obs);

  // 11. Prospective Farmer Demo Saved Locations & Feasibility Business Plans
  const extraProspectiveLocations: SavedProspectiveLocation[] = [
    {
      id: 'spl-demo-gp-3',
      userId: 'user-prospective-demo-2',
      province: 'Gauteng',
      district: 'West Rand District',
      townOrArea: 'Magaliesburg Agro-Hub',
      intendedHectares: 1.5,
      waterSourceNote: 'Borehole yield 3,500 L/hr verified on site inspection checklist',
      notes: 'DEMONSTRATION DATA: Candidate 1.5 ha site for 4 × 30m × 10m shade-net vegetable tunnels.',
      createdAt: now,
    },
    {
      id: 'spl-demo-nw-4',
      userId: 'user-prospective-demo-2',
      province: 'North West',
      district: 'Bojanala Platinum District',
      townOrArea: 'Brits Irrigation Corridor',
      intendedHectares: 3.0,
      waterSourceNote: 'Hartbeespoort irrigation scheme quota verification required before offer',
      notes: 'DEMONSTRATION DATA: Secondary candidate plot with warmer winter minimum temperatures.',
      createdAt: now,
    },
  ];
  for (const sl of extraProspectiveLocations) upsertById(db.savedProspectiveLocations, sl);

  const extraBusinessPlans: BusinessPlanScenario[] = [
    {
      id: 'bplan-demo-prospective-gp-3',
      ownerId: 'user-prospective-demo-2',
      farmId: null,
      planName: 'Magaliesburg 1.5 ha Tunnel Spinach & Culinary Herbs Feasibility',
      farmingType: 'horticulture_veg',
      scaleTier: 'small_scale',
      province: 'Gauteng',
      district: 'West Rand District',
      farmSizeHectares: 1.5,
      productionGoals: 'Produce high-turnover baby spinach and basil bundles for Tshwane/Johannesburg packhouses.',
      marketChannel: 'Regional Packhouses & Specialty Fresh Retailers',
      equipmentCostZar: 38000,
      equipmentNotes: 'Fertigation venturi, EC/pH meters, harvesting crates, cold-room deposit.',
      seedsPlantingCostZar: 22000,
      fertilisersCostZar: 19500,
      feedCostZar: 0,
      waterCostZar: 14000,
      waterDemandM3: 5400,
      labourWorkers: 4,
      labourCostZar: 112000,
      infrastructureCostZar: 135000,
      operatingExpensesZar: 32000,
      expectedProductionQty: 26500,
      productionUnit: 'kg',
      sellingPricePerUnitZar: 16.5,
      assumptionsNotes:
        'DEMONSTRATION PLANNING SCENARIO — Assumes 4 shade tunnels erected in Month 1 and 12% packhouse reject allowance. Not a guarantee of yield or profit.',
      createdAt: now,
      updatedAt: now,
    },
  ];
  for (const bp of extraBusinessPlans) upsertById(db.businessPlans, bp);

  // 12. Scoped Farm Access Grants across multiple specialists & the cooperative
  const extraGrants: FarmAccessGrant[] = [
    {
      id: 'grant-exp-bethlehem-agro',
      farmId: 'farm-bethlehem-demo-3',
      farmerUserId: 'user-existing-demo-2',
      granteeType: 'expert',
      granteeUserId: 'user-expert-1',
      organisationId: null,
      granteeLabel: 'Dr. Pieter van der Merwe (Agronomist / Crop Production)',
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
      authorisedBasis: 'Demonstration farmer explicit advisory grant',
      status: 'active',
      grantedAt: now,
      revokedAt: null,
    },
    {
      id: 'grant-exp-umgeni-soil',
      farmId: 'farm-umgeni-1',
      farmerUserId: 'user-existing-1',
      granteeType: 'expert',
      granteeUserId: 'user-expert-soil-2',
      organisationId: null,
      granteeLabel: 'Nomvula Cele (Soil Scientist)',
      scopes: {
        overview: true,
        crops: true,
        soil: true,
        livestock: false,
        incidents: false,
        aiInsights: true,
        weather: true,
        financialSummary: false,
      },
      authorisedBasis: 'Soil report interpretation consent',
      status: 'active',
      grantedAt: now,
      revokedAt: null,
    },
    {
      id: 'grant-exp-ec-vet',
      farmId: 'farm-amatole-demo-5',
      farmerUserId: 'user-existing-ec-3',
      granteeType: 'expert',
      granteeUserId: 'user-expert-vet-4',
      organisationId: null,
      granteeLabel: 'Thandi Nkosi (Veterinary Advisor — Demo)',
      scopes: {
        overview: true,
        crops: false,
        soil: false,
        livestock: true,
        incidents: true,
        aiInsights: false,
        weather: true,
        financialSummary: false,
      },
      authorisedBasis: 'Herd biosecurity & lamb mortality review grant',
      status: 'active',
      grantedAt: now,
      revokedAt: null,
    },
    {
      id: 'grant-exp-gp-pest',
      farmId: 'farm-roodeplaat-demo-6',
      farmerUserId: 'user-existing-gp-4',
      granteeType: 'expert',
      granteeUserId: 'user-expert-pest-7',
      organisationId: null,
      granteeLabel: 'Johan Pretorius (Pest & Disease Specialist — Demo)',
      scopes: {
        overview: true,
        crops: true,
        soil: false,
        livestock: false,
        incidents: true,
        aiInsights: true,
        weather: true,
        financialSummary: false,
      },
      authorisedBasis: 'IPM trap threshold & pest outbreak consultation grant',
      status: 'active',
      grantedAt: now,
      revokedAt: null,
    },
    // Cooperative grants across provinces (non-financial by default, 2 financial-scoped consents)
    {
      id: 'grant-org-bethlehem',
      farmId: 'farm-bethlehem-demo-3',
      farmerUserId: 'user-existing-demo-2',
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
        financialSummary: true,
      },
      authorisedBasis: 'Cooperative benchmark consent (includes financial summary)',
      status: 'active',
      grantedAt: now,
      revokedAt: null,
    },
    {
      id: 'grant-org-lowveld-mp',
      farmId: 'farm-lowveld-demo-8',
      farmerUserId: 'user-existing-mp-6',
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
        financialSummary: true,
      },
      authorisedBasis: 'Cooperative member programme consent (includes financial summary)',
      status: 'active',
      grantedAt: now,
      revokedAt: null,
    },
    {
      id: 'grant-org-amatole-ec',
      farmId: 'farm-amatole-demo-5',
      farmerUserId: 'user-existing-ec-3',
      granteeType: 'organisation',
      granteeUserId: 'user-org-1',
      organisationId: 'org-lowveld-1',
      granteeLabel: 'Lowveld & Midlands Growers Cooperative',
      scopes: {
        overview: true,
        crops: true,
        soil: false,
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
      id: 'grant-org-levubu-lp',
      farmId: 'farm-levubu-demo-7',
      farmerUserId: 'user-existing-lp-5',
      granteeType: 'organisation',
      granteeUserId: 'user-org-1',
      organisationId: 'org-lowveld-1',
      granteeLabel: 'Lowveld & Midlands Growers Cooperative',
      scopes: {
        overview: true,
        crops: true,
        soil: true,
        livestock: false,
        incidents: true,
        aiInsights: false,
        weather: true,
        financialSummary: false,
      },
      authorisedBasis: 'Cooperative subtropical benchmark consent (non-financial)',
      status: 'active',
      grantedAt: now,
      revokedAt: null,
    },
  ];
  for (const g of extraGrants) upsertById(db.farmAccessGrants, g);

  // 13. Consultation Requests across specialist categories
  const demoConsultations: ConsultationRequest[] = [
    {
      id: 'cons-demo-1',
      farmId: 'farm-bethlehem-demo-3',
      farmerUserId: 'user-existing-demo-2',
      expertUserId: 'user-expert-1',
      specialistCategory: 'agronomist',
      subject: 'Dryland Maize Nitrogen Split After 11-Day Dry Spell',
      description:
        'Topsoil moisture fell below 45% after planting PAN 5R-591R. Should we delay LAN 28 top-dressing until forecast rain arrives?',
      urgency: 'priority',
      status: 'responded',
      recommendationSummary:
        'Hold granular LAN top-dressing until >=15 mm rainfall is confirmed on farm gauge to avoid volatilisation and salt burn on sandy Avalon loam.',
      requestedAt: sastDaysAgo(8),
      updatedAt: sastDaysAgo(6),
      isDemonstration: true,
    },
    {
      id: 'cons-demo-2',
      farmId: 'farm-amatole-demo-5',
      farmerUserId: 'user-existing-ec-3',
      expertUserId: 'user-expert-vet-4',
      specialistCategory: 'veterinarian',
      subject: 'Dohne Merino Lamb Cold-Stress & Parasite Protocol Review',
      description:
        'Following wet cold fronts in Stutterheim, 2 lambs died and FAMACHA scores rose on 14 ewes.',
      urgency: 'urgent',
      status: 'in_review',
      recommendationSummary:
        'Draft biosecurity & shelter checklist prepared; advise physical inspection by a locally registered SAVC veterinarian for anthelmintic prescription.',
      requestedAt: sastDaysAgo(6),
      updatedAt: sastDaysAgo(4),
      isDemonstration: true,
    },
    {
      id: 'cons-demo-3',
      farmId: 'farm-roodeplaat-demo-6',
      farmerUserId: 'user-existing-gp-4',
      expertUserId: 'user-expert-pest-7',
      specialistCategory: 'pest_disease_specialist',
      subject: 'Tuta absoluta Trap Threshold in Shade-Net Tomatoes',
      description: 'Trap counts reached 25 moths/week along north tunnel vents.',
      urgency: 'priority',
      status: 'assigned',
      recommendationSummary: '',
      requestedAt: sastDaysAgo(4),
      updatedAt: sastDaysAgo(4),
      isDemonstration: true,
    },
    {
      id: 'cons-demo-4',
      farmId: 'farm-umgeni-1',
      farmerUserId: 'user-existing-1',
      expertUserId: 'user-expert-soil-2',
      specialistCategory: 'soil_specialist',
      subject: 'Follow-Up Lime Requirement Check for Lower Terrace',
      description: 'Confirming pH KCl progression ahead of autumn cabbage planting.',
      urgency: 'routine',
      status: 'responded',
      recommendationSummary:
        'Maintain 1.0–1.5 t/ha dolomitic lime maintenance cadence based on Cedara lab report CED-2026-4418A and repeat composite 0–20 cm sampling next season.',
      requestedAt: sastDaysAgo(12),
      updatedAt: sastDaysAgo(9),
      isDemonstration: true,
    },
  ];
  for (const c of demoConsultations) upsertById(db.consultationRequests, c);

  // 14. Additional Expert Feedback & AI Insights
  const extraFeedback: ExpertFeedbackRecord[] = [
    {
      id: 'ef-seed-beth-3',
      expertUserId: 'user-expert-1',
      expertName: 'Dr. Pieter van der Merwe',
      expertSpecialisation: 'agronomist',
      farmId: 'farm-bethlehem-demo-3',
      incidentId: 'inc-beth-drought-3',
      cropId: 'crop-beth-maize-5',
      livestockGroupId: null,
      soilReportId: 'soilrep-bethlehem-demo-2',
      aiInsightId: null,
      concernCategory: 'incident_assistance',
      subject: 'Highveld Dry Spell Moisture Preservation & Subsoil Acidity Note',
      assessment:
        'Soil report FS-DEMO-2026-104 shows pH(KCl) 5.0 with low organic matter (1.9%). Preserve surface crop residues and hold side-dress nitrogen until meaningful rain arrives.',
      recommendations: [
        'Hold LAN application until >=15 mm gauge rainfall is recorded.',
        'Plan post-harvest dolomitic lime incorporation on sandy ridges.',
      ],
      status: 'completed',
      farmerAcknowledged: true,
      isDemonstration: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
  for (const fb of extraFeedback) upsertById(db.expertFeedbacks, fb);

  const extraAiInsights: AiInsightRecord[] = [
    {
      id: 'ai-seed-gp-3',
      userId: 'user-existing-gp-4',
      farmId: 'farm-roodeplaat-demo-6',
      category: 'advisory',
      title: 'Roodeplaat Tunnel IPM & Drip Fertigation Cadence',
      summary:
        'DEMONSTRATION INSIGHT: With 56,000 Roma tomato plants and rising Tuta absoluta trap pressure, prioritise early-morning venting inspection and strict sanitation of mined leaves.',
      recommendations: [
        'Inspect pheromone traps twice weekly and log counts.',
        'Flush drip laterals every 14 days to prevent emitter calcium precipitation.',
      ],
      languageCode: 'en',
      poweredBy: 'grounded_fallback',
      createdAt: now,
    },
  ];
  for (const ai of extraAiInsights) upsertById(db.aiInsightRecords, ai);

  // 15. Organisation Memberships, Projects, Programme Activities & Specialist Assignments
  for (const org of db.organisations) {
    if (org.id === 'org-lowveld-1' && org.isDemonstration === undefined) {
      org.isDemonstration = true;
      changed = true;
    }
  }
  const extraMem: OrganisationMembership = {
    id: 'orgmem-demo-2',
    organisationId: 'org-lowveld-1',
    userId: 'user-org-demo-2',
    orgRole: 'analyst',
    status: 'active',
    joinedAt: now,
  };
  upsertById(db.organisationMemberships, extraMem);

  const demoProjects: OrganisationProject[] = [
    {
      id: 'orgproj-demo-1',
      organisationId: 'org-lowveld-1',
      title: 'Subtropical & Midlands Climate-Smart Horticulture Programme',
      programmeCode: 'LMGC-CSH-2026',
      province: 'Mpumalanga & KwaZulu-Natal',
      focusArea: 'Drip Irrigation Efficiency, Contour Drainage & Soil Lab Adoption',
      status: 'active',
      startDate: '2026-07-01',
      targetEndDate: '2027-06-30',
      targetFarmsCount: 25,
      targetHectares: 180,
      budgetAllocatedZar: 420000,
      budgetSpentZar: 186500,
      leadSpecialistUserId: 'user-expert-1',
      summary:
        'DEMONSTRATION PROGRAMME: Supports cooperative growers with baseline lab soil testing, drip maintenance training, and rainfall variance logging.',
      isDemonstration: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'orgproj-demo-2',
      organisationId: 'org-lowveld-1',
      title: 'Small-Stock Biosecurity & Dryland Fodder Resilience Drive',
      programmeCode: 'LMGC-LBR-2026',
      province: 'Eastern Cape & Free State',
      focusArea: 'Rotational Grazing, Parasite Monitoring & Fodder Reserves',
      status: 'active',
      startDate: '2026-08-15',
      targetEndDate: '2027-05-31',
      targetFarmsCount: 15,
      targetHectares: 240,
      budgetAllocatedZar: 280000,
      budgetSpentZar: 112000,
      leadSpecialistUserId: 'user-expert-livestock-3',
      summary:
        'DEMONSTRATION PROGRAMME: Pairs lucerne fodder budgeting with scheduled herd vaccination and winter lambing shelter readiness.',
      isDemonstration: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
  for (const pr of demoProjects) upsertById(db.organisationProjects, pr);

  const demoActivities: OrganisationProgrammeActivity[] = [
    {
      id: 'orgact-demo-1',
      organisationId: 'org-lowveld-1',
      projectId: 'orgproj-demo-1',
      title: 'uMngeni & Onderberg Soil Sampling & Drip Calibration Field Day',
      activityType: 'field_day',
      activityDate: sastDaysAgo(15),
      province: 'KwaZulu-Natal',
      district: 'uMgungundlovu District',
      participantsCount: 28,
      farmsReachedCount: 12,
      costZar: 18400,
      facilitatorName: 'Nomvula Cele & Mornay Adams (Demo)',
      outcomesSummary:
        'Demonstrated 0–20 cm composite soil core sampling and emitter flow-rate checks.',
      isDemonstration: true,
      createdAt: now,
    },
    {
      id: 'orgact-demo-2',
      organisationId: 'org-lowveld-1',
      projectId: 'orgproj-demo-2',
      title: 'Amathole & Free State Winter Fodder & Herd Vaccination Clinic',
      activityType: 'vaccination_campaign',
      activityDate: sastDaysAgo(9),
      province: 'Eastern Cape',
      district: 'Amathole District',
      participantsCount: 19,
      farmsReachedCount: 9,
      costZar: 24200,
      facilitatorName: 'Hendrik Cronje & Thandi Nkosi (Demo)',
      outcomesSummary:
        'Reviewed FAMACHA scoring, pulpy kidney calendars, and lucerne hay rationing.',
      isDemonstration: true,
      createdAt: now,
    },
    {
      id: 'orgact-demo-3',
      organisationId: 'org-lowveld-1',
      projectId: 'orgproj-demo-1',
      title: 'Multilingual Crop Loss & Stock Ledger Training Workshop',
      activityType: 'training_workshop',
      activityDate: sastDaysAgo(4),
      province: 'Mpumalanga',
      district: 'Ehlanzeni District',
      participantsCount: 34,
      farmsReachedCount: 16,
      costZar: 14800,
      facilitatorName: 'Tshilidzi Ramabulana & Lindiwe Sithole (Demo)',
      outcomesSummary:
        'Guided growers through offline field logging and transparent gross-margin break-even calculations.',
      isDemonstration: true,
      createdAt: now,
    },
  ];
  for (const act of demoActivities) upsertById(db.organisationProgrammeActivities, act);

  const demoOrgSpecialists: OrganisationSpecialistAssignment[] = [
    {
      id: 'orgspec-demo-1',
      organisationId: 'org-lowveld-1',
      projectId: 'orgproj-demo-1',
      expertUserId: 'user-expert-1',
      expertName: 'Dr. Pieter van der Merwe',
      specialisation: 'agronomist',
      assignedRegion: 'KwaZulu-Natal & Free State',
      status: 'active',
      assignedAt: sastDaysAgo(40),
      isDemonstration: true,
    },
    {
      id: 'orgspec-demo-2',
      organisationId: 'org-lowveld-1',
      projectId: 'orgproj-demo-1',
      expertUserId: 'user-expert-water-5',
      expertName: 'Mornay Adams (Demo Irrigation & Water Specialist)',
      specialisation: 'irrigation_water_specialist',
      assignedRegion: 'Mpumalanga & Western Cape',
      status: 'active',
      assignedAt: sastDaysAgo(32),
      isDemonstration: true,
    },
    {
      id: 'orgspec-demo-3',
      organisationId: 'org-lowveld-1',
      projectId: 'orgproj-demo-2',
      expertUserId: 'user-expert-livestock-3',
      expertName: 'Hendrik Cronje (Demo Livestock Specialist)',
      specialisation: 'livestock_specialist',
      assignedRegion: 'Eastern Cape & Free State',
      status: 'active',
      assignedAt: sastDaysAgo(28),
      isDemonstration: true,
    },
    {
      id: 'orgspec-demo-4',
      organisationId: 'org-lowveld-1',
      projectId: 'orgproj-demo-1',
      expertUserId: 'user-expert-ext-8',
      expertName: 'Tshilidzi Ramabulana (Demo Extension Officer)',
      specialisation: 'extension_officer',
      assignedRegion: 'Limpopo & Mpumalanga',
      status: 'active',
      assignedAt: sastDaysAgo(21),
      isDemonstration: true,
    },
  ];
  for (const os of demoOrgSpecialists) upsertById(db.organisationSpecialistAssignments, os);

  // 16. Ensure demo notifications exist for new demo roles
  const extraNotifications: Notification[] = [
    {
      id: 'notif-demo-ec-1',
      userId: 'user-existing-ec-3',
      title: 'Active Livestock Alert — Stutterheim Merino Flock',
      message:
        'DEMONSTRATION DATA: Internal parasite pressure logged on Kubusi Camp A. Coordinate drench check with an accredited local veterinarian.',
      category: 'agricultural_incident',
      priority: 'high',
      isMandatorySecurity: false,
      languageCode: 'xh',
      relatedEntityType: 'FarmIncident',
      relatedEntityId: 'inc-ec-sheep-4',
      isRead: false,
      actionUrl: 'incidents',
      createdAt: now,
    },
    {
      id: 'notif-demo-gp-prosp',
      userId: 'user-prospective-demo-2',
      title: 'Magaliesburg Tunnel Feasibility Scenario Ready',
      message:
        'DEMONSTRATION DATA: Review your 1.5 ha baby spinach & herbs startup budget and borehole water checklist in the Business Planner.',
      category: 'upcoming_activity',
      priority: 'normal',
      isMandatorySecurity: false,
      languageCode: 'tn',
      relatedEntityType: 'BusinessPlanScenario',
      relatedEntityId: 'bplan-demo-prospective-gp-3',
      isRead: false,
      actionUrl: 'planner',
      createdAt: now,
    },
  ];
  for (const n of extraNotifications) upsertById(db.notifications, n);

  if (db.demoSeedVersion !== DEMO_SEED_VERSION) {
    db.demoSeedVersion = DEMO_SEED_VERSION;
    changed = true;
  }

  return changed;
}

export function resetDemonstrationRecordsPreservingReal(
  db: DatabaseSchema,
  freshSeedBuilder: () => DatabaseSchema,
  rolePermissionMap: Record<RoleCode, string[]>,
  hashPasswordFn: (password: string) => { hash: string; salt: string }
): {
  removedDemoUsers: number;
  removedDemoFarms: number;
  preservedRealUsers: number;
  preservedRealFarms: number;
} {
  const realUsers = db.users.filter((u) => !u.isDemonstration && !ALL_DEMO_USER_IDS.has(u.id));
  const realUserIds = new Set(realUsers.map((u) => u.id));
  const realFarms = db.farms.filter((f) => !f.isDemonstration && !ALL_DEMO_FARM_IDS.has(f.id));
  const realFarmIds = new Set(realFarms.map((f) => f.id));

  const removedDemoUsers = db.users.length - realUsers.length;
  const removedDemoFarms = db.farms.length - realFarms.length;

  const fresh = freshSeedBuilder();

  // Merge non-demo user-owned records back into a clean fresh demonstration base
  const mergeUniqueById = <T extends { id: string }>(freshArr: T[], realArr: T[]): T[] => {
    const map = new Map<string, T>();
    for (const item of freshArr) map.set(item.id, item);
    for (const item of realArr) map.set(item.id, item);
    return Array.from(map.values());
  };

  db.users = mergeUniqueById(fresh.users, realUsers);
  db.userProfiles = mergeUniqueById(
    fresh.userProfiles,
    db.userProfiles.filter((p) => realUserIds.has(p.userId))
  );
  db.userPermissions = mergeUniqueById(
    fresh.userPermissions,
    db.userPermissions.filter((p) => p.userId && realUserIds.has(p.userId))
  );
  db.farms = mergeUniqueById(fresh.farms, realFarms);
  db.farmLocations = mergeUniqueById(
    fresh.farmLocations,
    db.farmLocations.filter((l) => realFarmIds.has(l.farmId))
  );
  db.farmBoundaries = mergeUniqueById(
    fresh.farmBoundaries,
    db.farmBoundaries.filter((b) => realFarmIds.has(b.farmId))
  );
  db.fields = mergeUniqueById(
    fresh.fields,
    db.fields.filter((fl) => realFarmIds.has(fl.farmId))
  );
  db.crops = mergeUniqueById(
    fresh.crops,
    db.crops.filter((c) => realFarmIds.has(c.farmId) || realUserIds.has(c.ownerId))
  );
  db.cropActivities = mergeUniqueById(
    fresh.cropActivities,
    db.cropActivities.filter((a) => realFarmIds.has(a.farmId))
  );
  db.livestockGroups = mergeUniqueById(
    fresh.livestockGroups,
    db.livestockGroups.filter((lg) => realFarmIds.has(lg.farmId))
  );
  db.livestockRecords = mergeUniqueById(
    fresh.livestockRecords,
    db.livestockRecords.filter((lr) => realFarmIds.has(lr.farmId))
  );
  db.mixedFarmingEntries = mergeUniqueById(
    fresh.mixedFarmingEntries,
    db.mixedFarmingEntries.filter((m) => realFarmIds.has(m.farmId))
  );
  db.soilReports = mergeUniqueById(
    fresh.soilReports,
    db.soilReports.filter((s) => realFarmIds.has(s.farmId))
  );
  db.cropStockMovements = mergeUniqueById(
    fresh.cropStockMovements,
    db.cropStockMovements.filter((m) => realFarmIds.has(m.farmId))
  );
  db.stockPriceSettings = mergeUniqueById(
    fresh.stockPriceSettings,
    db.stockPriceSettings.filter((s) => realFarmIds.has(s.farmId))
  );
  db.farmIncidents = mergeUniqueById(
    fresh.farmIncidents,
    db.farmIncidents.filter((i) => realFarmIds.has(i.farmId))
  );
  db.weatherForecastRecords = mergeUniqueById(
    fresh.weatherForecastRecords,
    db.weatherForecastRecords.filter((w) => realFarmIds.has(w.farmId))
  );
  db.weatherObservations = mergeUniqueById(
    fresh.weatherObservations,
    db.weatherObservations.filter((w) => realFarmIds.has(w.farmId))
  );
  db.businessPlans = mergeUniqueById(
    fresh.businessPlans,
    db.businessPlans.filter((b) => realUserIds.has(b.ownerId))
  );
  db.aiInsightRecords = mergeUniqueById(
    fresh.aiInsightRecords,
    db.aiInsightRecords.filter((a) => realUserIds.has(a.userId))
  );
  db.savedProspectiveLocations = mergeUniqueById(
    fresh.savedProspectiveLocations,
    db.savedProspectiveLocations.filter((l) => realUserIds.has(l.userId))
  );
  db.expertProfiles = [
    ...fresh.expertProfiles,
    ...db.expertProfiles.filter((ep) => realUserIds.has(ep.userId)),
  ];
  db.consultationRequests = mergeUniqueById(
    fresh.consultationRequests,
    db.consultationRequests.filter(
      (c) => realUserIds.has(c.farmerUserId) || realUserIds.has(c.expertUserId)
    )
  );
  db.farmAccessGrants = mergeUniqueById(
    fresh.farmAccessGrants,
    db.farmAccessGrants.filter((g) => realFarmIds.has(g.farmId))
  );
  db.expertFeedbacks = mergeUniqueById(
    fresh.expertFeedbacks,
    db.expertFeedbacks.filter((f) => realFarmIds.has(f.farmId))
  );
  db.organisations = mergeUniqueById(
    fresh.organisations,
    db.organisations.filter((o) => realUserIds.has(o.ownerUserId))
  );
  db.organisationMemberships = mergeUniqueById(
    fresh.organisationMemberships,
    db.organisationMemberships.filter((m) => realUserIds.has(m.userId))
  );
  db.organisationProjects = mergeUniqueById(
    fresh.organisationProjects,
    db.organisationProjects.filter((p) => !p.isDemonstration)
  );
  db.organisationProgrammeActivities = mergeUniqueById(
    fresh.organisationProgrammeActivities,
    db.organisationProgrammeActivities.filter((a) => !a.isDemonstration)
  );
  db.organisationSpecialistAssignments = mergeUniqueById(
    fresh.organisationSpecialistAssignments,
    db.organisationSpecialistAssignments.filter((s) => !s.isDemonstration)
  );
  db.notifications = mergeUniqueById(
    fresh.notifications,
    db.notifications.filter((n) => realUserIds.has(n.userId))
  );

  applyDemoSeedFoundation(db, rolePermissionMap, hashPasswordFn);
  db.demoSeedVersion = DEMO_SEED_VERSION;

  return {
    removedDemoUsers,
    removedDemoFarms,
    preservedRealUsers: realUsers.length,
    preservedRealFarms: realFarms.length,
  };
}
