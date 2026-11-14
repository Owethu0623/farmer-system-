import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import {
  AuthRequest,
  clearSessionCookie,
  createAuthRateLimiter,
  createSessionForUser,
  extractSessionToken,
  requireAuth,
  requireRoles,
  sanitizeUser,
  securityHeadersMiddleware,
  setSessionCookie,
  validateEmail,
  validatePasswordStrength,
} from './src/server/auth.ts';
import {
  buildAdminEntitiesDirectory,
  buildAdminFarmOversight,
  buildAdminPortalOverview,
  buildLanguageTranslationAudit,
  getExternalIntegrationStatuses,
  getTranslationEntriesForLang,
} from './src/server/adminPortal.ts';
import {
  buildExistingFarmerDashboard,
  buildProspectiveFarmerDashboard,
} from './src/server/dashboardAnalytics.ts';
import { generateAgriculturalAdvice, generateFarmAiAnalytics } from './src/server/gemini.ts';
import { addIncidentFollowUp, buildIncidentDashboard, createFarmIncident } from './src/server/incidents.ts';
import {
  LEARNING_CATEGORIES,
  buildLearningCentrePayload,
  computeLearningReadiness,
  gradeReadinessAssessment,
  resolveMaterialForUser,
  userCanManageLearning,
} from './src/server/learningCentre.ts';
import { REPORT_TYPES, generateAndSaveReport } from './src/server/reporting.ts';
import { getPublicDatasetRegistry } from './src/server/publicDatasets.ts';
import {
  getFarmSoilAndLandIntelligence,
  getSiteSoilAndLandIntelligence,
} from './src/server/soilLandIntelligence.ts';
import {
  FARMER_PRIORITY_OPTIONS,
  SOUTH_AFRICA_ROTATION_CATALOG,
  analyzeCropRotationScenario,
  simulateRotationSequence,
} from './src/server/cropRotation.ts';
import type { SavedRotationPlan, SoilProvenanceType } from './src/server/types.ts';
import { computeCropStoredAndSold, buildStockOverview, recordCropStockMovement, updateStockUnitPrice } from './src/server/stockInventory.ts';
import { enrichVisualAnalysis, runVisualAgriculturalAnalysis } from './src/server/visualAnalysis.ts';
import { getNasaRegistrySummary } from './src/server/nasaPowerService.ts';
import { getFarmWeatherIntelligence, getSiteWeatherIntelligence } from './src/server/weather.ts';
import {
  buildWeatherFeedbackOverview,
  generateAiLocalWeatherSummary,
  recordForecastSnapshots,
  submitFarmerWeatherObservation,
} from './src/server/weatherFeedback.ts';
import {
  buildBusinessPlannerOverview,
  computeBusinessPlanMetrics,
} from './src/server/businessPlanner.ts';
import { getSastDateString } from './src/server/saTime.ts';
import {
  BEGINNER_GUIDES,
  FARMING_OPPORTUNITIES,
  SOUTH_AFRICA_PROVINCES,
  estimateSaElevationMeters,
  validateSaCoordinates,
} from './src/server/southAfricaData.ts';
import {
  calculatePolygonAreaHectares,
  calculatePolygonPerimeterMeters,
  pointToWkt,
  polygonToWkt,
} from './src/server/spatial.ts';
import {
  ROLE_PERMISSION_MAP,
  hashPassword,
  hashToken,
  store,
  verifyPassword,
} from './src/server/store.ts';
import {
  buildExpertFarmReview,
  buildExpertOverview,
  createConsultationRequest,
  getActiveFarmGrantForExpert,
  getActiveFarmGrantForOrganisationUser,
  getCollaborationDirectory,
  getOrCreateExpertProfile,
  listConsultationsForUser,
  listFarmerAccessGrants,
  grantFarmAccess,
  respondToConsultation,
  revokeFarmAccessGrant,
  submitExpertFeedback,
  updateExpertProfile,
} from './src/server/expertPortal.ts';
import {
  NOTIFICATION_CATEGORY_META,
  dispatchNotification,
  generateDueRemindersForUser,
  getOrCreateUserNotificationPreference,
  updateUserNotificationPreference,
} from './src/server/notifications.ts';
import {
  addOrganisationMember,
  assignOrganisationSpecialist,
  broadcastOrganisationCommunication,
  buildOrganisationOverview,
  createOrganisationProgrammeActivity,
  createOrganisationProject,
  getOrganisationMembersView,
  getUserOrganisation,
  registerOrUpdateOrganisation,
} from './src/server/organisationPortal.ts';
import { buildOfflineBundle, processOfflineSyncBatch } from './src/server/offlineSync.ts';
import {
  buildPrivacySummary,
  eraseUserAccountPopia,
  exportUserPersonalData,
  purgeExpiredArtifacts,
  validateSafeMediaDataUrl,
} from './src/server/privacy.ts';
import {
  BusinessPlanScenario,
  BusinessScaleTier,
  CropActivityType,
  CropGrowthStage,
  CropStockMovementType,
  ExpertConcernCategory,
  ExpertSpecialisation,
  FarmAccessScopes,
  GeoJsonPolygon,
  IncidentStatus,
  IncidentType,
  LanguageCode,
  LearningCategoryCode,
  LearningContentType,
  LearningDifficulty,
  LearningMaterial,
  LivestockAnimalType,
  LivestockHealthStatus,
  LivestockRecordType,
  LocationSource,
  MixedEntryCategory,
  NotificationCategory,
  OrganisationMemberRole,
  OrganisationType,
  RainfallIntensity,
  ReportTypeCode,
  RoleCode,
  VisualAnalysisCategory,
  WindObservationLevel,
} from './src/server/types.ts';

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '15mb' }));

  const authRateLimiter = createAuthRateLimiter(15, 60_000);
  const apiRateLimiter = createAuthRateLimiter(120, 60_000);

  // Per-request X-Request-Id correlation + clean structured operational logging (no tokens/passwords/bodies)
  app.use((req, res, next) => {
    const incomingId = req.header('x-request-id');
    const requestId =
      incomingId && /^[a-zA-Z0-9_-]{4,64}$/.test(incomingId)
        ? incomingId
        : `req-${crypto.randomUUID()}`;
    res.setHeader('X-Request-Id', requestId);
    const startMs = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/api')) {
        const durationMs = Date.now() - startMs;
        console.info(
          JSON.stringify({
            level: 'info',
            requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs,
          })
        );
      }
    });
    next();
  });

  // Transparent /api/v1/* API version prefix support alongside existing /api/* routes
  app.use((req, _res, next) => {
    if (req.url === '/api/v1' || req.url.startsWith('/api/v1/')) {
      req.url = req.url.replace(/^\/api\/v1\b/, '/api');
    }
    next();
  });

  app.use('/api/weather', apiRateLimiter);
  app.use('/api/soil-land', apiRateLimiter);
  app.use('/api/crops/rotation-analysis', apiRateLimiter);
  app.use('/api/crops/rotation-simulate', apiRateLimiter);
  app.use('/api/nasa', apiRateLimiter);

  // Enforce runtime maintenance mode for operational API calls while allowing auth, health & admin access
  app.use('/api', (req, res, next) => {
    if (!store.db.systemConfig?.application?.maintenanceMode) {
      next();
      return;
    }
    const p = req.path;
    if (
      p === '/health' ||
      p.startsWith('/meta/') ||
      p.startsWith('/auth/') ||
      p.startsWith('/admin/')
    ) {
      next();
      return;
    }
    const rawToken = extractSessionToken(req);
    if (rawToken) {
      const sess = store.db.sessions.find((s) => s.tokenHash === hashToken(rawToken));
      const user = sess ? store.db.users.find((u) => u.id === sess.userId) : null;
      const role = user ? store.db.roles.find((r) => r.id === user.roleId) : null;
      if (role?.code === 'system_administrator') {
        next();
        return;
      }
    }
    res.status(503).json({
      error: 'Field Shift is temporarily in scheduled maintenance mode. Please try again shortly.',
    });
  });

  // Health Check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'Field Shift API', timestamp: new Date().toISOString() });
  });

  // Public Reference Metadata
  app.get('/api/meta/languages', (_req, res) => {
    res.json(store.db.languages.filter((l) => l.isActive));
  });

  app.get('/api/meta/roles', (_req, res) => {
    res.json(store.db.roles);
  });

  app.get('/api/meta/farming-types', (_req, res) => {
    res.json(store.db.farmingTypes);
  });

  app.get('/api/meta/provinces', (_req, res) => {
    res.json(SOUTH_AFRICA_PROVINCES);
  });

  app.get('/api/meta/translations', (_req, res) => {
    res.json({
      overrides: store.db.translationOverrides.map((o) => ({
        languageCode: o.languageCode,
        key: o.key,
        value: o.value,
      })),
      application: {
        platformName: store.db.systemConfig.application.platformName,
        defaultLanguageCode: store.db.systemConfig.application.defaultLanguageCode,
        allowSelfRegistration: store.db.systemConfig.application.allowSelfRegistration,
        maintenanceMode: store.db.systemConfig.application.maintenanceMode,
      },
      announcements: store.db.systemAnnouncements.filter((a) => a.isActive),
    });
  });

  // ------------------------------------------------------------------
  // Authentication & Session Architecture
  // ------------------------------------------------------------------
  app.post('/api/auth/register', authRateLimiter, (req, res) => {
    if (!store.db.systemConfig?.application?.allowSelfRegistration) {
      res.status(403).json({
        error: 'New self-service account registration is currently disabled by the System Administrator.',
      });
      return;
    }
    const {
      fullName,
      email,
      password,
      roleCode,
      preferredLanguageCode,
      expertSpecialisation,
      expertQualifications,
      organisationName,
      organisationType,
    } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
      return;
    }
    if (!email || typeof email !== 'string' || !validateEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    const pwError = validatePasswordStrength(password);
    if (pwError) {
      res.status(400).json({ error: pwError });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (store.db.users.some((u) => u.email === normalizedEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const allowedSelfRoles: RoleCode[] = [
      'prospective_farmer',
      'existing_farmer',
      'agricultural_expert',
      'organisation_manager',
    ];
    const requestedRoleCode: RoleCode = allowedSelfRoles.includes(roleCode)
      ? roleCode
      : 'prospective_farmer';

    const role = store.db.roles.find((r) => r.code === requestedRoleCode);
    if (!role) {
      res.status(400).json({ error: 'Invalid role selected.' });
      return;
    }

    const validLang = store.db.languages.some((l) => l.code === preferredLanguageCode)
      ? (preferredLanguageCode as LanguageCode)
      : 'en';

    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();
    const userId = `user-${crypto.randomUUID()}`;
    const activationCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const newUser = {
      id: userId,
      email: normalizedEmail,
      passwordHash: hash,
      passwordSalt: salt,
      roleId: role.id,
      preferredLanguageCode: validLang,
      isActive: true,
      isEmailVerified: false,
      onboardingCompleted:
        requestedRoleCode === 'agricultural_expert' || requestedRoleCode === 'organisation_manager',
      isDemonstration: false,
      activationToken: activationCode,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const newProfile = {
      id: `prof-${crypto.randomUUID()}`,
      userId,
      fullName: fullName.trim(),
      phoneNumber: '',
      province: '',
      district: '',
      farmerExperienceYears: 0,
      accessibilityLargeText: false,
      accessibilityAudioGuidance: false,
      accessibilityVoiceInput: false,
      prospectiveData: null,
      bio: '',
      createdAt: now,
      updatedAt: now,
    };

    store.db.users.push(newUser);
    store.db.userProfiles.push(newProfile);

    if (requestedRoleCode === 'agricultural_expert') {
      const validSpecs: ExpertSpecialisation[] = [
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
      getOrCreateExpertProfile(userId);
      updateExpertProfile(userId, {
        specialisation: validSpecs.includes(expertSpecialisation)
          ? expertSpecialisation
          : 'agricultural_consultant',
        qualifications:
          typeof expertQualifications === 'string' && expertQualifications.trim()
            ? expertQualifications.trim()
            : 'Registered Agricultural Expert',
        languagesSpoken: [validLang],
      });
    }

    if (requestedRoleCode === 'organisation_manager') {
      const sanitized = sanitizeUser(newUser);
      const validOrgTypes: OrganisationType[] = [
        'cooperative',
        'agricultural_company',
        'extension_agency',
        'research_body',
      ];
      registerOrUpdateOrganisation({
        user: sanitized,
        name:
          typeof organisationName === 'string' && organisationName.trim()
            ? organisationName.trim()
            : `${fullName.trim()} Agricultural Organisation`,
        organisationType: validOrgTypes.includes(organisationType)
          ? organisationType
          : 'cooperative',
      });
    }

    getOrCreateUserNotificationPreference(userId);
    dispatchNotification({
      userId,
      category: 'account_security',
      title: 'Welcome to Field Shift — Account Activation Code',
      message: `Your account is created. Activation code: ${activationCode}. Keep your credentials private and verify your account in Profile.`,
      priority: 'high',
      isMandatorySecurity: true,
      actionUrl: 'profile',
      relatedEntityType: 'User',
      relatedEntityId: userId,
    });

    const { rawToken } = createSessionForUser(userId);
    setSessionCookie(res, rawToken);
    store.logAudit(
      userId,
      'USER_REGISTERED',
      'User',
      userId,
      { roleCode: requestedRoleCode, preferredLanguageCode: validLang },
      req.ip || '127.0.0.1'
    );

    res.status(201).json({
      user: sanitizeUser(newUser),
      token: rawToken,
      activationCode,
    });
  });

  app.post('/api/auth/login', authRateLimiter, (req, res) => {
    const { email, password } = req.body || {};
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = store.db.users.find((u) => u.email === normalizedEmail);
    if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      store.logAudit(
        user?.id || null,
        'USER_LOGIN_FAILED',
        'User',
        user?.id || null,
        { email: normalizedEmail },
        req.ip || '127.0.0.1'
      );
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        error: 'This account is currently deactivated. Please contact a System Administrator.',
      });
      return;
    }

    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = user.lastLoginAt;
    const { rawToken } = createSessionForUser(user.id);
    setSessionCookie(res, rawToken);
    store.logAudit(user.id, 'USER_LOGIN', 'User', user.id, { email: user.email }, req.ip || '127.0.0.1');

    res.json({
      user: sanitizeUser(user),
      token: rawToken,
    });
  });

  app.post('/api/auth/logout', (req: AuthRequest, res) => {
    const rawToken = extractSessionToken(req);
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      const sess = store.db.sessions.find((s) => s.tokenHash === tokenHash);
      if (sess) {
        store.logAudit(sess.userId, 'USER_LOGOUT', 'Session', sess.id, {}, req.ip || '127.0.0.1');
        store.db.sessions = store.db.sessions.filter((s) => s.tokenHash !== tokenHash);
        store.save();
      }
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.authUser });
  });

  app.post('/api/auth/activate', requireAuth, (req: AuthRequest, res) => {
    const { code } = req.body || {};
    const user = store.db.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (user.isEmailVerified) {
      res.json({ user: sanitizeUser(user), message: 'Account is already activated.' });
      return;
    }
    if (!code || typeof code !== 'string' || code.trim().toUpperCase() !== user.activationToken) {
      res.status(400).json({ error: 'Invalid activation code. Please check your welcome notification.' });
      return;
    }

    user.isEmailVerified = true;
    user.activationToken = null;
    user.updatedAt = new Date().toISOString();
    store.logAudit(user.id, 'ACCOUNT_ACTIVATED', 'User', user.id, {}, req.ip || '127.0.0.1');
    dispatchNotification({
      userId: user.id,
      category: 'account_security',
      title: 'Account Activated',
      message: 'Your Field Shift account has been verified and activated.',
      isMandatorySecurity: true,
      actionUrl: 'profile',
    });

    res.json({ user: sanitizeUser(user), message: 'Account activated successfully.' });
  });

  app.post('/api/auth/forgot-password', authRateLimiter, (req, res) => {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !validateEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const normalized = email.trim().toLowerCase();
    const user = store.db.users.find((u) => u.email === normalized);
    if (!user) {
      res.json({
        ok: true,
        message: 'If an account matches that email, a password reset code has been issued.',
      });
      return;
    }

    const rawResetToken = crypto.randomBytes(4).toString('hex').toUpperCase();
    store.db.passwordResetTokens.push({
      id: `prt-${crypto.randomUUID()}`,
      userId: user.id,
      tokenHash: hashToken(rawResetToken),
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
      usedAt: null,
      createdAt: new Date().toISOString(),
    });
    store.logAudit(user.id, 'PASSWORD_RESET_REQUESTED', 'User', user.id, {}, req.ip || '127.0.0.1');
    dispatchNotification({
      userId: user.id,
      category: 'account_security',
      title: 'Password Reset Requested',
      message: 'A password reset code was requested for your account. If this was not you, sign in and review your security settings.',
      priority: 'high',
      isMandatorySecurity: true,
      actionUrl: 'notifications',
    });

    const isProd = process.env.NODE_ENV === 'production';
    res.json({
      ok: true,
      message: 'Password reset code generated (valid for 30 minutes).',
      ...(isProd ? {} : { previewResetCode: rawResetToken }),
    });
  });

  app.post('/api/auth/reset-password', authRateLimiter, (req, res) => {
    const { email, resetCode, newPassword } = req.body || {};
    if (!email || !resetCode || !newPassword) {
      res.status(400).json({ error: 'Email, reset code, and new password are required.' });
      return;
    }

    const pwErr = validatePasswordStrength(newPassword);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }

    const user = store.db.users.find((u) => u.email === String(email).trim().toLowerCase());
    if (!user) {
      res.status(400).json({ error: 'Invalid email or reset code.' });
      return;
    }

    const codeHash = hashToken(String(resetCode).trim().toUpperCase());
    const tokenRecord = store.db.passwordResetTokens.find(
      (t) =>
        t.userId === user.id &&
        t.tokenHash === codeHash &&
        !t.usedAt &&
        new Date(t.expiresAt).getTime() > Date.now()
    );

    if (!tokenRecord) {
      res.status(400).json({ error: 'Invalid or expired password reset code.' });
      return;
    }

    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    user.updatedAt = new Date().toISOString();
    tokenRecord.usedAt = new Date().toISOString();
    store.db.sessions = store.db.sessions.filter((s) => s.userId !== user.id);
    store.logAudit(user.id, 'PASSWORD_RESET_COMPLETED', 'User', user.id, {}, req.ip || '127.0.0.1');
    dispatchNotification({
      userId: user.id,
      category: 'account_security',
      title: 'Password Changed Successfully',
      message: 'Your account password was reset and previous active sessions were signed out.',
      priority: 'high',
      isMandatorySecurity: true,
      actionUrl: 'notifications',
    });

    res.json({ ok: true, message: 'Password updated successfully. You may now sign in.' });
  });

  // ------------------------------------------------------------------
  // User Profile, Language & Accessibility Preferences
  // ------------------------------------------------------------------
  app.put('/api/profile', requireAuth, (req: AuthRequest, res) => {
    const user = store.db.users.find((u) => u.id === req.authUser!.id);
    const profile = store.db.userProfiles.find((p) => p.userId === req.authUser!.id);
    if (!user || !profile) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }

    const {
      fullName,
      phoneNumber,
      province,
      district,
      preferredLanguageCode,
      accessibilityLargeText,
      accessibilityAudioGuidance,
      accessibilityVoiceInput,
      bio,
    } = req.body || {};

    if (typeof fullName === 'string' && fullName.trim().length >= 2) {
      profile.fullName = fullName.trim();
    }
    if (typeof phoneNumber === 'string') profile.phoneNumber = phoneNumber.trim();
    if (typeof province === 'string') profile.province = province.trim();
    if (typeof district === 'string') profile.district = district.trim();
    if (typeof bio === 'string') profile.bio = bio.trim();
    if (typeof accessibilityLargeText === 'boolean') profile.accessibilityLargeText = accessibilityLargeText;
    if (typeof accessibilityAudioGuidance === 'boolean') profile.accessibilityAudioGuidance = accessibilityAudioGuidance;
    if (typeof accessibilityVoiceInput === 'boolean') profile.accessibilityVoiceInput = accessibilityVoiceInput;

    if (preferredLanguageCode && store.db.languages.some((l) => l.code === preferredLanguageCode)) {
      user.preferredLanguageCode = preferredLanguageCode as LanguageCode;
    }

    const now = new Date().toISOString();
    profile.updatedAt = now;
    user.updatedAt = now;
    store.logAudit(
      user.id,
      'PROFILE_UPDATED',
      'UserProfile',
      profile.id,
      { preferredLanguageCode: user.preferredLanguageCode },
      req.ip || '127.0.0.1'
    );

    res.json({ user: sanitizeUser(user) });
  });

  // ------------------------------------------------------------------
  // Helper Functions for Ownership & Hydration
  // ------------------------------------------------------------------
  function recordAiInsight(params: {
    userId: string;
    farmId: string | null;
    category: 'advisory' | 'analytics' | 'visual_analysis' | 'weather_summary';
    title: string;
    summary: string;
    recommendations: string[];
    languageCode: LanguageCode;
    poweredBy: 'gemini' | 'grounded_fallback' | 'deterministic_summary';
  }) {
    const insightId = `ai-${crypto.randomUUID()}`;
    store.db.aiInsightRecords.unshift({
      id: insightId,
      userId: params.userId,
      farmId: params.farmId,
      category: params.category,
      title: params.title.slice(0, 140),
      summary: params.summary.slice(0, 500),
      recommendations: params.recommendations.slice(0, 5),
      languageCode: params.languageCode,
      poweredBy: params.poweredBy,
      createdAt: new Date().toISOString(),
    });
    if (store.db.aiInsightRecords.length > 200) {
      store.db.aiInsightRecords = store.db.aiInsightRecords.slice(0, 200);
    }
    store.save();

    dispatchNotification({
      userId: params.userId,
      category: 'ai_recommendation',
      title: params.title.slice(0, 140),
      message: params.summary.slice(0, 240),
      actionUrl: params.category === 'visual_analysis' ? 'visual' : 'advisor',
      relatedEntityType: 'AiInsightRecord',
      relatedEntityId: insightId,
      prefixWithLanguageTag: true,
    });
  }

  function userCanAccessFarm(
    user: NonNullable<AuthRequest['authUser']>,
    farmId: string,
    requiredScope?: keyof FarmAccessScopes
  ): boolean {
    const farm = store.db.farms.find((f) => f.id === farmId);
    if (!farm) return false;
    if (farm.ownerId === user.id) return true;
    // Administrators do NOT receive automatic unrestricted access to private farmer records;
    // they only access private farm records if explicitly granted audited permission.
    if (user.roleCode === 'system_administrator') {
      return user.permissions.includes('admin:private_farmer_records');
    }
    if (user.roleCode === 'agricultural_expert') {
      const grant = getActiveFarmGrantForExpert(user.id, farmId);
      if (!grant) return false;
      if (requiredScope && !grant.scopes[requiredScope]) return false;
      return true;
    }
    // Organisation managers are strictly isolated from raw personal farmer/location/financial/media endpoints;
    // they must access anonymised, farmer-authorised aggregates via /api/organisation/overview and /api/reports/generate.
    return false;
  }

  function userCanModifyFarm(user: NonNullable<AuthRequest['authUser']>, farmId: string): boolean {
    const farm = store.db.farms.find((f) => f.id === farmId);
    if (!farm) return false;
    if (farm.ownerId === user.id) return true;
    return (
      user.roleCode === 'system_administrator' &&
      user.permissions.includes('admin:private_farmer_records')
    );
  }

  function getAccessibleFarmIds(
    user: NonNullable<AuthRequest['authUser']>,
    requiredScope?: keyof FarmAccessScopes
  ): string[] {
    if (
      user.roleCode === 'system_administrator' &&
      user.permissions.includes('admin:private_farmer_records')
    ) {
      return store.db.farms.map((f) => f.id);
    }
    return store.db.farms
      .filter((f) => userCanAccessFarm(user, f.id, requiredScope))
      .map((f) => f.id);
  }

  function hydrateFarm(farmId: string) {
    const farm = store.db.farms.find((f) => f.id === farmId);
    if (!farm) return null;
    const location = store.db.farmLocations.find((l) => l.farmId === farmId) || null;
    const boundary = store.db.farmBoundaries.find((b) => b.farmId === farmId) || null;
    const fields = store.db.fields.filter((fl) => fl.farmId === farmId);
    const ownerProfile = store.db.userProfiles.find((p) => p.userId === farm.ownerId);
    return {
      ...farm,
      ownerName: ownerProfile?.fullName || 'Registered Farmer',
      location,
      boundary,
      fields,
    };
  }

  function isValidPolygon(poly: unknown): poly is GeoJsonPolygon {
    if (!poly || typeof poly !== 'object') return false;
    const g = poly as GeoJsonPolygon;
    return (
      g.type === 'Polygon' &&
      Array.isArray(g.coordinates) &&
      Array.isArray(g.coordinates[0]) &&
      g.coordinates[0].length >= 4
    );
  }

  // ------------------------------------------------------------------
  // Farmer Onboarding Journeys (Prospective & Existing)
  // ------------------------------------------------------------------
  app.post('/api/onboarding/prospective', requireAuth, (req: AuthRequest, res) => {
    const user = store.db.users.find((u) => u.id === req.authUser!.id);
    const profile = store.db.userProfiles.find((p) => p.userId === req.authUser!.id);
    if (!user || !profile) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    const {
      fullName,
      preferredLanguageCode,
      province,
      district,
      preferredFarmingType,
      intendedLandSizeHectares,
      landAccessStatus,
      availableResources,
      farmingExperience,
      agriculturalInterests,
      farmingGoals,
    } = req.body || {};

    if (!fullName || !province || !district || !preferredFarmingType) {
      res.status(400).json({ error: 'Full name, province, district, and preferred farming type are required.' });
      return;
    }

    const now = new Date().toISOString();
    profile.fullName = String(fullName).trim();
    profile.province = String(province).trim();
    profile.district = String(district).trim();
    profile.prospectiveData = {
      preferredFarmingType: String(preferredFarmingType),
      intendedLandSizeHectares: Number(intendedLandSizeHectares) || 1,
      landAccessStatus: String(landAccessStatus || 'Exploring land options'),
      availableResources: Array.isArray(availableResources) ? availableResources : [],
      farmingExperience: String(farmingExperience || 'Beginner'),
      agriculturalInterests: Array.isArray(agriculturalInterests) ? agriculturalInterests : [],
      farmingGoals: Array.isArray(farmingGoals) ? farmingGoals : [],
    };
    profile.updatedAt = now;

    if (preferredLanguageCode && store.db.languages.some((l) => l.code === preferredLanguageCode)) {
      user.preferredLanguageCode = preferredLanguageCode as LanguageCode;
    }
    user.onboardingCompleted = true;
    user.updatedAt = now;

    store.logAudit(
      user.id,
      'ONBOARDING_PROSPECTIVE_COMPLETED',
      'UserProfile',
      profile.id,
      { province, district, preferredFarmingType },
      req.ip || '127.0.0.1'
    );

    res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/onboarding/existing', requireAuth, (req: AuthRequest, res) => {
    const user = store.db.users.find((u) => u.id === req.authUser!.id);
    const profile = store.db.userProfiles.find((p) => p.userId === req.authUser!.id);
    if (!user || !profile) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    const {
      farmName,
      province,
      districtMunicipality,
      localMunicipality,
      townOrVillage,
      locationDescription,
      locationConfirmed,
      latitude,
      longitude,
      locationSource,
      gpsLatitude,
      gpsLongitude,
      gpsAccuracyMeters,
      gpsCapturedAt,
      farmSizeHectares,
      farmingActivities,
      yearsOfExperience,
      waterAvailability,
      existingCrops,
      existingLivestock,
      boundaryGeojson,
      preferredLanguageCode,
    } = req.body || {};

    if (!farmName || !province || !districtMunicipality || !localMunicipality || !townOrVillage) {
      res.status(400).json({
        error: 'Farm name, province, district municipality, local municipality, and town/village are required.',
      });
      return;
    }

    const parsedSize = farmSizeHectares === undefined || farmSizeHectares === '' ? 1 : Number(farmSizeHectares);
    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      res.status(400).json({ error: 'Farm size in hectares must be a positive number.' });
      return;
    }

    let lat = -28.4793;
    let lng = 24.6727;
    if (latitude !== undefined || longitude !== undefined) {
      const coordCheck = validateSaCoordinates(latitude, longitude);
      if (!coordCheck.valid || coordCheck.lat === null || coordCheck.lng === null) {
        res.status(400).json({ error: coordCheck.error || 'Coordinates must lie within South Africa.' });
        return;
      }
      lat = coordCheck.lat;
      lng = coordCheck.lng;
    }

    if (gpsLatitude !== undefined && gpsLatitude !== null && gpsLongitude !== undefined && gpsLongitude !== null) {
      const gpsCheck = validateSaCoordinates(gpsLatitude, gpsLongitude);
      if (!gpsCheck.valid) {
        res.status(400).json({ error: gpsCheck.error || 'GPS coordinates must lie within South Africa.' });
        return;
      }
    }

    const now = new Date().toISOString();
    const farmId = `farm-${crypto.randomUUID()}`;
    const sizeHa = Math.max(0.1, Number(parsedSize.toFixed(2)));
    const validSource: LocationSource = [
      'gps',
      'manual_map_pin',
      'geocoded_search',
      'municipal_center',
    ].includes(locationSource)
      ? locationSource
      : 'municipal_center';

    store.db.farms.push({
      id: farmId,
      ownerId: user.id,
      name: String(farmName).trim(),
      farmingActivities: Array.isArray(farmingActivities) ? farmingActivities : [],
      farmSizeHectares: sizeHa,
      yearsOfExperience: Number.isFinite(Number(yearsOfExperience)) ? Math.max(0, Number(yearsOfExperience)) : 0,
      waterAvailability: String(waterAvailability || 'Rain-fed'),
      existingCrops: Array.isArray(existingCrops) ? existingCrops : [],
      existingLivestock: Array.isArray(existingLivestock) ? existingLivestock : [],
      status: 'active',
      isDemonstration: false,
      createdAt: now,
      updatedAt: now,
    });

    store.db.farmLocations.push({
      id: `loc-${crypto.randomUUID()}`,
      farmId,
      province: String(province),
      districtMunicipality: String(districtMunicipality),
      localMunicipality: String(localMunicipality),
      townOrVillage: String(townOrVillage),
      locationDescription: typeof locationDescription === 'string' ? locationDescription.trim() : '',
      locationConfirmed: typeof locationConfirmed === 'boolean' ? locationConfirmed : validSource !== 'municipal_center',
      latitude: lat,
      longitude: lng,
      locationSource: validSource,
      gpsLatitude: typeof gpsLatitude === 'number' && Number.isFinite(gpsLatitude) ? gpsLatitude : null,
      gpsLongitude: typeof gpsLongitude === 'number' && Number.isFinite(gpsLongitude) ? gpsLongitude : null,
      gpsAccuracyMeters: typeof gpsAccuracyMeters === 'number' && Number.isFinite(gpsAccuracyMeters) ? gpsAccuracyMeters : null,
      gpsCapturedAt: typeof gpsCapturedAt === 'string' ? gpsCapturedAt : null,
      centroidWkt: pointToWkt(lat, lng),
      elevationMeters: estimateSaElevationMeters(String(province), lat, lng),
    });

    // IMPORTANT: Never treat a GPS point as a farm boundary. Only save boundary when explicitly drawn.
    if (isValidPolygon(boundaryGeojson)) {
      store.db.farmBoundaries.push({
        id: `bnd-${crypto.randomUUID()}`,
        farmId,
        boundaryWkt: polygonToWkt(boundaryGeojson),
        geojson: boundaryGeojson,
        calculatedAreaHectares: calculatePolygonAreaHectares(boundaryGeojson),
        perimeterMeters: calculatePolygonPerimeterMeters(boundaryGeojson),
        source: 'drawn_polygon',
        updatedAt: now,
      });
    }

    profile.province = String(province);
    profile.district = String(districtMunicipality);
    profile.farmerExperienceYears = Number(yearsOfExperience) || profile.farmerExperienceYears;
    profile.updatedAt = now;

    if (preferredLanguageCode && store.db.languages.some((l) => l.code === preferredLanguageCode)) {
      user.preferredLanguageCode = preferredLanguageCode as LanguageCode;
    }
    user.onboardingCompleted = true;
    user.updatedAt = now;

    store.logAudit(
      user.id,
      'ONBOARDING_EXISTING_COMPLETED',
      'Farm',
      farmId,
      { farmName, province, sizeHa, hasBoundary: isValidPolygon(boundaryGeojson) },
      req.ip || '127.0.0.1'
    );

    res.status(201).json({
      user: sanitizeUser(user),
      farm: hydrateFarm(farmId),
    });
  });

  // ------------------------------------------------------------------
  // Prospective Farmer Discovery & Learning Endpoints
  // ------------------------------------------------------------------
  app.get('/api/discovery/opportunities', requireAuth, (req: AuthRequest, res) => {
    const profile = req.authUser!.profile;
    res.json({
      opportunities: FARMING_OPPORTUNITIES,
      beginnerGuides: BEGINNER_GUIDES,
      recommendedProvince: profile?.province || 'KwaZulu-Natal',
    });
  });

  // ------------------------------------------------------------------
  // Farm & Field Management (GPS + OpenStreetMap + Boundaries)
  // ------------------------------------------------------------------
  app.get('/api/farms', requireAuth, (req: AuthRequest, res) => {
    if (req.authUser!.roleCode === 'organisation_manager') {
      res.status(403).json({
        error:
          'Organisation accounts cannot list raw personal farm records under POPIA. Use /api/organisation/overview for anonymised member aggregates.',
      });
      return;
    }
    const ids = getAccessibleFarmIds(req.authUser!, 'overview');
    res.json(ids.map((id) => hydrateFarm(id)).filter(Boolean));
  });

  app.post(
    '/api/farms',
    requireAuth,
    requireRoles('existing_farmer', 'system_administrator'),
    (req: AuthRequest, res) => {
      const {
        name,
        province,
        districtMunicipality,
        localMunicipality,
        townOrVillage,
        locationDescription,
        locationConfirmed,
        latitude,
        longitude,
        locationSource,
        gpsLatitude,
        gpsLongitude,
        gpsAccuracyMeters,
        gpsCapturedAt,
        farmSizeHectares,
        farmingActivities,
        yearsOfExperience,
        waterAvailability,
        existingCrops,
        existingLivestock,
        tenureType,
        managementRelationshipNote,
        boundaryGeojson,
      } = req.body || {};

      if (!name || !province || !districtMunicipality || !localMunicipality || !townOrVillage) {
        res.status(400).json({ error: 'All farm name and location fields are required.' });
        return;
      }

      const parsedSize = farmSizeHectares === undefined || farmSizeHectares === '' ? 1 : Number(farmSizeHectares);
      if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
        res.status(400).json({ error: 'Farm size in hectares must be a positive number.' });
        return;
      }

      let lat = -28.4793;
      let lng = 24.6727;
      if (latitude !== undefined || longitude !== undefined) {
        const coordCheck = validateSaCoordinates(latitude, longitude);
        if (!coordCheck.valid || coordCheck.lat === null || coordCheck.lng === null) {
          res.status(400).json({ error: coordCheck.error || 'Coordinates must lie within South Africa.' });
          return;
        }
        lat = coordCheck.lat;
        lng = coordCheck.lng;
      }

      if (gpsLatitude !== undefined && gpsLatitude !== null && gpsLongitude !== undefined && gpsLongitude !== null) {
        const gpsCheck = validateSaCoordinates(gpsLatitude, gpsLongitude);
        if (!gpsCheck.valid) {
          res.status(400).json({ error: gpsCheck.error || 'GPS coordinates must lie within South Africa.' });
          return;
        }
      }

      const now = new Date().toISOString();
      const farmId = `farm-${crypto.randomUUID()}`;
      const sizeHa = Math.max(0.1, Number(parsedSize.toFixed(2)));
      const validSource: LocationSource = [
        'gps',
        'manual_map_pin',
        'geocoded_search',
        'municipal_center',
      ].includes(locationSource)
        ? locationSource
        : 'municipal_center';

      const validTenure = ['owner', 'manager', 'lessee', 'communal_custodian', 'family_land'].includes(
        tenureType
      )
        ? tenureType
        : 'owner';

      store.db.farms.push({
        id: farmId,
        ownerId: req.authUser!.id,
        name: String(name).trim(),
        farmingActivities: Array.isArray(farmingActivities) ? farmingActivities : [],
        farmSizeHectares: sizeHa,
        yearsOfExperience: Number.isFinite(Number(yearsOfExperience)) ? Math.max(0, Number(yearsOfExperience)) : 0,
        waterAvailability: String(waterAvailability || 'Borehole'),
        existingCrops: Array.isArray(existingCrops) ? existingCrops : [],
        existingLivestock: Array.isArray(existingLivestock) ? existingLivestock : [],
        tenureType: validTenure,
        managementRelationshipNote:
          typeof managementRelationshipNote === 'string'
            ? managementRelationshipNote.trim().slice(0, 300)
            : '',
        status: 'active',
        isDemonstration: false,
        createdAt: now,
        updatedAt: now,
      });

      store.db.farmLocations.push({
        id: `loc-${crypto.randomUUID()}`,
        farmId,
        province: String(province),
        districtMunicipality: String(districtMunicipality),
        localMunicipality: String(localMunicipality),
        townOrVillage: String(townOrVillage),
        locationDescription: typeof locationDescription === 'string' ? locationDescription.trim() : '',
        locationConfirmed: typeof locationConfirmed === 'boolean' ? locationConfirmed : validSource !== 'municipal_center',
        latitude: lat,
        longitude: lng,
        locationSource: validSource,
        gpsLatitude: typeof gpsLatitude === 'number' && Number.isFinite(gpsLatitude) ? gpsLatitude : null,
        gpsLongitude: typeof gpsLongitude === 'number' && Number.isFinite(gpsLongitude) ? gpsLongitude : null,
        gpsAccuracyMeters: typeof gpsAccuracyMeters === 'number' && Number.isFinite(gpsAccuracyMeters) ? gpsAccuracyMeters : null,
        gpsCapturedAt: typeof gpsCapturedAt === 'string' ? gpsCapturedAt : null,
        centroidWkt: pointToWkt(lat, lng),
        elevationMeters: estimateSaElevationMeters(String(province), lat, lng),
      });

      // Only persist farm boundary when explicitly drawn by user
      if (isValidPolygon(boundaryGeojson)) {
        store.db.farmBoundaries.push({
          id: `bnd-${crypto.randomUUID()}`,
          farmId,
          boundaryWkt: polygonToWkt(boundaryGeojson),
          geojson: boundaryGeojson,
          calculatedAreaHectares: calculatePolygonAreaHectares(boundaryGeojson),
          perimeterMeters: calculatePolygonPerimeterMeters(boundaryGeojson),
          source: 'drawn_polygon',
          updatedAt: now,
        });
      }

      store.logAudit(
        req.authUser!.id,
        'FARM_CREATED',
        'Farm',
        farmId,
        { name, province, sizeHa, locationSource: validSource },
        req.ip || '127.0.0.1'
      );

      res.status(201).json(hydrateFarm(farmId));
    }
  );

  app.get('/api/farms/:id', requireAuth, (req: AuthRequest, res) => {
    if (!userCanAccessFarm(req.authUser!, req.params.id, 'overview')) {
      res.status(403).json({ error: 'You do not have access to this farm.' });
      return;
    }
    const hydrated = hydrateFarm(req.params.id);
    if (!hydrated) {
      res.status(404).json({ error: 'Farm not found.' });
      return;
    }
    res.json(hydrated);
  });

  app.put('/api/farms/:id', requireAuth, (req: AuthRequest, res) => {
    const farm = store.db.farms.find((f) => f.id === req.params.id);
    if (!farm) {
      res.status(404).json({ error: 'Farm not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, farm.id)) {
      res.status(403).json({ error: 'Only the registered farm owner can edit this farm.' });
      return;
    }

    const {
      name,
      farmSizeHectares,
      yearsOfExperience,
      waterAvailability,
      farmingActivities,
      existingCrops,
      existingLivestock,
      province,
      districtMunicipality,
      localMunicipality,
      townOrVillage,
      locationDescription,
      locationConfirmed,
      latitude,
      longitude,
      locationSource,
      gpsLatitude,
      gpsLongitude,
      gpsAccuracyMeters,
      gpsCapturedAt,
      tenureType,
      managementRelationshipNote,
      boundaryGeojson,
    } = req.body || {};

    if (typeof name === 'string' && name.trim()) farm.name = name.trim();
    if (farmSizeHectares !== undefined) {
      const parsedSize = Number(farmSizeHectares);
      if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
        res.status(400).json({ error: 'Farm size in hectares must be a positive number.' });
        return;
      }
      farm.farmSizeHectares = Math.max(0.1, Number(parsedSize.toFixed(2)));
    }
    if (yearsOfExperience !== undefined) {
      const parsedExp = Number(yearsOfExperience);
      farm.yearsOfExperience = Number.isFinite(parsedExp) ? Math.max(0, parsedExp) : farm.yearsOfExperience;
    }
    if (typeof waterAvailability === 'string' && waterAvailability.trim()) {
      farm.waterAvailability = waterAvailability.trim();
    }
    if (Array.isArray(farmingActivities)) farm.farmingActivities = farmingActivities;
    if (Array.isArray(existingCrops)) farm.existingCrops = existingCrops;
    if (Array.isArray(existingLivestock)) farm.existingLivestock = existingLivestock;
    if (
      typeof tenureType === 'string' &&
      ['owner', 'manager', 'lessee', 'communal_custodian', 'family_land'].includes(tenureType)
    ) {
      farm.tenureType = tenureType as 'owner' | 'manager' | 'lessee' | 'communal_custodian' | 'family_land';
    }
    if (typeof managementRelationshipNote === 'string') {
      farm.managementRelationshipNote = managementRelationshipNote.trim().slice(0, 300);
    }

    const loc = store.db.farmLocations.find((l) => l.farmId === farm.id);
    if (loc && (latitude !== undefined || longitude !== undefined)) {
      const nextLat = latitude !== undefined ? latitude : loc.latitude;
      const nextLng = longitude !== undefined ? longitude : loc.longitude;
      const coordCheck = validateSaCoordinates(nextLat, nextLng);
      if (!coordCheck.valid || coordCheck.lat === null || coordCheck.lng === null) {
        res.status(400).json({ error: coordCheck.error || 'Coordinates must lie within South Africa.' });
        return;
      }
      loc.latitude = coordCheck.lat;
      loc.longitude = coordCheck.lng;
    }

    farm.updatedAt = new Date().toISOString();

    if (loc) {
      if (province) loc.province = String(province);
      if (districtMunicipality) loc.districtMunicipality = String(districtMunicipality);
      if (localMunicipality) loc.localMunicipality = String(localMunicipality);
      if (townOrVillage) loc.townOrVillage = String(townOrVillage);
      if (typeof locationDescription === 'string') loc.locationDescription = locationDescription.trim();
      if (typeof locationConfirmed === 'boolean') loc.locationConfirmed = locationConfirmed;
      if (
        locationSource &&
        ['gps', 'manual_map_pin', 'geocoded_search', 'municipal_center'].includes(locationSource)
      ) {
        loc.locationSource = locationSource;
      }
      if (typeof gpsLatitude === 'number' && Number.isFinite(gpsLatitude)) loc.gpsLatitude = gpsLatitude;
      if (typeof gpsLongitude === 'number' && Number.isFinite(gpsLongitude)) loc.gpsLongitude = gpsLongitude;
      if (typeof gpsAccuracyMeters === 'number' && Number.isFinite(gpsAccuracyMeters)) {
        loc.gpsAccuracyMeters = gpsAccuracyMeters;
      }
      if (typeof gpsCapturedAt === 'string') loc.gpsCapturedAt = gpsCapturedAt;
      loc.centroidWkt = pointToWkt(loc.latitude, loc.longitude);
    }

    if (isValidPolygon(boundaryGeojson)) {
      const existingBnd = store.db.farmBoundaries.find((b) => b.farmId === farm.id);
      const calcHa = calculatePolygonAreaHectares(boundaryGeojson);
      const perimM = calculatePolygonPerimeterMeters(boundaryGeojson);
      if (existingBnd) {
        existingBnd.geojson = boundaryGeojson;
        existingBnd.boundaryWkt = polygonToWkt(boundaryGeojson);
        existingBnd.calculatedAreaHectares = calcHa;
        existingBnd.perimeterMeters = perimM;
        existingBnd.source = 'vertex_edited';
        existingBnd.updatedAt = farm.updatedAt;
      } else {
        store.db.farmBoundaries.push({
          id: `bnd-${crypto.randomUUID()}`,
          farmId: farm.id,
          boundaryWkt: polygonToWkt(boundaryGeojson),
          geojson: boundaryGeojson,
          calculatedAreaHectares: calcHa,
          perimeterMeters: perimM,
          source: 'drawn_polygon',
          updatedAt: farm.updatedAt,
        });
      }
    }

    store.logAudit(
      req.authUser!.id,
      'FARM_UPDATED',
      'Farm',
      farm.id,
      { name: farm.name },
      req.ip || '127.0.0.1'
    );

    res.json(hydrateFarm(farm.id));
  });

  // Dedicated Spatial Location & Boundary Update Endpoint (for interactive map editing)
  app.put('/api/farms/:id/spatial', requireAuth, (req: AuthRequest, res) => {
    const farm = store.db.farms.find((f) => f.id === req.params.id);
    if (!farm) {
      res.status(404).json({ error: 'Farm not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, farm.id)) {
      res.status(403).json({ error: 'Only the farm owner can update spatial mapping.' });
      return;
    }

    const {
      latitude,
      longitude,
      locationSource,
      locationDescription,
      locationConfirmed,
      gpsLatitude,
      gpsLongitude,
      gpsAccuracyMeters,
      gpsCapturedAt,
      boundaryGeojson,
      clearBoundary,
    } = req.body || {};

    const now = new Date().toISOString();
    const loc = store.db.farmLocations.find((l) => l.farmId === farm.id);
    if (loc) {
      if (latitude !== undefined || longitude !== undefined) {
        const nextLat = latitude !== undefined ? latitude : loc.latitude;
        const nextLng = longitude !== undefined ? longitude : loc.longitude;
        const coordCheck = validateSaCoordinates(nextLat, nextLng);
        if (!coordCheck.valid || coordCheck.lat === null || coordCheck.lng === null) {
          res.status(400).json({ error: coordCheck.error || 'Coordinates must lie within South Africa.' });
          return;
        }
        loc.latitude = coordCheck.lat;
        loc.longitude = coordCheck.lng;
      }
      if (
        locationSource &&
        ['gps', 'manual_map_pin', 'geocoded_search', 'municipal_center'].includes(locationSource)
      ) {
        loc.locationSource = locationSource;
      }
      if (typeof locationDescription === 'string') loc.locationDescription = locationDescription.trim();
      if (typeof locationConfirmed === 'boolean') loc.locationConfirmed = locationConfirmed;
      if (typeof gpsLatitude === 'number' && Number.isFinite(gpsLatitude)) loc.gpsLatitude = gpsLatitude;
      if (typeof gpsLongitude === 'number' && Number.isFinite(gpsLongitude)) loc.gpsLongitude = gpsLongitude;
      if (typeof gpsAccuracyMeters === 'number' && Number.isFinite(gpsAccuracyMeters)) {
        loc.gpsAccuracyMeters = gpsAccuracyMeters;
      }
      if (typeof gpsCapturedAt === 'string') loc.gpsCapturedAt = gpsCapturedAt;
      loc.centroidWkt = pointToWkt(loc.latitude, loc.longitude);
    }

    if (clearBoundary === true) {
      store.db.farmBoundaries = store.db.farmBoundaries.filter((b) => b.farmId !== farm.id);
    } else if (isValidPolygon(boundaryGeojson)) {
      const existingBnd = store.db.farmBoundaries.find((b) => b.farmId === farm.id);
      const calcHa = calculatePolygonAreaHectares(boundaryGeojson);
      const perimM = calculatePolygonPerimeterMeters(boundaryGeojson);
      if (existingBnd) {
        existingBnd.geojson = boundaryGeojson;
        existingBnd.boundaryWkt = polygonToWkt(boundaryGeojson);
        existingBnd.calculatedAreaHectares = calcHa;
        existingBnd.perimeterMeters = perimM;
        existingBnd.source = 'vertex_edited';
        existingBnd.updatedAt = now;
      } else {
        store.db.farmBoundaries.push({
          id: `bnd-${crypto.randomUUID()}`,
          farmId: farm.id,
          boundaryWkt: polygonToWkt(boundaryGeojson),
          geojson: boundaryGeojson,
          calculatedAreaHectares: calcHa,
          perimeterMeters: perimM,
          source: 'drawn_polygon',
          updatedAt: now,
        });
      }
    }

    farm.updatedAt = now;
    store.logAudit(
      req.authUser!.id,
      'FARM_SPATIAL_UPDATED',
      'FarmBoundary',
      farm.id,
      { locationSource, hasBoundary: isValidPolygon(boundaryGeojson) },
      req.ip || '127.0.0.1'
    );

    res.json(hydrateFarm(farm.id));
  });

  app.delete('/api/farms/:id', requireAuth, (req: AuthRequest, res) => {
    const farm = store.db.farms.find((f) => f.id === req.params.id);
    if (!farm) {
      res.status(404).json({ error: 'Farm not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, farm.id)) {
      res.status(403).json({ error: 'Only the registered farm owner can delete this farm.' });
      return;
    }

    store.db.farms = store.db.farms.filter((f) => f.id !== farm.id);
    store.db.farmLocations = store.db.farmLocations.filter((l) => l.farmId !== farm.id);
    store.db.farmBoundaries = store.db.farmBoundaries.filter((b) => b.farmId !== farm.id);
    store.db.fields = store.db.fields.filter((fl) => fl.farmId !== farm.id);
    store.db.crops = store.db.crops.filter((c) => c.farmId !== farm.id);
    store.db.cropActivities = store.db.cropActivities.filter((ca) => ca.farmId !== farm.id);
    store.db.livestockGroups = store.db.livestockGroups.filter((lg) => lg.farmId !== farm.id);
    store.db.livestockRecords = store.db.livestockRecords.filter((lr) => lr.farmId !== farm.id);
    store.db.mixedFarmingEntries = store.db.mixedFarmingEntries.filter((m) => m.farmId !== farm.id);
    store.db.soilReports = store.db.soilReports.filter((sr) => sr.farmId !== farm.id);
    store.db.visualAnalyses = store.db.visualAnalyses.filter((v) => v.farmId !== farm.id);
    store.db.cropStockMovements = store.db.cropStockMovements.filter((cm) => cm.farmId !== farm.id);
    store.db.stockPriceSettings = store.db.stockPriceSettings.filter((sp) => sp.farmId !== farm.id);
    store.db.farmIncidents = store.db.farmIncidents.filter((inc) => inc.farmId !== farm.id);
    store.db.weatherForecastRecords = store.db.weatherForecastRecords.filter((w) => w.farmId !== farm.id);
    store.db.weatherObservations = store.db.weatherObservations.filter((w) => w.farmId !== farm.id);
    for (const bp of store.db.businessPlans) {
      if (bp.farmId === farm.id) bp.farmId = null;
    }

    store.logAudit(
      req.authUser!.id,
      'FARM_DELETED',
      'Farm',
      farm.id,
      { name: farm.name },
      req.ip || '127.0.0.1'
    );

    res.json({ ok: true });
  });

  // Field Management inside a Farm (including field boundary drawing)
  app.post('/api/farms/:farmId/fields', requireAuth, (req: AuthRequest, res) => {
    const farm = store.db.farms.find((f) => f.id === req.params.farmId);
    if (!farm) {
      res.status(404).json({ error: 'Farm not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, farm.id)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const {
      name,
      farmingTypeId,
      cropOrLivestock,
      areaHectares,
      soilType,
      irrigationType,
      soilTexture,
      organicMatterLevel,
      soilDrainage,
      waterHoldingCharacteristic,
      soilPhMeasured,
      nitrogenMeasuredMgKg,
      phosphorusMeasuredMgKg,
      potassiumMeasuredMgKg,
      currentCrop,
      previousSeasonCrop,
      twoSeasonsAgoCrop,
      farmingSystem,
      status,
      notes,
      geojson,
    } = req.body || {};

    if (!name || !cropOrLivestock) {
      res.status(400).json({ error: 'Field name and crop or livestock enterprise are required.' });
      return;
    }

    const now = new Date().toISOString();
    const poly = isValidPolygon(geojson) ? geojson : null;
    const areaHa = poly
      ? calculatePolygonAreaHectares(poly)
      : Math.max(0.1, Number(areaHectares) || 1);

    const newField = {
      id: `fld-${crypto.randomUUID()}`,
      farmId: farm.id,
      name: String(name).trim(),
      farmingTypeId: farmingTypeId || null,
      cropOrLivestock: String(cropOrLivestock).trim(),
      areaHectares: areaHa,
      soilType: String(soilType || soilTexture || 'Unknown'),
      irrigationType: String(irrigationType || 'Rain-fed'),
      soilTexture: (['Sandy', 'Loam', 'Clay Loam', 'Clay', 'Unknown'].includes(soilTexture)
        ? soilTexture
        : 'Unknown') as 'Sandy' | 'Loam' | 'Clay Loam' | 'Clay' | 'Unknown',
      organicMatterLevel: (['Low', 'Medium', 'High', 'Unknown'].includes(organicMatterLevel)
        ? organicMatterLevel
        : 'Unknown') as 'Low' | 'Medium' | 'High' | 'Unknown',
      soilDrainage: (['Poor', 'Moderate', 'Good', 'Unknown'].includes(soilDrainage)
        ? soilDrainage
        : 'Unknown') as 'Poor' | 'Moderate' | 'Good' | 'Unknown',
      waterHoldingCharacteristic: ([
        'Low',
        'Moderate',
        'High',
        'Unknown',
      ].includes(waterHoldingCharacteristic)
        ? waterHoldingCharacteristic
        : 'Unknown') as 'Low' | 'Moderate' | 'High' | 'Unknown',
      soilPhMeasured:
        soilPhMeasured !== undefined && soilPhMeasured !== null && soilPhMeasured !== ''
          ? Number(soilPhMeasured)
          : null,
      nitrogenMeasuredMgKg:
        nitrogenMeasuredMgKg !== undefined &&
        nitrogenMeasuredMgKg !== null &&
        nitrogenMeasuredMgKg !== ''
          ? Number(nitrogenMeasuredMgKg)
          : null,
      phosphorusMeasuredMgKg:
        phosphorusMeasuredMgKg !== undefined &&
        phosphorusMeasuredMgKg !== null &&
        phosphorusMeasuredMgKg !== ''
          ? Number(phosphorusMeasuredMgKg)
          : null,
      potassiumMeasuredMgKg:
        potassiumMeasuredMgKg !== undefined &&
        potassiumMeasuredMgKg !== null &&
        potassiumMeasuredMgKg !== ''
          ? Number(potassiumMeasuredMgKg)
          : null,
      currentCrop: String(currentCrop || cropOrLivestock || '').trim(),
      previousSeasonCrop: String(previousSeasonCrop || '').trim(),
      twoSeasonsAgoCrop: String(twoSeasonsAgoCrop || '').trim(),
      farmingSystem: String(farmingSystem || '').trim(),
      fieldWkt: poly ? polygonToWkt(poly) : null,
      geojson: poly,
      status: (['active', 'fallow', 'preparing'].includes(status) ? status : 'active') as
        | 'active'
        | 'fallow'
        | 'preparing',
      notes: String(notes || '').trim(),
      createdAt: now,
      updatedAt: now,
    };

    store.db.fields.push(newField);
    store.logAudit(
      req.authUser!.id,
      'FIELD_CREATED',
      'Field',
      newField.id,
      { farmId: farm.id, name: newField.name },
      req.ip || '127.0.0.1'
    );

    res.status(201).json(newField);
  });

  app.put('/api/fields/:fieldId', requireAuth, (req: AuthRequest, res) => {
    const field = store.db.fields.find((fl) => fl.id === req.params.fieldId);
    if (!field) {
      res.status(404).json({ error: 'Field not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, field.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const {
      name,
      cropOrLivestock,
      areaHectares,
      soilType,
      irrigationType,
      soilTexture,
      organicMatterLevel,
      soilDrainage,
      waterHoldingCharacteristic,
      soilPhMeasured,
      nitrogenMeasuredMgKg,
      phosphorusMeasuredMgKg,
      potassiumMeasuredMgKg,
      currentCrop,
      previousSeasonCrop,
      twoSeasonsAgoCrop,
      farmingSystem,
      status,
      notes,
      geojson,
    } = req.body || {};
    if (name) field.name = String(name).trim();
    if (cropOrLivestock) field.cropOrLivestock = String(cropOrLivestock).trim();
    if (isValidPolygon(geojson)) {
      field.geojson = geojson;
      field.fieldWkt = polygonToWkt(geojson);
      field.areaHectares = calculatePolygonAreaHectares(geojson);
    } else if (areaHectares !== undefined) {
      const parsedArea = Number(areaHectares);
      if (!Number.isFinite(parsedArea) || parsedArea <= 0) {
        res.status(400).json({ error: 'Field area in hectares must be a positive number.' });
        return;
      }
      field.areaHectares = Math.max(0.1, Number(parsedArea.toFixed(2)));
    }
    if (soilType) field.soilType = String(soilType);
    if (irrigationType) field.irrigationType = String(irrigationType);
    if (['Sandy', 'Loam', 'Clay Loam', 'Clay', 'Unknown'].includes(soilTexture)) {
      field.soilTexture = soilTexture;
      if (soilTexture !== 'Unknown' && !soilType) field.soilType = soilTexture;
    }
    if (['Low', 'Medium', 'High', 'Unknown'].includes(organicMatterLevel)) {
      field.organicMatterLevel = organicMatterLevel;
    }
    if (['Poor', 'Moderate', 'Good', 'Unknown'].includes(soilDrainage)) {
      field.soilDrainage = soilDrainage;
    }
    if (['Low', 'Moderate', 'High', 'Unknown'].includes(waterHoldingCharacteristic)) {
      field.waterHoldingCharacteristic = waterHoldingCharacteristic;
    }
    if (soilPhMeasured !== undefined) {
      field.soilPhMeasured =
        soilPhMeasured === null || soilPhMeasured === '' ? null : Number(soilPhMeasured);
    }
    if (nitrogenMeasuredMgKg !== undefined) {
      field.nitrogenMeasuredMgKg =
        nitrogenMeasuredMgKg === null || nitrogenMeasuredMgKg === ''
          ? null
          : Number(nitrogenMeasuredMgKg);
    }
    if (phosphorusMeasuredMgKg !== undefined) {
      field.phosphorusMeasuredMgKg =
        phosphorusMeasuredMgKg === null || phosphorusMeasuredMgKg === ''
          ? null
          : Number(phosphorusMeasuredMgKg);
    }
    if (potassiumMeasuredMgKg !== undefined) {
      field.potassiumMeasuredMgKg =
        potassiumMeasuredMgKg === null || potassiumMeasuredMgKg === ''
          ? null
          : Number(potassiumMeasuredMgKg);
    }
    if (currentCrop !== undefined) field.currentCrop = String(currentCrop).trim();
    if (previousSeasonCrop !== undefined) field.previousSeasonCrop = String(previousSeasonCrop).trim();
    if (twoSeasonsAgoCrop !== undefined) field.twoSeasonsAgoCrop = String(twoSeasonsAgoCrop).trim();
    if (farmingSystem !== undefined) field.farmingSystem = String(farmingSystem).trim();
    if (status && ['active', 'fallow', 'preparing'].includes(status)) field.status = status;
    if (notes !== undefined) field.notes = String(notes);
    field.updatedAt = new Date().toISOString();

    store.logAudit(
      req.authUser!.id,
      'FIELD_UPDATED',
      'Field',
      field.id,
      { name: field.name },
      req.ip || '127.0.0.1'
    );
    res.json(field);
  });

  app.put('/api/fields/:fieldId/soil-profile', requireAuth, (req: AuthRequest, res) => {
    const field = store.db.fields.find((fl) => fl.id === req.params.fieldId);
    if (!field) {
      res.status(404).json({ error: 'Field not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, field.farmId)) {
      res.status(403).json({ error: 'Only the farm owner can update field soil and crop history.' });
      return;
    }

    const {
      soilTexture,
      organicMatterLevel,
      soilDrainage,
      waterHoldingCharacteristic,
      irrigationType,
      soilPhMeasured,
      nitrogenMeasuredMgKg,
      phosphorusMeasuredMgKg,
      potassiumMeasuredMgKg,
      currentCrop,
      previousSeasonCrop,
      twoSeasonsAgoCrop,
      farmingSystem,
      soilValueProvenance,
    } = req.body || {};

    if (['Sandy', 'Loam', 'Clay Loam', 'Clay', 'Unknown'].includes(soilTexture)) {
      field.soilTexture = soilTexture;
      if (soilTexture !== 'Unknown') field.soilType = soilTexture;
    }
    if (['Low', 'Medium', 'High', 'Unknown'].includes(organicMatterLevel)) {
      field.organicMatterLevel = organicMatterLevel;
    }
    if (['Poor', 'Moderate', 'Good', 'Unknown'].includes(soilDrainage)) {
      field.soilDrainage = soilDrainage;
    }
    if (['Low', 'Moderate', 'High', 'Unknown'].includes(waterHoldingCharacteristic)) {
      field.waterHoldingCharacteristic = waterHoldingCharacteristic;
    }
    if (irrigationType) field.irrigationType = String(irrigationType).trim();
    if (soilPhMeasured !== undefined) {
      if (soilPhMeasured === null || soilPhMeasured === '') {
        field.soilPhMeasured = null;
      } else {
        const parsedPh = Number(soilPhMeasured);
        if (!Number.isFinite(parsedPh) || parsedPh < 3.5 || parsedPh > 9.5) {
          res.status(400).json({ error: 'Measured soil pH must be between 3.5 and 9.5.' });
          return;
        }
        field.soilPhMeasured = Number(parsedPh.toFixed(1));
      }
    }
    if (nitrogenMeasuredMgKg !== undefined) {
      field.nitrogenMeasuredMgKg =
        nitrogenMeasuredMgKg === null || nitrogenMeasuredMgKg === ''
          ? null
          : Number(nitrogenMeasuredMgKg);
    }
    if (phosphorusMeasuredMgKg !== undefined) {
      field.phosphorusMeasuredMgKg =
        phosphorusMeasuredMgKg === null || phosphorusMeasuredMgKg === ''
          ? null
          : Number(phosphorusMeasuredMgKg);
    }
    if (potassiumMeasuredMgKg !== undefined) {
      field.potassiumMeasuredMgKg =
        potassiumMeasuredMgKg === null || potassiumMeasuredMgKg === ''
          ? null
          : Number(potassiumMeasuredMgKg);
    }
    if (currentCrop !== undefined) {
      field.currentCrop = String(currentCrop).trim();
      if (field.currentCrop) field.cropOrLivestock = field.currentCrop;
    }
    if (previousSeasonCrop !== undefined) field.previousSeasonCrop = String(previousSeasonCrop).trim();
    if (twoSeasonsAgoCrop !== undefined) field.twoSeasonsAgoCrop = String(twoSeasonsAgoCrop).trim();
    if (farmingSystem !== undefined) field.farmingSystem = String(farmingSystem).trim();

    if (soilValueProvenance && typeof soilValueProvenance === 'object') {
      const validProv = new Set<SoilProvenanceType>([
        'farmer_provided',
        'laboratory_measured',
        'external_dataset',
        'estimated',
        'unknown',
      ]);
      const cleaned: Record<string, SoilProvenanceType> = { ...(field.soilValueProvenance || {}) };
      for (const [k, v] of Object.entries(soilValueProvenance as Record<string, string>)) {
        if (validProv.has(v as SoilProvenanceType)) cleaned[k] = v as SoilProvenanceType;
      }
      field.soilValueProvenance = cleaned;
    }

    field.updatedAt = new Date().toISOString();
    store.logAudit(
      req.authUser!.id,
      'FIELD_SOIL_PROFILE_UPDATED',
      'Field',
      field.id,
      { farmId: field.farmId, name: field.name, soilTexture: field.soilTexture },
      req.ip || '127.0.0.1'
    );
    res.json(field);
  });

  app.delete('/api/fields/:fieldId', requireAuth, (req: AuthRequest, res) => {
    const field = store.db.fields.find((fl) => fl.id === req.params.fieldId);
    if (!field) {
      res.status(404).json({ error: 'Field not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, field.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    store.db.fields = store.db.fields.filter((fl) => fl.id !== field.id);
    store.logAudit(
      req.authUser!.id,
      'FIELD_DELETED',
      'Field',
      field.id,
      { name: field.name },
      req.ip || '127.0.0.1'
    );
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // Crop Management & Historical Activity Tracking
  // ------------------------------------------------------------------
  app.get('/api/crops/analytics', requireAuth, (req: AuthRequest, res) => {
    const user = req.authUser!;
    const accessibleFarmIds = getAccessibleFarmIds(user, 'crops');
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    if (farmFilter && !accessibleFarmIds.includes(farmFilter)) {
      res.status(403).json({ error: 'You do not have crop access to this farm.' });
      return;
    }
    const canSeeFinancial = (farmId: string) =>
      user.roleCode !== 'agricultural_expert' ||
      Boolean(getActiveFarmGrantForExpert(user.id, farmId)?.scopes.financialSummary);

    const crops = store.db.crops.filter(
      (c) => accessibleFarmIds.includes(c.farmId) && (!farmFilter || c.farmId === farmFilter)
    );
    const cropFarmMap = new Map(crops.map((c) => [c.id, c.farmId]));
    const cropIds = new Set(crops.map((c) => c.id));
    const activities = store.db.cropActivities.filter((a) => cropIds.has(a.cropId));

    const totalRegisteredCrops = crops.length;
    const totalCultivatedHectares = Number(
      crops.reduce((s, c) => s + c.cultivatedAreaHectares, 0).toFixed(2)
    );
    const totalPlanted = crops.reduce((s, c) => s + c.plantingQuantity, 0);
    const damagedPlants = crops.reduce((s, c) => s + c.damagedPlants, 0);
    const remainingPlants = Math.max(0, totalPlanted - damagedPlants);
    const totalHarvestedKg = Number(
      crops.reduce((s, c) => s + c.harvestedQuantityKg, 0).toFixed(2)
    );
    const estimatedHarvestValueZar = Number(
      crops
        .filter((c) => canSeeFinancial(c.farmId))
        .reduce((s, c) => s + c.estimatedValueZar, 0)
        .toFixed(2)
    );

    const byCrop = crops.map((c) => ({
      id: c.id,
      cropName: c.cropName,
      cropVariety: c.cropVariety,
      cultivatedAreaHectares: c.cultivatedAreaHectares,
      harvestedQuantityKg: c.harvestedQuantityKg,
      estimatedValueZar: canSeeFinancial(c.farmId) ? c.estimatedValueZar : 0,
      remainingPlants: Math.max(0, c.plantingQuantity - c.damagedPlants),
      growthStage: c.growthStage,
    }));

    // Group activities by month (YYYY-MM) for performance over time
    const monthlyMap = new Map<
      string,
      { month: string; harvestKg: number; activitiesCount: number; valueZar: number }
    >();
    for (const act of activities) {
      const month = (act.activityDate || act.createdAt).slice(0, 7);
      const entry = monthlyMap.get(month) || {
        month,
        harvestKg: 0,
        activitiesCount: 0,
        valueZar: 0,
      };
      entry.activitiesCount += 1;
      if (act.activityType === 'harvest') {
        entry.harvestKg += act.quantity;
        const cFarmId = cropFarmMap.get(act.cropId) || act.farmId;
        if (canSeeFinancial(cFarmId)) {
          entry.valueZar += act.valueZar;
        }
      }
      monthlyMap.set(month, entry);
    }

    const timeline = Array.from(monthlyMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    res.json({
      totalRegisteredCrops,
      totalCultivatedHectares,
      totalPlanted,
      damagedPlants,
      remainingPlants,
      totalHarvestedKg,
      estimatedHarvestValueZar,
      byCrop,
      timeline,
    });
  });

  app.get('/api/crops', requireAuth, (req: AuthRequest, res) => {
    const user = req.authUser!;
    const accessibleFarmIds = getAccessibleFarmIds(user, 'crops');
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    if (farmFilter && !accessibleFarmIds.includes(farmFilter)) {
      res.status(403).json({ error: 'You do not have crop access to this farm.' });
      return;
    }
    const canSeeFinancial = (farmId: string) =>
      user.roleCode !== 'agricultural_expert' ||
      Boolean(getActiveFarmGrantForExpert(user.id, farmId)?.scopes.financialSummary);
    const list = store.db.crops
      .filter(
        (c) => accessibleFarmIds.includes(c.farmId) && (!farmFilter || c.farmId === farmFilter)
      )
      .map((c) => {
        const farm = store.db.farms.find((f) => f.id === c.farmId);
        const field = store.db.fields.find((fl) => fl.id === c.fieldId);
        const activities = store.db.cropActivities.filter((a) => a.cropId === c.id);
        return {
          ...c,
          estimatedValueZar: canSeeFinancial(c.farmId) ? c.estimatedValueZar : 0,
          farmName: farm?.name || 'Farm',
          fieldName: field?.name || 'General Farm Block',
          remainingPlants: Math.max(0, c.plantingQuantity - c.damagedPlants),
          activityCount: activities.length,
        };
      });
    res.json(list);
  });

  app.post('/api/crops', requireAuth, (req: AuthRequest, res) => {
    const {
      farmId,
      fieldId,
      cropName,
      cropVariety,
      plantingDate,
      plantingQuantity,
      cultivatedAreaHectares,
      soilInformation,
      irrigationMethod,
      fertiliserInformation,
      expectedHarvestingDate,
      growthStage,
      estimatedValueZar,
    } = req.body || {};

    if (!farmId || !cropName || !cropVariety || !plantingDate || !expectedHarvestingDate) {
      res.status(400).json({
        error: 'Farm, crop name, variety, planting date, and expected harvest date are required.',
      });
      return;
    }
    if (String(expectedHarvestingDate) < String(plantingDate)) {
      res.status(400).json({
        error: 'Expected harvesting date cannot be earlier than the planting date.',
      });
      return;
    }

    if (!userCanModifyFarm(req.authUser!, String(farmId))) {
      res.status(403).json({ error: 'You do not have permission to add crops to this farm.' });
      return;
    }

    const now = new Date().toISOString();
    const cropId = `crop-${crypto.randomUUID()}`;
    const validStage: CropGrowthStage = [
      'planted',
      'germination',
      'vegetative',
      'flowering',
      'fruiting',
      'mature',
      'harvested',
    ].includes(growthStage)
      ? growthStage
      : 'planted';

    const newCrop = {
      id: cropId,
      farmId: String(farmId),
      fieldId: fieldId ? String(fieldId) : null,
      ownerId: req.authUser!.id,
      cropName: String(cropName).trim(),
      cropVariety: String(cropVariety).trim(),
      plantingDate: String(plantingDate),
      plantingQuantity: Math.max(0, Number(plantingQuantity) || 0),
      damagedPlants: 0,
      cultivatedAreaHectares: Math.max(0.05, Number(cultivatedAreaHectares) || 0.5),
      soilInformation: String(soilInformation || 'Standard topsoil'),
      irrigationMethod: String(irrigationMethod || 'Rain-fed'),
      fertiliserInformation: String(fertiliserInformation || 'Basal NPK'),
      expectedHarvestingDate: String(expectedHarvestingDate),
      growthStage: validStage,
      harvestedQuantityKg: 0,
      estimatedValueZar: Math.max(0, Number(estimatedValueZar) || 0),
      status: (validStage === 'harvested' ? 'harvested' : 'active') as 'active' | 'harvested',
      createdAt: now,
      updatedAt: now,
    };

    store.db.crops.push(newCrop);
    if (newCrop.plantingQuantity > 0) {
      const derivedUnitPrice =
        newCrop.estimatedValueZar > 0
          ? Number((newCrop.estimatedValueZar / newCrop.plantingQuantity).toFixed(2))
          : 0;
      store.db.cropStockMovements.unshift({
        id: `csm-${crypto.randomUUID()}`,
        cropId: newCrop.id,
        farmId: newCrop.farmId,
        actorUserId: req.authUser!.id,
        movementType: 'planting',
        movementDate: newCrop.plantingDate,
        quantityDelta: newCrop.plantingQuantity,
        unit: 'plants',
        unitPriceZar: derivedUnitPrice,
        totalValueZar: Number((newCrop.plantingQuantity * derivedUnitPrice).toFixed(2)),
        resultingRemainingPlants: newCrop.plantingQuantity,
        resultingStoredKg: 0,
        notes: `Initial planting registered (${newCrop.plantingQuantity.toLocaleString()} plants across ${newCrop.cultivatedAreaHectares} ha).`,
        incidentId: null,
        createdAt: now,
      });
    }
    store.db.cropActivities.unshift({
      id: `cact-${crypto.randomUUID()}`,
      cropId,
      farmId: newCrop.farmId,
      fieldId: newCrop.fieldId,
      actorUserId: req.authUser!.id,
      activityType: 'stage_update',
      activityDate: newCrop.plantingDate,
      quantity: newCrop.plantingQuantity,
      unit: 'plants',
      valueZar: 0,
      notes: `Registered ${newCrop.cropName} (${newCrop.cropVariety}) at stage: ${validStage}.`,
      snapshot: null,
      createdAt: now,
    });

    store.logAudit(
      req.authUser!.id,
      'CROP_REGISTERED',
      'Crop',
      cropId,
      { cropName: newCrop.cropName, farmId: newCrop.farmId },
      req.ip || '127.0.0.1'
    );

    res.status(201).json(newCrop);
  });

  app.put('/api/crops/:id', requireAuth, (req: AuthRequest, res) => {
    const crop = store.db.crops.find((c) => c.id === req.params.id);
    if (!crop) {
      res.status(404).json({ error: 'Crop record not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, crop.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    // Preserve historical snapshot before mutating crop record
    const previousSnapshot = { ...crop };
    const now = new Date().toISOString();

    const {
      fieldId,
      cropName,
      cropVariety,
      plantingDate,
      plantingQuantity,
      damagedPlants,
      cultivatedAreaHectares,
      soilInformation,
      irrigationMethod,
      fertiliserInformation,
      expectedHarvestingDate,
      growthStage,
      harvestedQuantityKg,
      estimatedValueZar,
    } = req.body || {};

    if (fieldId !== undefined) crop.fieldId = fieldId || null;
    if (cropName) crop.cropName = String(cropName).trim();
    if (cropVariety) crop.cropVariety = String(cropVariety).trim();
    if (plantingDate) crop.plantingDate = String(plantingDate);
    if (expectedHarvestingDate) crop.expectedHarvestingDate = String(expectedHarvestingDate);
    if (crop.expectedHarvestingDate < crop.plantingDate) {
      crop.plantingDate = previousSnapshot.plantingDate;
      crop.expectedHarvestingDate = previousSnapshot.expectedHarvestingDate;
      res.status(400).json({ error: 'Expected harvesting date cannot be earlier than the planting date.' });
      return;
    }
    if (plantingQuantity !== undefined) {
      crop.plantingQuantity = Math.max(0, Number(plantingQuantity) || 0);
    }
    if (damagedPlants !== undefined) {
      crop.damagedPlants = Math.max(0, Math.min(crop.plantingQuantity, Number(damagedPlants) || 0));
    } else if (crop.damagedPlants > crop.plantingQuantity) {
      crop.damagedPlants = crop.plantingQuantity;
    }
    if (cultivatedAreaHectares !== undefined) {
      crop.cultivatedAreaHectares = Math.max(0.05, Number(cultivatedAreaHectares) || 0.05);
    }
    if (soilInformation !== undefined) crop.soilInformation = String(soilInformation).trim();
    if (irrigationMethod !== undefined) crop.irrigationMethod = String(irrigationMethod).trim();
    if (fertiliserInformation !== undefined) {
      crop.fertiliserInformation = String(fertiliserInformation).trim();
    }
    if (
      growthStage &&
      ['planted', 'germination', 'vegetative', 'flowering', 'fruiting', 'mature', 'harvested'].includes(
        growthStage
      )
    ) {
      crop.growthStage = growthStage;
      if (growthStage === 'harvested') crop.status = 'harvested';
    }
    if (harvestedQuantityKg !== undefined) {
      crop.harvestedQuantityKg = Math.max(0, Number(harvestedQuantityKg) || 0);
    }
    if (estimatedValueZar !== undefined) {
      crop.estimatedValueZar = Math.max(0, Number(estimatedValueZar) || 0);
    }
    crop.updatedAt = now;

    // Append immutable stock movement entries if plant or harvest quantities changed during edit
    if (crop.plantingQuantity !== previousSnapshot.plantingQuantity) {
      const delta = crop.plantingQuantity - previousSnapshot.plantingQuantity;
      store.db.cropStockMovements.unshift({
        id: `csm-${crypto.randomUUID()}`,
        cropId: crop.id,
        farmId: crop.farmId,
        actorUserId: req.authUser!.id,
        movementType: 'adjustment',
        movementDate: now.slice(0, 10),
        quantityDelta: delta,
        unit: 'plants',
        unitPriceZar: 0,
        totalValueZar: 0,
        resultingRemainingPlants: Math.max(0, crop.plantingQuantity - crop.damagedPlants),
        resultingStoredKg: null,
        notes: `Planted quantity adjusted from ${previousSnapshot.plantingQuantity.toLocaleString()} to ${crop.plantingQuantity.toLocaleString()} via crop record update.`,
        incidentId: null,
        createdAt: now,
      });
    }
    if (crop.damagedPlants !== previousSnapshot.damagedPlants) {
      const dmgDelta = crop.damagedPlants - previousSnapshot.damagedPlants;
      store.db.cropStockMovements.unshift({
        id: `csm-${crypto.randomUUID()}`,
        cropId: crop.id,
        farmId: crop.farmId,
        actorUserId: req.authUser!.id,
        movementType: dmgDelta > 0 ? 'damage' : 'adjustment',
        movementDate: now.slice(0, 10),
        quantityDelta: -dmgDelta,
        unit: 'plants',
        unitPriceZar: 0,
        totalValueZar: 0,
        resultingRemainingPlants: Math.max(0, crop.plantingQuantity - crop.damagedPlants),
        resultingStoredKg: null,
        notes: `Damaged plants updated from ${previousSnapshot.damagedPlants.toLocaleString()} to ${crop.damagedPlants.toLocaleString()} via crop record update.`,
        incidentId: null,
        createdAt: now,
      });
    }
    if (crop.harvestedQuantityKg !== previousSnapshot.harvestedQuantityKg) {
      const kgDelta = Number((crop.harvestedQuantityKg - previousSnapshot.harvestedQuantityKg).toFixed(2));
      store.db.cropStockMovements.unshift({
        id: `csm-${crypto.randomUUID()}`,
        cropId: crop.id,
        farmId: crop.farmId,
        actorUserId: req.authUser!.id,
        movementType: kgDelta > 0 ? 'harvest' : 'adjustment',
        movementDate: now.slice(0, 10),
        quantityDelta: kgDelta,
        unit: 'kg',
        unitPriceZar: 0,
        totalValueZar: 0,
        resultingRemainingPlants: Math.max(0, crop.plantingQuantity - crop.damagedPlants),
        resultingStoredKg: null,
        notes: `Harvested quantity updated from ${previousSnapshot.harvestedQuantityKg.toLocaleString()} kg to ${crop.harvestedQuantityKg.toLocaleString()} kg via crop record update.`,
        incidentId: null,
        createdAt: now,
      });
    }

    store.db.cropActivities.unshift({
      id: `cact-${crypto.randomUUID()}`,
      cropId: crop.id,
      farmId: crop.farmId,
      fieldId: crop.fieldId,
      actorUserId: req.authUser!.id,
      activityType: 'record_edit',
      activityDate: now.slice(0, 10),
      quantity: 0,
      unit: 'edit',
      valueZar: 0,
      notes: 'Updated crop record (previous values archived in snapshot).',
      snapshot: previousSnapshot,
      createdAt: now,
    });

    store.logAudit(
      req.authUser!.id,
      'CROP_UPDATED',
      'Crop',
      crop.id,
      { cropName: crop.cropName },
      req.ip || '127.0.0.1'
    );

    res.json(crop);
  });

  app.delete('/api/crops/:id', requireAuth, (req: AuthRequest, res) => {
    const crop = store.db.crops.find((c) => c.id === req.params.id);
    if (!crop) {
      res.status(404).json({ error: 'Crop record not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, crop.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    store.db.crops = store.db.crops.filter((c) => c.id !== crop.id);
    store.db.cropActivities = store.db.cropActivities.filter((a) => a.cropId !== crop.id);
    store.db.cropStockMovements = store.db.cropStockMovements.filter((cm) => cm.cropId !== crop.id);
    store.db.stockPriceSettings = store.db.stockPriceSettings.filter((sp) => sp.entityId !== crop.id);
    store.logAudit(
      req.authUser!.id,
      'CROP_REMOVED',
      'Crop',
      crop.id,
      { cropName: crop.cropName },
      req.ip || '127.0.0.1'
    );
    res.json({ ok: true });
  });

  app.get('/api/crops/:id/activities', requireAuth, (req: AuthRequest, res) => {
    const crop = store.db.crops.find((c) => c.id === req.params.id);
    if (!crop) {
      res.status(404).json({ error: 'Crop not found.' });
      return;
    }
    if (!userCanAccessFarm(req.authUser!, crop.farmId, 'crops')) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    const logs = store.db.cropActivities.filter((a) => a.cropId === crop.id);
    res.json(logs);
  });

  app.post('/api/crops/:id/activities', requireAuth, (req: AuthRequest, res) => {
    const crop = store.db.crops.find((c) => c.id === req.params.id);
    if (!crop) {
      res.status(404).json({ error: 'Crop not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, crop.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const { activityType, activityDate, quantity, unit, valueZar, notes, newGrowthStage } =
      req.body || {};

    const validTypes: CropActivityType[] = [
      'stage_update',
      'irrigation',
      'fertiliser',
      'pest',
      'disease',
      'damage',
      'harvest',
    ];
    if (!validTypes.includes(activityType)) {
      res.status(400).json({ error: 'Invalid crop activity type.' });
      return;
    }

    const now = new Date().toISOString();
    const qty = Math.max(0, Number(quantity) || 0);
    const val = Math.max(0, Number(valueZar) || 0);

    if (
      activityType === 'stage_update' &&
      newGrowthStage &&
      ['planted', 'germination', 'vegetative', 'flowering', 'fruiting', 'mature', 'harvested'].includes(
        newGrowthStage
      )
    ) {
      crop.growthStage = newGrowthStage;
      if (newGrowthStage === 'harvested') crop.status = 'harvested';
    }

    if (activityType === 'damage') {
      recordCropStockMovement({
        crop,
        actorUserId: req.authUser!.id,
        movementType: 'damage',
        movementDate: String(activityDate || now.slice(0, 10)),
        quantity: qty,
        unit: String(unit || 'plants'),
        notes: String(notes || 'Crop damage logged').trim(),
      });
    } else if (activityType === 'harvest') {
      recordCropStockMovement({
        crop,
        actorUserId: req.authUser!.id,
        movementType: 'harvest',
        movementDate: String(activityDate || now.slice(0, 10)),
        quantity: qty,
        unit: String(unit || 'kg'),
        unitPriceZar: qty > 0 && val > 0 ? Number((val / qty).toFixed(2)) : undefined,
        notes: String(notes || 'Harvest logged').trim(),
      });
      crop.growthStage = 'harvested';
      crop.status = 'harvested';
    }

    crop.updatedAt = now;

    const activity = {
      id: `cact-${crypto.randomUUID()}`,
      cropId: crop.id,
      farmId: crop.farmId,
      fieldId: crop.fieldId,
      actorUserId: req.authUser!.id,
      activityType: activityType as CropActivityType,
      activityDate: String(activityDate || now.slice(0, 10)),
      quantity: qty,
      unit: String(unit || (activityType === 'irrigation' ? 'liters' : activityType === 'damage' ? 'plants' : 'kg')),
      valueZar: val,
      notes: String(notes || '').trim(),
      snapshot: null,
      createdAt: now,
    };

    store.db.cropActivities.unshift(activity);
    store.logAudit(
      req.authUser!.id,
      'CROP_ACTIVITY_RECORDED',
      'CropActivity',
      activity.id,
      { cropId: crop.id, activityType, quantity: qty },
      req.ip || '127.0.0.1'
    );

    res.status(201).json({ activity, crop });
  });

  // ------------------------------------------------------------------
  // Livestock Management & Analytics
  // ------------------------------------------------------------------
  app.get('/api/livestock/analytics', requireAuth, (req: AuthRequest, res) => {
    const user = req.authUser!;
    const accessibleFarmIds = getAccessibleFarmIds(user, 'livestock');
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    if (farmFilter && !accessibleFarmIds.includes(farmFilter)) {
      res.status(403).json({ error: 'You do not have livestock access to this farm.' });
      return;
    }
    const canSeeFinancial = (farmId: string) =>
      user.roleCode !== 'agricultural_expert' ||
      Boolean(getActiveFarmGrantForExpert(user.id, farmId)?.scopes.financialSummary);

    const groups = store.db.livestockGroups.filter(
      (g) => accessibleFarmIds.includes(g.farmId) && (!farmFilter || g.farmId === farmFilter)
    );
    const groupIds = new Set(groups.map((g) => g.id));
    const records = store.db.livestockRecords.filter((r) => groupIds.has(r.livestockGroupId));

    const categories: LivestockAnimalType[] = ['Cattle', 'Sheep', 'Goats', 'Pigs', 'Poultry'];
    const byCategory = categories.map((cat) => {
      const matched = groups.filter((g) => g.animalType === cat);
      return {
        category: cat,
        count: matched.reduce((s, g) => s + g.quantity, 0),
        valueZar: matched
          .filter((g) => canSeeFinancial(g.farmId))
          .reduce((s, g) => s + g.quantity * g.estimatedUnitValueZar, 0),
      };
    });

    const totalAnimals = groups.reduce((s, g) => s + g.quantity, 0);
    const estimatedLivestockValueZar = Number(
      groups
        .filter((g) => canSeeFinancial(g.farmId))
        .reduce((s, g) => s + g.quantity * g.estimatedUnitValueZar, 0)
        .toFixed(2)
    );
    const births = records
      .filter((r) => r.recordType === 'Birth')
      .reduce((s, r) => s + Math.abs(r.quantityChange), 0);
    const deaths = records
      .filter((r) => r.recordType === 'Death')
      .reduce((s, r) => s + Math.abs(r.quantityChange), 0);
    const purchases = records
      .filter((r) => r.recordType === 'Purchase')
      .reduce((s, r) => s + Math.abs(r.quantityChange), 0);
    const sales = records
      .filter((r) => r.recordType === 'Sale')
      .reduce((s, r) => s + Math.abs(r.quantityChange), 0);

    res.json({
      totalAnimals,
      byCategory,
      births,
      deaths,
      purchases,
      sales,
      estimatedLivestockValueZar,
      recordCount: records.length,
    });
  });

  app.get('/api/livestock', requireAuth, (req: AuthRequest, res) => {
    const user = req.authUser!;
    const accessibleFarmIds = getAccessibleFarmIds(user, 'livestock');
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    if (farmFilter && !accessibleFarmIds.includes(farmFilter)) {
      res.status(403).json({ error: 'You do not have livestock access to this farm.' });
      return;
    }
    const canSeeFinancial = (farmId: string) =>
      user.roleCode !== 'agricultural_expert' ||
      Boolean(getActiveFarmGrantForExpert(user.id, farmId)?.scopes.financialSummary);

    const list = store.db.livestockGroups
      .filter(
        (g) => accessibleFarmIds.includes(g.farmId) && (!farmFilter || g.farmId === farmFilter)
      )
      .map((g) => {
        const farm = store.db.farms.find((f) => f.id === g.farmId);
        const field = store.db.fields.find((fl) => fl.id === g.fieldId);
        const records = store.db.livestockRecords.filter((r) => r.livestockGroupId === g.id);
        const hideFinancial = !canSeeFinancial(g.farmId);
        return {
          ...g,
          estimatedUnitValueZar: hideFinancial ? 0 : g.estimatedUnitValueZar,
          farmName: farm?.name || 'Farm',
          fieldName: field?.name || null,
          totalValueZar: hideFinancial ? 0 : Number((g.quantity * g.estimatedUnitValueZar).toFixed(2)),
          recordCount: records.length,
        };
      });
    res.json(list);
  });

  app.post('/api/livestock', requireAuth, (req: AuthRequest, res) => {
    const {
      farmId,
      fieldId,
      animalType,
      groupName,
      breed,
      quantity,
      identificationNumber,
      registrationDate,
      healthStatus,
      feedingInformation,
      grazingInformation,
      housingInformation,
      estimatedUnitValueZar,
    } = req.body || {};

    const validTypes: LivestockAnimalType[] = ['Cattle', 'Sheep', 'Goats', 'Pigs', 'Poultry'];
    if (!farmId || !validTypes.includes(animalType) || !groupName || !breed) {
      res.status(400).json({ error: 'Farm, animal type, group/animal name, and breed are required.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, String(farmId))) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const now = new Date().toISOString();
    const id = `lvk-${crypto.randomUUID()}`;
    const validHealth: LivestockHealthStatus = [
      'Healthy',
      'Under Observation',
      'Treatment',
      'Quarantine',
    ].includes(healthStatus)
      ? healthStatus
      : 'Healthy';

    const newGroup = {
      id,
      farmId: String(farmId),
      fieldId: fieldId ? String(fieldId) : null,
      ownerId: req.authUser!.id,
      animalType: animalType as LivestockAnimalType,
      groupName: String(groupName).trim(),
      breed: String(breed).trim(),
      quantity: Math.max(1, Number(quantity) || 1),
      identificationNumber: String(identificationNumber || '').trim(),
      registrationDate: String(registrationDate || now.slice(0, 10)),
      healthStatus: validHealth,
      feedingInformation: String(feedingInformation || 'Balanced ration / grazing'),
      grazingInformation: String(grazingInformation || 'Paddock grazing'),
      housingInformation: String(housingInformation || 'Standard shelter'),
      estimatedUnitValueZar: Math.max(0, Number(estimatedUnitValueZar) || 0),
      createdAt: now,
      updatedAt: now,
    };

    store.db.livestockGroups.push(newGroup);
    store.logAudit(
      req.authUser!.id,
      'LIVESTOCK_REGISTERED',
      'LivestockGroup',
      id,
      { animalType, quantity: newGroup.quantity },
      req.ip || '127.0.0.1'
    );
    res.status(201).json(newGroup);
  });

  app.put('/api/livestock/:id', requireAuth, (req: AuthRequest, res) => {
    const group = store.db.livestockGroups.find((g) => g.id === req.params.id);
    if (!group) {
      res.status(404).json({ error: 'Livestock record not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, group.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const {
      groupName,
      breed,
      quantity,
      identificationNumber,
      healthStatus,
      feedingInformation,
      grazingInformation,
      housingInformation,
      estimatedUnitValueZar,
      fieldId,
    } = req.body || {};

    if (groupName) group.groupName = String(groupName).trim();
    if (breed) group.breed = String(breed).trim();
    if (quantity !== undefined) {
      const parsedQty = Number(quantity);
      if (!Number.isFinite(parsedQty) || parsedQty < 0) {
        res.status(400).json({ error: 'Livestock quantity must be a non-negative number.' });
        return;
      }
      group.quantity = Math.round(parsedQty);
    }
    if (identificationNumber !== undefined) group.identificationNumber = String(identificationNumber);
    if (
      healthStatus &&
      ['Healthy', 'Under Observation', 'Treatment', 'Quarantine'].includes(healthStatus)
    ) {
      group.healthStatus = healthStatus;
    }
    if (feedingInformation !== undefined) group.feedingInformation = String(feedingInformation);
    if (grazingInformation !== undefined) group.grazingInformation = String(grazingInformation);
    if (housingInformation !== undefined) group.housingInformation = String(housingInformation);
    if (estimatedUnitValueZar !== undefined) {
      const parsedVal = Number(estimatedUnitValueZar);
      if (!Number.isFinite(parsedVal) || parsedVal < 0) {
        res.status(400).json({ error: 'Estimated unit value must be a non-negative number.' });
        return;
      }
      group.estimatedUnitValueZar = Number(parsedVal.toFixed(2));
    }
    if (fieldId !== undefined) group.fieldId = fieldId || null;
    group.updatedAt = new Date().toISOString();

    store.logAudit(
      req.authUser!.id,
      'LIVESTOCK_UPDATED',
      'LivestockGroup',
      group.id,
      { groupName: group.groupName },
      req.ip || '127.0.0.1'
    );
    res.json(group);
  });

  app.delete('/api/livestock/:id', requireAuth, (req: AuthRequest, res) => {
    const group = store.db.livestockGroups.find((g) => g.id === req.params.id);
    if (!group) {
      res.status(404).json({ error: 'Livestock record not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, group.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    store.db.livestockGroups = store.db.livestockGroups.filter((g) => g.id !== group.id);
    store.db.livestockRecords = store.db.livestockRecords.filter(
      (r) => r.livestockGroupId !== group.id
    );
    store.logAudit(
      req.authUser!.id,
      'LIVESTOCK_DELETED',
      'LivestockGroup',
      group.id,
      { groupName: group.groupName },
      req.ip || '127.0.0.1'
    );
    res.json({ ok: true });
  });

  app.get('/api/livestock/:id/records', requireAuth, (req: AuthRequest, res) => {
    const group = store.db.livestockGroups.find((g) => g.id === req.params.id);
    if (!group) {
      res.status(404).json({ error: 'Livestock group not found.' });
      return;
    }
    if (!userCanAccessFarm(req.authUser!, group.farmId, 'livestock')) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    const hideFinancial =
      req.authUser!.roleCode === 'agricultural_expert' &&
      !getActiveFarmGrantForExpert(req.authUser!.id, group.farmId)?.scopes.financialSummary;
    const records = store.db.livestockRecords
      .filter((r) => r.livestockGroupId === group.id)
      .map((r) => (hideFinancial ? { ...r, valueZar: 0 } : r));
    res.json(records);
  });

  app.post('/api/livestock/:id/records', requireAuth, (req: AuthRequest, res) => {
    const group = store.db.livestockGroups.find((g) => g.id === req.params.id);
    if (!group) {
      res.status(404).json({ error: 'Livestock group not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, group.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const { recordType, recordDate, count, productionAmount, productionUnit, valueZar, notes } =
      req.body || {};

    const validTypes: LivestockRecordType[] = [
      'Birth',
      'Death',
      'Purchase',
      'Sale',
      'Transfer',
      'Feeding',
      'Veterinary',
      'Vaccination',
      'Production',
    ];
    if (!validTypes.includes(recordType)) {
      res.status(400).json({ error: 'Invalid livestock record type.' });
      return;
    }

    const absCount = Math.max(0, Number(count) || 0);
    let quantityChange = 0;
    if (recordType === 'Birth' || recordType === 'Purchase') {
      quantityChange = absCount;
    } else if (recordType === 'Death' || recordType === 'Sale' || recordType === 'Transfer') {
      quantityChange = -Math.min(group.quantity, absCount);
    }

    group.quantity = Math.max(0, group.quantity + quantityChange);
    group.updatedAt = new Date().toISOString();

    const rec = {
      id: `lrec-${crypto.randomUUID()}`,
      livestockGroupId: group.id,
      farmId: group.farmId,
      actorUserId: req.authUser!.id,
      recordType: recordType as LivestockRecordType,
      recordDate: String(recordDate || group.updatedAt.slice(0, 10)),
      quantityChange,
      productionAmount: Math.max(0, Number(productionAmount) || 0),
      productionUnit: String(productionUnit || ''),
      valueZar: Math.max(0, Number(valueZar) || 0),
      notes: String(notes || '').trim(),
      createdAt: group.updatedAt,
    };

    store.db.livestockRecords.unshift(rec);
    store.logAudit(
      req.authUser!.id,
      'LIVESTOCK_RECORD_ADDED',
      'LivestockRecord',
      rec.id,
      { groupId: group.id, recordType, quantityChange },
      req.ip || '127.0.0.1'
    );

    res.status(201).json({ record: rec, group });
  });

  // ------------------------------------------------------------------
  // Mixed Farming Management (Shared Land, Feed, Water, Combined Finances)
  // ------------------------------------------------------------------
  app.get('/api/mixed-farming/summary', requireAuth, (req: AuthRequest, res) => {
    const user = req.authUser!;
    const accessibleFarmIds = getAccessibleFarmIds(user, 'overview');
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    if (farmFilter && !accessibleFarmIds.includes(farmFilter)) {
      res.status(403).json({ error: 'Access denied for this farm.' });
      return;
    }
    const targetIds = farmFilter
      ? accessibleFarmIds.filter((id) => id === farmFilter)
      : accessibleFarmIds;

    const canSeeFinancial = (farmId: string) =>
      user.roleCode !== 'agricultural_expert' ||
      Boolean(getActiveFarmGrantForExpert(user.id, farmId)?.scopes.financialSummary);

    const farms = store.db.farms.filter((f) => targetIds.includes(f.id));
    const crops = store.db.crops.filter((c) => targetIds.includes(c.farmId));
    const livestock = store.db.livestockGroups.filter((g) => targetIds.includes(g.farmId));
    const entries = store.db.mixedFarmingEntries.filter((e) => targetIds.includes(e.farmId));
    const fields = store.db.fields.filter((fl) => targetIds.includes(fl.farmId));

    const totalFarmAreaHa = Number(farms.reduce((s, f) => s + f.farmSizeHectares, 0).toFixed(2));
    const cropCultivatedHa = Number(
      crops.reduce((s, c) => s + c.cultivatedAreaHectares, 0).toFixed(2)
    );
    const grazingFieldsHa = Number(
      fields
        .filter((fl) => !crops.some((c) => c.fieldId === fl.id))
        .reduce((s, fl) => s + fl.areaHectares, 0)
        .toFixed(2)
    );

    const cropValueZar = Number(
      crops
        .filter((c) => canSeeFinancial(c.farmId))
        .reduce((s, c) => s + c.estimatedValueZar, 0)
        .toFixed(2)
    );
    const livestockValueZar = Number(
      livestock
        .filter((g) => canSeeFinancial(g.farmId))
        .reduce((s, g) => s + g.quantity * g.estimatedUnitValueZar, 0)
        .toFixed(2)
    );
    const combinedExpensesZar = Number(
      entries
        .filter((e) => canSeeFinancial(e.farmId))
        .reduce((s, e) => s + e.expenseZar, 0)
        .toFixed(2)
    );
    const totalWaterManagedLiters = Number(
      entries.reduce((s, e) => s + e.waterLiters, 0).toFixed(0)
    );
    const totalFeedProducedKg = Number(
      entries
        .filter((e) => e.entryCategory === 'feed_production')
        .reduce((s, e) => s + e.productionQuantity, 0)
        .toFixed(2)
    );

    res.json({
      totalFarmAreaHa,
      cropCultivatedHa,
      grazingFieldsHa,
      cropValueZar,
      livestockValueZar,
      combinedAssetAndHarvestValueZar: Number((cropValueZar + livestockValueZar).toFixed(2)),
      combinedExpensesZar,
      totalWaterManagedLiters,
      totalFeedProducedKg,
      totalCrops: crops.length,
      totalLivestockHead: livestock.reduce((s, g) => s + g.quantity, 0),
    });
  });

  app.get('/api/mixed-farming', requireAuth, (req: AuthRequest, res) => {
    const user = req.authUser!;
    const accessibleFarmIds = getAccessibleFarmIds(user, 'overview');
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    if (farmFilter && !accessibleFarmIds.includes(farmFilter)) {
      res.status(403).json({ error: 'Access denied for this farm.' });
      return;
    }
    const canSeeFinancial = (farmId: string) =>
      user.roleCode !== 'agricultural_expert' ||
      Boolean(getActiveFarmGrantForExpert(user.id, farmId)?.scopes.financialSummary);
    const entries = store.db.mixedFarmingEntries
      .filter(
        (e) => accessibleFarmIds.includes(e.farmId) && (!farmFilter || e.farmId === farmFilter)
      )
      .map((e) => {
        const farm = store.db.farms.find((f) => f.id === e.farmId);
        return {
          ...e,
          expenseZar: canSeeFinancial(e.farmId) ? e.expenseZar : 0,
          farmName: farm?.name || 'Farm',
        };
      });
    res.json(entries);
  });

  app.post('/api/mixed-farming', requireAuth, (req: AuthRequest, res) => {
    const {
      farmId,
      entryCategory,
      title,
      entryDate,
      relatedCropId,
      relatedLivestockId,
      expenseZar,
      productionQuantity,
      productionUnit,
      waterLiters,
      notes,
    } = req.body || {};

    const validCats: MixedEntryCategory[] = [
      'feed_production',
      'shared_land',
      'water_management',
      'combined_expense',
      'combined_production',
    ];
    if (!farmId || !validCats.includes(entryCategory) || !title) {
      res.status(400).json({ error: 'Farm, category, and title are required.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, String(farmId))) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const now = new Date().toISOString();
    const entry = {
      id: `mix-${crypto.randomUUID()}`,
      farmId: String(farmId),
      ownerId: req.authUser!.id,
      entryCategory: entryCategory as MixedEntryCategory,
      title: String(title).trim(),
      entryDate: String(entryDate || now.slice(0, 10)),
      relatedCropId: relatedCropId ? String(relatedCropId) : null,
      relatedLivestockId: relatedLivestockId ? String(relatedLivestockId) : null,
      expenseZar: Math.max(0, Number(expenseZar) || 0),
      productionQuantity: Math.max(0, Number(productionQuantity) || 0),
      productionUnit: String(productionUnit || ''),
      waterLiters: Math.max(0, Number(waterLiters) || 0),
      notes: String(notes || '').trim(),
      createdAt: now,
    };

    store.db.mixedFarmingEntries.unshift(entry);
    store.logAudit(
      req.authUser!.id,
      'MIXED_FARMING_LOGGED',
      'MixedFarmingEntry',
      entry.id,
      { farmId: entry.farmId, entryCategory },
      req.ip || '127.0.0.1'
    );
    res.status(201).json(entry);
  });

  app.delete('/api/mixed-farming/:id', requireAuth, (req: AuthRequest, res) => {
    const entry = store.db.mixedFarmingEntries.find((e) => e.id === req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, entry.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    store.db.mixedFarmingEntries = store.db.mixedFarmingEntries.filter((e) => e.id !== entry.id);
    store.save();
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // Central Notification & Communication System
  // ------------------------------------------------------------------
  app.get('/api/notifications', requireAuth, (req: AuthRequest, res) => {
    const categoryFilter = req.query.category ? String(req.query.category) : '';
    const unreadOnly = req.query.unreadOnly === 'true';
    const items = store.db.notifications
      .filter((n) => n.userId === req.authUser!.id)
      .filter((n) => (!categoryFilter || categoryFilter === 'all' ? true : n.category === categoryFilter))
      .filter((n) => (unreadOnly ? !n.isRead : true));
    res.json(items);
  });

  app.get('/api/notifications/feed', requireAuth, (req: AuthRequest, res) => {
    const userId = req.authUser!.id;
    const notifications = store.db.notifications.filter((n) => n.userId === userId);
    res.json({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    });
  });

  app.get('/api/notifications/preferences', requireAuth, (req: AuthRequest, res) => {
    res.json({
      preferences: getOrCreateUserNotificationPreference(req.authUser!.id),
      categoriesMeta: NOTIFICATION_CATEGORY_META,
    });
  });

  app.put('/api/notifications/preferences', requireAuth, (req: AuthRequest, res) => {
    const updated = updateUserNotificationPreference(req.authUser!.id, req.body || {});
    store.logAudit(
      req.authUser!.id,
      'NOTIFICATION_PREFERENCES_UPDATED',
      'NotificationPreference',
      req.authUser!.id,
      { channels: updated.channels, categories: updated.categories },
      req.ip || '127.0.0.1'
    );
    res.json({
      preferences: updated,
      categoriesMeta: NOTIFICATION_CATEGORY_META,
    });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthRequest, res) => {
    let count = 0;
    for (const n of store.db.notifications) {
      if (n.userId === req.authUser!.id && !n.isRead) {
        n.isRead = true;
        count++;
      }
    }
    if (count > 0) store.save();
    res.json({ ok: true, markedCount: count });
  });

  app.post('/api/notifications/generate-reminders', requireAuth, (req: AuthRequest, res) => {
    const accessibleFarmIds = getAccessibleFarmIds(req.authUser!);
    const summary = generateDueRemindersForUser(req.authUser!.id, accessibleFarmIds);
    res.json({ ok: true, ...summary });
  });

  app.post('/api/notifications/dispatch-test', requireAuth, (req: AuthRequest, res) => {
    const { category, title, message, isMandatorySecurity } = req.body || {};
    const cat: NotificationCategory = category || 'upcoming_activity';
    const result = dispatchNotification({
      userId: req.authUser!.id,
      category: cat,
      title: String(title || 'Field Shift Notification Check'),
      message: String(message || 'Preference and multi-channel delivery check completed.'),
      isMandatorySecurity: Boolean(isMandatorySecurity),
      actionUrl: 'notifications',
      prefixWithLanguageTag: true,
    });
    res.json(result);
  });

  app.post('/api/notifications/:id/read', requireAuth, (req: AuthRequest, res) => {
    const item = store.db.notifications.find(
      (n) => n.id === req.params.id && n.userId === req.authUser!.id
    );
    if (!item) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    item.isRead = true;
    store.save();
    res.json(item);
  });

  // ------------------------------------------------------------------
  // Soil & Land Intelligence (ARC / DALRRD / SoilGrids / Farmer Lab Reports)
  // ------------------------------------------------------------------
  app.get('/api/soil-land/farms/:farmId', requireAuth, async (req: AuthRequest, res) => {
    const { farmId } = req.params;
    if (!userCanAccessFarm(req.authUser!, farmId, 'soil')) {
      res.status(403).json({ error: 'You do not have soil access to this farm.' });
      return;
    }
    try {
      const selectedFarmingType = req.query.farmingType ? String(req.query.farmingType) : undefined;
      const fieldId = req.query.fieldId ? String(req.query.fieldId) : undefined;
      const payload = await getFarmSoilAndLandIntelligence(farmId, selectedFarmingType, fieldId);
      res.json(payload);
    } catch (err: unknown) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Unable to load soil intelligence.' });
    }
  });

  app.get('/api/soil-land/site', requireAuth, async (req: AuthRequest, res) => {
    try {
      const province = String(req.query.province || req.authUser!.profile?.province || 'Free State');
      const district = req.query.district ? String(req.query.district) : undefined;
      const townOrArea = req.query.townOrArea ? String(req.query.townOrArea) : undefined;
      const siteName = req.query.siteName ? String(req.query.siteName) : undefined;
      const waterAvailability = req.query.waterAvailability
        ? String(req.query.waterAvailability)
        : undefined;
      const selectedFarmingType = req.query.farmingType
        ? String(req.query.farmingType)
        : undefined;
      const latRaw = req.query.latitude !== undefined ? Number(req.query.latitude) : undefined;
      const lngRaw = req.query.longitude !== undefined ? Number(req.query.longitude) : undefined;
      const haRaw =
        req.query.farmSizeHectares !== undefined ? Number(req.query.farmSizeHectares) : undefined;

      const payload = await getSiteSoilAndLandIntelligence({
        province,
        district,
        townOrArea,
        siteName,
        waterAvailability,
        selectedFarmingType,
        latitude: Number.isFinite(latRaw) ? latRaw : undefined,
        longitude: Number.isFinite(lngRaw) ? lngRaw : undefined,
        farmSizeHectares: Number.isFinite(haRaw) ? haRaw : undefined,
      });
      res.json(payload);
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to load candidate site soil intelligence.',
      });
    }
  });

  app.get('/api/crops/rotation-catalog', requireAuth, (_req: AuthRequest, res) => {
    res.json(
      SOUTH_AFRICA_ROTATION_CATALOG.map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        botanicalFamily: c.botanicalFamily,
        familyGroupLabel: c.familyGroupLabel,
        preferredSeason: c.preferredSeason,
        waterNeed: c.waterNeed,
        waterRequirementMmRange: c.waterRequirementMmRange,
        idealPhRange: c.idealPhRange,
        typicalCycleDays: c.typicalCycleDays,
        nitrogenRole: c.nitrogenRole,
        residueContribution: c.residueContribution,
        temperatureSensitivity: c.temperatureSensitivity,
        soilPreferences: c.soilPreferences,
        growthCharacteristics: c.growthCharacteristics,
        nitrogenCharacteristics: c.nitrogenCharacteristics,
        rotationConsiderations: c.rotationConsiderations,
        diseaseAndPestConsiderations: c.diseaseAndPestConsiderations,
        agronomicReference: c.agronomicReference,
        summary: c.summary,
      }))
    );
  });

  app.get('/api/crops/rotation-priorities', requireAuth, (_req: AuthRequest, res) => {
    res.json(FARMER_PRIORITY_OPTIONS);
  });

  app.post('/api/crops/rotation-analysis', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        farmId,
        fieldId,
        province,
        waterAvailability,
        soilType,
        soilTexture,
        organicMatterLevel,
        soilDrainage,
        waterHoldingCharacteristic,
        soilPh,
        farmSizeHectares,
        previousSeasonCrop,
        twoSeasonsAgoCrop,
        farmerPriority,
        farmerPriorities,
        selectedCrops,
      } = req.body || {};

      if (farmId && !userCanAccessFarm(req.authUser!, String(farmId), 'soil')) {
        res.status(403).json({ error: 'You do not have soil access to this farm.' });
        return;
      }

      const payload = await analyzeCropRotationScenario({
        farmId: farmId ? String(farmId) : null,
        fieldId: fieldId ? String(fieldId) : null,
        province: province ? String(province) : undefined,
        waterAvailability: waterAvailability ? String(waterAvailability) : undefined,
        soilType: soilType ? String(soilType) : undefined,
        soilTexture: soilTexture ? String(soilTexture) : undefined,
        organicMatterLevel: organicMatterLevel ? String(organicMatterLevel) : undefined,
        soilDrainage: soilDrainage ? String(soilDrainage) : undefined,
        waterHoldingCharacteristic: waterHoldingCharacteristic
          ? String(waterHoldingCharacteristic)
          : undefined,
        soilPh:
          soilPh !== undefined && soilPh !== null && soilPh !== '' ? Number(soilPh) : undefined,
        farmSizeHectares:
          farmSizeHectares !== undefined && farmSizeHectares !== null
            ? Number(farmSizeHectares)
            : undefined,
        previousSeasonCrop: previousSeasonCrop ? String(previousSeasonCrop) : undefined,
        twoSeasonsAgoCrop: twoSeasonsAgoCrop ? String(twoSeasonsAgoCrop) : undefined,
        farmerPriority: farmerPriority ? String(farmerPriority) : undefined,
        farmerPriorities: Array.isArray(farmerPriorities)
          ? farmerPriorities.slice(0, 3).map((v) => String(v))
          : undefined,
        selectedCrops: Array.isArray(selectedCrops)
          ? selectedCrops.slice(0, 6).map((v) => String(v))
          : undefined,
      });
      res.json(payload);
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to compute crop rotation scenario analysis.',
      });
    }
  });

  app.post('/api/crops/rotation-simulate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        farmId,
        fieldId,
        province,
        waterAvailability,
        soilType,
        soilTexture,
        organicMatterLevel,
        soilDrainage,
        waterHoldingCharacteristic,
        soilPh,
        farmSizeHectares,
        previousSeasonCrop,
        twoSeasonsAgoCrop,
        farmerPriorities,
        season1CropId,
        season2CropId,
        season3CropId,
        strategyName,
      } = req.body || {};

      if (farmId && !userCanAccessFarm(req.authUser!, String(farmId), 'soil')) {
        res.status(403).json({ error: 'You do not have soil access to this farm.' });
        return;
      }

      const payload = await simulateRotationSequence({
        farmId: farmId ? String(farmId) : null,
        fieldId: fieldId ? String(fieldId) : null,
        province: province ? String(province) : undefined,
        waterAvailability: waterAvailability ? String(waterAvailability) : undefined,
        soilType: soilType ? String(soilType) : undefined,
        soilTexture: soilTexture ? String(soilTexture) : undefined,
        organicMatterLevel: organicMatterLevel ? String(organicMatterLevel) : undefined,
        soilDrainage: soilDrainage ? String(soilDrainage) : undefined,
        waterHoldingCharacteristic: waterHoldingCharacteristic
          ? String(waterHoldingCharacteristic)
          : undefined,
        soilPh:
          soilPh !== undefined && soilPh !== null && soilPh !== '' ? Number(soilPh) : undefined,
        farmSizeHectares:
          farmSizeHectares !== undefined && farmSizeHectares !== null
            ? Number(farmSizeHectares)
            : undefined,
        previousSeasonCrop: previousSeasonCrop ? String(previousSeasonCrop) : undefined,
        twoSeasonsAgoCrop: twoSeasonsAgoCrop ? String(twoSeasonsAgoCrop) : undefined,
        farmerPriorities: Array.isArray(farmerPriorities)
          ? farmerPriorities.slice(0, 3).map((v) => String(v))
          : undefined,
        season1CropId: String(season1CropId || 'maize'),
        season2CropId: String(season2CropId || 'soybeans'),
        season3CropId: String(season3CropId || 'sunflower'),
        strategyName: strategyName ? String(strategyName) : undefined,
      });
      res.json(payload);
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to simulate 3-season rotation sequence.',
      });
    }
  });

  app.get('/api/crops/rotation-plans', requireAuth, (req: AuthRequest, res) => {
    const farmIdFilter = req.query.farmId ? String(req.query.farmId) : null;
    const fieldIdFilter = req.query.fieldId ? String(req.query.fieldId) : null;
    const accessibleIds = new Set(getAccessibleFarmIds(req.authUser!, 'soil'));
    const allPlans = store.db.savedRotationPlans || [];

    const visible = allPlans.filter((plan) => {
      if (farmIdFilter && plan.farmId !== farmIdFilter) return false;
      if (fieldIdFilter && plan.fieldId !== fieldIdFilter) return false;
      if (plan.userId === req.authUser!.id) return true;
      return accessibleIds.has(plan.farmId);
    });

    res.json(
      [...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  });

  app.post('/api/crops/rotation-plans', requireAuth, (req: AuthRequest, res) => {
    const {
      farmId,
      fieldId,
      planName,
      planSource,
      selectedPriorities,
      seasons,
      decisionSupportScore,
      summary,
      warnings,
      tradeOffs,
      missingInformation,
      environmentalSnapshotLabel,
      soilSnapshotLabel,
    } = req.body || {};

    if (!farmId || !planName || !Array.isArray(seasons) || seasons.length !== 3) {
      res.status(400).json({
        error: 'Farm ID, plan name, and a 3-season rotation sequence are required to save a plan.',
      });
      return;
    }

    const farm = store.db.farms.find((f) => f.id === String(farmId));
    if (!farm) {
      res.status(404).json({ error: 'Selected farm not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, farm.id)) {
      res.status(403).json({ error: 'Only the farm owner can save rotation plans for this farm.' });
      return;
    }

    const field = fieldId
      ? store.db.fields.find((fl) => fl.id === String(fieldId) && fl.farmId === farm.id)
      : null;

    if (!Array.isArray(store.db.savedRotationPlans)) {
      store.db.savedRotationPlans = [];
    }

    const now = new Date().toISOString();
    const record: SavedRotationPlan = {
      id: `rplan-${crypto.randomUUID()}`,
      userId: req.authUser!.id,
      farmId: farm.id,
      farmName: farm.name,
      fieldId: field ? field.id : null,
      fieldName: field ? field.name : null,
      planName: String(planName).trim(),
      planSource:
        planSource === 'custom_simulation' ? 'custom_simulation' : 'recommended_strategy',
      planStatus: 'proposed_plan',
      selectedPriorities: Array.isArray(selectedPriorities)
        ? selectedPriorities.slice(0, 3).map((v) => String(v))
        : [],
      seasons: seasons.map((s: Record<string, unknown>, idx: number) => ({
        seasonNumber: Number(s.seasonNumber || idx + 1),
        seasonLabel: String(s.seasonLabel || `Season ${idx + 1}`),
        plantingWindow: String(s.plantingWindow || 'Seasonal Window'),
        cropId: String(s.cropId || ''),
        cropName: String(s.cropName || 'Crop'),
        botanicalFamily: String(s.botanicalFamily || ''),
        nitrogenRole: String(s.nitrogenRole || ''),
      })),
      decisionSupportScore: Number(decisionSupportScore || 0),
      summary: String(summary || '').trim(),
      warnings: Array.isArray(warnings) ? warnings.map((w) => String(w)) : [],
      tradeOffs: Array.isArray(tradeOffs) ? tradeOffs.map((t) => String(t)) : [],
      missingInformation: Array.isArray(missingInformation)
        ? missingInformation.map((m) => String(m))
        : [],
      environmentalSnapshotLabel: String(environmentalSnapshotLabel || 'NASA POWER Regional Snapshot'),
      soilSnapshotLabel: String(soilSnapshotLabel || 'Field & Soil Profile Snapshot'),
      disclaimer:
        'Saved as a proposed decision-support rotation plan only. Saving this plan does NOT create planted crop activities or guarantee yields.',
      createdAt: now,
      updatedAt: now,
    };

    store.db.savedRotationPlans.unshift(record);
    store.logAudit(
      req.authUser!.id,
      'ROTATION_PLAN_SAVED',
      'SavedRotationPlan',
      record.id,
      { farmId: farm.id, fieldId: record.fieldId, planName: record.planName },
      req.ip || '127.0.0.1'
    );

    res.status(201).json(record);
  });

  app.delete('/api/crops/rotation-plans/:planId', requireAuth, (req: AuthRequest, res) => {
    const allPlans = store.db.savedRotationPlans || [];
    const target = allPlans.find((p) => p.id === req.params.planId);
    if (!target) {
      res.status(404).json({ error: 'Saved rotation plan not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, target.farmId) && target.userId !== req.authUser!.id) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    store.db.savedRotationPlans = allPlans.filter((p) => p.id !== target.id);
    store.logAudit(
      req.authUser!.id,
      'ROTATION_PLAN_DELETED',
      'SavedRotationPlan',
      target.id,
      { farmId: target.farmId, planName: target.planName },
      req.ip || '127.0.0.1'
    );
    res.json({ ok: true });
  });

  app.post('/api/soil-land/farms/:farmId/reports', requireAuth, (req: AuthRequest, res) => {
    const { farmId } = req.params;
    if (!userCanModifyFarm(req.authUser!, farmId)) {
      res.status(403).json({ error: 'Only the farm owner can upload laboratory soil reports.' });
      return;
    }

    const {
      fieldId,
      laboratoryName,
      sampleCode,
      sampleDate,
      sampleDepthCm,
      soilPhWater,
      soilPhKcl,
      soilTextureClass,
      clayPercent,
      siltPercent,
      sandPercent,
      organicMatterPercent,
      nitrogenMgKg,
      phosphorusMgKg,
      potassiumMgKg,
      calciumMgKg,
      magnesiumMgKg,
      cecCmolKg,
      fertilityRating,
      drainageClass,
      waterHoldingCapacityMmPerM,
      attachmentFileName,
      attachmentSummary,
      notes,
    } = req.body || {};

    if (!laboratoryName || !sampleDate || !soilTextureClass) {
      res.status(400).json({
        error: 'Laboratory name, sample date, and soil texture class are required.',
      });
      return;
    }

    const parseOptNum = (v: unknown): number | null => {
      if (v === '' || v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const now = new Date().toISOString();
    const report = {
      id: `soilrep-${crypto.randomUUID()}`,
      farmId,
      fieldId: fieldId ? String(fieldId) : null,
      ownerId: req.authUser!.id,
      laboratoryName: String(laboratoryName).trim(),
      sampleCode: String(sampleCode || `LAB-${now.slice(0, 10)}`).trim(),
      sampleDate: String(sampleDate),
      sampleDepthCm: String(sampleDepthCm || '0-20 cm').trim(),
      soilPhWater: parseOptNum(soilPhWater),
      soilPhKcl: parseOptNum(soilPhKcl),
      soilTextureClass: String(soilTextureClass).trim(),
      clayPercent: parseOptNum(clayPercent),
      siltPercent: parseOptNum(siltPercent),
      sandPercent: parseOptNum(sandPercent),
      organicMatterPercent: parseOptNum(organicMatterPercent),
      nitrogenMgKg: parseOptNum(nitrogenMgKg),
      phosphorusMgKg: parseOptNum(phosphorusMgKg),
      potassiumMgKg: parseOptNum(potassiumMgKg),
      calciumMgKg: parseOptNum(calciumMgKg),
      magnesiumMgKg: parseOptNum(magnesiumMgKg),
      cecCmolKg: parseOptNum(cecCmolKg),
      fertilityRating: (['Low', 'Moderate', 'High', 'Very High'].includes(fertilityRating)
        ? fertilityRating
        : 'Moderate') as 'Low' | 'Moderate' | 'High' | 'Very High',
      drainageClass: ([
        'Well Drained',
        'Moderately Well Drained',
        'Imperfectly Drained',
        'Poorly Drained',
      ].includes(drainageClass)
        ? drainageClass
        : 'Well Drained') as
        | 'Well Drained'
        | 'Moderately Well Drained'
        | 'Imperfectly Drained'
        | 'Poorly Drained',
      waterHoldingCapacityMmPerM: parseOptNum(waterHoldingCapacityMmPerM),
      attachmentFileName: attachmentFileName ? String(attachmentFileName).slice(0, 200) : null,
      attachmentSummary: String(attachmentSummary || '').trim(),
      notes: String(notes || '').trim(),
      createdAt: now,
    };

    store.db.soilReports.unshift(report);
    store.logAudit(
      req.authUser!.id,
      'SOIL_REPORT_UPLOADED',
      'SoilReport',
      report.id,
      { farmId, laboratoryName: report.laboratoryName, sampleCode: report.sampleCode },
      req.ip || '127.0.0.1'
    );

    res.status(201).json(report);
  });

  app.delete('/api/soil-land/reports/:reportId', requireAuth, (req: AuthRequest, res) => {
    const report = store.db.soilReports.find((r) => r.id === req.params.reportId);
    if (!report) {
      res.status(404).json({ error: 'Soil report not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, report.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    store.db.soilReports = store.db.soilReports.filter((r) => r.id !== report.id);
    store.save();
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // Location-Specific Agricultural Weather Intelligence & Feedback Loop
  // ------------------------------------------------------------------
  app.get('/api/weather/farms/:farmId', requireAuth, async (req: AuthRequest, res) => {
    const { farmId } = req.params;
    if (!userCanAccessFarm(req.authUser!, farmId, 'weather')) {
      res.status(403).json({ error: 'You do not have weather access to this farm.' });
      return;
    }
    try {
      const payload = await getFarmWeatherIntelligence(farmId);
      if (payload.serviceAvailable && (payload.daily.length > 0 || payload.historicalRainfall.historicalDays.length > 0)) {
        recordForecastSnapshots({
          farmId,
          sourceName: payload.source,
          daily: payload.daily,
          historicalDays: payload.historicalRainfall.historicalDays,
        });
      }
      res.json(payload);
    } catch (err: unknown) {
      res.status(404).json({
        error: err instanceof Error ? err.message : 'Unable to retrieve weather telemetry.',
      });
    }
  });

  app.get('/api/weather/site', requireAuth, async (req: AuthRequest, res) => {
    try {
      const province = String(req.query.province || req.authUser!.profile?.province || 'Free State');
      const district = req.query.district ? String(req.query.district) : undefined;
      const townOrArea = req.query.townOrArea ? String(req.query.townOrArea) : undefined;
      const siteName = req.query.siteName ? String(req.query.siteName) : undefined;
      const waterAvailability = req.query.waterAvailability
        ? String(req.query.waterAvailability)
        : undefined;
      const latRaw = req.query.latitude !== undefined ? Number(req.query.latitude) : undefined;
      const lngRaw = req.query.longitude !== undefined ? Number(req.query.longitude) : undefined;

      const payload = await getSiteWeatherIntelligence({
        province,
        district,
        townOrArea,
        siteName,
        waterAvailability,
        latitude: Number.isFinite(latRaw) ? latRaw : undefined,
        longitude: Number.isFinite(lngRaw) ? lngRaw : undefined,
      });
      res.json(payload);
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to retrieve candidate site weather telemetry.',
      });
    }
  });

  app.get('/api/nasa/registry', requireAuth, (_req: AuthRequest, res) => {
    res.json(getNasaRegistrySummary());
  });

  app.get('/api/nasa/retrievals', requireAuth, (_req: AuthRequest, res) => {
    const items = (store.db.nasaRetrievals || []).slice(0, 25).map((r) => ({
      id: r.id,
      requestId: r.requestId || null,
      coordinatesLabel: r.coordinatesLabel,
      temporalResolution: r.temporalResolution,
      dateWindowLabel: r.dateWindowLabel,
      parametersRequested: r.parametersRequested,
      httpStatus: r.httpStatus,
      cacheHit: r.cacheHit,
      validObservationCount: r.validObservationCount,
      fillValueCount: r.fillValueCount,
      errorMessage: r.errorMessage,
      retrievedAt: r.retrievedAt,
    }));
    res.json({ retrievals: items });
  });

  app.get('/api/weather/farms/:farmId/feedback', requireAuth, (req: AuthRequest, res) => {
    const { farmId } = req.params;
    if (!userCanAccessFarm(req.authUser!, farmId, 'weather')) {
      res.status(403).json({ error: 'You do not have weather access to this farm.' });
      return;
    }
    try {
      res.json(buildWeatherFeedbackOverview(farmId));
    } catch (err: unknown) {
      res.status(404).json({
        error: err instanceof Error ? err.message : 'Unable to load local weather feedback.',
      });
    }
  });

  app.post('/api/weather/farms/:farmId/observations', requireAuth, (req: AuthRequest, res) => {
    const { farmId } = req.params;
    if (!userCanModifyFarm(req.authUser!, farmId)) {
      res.status(403).json({ error: 'Only the registered farm owner can submit farm weather observations.' });
      return;
    }

    const {
      observationDate,
      rainfallOccurred,
      rainfallIntensity,
      measuredRainfallMm,
      temperatureC,
      windObservation,
      windSpeedEstimateKmh,
      notes,
    } = req.body || {};

    if (!observationDate || typeof observationDate !== 'string') {
      res.status(400).json({ error: 'Observation date is required.' });
      return;
    }

    const validIntensities: RainfallIntensity[] = ['none', 'light', 'moderate', 'heavy', 'extreme'];
    const validWinds: WindObservationLevel[] = [
      'calm',
      'light_breeze',
      'moderate_wind',
      'strong_wind',
      'gale',
    ];

    const resolvedIntensity: RainfallIntensity = validIntensities.includes(rainfallIntensity)
      ? rainfallIntensity
      : rainfallOccurred
      ? 'moderate'
      : 'none';

    const resolvedWind: WindObservationLevel = validWinds.includes(windObservation)
      ? windObservation
      : 'light_breeze';

    const parseOptNum = (v: unknown): number | null => {
      if (v === '' || v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    try {
      const created = submitFarmerWeatherObservation({
        user: req.authUser!,
        farmId,
        observationDate: observationDate.slice(0, 10),
        rainfallOccurred: Boolean(rainfallOccurred),
        rainfallIntensity: resolvedIntensity,
        measuredRainfallMm: parseOptNum(measuredRainfallMm),
        temperatureC: parseOptNum(temperatureC),
        windObservation: resolvedWind,
        windSpeedEstimateKmh: parseOptNum(windSpeedEstimateKmh),
        notes: String(notes || ''),
      });
      if (resolvedIntensity === 'heavy' || resolvedIntensity === 'extreme') {
        const farm = store.db.farms.find((f) => f.id === farmId);
        dispatchNotification({
          userId: req.authUser!.id,
          category: 'weather_warning',
          title: `Heavy/Extreme Weather Reported at ${farm?.name || 'Farm'}`,
          message: `You recorded ${resolvedIntensity} rainfall (${created.measuredRainfallMm ?? 'observed'} mm). Inspect field drainage and log damage if needed.`,
          priority: 'high',
          actionUrl: 'weather',
          relatedEntityType: 'FarmerWeatherObservation',
          relatedEntityId: created.id,
          prefixWithLanguageTag: true,
        });
      }
      res.status(201).json({ observation: created, overview: buildWeatherFeedbackOverview(farmId) });
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to save weather observation.',
      });
    }
  });

  app.post('/api/weather/farms/:farmId/feedback-summary', requireAuth, async (req: AuthRequest, res) => {
    const { farmId } = req.params;
    if (!userCanAccessFarm(req.authUser!, farmId, 'weather')) {
      res.status(403).json({ error: 'You do not have weather access to this farm.' });
      return;
    }
    const targetLang: LanguageCode =
      req.body?.languageCode && store.db.languages.some((l) => l.code === req.body.languageCode)
        ? req.body.languageCode
        : req.authUser!.preferredLanguageCode;

    try {
      const summary = await generateAiLocalWeatherSummary({ farmId, languageCode: targetLang });
      recordAiInsight({
        userId: req.authUser!.id,
        farmId,
        category: 'weather_summary',
        title: 'Local Weather & Forecast Comparison Summary',
        summary: summary.narrative,
        recommendations: summary.caveats,
        languageCode: targetLang,
        poweredBy: summary.poweredBy,
      });
      res.json(summary);
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to generate local weather summary.',
      });
    }
  });

  app.patch(
    '/api/weather/observations/:id/qc',
    requireAuth,
    requireRoles('agricultural_expert', 'system_administrator'),
    (req: AuthRequest, res) => {
      const obs = store.db.weatherObservations.find((o) => o.id === req.params.id);
      if (!obs) {
        res.status(404).json({ error: 'Observation not found.' });
        return;
      }
      if (!userCanAccessFarm(req.authUser!, obs.farmId, 'weather')) {
        res.status(403).json({ error: 'You are not authorised to review weather observations for this farm.' });
        return;
      }
      const { qcStatus, qcNotes } = req.body || {};
      if (!['pending_qc', 'qc_passed_reference', 'qc_flagged_outlier'].includes(qcStatus)) {
        res.status(400).json({ error: 'Invalid QC status.' });
        return;
      }
      obs.qcStatus = qcStatus;
      obs.qcNotes = String(
        qcNotes ||
          (qcStatus === 'qc_passed_reference'
            ? 'Reviewed for quality-controlled calibration reference only. Still distinct from verified weather-station telemetry.'
            : 'Flagged by agricultural reviewer.')
      );
      obs.updatedAt = new Date().toISOString();
      store.logAudit(
        req.authUser!.id,
        'WEATHER_OBSERVATION_QC_REVIEWED',
        'FarmerWeatherObservation',
        obs.id,
        { farmId: obs.farmId, qcStatus },
        req.ip || '127.0.0.1'
      );
      store.save();
      res.json(obs);
    }
  );

  // ------------------------------------------------------------------
  // Gemini AI Agricultural Intelligence Endpoints (Server-Side Only)
  // ------------------------------------------------------------------
  app.post('/api/ai/advise', requireAuth, async (req: AuthRequest, res) => {
    const { question, farmId, languageCode, conversationHistory } = req.body || {};
    if (!question || typeof question !== 'string' || question.trim().length < 3) {
      res.status(400).json({ error: 'Please enter a clear farming question.' });
      return;
    }

    if (farmId && !userCanAccessFarm(req.authUser!, String(farmId))) {
      res.status(403).json({ error: 'You do not have access to the selected farm.' });
      return;
    }

    const user = req.authUser!;
    const targetLang: LanguageCode =
      languageCode && store.db.languages.some((l) => l.code === languageCode)
        ? languageCode
        : user.preferredLanguageCode;

    try {
      const result = await generateAgriculturalAdvice({
        question: question.trim(),
        languageCode: targetLang,
        user,
        farmId: farmId ? String(farmId) : null,
        conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
      });

      recordAiInsight({
        userId: user.id,
        farmId: farmId ? String(farmId) : null,
        category: 'advisory',
        title: question.trim().slice(0, 90),
        summary: result.answer,
        recommendations: result.suggestedActions || [],
        languageCode: targetLang,
        poweredBy: result.poweredBy,
      });

      store.logAudit(
        user.id,
        'AI_ADVISORY_QUERY',
        'GeminiAdvisor',
        farmId || null,
        { languageCode: targetLang, poweredBy: result.poweredBy },
        req.ip || '127.0.0.1'
      );

      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI advisory failed.';
      const status = msg.includes('timed out')
        ? 504
        : msg.includes('quota')
        ? 429
        : msg.includes('permission denied')
        ? 403
        : 500;
      res.status(status).json({ error: msg });
    }
  });

  app.post('/api/ai/analytics', requireAuth, async (req: AuthRequest, res) => {
    const { farmId, languageCode } = req.body || {};
    if (farmId && !userCanAccessFarm(req.authUser!, String(farmId))) {
      res.status(403).json({ error: 'You do not have access to the selected farm.' });
      return;
    }

    const user = req.authUser!;
    const targetLang: LanguageCode =
      languageCode && store.db.languages.some((l) => l.code === languageCode)
        ? languageCode
        : user.preferredLanguageCode;

    try {
      const report = await generateFarmAiAnalytics({
        user,
        farmId: farmId ? String(farmId) : null,
        languageCode: targetLang,
      });

      recordAiInsight({
        userId: user.id,
        farmId: farmId ? String(farmId) : null,
        category: 'analytics',
        title: `Farm Analytics: ${report.farmName}`,
        summary: report.farmPerformanceSummary,
        recommendations: report.suggestedNextActions || [],
        languageCode: targetLang,
        poweredBy: report.poweredBy,
      });

      store.logAudit(
        user.id,
        'AI_ANALYTICS_GENERATED',
        'GeminiAnalytics',
        farmId || null,
        { languageCode: targetLang, poweredBy: report.poweredBy },
        req.ip || '127.0.0.1'
      );

      res.json(report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI analytics generation failed.';
      const status = msg.includes('timed out')
        ? 504
        : msg.includes('quota')
        ? 429
        : msg.includes('permission denied')
        ? 403
        : 500;
      res.status(status).json({ error: msg });
    }
  });

  // ------------------------------------------------------------------
  // System Administration Endpoints
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/users',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const query = String(req.query.q || '').trim().toLowerCase();
      const roleFilter = String(req.query.role || '').trim();
      const statusFilter = String(req.query.status || '').trim();

      let list = store.db.users.map(sanitizeUser);
      if (query) {
        list = list.filter(
          (u) =>
            u.email.toLowerCase().includes(query) ||
            (u.profile?.fullName || '').toLowerCase().includes(query) ||
            (u.profile?.province || '').toLowerCase().includes(query)
        );
      }
      if (roleFilter) {
        list = list.filter((u) => u.roleCode === roleFilter);
      }
      if (statusFilter === 'active') {
        list = list.filter((u) => u.isActive);
      } else if (statusFilter === 'inactive') {
        list = list.filter((u) => !u.isActive);
      }

      res.json(list);
    }
  );

  app.get(
    '/api/admin/stats',
    requireAuth,
    requireRoles('system_administrator'),
    (_req: AuthRequest, res) => {
      const users = store.db.users;
      const byRole = store.db.roles.map((r) => ({
        roleCode: r.code,
        roleName: r.name,
        count: users.filter((u) => u.roleId === r.id).length,
      }));
      const totalHectares = store.db.farms.reduce((sum, f) => sum + f.farmSizeHectares, 0);

      res.json({
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.isActive).length,
        inactiveUsers: users.filter((u) => !u.isActive).length,
        verifiedUsers: users.filter((u) => u.isEmailVerified).length,
        totalFarms: store.db.farms.length,
        totalFields: store.db.fields.length,
        totalHectares: Number(totalHectares.toFixed(2)),
        totalCrops: store.db.crops.length,
        totalLivestockHead: store.db.livestockGroups.reduce((s, g) => s + g.quantity, 0),
        byRole,
      });
    }
  );

  app.patch(
    '/api/admin/users/:id/status',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const target = store.db.users.find((u) => u.id === req.params.id);
      if (!target) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      if (target.id === req.authUser!.id) {
        res.status(400).json({ error: 'You cannot deactivate your own administrator account.' });
        return;
      }

      const { isActive } = req.body || {};
      if (typeof isActive !== 'boolean') {
        res.status(400).json({ error: 'isActive boolean is required.' });
        return;
      }

      target.isActive = isActive;
      target.updatedAt = new Date().toISOString();
      if (!isActive) {
        store.db.sessions = store.db.sessions.filter((s) => s.userId !== target.id);
      }

      store.logAudit(
        req.authUser!.id,
        isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        'User',
        target.id,
        { targetEmail: target.email },
        req.ip || '127.0.0.1'
      );

      res.json({ user: sanitizeUser(target) });
    }
  );

  app.patch(
    '/api/admin/users/:id/role',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const target = store.db.users.find((u) => u.id === req.params.id);
      if (!target) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const { roleCode } = req.body || {};
      const role = store.db.roles.find((r) => r.code === roleCode);
      if (!role) {
        res.status(400).json({ error: 'Invalid role code.' });
        return;
      }

      target.roleId = role.id;
      target.updatedAt = new Date().toISOString();
      store.db.userPermissions = store.db.userPermissions.filter((p) => p.userId !== target.id);
      const perms = ROLE_PERMISSION_MAP[role.code] || [];
      perms.forEach((key) => {
        store.db.userPermissions.push({
          id: `perm-${crypto.randomUUID()}`,
          roleId: role.id,
          userId: target.id,
          permissionKey: key,
          isAllowed: true,
          createdAt: new Date().toISOString(),
        });
      });

      store.logAudit(
        req.authUser!.id,
        'USER_ROLE_ASSIGNED',
        'User',
        target.id,
        { targetEmail: target.email, newRole: role.code },
        req.ip || '127.0.0.1'
      );

      res.json({ user: sanitizeUser(target) });
    }
  );

  app.get(
    '/api/admin/audit-logs',
    requireAuth,
    requireRoles('system_administrator'),
    (_req: AuthRequest, res) => {
      res.json(store.db.auditLogs.slice(0, 100));
    }
  );

  // ------------------------------------------------------------------
  // Visual Agricultural Analysis (Photo & Video Frame Multimodal AI)
  // ------------------------------------------------------------------
  const VALID_VISUAL_CATEGORIES: VisualAnalysisCategory[] = [
    'crop_condition',
    'plant_disease',
    'pest_damage',
    'soil_field_condition',
    'flooding',
    'waterlogging',
    'livestock_appearance',
    'animal_health',
    'equipment_damage',
    'infrastructure_damage',
  ];

  app.get('/api/visual-analysis', requireAuth, (req: AuthRequest, res) => {
    const accessibleFarmIds = getAccessibleFarmIds(req.authUser!, 'aiInsights');
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    if (farmFilter && !accessibleFarmIds.includes(farmFilter)) {
      res.status(403).json({ error: 'You do not have access to this farm.' });
      return;
    }

    const items = store.db.visualAnalyses
      .filter((v) => accessibleFarmIds.includes(v.farmId) && (!farmFilter || v.farmId === farmFilter))
      .sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt))
      .map(enrichVisualAnalysis);

    res.json(items);
  });

  app.post('/api/visual-analysis', requireAuth, async (req: AuthRequest, res) => {
    const {
      farmId,
      fieldId,
      livestockGroupId,
      cropId,
      category,
      mediaType,
      mediaFileName,
      mediaMimeType,
      frames,
      mediaPreviewDataUrl,
      userQuestion,
      languageCode,
    } = req.body || {};

    if (!farmId || !userCanModifyFarm(req.authUser!, String(farmId))) {
      res.status(403).json({ error: 'You do not have permission to record visual analyses on this farm.' });
      return;
    }

    if (!VALID_VISUAL_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Please select a valid visual analysis category.' });
      return;
    }

    if (!Array.isArray(frames) || frames.length === 0) {
      res.status(400).json({ error: 'Please capture or upload at least one photograph or video frame.' });
      return;
    }

    const maxMediaMb = store.db.systemConfig?.application?.maxMediaUploadMb || 15;
    const allowedFrameMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const validFrames = frames
      .slice(0, 4)
      .filter((f) => f && typeof f.dataBase64 === 'string' && f.dataBase64.length > 20)
      .map((f) => ({
        mimeType: typeof f.mimeType === 'string' && allowedFrameMimes.includes(f.mimeType.toLowerCase())
          ? f.mimeType.toLowerCase()
          : 'image/jpeg',
        dataBase64: String(f.dataBase64),
      }));

    if (validFrames.length === 0) {
      res.status(400).json({ error: 'Uploaded media could not be decoded. Please try a JPEG, PNG, or WebP image.' });
      return;
    }

    const previewCandidate =
      typeof mediaPreviewDataUrl === 'string' && mediaPreviewDataUrl.trim()
        ? mediaPreviewDataUrl
        : `data:${validFrames[0].mimeType};base64,${validFrames[0].dataBase64.replace(/^data:[^;]+;base64,/, '')}`;

    const mediaCheck = validateSafeMediaDataUrl(previewCandidate, maxMediaMb, false);
    if (!mediaCheck.valid) {
      res.status(400).json({ error: mediaCheck.error || 'Unsafe or oversized media payload.' });
      return;
    }

    const targetLang: LanguageCode =
      languageCode && store.db.languages.some((l) => l.code === languageCode)
        ? languageCode
        : req.authUser!.preferredLanguageCode;

    try {
      const record = await runVisualAgriculturalAnalysis({
        user: req.authUser!,
        farmId: String(farmId),
        fieldId: fieldId ? String(fieldId) : null,
        livestockGroupId: livestockGroupId ? String(livestockGroupId) : null,
        cropId: cropId ? String(cropId) : null,
        category,
        mediaType: mediaType === 'video' ? 'video' : 'image',
        mediaFileName: String(mediaFileName || (mediaType === 'video' ? 'field-video.mp4' : 'field-photo.jpg')),
        mediaMimeType: String(mediaMimeType || validFrames[0].mimeType),
        frames: validFrames,
        mediaPreviewDataUrl: mediaCheck.sanitizedUrl || null,
        userQuestion: typeof userQuestion === 'string' ? userQuestion : '',
        languageCode: targetLang,
      });

      recordAiInsight({
        userId: req.authUser!.id,
        farmId: String(farmId),
        category: 'visual_analysis',
        title: `Visual Scan: ${record.possibleFindings[0] || record.category}`,
        summary: record.explanation,
        recommendations: record.recommendedActions,
        languageCode: targetLang,
        poweredBy: record.poweredBy,
      });

      store.save();
      res.status(201).json(enrichVisualAnalysis(record));
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Visual agricultural analysis failed.',
      });
    }
  });

  app.post('/api/visual-analysis/:id/convert-to-incident', requireAuth, (req: AuthRequest, res) => {
    const analysis = store.db.visualAnalyses.find((v) => v.id === req.params.id);
    if (!analysis) {
      res.status(404).json({ error: 'Visual analysis record not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, analysis.farmId)) {
      res.status(403).json({ error: 'Access denied for this farm.' });
      return;
    }

    const categoryToIncidentMap: Record<VisualAnalysisCategory, IncidentType> = {
      crop_condition: 'crop_disease',
      plant_disease: 'crop_disease',
      pest_damage: 'pest_outbreak',
      soil_field_condition: 'heavy_rainfall',
      flooding: 'flooding',
      waterlogging: 'flooding',
      livestock_appearance: 'livestock_illness',
      animal_health: 'livestock_illness',
      equipment_damage: 'equipment_damage',
      infrastructure_damage: 'infrastructure_damage',
    };

    const {
      incidentType,
      title,
      affectedQuantity,
      affectedUnit,
      affectedAreaHectares,
      estimatedFinancialImpactZar,
      description,
    } = req.body || {};

    const resolvedType: IncidentType = incidentType || categoryToIncidentMap[analysis.category];
    const incident = createFarmIncident({
      user: req.authUser!,
      farmId: analysis.farmId,
      fieldId: analysis.fieldId,
      cropId: analysis.cropId,
      livestockGroupId: analysis.livestockGroupId,
      visualAnalysisId: analysis.id,
      incidentType: resolvedType,
      title: String(title || `Visual Observation: ${analysis.possibleFindings[0] || analysis.category}`).slice(0, 140),
      occurredAt: analysis.analyzedAt,
      description: String(
        description ||
          `${analysis.explanation}\nPossible causes: ${analysis.possibleCauses.join('; ')}`
      ),
      mediaFileName: analysis.mediaFileName,
      mediaType: analysis.mediaType,
      mediaPreviewDataUrl: analysis.mediaPreviewDataUrl,
      affectedQuantity: Number(affectedQuantity) || 0,
      affectedUnit: String(affectedUnit || (analysis.cropId ? 'plants' : analysis.livestockGroupId ? 'head' : 'units')),
      affectedAreaHectares: Number(affectedAreaHectares) || 0,
      estimatedFinancialImpactZar: Number(estimatedFinancialImpactZar) || 0,
      recommendedActions: analysis.recommendedActions,
      status: 'active',
    });

    store.save();
    res.status(201).json({ analysis: enrichVisualAnalysis(analysis), incident });
  });

  app.post('/api/visual-analysis/:id/save-farm-record', requireAuth, (req: AuthRequest, res) => {
    const analysis = store.db.visualAnalyses.find((v) => v.id === req.params.id);
    if (!analysis) {
      res.status(404).json({ error: 'Visual analysis record not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, analysis.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const now = new Date().toISOString();
    const summaryText = `Visual inspection (${analysis.category}): ${analysis.possibleFindings.join('; ')} — ${analysis.explanation}`;
    let recordLabel = 'Saved to Farm Visual Inspection Log';

    if (analysis.cropId) {
      const crop = store.db.crops.find((c) => c.id === analysis.cropId);
      if (crop) {
        const actType: CropActivityType =
          analysis.category === 'pest_damage'
            ? 'pest'
            : analysis.category === 'plant_disease'
            ? 'disease'
            : 'stage_update';
        store.db.cropActivities.unshift({
          id: `cact-${crypto.randomUUID()}`,
          cropId: crop.id,
          farmId: crop.farmId,
          fieldId: crop.fieldId,
          actorUserId: req.authUser!.id,
          activityType: actType,
          activityDate: analysis.analyzedAt.slice(0, 10),
          quantity: 0,
          unit: 'visual_scan',
          valueZar: 0,
          notes: summaryText,
          snapshot: null,
          createdAt: now,
        });
        recordLabel = `Saved to Crop Activity Log (${crop.cropName})`;
      }
    } else if (analysis.livestockGroupId) {
      const group = store.db.livestockGroups.find((g) => g.id === analysis.livestockGroupId);
      if (group) {
        store.db.livestockRecords.unshift({
          id: `lrec-${crypto.randomUUID()}`,
          livestockGroupId: group.id,
          farmId: group.farmId,
          actorUserId: req.authUser!.id,
          recordType: 'Veterinary',
          recordDate: analysis.analyzedAt.slice(0, 10),
          quantityChange: 0,
          productionAmount: 0,
          productionUnit: '',
          valueZar: 0,
          notes: summaryText,
          createdAt: now,
        });
        recordLabel = `Saved to Livestock Log (${group.groupName})`;
      }
    } else {
      store.db.mixedFarmingEntries.unshift({
        id: `mix-${crypto.randomUUID()}`,
        farmId: analysis.farmId,
        ownerId: req.authUser!.id,
        entryCategory: 'shared_land',
        entryDate: analysis.analyzedAt.slice(0, 10),
        title: `Visual Record: ${analysis.mediaFileName}`,
        relatedCropId: analysis.cropId,
        relatedLivestockId: analysis.livestockGroupId,
        expenseZar: 0,
        productionQuantity: 0,
        productionUnit: 'inspection',
        waterLiters: 0,
        notes: summaryText,
        createdAt: now,
      });
      recordLabel = 'Saved to Farm Maintenance & Inspection Log';
    }

    analysis.linkedRecordNote = recordLabel;
    store.logAudit(
      req.authUser!.id,
      'VISUAL_ANALYSIS_SAVED_TO_RECORD',
      'VisualAnalysis',
      analysis.id,
      { recordLabel },
      req.ip || '127.0.0.1'
    );
    store.save();

    res.json(enrichVisualAnalysis(analysis));
  });

  app.delete('/api/visual-analysis/:id', requireAuth, (req: AuthRequest, res) => {
    const analysis = store.db.visualAnalyses.find((v) => v.id === req.params.id);
    if (!analysis) {
      res.status(404).json({ error: 'Visual analysis record not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, analysis.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    store.db.visualAnalyses = store.db.visualAnalyses.filter((v) => v.id !== analysis.id);
    store.save();
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // Comprehensive Agricultural Stock & Inventory Management
  // ------------------------------------------------------------------
  app.get('/api/stock/overview', requireAuth, (req: AuthRequest, res) => {
    const user = req.authUser!;
    const accessibleFarmIds = getAccessibleFarmIds(user, 'overview');
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    if (farmFilter && !accessibleFarmIds.includes(farmFilter)) {
      res.status(403).json({ error: 'You do not have access to this farm.' });
      return;
    }
    const overview = buildStockOverview(accessibleFarmIds, farmFilter);
    // POPIA financial confidentiality: if an expert lacks financialSummary scope for any returned farm, redact ZAR figures
    if (user.roleCode === 'agricultural_expert') {
      const canSeeFinancial = (farmId: string) =>
        Boolean(getActiveFarmGrantForExpert(user.id, farmId)?.scopes.financialSummary);
      const allFinancialAllowed = (farmFilter ? [farmFilter] : accessibleFarmIds).every(canSeeFinancial);
      if (!allFinancialAllowed) {
        res.json({
          ...overview,
          pricingDisclaimer:
            'Financial valuation amounts are hidden for farms where the farmer has not granted financialSummary permission.',
          totals: {
            ...overview.totals,
            totalCropStockValueZar: 0,
            totalLivestockValueZar: 0,
            totalHarvestValueZar: 0,
            totalStoredProductionValueZar: 0,
            totalDamagedStockValueZar: 0,
            totalRemainingStockValueZar: 0,
            netStockValueChangeZar: 0,
          },
          cropStocks: overview.cropStocks.map((row) =>
            canSeeFinancial(row.farmId)
              ? row
              : {
                  ...row,
                  plantUnitPriceZar: 0,
                  harvestUnitPriceZar: 0,
                  priceSource: 'Redacted (Farmer financialSummary scope not granted)',
                  initialPlantedValueZar: 0,
                  damagedStockValueZar: 0,
                  remainingStandingValueZar: 0,
                  estimatedHarvestValueZar: 0,
                  storedStockValueZar: 0,
                  salesValueZar: 0,
                  netStockValueChangeZar: 0,
                }
          ),
          livestockStocks: overview.livestockStocks.map((row) =>
            canSeeFinancial(row.farmId)
              ? row
              : {
                  ...row,
                  unitPriceZar: 0,
                  priceSource: 'Redacted (Farmer financialSummary scope not granted)',
                  remainingValueZar: 0,
                  deathLossValueZar: 0,
                  netValueChangeZar: 0,
                }
          ),
        });
        return;
      }
    }
    res.json(overview);
  });

  app.post('/api/stock/crops/:cropId/movements', requireAuth, (req: AuthRequest, res) => {
    const crop = store.db.crops.find((c) => c.id === req.params.cropId);
    if (!crop) {
      res.status(404).json({ error: 'Crop record not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, crop.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const { movementType, movementDate, quantity, unit, unitPriceZar, notes } = req.body || {};
    const validMoves: CropStockMovementType[] = [
      'planting',
      'damage',
      'harvest',
      'storage_in',
      'sale',
      'spoilage',
      'adjustment',
    ];
    if (!validMoves.includes(movementType)) {
      res.status(400).json({ error: 'Invalid stock movement type.' });
      return;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || (movementType === 'adjustment' ? qty === 0 : qty <= 0)) {
      res.status(400).json({
        error:
          movementType === 'adjustment'
            ? 'Please provide a non-zero adjustment quantity.'
            : 'Please provide a positive quantity.',
      });
      return;
    }

    if (movementType === 'damage') {
      const remainingHealthy = Math.max(0, crop.plantingQuantity - crop.damagedPlants);
      if (qty > remainingHealthy) {
        res.status(400).json({
          error: `Damaged plants (${qty}) cannot exceed remaining healthy plants (${remainingHealthy}).`,
        });
        return;
      }
    }

    if (movementType === 'sale' || movementType === 'spoilage') {
      const { storedKg } = computeCropStoredAndSold(crop);
      if (qty > storedKg) {
        res.status(400).json({
          error: `Cannot record ${movementType} of ${qty} kg because only ${storedKg} kg is currently stored.`,
        });
        return;
      }
    }

    const movement = recordCropStockMovement({
      crop,
      actorUserId: req.authUser!.id,
      movementType,
      movementDate: String(movementDate || getSastDateString()),
      quantity: qty,
      unit: String(unit || (movementType === 'damage' || movementType === 'planting' ? 'plants' : 'kg')),
      unitPriceZar:
        unitPriceZar !== undefined && Number.isFinite(Number(unitPriceZar))
          ? Math.max(0, Number(unitPriceZar))
          : undefined,
      notes: String(notes || `Stock movement (${movementType})`),
    });

    store.logAudit(
      req.authUser!.id,
      'CROP_STOCK_MOVEMENT',
      'CropStockMovement',
      movement.id,
      {
        farmId: crop.farmId,
        cropId: crop.id,
        movementType,
        quantityDelta: movement.quantityDelta,
        totalValueZar: movement.totalValueZar,
      },
      req.ip || '127.0.0.1'
    );
    store.save();

    dispatchNotification({
      userId: crop.ownerId,
      category: 'stock_change',
      title: `Stock ${movementType.replace(/_/g, ' ')}: ${crop.cropName}`,
      message: `${Math.abs(movement.quantityDelta).toLocaleString()} ${movement.unit} recorded on ${movement.movementDate}. Remaining plants: ${(movement.resultingRemainingPlants ?? crop.plantingQuantity - crop.damagedPlants).toLocaleString()}.`,
      actionUrl: 'stock',
      relatedEntityType: 'CropStockMovement',
      relatedEntityId: movement.id,
      prefixWithLanguageTag: true,
    });

    res.status(201).json({ movement, crop });
  });

  app.put('/api/stock/prices', requireAuth, (req: AuthRequest, res) => {
    const { farmId, entityType, entityId, unitPriceZar, unitLabel, priceSource } = req.body || {};
    if (!farmId || !userCanModifyFarm(req.authUser!, String(farmId))) {
      res.status(403).json({ error: 'You do not have permission to update prices on this farm.' });
      return;
    }
    if (!['crop_plant', 'crop_harvest', 'livestock'].includes(entityType) || !entityId) {
      res.status(400).json({ error: 'Valid price entityType and entityId are required.' });
      return;
    }

    const parsedPrice = Number(unitPriceZar);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      res.status(400).json({ error: 'Unit price must be a non-negative number.' });
      return;
    }

    const updated = updateStockUnitPrice({
      user: req.authUser!,
      farmId: String(farmId),
      entityType,
      entityId: String(entityId),
      unitPriceZar: parsedPrice,
      unitLabel: String(unitLabel || 'unit'),
      priceSource: String(priceSource || 'Farmer-entered unit price'),
    });
    store.save();
    res.json(updated);
  });

  // ------------------------------------------------------------------
  // Farm Incident & Damage Management
  // ------------------------------------------------------------------
  const VALID_INCIDENT_TYPES: IncidentType[] = [
    'heavy_rainfall',
    'flooding',
    'storm_damage',
    'drought',
    'pest_outbreak',
    'crop_disease',
    'livestock_illness',
    'livestock_death',
    'equipment_damage',
    'infrastructure_damage',
  ];

  app.get('/api/incidents', requireAuth, (req: AuthRequest, res) => {
    const user = req.authUser!;
    const accessibleFarmIds = getAccessibleFarmIds(user, 'incidents');
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    if (farmFilter && !accessibleFarmIds.includes(farmFilter)) {
      res.status(403).json({ error: 'You do not have incident access to this farm.' });
      return;
    }
    const redactFinancialFarmIds =
      user.roleCode === 'agricultural_expert'
        ? new Set(
            accessibleFarmIds.filter(
              (fid) => !getActiveFarmGrantForExpert(user.id, fid)?.scopes.financialSummary
            )
          )
        : undefined;
    res.json(buildIncidentDashboard(accessibleFarmIds, farmFilter, redactFinancialFarmIds));
  });

  app.post('/api/incidents', requireAuth, (req: AuthRequest, res) => {
    const {
      farmId,
      fieldId,
      cropId,
      livestockGroupId,
      incidentType,
      title,
      occurredAt,
      description,
      mediaFileName,
      mediaType,
      mediaPreviewDataUrl,
      affectedQuantity,
      affectedUnit,
      affectedAreaHectares,
      estimatedFinancialImpactZar,
      recommendedActions,
      status,
    } = req.body || {};

    if (!farmId || !userCanModifyFarm(req.authUser!, String(farmId))) {
      res.status(403).json({ error: 'You do not have permission to record incidents for this farm.' });
      return;
    }
    if (!VALID_INCIDENT_TYPES.includes(incidentType)) {
      res.status(400).json({ error: 'Please select a valid farm incident type.' });
      return;
    }
    if (!title || !description) {
      res.status(400).json({ error: 'Incident title and description are required.' });
      return;
    }

    const maxMediaMb = store.db.systemConfig?.application?.maxMediaUploadMb || 15;
    const mediaCheck = validateSafeMediaDataUrl(
      typeof mediaPreviewDataUrl === 'string' ? mediaPreviewDataUrl : null,
      maxMediaMb,
      false
    );
    if (!mediaCheck.valid) {
      res.status(400).json({ error: mediaCheck.error || 'Unsafe or oversized media attachment.' });
      return;
    }

    const incident = createFarmIncident({
      user: req.authUser!,
      farmId: String(farmId),
      fieldId: fieldId ? String(fieldId) : null,
      cropId: cropId ? String(cropId) : null,
      livestockGroupId: livestockGroupId ? String(livestockGroupId) : null,
      incidentType,
      title: String(title),
      occurredAt: String(occurredAt || new Date().toISOString()),
      description: String(description),
      mediaFileName: mediaFileName ? String(mediaFileName) : null,
      mediaType: mediaType === 'video' ? 'video' : mediaType === 'image' ? 'image' : null,
      mediaPreviewDataUrl: mediaCheck.sanitizedUrl || null,
      affectedQuantity: Number(affectedQuantity) || 0,
      affectedUnit: String(affectedUnit || 'units'),
      affectedAreaHectares: Number(affectedAreaHectares) || 0,
      estimatedFinancialImpactZar: Number(estimatedFinancialImpactZar) || 0,
      recommendedActions: Array.isArray(recommendedActions)
        ? recommendedActions.map(String)
        : typeof recommendedActions === 'string'
        ? recommendedActions
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      status: ['active', 'monitoring', 'resolved'].includes(status) ? status : 'active',
      ipAddress: req.ip || '127.0.0.1',
    });

    store.save();

    const farm = store.db.farms.find((f) => f.id === String(farmId));
    dispatchNotification({
      userId: farm?.ownerId || req.authUser!.id,
      category: 'agricultural_incident',
      title: `Incident Recorded: ${incident.title}`,
      message: `${incident.incidentType.replace(/_/g, ' ')} at ${farm?.name || 'Farm'}. Follow-up monitoring is active.`,
      priority: 'high',
      actionUrl: 'incidents',
      relatedEntityType: 'FarmIncident',
      relatedEntityId: incident.id,
      prefixWithLanguageTag: true,
    });

    // Notify experts who have active incident access grant for this farm
    const expertGrants = store.db.farmAccessGrants.filter(
      (g) =>
        g.status === 'active' &&
        g.farmId === String(farmId) &&
        g.granteeType === 'expert' &&
        g.scopes.incidents &&
        g.granteeUserId
    );
    for (const g of expertGrants) {
      if (g.granteeUserId) {
        dispatchNotification({
          userId: g.granteeUserId,
          category: 'agricultural_incident',
          title: `Authorised Farm Incident: ${incident.title}`,
          message: `${farm?.name || 'Authorised farm'} logged a new ${incident.incidentType.replace(/_/g, ' ')} incident awaiting advisory review.`,
          priority: 'high',
          actionUrl: 'dashboard',
          relatedEntityType: 'FarmIncident',
          relatedEntityId: incident.id,
          prefixWithLanguageTag: true,
        });
      }
    }

    res.status(201).json(incident);
  });

  app.post('/api/incidents/:id/follow-ups', requireAuth, (req: AuthRequest, res) => {
    const incident = store.db.farmIncidents.find((i) => i.id === req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, incident.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const { followUpDate, statusAfter, actionTaken, notes } = req.body || {};
    if (!actionTaken || typeof actionTaken !== 'string' || !actionTaken.trim()) {
      res.status(400).json({ error: 'Please describe the follow-up action taken.' });
      return;
    }
    const validStatus: IncidentStatus = ['active', 'monitoring', 'resolved'].includes(statusAfter)
      ? statusAfter
      : incident.status;

    const followUp = addIncidentFollowUp({
      incident,
      user: req.authUser!,
      followUpDate: String(followUpDate || getSastDateString()),
      statusAfter: validStatus,
      actionTaken: actionTaken.trim(),
      notes: String(notes || '').trim(),
      ipAddress: req.ip || '127.0.0.1',
    });
    store.save();
    res.status(201).json({ followUp, incident });
  });

  app.patch('/api/incidents/:id/status', requireAuth, (req: AuthRequest, res) => {
    const incident = store.db.farmIncidents.find((i) => i.id === req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }
    if (!userCanModifyFarm(req.authUser!, incident.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    const { status } = req.body || {};
    if (!['active', 'monitoring', 'resolved'].includes(status)) {
      res.status(400).json({ error: 'Invalid status value.' });
      return;
    }
    const prev = incident.status;
    incident.status = status;
    incident.updatedAt = new Date().toISOString();
    store.logAudit(
      req.authUser!.id,
      'INCIDENT_STATUS_UPDATED',
      'FarmIncident',
      incident.id,
      { farmId: incident.farmId, previousStatus: prev, newStatus: status },
      req.ip || '127.0.0.1'
    );
    store.save();
    res.json(incident);
  });

  // ------------------------------------------------------------------
  // Farming Business Planner (Prospective & Existing Farmers)
  // ------------------------------------------------------------------
  app.get('/api/business-planner', requireAuth, (req: AuthRequest, res) => {
    const accessibleFarmIds = getAccessibleFarmIds(req.authUser!);
    res.json(buildBusinessPlannerOverview(req.authUser!, accessibleFarmIds));
  });

  app.post('/api/business-planner/calculate', requireAuth, (req: AuthRequest, res) => {
    const body = req.body || {};
    if (body.farmId && !userCanAccessFarm(req.authUser!, String(body.farmId))) {
      res.status(403).json({ error: 'You do not have access to the selected farm.' });
      return;
    }
    const calc = computeBusinessPlanMetrics({
      farmId: body.farmId ? String(body.farmId) : null,
      planName: String(body.planName || 'Draft Scenario'),
      farmingType: String(body.farmingType || 'horticulture_veg'),
      scaleTier: (['small_scale', 'medium_scale', 'large_scale'].includes(body.scaleTier)
        ? body.scaleTier
        : 'small_scale') as BusinessScaleTier,
      province: String(body.province || 'KwaZulu-Natal'),
      district: String(body.district || ''),
      farmSizeHectares: Number(body.farmSizeHectares) || 1,
      productionGoals: String(body.productionGoals || ''),
      marketChannel: String(body.marketChannel || ''),
      equipmentCostZar: Number(body.equipmentCostZar) || 0,
      equipmentNotes: String(body.equipmentNotes || ''),
      seedsPlantingCostZar: Number(body.seedsPlantingCostZar) || 0,
      fertilisersCostZar: Number(body.fertilisersCostZar) || 0,
      feedCostZar: Number(body.feedCostZar) || 0,
      waterCostZar: Number(body.waterCostZar) || 0,
      waterDemandM3: Number(body.waterDemandM3) || 0,
      labourWorkers: Number(body.labourWorkers) || 0,
      labourCostZar: Number(body.labourCostZar) || 0,
      infrastructureCostZar: Number(body.infrastructureCostZar) || 0,
      operatingExpensesZar: Number(body.operatingExpensesZar) || 0,
      expectedProductionQty: Number(body.expectedProductionQty) || 0,
      productionUnit: String(body.productionUnit || 'kg'),
      sellingPricePerUnitZar: Number(body.sellingPricePerUnitZar) || 0,
      assumptionsNotes: String(body.assumptionsNotes || ''),
    });
    res.json(calc);
  });

  app.post('/api/business-planner/plans', requireAuth, (req: AuthRequest, res) => {
    const body = req.body || {};
    if (!body.planName || !body.farmingType) {
      res.status(400).json({ error: 'Plan name and farming type are required.' });
      return;
    }
    if (body.farmId && !userCanAccessFarm(req.authUser!, String(body.farmId))) {
      res.status(403).json({ error: 'You do not have access to the selected farm.' });
      return;
    }

    const now = new Date().toISOString();
    const scaleTier: BusinessScaleTier = ['small_scale', 'medium_scale', 'large_scale'].includes(
      body.scaleTier
    )
      ? body.scaleTier
      : 'small_scale';

    const plan: BusinessPlanScenario = {
      id: `bplan-${crypto.randomUUID()}`,
      ownerId: req.authUser!.id,
      farmId: body.farmId ? String(body.farmId) : null,
      planName: String(body.planName).trim(),
      farmingType: String(body.farmingType).trim(),
      scaleTier,
      province: String(body.province || req.authUser!.profile?.province || 'KwaZulu-Natal'),
      district: String(body.district || req.authUser!.profile?.district || ''),
      farmSizeHectares: Math.max(0.05, Number(body.farmSizeHectares) || 1),
      productionGoals: String(body.productionGoals || '').trim(),
      marketChannel: String(body.marketChannel || 'Local Buyers & Fresh Produce Market').trim(),
      equipmentCostZar: Math.max(0, Number(body.equipmentCostZar) || 0),
      equipmentNotes: String(body.equipmentNotes || '').trim(),
      seedsPlantingCostZar: Math.max(0, Number(body.seedsPlantingCostZar) || 0),
      fertilisersCostZar: Math.max(0, Number(body.fertilisersCostZar) || 0),
      feedCostZar: Math.max(0, Number(body.feedCostZar) || 0),
      waterCostZar: Math.max(0, Number(body.waterCostZar) || 0),
      waterDemandM3: Math.max(0, Number(body.waterDemandM3) || 0),
      labourWorkers: Math.max(0, Number(body.labourWorkers) || 0),
      labourCostZar: Math.max(0, Number(body.labourCostZar) || 0),
      infrastructureCostZar: Math.max(0, Number(body.infrastructureCostZar) || 0),
      operatingExpensesZar: Math.max(0, Number(body.operatingExpensesZar) || 0),
      expectedProductionQty: Math.max(0, Number(body.expectedProductionQty) || 0),
      productionUnit: String(body.productionUnit || 'kg').trim(),
      sellingPricePerUnitZar: Math.max(0, Number(body.sellingPricePerUnitZar) || 0),
      assumptionsNotes: String(body.assumptionsNotes || '').trim(),
      createdAt: now,
      updatedAt: now,
    };

    store.db.businessPlans.unshift(plan);
    store.logAudit(
      req.authUser!.id,
      'BUSINESS_PLAN_CREATED',
      'BusinessPlanScenario',
      plan.id,
      { planName: plan.planName, scaleTier: plan.scaleTier, farmId: plan.farmId },
      req.ip || '127.0.0.1'
    );
    store.save();

    res.status(201).json({
      ...plan,
      calculation: computeBusinessPlanMetrics(plan),
    });
  });

  app.put('/api/business-planner/plans/:id', requireAuth, (req: AuthRequest, res) => {
    const plan = store.db.businessPlans.find((p) => p.id === req.params.id);
    if (!plan) {
      res.status(404).json({ error: 'Business plan not found.' });
      return;
    }
    const canAdminPrivate =
      req.authUser!.roleCode === 'system_administrator' &&
      req.authUser!.permissions.includes('admin:private_farmer_records');
    if (plan.ownerId !== req.authUser!.id && !canAdminPrivate) {
      res.status(403).json({ error: 'You do not have permission to edit this business plan.' });
      return;
    }

    const body = req.body || {};
    if (body.farmId !== undefined) {
      if (body.farmId && !userCanAccessFarm(req.authUser!, String(body.farmId))) {
        res.status(403).json({ error: 'Access denied for selected farm.' });
        return;
      }
      plan.farmId = body.farmId ? String(body.farmId) : null;
    }
    if (body.planName) plan.planName = String(body.planName).trim();
    if (body.farmingType) plan.farmingType = String(body.farmingType).trim();
    if (['small_scale', 'medium_scale', 'large_scale'].includes(body.scaleTier)) {
      plan.scaleTier = body.scaleTier;
    }
    if (body.province !== undefined) plan.province = String(body.province);
    if (body.district !== undefined) plan.district = String(body.district);
    if (body.farmSizeHectares !== undefined) plan.farmSizeHectares = Math.max(0.05, Number(body.farmSizeHectares) || 1);
    if (body.productionGoals !== undefined) plan.productionGoals = String(body.productionGoals);
    if (body.marketChannel !== undefined) plan.marketChannel = String(body.marketChannel);
    if (body.equipmentCostZar !== undefined) plan.equipmentCostZar = Math.max(0, Number(body.equipmentCostZar) || 0);
    if (body.equipmentNotes !== undefined) plan.equipmentNotes = String(body.equipmentNotes);
    if (body.seedsPlantingCostZar !== undefined) plan.seedsPlantingCostZar = Math.max(0, Number(body.seedsPlantingCostZar) || 0);
    if (body.fertilisersCostZar !== undefined) plan.fertilisersCostZar = Math.max(0, Number(body.fertilisersCostZar) || 0);
    if (body.feedCostZar !== undefined) plan.feedCostZar = Math.max(0, Number(body.feedCostZar) || 0);
    if (body.waterCostZar !== undefined) plan.waterCostZar = Math.max(0, Number(body.waterCostZar) || 0);
    if (body.waterDemandM3 !== undefined) plan.waterDemandM3 = Math.max(0, Number(body.waterDemandM3) || 0);
    if (body.labourWorkers !== undefined) plan.labourWorkers = Math.max(0, Number(body.labourWorkers) || 0);
    if (body.labourCostZar !== undefined) plan.labourCostZar = Math.max(0, Number(body.labourCostZar) || 0);
    if (body.infrastructureCostZar !== undefined) plan.infrastructureCostZar = Math.max(0, Number(body.infrastructureCostZar) || 0);
    if (body.operatingExpensesZar !== undefined) plan.operatingExpensesZar = Math.max(0, Number(body.operatingExpensesZar) || 0);
    if (body.expectedProductionQty !== undefined) plan.expectedProductionQty = Math.max(0, Number(body.expectedProductionQty) || 0);
    if (body.productionUnit !== undefined) plan.productionUnit = String(body.productionUnit);
    if (body.sellingPricePerUnitZar !== undefined) plan.sellingPricePerUnitZar = Math.max(0, Number(body.sellingPricePerUnitZar) || 0);
    if (body.assumptionsNotes !== undefined) plan.assumptionsNotes = String(body.assumptionsNotes);
    plan.updatedAt = new Date().toISOString();

    store.save();
    res.json({
      ...plan,
      calculation: computeBusinessPlanMetrics(plan),
    });
  });

  app.delete('/api/business-planner/plans/:id', requireAuth, (req: AuthRequest, res) => {
    const plan = store.db.businessPlans.find((p) => p.id === req.params.id);
    if (!plan) {
      res.status(404).json({ error: 'Business plan not found.' });
      return;
    }
    const canAdminPrivate =
      req.authUser!.roleCode === 'system_administrator' &&
      req.authUser!.permissions.includes('admin:private_farmer_records');
    if (plan.ownerId !== req.authUser!.id && !canAdminPrivate) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    store.db.businessPlans = store.db.businessPlans.filter((p) => p.id !== plan.id);
    store.save();
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // Agricultural Learning Centre (Multilingual, Accessible, Admin CMS)
  // ------------------------------------------------------------------
  app.get('/api/learning/materials', requireAuth, (req: AuthRequest, res) => {
    const reqLang = req.query.languageCode ? String(req.query.languageCode) : undefined;
    const validLang =
      reqLang && store.db.languages.some((l) => l.code === reqLang)
        ? (reqLang as LanguageCode)
        : req.authUser!.preferredLanguageCode;
    const includeDrafts = req.query.includeDrafts === 'true';

    res.json(
      buildLearningCentrePayload({
        user: req.authUser!,
        languageCode: validLang,
        includeDrafts,
      })
    );
  });

  app.post('/api/learning/materials/:id/save', requireAuth, (req: AuthRequest, res) => {
    const material = store.db.learningMaterials.find((m) => m.id === req.params.id);
    if (!material) {
      res.status(404).json({ error: 'Learning material not found.' });
      return;
    }
    const now = new Date().toISOString();
    let prog = store.db.learningProgress.find(
      (p) => p.userId === req.authUser!.id && p.materialId === material.id
    );
    if (!prog) {
      prog = {
        id: `lprog-${crypto.randomUUID()}`,
        userId: req.authUser!.id,
        materialId: material.id,
        isSaved: true,
        status: 'not_started',
        completedSteps: [],
        progressPercent: 0,
        lastAccessedAt: now,
        completedAt: null,
      };
      store.db.learningProgress.push(prog);
    } else {
      prog.isSaved = typeof req.body?.isSaved === 'boolean' ? req.body.isSaved : !prog.isSaved;
      prog.lastAccessedAt = now;
    }
    store.save();
    res.json({
      progress: prog,
      material: resolveMaterialForUser(material, req.authUser!, req.body?.languageCode),
    });
  });

  app.post('/api/learning/materials/:id/progress', requireAuth, (req: AuthRequest, res) => {
    const material = store.db.learningMaterials.find((m) => m.id === req.params.id);
    if (!material) {
      res.status(404).json({ error: 'Learning material not found.' });
      return;
    }

    const now = new Date().toISOString();
    const { status, completedSteps, totalSteps } = req.body || {};

    let prog = store.db.learningProgress.find(
      (p) => p.userId === req.authUser!.id && p.materialId === material.id
    );
    if (!prog) {
      prog = {
        id: `lprog-${crypto.randomUUID()}`,
        userId: req.authUser!.id,
        materialId: material.id,
        isSaved: false,
        status: 'in_progress',
        completedSteps: [],
        progressPercent: 0,
        lastAccessedAt: now,
        completedAt: null,
      };
      store.db.learningProgress.push(prog);
    }

    if (Array.isArray(completedSteps)) {
      prog.completedSteps = completedSteps
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0);
    }

    const denom = Math.max(1, Number(totalSteps) || material.translations.en?.steps.length || 1);
    if (status === 'completed') {
      prog.status = 'completed';
      prog.progressPercent = 100;
      prog.completedAt = now;
    } else if (status === 'not_started') {
      prog.status = 'not_started';
      prog.completedSteps = [];
      prog.progressPercent = 0;
      prog.completedAt = null;
    } else {
      const pct = Math.min(100, Math.round((prog.completedSteps.length / denom) * 100));
      prog.progressPercent = pct > 0 ? pct : 25;
      prog.status = prog.progressPercent >= 100 ? 'completed' : 'in_progress';
      prog.completedAt = prog.status === 'completed' ? now : null;
    }
    prog.lastAccessedAt = now;
    store.save();

    res.json({
      progress: prog,
      material: resolveMaterialForUser(material, req.authUser!, req.body?.languageCode),
      learningReadiness: computeLearningReadiness(req.authUser!),
    });
  });

  app.post('/api/learning/readiness-assessment', requireAuth, (req: AuthRequest, res) => {
    const { answers } = req.body || {};
    if (!answers || typeof answers !== 'object') {
      res.status(400).json({ error: 'Please answer all readiness check questions before submitting.' });
      return;
    }

    const sanitizedAnswers: Record<string, string> = {};
    for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
      if (typeof v === 'string') sanitizedAnswers[k] = v;
    }

    const graded = gradeReadinessAssessment(sanitizedAnswers);
    const now = new Date().toISOString();

    const profile = store.db.userProfiles.find((p) => p.userId === req.authUser!.id);
    if (!profile) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    profile.readinessAssessment = {
      passed: graded.passed,
      score: graded.score,
      totalQuestions: graded.totalQuestions,
      answers: sanitizedAnswers,
      completedAt: now,
    };
    profile.updatedAt = now;

    store.logAudit(
      req.authUser!.id,
      'LEARNING_READINESS_ASSESSMENT_SUBMITTED',
      'UserProfile',
      profile.id,
      { score: graded.score, totalQuestions: graded.totalQuestions, passed: graded.passed },
      req.ip || '127.0.0.1'
    );
    store.save();

    res.json({
      result: graded,
      learningReadiness: computeLearningReadiness(req.authUser!),
    });
  });

  // ------------------------------------------------------------------
  // Farmer Journey Transition (Prospective <-> Existing Farm Operator)
  // Preserves same user account, plans, locations, learning & prefs.
  // ------------------------------------------------------------------
  app.post(
    '/api/farmer/transition-to-existing',
    requireAuth,
    requireRoles('prospective_farmer', 'existing_farmer'),
    (req: AuthRequest, res) => {
      const user = store.db.users.find((u) => u.id === req.authUser!.id);
      const profile = store.db.userProfiles.find((p) => p.userId === req.authUser!.id);
      const existingRole = store.db.roles.find((r) => r.code === 'existing_farmer');
      if (!user || !profile || !existingRole) {
        res.status(400).json({ error: 'Account configuration unavailable for farm transition.' });
        return;
      }

      const {
        farmName,
        province,
        districtMunicipality,
        localMunicipality,
        townOrVillage,
        locationDescription,
        locationConfirmed,
        latitude,
        longitude,
        locationSource,
        gpsLatitude,
        gpsLongitude,
        gpsAccuracyMeters,
        gpsCapturedAt,
        farmSizeHectares,
        farmingActivities,
        yearsOfExperience,
        waterAvailability,
        existingCrops,
        existingLivestock,
        tenureType,
        managementRelationshipNote,
        linkedBusinessPlanIds,
        boundaryGeojson,
      } = req.body || {};

      if (!farmName || !province || !districtMunicipality || !townOrVillage) {
        res.status(400).json({
          error: 'Farm name, province, district municipality, and town/village are required.',
        });
        return;
      }

      const parsedSize = Number(farmSizeHectares || 1);
      if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
        res.status(400).json({ error: 'Farm size in hectares must be a positive number.' });
        return;
      }

      const coordCheck = validateSaCoordinates(latitude, longitude);
      if (!coordCheck.valid || coordCheck.lat === null || coordCheck.lng === null) {
        res.status(400).json({
          error: coordCheck.error || 'Selected farm coordinates must lie within South Africa.',
        });
        return;
      }

      const validTenure = [
        'owner',
        'manager',
        'lessee',
        'communal_custodian',
        'family_land',
      ].includes(tenureType)
        ? tenureType
        : 'owner';

      const now = new Date().toISOString();
      const farmId = `farm-${crypto.randomUUID()}`;
      const sizeHa = Math.max(0.1, Number(parsedSize.toFixed(2)));
      const validSource: LocationSource = [
        'gps',
        'manual_map_pin',
        'geocoded_search',
        'municipal_center',
      ].includes(locationSource)
        ? locationSource
        : 'manual_map_pin';

      const planIdsToLink: string[] = Array.isArray(linkedBusinessPlanIds)
        ? linkedBusinessPlanIds.map((id) => String(id))
        : [];

      let linkedPlansCount = 0;
      for (const plan of store.db.businessPlans) {
        if (plan.ownerId === user.id && planIdsToLink.includes(plan.id)) {
          plan.farmId = farmId;
          plan.updatedAt = now;
          linkedPlansCount += 1;
        }
      }

      store.db.farms.push({
        id: farmId,
        ownerId: user.id,
        name: String(farmName).trim(),
        farmingActivities: Array.isArray(farmingActivities) ? farmingActivities : [],
        farmSizeHectares: sizeHa,
        yearsOfExperience: Number.isFinite(Number(yearsOfExperience))
          ? Math.max(0, Number(yearsOfExperience))
          : 0,
        waterAvailability: String(waterAvailability || 'Borehole & Tank'),
        existingCrops: Array.isArray(existingCrops) ? existingCrops : [],
        existingLivestock: Array.isArray(existingLivestock) ? existingLivestock : [],
        tenureType: validTenure,
        managementRelationshipNote:
          typeof managementRelationshipNote === 'string'
            ? managementRelationshipNote.trim().slice(0, 300)
            : '',
        linkedBusinessPlanIds: planIdsToLink,
        status: 'active',
        isDemonstration: false,
        createdAt: now,
        updatedAt: now,
      });

      store.db.farmLocations.push({
        id: `loc-${crypto.randomUUID()}`,
        farmId,
        province: String(province),
        districtMunicipality: String(districtMunicipality),
        localMunicipality: String(localMunicipality || districtMunicipality),
        townOrVillage: String(townOrVillage),
        locationDescription: typeof locationDescription === 'string' ? locationDescription.trim() : '',
        locationConfirmed:
          typeof locationConfirmed === 'boolean' ? locationConfirmed : validSource !== 'municipal_center',
        latitude: coordCheck.lat,
        longitude: coordCheck.lng,
        locationSource: validSource,
        gpsLatitude: typeof gpsLatitude === 'number' && Number.isFinite(gpsLatitude) ? gpsLatitude : null,
        gpsLongitude: typeof gpsLongitude === 'number' && Number.isFinite(gpsLongitude) ? gpsLongitude : null,
        gpsAccuracyMeters:
          typeof gpsAccuracyMeters === 'number' && Number.isFinite(gpsAccuracyMeters)
            ? gpsAccuracyMeters
            : null,
        gpsCapturedAt: typeof gpsCapturedAt === 'string' ? gpsCapturedAt : null,
        centroidWkt: pointToWkt(coordCheck.lat, coordCheck.lng),
        elevationMeters: estimateSaElevationMeters(String(province), coordCheck.lat, coordCheck.lng),
      });

      if (isValidPolygon(boundaryGeojson)) {
        store.db.farmBoundaries.push({
          id: `bnd-${crypto.randomUUID()}`,
          farmId,
          boundaryWkt: polygonToWkt(boundaryGeojson),
          geojson: boundaryGeojson,
          calculatedAreaHectares: calculatePolygonAreaHectares(boundaryGeojson),
          perimeterMeters: calculatePolygonPerimeterMeters(boundaryGeojson),
          source: 'drawn_polygon',
          updatedAt: now,
        });
      }

      const previousRoleCode =
        store.db.roles.find((r) => r.id === user.roleId)?.code || 'prospective_farmer';

      user.roleId = existingRole.id;
      user.onboardingCompleted = true;
      user.updatedAt = now;

      profile.province = String(province);
      profile.district = String(districtMunicipality);
      profile.journeyHistory = profile.journeyHistory || [];
      profile.journeyHistory.unshift({
        id: `jrn-${crypto.randomUUID()}`,
        fromRole: previousRoleCode as 'prospective_farmer' | 'existing_farmer',
        toRole: 'existing_farmer',
        farmId,
        farmName: String(farmName).trim(),
        note: `Registered farm under "${validTenure}" relationship (${linkedPlansCount} business plan(s) linked). Preserved learning progress, saved locations, and preferences.`,
        occurredAt: now,
      });
      profile.updatedAt = now;

      store.logAudit(
        user.id,
        'FARMER_JOURNEY_TRANSITIONED_TO_EXISTING',
        'Farm',
        farmId,
        {
          fromRole: previousRoleCode,
          toRole: 'existing_farmer',
          tenureType: validTenure,
          linkedPlansCount,
          province,
          sizeHa,
        },
        req.ip || '127.0.0.1'
      );

      res.status(201).json({
        user: sanitizeUser(user),
        farm: hydrateFarm(farmId),
        linkedPlansCount,
      });
    }
  );

  app.post(
    '/api/farmer/revert-to-prospective',
    requireAuth,
    requireRoles('existing_farmer'),
    (req: AuthRequest, res) => {
      const user = store.db.users.find((u) => u.id === req.authUser!.id);
      const profile = store.db.userProfiles.find((p) => p.userId === req.authUser!.id);
      const prospectiveRole = store.db.roles.find((r) => r.code === 'prospective_farmer');
      if (!user || !profile || !prospectiveRole) {
        res.status(400).json({ error: 'Account configuration unavailable for role switch.' });
        return;
      }

      const now = new Date().toISOString();
      const reasonNote =
        typeof req.body?.reason === 'string' && req.body.reason.trim()
          ? req.body.reason.trim().slice(0, 200)
          : 'User switched workspace mode back to Prospective Farmer (all farms, plans, and learning records preserved).';

      user.roleId = prospectiveRole.id;
      user.updatedAt = now;

      profile.journeyHistory = profile.journeyHistory || [];
      profile.journeyHistory.unshift({
        id: `jrn-${crypto.randomUUID()}`,
        fromRole: 'existing_farmer',
        toRole: 'prospective_farmer',
        farmId: null,
        farmName: null,
        note: reasonNote,
        occurredAt: now,
      });
      profile.updatedAt = now;

      store.logAudit(
        user.id,
        'FARMER_JOURNEY_REVERTED_TO_PROSPECTIVE',
        'User',
        user.id,
        { note: reasonNote },
        req.ip || '127.0.0.1'
      );

      res.json({
        user: sanitizeUser(user),
        preservedFarmsCount: store.db.farms.filter((f) => f.ownerId === user.id).length,
      });
    }
  );

  app.post('/api/learning/admin/materials', requireAuth, (req: AuthRequest, res) => {
    if (!userCanManageLearning(req.authUser!)) {
      res.status(403).json({ error: 'Only authorised administrators or agricultural experts can create learning materials.' });
      return;
    }

    const {
      category,
      contentType,
      difficulty,
      illustrationKey,
      customIllustrationDataUrl,
      videoUrl,
      videoDurationLabel,
      sourceAttribution,
      verifiedOfficialReference,
      status,
      estimatedMinutes,
      tags,
      languageCode,
      title,
      summary,
      body,
      steps,
      reviewed,
    } = req.body || {};

    const validCategories = LEARNING_CATEGORIES.map((c) => c.code);
    if (!validCategories.includes(category)) {
      res.status(400).json({ error: 'Please select a valid learning category.' });
      return;
    }
    if (!title || !summary || !body) {
      res.status(400).json({ error: 'Title, summary, and guide body content are required.' });
      return;
    }

    const lang: LanguageCode =
      languageCode && store.db.languages.some((l) => l.code === languageCode)
        ? languageCode
        : 'en';
    const now = new Date().toISOString();
    const id = `learn-${crypto.randomUUID()}`;
    const slug = `${String(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${id.slice(-6)}`;

    const stepList = Array.isArray(steps)
      ? steps.map((s) => String(s).trim()).filter(Boolean)
      : typeof steps === 'string'
      ? steps
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const maxMediaMb = store.db.systemConfig?.application?.maxMediaUploadMb || 15;
    const illustrationCheck = validateSafeMediaDataUrl(
      typeof customIllustrationDataUrl === 'string' ? customIllustrationDataUrl : null,
      maxMediaMb,
      false
    );
    if (!illustrationCheck.valid) {
      res.status(400).json({ error: illustrationCheck.error || 'Unsafe custom illustration format.' });
      return;
    }

    let safeVideoUrl: string | null = null;
    if (typeof videoUrl === 'string' && videoUrl.trim()) {
      const candidate = videoUrl.trim();
      if (!/^https?:\/\//i.test(candidate)) {
        res.status(400).json({ error: 'Video URL must use https:// or http:// protocol.' });
        return;
      }
      safeVideoUrl = candidate;
    }

    const newMaterial: LearningMaterial = {
      id,
      slug,
      category: category as LearningCategoryCode,
      contentType: (['article', 'step_by_step_guide', 'illustrated_guide', 'video_lesson'].includes(
        contentType
      )
        ? contentType
        : 'article') as LearningContentType,
      difficulty: (['beginner', 'intermediate', 'experienced'].includes(difficulty)
        ? difficulty
        : 'beginner') as LearningDifficulty,
      illustrationKey: String(illustrationKey || 'soil_crops'),
      customIllustrationDataUrl: illustrationCheck.sanitizedUrl || null,
      videoUrl: safeVideoUrl,
      videoDurationLabel: videoDurationLabel ? String(videoDurationLabel).trim() : undefined,
      videoSlides: [],
      sourceAttribution: String(
        sourceAttribution || 'Field Shift Editorial Agricultural Guidance (Internal Draft)'
      ).trim(),
      verifiedOfficialReference: Boolean(verifiedOfficialReference),
      status: ['published', 'draft', 'archived'].includes(status) ? status : 'draft',
      estimatedMinutes: Math.max(1, Number(estimatedMinutes) || 5),
      tags: Array.isArray(tags)
        ? tags.map(String)
        : typeof tags === 'string'
        ? tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      translations: {
        [lang]: {
          title: String(title).trim(),
          summary: String(summary).trim(),
          body: String(body).trim(),
          steps: stepList,
          reviewed: Boolean(reviewed),
          reviewedBy: reviewed ? req.authUser!.profile?.fullName || req.authUser!.email : undefined,
          reviewedAt: reviewed ? now.slice(0, 10) : undefined,
        },
      },
      createdByUserId: req.authUser!.id,
      updatedByUserId: req.authUser!.id,
      createdAt: now,
      updatedAt: now,
    };

    store.db.learningMaterials.unshift(newMaterial);
    store.logAudit(
      req.authUser!.id,
      'LEARNING_MATERIAL_CREATED',
      'LearningMaterial',
      newMaterial.id,
      { category: newMaterial.category, status: newMaterial.status, title: String(title).trim() },
      req.ip || '127.0.0.1'
    );
    store.save();

    res.status(201).json(resolveMaterialForUser(newMaterial, req.authUser!, lang));
  });

  app.put('/api/learning/admin/materials/:id', requireAuth, (req: AuthRequest, res) => {
    if (!userCanManageLearning(req.authUser!)) {
      res.status(403).json({ error: 'Only authorised administrators or agricultural experts can edit learning materials.' });
      return;
    }

    const material = store.db.learningMaterials.find((m) => m.id === req.params.id);
    if (!material) {
      res.status(404).json({ error: 'Learning material not found.' });
      return;
    }

    const {
      category,
      contentType,
      difficulty,
      illustrationKey,
      videoUrl,
      videoDurationLabel,
      sourceAttribution,
      verifiedOfficialReference,
      status,
      estimatedMinutes,
      tags,
      languageCode,
      title,
      summary,
      body,
      steps,
      reviewed,
    } = req.body || {};

    const validCategories = LEARNING_CATEGORIES.map((c) => c.code);
    if (category && validCategories.includes(category)) material.category = category;
    if (['article', 'step_by_step_guide', 'illustrated_guide', 'video_lesson'].includes(contentType)) {
      material.contentType = contentType;
    }
    if (['beginner', 'intermediate', 'experienced'].includes(difficulty)) {
      material.difficulty = difficulty;
    }
    if (illustrationKey) material.illustrationKey = String(illustrationKey);
    if (req.body?.customIllustrationDataUrl !== undefined) {
      const maxMediaMb = store.db.systemConfig?.application?.maxMediaUploadMb || 15;
      const illustrationCheck = validateSafeMediaDataUrl(
        typeof req.body.customIllustrationDataUrl === 'string'
          ? req.body.customIllustrationDataUrl
          : null,
        maxMediaMb,
        false
      );
      if (!illustrationCheck.valid) {
        res.status(400).json({ error: illustrationCheck.error || 'Unsafe custom illustration format.' });
        return;
      }
      material.customIllustrationDataUrl = illustrationCheck.sanitizedUrl || null;
    }
    if (videoUrl !== undefined) {
      if (videoUrl && typeof videoUrl === 'string' && videoUrl.trim()) {
        const candidate = videoUrl.trim();
        if (!/^https?:\/\//i.test(candidate)) {
          res.status(400).json({ error: 'Video URL must use https:// or http:// protocol.' });
          return;
        }
        material.videoUrl = candidate;
      } else {
        material.videoUrl = null;
      }
    }
    if (videoDurationLabel !== undefined) material.videoDurationLabel = String(videoDurationLabel);
    if (sourceAttribution !== undefined) material.sourceAttribution = String(sourceAttribution).trim();
    if (typeof verifiedOfficialReference === 'boolean') {
      material.verifiedOfficialReference = verifiedOfficialReference;
    }
    if (['published', 'draft', 'archived'].includes(status)) {
      material.status = status;
    }
    if (estimatedMinutes !== undefined) material.estimatedMinutes = Math.max(1, Number(estimatedMinutes) || 5);
    if (tags !== undefined) {
      material.tags = Array.isArray(tags)
        ? tags.map(String)
        : String(tags)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
    }

    const targetLang: LanguageCode =
      languageCode && store.db.languages.some((l) => l.code === languageCode)
        ? languageCode
        : 'en';

    const now = new Date().toISOString();
    if (title || summary || body || steps !== undefined) {
      const prevTr = material.translations[targetLang];
      const stepList = Array.isArray(steps)
        ? steps.map((s) => String(s).trim()).filter(Boolean)
        : typeof steps === 'string'
        ? steps
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : prevTr?.steps || [];

      const isReviewed = typeof reviewed === 'boolean' ? reviewed : Boolean(prevTr?.reviewed);
      material.translations[targetLang] = {
        title: String(title || prevTr?.title || '').trim(),
        summary: String(summary || prevTr?.summary || '').trim(),
        body: String(body || prevTr?.body || '').trim(),
        steps: stepList,
        reviewed: isReviewed,
        reviewedBy: isReviewed
          ? prevTr?.reviewedBy || req.authUser!.profile?.fullName || req.authUser!.email
          : undefined,
        reviewedAt: isReviewed ? now.slice(0, 10) : undefined,
      };
    }

    material.updatedByUserId = req.authUser!.id;
    material.updatedAt = now;
    store.logAudit(
      req.authUser!.id,
      'LEARNING_MATERIAL_UPDATED',
      'LearningMaterial',
      material.id,
      { category: material.category, status: material.status, language: targetLang },
      req.ip || '127.0.0.1'
    );
    store.save();

    res.json(resolveMaterialForUser(material, req.authUser!, targetLang));
  });

  app.patch('/api/learning/admin/materials/:id/status', requireAuth, (req: AuthRequest, res) => {
    if (!userCanManageLearning(req.authUser!)) {
      res.status(403).json({ error: 'Only authorised administrators or experts can publish/unpublish materials.' });
      return;
    }
    const material = store.db.learningMaterials.find((m) => m.id === req.params.id);
    if (!material) {
      res.status(404).json({ error: 'Learning material not found.' });
      return;
    }
    const { status } = req.body || {};
    if (!['published', 'draft', 'archived'].includes(status)) {
      res.status(400).json({ error: 'Invalid status.' });
      return;
    }
    material.status = status;
    material.updatedByUserId = req.authUser!.id;
    material.updatedAt = new Date().toISOString();
    store.logAudit(
      req.authUser!.id,
      'LEARNING_MATERIAL_STATUS_CHANGED',
      'LearningMaterial',
      material.id,
      { status },
      req.ip || '127.0.0.1'
    );
    store.save();
    res.json(resolveMaterialForUser(material, req.authUser!));
  });

  app.put(
    '/api/learning/admin/materials/:id/translations/:langCode',
    requireAuth,
    (req: AuthRequest, res) => {
      if (!userCanManageLearning(req.authUser!)) {
        res.status(403).json({ error: 'Only authorised administrators or experts can manage translations.' });
        return;
      }
      const material = store.db.learningMaterials.find((m) => m.id === req.params.id);
      if (!material) {
        res.status(404).json({ error: 'Learning material not found.' });
        return;
      }
      const langCode = req.params.langCode as LanguageCode;
      if (!store.db.languages.some((l) => l.code === langCode)) {
        res.status(400).json({ error: 'Invalid South African official language code.' });
        return;
      }

      const { title, summary, body, steps, reviewed } = req.body || {};
      if (!title || !summary || !body) {
        res.status(400).json({ error: 'Title, summary, and body are required for translation.' });
        return;
      }
      const now = new Date().toISOString();
      const stepList = Array.isArray(steps)
        ? steps.map((s) => String(s).trim()).filter(Boolean)
        : typeof steps === 'string'
        ? steps
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const isReviewed = Boolean(reviewed);
      material.translations[langCode] = {
        title: String(title).trim(),
        summary: String(summary).trim(),
        body: String(body).trim(),
        steps: stepList,
        reviewed: isReviewed,
        reviewedBy: isReviewed ? req.authUser!.profile?.fullName || req.authUser!.email : undefined,
        reviewedAt: isReviewed ? now.slice(0, 10) : undefined,
      };
      material.updatedByUserId = req.authUser!.id;
      material.updatedAt = now;

      store.logAudit(
        req.authUser!.id,
        'LEARNING_TRANSLATION_SAVED',
        'LearningMaterial',
        material.id,
        { langCode, reviewed: isReviewed },
        req.ip || '127.0.0.1'
      );
      store.save();

      res.json(resolveMaterialForUser(material, req.authUser!, langCode));
    }
  );

  app.delete('/api/learning/admin/materials/:id', requireAuth, (req: AuthRequest, res) => {
    if (!userCanManageLearning(req.authUser!)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    const existing = store.db.learningMaterials.find((m) => m.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Learning material not found.' });
      return;
    }
    store.db.learningMaterials = store.db.learningMaterials.filter((m) => m.id !== existing.id);
    store.db.learningProgress = store.db.learningProgress.filter((p) => p.materialId !== existing.id);
    store.save();
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // Comprehensive Farmer Dashboards & Prospective Saved Locations
  // ------------------------------------------------------------------
  app.get('/api/dashboard/overview', requireAuth, async (req: AuthRequest, res) => {
    const user = req.authUser!;
    if (user.roleCode === 'organisation_manager') {
      res.status(403).json({
        error:
          'Organisation managers must use /api/organisation/overview for privacy-protected portfolio aggregates.',
      });
      return;
    }
    if (user.roleCode === 'prospective_farmer') {
      res.json(
        await buildProspectiveFarmerDashboard({
          user,
          provinceFilter: req.query.province ? String(req.query.province) : undefined,
        })
      );
      return;
    }

    const accessibleFarmIds = getAccessibleFarmIds(user, 'overview');
    const farmId = req.query.farmId ? String(req.query.farmId) : 'all';
    if (farmId !== 'all' && !accessibleFarmIds.includes(farmId)) {
      res.status(403).json({ error: 'You do not have access to the requested farm.' });
      return;
    }

    const payload = await buildExistingFarmerDashboard({
      user,
      accessibleFarmIds,
      farmId,
      fieldId: req.query.fieldId ? String(req.query.fieldId) : 'all',
      startDate: req.query.startDate ? String(req.query.startDate) : '',
      endDate: req.query.endDate ? String(req.query.endDate) : '',
      category: req.query.category ? String(req.query.category) : 'all',
    });
    res.json(payload);
  });

  app.post('/api/prospective/locations', requireAuth, (req: AuthRequest, res) => {
    const { province, district, townOrArea, intendedHectares, waterSourceNote, notes } =
      req.body || {};
    if (!province || !townOrArea) {
      res.status(400).json({ error: 'Province and town or target area are required.' });
      return;
    }

    const loc = {
      id: `ploc-${crypto.randomUUID()}`,
      userId: req.authUser!.id,
      province: String(province).trim(),
      district: String(district || '').trim(),
      townOrArea: String(townOrArea).trim(),
      intendedHectares: Math.max(0.1, Number(intendedHectares) || 1),
      waterSourceNote: String(waterSourceNote || 'To be verified on site').trim(),
      notes: String(notes || '').trim(),
      createdAt: new Date().toISOString(),
    };
    store.db.savedProspectiveLocations.unshift(loc);
    store.logAudit(
      req.authUser!.id,
      'PROSPECTIVE_LOCATION_SAVED',
      'SavedProspectiveLocation',
      loc.id,
      { province: loc.province, townOrArea: loc.townOrArea },
      req.ip || '127.0.0.1'
    );
    store.save();
    res.status(201).json(loc);
  });

  app.delete('/api/prospective/locations/:id', requireAuth, (req: AuthRequest, res) => {
    const existing = store.db.savedProspectiveLocations.find((l) => l.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Saved location not found.' });
      return;
    }
    if (existing.userId !== req.authUser!.id) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    store.db.savedProspectiveLocations = store.db.savedProspectiveLocations.filter(
      (l) => l.id !== existing.id
    );
    store.save();
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // Reporting & Data Export Endpoints (PDF / CSV / Organisation Aggregate)
  // ------------------------------------------------------------------
  app.get('/api/reports/types', requireAuth, (req: AuthRequest, res) => {
    if (req.authUser!.roleCode === 'prospective_farmer') {
      res.status(403).json({
        error: 'Farming performance reports are available after registering an active farm.',
      });
      return;
    }
    res.json(REPORT_TYPES);
  });

  app.get('/api/reports/history', requireAuth, (req: AuthRequest, res) => {
    const user = req.authUser!;
    if (user.roleCode === 'prospective_farmer') {
      res.status(403).json({
        error: 'Farming performance reports are available after registering an active farm.',
      });
      return;
    }
    const list = store.db.generatedReports
      .filter((r) => r.userId === user.id)
      .slice(0, 50);
    res.json(list);
  });

  app.post('/api/reports/generate', requireAuth, (req: AuthRequest, res) => {
    const user = req.authUser!;
    if (!user.permissions.includes('reports:generate')) {
      res.status(403).json({ error: 'Your account does not have permission to generate reports.' });
      return;
    }

    const { reportType, farmId, startDate, endDate, farmingCategory, aggregateOrganisation } =
      req.body || {};
    const validType = REPORT_TYPES.some((rt) => rt.code === reportType);
    if (!validType) {
      res.status(400).json({ error: 'Please select a valid report type.' });
      return;
    }

    if (aggregateOrganisation && !user.permissions.includes('reports:organisation_aggregate') && user.roleCode !== 'organisation_manager') {
      res.status(403).json({
        error: 'Organisation aggregated reporting is restricted to authorised organisation accounts.',
      });
      return;
    }

    try {
      let accessibleFarmIds: string[];
      if (user.roleCode === 'organisation_manager') {
        const org = getUserOrganisation(user.id);
        const existingFarmIds = new Set(store.db.farms.map((f) => f.id));
        accessibleFarmIds = org
          ? Array.from(
              new Set(
                store.db.farmAccessGrants
                  .filter(
                    (g) =>
                      g.status === 'active' &&
                      g.granteeType === 'organisation' &&
                      g.organisationId === org.id &&
                      existingFarmIds.has(g.farmId)
                  )
                  .map((g) => g.farmId)
              )
            )
          : [];
      } else {
        accessibleFarmIds = getAccessibleFarmIds(user);
      }
      const result = generateAndSaveReport({
        user,
        accessibleFarmIds,
        reportType: reportType as ReportTypeCode,
        farmId: farmId ? String(farmId) : 'all',
        startDate: startDate ? String(startDate) : '',
        endDate: endDate ? String(endDate) : '',
        farmingCategory: farmingCategory ? String(farmingCategory) : 'all',
        aggregateOrganisation: Boolean(aggregateOrganisation),
        ipAddress: req.ip || '127.0.0.1',
      });
      res.json(result);
    } catch (err: unknown) {
      res.status(403).json({
        error: err instanceof Error ? err.message : 'Unable to generate requested report.',
      });
    }
  });

  // ------------------------------------------------------------------
  // System Administration Portal Endpoints (Exclusively System Admins)
  // ------------------------------------------------------------------
  const PERMISSION_CATALOG = [
    { key: 'profile:read', label: 'View Own Profile', group: 'Account' },
    { key: 'profile:update', label: 'Edit Own Profile & Preferences', group: 'Account' },
    { key: 'farms:create', label: 'Register Farms', group: 'Farm Operations' },
    { key: 'farms:read_own', label: 'View Own Farms', group: 'Farm Operations' },
    { key: 'farms:update_own', label: 'Edit Own Farms', group: 'Farm Operations' },
    { key: 'farms:delete_own', label: 'Delete Own Farms', group: 'Farm Operations' },
    { key: 'fields:manage_own', label: 'Manage Fields & Polygons', group: 'Farm Operations' },
    { key: 'crops:manage_own', label: 'Manage Crops & Stock', group: 'Farm Operations' },
    { key: 'livestock:manage_own', label: 'Manage Livestock & Herds', group: 'Farm Operations' },
    { key: 'mixed:manage_own', label: 'Manage Mixed Farming Entries', group: 'Farm Operations' },
    { key: 'farms:read_regional', label: 'Advisory Read Access (Expert)', group: 'Advisory & Org' },
    { key: 'farms:read_portfolio', label: 'Organisation Member Portfolio Read', group: 'Advisory & Org' },
    { key: 'reports:generate', label: 'Generate Reports', group: 'Reporting' },
    { key: 'reports:export', label: 'Export PDF & CSV Reports', group: 'Reporting' },
    { key: 'reports:organisation_aggregate', label: 'Generate Privacy-Protected Org Aggregates', group: 'Reporting' },
    { key: 'business:plan', label: 'Use Farming Business Planner', group: 'Planning & Learning' },
    { key: 'learning:access', label: 'Access Learning Centre', group: 'Planning & Learning' },
    { key: 'learning:manage', label: 'Author & Publish Learning Content', group: 'Planning & Learning' },
    { key: 'ai:advise', label: 'Use AI Agricultural Advisor', group: 'Planning & Learning' },
    { key: 'admin:portal_access', label: 'Access System Admin Portal', group: 'Administration' },
    { key: 'admin:users_read', label: 'View User Directory', group: 'Administration' },
    { key: 'admin:users_manage', label: 'Activate / Deactivate User Accounts', group: 'Administration' },
    { key: 'admin:roles_assign', label: 'Assign User Roles', group: 'Administration' },
    { key: 'admin:permissions_manage', label: 'Grant & Revoke Granular Permissions', group: 'Administration' },
    { key: 'admin:oversight_aggregated', label: 'View Non-PII Farm Oversight Summaries', group: 'Administration' },
    { key: 'admin:languages_manage', label: 'Manage Languages & UI Translations', group: 'Administration' },
    { key: 'admin:config_manage', label: 'Manage System Configuration & Announcements', group: 'Administration' },
    { key: 'admin:audit_read', label: 'Inspect Security & Audit Logs', group: 'Administration' },
    {
      key: 'admin:private_farmer_records',
      label: 'Scoped Private Farmer Record Inspection (Sensitive — Audited)',
      group: 'Privacy Escalation',
    },
  ];

  app.get(
    '/api/admin/overview',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      res.json(buildAdminPortalOverview(req.authUser!));
    }
  );

  app.get(
    '/api/admin/permissions/catalog',
    requireAuth,
    requireRoles('system_administrator'),
    (_req: AuthRequest, res) => {
      res.json(PERMISSION_CATALOG);
    }
  );

  app.get(
    '/api/admin/users/:id/activity',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const target = store.db.users.find((u) => u.id === req.params.id);
      if (!target) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      const sanitized = sanitizeUser(target);
      const hasPrivatePerm = req.authUser!.permissions.includes('admin:private_farmer_records');
      if (!hasPrivatePerm && sanitized.profile) {
        sanitized.profile = {
          ...sanitized.profile,
          phoneNumber: sanitized.profile.phoneNumber ? '[Protected — Private Farmer Info]' : '',
        };
      }
      const activity = store.db.auditLogs
        .filter((a) => a.actorUserId === target.id || a.entityId === target.id)
        .slice(0, 40);

      res.json({
        user: sanitized,
        ownedFarmCount: store.db.farms.filter((f) => f.ownerId === target.id).length,
        activity,
      });
    }
  );

  app.patch(
    '/api/admin/users/:id/permissions',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      if (!req.authUser!.permissions.includes('admin:permissions_manage')) {
        res.status(403).json({ error: 'Permission denied to modify user permissions.' });
        return;
      }
      const target = store.db.users.find((u) => u.id === req.params.id);
      if (!target) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const { permissionKey, isAllowed } = req.body || {};
      if (!permissionKey || typeof isAllowed !== 'boolean') {
        res.status(400).json({ error: 'permissionKey and boolean isAllowed are required.' });
        return;
      }
      if (!PERMISSION_CATALOG.some((p) => p.key === permissionKey)) {
        res.status(400).json({ error: 'Unknown permission key.' });
        return;
      }

      const now = new Date().toISOString();
      const existing = store.db.userPermissions.find(
        (p) => p.userId === target.id && p.permissionKey === permissionKey
      );
      if (existing) {
        existing.isAllowed = isAllowed;
      } else {
        store.db.userPermissions.push({
          id: `perm-${crypto.randomUUID()}`,
          roleId: target.roleId,
          userId: target.id,
          permissionKey: String(permissionKey),
          isAllowed,
          createdAt: now,
        });
      }

      store.logAudit(
        req.authUser!.id,
        isAllowed ? 'ADMIN_PERMISSION_GRANTED' : 'ADMIN_PERMISSION_REVOKED',
        'UserPermission',
        target.id,
        { targetEmail: target.email, permissionKey, isAllowed },
        req.ip || '127.0.0.1'
      );
      store.save();

      res.json({ user: sanitizeUser(target) });
    }
  );

  app.get(
    '/api/admin/farm-oversight',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const payload = buildAdminFarmOversight(req.authUser!);
      store.logAudit(
        req.authUser!.id,
        'ADMIN_FARM_OVERSIGHT_VIEWED',
        'FarmOversight',
        null,
        { hasPrivateRecordPermission: payload.hasPrivateRecordPermission },
        req.ip || '127.0.0.1'
      );
      res.json(payload);
    }
  );

  app.get(
    '/api/admin/languages',
    requireAuth,
    requireRoles('system_administrator'),
    (_req: AuthRequest, res) => {
      res.json(buildLanguageTranslationAudit());
    }
  );

  app.patch(
    '/api/admin/languages/:code',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const lang = store.db.languages.find((l) => l.code === req.params.code);
      if (!lang) {
        res.status(404).json({ error: 'Language not found.' });
        return;
      }
      const { isActive, hasAudioSupport, hasSignLanguageSupport } = req.body || {};
      if (typeof isActive === 'boolean') {
        if (lang.code === 'en' && !isActive) {
          res.status(400).json({ error: 'English baseline language cannot be deactivated.' });
          return;
        }
        lang.isActive = isActive;
      }
      if (typeof hasAudioSupport === 'boolean') lang.hasAudioSupport = hasAudioSupport;
      if (typeof hasSignLanguageSupport === 'boolean') {
        lang.hasSignLanguageSupport = hasSignLanguageSupport;
      }

      store.logAudit(
        req.authUser!.id,
        'ADMIN_LANGUAGE_UPDATED',
        'Language',
        lang.code,
        {
          isActive: lang.isActive,
          hasAudioSupport: lang.hasAudioSupport,
          hasSignLanguageSupport: lang.hasSignLanguageSupport,
        },
        req.ip || '127.0.0.1'
      );
      store.save();
      res.json(lang);
    }
  );

  app.get(
    '/api/admin/translations/:langCode',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const langCode = req.params.langCode as LanguageCode;
      if (!store.db.languages.some((l) => l.code === langCode)) {
        res.status(404).json({ error: 'Language not found.' });
        return;
      }
      res.json(getTranslationEntriesForLang(langCode));
    }
  );

  app.put(
    '/api/admin/translations/:langCode',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const langCode = req.params.langCode as LanguageCode;
      if (!store.db.languages.some((l) => l.code === langCode)) {
        res.status(404).json({ error: 'Language not found.' });
        return;
      }
      const { key, value, reviewed } = req.body || {};
      if (!key || typeof value !== 'string' || !value.trim()) {
        res.status(400).json({ error: 'Translation key and non-empty value are required.' });
        return;
      }

      const now = new Date().toISOString();
      const existing = store.db.translationOverrides.find(
        (o) => o.languageCode === langCode && o.key === key
      );
      if (existing) {
        existing.value = value.trim();
        existing.reviewed = typeof reviewed === 'boolean' ? reviewed : true;
        existing.updatedByUserId = req.authUser!.id;
        existing.updatedAt = now;
      } else {
        store.db.translationOverrides.push({
          id: `tov-${crypto.randomUUID()}`,
          languageCode: langCode,
          key: String(key),
          value: value.trim(),
          reviewed: typeof reviewed === 'boolean' ? reviewed : true,
          updatedByUserId: req.authUser!.id,
          updatedAt: now,
        });
      }

      store.logAudit(
        req.authUser!.id,
        'ADMIN_TRANSLATION_SAVED',
        'TranslationOverride',
        `${langCode}:${key}`,
        { languageCode: langCode, key },
        req.ip || '127.0.0.1'
      );
      store.save();

      res.json(getTranslationEntriesForLang(langCode));
    }
  );

  app.get(
    '/api/admin/system-config',
    requireAuth,
    requireRoles('system_administrator'),
    (_req: AuthRequest, res) => {
      res.json({
        config: store.db.systemConfig,
        integrations: getExternalIntegrationStatuses(),
        announcements: store.db.systemAnnouncements,
      });
    }
  );

  app.put(
    '/api/admin/system-config',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const { application, notifications, agriculturalReference, ai } = req.body || {};
      const cfg = store.db.systemConfig;

      if (application && typeof application === 'object') {
        if (typeof application.platformName === 'string' && application.platformName.trim()) {
          cfg.application.platformName = application.platformName.trim();
        }
        if (
          application.defaultLanguageCode &&
          store.db.languages.some((l) => l.code === application.defaultLanguageCode)
        ) {
          cfg.application.defaultLanguageCode = application.defaultLanguageCode;
        }
        if (typeof application.allowSelfRegistration === 'boolean') {
          cfg.application.allowSelfRegistration = application.allowSelfRegistration;
        }
        if (typeof application.maintenanceMode === 'boolean') {
          cfg.application.maintenanceMode = application.maintenanceMode;
        }
        if (application.maxMediaUploadMb !== undefined) {
          cfg.application.maxMediaUploadMb = Math.max(1, Math.min(50, Number(application.maxMediaUploadMb) || 15));
        }
        if (application.sessionTimeoutHours !== undefined) {
          cfg.application.sessionTimeoutHours = Math.max(1, Math.min(720, Number(application.sessionTimeoutHours) || 168));
        }
      }

      if (notifications && typeof notifications === 'object') {
        if (typeof notifications.inAppAlertsEnabled === 'boolean') {
          cfg.notifications.inAppAlertsEnabled = notifications.inAppAlertsEnabled;
        }
        if (typeof notifications.emailDigestEnabled === 'boolean') {
          cfg.notifications.emailDigestEnabled = notifications.emailDigestEnabled;
        }
        if (notifications.rainfallAlertThresholdMm !== undefined) {
          cfg.notifications.rainfallAlertThresholdMm = Math.max(5, Number(notifications.rainfallAlertThresholdMm) || 35);
        }
        if (notifications.heatAlertThresholdC !== undefined) {
          cfg.notifications.heatAlertThresholdC = Math.max(25, Number(notifications.heatAlertThresholdC) || 34);
        }
        if (typeof notifications.incidentEscalationNotify === 'boolean') {
          cfg.notifications.incidentEscalationNotify = notifications.incidentEscalationNotify;
        }
      }

      if (agriculturalReference && typeof agriculturalReference === 'object') {
        if (Array.isArray(agriculturalReference.supportedCategories)) {
          cfg.agriculturalReference.supportedCategories = agriculturalReference.supportedCategories
            .map((c: unknown) => String(c).trim())
            .filter(Boolean);
        }
        if (typeof agriculturalReference.defaultExtensionDeskEmail === 'string') {
          cfg.agriculturalReference.defaultExtensionDeskEmail = agriculturalReference.defaultExtensionDeskEmail.trim();
        }
        if (typeof agriculturalReference.soilLabGuidanceNote === 'string') {
          cfg.agriculturalReference.soilLabGuidanceNote = agriculturalReference.soilLabGuidanceNote.trim();
        }
        if (typeof agriculturalReference.valuationDisclaimerText === 'string') {
          cfg.agriculturalReference.valuationDisclaimerText = agriculturalReference.valuationDisclaimerText.trim();
        }
        if (typeof agriculturalReference.diagnosticSafetyNotice === 'string') {
          cfg.agriculturalReference.diagnosticSafetyNotice = agriculturalReference.diagnosticSafetyNotice.trim();
        }
      }

      if (ai && typeof ai === 'object') {
        if (typeof ai.aiEnabled === 'boolean') cfg.ai.aiEnabled = ai.aiEnabled;
        if (typeof ai.primaryModel === 'string' && ai.primaryModel.trim()) {
          cfg.ai.primaryModel = ai.primaryModel.trim();
        }
        if (typeof ai.fallbackModel === 'string' && ai.fallbackModel.trim()) {
          cfg.ai.fallbackModel = ai.fallbackModel.trim();
        }
        if (typeof ai.visualAnalysisEnabled === 'boolean') {
          cfg.ai.visualAnalysisEnabled = ai.visualAnalysisEnabled;
        }
        if (typeof ai.weatherAiSummaryEnabled === 'boolean') {
          cfg.ai.weatherAiSummaryEnabled = ai.weatherAiSummaryEnabled;
        }
        if (typeof ai.advisorySafetyDisclaimer === 'string') {
          cfg.ai.advisorySafetyDisclaimer = ai.advisorySafetyDisclaimer.trim();
        }
      }

      cfg.updatedByUserId = req.authUser!.id;
      cfg.updatedAt = new Date().toISOString();

      store.logAudit(
        req.authUser!.id,
        'ADMIN_SYSTEM_CONFIG_UPDATED',
        'SystemConfig',
        'global',
        { updatedSections: Object.keys(req.body || {}) },
        req.ip || '127.0.0.1'
      );
      store.save();

      res.json({
        config: cfg,
        integrations: getExternalIntegrationStatuses(),
        announcements: store.db.systemAnnouncements,
      });
    }
  );

  app.post(
    '/api/admin/announcements',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const { title, message, targetRole, severity, expiresAt } = req.body || {};
      if (!title || !message) {
        res.status(400).json({ error: 'Announcement title and message are required.' });
        return;
      }

      const ann = {
        id: `ann-${crypto.randomUUID()}`,
        title: String(title).trim(),
        message: String(message).trim(),
        targetRole: targetRole || 'all',
        severity: (['info', 'advisory', 'warning'].includes(severity) ? severity : 'info') as
          | 'info'
          | 'advisory'
          | 'warning',
        isActive: true,
        createdByUserId: req.authUser!.id,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt ? String(expiresAt) : null,
      };
      store.db.systemAnnouncements.unshift(ann);
      store.logAudit(
        req.authUser!.id,
        'ADMIN_ANNOUNCEMENT_CREATED',
        'SystemAnnouncement',
        ann.id,
        { title: ann.title, targetRole: ann.targetRole },
        req.ip || '127.0.0.1'
      );
      store.save();
      res.status(201).json(ann);
    }
  );

  app.patch(
    '/api/admin/announcements/:id',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const ann = store.db.systemAnnouncements.find((a) => a.id === req.params.id);
      if (!ann) {
        res.status(404).json({ error: 'Announcement not found.' });
        return;
      }
      const { isActive, title, message, severity } = req.body || {};
      if (typeof isActive === 'boolean') ann.isActive = isActive;
      if (typeof title === 'string' && title.trim()) ann.title = title.trim();
      if (typeof message === 'string' && message.trim()) ann.message = message.trim();
      if (['info', 'advisory', 'warning'].includes(severity)) ann.severity = severity;

      store.logAudit(
        req.authUser!.id,
        'ADMIN_ANNOUNCEMENT_UPDATED',
        'SystemAnnouncement',
        ann.id,
        { isActive: ann.isActive },
        req.ip || '127.0.0.1'
      );
      store.save();
      res.json(ann);
    }
  );

  app.delete(
    '/api/admin/announcements/:id',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const ann = store.db.systemAnnouncements.find((a) => a.id === req.params.id);
      if (!ann) {
        res.status(404).json({ error: 'Announcement not found.' });
        return;
      }
      store.db.systemAnnouncements = store.db.systemAnnouncements.filter((a) => a.id !== ann.id);
      store.logAudit(
        req.authUser!.id,
        'ADMIN_ANNOUNCEMENT_DELETED',
        'SystemAnnouncement',
        ann.id,
        { title: ann.title },
        req.ip || '127.0.0.1'
      );
      store.save();
      res.json({ ok: true });
    }
  );

  // ------------------------------------------------------------------
  // Public SA Dataset Provenance, Geocoding Search & Admin Demo Reset
  // ------------------------------------------------------------------
  app.get('/api/meta/datasets', (_req, res) => {
    res.json({
      datasets: getPublicDatasetRegistry(),
      disclaimer:
        'Regional weather grids, satellite agroclimatology, and SoilGrids estimates provide decision-support context only and never replace accredited on-farm soil tests or physical inspections.',
    });
  });

  app.get('/api/geocode/search', requireAuth, async (req: AuthRequest, res) => {
    const rawQuery = String(req.query.q || '').trim();
    if (rawQuery.length < 2) {
      res.status(400).json({ error: 'Enter at least 2 characters (address, town, village, or district).' });
      return;
    }

    type GeoCandidate = {
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
    };

    const results: GeoCandidate[] = [];

    // 1. OSM Nominatim South Africa query
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=za&limit=6&q=${encodeURIComponent(
        rawQuery
      )}`;
      const nomRes = await fetch(url, {
        headers: {
          'User-Agent': 'FieldShift-SA-AgriPlatform/1.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (nomRes.ok) {
        const nomData = (await nomRes.json()) as {
          place_id?: number;
          display_name?: string;
          lat?: string;
          lon?: string;
          addresstype?: string;
          type?: string;
          address?: Record<string, string>;
        }[];
        for (const item of nomData || []) {
          const lat = Number(item.lat);
          const lng = Number(item.lon);
          const check = validateSaCoordinates(lat, lng);
          if (!check.valid) continue;
          const addr = item.address || {};
          const placeKind = (item.addresstype || item.type || '').toLowerCase();
          const isBroadAdmin = [
            'state',
            'province',
            'county',
            'municipality',
            'district',
            'region',
            'administrative',
          ].includes(placeKind);
          const town =
            addr.village ||
            addr.town ||
            addr.city ||
            addr.suburb ||
            addr.hamlet ||
            addr.road ||
            rawQuery;
          results.push({
            id: `nom-${item.place_id || Math.random()}`,
            displayName: item.display_name || rawQuery,
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lng.toFixed(6)),
            province: addr.state || '',
            district: addr.county || addr.state_district || '',
            townOrVillage: town,
            precision: isBroadAdmin ? 'approximate_municipality' : 'exact_place',
            source: 'OpenStreetMap Nominatim (ZA)',
            warningMessage: isBroadAdmin
              ? 'This match points to a broad municipal or district centre. Drag or click the map pin onto your actual farm gate or fields before confirming.'
              : null,
          });
        }
      }
    } catch {
      // Fall through cleanly to Open-Meteo and provincial reference matching
    }

    // 2. Open-Meteo South Africa Settlement Geocoding (supplement or fallback)
    if (results.length < 3) {
      try {
        const omUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          rawQuery
        )}&count=5&language=en&format=json&countryCode=ZA`;
        const omRes = await fetch(omUrl, { signal: AbortSignal.timeout(4500) });
        if (omRes.ok) {
          const omJson = (await omRes.json()) as {
            results?: {
              id?: number;
              name?: string;
              latitude?: number;
              longitude?: number;
              admin1?: string;
              admin2?: string;
            }[];
          };
          for (const item of omJson.results || []) {
            if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') continue;
            if (!validateSaCoordinates(item.latitude, item.longitude).valid) continue;
            results.push({
              id: `om-${item.id || Math.random()}`,
              displayName: [item.name, item.admin2, item.admin1, 'South Africa']
                .filter(Boolean)
                .join(', '),
              latitude: Number(item.latitude.toFixed(6)),
              longitude: Number(item.longitude.toFixed(6)),
              province: item.admin1 || '',
              district: item.admin2 || '',
              townOrVillage: item.name || rawQuery,
              precision: 'approximate_municipality',
              source: 'Open-Meteo GeoNames (ZA)',
              warningMessage:
                'Settlement/town centroid matched — refine the pin directly on your farm block before confirming.',
            });
          }
        }
      } catch {
        // Ignore network errors and try local SA directory
      }
    }

    // 3. Deterministic SA Province/District/Local Municipality fallback
    const qLower = rawQuery.toLowerCase();
    for (const prov of SOUTH_AFRICA_PROVINCES) {
      for (const dist of prov.districts) {
        const matchedLocal = dist.localMunicipalities.find((lm) =>
          lm.toLowerCase().includes(qLower)
        );
        if (
          prov.name.toLowerCase().includes(qLower) ||
          dist.name.toLowerCase().includes(qLower) ||
          Boolean(matchedLocal)
        ) {
          results.push({
            id: `sa-ref-${prov.code}-${dist.name}`,
            displayName: `${matchedLocal || dist.name}, ${prov.name} (District Reference)`,
            latitude: dist.center.lat,
            longitude: dist.center.lng,
            province: prov.name,
            district: dist.name,
            townOrVillage: matchedLocal || dist.name.replace(' District', ''),
            precision: 'approximate_municipality',
            source: 'South African Municipal Reference Directory',
            warningMessage:
              'Approximate municipal/district centre only — zoom in and move the map pin onto your exact farm before confirming.',
          });
        }
      }
    }

    res.json({
      query: rawQuery,
      results: results.slice(0, 8),
      disclaimer:
        'Search results help position the map quickly. Always inspect satellite/street imagery and click Confirm This Location only when the pin marks your farm.',
    });
  });

  app.get(
    '/api/admin/entities',
    requireAuth,
    requireRoles('system_administrator'),
    (_req: AuthRequest, res) => {
      res.json(buildAdminEntitiesDirectory());
    }
  );

  app.post(
    '/api/admin/demo-data/reset',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const summary = store.resetDemonstrationData(req.authUser!.id, req.ip || '127.0.0.1');
      res.json({
        ok: true,
        summary,
        message:
          'Demonstration records across all 9 provinces and 9 specialist profiles were cleanly reset while preserving all non-demonstration customer accounts and farms.',
      });
    }
  );

  // ------------------------------------------------------------------
  // Farmer Collaboration & Scoped Access Grants (Experts & Organisations)
  // ------------------------------------------------------------------
  app.get('/api/collaboration/directory', requireAuth, (_req: AuthRequest, res) => {
    res.json(getCollaborationDirectory());
  });

  app.get('/api/consultations', requireAuth, (req: AuthRequest, res) => {
    res.json(listConsultationsForUser(req.authUser!));
  });

  app.post('/api/consultations', requireAuth, (req: AuthRequest, res) => {
    const { farmId, expertUserId, subject, description, urgency } = req.body || {};
    if (!farmId || !expertUserId || !subject || !description) {
      res.status(400).json({ error: 'farmId, expertUserId, subject, and description are required.' });
      return;
    }
    try {
      const created = createConsultationRequest({
        farmerUser: req.authUser!,
        farmId: String(farmId),
        expertUserId: String(expertUserId),
        subject: String(subject),
        description: String(description),
        urgency: ['routine', 'priority', 'urgent'].includes(urgency) ? urgency : 'routine',
      });
      res.status(201).json(created);
    } catch (err: unknown) {
      res.status(403).json({
        error: err instanceof Error ? err.message : 'Unable to create consultation request.',
      });
    }
  });

  app.patch(
    '/api/consultations/:id',
    requireAuth,
    requireRoles('agricultural_expert', 'system_administrator'),
    (req: AuthRequest, res) => {
      const { status, recommendationSummary } = req.body || {};
      const validStatus = ['in_review', 'responded', 'closed'].includes(status)
        ? status
        : 'responded';
      try {
        const updated = respondToConsultation({
          expertUser: req.authUser!,
          consultationId: req.params.id,
          status: validStatus,
          recommendationSummary: String(recommendationSummary || ''),
        });
        res.json(updated);
      } catch (err: unknown) {
        res.status(403).json({
          error: err instanceof Error ? err.message : 'Unable to update consultation request.',
        });
      }
    }
  );

  app.get('/api/collaboration/grants', requireAuth, (req: AuthRequest, res) => {
    const grants = listFarmerAccessGrants(req.authUser!.id);
    const feedback = store.db.expertFeedbacks
      .filter((ef) => {
        const farm = store.db.farms.find((f) => f.id === ef.farmId);
        return farm?.ownerId === req.authUser!.id;
      })
      .map((ef) => {
        const farm = store.db.farms.find((f) => f.id === ef.farmId);
        return { ...ef, farmName: farm?.name || 'Registered Farm' };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ grants, expertFeedback: feedback });
  });

  app.post('/api/collaboration/grants', requireAuth, (req: AuthRequest, res) => {
    const { farmId, granteeType, granteeUserId, organisationId, scopes, authorisedBasis } =
      req.body || {};
    if (!farmId || !['expert', 'organisation'].includes(granteeType)) {
      res.status(400).json({ error: 'farmId and granteeType (expert or organisation) are required.' });
      return;
    }
    try {
      const grant = grantFarmAccess({
        farmerUser: req.authUser!,
        farmId: String(farmId),
        granteeType,
        granteeUserId: granteeUserId ? String(granteeUserId) : null,
        organisationId: organisationId ? String(organisationId) : null,
        scopes: scopes && typeof scopes === 'object' ? scopes : undefined,
        authorisedBasis: authorisedBasis ? String(authorisedBasis) : undefined,
      });
      res.status(201).json(grant);
    } catch (err: unknown) {
      res.status(403).json({
        error: err instanceof Error ? err.message : 'Unable to grant farm access.',
      });
    }
  });

  app.patch('/api/collaboration/grants/:id/revoke', requireAuth, (req: AuthRequest, res) => {
    try {
      const grant = revokeFarmAccessGrant(req.authUser!, req.params.id);
      res.json(grant);
    } catch (err: unknown) {
      res.status(403).json({
        error: err instanceof Error ? err.message : 'Unable to revoke access grant.',
      });
    }
  });

  app.patch('/api/collaboration/feedback/:id/acknowledge', requireAuth, (req: AuthRequest, res) => {
    const fb = store.db.expertFeedbacks.find((f) => f.id === req.params.id);
    if (!fb) {
      res.status(404).json({ error: 'Feedback record not found.' });
      return;
    }
    const farm = store.db.farms.find((f) => f.id === fb.farmId);
    if (farm?.ownerId !== req.authUser!.id && req.authUser!.roleCode !== 'system_administrator') {
      res.status(403).json({ error: 'Only the farm owner can acknowledge expert feedback.' });
      return;
    }
    fb.farmerAcknowledged = true;
    fb.updatedAt = new Date().toISOString();
    store.save();
    res.json(fb);
  });

  // ------------------------------------------------------------------
  // Agricultural Expert Portal Endpoints
  // ------------------------------------------------------------------
  app.get(
    '/api/expert/overview',
    requireAuth,
    requireRoles('agricultural_expert', 'system_administrator'),
    (req: AuthRequest, res) => {
      res.json(buildExpertOverview(req.authUser!));
    }
  );

  app.put(
    '/api/expert/profile',
    requireAuth,
    requireRoles('agricultural_expert', 'system_administrator'),
    (req: AuthRequest, res) => {
      const updated = updateExpertProfile(req.authUser!.id, req.body || {});
      store.logAudit(
        req.authUser!.id,
        'EXPERT_PROFILE_UPDATED',
        'ExpertProfile',
        req.authUser!.id,
        { specialisation: updated.specialisation, yearsExperience: updated.yearsExperience },
        req.ip || '127.0.0.1'
      );
      res.json(updated);
    }
  );

  app.get(
    '/api/expert/farms/:farmId/review',
    requireAuth,
    requireRoles('agricultural_expert', 'system_administrator'),
    (req: AuthRequest, res) => {
      try {
        const review = buildExpertFarmReview(req.authUser!, req.params.farmId);
        store.logAudit(
          req.authUser!.id,
          'EXPERT_FARM_REVIEWED',
          'Farm',
          req.params.farmId,
          { scopes: review.scopes },
          req.ip || '127.0.0.1'
        );
        res.json(review);
      } catch (err: unknown) {
        res.status(403).json({
          error: err instanceof Error ? err.message : 'Access denied to farm review.',
        });
      }
    }
  );

  app.post(
    '/api/expert/feedback',
    requireAuth,
    requireRoles('agricultural_expert', 'system_administrator'),
    (req: AuthRequest, res) => {
      const {
        farmId,
        concernCategory,
        subject,
        assessment,
        recommendations,
        status,
        incidentId,
        cropId,
        livestockGroupId,
        soilReportId,
        aiInsightId,
      } = req.body || {};

      if (!farmId || !subject || !assessment) {
        res.status(400).json({ error: 'farmId, subject, and professional assessment are required.' });
        return;
      }

      const validCats: ExpertConcernCategory[] = [
        'farm_info',
        'crop_concern',
        'soil_info',
        'livestock_concern',
        'ai_review',
        'incident_assistance',
        'general_guidance',
      ];
      const cat: ExpertConcernCategory = validCats.includes(concernCategory)
        ? concernCategory
        : 'general_guidance';
      const validStatus = ['pending_review', 'in_progress', 'completed'].includes(status)
        ? status
        : 'completed';
      const recs = Array.isArray(recommendations)
        ? recommendations.map(String)
        : typeof recommendations === 'string'
        ? recommendations
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      try {
        const created = submitExpertFeedback({
          expertUser: req.authUser!,
          farmId: String(farmId),
          concernCategory: cat,
          subject: String(subject),
          assessment: String(assessment),
          recommendations: recs,
          status: validStatus,
          incidentId: incidentId ? String(incidentId) : null,
          cropId: cropId ? String(cropId) : null,
          livestockGroupId: livestockGroupId ? String(livestockGroupId) : null,
          soilReportId: soilReportId ? String(soilReportId) : null,
          aiInsightId: aiInsightId ? String(aiInsightId) : null,
        });
        res.status(201).json(created);
      } catch (err: unknown) {
        res.status(403).json({
          error: err instanceof Error ? err.message : 'Unable to submit expert feedback.',
        });
      }
    }
  );

  app.patch(
    '/api/expert/feedback/:id',
    requireAuth,
    requireRoles('agricultural_expert', 'system_administrator'),
    (req: AuthRequest, res) => {
      const fb = store.db.expertFeedbacks.find((f) => f.id === req.params.id);
      if (!fb) {
        res.status(404).json({ error: 'Feedback record not found.' });
        return;
      }
      if (fb.expertUserId !== req.authUser!.id && req.authUser!.roleCode !== 'system_administrator') {
        res.status(403).json({ error: 'You can only update your own feedback records.' });
        return;
      }
      const { status, assessment, recommendations } = req.body || {};
      if (['pending_review', 'in_progress', 'completed'].includes(status)) fb.status = status;
      if (typeof assessment === 'string' && assessment.trim()) fb.assessment = assessment.trim();
      if (Array.isArray(recommendations)) {
        fb.recommendations = recommendations.map((r) => String(r).trim()).filter(Boolean);
      }
      fb.updatedAt = new Date().toISOString();
      store.save();
      res.json(fb);
    }
  );

  // ------------------------------------------------------------------
  // Organisation Manager Portal Endpoints (Privacy-Protected Aggregates)
  // ------------------------------------------------------------------
  app.get(
    '/api/organisation/overview',
    requireAuth,
    requireRoles('organisation_manager', 'system_administrator'),
    (req: AuthRequest, res) => {
      res.json(buildOrganisationOverview(req.authUser!));
    }
  );

  app.post(
    '/api/organisation/projects',
    requireAuth,
    requireRoles('organisation_manager', 'system_administrator'),
    (req: AuthRequest, res) => {
      const {
        title,
        programmeCode,
        province,
        focusArea,
        startDate,
        targetEndDate,
        targetFarmsCount,
        targetHectares,
        budgetAllocatedZar,
        summary,
      } = req.body || {};
      if (!title || !focusArea) {
        res.status(400).json({ error: 'Project title and focus area are required.' });
        return;
      }
      try {
        const created = createOrganisationProject({
          actorUser: req.authUser!,
          title: String(title),
          programmeCode: String(programmeCode || ''),
          province: String(province || ''),
          focusArea: String(focusArea),
          startDate: String(startDate || ''),
          targetEndDate: String(targetEndDate || ''),
          targetFarmsCount: Number(targetFarmsCount) || 10,
          targetHectares: Number(targetHectares) || 50,
          budgetAllocatedZar: Number(budgetAllocatedZar) || 0,
          summary: String(summary || ''),
        });
        res.status(201).json(created);
      } catch (err: unknown) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Unable to create project.',
        });
      }
    }
  );

  app.post(
    '/api/organisation/activities',
    requireAuth,
    requireRoles('organisation_manager', 'system_administrator'),
    (req: AuthRequest, res) => {
      const {
        projectId,
        title,
        activityType,
        activityDate,
        province,
        district,
        participantsCount,
        farmsReachedCount,
        costZar,
        facilitatorName,
        outcomesSummary,
      } = req.body || {};
      if (!title) {
        res.status(400).json({ error: 'Activity title is required.' });
        return;
      }
      const validTypes = [
        'training_workshop',
        'field_day',
        'soil_sampling_drive',
        'vaccination_campaign',
        'input_distribution',
        'advisory_visit',
      ];
      try {
        const created = createOrganisationProgrammeActivity({
          actorUser: req.authUser!,
          projectId: projectId ? String(projectId) : null,
          title: String(title),
          activityType: validTypes.includes(activityType) ? activityType : 'training_workshop',
          activityDate: String(activityDate || ''),
          province: String(province || ''),
          district: String(district || ''),
          participantsCount: Number(participantsCount) || 0,
          farmsReachedCount: Number(farmsReachedCount) || 0,
          costZar: Number(costZar) || 0,
          facilitatorName: String(facilitatorName || ''),
          outcomesSummary: String(outcomesSummary || ''),
        });
        res.status(201).json(created);
      } catch (err: unknown) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Unable to log programme activity.',
        });
      }
    }
  );

  app.post(
    '/api/organisation/specialists',
    requireAuth,
    requireRoles('organisation_manager', 'system_administrator'),
    (req: AuthRequest, res) => {
      const { projectId, expertUserId, assignedRegion } = req.body || {};
      if (!expertUserId) {
        res.status(400).json({ error: 'expertUserId is required.' });
        return;
      }
      try {
        const assigned = assignOrganisationSpecialist({
          actorUser: req.authUser!,
          projectId: projectId ? String(projectId) : null,
          expertUserId: String(expertUserId),
          assignedRegion: String(assignedRegion || ''),
        });
        res.status(201).json(assigned);
      } catch (err: unknown) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Unable to assign specialist.',
        });
      }
    }
  );

  app.post(
    '/api/organisation/register',
    requireAuth,
    requireRoles('organisation_manager', 'system_administrator'),
    (req: AuthRequest, res) => {
      const { name, organisationType, registrationNumber, province, district, primaryFocus, contactEmail, contactPhone, description } =
        req.body || {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Organisation name is required.' });
        return;
      }
      const validTypes: OrganisationType[] = [
        'cooperative',
        'agricultural_company',
        'extension_agency',
        'research_body',
      ];
      const org = registerOrUpdateOrganisation({
        user: req.authUser!,
        name,
        organisationType: validTypes.includes(organisationType) ? organisationType : 'cooperative',
        registrationNumber,
        province,
        district,
        primaryFocus,
        contactEmail,
        contactPhone,
        description,
      });
      res.json(org);
    }
  );

  app.put(
    '/api/organisation/profile',
    requireAuth,
    requireRoles('organisation_manager', 'system_administrator'),
    (req: AuthRequest, res) => {
      const { name, organisationType, registrationNumber, province, district, primaryFocus, contactEmail, contactPhone, description } =
        req.body || {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Organisation name is required.' });
        return;
      }
      const validTypes: OrganisationType[] = [
        'cooperative',
        'agricultural_company',
        'extension_agency',
        'research_body',
      ];
      const org = registerOrUpdateOrganisation({
        user: req.authUser!,
        name,
        organisationType: validTypes.includes(organisationType) ? organisationType : 'cooperative',
        registrationNumber,
        province,
        district,
        primaryFocus,
        contactEmail,
        contactPhone,
        description,
      });
      res.json(org);
    }
  );

  app.get(
    '/api/organisation/users',
    requireAuth,
    requireRoles('organisation_manager', 'system_administrator'),
    (req: AuthRequest, res) => {
      const org = getUserOrganisation(req.authUser!.id);
      if (!org) {
        res.json([]);
        return;
      }
      res.json(getOrganisationMembersView(org.id));
    }
  );

  app.post(
    '/api/organisation/users',
    requireAuth,
    requireRoles('organisation_manager', 'system_administrator'),
    (req: AuthRequest, res) => {
      const org = getUserOrganisation(req.authUser!.id);
      if (!org) {
        res.status(400).json({ error: 'Please register your organisation profile first.' });
        return;
      }
      const { fullName, email, orgRole, tempPassword } = req.body || {};
      if (!fullName || !email || !validateEmail(String(email))) {
        res.status(400).json({ error: 'Valid member full name and email are required.' });
        return;
      }
      const validRoles: OrganisationMemberRole[] = ['owner', 'manager', 'analyst', 'advisor'];
      const resolvedRole: OrganisationMemberRole = validRoles.includes(orgRole)
        ? orgRole
        : 'analyst';
      try {
        const mem = addOrganisationMember({
          actorUser: req.authUser!,
          orgId: org.id,
          fullName: String(fullName),
          email: String(email),
          orgRole: resolvedRole,
          tempPassword: tempPassword ? String(tempPassword) : undefined,
        });
        res.status(201).json({ membership: mem, members: getOrganisationMembersView(org.id) });
      } catch (err: unknown) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Unable to add organisation user.',
        });
      }
    }
  );

  app.patch(
    '/api/organisation/users/:membershipId',
    requireAuth,
    requireRoles('organisation_manager', 'system_administrator'),
    (req: AuthRequest, res) => {
      const org = getUserOrganisation(req.authUser!.id);
      if (!org) {
        res.status(404).json({ error: 'Organisation not found.' });
        return;
      }
      const mem = store.db.organisationMemberships.find(
        (m) => m.id === req.params.membershipId && m.organisationId === org.id
      );
      if (!mem) {
        res.status(404).json({ error: 'Organisation member not found.' });
        return;
      }
      const { orgRole, status } = req.body || {};
      if (['owner', 'manager', 'analyst', 'advisor'].includes(orgRole)) {
        mem.orgRole = orgRole;
      }
      if (['active', 'inactive'].includes(status)) {
        if (mem.userId === req.authUser!.id && status === 'inactive') {
          res.status(400).json({ error: 'You cannot deactivate your own membership.' });
          return;
        }
        mem.status = status;
      }
      store.save();
      res.json({ membership: mem, members: getOrganisationMembersView(org.id) });
    }
  );

  app.post(
    '/api/organisation/communications',
    requireAuth,
    requireRoles('organisation_manager', 'system_administrator'),
    (req: AuthRequest, res) => {
      const { title, message, targetAudience, priority } = req.body || {};
      if (!title || !message) {
        res.status(400).json({ error: 'Communication title and message are required.' });
        return;
      }
      const audience = ['authorised_farmers', 'org_members', 'all_connected'].includes(targetAudience)
        ? targetAudience
        : 'all_connected';
      const result = broadcastOrganisationCommunication({
        actorUser: req.authUser!,
        title: String(title),
        message: String(message),
        targetAudience: audience,
        priority: priority === 'high' ? 'high' : 'normal',
      });
      res.status(201).json(result);
    }
  );

  // ------------------------------------------------------------------
  // POPIA Privacy, Retention, Data Export & Account Erasure
  // ------------------------------------------------------------------
  app.get('/api/privacy/summary', requireAuth, (req: AuthRequest, res) => {
    res.json(buildPrivacySummary(req.authUser!));
  });

  app.get('/api/privacy/export', requireAuth, (req: AuthRequest, res) => {
    try {
      const bundle = exportUserPersonalData(req.authUser!.id);
      store.logAudit(
        req.authUser!.id,
        'POPIA_PERSONAL_DATA_EXPORTED',
        'User',
        req.authUser!.id,
        { farmsExported: bundle.farms.length },
        req.ip || '127.0.0.1'
      );
      res.json(bundle);
    } catch (err: unknown) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Unable to export personal data.' });
    }
  });

  app.post('/api/privacy/erase-account', requireAuth, (req: AuthRequest, res) => {
    const { currentPassword, confirmPhrase } = req.body || {};
    if (confirmPhrase !== 'ERASE MY ACCOUNT') {
      res.status(400).json({ error: 'Please type "ERASE MY ACCOUNT" to confirm permanent deletion.' });
      return;
    }
    try {
      const result = eraseUserAccountPopia({
        userId: req.authUser!.id,
        password: String(currentPassword || ''),
        ipAddress: req.ip || '127.0.0.1',
      });
      clearSessionCookie(res);
      res.json({
        ok: true,
        message: 'Your personal data, sessions, sharing grants, and owned farm records have been erased in compliance with POPIA.',
        ...result,
      });
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to erase account.',
      });
    }
  });

  app.post(
    '/api/admin/privacy/purge-expired',
    requireAuth,
    requireRoles('system_administrator'),
    (req: AuthRequest, res) => {
      const result = purgeExpiredArtifacts(req.authUser!.id);
      res.json(result);
    }
  );

  // ------------------------------------------------------------------
  // Offline Rural Connectivity & Synchronisation Endpoints
  // ------------------------------------------------------------------
  app.get('/api/offline/bundle', requireAuth, (req: AuthRequest, res) => {
    try {
      const accessibleFarmIds = getAccessibleFarmIds(req.authUser!, 'overview');
      const requestedRaw = req.query.farmIds ? String(req.query.farmIds) : '';
      const requestedFarmIds = requestedRaw
        ? requestedRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      const bundle = buildOfflineBundle({
        user: req.authUser!,
        accessibleFarmIds,
        requestedFarmIds,
      });
      res.json(bundle);
    } catch (err: unknown) {
      res.status(403).json({
        error: err instanceof Error ? err.message : 'Unable to package offline farm bundle.',
      });
    }
  });

  app.post('/api/offline/sync', requireAuth, (req: AuthRequest, res) => {
    if (req.authUser!.roleCode === 'organisation_manager') {
      res.status(403).json({
        error: 'Organisation accounts cannot push offline farm mutations.',
      });
      return;
    }
    const { mutations } = req.body || {};
    if (!Array.isArray(mutations)) {
      res.status(400).json({ error: 'mutations array is required.' });
      return;
    }
    if (mutations.length > 100) {
      res.status(400).json({ error: 'Maximum 100 offline records may be synchronised per batch.' });
      return;
    }
    const result = processOfflineSyncBatch({
      user: req.authUser!,
      canModifyFarm: userCanModifyFarm,
      mutations,
      ipAddress: req.ip || '127.0.0.1',
    });
    res.json(result);
  });

  // ------------------------------------------------------------------
  // Frontend Serving (Vite Dev Middleware or Production Static Dist)
  // ------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const hmrEnabled = process.env.ENABLE_HMR === 'true' && process.env.DISABLE_HMR !== 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrEnabled,
        ws: hmrEnabled ? undefined : (false as const),
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Field Shift server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
