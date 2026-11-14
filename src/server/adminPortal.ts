import { BASE_EN_UI_KEYS, DEFAULT_UI_TRANSLATIONS } from './translationCatalog.ts';
import { SOUTH_AFRICA_PROVINCES } from './southAfricaData.ts';
import { store } from './store.ts';
import { LanguageCode, SanitizedUser } from './types.ts';

export function buildAdminPortalOverview(adminUser: SanitizedUser) {
  const users = store.db.users;
  const roles = store.db.roles;
  const farms = store.db.farms;
  const incidents = store.db.farmIncidents;

  const roleIdByCode = new Map(roles.map((r) => [r.code, r.id]));

  const demoUsers = users.filter((u) => Boolean(u.isDemonstration));
  const realUsers = users.filter((u) => !u.isDemonstration);
  const demoFarms = farms.filter((f) => Boolean(f.isDemonstration));
  const realFarms = farms.filter((f) => !f.isDemonstration);

  const stats = {
    totalUsers: users.length,
    demonstrationUsers: demoUsers.length,
    realUsers: realUsers.length,
    activeUsers: users.filter((u) => u.isActive).length,
    inactiveUsers: users.filter((u) => !u.isActive).length,
    prospectiveFarmers: users.filter((u) => u.roleId === roleIdByCode.get('prospective_farmer')).length,
    existingFarmers: users.filter((u) => u.roleId === roleIdByCode.get('existing_farmer')).length,
    agriculturalExperts: users.filter((u) => u.roleId === roleIdByCode.get('agricultural_expert')).length,
    registeredOrganisations: users.filter((u) => u.roleId === roleIdByCode.get('organisation_manager')).length,
    systemAdministrators: users.filter((u) => u.roleId === roleIdByCode.get('system_administrator')).length,
    totalRegisteredFarms: farms.length,
    demonstrationFarms: demoFarms.length,
    realFarms: realFarms.length,
    totalHectares: Number(farms.reduce((s, f) => s + f.farmSizeHectares, 0).toFixed(2)),
    totalIncidentsReported: incidents.length,
  };

  const provMap = new Map<string, { farmCount: number; totalHectares: number; incidentCount: number }>();
  for (const p of SOUTH_AFRICA_PROVINCES) {
    provMap.set(p.name, { farmCount: 0, totalHectares: 0, incidentCount: 0 });
  }
  for (const f of farms) {
    const loc = store.db.farmLocations.find((l) => l.farmId === f.id);
    const provName = loc?.province || 'Unassigned';
    const cur = provMap.get(provName) || { farmCount: 0, totalHectares: 0, incidentCount: 0 };
    cur.farmCount += 1;
    cur.totalHectares = Number((cur.totalHectares + f.farmSizeHectares).toFixed(2));
    cur.incidentCount += incidents.filter((i) => i.farmId === f.id).length;
    provMap.set(provName, cur);
  }

  const farmsByProvince = Array.from(provMap.entries())
    .map(([province, vals]) => ({ province, ...vals }))
    .filter((r) => r.farmCount > 0)
    .sort((a, b) => b.farmCount - a.farmCount);

  // User & farm registration trends grouped by YYYY-MM
  const trendMap = new Map<string, { newUsers: number; newFarms: number }>();
  for (const u of users) {
    const m = u.createdAt.slice(0, 7);
    const cur = trendMap.get(m) || { newUsers: 0, newFarms: 0 };
    cur.newUsers += 1;
    trendMap.set(m, cur);
  }
  for (const f of farms) {
    const m = f.createdAt.slice(0, 7);
    const cur = trendMap.get(m) || { newUsers: 0, newFarms: 0 };
    cur.newFarms += 1;
    trendMap.set(m, cur);
  }
  const registrationTrends = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, vals]) => ({ period, ...vals }));

  return {
    stats,
    farmsByProvince,
    registrationTrends,
    recentActivity: store.db.auditLogs.slice(0, 30),
    privacyNotice: adminUser.permissions.includes('admin:private_farmer_records')
      ? 'Scoped private farmer record permission is active on your account. All views remain audited.'
      : 'Privacy Enforcement Active: Administrators view system aggregates and non-PII oversight summaries without unrestricted access to private farmer records.',
  };
}

export function buildAdminFarmOversight(adminUser: SanitizedUser) {
  const hasPrivateRecordPermission = adminUser.permissions.includes('admin:private_farmer_records');
  const farms = store.db.farms.map((f, idx) => {
    const loc = store.db.farmLocations.find((l) => l.farmId === f.id);
    const flds = store.db.fields.filter((fl) => fl.farmId === f.id);
    const incs = store.db.farmIncidents.filter((i) => i.farmId === f.id);
    const refCode = `FS-FARM-${String(idx + 1).padStart(3, '0')}`;
    return {
      farmReferenceCode: refCode,
      farmId: f.id,
      // Mask personal farm/owner identity unless explicitly permitted via RBAC
      farmNameDisplay: hasPrivateRecordPermission
        ? f.name
        : `${refCode} (${loc?.districtMunicipality || loc?.province || 'SA'})`,
      province: loc?.province || 'Unassigned',
      districtMunicipality: loc?.districtMunicipality || 'Unassigned',
      farmingCategories: f.farmingActivities.length > 0 ? f.farmingActivities : ['Mixed Farming'],
      farmSizeHectares: f.farmSizeHectares,
      waterAvailability: f.waterAvailability,
      status: f.status,
      isDemonstration: Boolean(f.isDemonstration),
      fieldCount: flds.length,
      incidentCount: incs.length,
      activeIncidentCount: incs.filter((i) => i.status !== 'resolved').length,
      createdAt: f.createdAt,
    };
  });

  const catMap = new Map<string, number>();
  for (const f of farms) {
    for (const c of f.farmingCategories) {
      catMap.set(c, (catMap.get(c) || 0) + 1);
    }
  }

  const provMap = new Map<string, { farmCount: number; hectares: number }>();
  for (const f of farms) {
    const cur = provMap.get(f.province) || { farmCount: 0, hectares: 0 };
    cur.farmCount += 1;
    cur.hectares = Number((cur.hectares + f.farmSizeHectares).toFixed(2));
    provMap.set(f.province, cur);
  }

  const farmCodeById = new Map(farms.map((f) => [f.farmId, { ref: f.farmReferenceCode, prov: f.province }]));
  const reportedIncidentsSummary = store.db.farmIncidents.map((inc) => {
    const ref = farmCodeById.get(inc.farmId);
    return {
      id: inc.id,
      farmReferenceCode: ref?.ref || 'FS-FARM',
      province: ref?.prov || 'Unassigned',
      incidentType: inc.incidentType,
      status: inc.status,
      occurredAt: inc.occurredAt,
      affectedAreaHectares: inc.affectedAreaHectares,
    };
  });

  return {
    privacyNotice: hasPrivateRecordPermission
      ? 'Private farm labels visible via explicit audited permission (admin:private_farmer_records).'
      : 'Privacy Guardrail Active: Private farmer identities, contact details, GPS coordinates, and private crop/financial ledgers are hidden from administrative oversight.',
    hasPrivateRecordPermission,
    farms,
    byCategory: Array.from(catMap.entries()).map(([category, farmCount]) => ({ category, farmCount })),
    byProvince: Array.from(provMap.entries()).map(([province, vals]) => ({
      province,
      ...vals,
    })),
    reportedIncidentsSummary,
  };
}

export function buildLanguageTranslationAudit() {
  const keys = Object.keys(BASE_EN_UI_KEYS);
  const publishedMaterials = store.db.learningMaterials.filter((m) => m.status === 'published');

  return store.db.languages.map((lang) => {
    const baseLangMap = DEFAULT_UI_TRANSLATIONS[lang.code] || {};
    const overrides = store.db.translationOverrides.filter((o) => o.languageCode === lang.code);
    const overrideMap = new Map(overrides.map((o) => [o.key, o]));

    const missingUiKeys: string[] = [];
    let translatedUiKeys = 0;
    let reviewedUiKeys = 0;

    for (const k of keys) {
      const ov = overrideMap.get(k);
      const baseVal = baseLangMap[k];
      const hasValue = Boolean((ov && ov.value.trim()) || (baseVal && baseVal.trim()));
      if (hasValue) {
        translatedUiKeys += 1;
        if (lang.code === 'en' || ov?.reviewed || Boolean(baseVal)) {
          reviewedUiKeys += 1;
        }
      } else {
        missingUiKeys.push(k);
      }
    }

    const learningMaterialsReviewedCount = publishedMaterials.filter(
      (m) => Boolean(m.translations[lang.code]?.reviewed)
    ).length;

    return {
      code: lang.code,
      name: lang.name,
      nativeName: lang.nativeName,
      isActive: lang.isActive,
      hasAudioSupport: lang.hasAudioSupport,
      hasSignLanguageSupport: lang.hasSignLanguageSupport,
      totalUiKeys: keys.length,
      translatedUiKeys,
      reviewedUiKeys,
      missingUiKeys,
      learningMaterialsReviewedCount,
      totalPublishedMaterials: publishedMaterials.length,
    };
  });
}

export function getTranslationEntriesForLang(langCode: LanguageCode) {
  const keys = Object.keys(BASE_EN_UI_KEYS);
  const baseLangMap = DEFAULT_UI_TRANSLATIONS[langCode] || {};
  const overrides = store.db.translationOverrides.filter((o) => o.languageCode === langCode);
  const overrideMap = new Map(overrides.map((o) => [o.key, o]));

  return keys.map((key) => {
    const ov = overrideMap.get(key);
    const baseVal = baseLangMap[key] || '';
    const currentValue = ov ? ov.value : baseVal;
    return {
      key,
      englishDefault: BASE_EN_UI_KEYS[key],
      currentValue,
      isMissing: !currentValue.trim(),
      isOverridden: Boolean(ov),
      reviewed: ov ? ov.reviewed : Boolean(baseVal),
      updatedAt: ov?.updatedAt || null,
    };
  });
}

export function getExternalIntegrationStatuses() {
  const hasGemini =
    Boolean(process.env.GEMINI_API_KEY) &&
    process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
    (process.env.GEMINI_API_KEY || '').length >= 10;
  const hasSaws = Boolean(process.env.SAWS_API_URL && process.env.SAWS_API_KEY);
  const hasDalrrd = Boolean(process.env.DALRRD_SOIL_WFS_URL);
  const hasPg = Boolean(process.env.PGHOST && process.env.PGDATABASE);

  return [
    {
      id: 'gemini_ai',
      name: 'Gemini AI Agricultural Engine',
      status: hasGemini ? ('connected' as const) : ('not_configured' as const),
      detail: hasGemini
        ? `Server-side API active (${store.db.systemConfig.ai.primaryModel})`
        : 'GEMINI_API_KEY not configured — deterministic grounded fallback active.',
    },
    {
      id: 'open_meteo',
      name: 'Open-Meteo Coordinate Weather Telemetry',
      status: ('active' as const),
      detail: 'Live coordinate forecast and 14-day rainfall lookup operational.',
    },
    {
      id: 'saws_stations',
      name: 'SAWS Verified Weather Station Feed',
      status: hasSaws ? ('connected' as const) : ('not_configured' as const),
      detail: hasSaws
        ? 'SAWS verified station endpoint configured.'
        : 'SAWS_API_URL / SAWS_API_KEY not configured — verified station metrics marked unavailable.',
    },
    {
      id: 'dalrrd_wfs',
      name: 'DALRRD National Soil WFS',
      status: hasDalrrd ? ('connected' as const) : ('not_configured' as const),
      detail: hasDalrrd
        ? 'National WFS soil endpoint configured.'
        : 'DALRRD_SOIL_WFS_URL optional override not set; using SoilGrids + provincial reference + lab reports.',
    },
    {
      id: 'postgis_db',
      name: 'PostGIS Relational Store / Local JSON Persistence',
      status: hasPg ? ('connected' as const) : ('active' as const),
      detail: hasPg
        ? 'PostgreSQL / PostGIS environment variables configured.'
        : 'Running on local atomic JSON persistence store (data/fieldshift-db.json).',
    },
  ];
}
