import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import {
  AuthRequest,
  clearSessionCookie,
  createSessionForUser,
  extractSessionToken,
  requireAuth,
  requireRoles,
  sanitizeUser,
  setSessionCookie,
  validateEmail,
  validatePasswordStrength,
} from './src/server/auth.ts';
import { generateAgriculturalAdvice, generateFarmAiAnalytics } from './src/server/gemini.ts';
import { addIncidentFollowUp, buildIncidentDashboard, createFarmIncident } from './src/server/incidents.ts';
import { getFarmSoilAndLandIntelligence } from './src/server/soilLandIntelligence.ts';
import { buildStockOverview, recordCropStockMovement, updateStockUnitPrice } from './src/server/stockInventory.ts';
import { enrichVisualAnalysis, runVisualAgriculturalAnalysis } from './src/server/visualAnalysis.ts';
import { getFarmWeatherIntelligence } from './src/server/weather.ts';
import {
  BEGINNER_GUIDES,
  FARMING_OPPORTUNITIES,
  SOUTH_AFRICA_PROVINCES,
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
  CropActivityType,
  CropGrowthStage,
  CropStockMovementType,
  GeoJsonPolygon,
  IncidentStatus,
  IncidentType,
  LanguageCode,
  LivestockAnimalType,
  LivestockHealthStatus,
  LivestockRecordType,
  LocationSource,
  MixedEntryCategory,
  RoleCode,
  VisualAnalysisCategory,
} from './src/server/types.ts';

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

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

  // ------------------------------------------------------------------
  // Authentication & Session Architecture
  // ------------------------------------------------------------------
  app.post('/api/auth/register', (req, res) => {
    const { fullName, email, password, roleCode, preferredLanguageCode } = req.body || {};

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
    store.db.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      userId,
      title: 'Welcome to Field Shift',
      message: `Your account is created. Activation code: ${activationCode}. Complete your profile to unlock personalised guidance.`,
      category: 'system',
      isRead: false,
      actionUrl: '/profile',
      createdAt: now,
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

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = store.db.users.find((u) => u.email === normalizedEmail);
    if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
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

    res.json({ user: sanitizeUser(user), message: 'Account activated successfully.' });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
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

    res.json({
      ok: true,
      message: 'Password reset code generated (valid for 30 minutes).',
      previewResetCode: rawResetToken,
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
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
  function userCanAccessFarm(user: NonNullable<AuthRequest['authUser']>, farmId: string): boolean {
    const farm = store.db.farms.find((f) => f.id === farmId);
    if (!farm) return false;
    if (farm.ownerId === user.id) return true;
    return ['system_administrator', 'agricultural_expert', 'organisation_manager'].includes(
      user.roleCode
    );
  }

  function userCanModifyFarm(user: NonNullable<AuthRequest['authUser']>, farmId: string): boolean {
    const farm = store.db.farms.find((f) => f.id === farmId);
    if (!farm) return false;
    return farm.ownerId === user.id || user.roleCode === 'system_administrator';
  }

  function getAccessibleFarmIds(user: NonNullable<AuthRequest['authUser']>): string[] {
    const canViewAll = ['system_administrator', 'agricultural_expert', 'organisation_manager'].includes(
      user.roleCode
    );
    return store.db.farms
      .filter((f) => canViewAll || f.ownerId === user.id)
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

    const now = new Date().toISOString();
    const farmId = `farm-${crypto.randomUUID()}`;
    const sizeHa = Math.max(0.1, Number(farmSizeHectares) || 1);
    const lat = Number(latitude) || -28.4793;
    const lng = Number(longitude) || 24.6727;
    const validSource: LocationSource = ['gps', 'manual_map_pin', 'municipal_center'].includes(
      locationSource
    )
      ? locationSource
      : 'municipal_center';

    store.db.farms.push({
      id: farmId,
      ownerId: user.id,
      name: String(farmName).trim(),
      farmingActivities: Array.isArray(farmingActivities) ? farmingActivities : [],
      farmSizeHectares: sizeHa,
      yearsOfExperience: Number(yearsOfExperience) || 0,
      waterAvailability: String(waterAvailability || 'Rain-fed'),
      existingCrops: Array.isArray(existingCrops) ? existingCrops : [],
      existingLivestock: Array.isArray(existingLivestock) ? existingLivestock : [],
      status: 'active',
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
      latitude: lat,
      longitude: lng,
      locationSource: validSource,
      gpsLatitude: typeof gpsLatitude === 'number' ? gpsLatitude : null,
      gpsLongitude: typeof gpsLongitude === 'number' ? gpsLongitude : null,
      gpsAccuracyMeters: typeof gpsAccuracyMeters === 'number' ? gpsAccuracyMeters : null,
      gpsCapturedAt: typeof gpsCapturedAt === 'string' ? gpsCapturedAt : null,
      centroidWkt: pointToWkt(lat, lng),
      elevationMeters: 950,
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
    const ids = getAccessibleFarmIds(req.authUser!);
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
      } = req.body || {};

      if (!name || !province || !districtMunicipality || !localMunicipality || !townOrVillage) {
        res.status(400).json({ error: 'All farm name and location fields are required.' });
        return;
      }

      const now = new Date().toISOString();
      const farmId = `farm-${crypto.randomUUID()}`;
      const sizeHa = Math.max(0.1, Number(farmSizeHectares) || 1);
      const lat = Number(latitude) || -28.4793;
      const lng = Number(longitude) || 24.6727;
      const validSource: LocationSource = ['gps', 'manual_map_pin', 'municipal_center'].includes(
        locationSource
      )
        ? locationSource
        : 'municipal_center';

      store.db.farms.push({
        id: farmId,
        ownerId: req.authUser!.id,
        name: String(name).trim(),
        farmingActivities: Array.isArray(farmingActivities) ? farmingActivities : [],
        farmSizeHectares: sizeHa,
        yearsOfExperience: Number(yearsOfExperience) || 0,
        waterAvailability: String(waterAvailability || 'Borehole'),
        existingCrops: Array.isArray(existingCrops) ? existingCrops : [],
        existingLivestock: Array.isArray(existingLivestock) ? existingLivestock : [],
        status: 'active',
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
        latitude: lat,
        longitude: lng,
        locationSource: validSource,
        gpsLatitude: typeof gpsLatitude === 'number' ? gpsLatitude : null,
        gpsLongitude: typeof gpsLongitude === 'number' ? gpsLongitude : null,
        gpsAccuracyMeters: typeof gpsAccuracyMeters === 'number' ? gpsAccuracyMeters : null,
        gpsCapturedAt: typeof gpsCapturedAt === 'string' ? gpsCapturedAt : null,
        centroidWkt: pointToWkt(lat, lng),
        elevationMeters: 920,
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
    if (!userCanAccessFarm(req.authUser!, req.params.id)) {
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
      latitude,
      longitude,
      locationSource,
      gpsLatitude,
      gpsLongitude,
      gpsAccuracyMeters,
      gpsCapturedAt,
      boundaryGeojson,
    } = req.body || {};

    if (typeof name === 'string' && name.trim()) farm.name = name.trim();
    if (farmSizeHectares !== undefined) farm.farmSizeHectares = Math.max(0.1, Number(farmSizeHectares));
    if (yearsOfExperience !== undefined) farm.yearsOfExperience = Number(yearsOfExperience) || 0;
    if (typeof waterAvailability === 'string' && waterAvailability.trim()) {
      farm.waterAvailability = waterAvailability.trim();
    }
    if (Array.isArray(farmingActivities)) farm.farmingActivities = farmingActivities;
    if (Array.isArray(existingCrops)) farm.existingCrops = existingCrops;
    if (Array.isArray(existingLivestock)) farm.existingLivestock = existingLivestock;
    farm.updatedAt = new Date().toISOString();

    const loc = store.db.farmLocations.find((l) => l.farmId === farm.id);
    if (loc) {
      if (province) loc.province = String(province);
      if (districtMunicipality) loc.districtMunicipality = String(districtMunicipality);
      if (localMunicipality) loc.localMunicipality = String(localMunicipality);
      if (townOrVillage) loc.townOrVillage = String(townOrVillage);
      if (latitude !== undefined) loc.latitude = Number(latitude);
      if (longitude !== undefined) loc.longitude = Number(longitude);
      if (locationSource && ['gps', 'manual_map_pin', 'municipal_center'].includes(locationSource)) {
        loc.locationSource = locationSource;
      }
      if (typeof gpsLatitude === 'number') loc.gpsLatitude = gpsLatitude;
      if (typeof gpsLongitude === 'number') loc.gpsLongitude = gpsLongitude;
      if (typeof gpsAccuracyMeters === 'number') loc.gpsAccuracyMeters = gpsAccuracyMeters;
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
      if (typeof latitude === 'number') loc.latitude = latitude;
      if (typeof longitude === 'number') loc.longitude = longitude;
      if (locationSource && ['gps', 'manual_map_pin', 'municipal_center'].includes(locationSource)) {
        loc.locationSource = locationSource;
      }
      if (typeof gpsLatitude === 'number') loc.gpsLatitude = gpsLatitude;
      if (typeof gpsLongitude === 'number') loc.gpsLongitude = gpsLongitude;
      if (typeof gpsAccuracyMeters === 'number') loc.gpsAccuracyMeters = gpsAccuracyMeters;
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
      soilType: String(soilType || 'Loam'),
      irrigationType: String(irrigationType || 'Rain-fed'),
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

    const { name, cropOrLivestock, areaHectares, soilType, irrigationType, status, notes, geojson } =
      req.body || {};
    if (name) field.name = String(name).trim();
    if (cropOrLivestock) field.cropOrLivestock = String(cropOrLivestock).trim();
    if (isValidPolygon(geojson)) {
      field.geojson = geojson;
      field.fieldWkt = polygonToWkt(geojson);
      field.areaHectares = calculatePolygonAreaHectares(geojson);
    } else if (areaHectares !== undefined) {
      field.areaHectares = Math.max(0.1, Number(areaHectares));
    }
    if (soilType) field.soilType = String(soilType);
    if (irrigationType) field.irrigationType = String(irrigationType);
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
    const accessibleFarmIds = getAccessibleFarmIds(req.authUser!);
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    const crops = store.db.crops.filter(
      (c) => accessibleFarmIds.includes(c.farmId) && (!farmFilter || c.farmId === farmFilter)
    );
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
      crops.reduce((s, c) => s + c.estimatedValueZar, 0).toFixed(2)
    );

    const byCrop = crops.map((c) => ({
      id: c.id,
      cropName: c.cropName,
      cropVariety: c.cropVariety,
      cultivatedAreaHectares: c.cultivatedAreaHectares,
      harvestedQuantityKg: c.harvestedQuantityKg,
      estimatedValueZar: c.estimatedValueZar,
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
        entry.valueZar += act.valueZar;
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
    const accessibleFarmIds = getAccessibleFarmIds(req.authUser!);
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
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
      store.db.cropStockMovements.unshift({
        id: `csm-${crypto.randomUUID()}`,
        cropId: newCrop.id,
        farmId: newCrop.farmId,
        actorUserId: req.authUser!.id,
        movementType: 'planting',
        movementDate: newCrop.plantingDate,
        quantityDelta: newCrop.plantingQuantity,
        unit: 'plants',
        unitPriceZar: 0,
        totalValueZar: 0,
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
    if (plantingQuantity !== undefined) crop.plantingQuantity = Math.max(0, Number(plantingQuantity));
    if (damagedPlants !== undefined) crop.damagedPlants = Math.max(0, Number(damagedPlants));
    if (cultivatedAreaHectares !== undefined) {
      crop.cultivatedAreaHectares = Math.max(0.05, Number(cultivatedAreaHectares));
    }
    if (soilInformation !== undefined) crop.soilInformation = String(soilInformation);
    if (irrigationMethod !== undefined) crop.irrigationMethod = String(irrigationMethod);
    if (fertiliserInformation !== undefined) crop.fertiliserInformation = String(fertiliserInformation);
    if (expectedHarvestingDate) crop.expectedHarvestingDate = String(expectedHarvestingDate);
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
      crop.harvestedQuantityKg = Math.max(0, Number(harvestedQuantityKg));
    }
    if (estimatedValueZar !== undefined) {
      crop.estimatedValueZar = Math.max(0, Number(estimatedValueZar));
    }
    crop.updatedAt = now;

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
    if (!userCanAccessFarm(req.authUser!, crop.farmId)) {
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
    const accessibleFarmIds = getAccessibleFarmIds(req.authUser!);
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
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
        valueZar: matched.reduce((s, g) => s + g.quantity * g.estimatedUnitValueZar, 0),
      };
    });

    const totalAnimals = groups.reduce((s, g) => s + g.quantity, 0);
    const estimatedLivestockValueZar = Number(
      groups.reduce((s, g) => s + g.quantity * g.estimatedUnitValueZar, 0).toFixed(2)
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
    const accessibleFarmIds = getAccessibleFarmIds(req.authUser!);
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    const list = store.db.livestockGroups
      .filter(
        (g) => accessibleFarmIds.includes(g.farmId) && (!farmFilter || g.farmId === farmFilter)
      )
      .map((g) => {
        const farm = store.db.farms.find((f) => f.id === g.farmId);
        const field = store.db.fields.find((fl) => fl.id === g.fieldId);
        const records = store.db.livestockRecords.filter((r) => r.livestockGroupId === g.id);
        return {
          ...g,
          farmName: farm?.name || 'Farm',
          fieldName: field?.name || null,
          totalValueZar: Number((g.quantity * g.estimatedUnitValueZar).toFixed(2)),
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
    if (quantity !== undefined) group.quantity = Math.max(0, Number(quantity));
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
      group.estimatedUnitValueZar = Math.max(0, Number(estimatedUnitValueZar));
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
    if (!userCanAccessFarm(req.authUser!, group.farmId)) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }
    res.json(store.db.livestockRecords.filter((r) => r.livestockGroupId === group.id));
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
    const accessibleFarmIds = getAccessibleFarmIds(req.authUser!);
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    const targetIds = farmFilter
      ? accessibleFarmIds.filter((id) => id === farmFilter)
      : accessibleFarmIds;

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

    const cropValueZar = Number(crops.reduce((s, c) => s + c.estimatedValueZar, 0).toFixed(2));
    const livestockValueZar = Number(
      livestock.reduce((s, g) => s + g.quantity * g.estimatedUnitValueZar, 0).toFixed(2)
    );
    const combinedExpensesZar = Number(
      entries.reduce((s, e) => s + e.expenseZar, 0).toFixed(2)
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
    const accessibleFarmIds = getAccessibleFarmIds(req.authUser!);
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    const entries = store.db.mixedFarmingEntries
      .filter(
        (e) => accessibleFarmIds.includes(e.farmId) && (!farmFilter || e.farmId === farmFilter)
      )
      .map((e) => {
        const farm = store.db.farms.find((f) => f.id === e.farmId);
        return { ...e, farmName: farm?.name || 'Farm' };
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
  // Notifications
  // ------------------------------------------------------------------
  app.get('/api/notifications', requireAuth, (req: AuthRequest, res) => {
    const items = store.db.notifications.filter((n) => n.userId === req.authUser!.id);
    res.json(items);
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
    if (!userCanAccessFarm(req.authUser!, farmId)) {
      res.status(403).json({ error: 'You do not have access to this farm.' });
      return;
    }
    try {
      const selectedFarmingType = req.query.farmingType ? String(req.query.farmingType) : undefined;
      const payload = await getFarmSoilAndLandIntelligence(farmId, selectedFarmingType);
      res.json(payload);
    } catch (err: unknown) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Unable to load soil intelligence.' });
    }
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
  // Location-Specific Agricultural Weather Intelligence
  // ------------------------------------------------------------------
  app.get('/api/weather/farms/:farmId', requireAuth, async (req: AuthRequest, res) => {
    const { farmId } = req.params;
    if (!userCanAccessFarm(req.authUser!, farmId)) {
      res.status(403).json({ error: 'You do not have access to this farm.' });
      return;
    }
    try {
      const payload = await getFarmWeatherIntelligence(farmId);
      res.json(payload);
    } catch (err: unknown) {
      res.status(404).json({
        error: err instanceof Error ? err.message : 'Unable to retrieve weather telemetry.',
      });
    }
  });

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
      res.status(500).json({ error: msg });
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
      res.status(500).json({ error: msg });
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
    const accessibleFarmIds = getAccessibleFarmIds(req.authUser!);
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

    if (!farmId || !userCanAccessFarm(req.authUser!, String(farmId))) {
      res.status(403).json({ error: 'Please select a valid farm you can access.' });
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

    const validFrames = frames
      .slice(0, 4)
      .filter((f) => f && typeof f.dataBase64 === 'string' && f.dataBase64.length > 20)
      .map((f) => ({
        mimeType: typeof f.mimeType === 'string' && f.mimeType ? f.mimeType : 'image/jpeg',
        dataBase64: String(f.dataBase64),
      }));

    if (validFrames.length === 0) {
      res.status(400).json({ error: 'Uploaded media could not be decoded. Please try a JPEG or PNG image.' });
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
        mediaPreviewDataUrl:
          typeof mediaPreviewDataUrl === 'string' && mediaPreviewDataUrl.startsWith('data:image/')
            ? mediaPreviewDataUrl
            : `data:${validFrames[0].mimeType};base64,${validFrames[0].dataBase64.replace(/^data:[^;]+;base64,/, '')}`,
        userQuestion: typeof userQuestion === 'string' ? userQuestion : '',
        languageCode: targetLang,
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
    const accessibleFarmIds = getAccessibleFarmIds(req.authUser!);
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    if (farmFilter && !accessibleFarmIds.includes(farmFilter)) {
      res.status(403).json({ error: 'You do not have access to this farm.' });
      return;
    }
    res.json(buildStockOverview(accessibleFarmIds, farmFilter));
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
    if (!Number.isFinite(qty) || qty <= 0) {
      res.status(400).json({ error: 'Please provide a positive quantity.' });
      return;
    }

    const movement = recordCropStockMovement({
      crop,
      actorUserId: req.authUser!.id,
      movementType,
      movementDate: String(movementDate || new Date().toISOString().slice(0, 10)),
      quantity: qty,
      unit: String(unit || (movementType === 'damage' || movementType === 'planting' ? 'plants' : 'kg')),
      unitPriceZar: unitPriceZar !== undefined ? Number(unitPriceZar) : undefined,
      notes: String(notes || `Stock movement (${movementType})`),
    });

    store.logAudit(
      req.authUser!.id,
      'CROP_STOCK_MOVEMENT',
      'CropStockMovement',
      movement.id,
      { cropId: crop.id, movementType, quantityDelta: movement.quantityDelta, totalValueZar: movement.totalValueZar },
      req.ip || '127.0.0.1'
    );
    store.save();

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

    const updated = updateStockUnitPrice({
      user: req.authUser!,
      farmId: String(farmId),
      entityType,
      entityId: String(entityId),
      unitPriceZar: Number(unitPriceZar) || 0,
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
    const accessibleFarmIds = getAccessibleFarmIds(req.authUser!);
    const farmFilter = req.query.farmId ? String(req.query.farmId) : null;
    if (farmFilter && !accessibleFarmIds.includes(farmFilter)) {
      res.status(403).json({ error: 'You do not have access to this farm.' });
      return;
    }
    res.json(buildIncidentDashboard(accessibleFarmIds, farmFilter));
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
      mediaPreviewDataUrl: typeof mediaPreviewDataUrl === 'string' ? mediaPreviewDataUrl : null,
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
    });

    store.save();
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
      followUpDate: String(followUpDate || new Date().toISOString().slice(0, 10)),
      statusAfter: validStatus,
      actionTaken: actionTaken.trim(),
      notes: String(notes || '').trim(),
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
      { previousStatus: prev, newStatus: status },
      req.ip || '127.0.0.1'
    );
    store.save();
    res.json(incident);
  });

  // ------------------------------------------------------------------
  // Frontend Serving (Vite Dev Middleware or Production Static Dist)
  // ------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
