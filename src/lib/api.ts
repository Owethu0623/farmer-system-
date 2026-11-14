import type {
  AuthUser,
  ConsultationRequestItem,
  OrganisationProgrammeActivityItem,
  OrganisationProjectItem,
  OrganisationSpecialistAssignmentItem,
  PublicDatasetRecord,
} from '../types';

const TOKEN_STORAGE_KEY = 'fieldshift_session_token';

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Unexpected server response.' };
  }

  if (!res.ok) {
    throw new Error((data.error as string) || `Request failed (${res.status})`);
  }

  return data as T;
}

export interface GeocodeSearchCandidate {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
  province: string;
  district: string;
  townOrVillage: string;
  precision: 'exact_place' | 'approximate_municipality';
  source: string;
  warningMessage: string | null;
}

export interface GeocodeSearchResponse {
  query: string;
  results: GeocodeSearchCandidate[];
  disclaimer: string;
}

export function geocodeSearch(query: string): Promise<GeocodeSearchResponse> {
  return apiRequest<GeocodeSearchResponse>(
    `/api/geocode/search?q=${encodeURIComponent(query.trim())}`
  );
}

export function fetchPublicDatasets(): Promise<{
  datasets: PublicDatasetRecord[];
  disclaimer: string;
}> {
  return apiRequest('/api/meta/datasets');
}

export function fetchConsultations(): Promise<ConsultationRequestItem[]> {
  return apiRequest<ConsultationRequestItem[]>('/api/consultations');
}

export function createConsultation(payload: {
  farmId: string;
  expertUserId: string;
  subject: string;
  description: string;
  urgency: 'routine' | 'priority' | 'urgent';
}): Promise<ConsultationRequestItem> {
  return apiRequest<ConsultationRequestItem>('/api/consultations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function respondToConsultation(
  consultationId: string,
  payload: { status: 'in_review' | 'responded' | 'closed'; recommendationSummary: string }
): Promise<ConsultationRequestItem> {
  return apiRequest<ConsultationRequestItem>(`/api/consultations/${consultationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function createOrganisationProject(payload: {
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
}): Promise<OrganisationProjectItem> {
  return apiRequest<OrganisationProjectItem>('/api/organisation/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createOrganisationActivity(payload: {
  projectId: string | null;
  title: string;
  activityType: OrganisationProgrammeActivityItem['activityType'];
  activityDate: string;
  province: string;
  district: string;
  participantsCount: number;
  farmsReachedCount: number;
  costZar: number;
  facilitatorName: string;
  outcomesSummary: string;
}): Promise<OrganisationProgrammeActivityItem> {
  return apiRequest<OrganisationProgrammeActivityItem>('/api/organisation/activities', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function assignOrganisationSpecialist(payload: {
  projectId: string | null;
  expertUserId: string;
  assignedRegion: string;
}): Promise<OrganisationSpecialistAssignmentItem> {
  return apiRequest<OrganisationSpecialistAssignmentItem>('/api/organisation/specialists', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface AdminEntitiesPayload {
  organisations: {
    id: string;
    name: string;
    organisationType: string;
    registrationNumber: string;
    province: string;
    district: string;
    primaryFocus: string;
    isDemonstration?: boolean;
    membersCount: number;
    authorisedFarmsCount: number;
    projectsCount: number;
  }[];
  specialists: {
    userId: string;
    fullName: string;
    email: string;
    isActive: boolean;
    isDemonstration: boolean;
    specialisation: string;
    qualifications: string;
    professionalBodyNumber: string;
    verificationStatus: string;
    regulatedService: boolean;
    regulatoryBodyName: string;
    provincesServed: string[];
    availabilityStatus: string;
    activeFarmGrantsCount: number;
    consultationsCount: number;
  }[];
}

export function fetchAdminEntities(): Promise<AdminEntitiesPayload> {
  return apiRequest<AdminEntitiesPayload>('/api/admin/entities');
}

export function resetAdminDemoData(): Promise<{
  ok: boolean;
  summary: Record<string, unknown>;
  message: string;
}> {
  return apiRequest('/api/admin/demo-data/reset', { method: 'POST' });
}

export function fetchSiteWeather(params: {
  province: string;
  district?: string;
  townOrArea?: string;
  siteName?: string;
  waterAvailability?: string;
  latitude?: number;
  longitude?: number;
}) {
  const qs = new URLSearchParams();
  qs.set('province', params.province);
  if (params.district) qs.set('district', params.district);
  if (params.townOrArea) qs.set('townOrArea', params.townOrArea);
  if (params.siteName) qs.set('siteName', params.siteName);
  if (params.waterAvailability) qs.set('waterAvailability', params.waterAvailability);
  if (params.latitude !== undefined) qs.set('latitude', String(params.latitude));
  if (params.longitude !== undefined) qs.set('longitude', String(params.longitude));
  return apiRequest<import('../types').WeatherIntelligence>(`/api/weather/site?${qs.toString()}`);
}

export function fetchSiteSoilLand(params: {
  province: string;
  district?: string;
  townOrArea?: string;
  siteName?: string;
  waterAvailability?: string;
  farmingType?: string;
  farmSizeHectares?: number;
}) {
  const qs = new URLSearchParams();
  qs.set('province', params.province);
  if (params.district) qs.set('district', params.district);
  if (params.townOrArea) qs.set('townOrArea', params.townOrArea);
  if (params.siteName) qs.set('siteName', params.siteName);
  if (params.waterAvailability) qs.set('waterAvailability', params.waterAvailability);
  if (params.farmingType) qs.set('farmingType', params.farmingType);
  if (params.farmSizeHectares !== undefined)
    qs.set('farmSizeHectares', String(params.farmSizeHectares));
  return apiRequest<import('../types').SoilLandIntelligence>(
    `/api/soil-land/site?${qs.toString()}`
  );
}

export function fetchCropRotationCatalog() {
  return apiRequest<import('../types').CropRotationCatalogOption[]>(
    '/api/crops/rotation-catalog'
  );
}

export function analyzeCropRotation(payload: {
  farmId?: string | null;
  province?: string;
  waterAvailability?: string;
  soilType?: string;
  soilPh?: number;
  farmSizeHectares?: number;
  farmerPriority?: string;
  selectedCrops?: string[];
}) {
  return apiRequest<import('../types').CropRotationAnalysisPayload>(
    '/api/crops/rotation-analysis',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export function submitLearningReadinessAssessment(answers: Record<string, string>) {
  return apiRequest<{
    result: { score: number; totalQuestions: number; passed: boolean };
    learningReadiness: import('../types').LearningReadinessStatus;
  }>('/api/learning/readiness-assessment', {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

export function transitionFarmerToExisting(payload: {
  farmName: string;
  province: string;
  districtMunicipality: string;
  localMunicipality: string;
  townOrVillage: string;
  locationDescription?: string;
  locationConfirmed?: boolean;
  latitude: number;
  longitude: number;
  locationSource: import('../types').LocationSource;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  gpsAccuracyMeters?: number | null;
  gpsCapturedAt?: string | null;
  farmSizeHectares: number;
  farmingActivities: string[];
  yearsOfExperience: number;
  waterAvailability: string;
  existingCrops?: string[];
  existingLivestock?: string[];
  tenureType: import('../types').FarmTenureRelationship;
  managementRelationshipNote?: string;
  linkedBusinessPlanIds?: string[];
  boundaryGeojson?: import('../types').GeoJsonPolygon | null;
}) {
  return apiRequest<{
    user: AuthUser;
    farm: import('../types').FarmItem;
    linkedPlansCount: number;
  }>('/api/farmer/transition-to-existing', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function revertFarmerToProspective(reason?: string) {
  return apiRequest<{ user: AuthUser; preservedFarmsCount: number }>(
    '/api/farmer/revert-to-prospective',
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );
}

export type { AuthUser };
