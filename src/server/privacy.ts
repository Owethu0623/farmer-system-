import { sastDaysAgo } from './saTime.ts';
import { store, verifyPassword } from './store.ts';
import { SanitizedUser } from './types.ts';

const SAFE_IMAGE_MIME_RE = /^image\/(jpeg|jpg|png|webp)$/i;
const SAFE_MEDIA_DATA_URL_RE = /^data:(image\/(?:jpeg|jpg|png|webp)|video\/(?:mp4|webm));base64,([A-Za-z0-9+/=]+)$/i;

export function validateSafeMediaDataUrl(
  dataUrl: string | null | undefined,
  maxMb = 15,
  allowVideo = false
): { valid: boolean; error?: string; mimeType?: string; sanitizedUrl?: string | null } {
  if (!dataUrl) {
    return { valid: true, sanitizedUrl: null };
  }
  if (typeof dataUrl !== 'string') {
    return { valid: false, error: 'Invalid media payload format.' };
  }
  const trimmed = dataUrl.trim();
  if (!trimmed) {
    return { valid: true, sanitizedUrl: null };
  }
  const match = SAFE_MEDIA_DATA_URL_RE.exec(trimmed);
  if (!match) {
    return {
      valid: false,
      error:
        'Unsupported or unsafe media format. Only JPEG, PNG, WebP images (and MP4/WebM video when supported) are permitted.',
    };
  }
  const mimeType = match[1].toLowerCase();
  if (!allowVideo && !SAFE_IMAGE_MIME_RE.test(mimeType)) {
    return {
      valid: false,
      error: 'Only JPEG, PNG, or WebP image previews are permitted here.',
    };
  }
  const base64Body = match[2];
  const estimatedBytes = Math.floor((base64Body.length * 3) / 4);
  const maxBytes = Math.max(1, maxMb) * 1024 * 1024;
  if (estimatedBytes > maxBytes) {
    return {
      valid: false,
      error: `Media exceeds the configured ${maxMb} MB safety limit.`,
    };
  }
  return { valid: true, mimeType, sanitizedUrl: trimmed };
}

export function buildPrivacySummary(user: SanitizedUser) {
  const ownedFarms = store.db.farms.filter((f) => f.ownerId === user.id);
  const ownedFarmIds = new Set(ownedFarms.map((f) => f.id));

  const activeSharingGrantsCount = store.db.farmAccessGrants.filter(
    (g) => g.farmerUserId === user.id && g.status === 'active'
  ).length;
  const activeSessionsCount = store.db.sessions.filter(
    (s) => s.userId === user.id && new Date(s.expiresAt).getTime() > Date.now()
  ).length;
  const storedMediaCount =
    store.db.visualAnalyses.filter(
      (v) => (v.ownerId === user.id || ownedFarmIds.has(v.farmId)) && v.mediaPreviewDataUrl
    ).length +
    store.db.farmIncidents.filter(
      (i) => (i.ownerId === user.id || ownedFarmIds.has(i.farmId)) && i.mediaPreviewDataUrl
    ).length;

  return {
    popiaComplianceNotice:
      'Field Shift protects your personal details, farm GPS coordinates, boundaries, financial plans, stock valuations, photographs, and videos under the South African Protection of Personal Information Act (POPIA). Organisations only view anonymised, non-financial aggregates unless explicitly authorised, and you may export or erase your records at any time.',
    sessionTimeoutHours: store.db.systemConfig.application.sessionTimeoutHours,
    maxMediaUploadMb: store.db.systemConfig.application.maxMediaUploadMb,
    activeSessionsCount,
    activeSharingGrantsCount,
    ownedFarmsCount: ownedFarms.length,
    storedMediaCount,
    retentionSchedule: [
      {
        category: 'Authentication Sessions & Reset Codes',
        rule: `Sessions expire automatically after ${store.db.systemConfig.application.sessionTimeoutHours} hours; password reset tokens expire in 30 minutes and are purged automatically.`,
      },
      {
        category: 'Coordinate Weather Forecast Snapshots',
        rule: 'Historical forecast comparison snapshots older than 90 days are purged unless linked to a retained weather observation.',
      },
      {
        category: 'Farm Locations, Media & Business Records',
        rule: 'Retained strictly while your account is active or until you delete individual records or erase your account.',
      },
      {
        category: 'Security & Advisory Audit Logs',
        rule: 'Preserved with PII anonymised upon account erasure to maintain tamper-evident operational integrity.',
      },
    ],
    protectedCategories: [
      'Personal identification & contact details',
      'GPS coordinates, farm boundaries & field polygons',
      'Estimated stock values, expenses & business plans',
      'Field inspection photographs & video frames',
      'Expert consultations & agricultural incident records',
    ],
  };
}

export function exportUserPersonalData(userId: string) {
  const user = store.db.users.find((u) => u.id === userId);
  if (!user) {
    throw new Error('User account not found.');
  }
  const profile = store.db.userProfiles.find((p) => p.userId === userId) || null;
  const ownedFarms = store.db.farms.filter((f) => f.ownerId === userId);
  const ownedFarmIds = new Set(ownedFarms.map((f) => f.id));

  return {
    exportedAt: new Date().toISOString(),
    popiaRightNotice:
      'Export generated under POPIA Section 23 (Access to Personal Information). Sensitive authentication secrets (password hashes and tokens) are excluded for security.',
    account: {
      id: user.id,
      email: user.email,
      preferredLanguageCode: user.preferredLanguageCode,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      onboardingCompleted: user.onboardingCompleted,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
    profile,
    notificationPreferences:
      store.db.notificationPreferences.find((np) => np.userId === userId) || null,
    farms: ownedFarms.map((farm) => ({
      ...farm,
      location: store.db.farmLocations.find((l) => l.farmId === farm.id) || null,
      boundary: store.db.farmBoundaries.find((b) => b.farmId === farm.id) || null,
      fields: store.db.fields.filter((fl) => fl.farmId === farm.id),
    })),
    crops: store.db.crops.filter((c) => ownedFarmIds.has(c.farmId) || c.ownerId === userId),
    cropActivities: store.db.cropActivities.filter(
      (a) => ownedFarmIds.has(a.farmId) || a.actorUserId === userId
    ),
    livestockGroups: store.db.livestockGroups.filter(
      (g) => ownedFarmIds.has(g.farmId) || g.ownerId === userId
    ),
    livestockRecords: store.db.livestockRecords.filter(
      (r) => ownedFarmIds.has(r.farmId) || r.actorUserId === userId
    ),
    mixedFarmingEntries: store.db.mixedFarmingEntries.filter(
      (m) => ownedFarmIds.has(m.farmId) || m.ownerId === userId
    ),
    soilReports: store.db.soilReports.filter(
      (sr) => ownedFarmIds.has(sr.farmId) || sr.ownerId === userId
    ),
    visualAnalyses: store.db.visualAnalyses
      .filter((va) => ownedFarmIds.has(va.farmId) || va.ownerId === userId)
      .map((va) => ({
        ...va,
        mediaPreviewDataUrl: va.mediaPreviewDataUrl ? '[media-attached-in-record]' : null,
      })),
    incidents: store.db.farmIncidents
      .filter((inc) => ownedFarmIds.has(inc.farmId) || inc.ownerId === userId)
      .map((inc) => ({
        ...inc,
        mediaPreviewDataUrl: inc.mediaPreviewDataUrl ? '[media-attached-in-record]' : null,
      })),
    weatherObservations: store.db.weatherObservations.filter(
      (w) => ownedFarmIds.has(w.farmId) || w.ownerId === userId
    ),
    businessPlans: store.db.businessPlans.filter((bp) => bp.ownerId === userId),
    savedProspectiveLocations: store.db.savedProspectiveLocations.filter(
      (sl) => sl.userId === userId
    ),
    savedRotationPlans: (store.db.savedRotationPlans || []).filter(
      (rp) => rp.userId === userId || ownedFarmIds.has(rp.farmId)
    ),
    learningProgress: store.db.learningProgress.filter((lp) => lp.userId === userId),
    aiInsights: store.db.aiInsightRecords.filter((ai) => ai.userId === userId),
    sharingGrantsGiven: store.db.farmAccessGrants.filter((g) => g.farmerUserId === userId),
    generatedReportsHistory: store.db.generatedReports.filter((r) => r.userId === userId),
    auditTrail: store.db.auditLogs
      .filter((a) => a.actorUserId === userId)
      .slice(0, 100),
  };
}

export function purgeExpiredArtifacts(actorUserId: string) {
  const nowMs = Date.now();
  const ninetyDaysAgoIso = sastDaysAgo(90);

  const beforeSessions = store.db.sessions.length;
  store.db.sessions = store.db.sessions.filter(
    (s) => new Date(s.expiresAt).getTime() > nowMs
  );
  const purgedSessions = beforeSessions - store.db.sessions.length;

  const beforeResetTokens = store.db.passwordResetTokens.length;
  store.db.passwordResetTokens = store.db.passwordResetTokens.filter(
    (t) => !t.usedAt && new Date(t.expiresAt).getTime() > nowMs - 86400000
  );
  const purgedResetTokens = beforeResetTokens - store.db.passwordResetTokens.length;

  const referencedForecastIds = new Set(
    store.db.weatherObservations
      .map((w) => w.comparedForecastRecordId)
      .filter((id): id is string => Boolean(id))
  );
  const beforeForecasts = store.db.weatherForecastRecords.length;
  store.db.weatherForecastRecords = store.db.weatherForecastRecords.filter(
    (w) => w.forecastDate >= ninetyDaysAgoIso || referencedForecastIds.has(w.id)
  );
  const purgedOldForecasts = beforeForecasts - store.db.weatherForecastRecords.length;

  store.logAudit(
    actorUserId,
    'POPIA_RETENTION_PURGE',
    'System',
    'retention',
    { purgedSessions, purgedResetTokens, purgedOldForecasts },
    '127.0.0.1'
  );
  store.save();

  return {
    purgedSessions,
    purgedResetTokens,
    purgedOldForecasts,
    ranAt: new Date().toISOString(),
  };
}

export function eraseUserAccountPopia(params: {
  userId: string;
  password: string;
  ipAddress?: string;
}): { erasedFarmsCount: number; erasedMediaCount: number } {
  const user = store.db.users.find((u) => u.id === params.userId);
  if (!user) {
    throw new Error('Account not found.');
  }
  const role = store.db.roles.find((r) => r.id === user.roleId);
  if (role?.code === 'system_administrator') {
    const activeAdmins = store.db.users.filter((u) => {
      const r = store.db.roles.find((rl) => rl.id === u.roleId);
      return r?.code === 'system_administrator' && u.isActive && u.id !== user.id;
    });
    if (activeAdmins.length === 0) {
      throw new Error('Cannot erase the last active System Administrator account.');
    }
  }
  if (!params.password || !verifyPassword(params.password, user.passwordHash, user.passwordSalt)) {
    throw new Error('Current password confirmation failed. Account erasure aborted.');
  }

  const ownedFarms = store.db.farms.filter((f) => f.ownerId === user.id);
  const ownedFarmIds = new Set(ownedFarms.map((f) => f.id));

  const erasedMediaCount =
    store.db.visualAnalyses.filter(
      (v) => (v.ownerId === user.id || ownedFarmIds.has(v.farmId)) && Boolean(v.mediaPreviewDataUrl)
    ).length +
    store.db.farmIncidents.filter(
      (i) => (i.ownerId === user.id || ownedFarmIds.has(i.farmId)) && Boolean(i.mediaPreviewDataUrl)
    ).length;

  // Cascade delete owned farm operational & spatial records
  store.db.farms = store.db.farms.filter((f) => !ownedFarmIds.has(f.id));
  store.db.farmLocations = store.db.farmLocations.filter((l) => !ownedFarmIds.has(l.farmId));
  store.db.farmBoundaries = store.db.farmBoundaries.filter((b) => !ownedFarmIds.has(b.farmId));
  store.db.fields = store.db.fields.filter((fl) => !ownedFarmIds.has(fl.farmId));
  store.db.crops = store.db.crops.filter((c) => !ownedFarmIds.has(c.farmId) && c.ownerId !== user.id);
  store.db.cropActivities = store.db.cropActivities.filter(
    (a) => !ownedFarmIds.has(a.farmId) && a.actorUserId !== user.id
  );
  store.db.livestockGroups = store.db.livestockGroups.filter(
    (g) => !ownedFarmIds.has(g.farmId) && g.ownerId !== user.id
  );
  store.db.livestockRecords = store.db.livestockRecords.filter(
    (r) => !ownedFarmIds.has(r.farmId) && r.actorUserId !== user.id
  );
  store.db.mixedFarmingEntries = store.db.mixedFarmingEntries.filter(
    (m) => !ownedFarmIds.has(m.farmId) && m.ownerId !== user.id
  );
  store.db.soilReports = store.db.soilReports.filter(
    (sr) => !ownedFarmIds.has(sr.farmId) && sr.ownerId !== user.id
  );
  store.db.visualAnalyses = store.db.visualAnalyses.filter(
    (v) => !ownedFarmIds.has(v.farmId) && v.ownerId !== user.id
  );
  store.db.cropStockMovements = store.db.cropStockMovements.filter(
    (cm) => !ownedFarmIds.has(cm.farmId) && cm.actorUserId !== user.id
  );
  store.db.stockPriceSettings = store.db.stockPriceSettings.filter(
    (sp) => !ownedFarmIds.has(sp.farmId) && sp.updatedByUserId !== user.id
  );
  store.db.farmIncidents = store.db.farmIncidents.filter(
    (inc) => !ownedFarmIds.has(inc.farmId) && inc.ownerId !== user.id
  );
  store.db.weatherForecastRecords = store.db.weatherForecastRecords.filter(
    (w) => !ownedFarmIds.has(w.farmId)
  );
  store.db.weatherObservations = store.db.weatherObservations.filter(
    (w) => !ownedFarmIds.has(w.farmId) && w.ownerId !== user.id
  );

  // Erase personal planning, sharing, expert/org links, notifications & sessions
  store.db.farmAccessGrants = store.db.farmAccessGrants.filter(
    (g) => g.farmerUserId !== user.id && g.granteeUserId !== user.id && !ownedFarmIds.has(g.farmId)
  );
  store.db.expertFeedbacks = store.db.expertFeedbacks.filter(
    (ef) => !ownedFarmIds.has(ef.farmId) && ef.expertUserId !== user.id
  );
  store.db.expertProfiles = store.db.expertProfiles.filter((ep) => ep.userId !== user.id);
  store.db.organisationMemberships = store.db.organisationMemberships.filter(
    (om) => om.userId !== user.id
  );
  store.db.businessPlans = store.db.businessPlans.filter((bp) => bp.ownerId !== user.id);
  store.db.savedProspectiveLocations = store.db.savedProspectiveLocations.filter(
    (sl) => sl.userId !== user.id
  );
  store.db.savedRotationPlans = (store.db.savedRotationPlans || []).filter(
    (rp) => rp.userId !== user.id && !ownedFarmIds.has(rp.farmId)
  );
  store.db.learningProgress = store.db.learningProgress.filter((lp) => lp.userId !== user.id);
  store.db.aiInsightRecords = store.db.aiInsightRecords.filter((ai) => ai.userId !== user.id);
  store.db.generatedReports = store.db.generatedReports.filter((r) => r.userId !== user.id);
  store.db.notifications = store.db.notifications.filter((n) => n.userId !== user.id);
  store.db.notificationPreferences = store.db.notificationPreferences.filter(
    (np) => np.userId !== user.id
  );
  store.db.notificationDeliveries = store.db.notificationDeliveries.filter(
    (nd) => nd.userId !== user.id
  );
  store.db.userPermissions = store.db.userPermissions.filter((up) => up.userId !== user.id);
  store.db.userProfiles = store.db.userProfiles.filter((up) => up.userId !== user.id);
  store.db.sessions = store.db.sessions.filter((s) => s.userId !== user.id);
  store.db.passwordResetTokens = store.db.passwordResetTokens.filter((t) => t.userId !== user.id);
  store.db.processedSyncIds = store.db.processedSyncIds.filter((p) => p.userId !== user.id);
  store.db.users = store.db.users.filter((u) => u.id !== user.id);

  // Anonymise user email in historical audit trail while preserving event integrity
  for (const log of store.db.auditLogs) {
    if (log.actorUserId === user.id) {
      log.actorEmail = '[erased-popia-user]';
      log.actorUserId = null;
    }
  }

  store.logAudit(
    null,
    'POPIA_ACCOUNT_ERASED',
    'User',
    user.id,
    {
      erasedFarmsCount: ownedFarms.length,
      erasedMediaCount,
    },
    params.ipAddress || '127.0.0.1'
  );
  store.save();

  return {
    erasedFarmsCount: ownedFarms.length,
    erasedMediaCount,
  };
}
