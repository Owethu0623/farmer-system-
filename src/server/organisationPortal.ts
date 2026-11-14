import crypto from 'node:crypto';
import { dispatchNotification } from './notifications.ts';
import { hashPassword, store } from './store.ts';
import {
  OrganisationMemberRole,
  OrganisationMembership,
  OrganisationProfile,
  OrganisationProgrammeActivity,
  OrganisationProject,
  OrganisationSpecialistAssignment,
  OrganisationType,
  SanitizedUser,
} from './types.ts';

export function getUserOrganisation(userId: string): OrganisationProfile | null {
  const mem = store.db.organisationMemberships.find(
    (m) => m.userId === userId && m.status === 'active'
  );
  if (mem) {
    const org = store.db.organisations.find((o) => o.id === mem.organisationId);
    if (org) return org;
  }
  return store.db.organisations.find((o) => o.ownerUserId === userId) || null;
}

export function registerOrUpdateOrganisation(params: {
  user: SanitizedUser;
  name: string;
  organisationType: OrganisationType;
  registrationNumber?: string;
  province?: string;
  district?: string;
  primaryFocus?: string;
  contactEmail?: string;
  contactPhone?: string;
  description?: string;
}): OrganisationProfile {
  const existing = getUserOrganisation(params.user.id);
  const now = new Date().toISOString();

  if (existing) {
    existing.name = params.name.trim() || existing.name;
    existing.organisationType = params.organisationType || existing.organisationType;
    if (params.registrationNumber !== undefined) {
      existing.registrationNumber = params.registrationNumber.trim();
    }
    if (params.province !== undefined) existing.province = params.province.trim();
    if (params.district !== undefined) existing.district = params.district.trim();
    if (params.primaryFocus !== undefined) existing.primaryFocus = params.primaryFocus.trim();
    if (params.contactEmail !== undefined) existing.contactEmail = params.contactEmail.trim();
    if (params.contactPhone !== undefined) existing.contactPhone = params.contactPhone.trim();
    if (params.description !== undefined) existing.description = params.description.trim();
    existing.updatedAt = now;
    store.logAudit(
      params.user.id,
      'ORGANISATION_PROFILE_UPDATED',
      'OrganisationProfile',
      existing.id,
      { name: existing.name, organisationType: existing.organisationType },
      '127.0.0.1'
    );
    store.save();
    return existing;
  }

  const org: OrganisationProfile = {
    id: `org-${crypto.randomUUID()}`,
    name: params.name.trim(),
    organisationType: params.organisationType,
    registrationNumber: (params.registrationNumber || '').trim(),
    province: (params.province || params.user.profile?.province || 'Mpumalanga').trim(),
    district: (params.district || params.user.profile?.district || '').trim(),
    primaryFocus: (params.primaryFocus || 'Smallholder & Commercial Farm Support').trim(),
    contactEmail: (params.contactEmail || params.user.email).trim(),
    contactPhone: (params.contactPhone || params.user.profile?.phoneNumber || '').trim(),
    description: (params.description || '').trim(),
    ownerUserId: params.user.id,
    createdAt: now,
    updatedAt: now,
  };
  store.db.organisations.push(org);
  store.db.organisationMemberships.push({
    id: `orgmem-${crypto.randomUUID()}`,
    organisationId: org.id,
    userId: params.user.id,
    orgRole: 'owner',
    status: 'active',
    joinedAt: now,
  });

  store.logAudit(
    params.user.id,
    'ORGANISATION_REGISTERED',
    'OrganisationProfile',
    org.id,
    { name: org.name, organisationType: org.organisationType },
    '127.0.0.1'
  );
  store.save();
  return org;
}

export function getOrganisationMembersView(orgId: string) {
  return store.db.organisationMemberships
    .filter((m) => m.organisationId === orgId)
    .map((m) => {
      const user = store.db.users.find((u) => u.id === m.userId);
      const profile = store.db.userProfiles.find((p) => p.userId === m.userId);
      const role = user ? store.db.roles.find((r) => r.id === user.roleId) : null;
      return {
        membershipId: m.id,
        userId: m.userId,
        fullName: profile?.fullName || user?.email || 'Member',
        email: user?.email || '',
        roleName: role?.name || 'Organisation Member',
        orgRole: m.orgRole,
        status: m.status,
        joinedAt: m.joinedAt,
      };
    });
}

export function addOrganisationMember(params: {
  actorUser: SanitizedUser;
  orgId: string;
  fullName: string;
  email: string;
  orgRole: OrganisationMemberRole;
  tempPassword?: string;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  const now = new Date().toISOString();
  let user = store.db.users.find((u) => u.email === normalizedEmail);

  if (!user) {
    const orgRoleObj = store.db.roles.find((r) => r.code === 'organisation_manager');
    if (!orgRoleObj) throw new Error('Organisation Manager role not found.');
    const pw = hashPassword(params.tempPassword || 'FieldShift2026!');
    const newUserId = `user-${crypto.randomUUID()}`;
    user = {
      id: newUserId,
      email: normalizedEmail,
      passwordHash: pw.hash,
      passwordSalt: pw.salt,
      roleId: orgRoleObj.id,
      preferredLanguageCode: 'en',
      isActive: true,
      isEmailVerified: true,
      onboardingCompleted: true,
      activationToken: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };
    store.db.users.push(user);
    store.db.userProfiles.push({
      id: `prof-${crypto.randomUUID()}`,
      userId: newUserId,
      fullName: params.fullName.trim(),
      phoneNumber: '',
      province: params.actorUser.profile?.province || 'South Africa',
      district: '',
      farmerExperienceYears: 0,
      accessibilityLargeText: false,
      accessibilityAudioGuidance: false,
      accessibilityVoiceInput: false,
      prospectiveData: null,
      bio: `Team member at organisation.`,
      createdAt: now,
      updatedAt: now,
    });
  }

  const existingMem = store.db.organisationMemberships.find(
    (m) => m.organisationId === params.orgId && m.userId === user!.id
  );
  if (existingMem) {
    existingMem.orgRole = params.orgRole;
    existingMem.status = 'active';
    store.save();
    return existingMem;
  }

  const membership: OrganisationMembership = {
    id: `orgmem-${crypto.randomUUID()}`,
    organisationId: params.orgId,
    userId: user.id,
    orgRole: params.orgRole,
    status: 'active',
    joinedAt: now,
  };
  store.db.organisationMemberships.push(membership);
  store.logAudit(
    params.actorUser.id,
    'ORGANISATION_MEMBER_ADDED',
    'OrganisationMembership',
    membership.id,
    { organisationId: params.orgId, memberEmail: normalizedEmail, orgRole: params.orgRole },
    '127.0.0.1'
  );
  store.save();

  dispatchNotification({
    userId: user.id,
    category: 'organisation_communication',
    title: 'Added to Organisation Workspace',
    message: `You have been assigned the '${params.orgRole}' role inside your agricultural organisation portal.`,
    actionUrl: 'dashboard',
    relatedEntityType: 'OrganisationMembership',
    relatedEntityId: membership.id,
  });

  return membership;
}

export function getAuthorisedOrgFarmGrants(userId: string) {
  const org = getUserOrganisation(userId);
  const orgId = org?.id || null;
  return store.db.farmAccessGrants.filter(
    (g) =>
      g.status === 'active' &&
      g.granteeType === 'organisation' &&
      ((orgId && g.organisationId === orgId) || g.granteeUserId === userId)
  );
}

export function buildOrganisationOverview(user: SanitizedUser) {
  const organisation = getUserOrganisation(user.id);
  const members = organisation ? getOrganisationMembersView(organisation.id) : [];
  const activeGrants = getAuthorisedOrgFarmGrants(user.id);

  // Deduplicate authorised farms and preserve privacy-protected reference codes
  const seenFarmIds = new Set<string>();
  const authorisedFarms: {
    farmId: string;
    farmReferenceCode: string;
    province: string;
    district: string;
    hectares: number;
    fieldCount: number;
    farmingCategories: string[];
    waterAvailability: string;
    cropsCount: number;
    harvestedKg: number;
    livestockHead: number;
    activeIncidentsCount: number;
    authorisedBasis: string;
    isDemonstration: boolean;
  }[] = [];

  let refCounter = 1;
  for (const grant of activeGrants) {
    if (seenFarmIds.has(grant.farmId)) continue;
    const farm = store.db.farms.find((f) => f.id === grant.farmId);
    if (!farm) continue;
    seenFarmIds.add(farm.id);

    const loc = store.db.farmLocations.find((l) => l.farmId === farm.id);
    const fields = store.db.fields.filter((fl) => fl.farmId === farm.id);
    const crops = grant.scopes.crops ? store.db.crops.filter((c) => c.farmId === farm.id) : [];
    const livestock = grant.scopes.livestock
      ? store.db.livestockGroups.filter((lg) => lg.farmId === farm.id)
      : [];
    const activeInc = grant.scopes.incidents
      ? store.db.farmIncidents.filter((i) => i.farmId === farm.id && i.status !== 'resolved').length
      : 0;

    authorisedFarms.push({
      farmId: farm.id,
      farmReferenceCode: `ORG-FARM-${String(refCounter).padStart(3, '0')}`,
      province: loc?.province || 'Unassigned',
      district: loc?.districtMunicipality || 'Unassigned',
      hectares: farm.farmSizeHectares,
      fieldCount: fields.length,
      farmingCategories: farm.farmingActivities,
      waterAvailability: farm.waterAvailability,
      cropsCount: crops.length,
      harvestedKg: Number(crops.reduce((s, c) => s + c.harvestedQuantityKg, 0).toFixed(1)),
      livestockHead: livestock.reduce((s, lg) => s + lg.quantity, 0),
      activeIncidentsCount: activeInc,
      authorisedBasis: grant.authorisedBasis,
      isDemonstration: Boolean(farm.isDemonstration),
    });
    refCounter++;
  }

  const farmIds = authorisedFarms.map((f) => f.farmId);

  // Provincial Distribution
  const provMap = new Map<
    string,
    { province: string; farmCount: number; hectares: number; cropCount: number; livestockHead: number; incidentsCount: number }
  >();
  for (const f of authorisedFarms) {
    const cur = provMap.get(f.province) || {
      province: f.province,
      farmCount: 0,
      hectares: 0,
      cropCount: 0,
      livestockHead: 0,
      incidentsCount: 0,
    };
    cur.farmCount += 1;
    cur.hectares = Number((cur.hectares + f.hectares).toFixed(1));
    cur.cropCount += f.cropsCount;
    cur.livestockHead += f.livestockHead;
    cur.incidentsCount += f.activeIncidentsCount;
    provMap.set(f.province, cur);
  }

  // Farming Categories Summary
  const catMap = new Map<string, { category: string; farmCount: number; hectares: number }>();
  for (const f of authorisedFarms) {
    for (const cat of f.farmingCategories.length ? f.farmingCategories : ['Mixed Farming']) {
      const cur = catMap.get(cat) || { category: cat, farmCount: 0, hectares: 0 };
      cur.farmCount += 1;
      cur.hectares = Number((cur.hectares + f.hectares).toFixed(1));
      catMap.set(cat, cur);
    }
  }

  // Crop & Livestock Summaries (without individual farmer financials or identity)
  const cropMap = new Map<string, { cropName: string; farms: Set<string>; hectares: number; harvestedKg: number }>();
  for (const c of store.db.crops.filter((x) => farmIds.includes(x.farmId))) {
    const cur = cropMap.get(c.cropName) || {
      cropName: c.cropName,
      farms: new Set<string>(),
      hectares: 0,
      harvestedKg: 0,
    };
    cur.farms.add(c.farmId);
    cur.hectares = Number((cur.hectares + c.cultivatedAreaHectares).toFixed(1));
    cur.harvestedKg = Number((cur.harvestedKg + c.harvestedQuantityKg).toFixed(1));
    cropMap.set(c.cropName, cur);
  }

  const lvkMap = new Map<string, { animalType: string; groupsCount: number; headCount: number }>();
  for (const lg of store.db.livestockGroups.filter((x) => farmIds.includes(x.farmId))) {
    const cur = lvkMap.get(lg.animalType) || { animalType: lg.animalType, groupsCount: 0, headCount: 0 };
    cur.groupsCount += 1;
    cur.headCount += lg.quantity;
    lvkMap.set(lg.animalType, cur);
  }

  // Weather Comparisons across authorised farms
  const weatherComparisons = authorisedFarms.map((af) => {
    const latestObs = store.db.weatherObservations
      .filter((o) => o.farmId === af.farmId)
      .sort((a, b) => b.observationDate.localeCompare(a.observationDate))[0];
    const latestFc = latestObs?.comparedForecastRecordId
      ? store.db.weatherForecastRecords.find((fc) => fc.id === latestObs.comparedForecastRecordId)
      : store.db.weatherForecastRecords
          .filter((fc) => fc.farmId === af.farmId)
          .sort((a, b) => b.forecastDate.localeCompare(a.forecastDate))[0];

    return {
      province: af.province,
      farmReferenceCode: af.farmReferenceCode,
      forecastRainMm: latestFc ? latestFc.predictedRainfallMm : null,
      farmerReportedRainMm: latestObs ? latestObs.measuredRainfallMm : null,
      avgTempC: latestObs?.temperatureC ?? (latestFc ? latestFc.predictedTempMaxC : null),
      observationDate: latestObs?.observationDate || latestFc?.forecastDate || null,
      qcStatus: latestObs?.qcStatus || null,
    };
  });

  // Agricultural Trend Analysis (monthly aggregation across harvests, incidents, weather observations)
  const monthBuckets = new Map<
    string,
    { period: string; harvestKg: number; incidentsCount: number; weatherObservationsCount: number }
  >();
  const touchMonth = (ym: string) => {
    const key = ym.slice(0, 7);
    if (!monthBuckets.has(key)) {
      monthBuckets.set(key, {
        period: key,
        harvestKg: 0,
        incidentsCount: 0,
        weatherObservationsCount: 0,
      });
    }
    return monthBuckets.get(key)!;
  };
  for (const m of store.db.cropStockMovements.filter(
    (mv) => farmIds.includes(mv.farmId) && mv.movementType === 'harvest'
  )) {
    touchMonth(m.movementDate).harvestKg += Math.abs(m.quantityDelta);
  }
  for (const inc of store.db.farmIncidents.filter((i) => farmIds.includes(i.farmId))) {
    touchMonth(inc.occurredAt).incidentsCount += 1;
  }
  for (const w of store.db.weatherObservations.filter((o) => farmIds.includes(o.farmId))) {
    touchMonth(w.observationDate).weatherObservationsCount += 1;
  }
  const trendAnalysis = Array.from(monthBuckets.values()).sort((a, b) =>
    a.period.localeCompare(b.period)
  );

  const projects = organisation
    ? (store.db.organisationProjects || []).filter((p) => p.organisationId === organisation.id)
    : [];
  const programmeActivities = organisation
    ? (store.db.organisationProgrammeActivities || [])
        .filter((a) => a.organisationId === organisation.id)
        .sort((a, b) => b.activityDate.localeCompare(a.activityDate))
    : [];
  const assignedSpecialists = organisation
    ? (store.db.organisationSpecialistAssignments || []).filter(
        (s) => s.organisationId === organisation.id
      )
    : [];

  // Financial summary ONLY aggregates farms that explicitly granted financialSummary scope
  const financialConsentedFarmIds = new Set(
    activeGrants
      .filter((g) => g.scopes.financialSummary)
      .map((g) => g.farmId)
  );
  const recordedFarmExpensesZar = Number(
    (
      store.db.mixedFarmingEntries
        .filter((m) => financialConsentedFarmIds.has(m.farmId))
        .reduce((s, m) => s + m.expenseZar, 0) +
      store.db.cropActivities
        .filter((a) => financialConsentedFarmIds.has(a.farmId) && a.activityType !== 'harvest')
        .reduce((s, a) => s + a.valueZar, 0) +
      store.db.livestockRecords
        .filter(
          (r) =>
            financialConsentedFarmIds.has(r.farmId) &&
            ['Purchase', 'Feeding', 'Veterinary', 'Vaccination'].includes(r.recordType)
        )
        .reduce((s, r) => s + r.valueZar, 0)
    ).toFixed(2)
  );
  const estimatedCropAndStockValueZar = Number(
    (
      store.db.crops
        .filter((c) => financialConsentedFarmIds.has(c.farmId))
        .reduce((s, c) => s + c.estimatedValueZar, 0) +
      store.db.livestockGroups
        .filter((lg) => financialConsentedFarmIds.has(lg.farmId))
        .reduce((s, lg) => s + lg.quantity * lg.estimatedUnitValueZar, 0)
    ).toFixed(2)
  );
  const programmeBudgetAllocatedZar = Number(
    projects.reduce((s, p) => s + p.budgetAllocatedZar, 0).toFixed(2)
  );
  const programmeBudgetSpentZar = Number(
    projects.reduce((s, p) => s + p.budgetSpentZar, 0).toFixed(2)
  );

  return {
    organisation,
    privacyNotice:
      'Privacy Protection Active: Individual farmer identities and private farm financial records are hidden unless the farmer explicitly grants financialSummary scope. Non-financial grants remain strictly anonymised.',
    members,
    projects,
    programmeActivities,
    assignedSpecialists,
    financialSummary: {
      financialScopedFarmsCount: financialConsentedFarmIds.size,
      totalAuthorisedFarmsCount: authorisedFarms.length,
      recordedFarmExpensesZar,
      estimatedCropAndStockValueZar,
      programmeBudgetAllocatedZar,
      programmeBudgetSpentZar,
      scopeNote: `Includes recorded farm financial totals ONLY from ${financialConsentedFarmIds.size} of ${authorisedFarms.length} authorised farms with explicit financialSummary consent, plus organisation programme budgets.`,
    },
    kpis: {
      totalAuthorisedFarms: authorisedFarms.length,
      totalHectares: Number(authorisedFarms.reduce((s, f) => s + f.hectares, 0).toFixed(1)),
      totalFields: authorisedFarms.reduce((s, f) => s + f.fieldCount, 0),
      activeFarmingCategories: catMap.size,
      totalLivestockHead: authorisedFarms.reduce((s, f) => s + f.livestockHead, 0),
      totalHarvestedKg: Number(authorisedFarms.reduce((s, f) => s + f.harvestedKg, 0).toFixed(1)),
      openIncidentsCount: authorisedFarms.reduce((s, f) => s + f.activeIncidentsCount, 0),
      activeProjectsCount: projects.filter((p) => p.status === 'active').length,
      programmeParticipantsCount: programmeActivities.reduce((s, a) => s + a.participantsCount, 0),
    },
    authorisedFarms,
    farmingCategoriesSummary: Array.from(catMap.values()),
    provincialDistribution: Array.from(provMap.values()),
    cropDistribution: Array.from(cropMap.values()).map((c) => ({
      cropName: c.cropName,
      farmsCount: c.farms.size,
      hectares: c.hectares,
      harvestedKg: c.harvestedKg,
    })),
    livestockDistribution: Array.from(lvkMap.values()),
    weatherComparisons,
    trendAnalysis,
  };
}

export function createOrganisationProject(params: {
  actorUser: SanitizedUser;
  title: string;
  programmeCode: string;
  province: string;
  focusArea: string;
  startDate: string;
  targetEndDate: string;
  targetFarmsCount: number;
  targetHectares: number;
  budgetAllocatedZar: number;
  summary: string;
}): OrganisationProject {
  const org = getUserOrganisation(params.actorUser.id);
  if (!org) throw new Error('Register an organisation profile first.');
  const now = new Date().toISOString();
  const project: OrganisationProject = {
    id: `orgproj-${crypto.randomUUID()}`,
    organisationId: org.id,
    title: params.title.trim(),
    programmeCode: params.programmeCode.trim() || `ORG-${Date.now().toString().slice(-4)}`,
    province: params.province.trim() || org.province,
    focusArea: params.focusArea.trim(),
    status: 'active',
    startDate: params.startDate || now.slice(0, 10),
    targetEndDate: params.targetEndDate || now.slice(0, 10),
    targetFarmsCount: Math.max(1, Number(params.targetFarmsCount) || 1),
    targetHectares: Math.max(0.5, Number(params.targetHectares) || 1),
    budgetAllocatedZar: Math.max(0, Number(params.budgetAllocatedZar) || 0),
    budgetSpentZar: 0,
    leadSpecialistUserId: null,
    summary: params.summary.trim(),
    isDemonstration: Boolean(params.actorUser.isDemonstration || org.isDemonstration),
    createdAt: now,
    updatedAt: now,
  };
  store.db.organisationProjects.unshift(project);
  store.logAudit(
    params.actorUser.id,
    'ORGANISATION_PROJECT_CREATED',
    'OrganisationProject',
    project.id,
    { title: project.title, programmeCode: project.programmeCode },
    '127.0.0.1'
  );
  store.save();
  return project;
}

export function createOrganisationProgrammeActivity(params: {
  actorUser: SanitizedUser;
  projectId?: string | null;
  title: string;
  activityType: OrganisationProgrammeActivity['activityType'];
  activityDate: string;
  province: string;
  district: string;
  participantsCount: number;
  farmsReachedCount: number;
  costZar: number;
  facilitatorName: string;
  outcomesSummary: string;
}): OrganisationProgrammeActivity {
  const org = getUserOrganisation(params.actorUser.id);
  if (!org) throw new Error('Register an organisation profile first.');
  const now = new Date().toISOString();
  const activity: OrganisationProgrammeActivity = {
    id: `orgact-${crypto.randomUUID()}`,
    organisationId: org.id,
    projectId: params.projectId || null,
    title: params.title.trim(),
    activityType: params.activityType,
    activityDate: params.activityDate || now.slice(0, 10),
    province: params.province.trim() || org.province,
    district: params.district.trim() || org.district,
    participantsCount: Math.max(0, Number(params.participantsCount) || 0),
    farmsReachedCount: Math.max(0, Number(params.farmsReachedCount) || 0),
    costZar: Math.max(0, Number(params.costZar) || 0),
    facilitatorName: params.facilitatorName.trim() || params.actorUser.profile?.fullName || 'Facilitator',
    outcomesSummary: params.outcomesSummary.trim(),
    isDemonstration: Boolean(params.actorUser.isDemonstration || org.isDemonstration),
    createdAt: now,
  };
  store.db.organisationProgrammeActivities.unshift(activity);
  if (activity.projectId) {
    const proj = store.db.organisationProjects.find((p) => p.id === activity.projectId);
    if (proj) {
      proj.budgetSpentZar = Number((proj.budgetSpentZar + activity.costZar).toFixed(2));
      proj.updatedAt = now;
    }
  }
  store.logAudit(
    params.actorUser.id,
    'ORGANISATION_ACTIVITY_LOGGED',
    'OrganisationProgrammeActivity',
    activity.id,
    { title: activity.title, costZar: activity.costZar },
    '127.0.0.1'
  );
  store.save();
  return activity;
}

export function assignOrganisationSpecialist(params: {
  actorUser: SanitizedUser;
  projectId?: string | null;
  expertUserId: string;
  assignedRegion: string;
}): OrganisationSpecialistAssignment {
  const org = getUserOrganisation(params.actorUser.id);
  if (!org) throw new Error('Register an organisation profile first.');
  const expertUser = store.db.users.find((u) => u.id === params.expertUserId);
  const expertProf = store.db.userProfiles.find((p) => p.userId === params.expertUserId);
  const expertMeta = store.db.expertProfiles.find((ep) => ep.userId === params.expertUserId);
  if (!expertUser || !expertMeta) throw new Error('Selected specialist profile not found.');

  const assignment: OrganisationSpecialistAssignment = {
    id: `orgspec-${crypto.randomUUID()}`,
    organisationId: org.id,
    projectId: params.projectId || null,
    expertUserId: expertUser.id,
    expertName: expertProf?.fullName || expertUser.email,
    specialisation: expertMeta.specialisation,
    assignedRegion: params.assignedRegion.trim() || org.province,
    status: 'active',
    assignedAt: new Date().toISOString().slice(0, 10),
    isDemonstration: Boolean(params.actorUser.isDemonstration || org.isDemonstration),
  };
  store.db.organisationSpecialistAssignments.unshift(assignment);
  store.logAudit(
    params.actorUser.id,
    'ORGANISATION_SPECIALIST_ASSIGNED',
    'OrganisationSpecialistAssignment',
    assignment.id,
    { expertUserId: expertUser.id, region: assignment.assignedRegion },
    '127.0.0.1'
  );
  store.save();
  return assignment;
}

export function broadcastOrganisationCommunication(params: {
  actorUser: SanitizedUser;
  title: string;
  message: string;
  targetAudience: 'authorised_farmers' | 'org_members' | 'all_connected';
  priority?: 'normal' | 'high';
}) {
  const org = getUserOrganisation(params.actorUser.id);
  const orgName = org?.name || 'Authorised Agricultural Organisation';
  const grants = getAuthorisedOrgFarmGrants(params.actorUser.id);
  const farmerIds = Array.from(new Set(grants.map((g) => g.farmerUserId)));
  const memberIds = org
    ? store.db.organisationMemberships
        .filter((m) => m.organisationId === org.id && m.status === 'active')
        .map((m) => m.userId)
    : [];

  const recipientSet = new Set<string>();
  if (params.targetAudience === 'authorised_farmers' || params.targetAudience === 'all_connected') {
    farmerIds.forEach((id) => recipientSet.add(id));
  }
  if (params.targetAudience === 'org_members' || params.targetAudience === 'all_connected') {
    memberIds.forEach((id) => recipientSet.add(id));
  }

  let deliveredCount = 0;
  let suppressedCount = 0;

  for (const uid of recipientSet) {
    const res = dispatchNotification({
      userId: uid,
      category: 'organisation_communication',
      title: `${orgName}: ${params.title.trim()}`,
      message: params.message.trim(),
      priority: params.priority || 'normal',
      actionUrl: 'notifications',
      relatedEntityType: 'Organisation',
      relatedEntityId: org?.id || null,
      prefixWithLanguageTag: true,
    });
    if (res.delivered) deliveredCount++;
    else if (res.suppressedReason) suppressedCount++;
  }

  store.logAudit(
    params.actorUser.id,
    'ORGANISATION_COMMUNICATION_SENT',
    'Organisation',
    org?.id || null,
    { title: params.title, targetAudience: params.targetAudience, deliveredCount, suppressedCount },
    '127.0.0.1'
  );

  return {
    recipientsEvaluated: recipientSet.size,
    deliveredCount,
    suppressedCount,
  };
}
