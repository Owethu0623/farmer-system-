import crypto from 'node:crypto';
import { dispatchNotification } from './notifications.ts';
import { store } from './store.ts';
import {
  ConsultationRequest,
  ExpertConcernCategory,
  ExpertFeedbackRecord,
  ExpertProfile,
  ExpertSpecialisation,
  FarmAccessGrant,
  FarmAccessScopes,
  LanguageCode,
  SanitizedUser,
} from './types.ts';

export const EXPERT_SPECIALISATION_LABELS: Record<ExpertSpecialisation, string> = {
  agronomist: 'Agronomist / Crop Production Specialist',
  soil_specialist: 'Soil Scientist',
  livestock_specialist: 'Livestock Production Specialist',
  veterinarian: 'Veterinary Professional',
  irrigation_water_specialist: 'Irrigation & Water Management Specialist',
  agricultural_economist: 'Agricultural Economist / Business Advisor',
  pest_disease_specialist: 'Pest & Disease Management Specialist',
  extension_officer: 'Agricultural Extension Officer',
  horticultural_specialist: 'Horticultural Specialist',
  agricultural_consultant: 'Agricultural Consultant',
};

const VALID_EXPERT_SPECIALISATIONS: ExpertSpecialisation[] = [
  'agronomist',
  'soil_specialist',
  'livestock_specialist',
  'veterinarian',
  'irrigation_water_specialist',
  'agricultural_economist',
  'pest_disease_specialist',
  'extension_officer',
  'horticultural_specialist',
  'agricultural_consultant',
];

const REGULATED_SPECIALISATIONS = new Set<ExpertSpecialisation>([
  'veterinarian',
  'soil_specialist',
  'agronomist',
  'pest_disease_specialist',
  'irrigation_water_specialist',
]);

export function getOrCreateExpertProfile(userId: string): ExpertProfile {
  const existing = store.db.expertProfiles.find((ep) => ep.userId === userId);
  if (existing) return existing;

  const user = store.db.users.find((u) => u.id === userId);
  const userProf = store.db.userProfiles.find((p) => p.userId === userId);
  const created: ExpertProfile = {
    userId,
    specialisation: 'agricultural_consultant',
    secondarySpecialisations: [],
    qualifications: 'Agricultural Advisory Profile',
    professionalBodyNumber: '',
    verificationStatus: user?.isDemonstration ? 'demo_unverified' : 'pending_verification',
    regulatedService: false,
    regulatoryBodyName: '',
    verificationNote: user?.isDemonstration
      ? 'DEMONSTRATION DATA — Unverified demonstration specialist profile.'
      : 'Pending statutory credential verification.',
    isDemonstration: Boolean(user?.isDemonstration),
    yearsExperience: userProf?.farmerExperienceYears || 2,
    provincesServed: userProf?.province ? [userProf.province] : ['KwaZulu-Natal'],
    languagesSpoken: ['en'],
    bio: userProf?.bio || 'Agricultural specialist supporting South African farmers.',
    availabilityStatus: 'available',
    updatedAt: new Date().toISOString(),
  };
  store.db.expertProfiles.push(created);
  store.save();
  return created;
}

export function updateExpertProfile(
  userId: string,
  payload: {
    specialisation?: ExpertSpecialisation;
    secondarySpecialisations?: ExpertSpecialisation[];
    qualifications?: string;
    professionalBodyNumber?: string;
    yearsExperience?: number;
    provincesServed?: string[];
    languagesSpoken?: LanguageCode[];
    bio?: string;
    availabilityStatus?: 'available' | 'limited' | 'unavailable';
    regulatoryBodyName?: string;
  }
): ExpertProfile {
  const profile = getOrCreateExpertProfile(userId);
  const validSpecs = VALID_EXPERT_SPECIALISATIONS;

  if (payload.specialisation && validSpecs.includes(payload.specialisation)) {
    profile.specialisation = payload.specialisation;
    profile.regulatedService = REGULATED_SPECIALISATIONS.has(payload.specialisation);
  }
  if (Array.isArray(payload.secondarySpecialisations)) {
    profile.secondarySpecialisations = payload.secondarySpecialisations.filter(
      (s) => validSpecs.includes(s) && s !== profile.specialisation
    );
  }
  if (typeof payload.qualifications === 'string') {
    profile.qualifications = payload.qualifications.trim();
  }
  if (typeof payload.professionalBodyNumber === 'string' && !profile.isDemonstration) {
    profile.professionalBodyNumber = payload.professionalBodyNumber.trim();
    if (profile.professionalBodyNumber && profile.verificationStatus !== 'verified') {
      profile.verificationStatus = 'pending_verification';
    }
  }
  if (typeof payload.regulatoryBodyName === 'string' && !profile.isDemonstration) {
    profile.regulatoryBodyName = payload.regulatoryBodyName.trim();
  }
  if (payload.yearsExperience !== undefined && Number.isFinite(Number(payload.yearsExperience))) {
    profile.yearsExperience = Math.max(0, Math.min(70, Number(payload.yearsExperience)));
  }
  if (Array.isArray(payload.provincesServed)) {
    profile.provincesServed = payload.provincesServed.map((p) => String(p).trim()).filter(Boolean);
  }
  if (Array.isArray(payload.languagesSpoken)) {
    const activeCodes = new Set(store.db.languages.map((l) => l.code));
    profile.languagesSpoken = payload.languagesSpoken.filter((c) => activeCodes.has(c));
  }
  if (typeof payload.bio === 'string') {
    profile.bio = payload.bio.trim();
  }
  if (
    payload.availabilityStatus &&
    ['available', 'limited', 'unavailable'].includes(payload.availabilityStatus)
  ) {
    profile.availabilityStatus = payload.availabilityStatus;
  }
  profile.updatedAt = new Date().toISOString();

  // Keep userProfile bio/experience synced cleanly
  const userProf = store.db.userProfiles.find((p) => p.userId === userId);
  if (userProf) {
    userProf.farmerExperienceYears = profile.yearsExperience;
    if (profile.bio) userProf.bio = profile.bio;
    userProf.updatedAt = profile.updatedAt;
  }

  store.save();
  return profile;
}

export function getCollaborationDirectory() {
  const expertRole = store.db.roles.find((r) => r.code === 'agricultural_expert');
  const experts = store.db.users
    .filter((u) => u.roleId === expertRole?.id && u.isActive)
    .map((u) => {
      const up = store.db.userProfiles.find((p) => p.userId === u.id);
      const ep = getOrCreateExpertProfile(u.id);
      return {
        userId: u.id,
        fullName: up?.fullName || u.email,
        province: up?.province || ep.provincesServed[0] || 'South Africa',
        district: up?.district || '',
        specialisation: ep.specialisation,
        qualifications: ep.qualifications,
        yearsExperience: ep.yearsExperience,
        availabilityStatus: ep.availabilityStatus,
        verificationStatus: ep.verificationStatus || 'demo_unverified',
        regulatedService: Boolean(ep.regulatedService),
        regulatoryBodyName: ep.regulatoryBodyName || '',
        isDemonstration: Boolean(u.isDemonstration || ep.isDemonstration),
      };
    });

  const organisations = store.db.organisations.map((org) => ({
    id: org.id,
    name: org.name,
    organisationType: org.organisationType,
    province: org.province,
    district: org.district,
    primaryFocus: org.primaryFocus,
    isDemonstration: Boolean(org.isDemonstration),
  }));

  return { experts, organisations };
}

export function getActiveFarmGrantForExpert(
  expertUserId: string,
  farmId: string
): FarmAccessGrant | null {
  return (
    store.db.farmAccessGrants.find(
      (g) =>
        g.status === 'active' &&
        g.farmId === farmId &&
        g.granteeType === 'expert' &&
        g.granteeUserId === expertUserId
    ) || null
  );
}

export function getActiveFarmGrantForOrganisationUser(
  userId: string,
  farmId: string
): FarmAccessGrant | null {
  const orgIds = store.db.organisationMemberships
    .filter((m) => m.userId === userId && m.status === 'active')
    .map((m) => m.organisationId);

  return (
    store.db.farmAccessGrants.find(
      (g) =>
        g.status === 'active' &&
        g.farmId === farmId &&
        g.granteeType === 'organisation' &&
        ((g.organisationId && orgIds.includes(g.organisationId)) || g.granteeUserId === userId)
    ) || null
  );
}

export function listFarmerAccessGrants(farmerUserId: string) {
  return store.db.farmAccessGrants
    .filter((g) => g.farmerUserId === farmerUserId)
    .map((g) => {
      const farm = store.db.farms.find((f) => f.id === g.farmId);
      return {
        ...g,
        farmName: farm?.name || 'Registered Farm',
      };
    })
    .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
}

export function grantFarmAccess(params: {
  farmerUser: SanitizedUser;
  farmId: string;
  granteeType: 'expert' | 'organisation';
  granteeUserId?: string | null;
  organisationId?: string | null;
  scopes?: Partial<FarmAccessScopes>;
  authorisedBasis?: string;
}): FarmAccessGrant {
  const { farmerUser, farmId, granteeType } = params;
  const farm = store.db.farms.find((f) => f.id === farmId);
  if (!farm) throw new Error('Farm not found.');
  if (farm.ownerId !== farmerUser.id && farmerUser.roleCode !== 'system_administrator') {
    throw new Error('Only the farm owner can grant access to this farm.');
  }

  let resolvedUserId: string | null = null;
  let resolvedOrgId: string | null = null;
  let granteeLabel = '';

  if (granteeType === 'expert') {
    const expertUser = store.db.users.find((u) => u.id === params.granteeUserId);
    const expertRole = store.db.roles.find((r) => r.code === 'agricultural_expert');
    if (!expertUser || expertUser.roleId !== expertRole?.id) {
      throw new Error('Selected agricultural expert was not found.');
    }
    const up = store.db.userProfiles.find((p) => p.userId === expertUser.id);
    const ep = getOrCreateExpertProfile(expertUser.id);
    resolvedUserId = expertUser.id;
    granteeLabel = `${up?.fullName || expertUser.email} (${EXPERT_SPECIALISATION_LABELS[ep.specialisation]})`;
  } else {
    const org = store.db.organisations.find((o) => o.id === params.organisationId);
    if (!org) {
      throw new Error('Selected organisation was not found.');
    }
    resolvedOrgId = org.id;
    resolvedUserId = org.ownerUserId;
    granteeLabel = org.name;
  }

  const scopes: FarmAccessScopes = {
    overview: params.scopes?.overview ?? true,
    crops: params.scopes?.crops ?? true,
    soil: params.scopes?.soil ?? true,
    livestock: params.scopes?.livestock ?? true,
    incidents: params.scopes?.incidents ?? true,
    aiInsights: params.scopes?.aiInsights ?? (granteeType === 'expert'),
    weather: params.scopes?.weather ?? true,
    financialSummary:
      granteeType === 'organisation' ? false : Boolean(params.scopes?.financialSummary),
  };

  // Update existing grant if found, otherwise create new
  const existing = store.db.farmAccessGrants.find(
    (g) =>
      g.farmId === farmId &&
      g.granteeType === granteeType &&
      ((granteeType === 'expert' && g.granteeUserId === resolvedUserId) ||
        (granteeType === 'organisation' && g.organisationId === resolvedOrgId))
  );

  const now = new Date().toISOString();
  if (existing) {
    existing.scopes = scopes;
    existing.granteeLabel = granteeLabel;
    existing.authorisedBasis =
      params.authorisedBasis?.trim() ||
      (granteeType === 'expert'
        ? 'Farmer explicit advisory grant'
        : 'Farmer authorised organisation oversight');
    existing.status = 'active';
    existing.grantedAt = now;
    existing.revokedAt = null;
    store.save();

    if (resolvedUserId) {
      dispatchNotification({
        userId: resolvedUserId,
        category: granteeType === 'expert' ? 'expert_feedback' : 'organisation_communication',
        title: `Farm Access Granted: ${farm.name}`,
        message: `${farmerUser.profile?.fullName || 'A farmer'} granted scoped ${granteeType} access to ${farm.name}.`,
        actionUrl: 'dashboard',
        relatedEntityType: 'FarmAccessGrant',
        relatedEntityId: existing.id,
      });
    }
    return existing;
  }

  const grant: FarmAccessGrant = {
    id: `grant-${crypto.randomUUID()}`,
    farmId,
    farmerUserId: farm.ownerId,
    granteeType,
    granteeUserId: resolvedUserId,
    organisationId: resolvedOrgId,
    granteeLabel,
    scopes,
    authorisedBasis:
      params.authorisedBasis?.trim() ||
      (granteeType === 'expert'
        ? 'Farmer explicit advisory grant'
        : 'Farmer authorised organisation oversight'),
    status: 'active',
    grantedAt: now,
    revokedAt: null,
  };

  store.db.farmAccessGrants.unshift(grant);
  store.logAudit(
    farmerUser.id,
    'FARM_ACCESS_GRANTED',
    'FarmAccessGrant',
    grant.id,
    { farmId, granteeType, granteeLabel, scopes },
    '127.0.0.1'
  );
  store.save();

  if (resolvedUserId) {
    dispatchNotification({
      userId: resolvedUserId,
      category: granteeType === 'expert' ? 'expert_feedback' : 'organisation_communication',
      title: `Farm Access Granted: ${farm.name}`,
      message: `${farmerUser.profile?.fullName || 'A farmer'} granted scoped ${granteeType} access to ${farm.name}.`,
      actionUrl: 'dashboard',
      relatedEntityType: 'FarmAccessGrant',
      relatedEntityId: grant.id,
    });
  }

  return grant;
}

export function revokeFarmAccessGrant(farmerUser: SanitizedUser, grantId: string): FarmAccessGrant {
  const grant = store.db.farmAccessGrants.find((g) => g.id === grantId);
  if (!grant) throw new Error('Access grant not found.');
  const farm = store.db.farms.find((f) => f.id === grant.farmId);
  if (
    grant.farmerUserId !== farmerUser.id &&
    farm?.ownerId !== farmerUser.id &&
    farmerUser.roleCode !== 'system_administrator'
  ) {
    throw new Error('Only the farm owner can revoke this access grant.');
  }

  grant.status = 'revoked';
  grant.revokedAt = new Date().toISOString();
  store.logAudit(
    farmerUser.id,
    'FARM_ACCESS_REVOKED',
    'FarmAccessGrant',
    grant.id,
    { farmId: grant.farmId, granteeType: grant.granteeType, granteeLabel: grant.granteeLabel },
    '127.0.0.1'
  );
  store.save();
  return grant;
}

export function buildExpertOverview(expertUser: SanitizedUser) {
  const profile = getOrCreateExpertProfile(expertUser.id);
  const activeGrants = store.db.farmAccessGrants.filter(
    (g) => g.status === 'active' && g.granteeType === 'expert' && g.granteeUserId === expertUser.id
  );
  const authorisedFarmIds = Array.from(new Set(activeGrants.map((g) => g.farmId)));

  const assignedFarms = activeGrants
    .map((g) => {
      const farm = store.db.farms.find((f) => f.id === g.farmId);
      if (!farm) return null;
      const loc = store.db.farmLocations.find((l) => l.farmId === farm.id);
      const farmerProf = store.db.userProfiles.find((p) => p.userId === farm.ownerId);
      const openInc = store.db.farmIncidents.filter(
        (i) => i.farmId === farm.id && i.status !== 'resolved'
      ).length;
      const cropsCount = store.db.crops.filter((c) => c.farmId === farm.id).length;
      const livestockHeadCount = store.db.livestockGroups
        .filter((lg) => lg.farmId === farm.id)
        .reduce((s, lg) => s + lg.quantity, 0);

      return {
        farmId: farm.id,
        farmName: farm.name,
        farmerUserId: farm.ownerId,
        farmerName: farmerProf?.fullName || 'Registered Farmer',
        province: loc?.province || 'South Africa',
        district: loc?.districtMunicipality || '',
        farmSizeHectares: farm.farmSizeHectares,
        farmingActivities: farm.farmingActivities,
        scopes: g.scopes,
        authorisedBasis: g.authorisedBasis,
        grantedAt: g.grantedAt,
        openIncidentsCount: openInc,
        cropsCount,
        livestockHeadCount,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const uniqueFarmerCount = new Set(assignedFarms.map((f) => f.farmerUserId)).size;

  // Build Open Agricultural Concerns queue ONLY from authorised farms and respecting scopes
  const openConcerns: {
    id: string;
    concernType: 'incident' | 'crop_concern' | 'livestock_concern' | 'ai_review';
    farmId: string;
    farmName: string;
    province: string;
    title: string;
    detail: string;
    severity: 'high' | 'medium' | 'normal';
    createdAt: string;
    linkedIncidentId?: string | null;
    linkedCropId?: string | null;
    linkedLivestockGroupId?: string | null;
    linkedAiInsightId?: string | null;
    hasExpertFeedback: boolean;
  }[] = [];

  for (const grant of activeGrants) {
    const farm = store.db.farms.find((f) => f.id === grant.farmId);
    if (!farm) continue;
    const loc = store.db.farmLocations.find((l) => l.farmId === farm.id);
    const province = loc?.province || 'South Africa';

    if (grant.scopes.incidents) {
      const incidents = store.db.farmIncidents.filter(
        (i) => i.farmId === farm.id && i.status !== 'resolved'
      );
      for (const inc of incidents) {
        const hasFb = store.db.expertFeedbacks.some(
          (ef) => ef.incidentId === inc.id && ef.expertUserId === expertUser.id
        );
        openConcerns.push({
          id: `concern-inc-${inc.id}`,
          concernType: 'incident',
          farmId: farm.id,
          farmName: farm.name,
          province,
          title: inc.title,
          detail: `${inc.incidentType.replace(/_/g, ' ')} · ${inc.affectedQuantity} ${inc.affectedUnit} affected`,
          severity: inc.status === 'active' ? 'high' : 'medium',
          createdAt: inc.occurredAt,
          linkedIncidentId: inc.id,
          linkedCropId: inc.cropId,
          linkedLivestockGroupId: inc.livestockGroupId,
          hasExpertFeedback: hasFb,
        });
      }
    }

    if (grant.scopes.crops) {
      const damagedCrops = store.db.crops.filter(
        (c) => c.farmId === farm.id && c.damagedPlants > 0 && c.status === 'active'
      );
      for (const crop of damagedCrops) {
        const hasFb = store.db.expertFeedbacks.some(
          (ef) => ef.cropId === crop.id && ef.expertUserId === expertUser.id
        );
        openConcerns.push({
          id: `concern-crop-${crop.id}`,
          concernType: 'crop_concern',
          farmId: farm.id,
          farmName: farm.name,
          province,
          title: `Crop Damage Review: ${crop.cropName} (${crop.cropVariety})`,
          detail: `${crop.damagedPlants.toLocaleString()} damaged plants of ${crop.plantingQuantity.toLocaleString()} planted`,
          severity: crop.damagedPlants / Math.max(1, crop.plantingQuantity) > 0.1 ? 'high' : 'medium',
          createdAt: crop.updatedAt,
          linkedCropId: crop.id,
          hasExpertFeedback: hasFb,
        });
      }
    }

    if (grant.scopes.livestock) {
      const healthConcerns = store.db.livestockGroups.filter(
        (lg) => lg.farmId === farm.id && lg.healthStatus !== 'Healthy'
      );
      for (const group of healthConcerns) {
        const hasFb = store.db.expertFeedbacks.some(
          (ef) => ef.livestockGroupId === group.id && ef.expertUserId === expertUser.id
        );
        openConcerns.push({
          id: `concern-lvk-${group.id}`,
          concernType: 'livestock_concern',
          farmId: farm.id,
          farmName: farm.name,
          province,
          title: `Livestock Health Alert: ${group.groupName}`,
          detail: `${group.quantity} ${group.animalType} (${group.breed}) marked ${group.healthStatus}`,
          severity: group.healthStatus === 'Quarantine' || group.healthStatus === 'Treatment' ? 'high' : 'medium',
          createdAt: group.updatedAt,
          linkedLivestockGroupId: group.id,
          hasExpertFeedback: hasFb,
        });
      }
    }

    if (grant.scopes.aiInsights) {
      const aiItems = store.db.aiInsightRecords.filter((ai) => ai.farmId === farm.id).slice(0, 4);
      for (const ai of aiItems) {
        const hasFb = store.db.expertFeedbacks.some(
          (ef) => ef.aiInsightId === ai.id && ef.expertUserId === expertUser.id
        );
        if (!hasFb) {
          openConcerns.push({
            id: `concern-ai-${ai.id}`,
            concernType: 'ai_review',
            farmId: farm.id,
            farmName: farm.name,
            province,
            title: `AI Recommendation Review: ${ai.title}`,
            detail: ai.summary.slice(0, 140),
            severity: 'normal',
            createdAt: ai.createdAt,
            linkedAiInsightId: ai.id,
            hasExpertFeedback: false,
          });
        }
      }
    }
  }

  const recentFeedback = store.db.expertFeedbacks
    .filter((ef) => ef.expertUserId === expertUser.id && authorisedFarmIds.includes(ef.farmId))
    .map((ef) => {
      const farm = store.db.farms.find((f) => f.id === ef.farmId);
      return { ...ef, farmName: farm?.name || 'Authorised Farm' };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const pendingReviewsCount =
    openConcerns.filter((c) => !c.hasExpertFeedback).length +
    recentFeedback.filter((ef) => ef.status === 'pending_review').length;

  const completedConsultationsCount = recentFeedback.filter((ef) => ef.status === 'completed').length;

  const activityRecords = store.db.auditLogs
    .filter((a) => a.actorUserId === expertUser.id)
    .slice(0, 30);

  const consultations = (store.db.consultationRequests || [])
    .filter((c) => c.expertUserId === expertUser.id)
    .map((c) => {
      const farm = store.db.farms.find((f) => f.id === c.farmId);
      const farmerProf = store.db.userProfiles.find((p) => p.userId === c.farmerUserId);
      return {
        ...c,
        farmName: farm?.name || 'Authorised Farm',
        farmerName: farmerProf?.fullName || 'Farmer',
        expertName: expertUser.profile?.fullName || expertUser.email,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    profile,
    stats: {
      assignedFarmersCount: uniqueFarmerCount,
      authorisedFarmsCount: assignedFarms.length,
      pendingReviewsCount,
      openConcernsCount: openConcerns.length,
      recentFeedbackCount: recentFeedback.length,
      completedConsultationsCount,
    },
    assignedFarms,
    openConcerns: openConcerns.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    recentFeedback,
    consultations,
    activityRecords,
  };
}

export function listConsultationsForUser(user: SanitizedUser) {
  const items = (store.db.consultationRequests || []).filter((c) => {
    if (user.roleCode === 'system_administrator') return true;
    if (user.roleCode === 'agricultural_expert') return c.expertUserId === user.id;
    return c.farmerUserId === user.id;
  });
  return items
    .map((c) => {
      const farm = store.db.farms.find((f) => f.id === c.farmId);
      const farmerProf = store.db.userProfiles.find((p) => p.userId === c.farmerUserId);
      const expertProf = store.db.userProfiles.find((p) => p.userId === c.expertUserId);
      return {
        ...c,
        farmName: farm?.name || 'Farm',
        farmerName: farmerProf?.fullName || 'Farmer',
        expertName: expertProf?.fullName || 'Agricultural Specialist',
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createConsultationRequest(params: {
  farmerUser: SanitizedUser;
  farmId: string;
  expertUserId: string;
  subject: string;
  description: string;
  urgency?: 'routine' | 'priority' | 'urgent';
}): ConsultationRequest {
  const farm = store.db.farms.find((f) => f.id === params.farmId);
  if (!farm) throw new Error('Farm not found.');
  if (farm.ownerId !== params.farmerUser.id && params.farmerUser.roleCode !== 'system_administrator') {
    throw new Error('Only the farm owner can request consultations for this farm.');
  }
  const ep = getOrCreateExpertProfile(params.expertUserId);
  const now = new Date().toISOString();
  const reqItem: ConsultationRequest = {
    id: `cons-${crypto.randomUUID()}`,
    farmId: farm.id,
    farmerUserId: params.farmerUser.id,
    expertUserId: params.expertUserId,
    specialistCategory: ep.specialisation,
    subject: params.subject.trim(),
    description: params.description.trim(),
    urgency: params.urgency || 'routine',
    status: 'requested',
    recommendationSummary: '',
    requestedAt: now.slice(0, 10),
    updatedAt: now,
    isDemonstration: Boolean(params.farmerUser.isDemonstration || farm.isDemonstration),
  };
  store.db.consultationRequests.unshift(reqItem);
  store.logAudit(
    params.farmerUser.id,
    'CONSULTATION_REQUESTED',
    'ConsultationRequest',
    reqItem.id,
    { farmId: farm.id, expertUserId: params.expertUserId, category: ep.specialisation },
    '127.0.0.1'
  );
  store.save();
  dispatchNotification({
    userId: params.expertUserId,
    category: 'expert_feedback',
    title: `New Consultation Request: ${reqItem.subject}`,
    message: `${params.farmerUser.profile?.fullName || 'Farmer'} requested a ${EXPERT_SPECIALISATION_LABELS[ep.specialisation]} review on ${farm.name}.`,
    priority: reqItem.urgency === 'urgent' ? 'high' : 'normal',
    actionUrl: 'dashboard',
    relatedEntityType: 'ConsultationRequest',
    relatedEntityId: reqItem.id,
  });
  return reqItem;
}

export function respondToConsultation(params: {
  expertUser: SanitizedUser;
  consultationId: string;
  status: 'in_review' | 'responded' | 'closed';
  recommendationSummary: string;
}): ConsultationRequest {
  const cons = (store.db.consultationRequests || []).find((c) => c.id === params.consultationId);
  if (!cons) throw new Error('Consultation request not found.');
  if (cons.expertUserId !== params.expertUser.id && params.expertUser.roleCode !== 'system_administrator') {
    throw new Error('Only the assigned specialist can update this consultation.');
  }
  cons.status = params.status;
  if (params.recommendationSummary?.trim()) {
    cons.recommendationSummary = params.recommendationSummary.trim();
  }
  cons.updatedAt = new Date().toISOString();
  store.logAudit(
    params.expertUser.id,
    'CONSULTATION_UPDATED',
    'ConsultationRequest',
    cons.id,
    { status: cons.status },
    '127.0.0.1'
  );
  store.save();
  dispatchNotification({
    userId: cons.farmerUserId,
    category: 'expert_feedback',
    title: `Consultation Update: ${cons.subject}`,
    message: cons.recommendationSummary || `Status updated to ${cons.status}.`,
    actionUrl: 'farms',
    relatedEntityType: 'ConsultationRequest',
    relatedEntityId: cons.id,
  });
  return cons;
}

export function buildExpertFarmReview(expertUser: SanitizedUser, farmId: string) {
  const grant = getActiveFarmGrantForExpert(expertUser.id, farmId);
  if (!grant && expertUser.roleCode !== 'system_administrator') {
    throw new Error('Access denied. The farmer has not granted you active access to this farm.');
  }

  const farm = store.db.farms.find((f) => f.id === farmId);
  if (!farm) throw new Error('Farm not found.');

  const location = store.db.farmLocations.find((l) => l.farmId === farmId) || null;
  const boundary = store.db.farmBoundaries.find((b) => b.farmId === farmId) || null;
  const fields = store.db.fields.filter((fl) => fl.farmId === farmId);
  const farmerProf = store.db.userProfiles.find((p) => p.userId === farm.ownerId);

  const scopes: FarmAccessScopes = grant?.scopes || {
    overview: true,
    crops: true,
    soil: true,
    livestock: true,
    incidents: true,
    aiInsights: true,
    weather: true,
    financialSummary: false,
  };

  const crops = scopes.crops ? store.db.crops.filter((c) => c.farmId === farmId) : [];
  const soilReports = scopes.soil ? store.db.soilReports.filter((s) => s.farmId === farmId) : [];
  const livestockGroups = scopes.livestock
    ? store.db.livestockGroups.filter((lg) => lg.farmId === farmId)
    : [];
  const incidents = scopes.incidents
    ? store.db.farmIncidents.filter((i) => i.farmId === farmId)
    : [];
  const aiInsights = scopes.aiInsights
    ? store.db.aiInsightRecords.filter((ai) => ai.farmId === farmId)
    : [];
  const feedbackHistory = store.db.expertFeedbacks
    .filter((ef) => ef.farmId === farmId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    farm: {
      ...farm,
      ownerName: farmerProf?.fullName || 'Registered Farmer',
      location,
      boundary,
      fields,
    },
    farmerName: farmerProf?.fullName || 'Registered Farmer',
    scopes,
    crops,
    soilReports,
    livestockGroups,
    incidents,
    aiInsights,
    feedbackHistory,
  };
}

export function submitExpertFeedback(params: {
  expertUser: SanitizedUser;
  farmId: string;
  concernCategory: ExpertConcernCategory;
  subject: string;
  assessment: string;
  recommendations: string[];
  status: 'pending_review' | 'in_progress' | 'completed';
  incidentId?: string | null;
  cropId?: string | null;
  livestockGroupId?: string | null;
  soilReportId?: string | null;
  aiInsightId?: string | null;
}): ExpertFeedbackRecord {
  const { expertUser, farmId } = params;
  const grant = getActiveFarmGrantForExpert(expertUser.id, farmId);
  if (!grant && expertUser.roleCode !== 'system_administrator') {
    throw new Error('You can only submit professional feedback for farms you are authorised to access.');
  }

  const farm = store.db.farms.find((f) => f.id === farmId);
  if (!farm) throw new Error('Target farm not found.');

  const ep = getOrCreateExpertProfile(expertUser.id);
  const now = new Date().toISOString();

  const record: ExpertFeedbackRecord = {
    id: `ef-${crypto.randomUUID()}`,
    expertUserId: expertUser.id,
    expertName: expertUser.profile?.fullName || expertUser.email,
    expertSpecialisation: ep.specialisation,
    farmId,
    incidentId: params.incidentId || null,
    cropId: params.cropId || null,
    livestockGroupId: params.livestockGroupId || null,
    soilReportId: params.soilReportId || null,
    aiInsightId: params.aiInsightId || null,
    concernCategory: params.concernCategory,
    subject: params.subject.trim(),
    assessment: params.assessment.trim(),
    recommendations: params.recommendations.map((r) => r.trim()).filter(Boolean),
    status: params.status,
    farmerAcknowledged: false,
    createdAt: now,
    updatedAt: now,
  };

  store.db.expertFeedbacks.unshift(record);
  store.logAudit(
    expertUser.id,
    'EXPERT_FEEDBACK_SUBMITTED',
    'ExpertFeedback',
    record.id,
    {
      farmId,
      concernCategory: record.concernCategory,
      incidentId: record.incidentId,
      status: record.status,
    },
    '127.0.0.1'
  );
  store.save();

  // Notify farmer respecting preferences
  dispatchNotification({
    userId: farm.ownerId,
    category: 'expert_feedback',
    title: `${record.expertName}: ${record.subject}`,
    message: `${record.assessment.slice(0, 220)}${record.assessment.length > 220 ? '...' : ''}`,
    priority: record.incidentId ? 'high' : 'normal',
    actionUrl: record.incidentId ? 'incidents' : 'farms',
    relatedEntityType: 'ExpertFeedback',
    relatedEntityId: record.id,
    prefixWithLanguageTag: true,
  });

  return record;
}
