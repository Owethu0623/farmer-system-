import crypto from 'node:crypto';
import { store } from './store.ts';
import {
  LanguageCode,
  Notification,
  NotificationCategory,
  NotificationDeliveryAttempt,
  NotificationPreference,
  NotificationPreferenceKey,
} from './types.ts';

export const NOTIFICATION_CATEGORY_META: {
  key: NotificationPreferenceKey;
  label: string;
  description: string;
  mandatorySecurity: boolean;
}[] = [
  {
    key: 'weather_warning',
    label: 'Weather Warnings',
    description: 'Heavy rain, storm, frost, and extreme heat advisories for your farm locations.',
    mandatorySecurity: false,
  },
  {
    key: 'agricultural_incident',
    label: 'Agricultural Incidents',
    description: 'New farm incidents, pest or disease alerts, and incident follow-up updates.',
    mandatorySecurity: false,
  },
  {
    key: 'upcoming_activity',
    label: 'Upcoming Farming Activities',
    description: 'Scheduled field tasks, scouting checkpoints, and soil sampling reminders.',
    mandatorySecurity: false,
  },
  {
    key: 'crop_reminder',
    label: 'Crop Management Reminders',
    description: 'Expected harvest windows, irrigation reminders, and crop stage milestones.',
    mandatorySecurity: false,
  },
  {
    key: 'livestock_reminder',
    label: 'Livestock Management Reminders',
    description: 'Herd health observations, vaccination follow-ups, and treatment reminders.',
    mandatorySecurity: false,
  },
  {
    key: 'stock_change',
    label: 'Stock Changes & Valuation Alerts',
    description: 'Significant harvest additions, damage deductions, sales, and stock updates.',
    mandatorySecurity: false,
  },
  {
    key: 'ai_recommendation',
    label: 'AI Recommendations',
    description: 'New AI agricultural analyses, visual scan insights, and advisory summaries.',
    mandatorySecurity: false,
  },
  {
    key: 'expert_feedback',
    label: 'Expert Feedback & Guidance',
    description: 'Professional assessments and incident assistance from authorised agricultural experts.',
    mandatorySecurity: false,
  },
  {
    key: 'organisation_communication',
    label: 'Organisation Communications',
    description: 'Regional updates, seasonal coordination notices, and bulletins from authorised cooperatives.',
    mandatorySecurity: false,
  },
  {
    key: 'account_security',
    label: 'Account & Security Notices',
    description: 'Legally required compliance, password, activation, and account access security alerts (cannot be disabled).',
    mandatorySecurity: true,
  },
];

export function normalizeNotificationPreferenceKey(
  category: NotificationCategory
): NotificationPreferenceKey {
  switch (category) {
    case 'weather':
    case 'weather_warning':
      return 'weather_warning';
    case 'agricultural_incident':
      return 'agricultural_incident';
    case 'opportunity':
    case 'upcoming_activity':
      return 'upcoming_activity';
    case 'crop_reminder':
      return 'crop_reminder';
    case 'livestock_reminder':
      return 'livestock_reminder';
    case 'stock_change':
      return 'stock_change';
    case 'advisory':
    case 'ai_recommendation':
      return 'ai_recommendation';
    case 'expert_feedback':
      return 'expert_feedback';
    case 'organisation_communication':
      return 'organisation_communication';
    case 'system':
    case 'account_security':
    default:
      return 'account_security';
  }
}

export function getOrCreateUserNotificationPreference(userId: string): NotificationPreference {
  const existing = store.db.notificationPreferences.find((p) => p.userId === userId);
  if (existing) {
    // Guarantee account_security is always enabled
    existing.categories.account_security = true;
    return existing;
  }

  const created: NotificationPreference = {
    userId,
    channels: {
      inApp: true,
      email: false,
      sms: false,
      push: false,
    },
    categories: {
      weather_warning: true,
      agricultural_incident: true,
      upcoming_activity: true,
      crop_reminder: true,
      livestock_reminder: true,
      stock_change: true,
      ai_recommendation: true,
      expert_feedback: true,
      organisation_communication: true,
      account_security: true,
    },
    quietHoursStart: '21:00',
    quietHoursEnd: '05:30',
    updatedAt: new Date().toISOString(),
  };
  store.db.notificationPreferences.push(created);
  store.save();
  return created;
}

export function updateUserNotificationPreference(
  userId: string,
  patch: {
    channels?: Partial<NotificationPreference['channels']>;
    categories?: Partial<Record<NotificationPreferenceKey, boolean>>;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  }
): NotificationPreference {
  const pref = getOrCreateUserNotificationPreference(userId);
  if (patch.channels && typeof patch.channels === 'object') {
    if (typeof patch.channels.inApp === 'boolean') pref.channels.inApp = patch.channels.inApp;
    if (typeof patch.channels.email === 'boolean') pref.channels.email = patch.channels.email;
    if (typeof patch.channels.sms === 'boolean') pref.channels.sms = patch.channels.sms;
    if (typeof patch.channels.push === 'boolean') pref.channels.push = patch.channels.push;
  }
  if (patch.categories && typeof patch.categories === 'object') {
    for (const meta of NOTIFICATION_CATEGORY_META) {
      if (meta.mandatorySecurity) {
        pref.categories.account_security = true;
      } else if (typeof patch.categories[meta.key] === 'boolean') {
        pref.categories[meta.key] = Boolean(patch.categories[meta.key]);
      }
    }
  }
  pref.categories.account_security = true;
  if (typeof patch.quietHoursStart === 'string' && /^\d{2}:\d{2}$/.test(patch.quietHoursStart)) {
    pref.quietHoursStart = patch.quietHoursStart;
  }
  if (typeof patch.quietHoursEnd === 'string' && /^\d{2}:\d{2}$/.test(patch.quietHoursEnd)) {
    pref.quietHoursEnd = patch.quietHoursEnd;
  }
  pref.updatedAt = new Date().toISOString();
  store.save();
  return pref;
}

export function getChannelIntegrationReadiness() {
  const emailConfigured = Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY);
  const smsConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID || process.env.CLICKATELL_API_KEY);
  const pushConfigured = Boolean(process.env.VAPID_PUBLIC_KEY || process.env.FCM_SERVER_KEY);

  return [
    {
      channel: 'in_app' as const,
      configured: true,
      providerLabel: 'Field Shift Central Notification Centre',
      detail: 'Active real-time in-app inbox with per-category preference enforcement.',
    },
    {
      channel: 'email' as const,
      configured: emailConfigured,
      providerLabel: emailConfigured ? 'Configured SMTP / Email Gateway' : 'Email Hook Ready (SMTP_HOST / RESEND_API_KEY)',
      detail: emailConfigured
        ? 'Server email dispatch gateway connected.'
        : 'Delivery hook active and logging queued attempts; configure SMTP_HOST or RESEND_API_KEY on server for live email delivery.',
    },
    {
      channel: 'sms' as const,
      configured: smsConfigured,
      providerLabel: smsConfigured ? 'Configured SMS Gateway' : 'SMS Hook Ready (TWILIO_ACCOUNT_SID / CLICKATELL_API_KEY)',
      detail: smsConfigured
        ? 'South African SMS gateway active.'
        : 'Delivery hook ready for rural SMS fallback; configure TWILIO_ACCOUNT_SID or CLICKATELL_API_KEY in server environment.',
    },
    {
      channel: 'push' as const,
      configured: pushConfigured,
      providerLabel: pushConfigured ? 'Web Push / FCM Gateway' : 'Push Hook Ready (VAPID_PUBLIC_KEY / FCM_SERVER_KEY)',
      detail: pushConfigured
        ? 'Push notification gateway configured.'
        : 'Push subscription adapter ready; configure VAPID_PUBLIC_KEY or FCM_SERVER_KEY to dispatch device push.',
    },
  ];
}

function maskEmail(email: string): string {
  const [userPart, domain] = email.split('@');
  if (!domain) return '***';
  return `${userPart.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string): string {
  const cleaned = phone.trim();
  if (!cleaned) return 'No phone saved';
  if (cleaned.length <= 4) return '***';
  return `${cleaned.slice(0, 3)} *** ${cleaned.slice(-4)}`;
}

// Language-aware prefix/summary helpers across South Africa's 12 official languages
const LANGUAGE_TAG_MAP: Partial<Record<LanguageCode, Record<NotificationPreferenceKey, string>>> = {
  en: {
    weather_warning: 'Weather Warning',
    agricultural_incident: 'Farm Incident Alert',
    upcoming_activity: 'Upcoming Activity',
    crop_reminder: 'Crop Reminder',
    livestock_reminder: 'Livestock Reminder',
    stock_change: 'Stock Update',
    ai_recommendation: 'AI Recommendation',
    expert_feedback: 'Expert Feedback',
    organisation_communication: 'Organisation Notice',
    account_security: 'Account & Security Notice',
  },
  af: {
    weather_warning: 'Weerwaarskuwing',
    agricultural_incident: 'Boerdery-insident Waarskuwing',
    upcoming_activity: 'Komende Aktiwiteit',
    crop_reminder: 'Gewasherinnering',
    livestock_reminder: 'Veeherinnering',
    stock_change: 'Voorraadverandering',
    ai_recommendation: 'KI-aanbeveling',
    expert_feedback: 'Kundige Terugvoer',
    organisation_communication: 'Organisasie Kennisgewing',
    account_security: 'Rekening- & Sekuriteitskennisgewing',
  },
  zu: {
    weather_warning: 'Isixwayiso Sesimo Sezulu',
    agricultural_incident: 'Isaziso Sesigameko Epulazini',
    upcoming_activity: 'Umsebenzi Ozayo',
    crop_reminder: 'Isikhumbuzo Sezitshalo',
    livestock_reminder: 'Isikhumbuzo Semfuyo',
    stock_change: 'Ushintsho Lwesitoko',
    ai_recommendation: 'Izincomo Ze-AI',
    expert_feedback: 'Impendulo Yochwepheshe',
    organisation_communication: 'Umyalezo Wenhlangano',
    account_security: 'Isaziso Se-akhawunti Nokuphepha',
  },
  xh: {
    weather_warning: 'Isilumkiso Semozulu',
    agricultural_incident: 'Isaziso Sesiganeko Efama',
    upcoming_activity: 'Umsebenzi Ozayo',
    crop_reminder: 'Isikhumbuzo Sezityalo',
    livestock_reminder: 'Isikhumbuzo Semfuyo',
    stock_change: 'Utshintsho Lwesitokhwe',
    ai_recommendation: 'Ingcebiso Ye-AI',
    expert_feedback: 'Ingxelo Yengcali',
    organisation_communication: 'Isaziso Sombutho',
    account_security: 'Isaziso Se-akhawunti Nokhuseleko',
  },
  st: {
    weather_warning: 'Temoso ya Boemo ba Lehodimo',
    agricultural_incident: 'Tsebiso ya Ketsahalo Polasing',
    upcoming_activity: 'Mosebetsi o Tlang',
    crop_reminder: 'Kgopotso ya Dijalo',
    livestock_reminder: 'Kgopotso ya Diphoofolo',
    stock_change: 'Phetoho ya Stock',
    ai_recommendation: 'Keletso ya AI',
    expert_feedback: 'Maikutlo a Setsebi',
    organisation_communication: 'Tsebiso ya Mokgatlo',
    account_security: 'Tsebiso ya Akhaonto le Tshireletso',
  },
  nso: {
    weather_warning: 'Temošo ya Boso',
    agricultural_incident: 'Tsebišo ya Tiragalo Polaseng',
    upcoming_activity: 'Mošomo wo o Tlago',
    crop_reminder: 'Kgopotšo ya Dibjalo',
    livestock_reminder: 'Kgopotšo ya Diruiwa',
    stock_change: 'Phetogo ya Setoko',
    ai_recommendation: 'Keletšo ya AI',
    expert_feedback: 'Maikutlo a Setsebi',
    organisation_communication: 'Tsebišo ya Mokgatlo',
    account_security: 'Tsebišo ya Akhaonto le Tšhireletšo',
  },
  tn: {
    weather_warning: 'Tlhagiso ya Bosa',
    agricultural_incident: 'Kitsiso ya Tiragalo kwa Polaseng',
    upcoming_activity: 'Tiro e e Tlang',
    crop_reminder: 'Kgakololo ya Dijalo',
    livestock_reminder: 'Kgakololo ya Leruo',
    stock_change: 'Phetogo ya Setoko',
    ai_recommendation: 'Kgakololo ya AI',
    expert_feedback: 'Tsiboso ya Moitseanape',
    organisation_communication: 'Kitsiso ya Mokgatlho',
    account_security: 'Kitsiso ya Akhaonto le Tshireletso',
  },
  ss: {
    weather_warning: 'Secwayiso Sesimo Selitulu',
    agricultural_incident: 'Satiso Sesehlakalo Epulazini',
    upcoming_activity: 'Umsebenti Lotako',
    crop_reminder: 'Sikhumbuto Setitjalo',
    livestock_reminder: 'Sikhumbuto Semfuyo',
    stock_change: 'Gucuko Lwesitoko',
    ai_recommendation: 'Seluleko Se-AI',
    expert_feedback: 'Umbiko Wengcweti',
    organisation_communication: 'Satiso Senhlangano',
    account_security: 'Satiso Se-akhawunti Nekuphepha',
  },
  ve: {
    weather_warning: 'Tsivhudzo ya Tshiimo tsha Mufhe',
    agricultural_incident: 'Ndivhadzo ya Tshiwo Bulasini',
    upcoming_activity: 'Mushumo u Daho',
    crop_reminder: 'Khumbudzo ya Zwimela',
    livestock_reminder: 'Khumbudzo ya Zwifuwo',
    stock_change: 'Tshanduko ya Thundu',
    ai_recommendation: 'Nyeletshedzo ya AI',
    expert_feedback: 'Muvhigo wa Mudivhi',
    organisation_communication: 'Ndivhadzo ya Dzangano',
    account_security: 'Ndivhadzo ya Akhaunthu na Tsireledzo',
  },
  ts: {
    weather_warning: 'Xitsundzuxo xa Maxelo',
    agricultural_incident: 'Xitiviso xa Xiendlakalo ePurasini',
    upcoming_activity: 'Ntirho lowu Taka',
    crop_reminder: 'Xitsundzuxo xa Swimilana',
    livestock_reminder: 'Xitsundzuxo xa Swifuwo',
    stock_change: 'Ku Cinca ka Xitoko',
    ai_recommendation: 'Switsundzuxo swa AI',
    expert_feedback: 'Nhlamulo ya Mutivi',
    organisation_communication: 'Xitiviso xa Nhlangano',
    account_security: 'Xitiviso xa Akhawunti na Vuhlayiseki',
  },
  nr: {
    weather_warning: 'Isiyeleliso Sobujamo Bezulu',
    agricultural_incident: 'Isaziso Sesehlakalo Eplasini',
    upcoming_activity: 'Umsebenzi Ozako',
    crop_reminder: 'Isikhumbuzo Seentjalo',
    livestock_reminder: 'Isikhumbuzo Sefuyo',
    stock_change: 'Itjhuguluko Lesitoko',
    ai_recommendation: 'Iincomo Ze-AI',
    expert_feedback: 'Impendulo Yesazi',
    organisation_communication: 'Isaziso Sehlangano',
    account_security: 'Isaziso Se-akhawunti Nokuphepha',
  },
  sasl: {
    weather_warning: 'Weather Warning (Visual Alert)',
    agricultural_incident: 'Farm Incident Visual Alert',
    upcoming_activity: 'Upcoming Activity Cue',
    crop_reminder: 'Crop Action Reminder',
    livestock_reminder: 'Livestock Care Reminder',
    stock_change: 'Stock Update',
    ai_recommendation: 'AI Guidance Summary',
    expert_feedback: 'Expert Advisory Response',
    organisation_communication: 'Organisation Bulletin',
    account_security: 'Required Account Security Notice',
  },
};

export function localizeNotificationPrefix(
  lang: LanguageCode,
  category: NotificationPreferenceKey
): string {
  return LANGUAGE_TAG_MAP[lang]?.[category] || LANGUAGE_TAG_MAP.en![category];
}

export interface DispatchNotificationInput {
  userId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  isMandatorySecurity?: boolean;
  actionUrl?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  localizedContent?: Partial<Record<LanguageCode, { title: string; message: string }>>;
  prefixWithLanguageTag?: boolean;
}

export interface DispatchNotificationResult {
  delivered: boolean;
  suppressedReason: string | null;
  notification: Notification | null;
  deliveryAttempts: NotificationDeliveryAttempt[];
}

export function dispatchNotification(input: DispatchNotificationInput): DispatchNotificationResult {
  const user = store.db.users.find((u) => u.id === input.userId);
  if (!user) {
    return {
      delivered: false,
      suppressedReason: 'Recipient user does not exist.',
      notification: null,
      deliveryAttempts: [],
    };
  }

  const pref = getOrCreateUserNotificationPreference(user.id);
  const prefKey = normalizeNotificationPreferenceKey(input.category);
  const isMandatory = Boolean(input.isMandatorySecurity) || prefKey === 'account_security';
  const now = new Date().toISOString();

  // Strictly respect category consent unless legally required or account security
  if (!isMandatory && !pref.categories[prefKey]) {
    const skippedAttempt: NotificationDeliveryAttempt = {
      id: `ndel-${crypto.randomUUID()}`,
      notificationId: 'suppressed',
      userId: user.id,
      category: input.category,
      channel: 'in_app',
      status: 'skipped_user_disabled',
      targetMasked: user.email ? maskEmail(user.email) : user.id,
      providerNote: `Notification suppressed because user disabled '${prefKey}' notifications.`,
      createdAt: now,
    };
    store.db.notificationDeliveries.unshift(skippedAttempt);
    if (store.db.notificationDeliveries.length > 500) {
      store.db.notificationDeliveries = store.db.notificationDeliveries.slice(0, 500);
    }
    store.save();
    return {
      delivered: false,
      suppressedReason: `Suppressed by user preference (${prefKey} disabled).`,
      notification: null,
      deliveryAttempts: [skippedAttempt],
    };
  }

  const userLang: LanguageCode = user.preferredLanguageCode || 'en';
  const localized = input.localizedContent?.[userLang];
  const langTag = localizeNotificationPrefix(userLang, prefKey);
  const finalTitle = localized
    ? localized.title
    : input.prefixWithLanguageTag
    ? `${langTag}: ${input.title}`
    : input.title;
  const finalMessage = localized ? localized.message : input.message;

  const notificationId = `notif-${crypto.randomUUID()}`;
  const notif: Notification = {
    id: notificationId,
    userId: user.id,
    title: finalTitle.slice(0, 180),
    message: finalMessage.slice(0, 900),
    category: input.category,
    priority: input.priority || (isMandatory ? 'high' : 'normal'),
    isMandatorySecurity: isMandatory,
    languageCode: userLang,
    relatedEntityType: input.relatedEntityType || null,
    relatedEntityId: input.relatedEntityId || null,
    isRead: false,
    actionUrl: input.actionUrl ?? null,
    createdAt: now,
  };

  // In-app inbox creation (mandatory security always writes to in-app inbox; otherwise respects channels.inApp)
  const attempts: NotificationDeliveryAttempt[] = [];
  if (isMandatory || pref.channels.inApp) {
    store.db.notifications.unshift(notif);
    if (store.db.notifications.length > 1000) {
      store.db.notifications = store.db.notifications.slice(0, 1000);
    }
    attempts.push({
      id: `ndel-${crypto.randomUUID()}`,
      notificationId,
      userId: user.id,
      category: input.category,
      channel: 'in_app',
      status: 'delivered_in_app',
      targetMasked: user.email ? maskEmail(user.email) : user.id,
      providerNote: isMandatory
        ? 'Mandatory account/security notification delivered to in-app inbox.'
        : `Delivered to in-app inbox (${userLang}).`,
      createdAt: now,
    });
  } else {
    attempts.push({
      id: `ndel-${crypto.randomUUID()}`,
      notificationId,
      userId: user.id,
      category: input.category,
      channel: 'in_app',
      status: 'skipped_user_disabled',
      targetMasked: user.email ? maskEmail(user.email) : user.id,
      providerNote: 'In-app channel disabled by user.',
      createdAt: now,
    });
  }

  const profile = store.db.userProfiles.find((p) => p.userId === user.id);
  const readiness = getChannelIntegrationReadiness();

  // Email integration hook
  if (pref.channels.email || isMandatory) {
    const emailReady = readiness.find((r) => r.channel === 'email')!.configured;
    attempts.push({
      id: `ndel-${crypto.randomUUID()}`,
      notificationId,
      userId: user.id,
      category: input.category,
      channel: 'email',
      status: emailReady ? 'queued_provider' : 'skipped_provider_unconfigured',
      targetMasked: maskEmail(user.email),
      providerNote: emailReady
        ? 'Queued for email gateway dispatch.'
        : 'User email opted-in; awaiting server SMTP/Resend configuration.',
      createdAt: now,
    });
  }

  // SMS integration hook
  if (pref.channels.sms) {
    const smsReady = readiness.find((r) => r.channel === 'sms')!.configured;
    attempts.push({
      id: `ndel-${crypto.randomUUID()}`,
      notificationId,
      userId: user.id,
      category: input.category,
      channel: 'sms',
      status: smsReady && profile?.phoneNumber ? 'queued_provider' : 'skipped_provider_unconfigured',
      targetMasked: maskPhone(profile?.phoneNumber || ''),
      providerNote: !profile?.phoneNumber
        ? 'SMS enabled by user but no phone number on profile.'
        : smsReady
        ? 'Queued for SMS gateway dispatch.'
        : 'User SMS opted-in; awaiting server Twilio/Clickatell configuration.',
      createdAt: now,
    });
  }

  // Push integration hook
  if (pref.channels.push) {
    const pushReady = readiness.find((r) => r.channel === 'push')!.configured;
    attempts.push({
      id: `ndel-${crypto.randomUUID()}`,
      notificationId,
      userId: user.id,
      category: input.category,
      channel: 'push',
      status: pushReady ? 'queued_provider' : 'skipped_provider_unconfigured',
      targetMasked: `web-push:${user.id.slice(0, 8)}`,
      providerNote: pushReady
        ? 'Queued for web push dispatch.'
        : 'User push opted-in; awaiting VAPID/FCM key configuration.',
      createdAt: now,
    });
  }

  store.db.notificationDeliveries.unshift(...attempts);
  if (store.db.notificationDeliveries.length > 500) {
    store.db.notificationDeliveries = store.db.notificationDeliveries.slice(0, 500);
  }
  store.save();

  return {
    delivered: attempts.some((a) => a.status === 'delivered_in_app' || a.status === 'queued_provider'),
    suppressedReason: null,
    notification: isMandatory || pref.channels.inApp ? notif : null,
    deliveryAttempts: attempts,
  };
}

export function generateDueRemindersForUser(
  userId: string,
  accessibleFarmIds: string[]
): { createdCount: number; suppressedCount: number } {
  const today = new Date().toISOString().slice(0, 10);
  const in45Days = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
  let createdCount = 0;
  let suppressedCount = 0;

  const alreadySentToday = (entityId: string, category: NotificationCategory) =>
    store.db.notifications.some(
      (n) =>
        n.userId === userId &&
        n.category === category &&
        n.relatedEntityId === entityId &&
        n.createdAt.slice(0, 10) === today
    );

  // 1. Crop harvest & stage reminders
  const crops = store.db.crops.filter(
    (c) => accessibleFarmIds.includes(c.farmId) && c.status === 'active'
  );
  for (const crop of crops) {
    if (
      crop.expectedHarvestingDate &&
      crop.expectedHarvestingDate <= in45Days &&
      !alreadySentToday(crop.id, 'crop_reminder')
    ) {
      const farm = store.db.farms.find((f) => f.id === crop.farmId);
      const res = dispatchNotification({
        userId,
        category: 'crop_reminder',
        title: `${crop.cropName} harvest window approaching (${crop.expectedHarvestingDate})`,
        message: `${crop.cropName} (${crop.cropVariety}) at ${farm?.name || 'your farm'} is scheduled for harvest around ${crop.expectedHarvestingDate}. Inspect crop maturity and prepare storage.`,
        priority: 'normal',
        actionUrl: 'crops',
        relatedEntityType: 'CropRecord',
        relatedEntityId: crop.id,
        prefixWithLanguageTag: true,
      });
      if (res.delivered) createdCount++;
      else if (res.suppressedReason) suppressedCount++;
    }
  }

  // 2. Livestock health reminders
  const livestockAttention = store.db.livestockGroups.filter(
    (g) => accessibleFarmIds.includes(g.farmId) && g.healthStatus !== 'Healthy'
  );
  for (const group of livestockAttention) {
    if (!alreadySentToday(group.id, 'livestock_reminder')) {
      const farm = store.db.farms.find((f) => f.id === group.farmId);
      const res = dispatchNotification({
        userId,
        category: 'livestock_reminder',
        title: `${group.groupName} requires ${group.healthStatus} check`,
        message: `${group.quantity} ${group.animalType} (${group.breed}) at ${farm?.name || 'farm'} are marked '${group.healthStatus}'. Log veterinary or feeding follow-up.`,
        priority: 'high',
        actionUrl: 'livestock',
        relatedEntityType: 'LivestockGroup',
        relatedEntityId: group.id,
        prefixWithLanguageTag: true,
      });
      if (res.delivered) createdCount++;
      else if (res.suppressedReason) suppressedCount++;
    }
  }

  // 3. Active agricultural incidents follow-up reminders
  const openIncidents = store.db.farmIncidents.filter(
    (i) => accessibleFarmIds.includes(i.farmId) && i.status !== 'resolved'
  );
  for (const inc of openIncidents) {
    if (!alreadySentToday(inc.id, 'upcoming_activity')) {
      const res = dispatchNotification({
        userId,
        category: 'upcoming_activity',
        title: `Follow-up due: ${inc.title}`,
        message: `Incident status is '${inc.status}'. Conduct a field check and add a follow-up update in Incidents & Damage.`,
        priority: inc.status === 'active' ? 'high' : 'normal',
        actionUrl: 'incidents',
        relatedEntityType: 'FarmIncident',
        relatedEntityId: inc.id,
        prefixWithLanguageTag: true,
      });
      if (res.delivered) createdCount++;
      else if (res.suppressedReason) suppressedCount++;
    }
  }

  // 4. Weather warning threshold checks from latest forecast snapshots
  const rainThreshold = store.db.systemConfig.notifications.rainfallAlertThresholdMm || 35;
  const heatThreshold = store.db.systemConfig.notifications.heatAlertThresholdC || 35;
  for (const farmId of accessibleFarmIds) {
    const recentFc = store.db.weatherForecastRecords
      .filter((f) => f.farmId === farmId)
      .sort((a, b) => b.forecastDate.localeCompare(a.forecastDate))[0];
    if (
      recentFc &&
      (recentFc.predictedRainfallMm >= rainThreshold || recentFc.predictedTempMaxC >= heatThreshold) &&
      !alreadySentToday(recentFc.id, 'weather_warning')
    ) {
      const farm = store.db.farms.find((f) => f.id === farmId);
      const isRain = recentFc.predictedRainfallMm >= rainThreshold;
      const res = dispatchNotification({
        userId,
        category: 'weather_warning',
        title: isRain
          ? `Heavy rain forecast (${recentFc.predictedRainfallMm} mm) at ${farm?.name || 'Farm'}`
          : `High heat forecast (${recentFc.predictedTempMaxC}°C) at ${farm?.name || 'Farm'}`,
        message: isRain
          ? `Forecast rainfall exceeds ${rainThreshold} mm threshold. Check contour drains, pump shelters, and livestock shelter.`
          : `Forecast temperature exceeds ${heatThreshold}°C threshold. Prioritise early-morning irrigation and livestock shade/water.`,
        priority: 'high',
        actionUrl: 'weather',
        relatedEntityType: 'WeatherForecastRecord',
        relatedEntityId: recentFc.id,
        prefixWithLanguageTag: true,
      });
      if (res.delivered) createdCount++;
      else if (res.suppressedReason) suppressedCount++;
    }
  }

  return { createdCount, suppressedCount };
}
