import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Globe,
  Info,
  Lock,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Smartphone,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  AuthUser,
  LanguageCode,
  NotificationCategory,
  NotificationFeedPayload,
  NotificationItem,
  NotificationPreferenceItem,
  NotificationPreferenceKey,
} from '../types';

interface NotificationCentreViewProps {
  user: AuthUser;
  languageCode: LanguageCode;
  onNavigateTab: (tab: string) => void;
  onNotificationsChanged: () => Promise<void>;
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  weather_warning: 'Weather Warning',
  agricultural_incident: 'Agricultural Incident',
  upcoming_activity: 'Upcoming Activity',
  crop_reminder: 'Crop Reminder',
  livestock_reminder: 'Livestock Reminder',
  stock_change: 'Stock Change',
  ai_recommendation: 'AI Recommendation',
  expert_feedback: 'Expert Feedback',
  organisation_communication: 'Organisation Notice',
  account_security: 'Account & Security',
  weather: 'Weather Advisory',
  advisory: 'Advisory',
  opportunity: 'Opportunity',
  system: 'System & Account',
};

export const NotificationCentreView: React.FC<NotificationCentreViewProps> = ({
  user,
  languageCode,
  onNavigateTab,
  onNotificationsChanged,
}) => {
  const [subTab, setSubTab] = useState<'inbox' | 'preferences'>('inbox');
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<NotificationFeedPayload | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferenceItem | null>(null);
  const [categoriesMeta, setCategoriesMeta] = useState<
    { key: NotificationPreferenceKey; label: string; description: string; mandatorySecurity: boolean }[]
  >([]);

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [checkingReminders, setCheckingReminders] = useState(false);
  const [testCategory, setTestCategory] = useState<NotificationPreferenceKey>('upcoming_activity');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<NotificationItem | null>(null);

  const getSeverityMeta = (n: NotificationItem) => {
    const isCritical =
      n.priority === 'urgent' ||
      n.category === 'agricultural_incident' ||
      n.category === 'account_security';
    const isWarning =
      !isCritical && (n.priority === 'high' || n.category === 'weather_warning');
    if (isCritical) {
      return {
        label: 'Critical Alert',
        icon: <AlertOctagon className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />,
        textClass: 'text-[#B91C1C]',
        cardClass: 'bg-[#FEF2F2]/60 border-[#FECACA]',
      };
    }
    if (isWarning) {
      return {
        label: 'Warning',
        icon: <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />,
        textClass: 'text-[#B45309]',
        cardClass: 'bg-[#FFFBEB]/60 border-[#FDE68A]',
      };
    }
    return {
      label: 'Informational',
      icon: <Info className="w-4 h-4 text-[#0B3D91] shrink-0 mt-0.5" />,
      textClass: 'text-[#0B3D91]',
      cardClass: 'bg-[#F8FAFC] border-[#E2E8F0]',
    };
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [feedData, prefData] = await Promise.all([
        apiRequest<NotificationFeedPayload>('/api/notifications/feed'),
        apiRequest<{
          preferences: NotificationPreferenceItem;
          categoriesMeta: {
            key: NotificationPreferenceKey;
            label: string;
            description: string;
            mandatorySecurity: boolean;
          }[];
        }>('/api/notifications/preferences'),
      ]);
      setFeed(feedData);
      setPreferences(prefData.preferences);
      setCategoriesMeta(prefData.categoriesMeta);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, languageCode]);

  const filteredNotifications = useMemo(() => {
    const items = feed?.notifications || [];
    return items.filter((n) => {
      if (unreadOnly && n.isRead) return false;
      if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
      return true;
    });
  }, [feed, unreadOnly, categoryFilter]);

  const handleMarkRead = async (id: string) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'POST' });
    await loadData();
    await onNotificationsChanged();
  };

  const handleMarkAllRead = async () => {
    setFeedbackBanner(null);
    const res = await apiRequest<{ markedCount: number }>('/api/notifications/read-all', {
      method: 'POST',
    });
    setFeedbackBanner(`Marked ${res.markedCount} notification(s) as read.`);
    await loadData();
    await onNotificationsChanged();
  };

  const handleCheckDueReminders = async () => {
    setCheckingReminders(true);
    setFeedbackBanner(null);
    setErrorBanner(null);
    try {
      const res = await apiRequest<{ createdCount: number; suppressedCount: number }>(
        '/api/notifications/generate-reminders',
        { method: 'POST' }
      );
      setFeedbackBanner(
        `Reminder scan complete: ${res.createdCount} new notification(s) delivered, ${res.suppressedCount} suppressed by your preferences.`
      );
      await loadData();
      await onNotificationsChanged();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to generate reminders.');
    } finally {
      setCheckingReminders(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;
    setSavingPrefs(true);
    setFeedbackBanner(null);
    setErrorBanner(null);
    try {
      const res = await apiRequest<{ preferences: NotificationPreferenceItem }>(
        '/api/notifications/preferences',
        {
          method: 'PUT',
          body: JSON.stringify({
            channels: preferences.channels,
            categories: preferences.categories,
            quietHoursStart: preferences.quietHoursStart,
            quietHoursEnd: preferences.quietHoursEnd,
          }),
        }
      );
      setPreferences(res.preferences);
      setFeedbackBanner('Notification preferences and channel consent saved.');
      await loadData();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleDispatchTest = async () => {
    setFeedbackBanner(null);
    setErrorBanner(null);
    try {
      const res = await apiRequest<{ delivered: boolean; suppressedReason: string | null }>(
        '/api/notifications/dispatch-test',
        {
          method: 'POST',
          body: JSON.stringify({
            category: testCategory,
            title: `Verification Check (${CATEGORY_LABELS[testCategory]})`,
            message:
              testCategory === 'account_security'
                ? 'Mandatory account security notices always deliver regardless of opt-out settings.'
                : 'Sample notification dispatched in your preferred language.',
          }),
        }
      );
      setFeedbackBanner(
        res.delivered
          ? `Delivered '${CATEGORY_LABELS[testCategory]}' notification to your active channels.`
          : res.suppressedReason || 'Notification suppressed by your preferences.'
      );
      await loadData();
      await onNotificationsChanged();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Test dispatch failed.');
    }
  };

  const resolveActionTab = (actionUrl: string | null): string | null => {
    if (!actionUrl) return null;
    const cleaned = actionUrl.replace(/^\//, '');
    const valid = [
      'dashboard',
      'farms',
      'crops',
      'livestock',
      'soil',
      'weather',
      'visual',
      'stock',
      'incidents',
      'planner',
      'learning',
      'reports',
      'advisor',
      'expert',
      'organisation',
      'offline',
      'notifications',
      'profile',
      'settings',
    ];
    return valid.includes(cleaned) ? cleaned : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
            Central Notification & Communication Centre
          </h1>
          <p className="text-sm text-[#475569] mt-0.5">
            Role-aware alerts in <span className="font-semibold uppercase">{user.preferredLanguageCode}</span> ·
            Strict preference enforcement except mandatory account security notices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={checkingReminders}
            onClick={handleCheckDueReminders}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0B1F3A] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingReminders ? 'animate-spin' : ''}`} />
            <span>{checkingReminders ? 'Checking...' : 'Check Activity & Weather Reminders'}</span>
          </button>
          {(feed?.unreadCount || 0) > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B3D91] hover:bg-[#082E70] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
          <p className="text-xs text-[#475569]">Unread Notifications</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#0B1F3A] mt-1">
            {feed?.unreadCount ?? 0} unread
          </p>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
          <p className="text-xs text-[#475569]">Total Notification History</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#0B1F3A] mt-1">
            {feed?.notifications.length ?? 0} total
          </p>
        </div>
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
          <p className="text-xs text-[#475569]">Enabled Notification Categories</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#174C3C] mt-1">
            {preferences
              ? Object.values(preferences.categories).filter(Boolean).length
              : 10}{' '}
            / 10 categories
          </p>
        </div>
      </div>

      {feedbackBanner && (
        <div className="bg-[#ECF5F2] border border-[#A7D7C5] text-[#174C3C] rounded-xl px-4 py-3 text-sm font-medium">
          {feedbackBanner}
        </div>
      )}

      {errorBanner && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-4 py-3 text-sm">
          {errorBanner}
        </div>
      )}

      {/* Segmented Sub-Navigation */}
      <div className="inline-flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-xl">
        {[
          { id: 'inbox' as const, label: 'Notification History', icon: <Bell className="w-4 h-4" /> },
          { id: 'preferences' as const, label: 'Preferences & Consent', icon: <Sliders className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              subTab === tab.id
                ? 'bg-[#0B3D91] text-white'
                : 'text-[#475569] hover:text-[#0B1F3A]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 text-sm text-[#475569]">
          Loading notification centre...
        </div>
      ) : subTab === 'inbox' ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3.5 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#0B1F3A]"
              >
                <option value="all">All Categories</option>
                {categoriesMeta.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#334155] cursor-pointer px-2">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  className="w-4 h-4 accent-[#0B3D91]"
                />
                <span>Unread only</span>
              </label>
            </div>
            <span className="text-xs text-[#475569] font-mono tabular-nums">
              Showing {filteredNotifications.length} notification(s)
            </span>
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="font-semibold text-[#0B1F3A]">No notifications match this filter</p>
              <p className="text-xs text-[#475569]">
                Try clearing filters or click “Check Activity & Weather Reminders” above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((n: NotificationItem) => {
                const targetTab = resolveActionTab(n.actionUrl);
                const sev = getSeverityMeta(n);
                return (
                  <div
                    key={n.id}
                    className={`p-4 rounded-xl border flex flex-wrap items-start justify-between gap-4 ${sev.cardClass} ${
                      n.isRead ? 'opacity-85' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1 max-w-3xl">
                      {sev.icon}
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
                          <span className={`font-semibold ${sev.textClass}`}>{sev.label}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#0B3D91]">
                            {CATEGORY_LABELS[n.category] || n.category}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {new Date(n.createdAt).toLocaleString('en-ZA', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                          {n.languageCode && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="uppercase font-mono">{n.languageCode}</span>
                            </>
                          )}
                          {n.isMandatorySecurity && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#B91C1C] font-semibold inline-flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Mandatory Security
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-semibold ${
                              n.isRead ? 'text-[#475569]' : 'text-[#92400E]'
                            }`}
                          >
                            {n.isRead ? 'Read' : 'Unread'}
                          </span>
                        </div>
                        <p className="font-semibold text-sm text-[#0B1F3A] break-words">
                          {n.title}
                        </p>
                        <p className="text-sm text-[#334155] break-words">{n.message}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNotice(n);
                          if (!n.isRead) void handleMarkRead(n.id);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0B3D91] whitespace-nowrap cursor-pointer"
                      >
                        Read Full Notice
                      </button>
                      {targetTab && (
                        <button
                          type="button"
                          onClick={() => onNavigateTab(targetTab)}
                          className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-xs font-semibold text-[#0B1F3A] whitespace-nowrap cursor-pointer"
                        >
                          Open Module
                        </button>
                      )}
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(n.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#ECF5F2] border border-[#A7D7C5] hover:bg-[#D1FAE5] text-xs font-semibold text-[#174C3C] whitespace-nowrap cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark read</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : subTab === 'preferences' && preferences ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                Category Consent & Preferences
              </h2>
              <p className="text-xs text-[#475569] mt-0.5">
                Disabled categories are strictly suppressed on the server. Mandatory account and security notices cannot be turned off.
              </p>
            </div>

            <div className="divide-y divide-[#E2E8F0]">
              {categoriesMeta.map((meta) => {
                const checked = meta.mandatorySecurity
                  ? true
                  : Boolean(preferences.categories[meta.key]);
                return (
                  <label
                    key={meta.key}
                    className={`py-3.5 flex items-start justify-between gap-4 ${
                      meta.mandatorySecurity ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-[#0B1F3A] flex items-center gap-2">
                        <span>{meta.label}</span>
                        {meta.mandatorySecurity && (
                          <span className="text-xs font-normal text-[#B91C1C] inline-flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" /> Required
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[#475569]">{meta.description}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={meta.mandatorySecurity}
                      onChange={(e) => {
                        if (meta.mandatorySecurity) return;
                        setPreferences({
                          ...preferences,
                          categories: {
                            ...preferences.categories,
                            [meta.key]: e.target.checked,
                          },
                        });
                      }}
                      className="w-5 h-5 accent-[#0B3D91] shrink-0 mt-0.5"
                    />
                  </label>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-[#334155]">
                <span>Quiet hours:</span>
                <input
                  type="time"
                  value={preferences.quietHoursStart}
                  onChange={(e) =>
                    setPreferences({ ...preferences, quietHoursStart: e.target.value })
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] font-mono"
                />
                <span>to</span>
                <input
                  type="time"
                  value={preferences.quietHoursEnd}
                  onChange={(e) =>
                    setPreferences({ ...preferences, quietHoursEnd: e.target.value })
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] font-mono"
                />
              </div>

              <button
                type="button"
                disabled={savingPrefs}
                onClick={handleSavePreferences}
                className="px-5 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                {savingPrefs ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                Delivery Channels
              </h3>
              <div className="space-y-3 text-sm">
                {[
                  { key: 'inApp' as const, label: 'In-App Notification Centre', icon: <Bell className="w-4 h-4 text-[#0B3D91]" /> },
                  { key: 'email' as const, label: 'Email Digests & Warnings', icon: <Mail className="w-4 h-4 text-[#0B3D91]" /> },
                  { key: 'sms' as const, label: 'Rural SMS Alerts', icon: <MessageSquare className="w-4 h-4 text-[#0B3D91]" /> },
                  { key: 'push' as const, label: 'Browser / Mobile Push', icon: <Smartphone className="w-4 h-4 text-[#0B3D91]" /> },
                ].map((ch) => (
                  <label key={ch.key} className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="inline-flex items-center gap-2 font-medium text-[#0F172A]">
                      {ch.icon}
                      <span>{ch.label}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.channels[ch.key]}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          channels: { ...preferences.channels, [ch.key]: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-[#0B3D91]"
                    />
                  </label>
                ))}
              </div>
              <p className="text-xs text-[#475569]">
                Language used for notifications:{' '}
                <span className="font-semibold text-[#0B1F3A] inline-flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {user.preferredLanguageCode.toUpperCase()}
                </span>
              </p>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 space-y-3">
              <h3 className="font-display text-base font-bold text-[#0B1F3A]">
                Verify Preference Enforcement
              </h3>
              <p className="text-xs text-[#475569]">
                Save your preferences first, then test any category to confirm disabled categories are blocked while security alerts always deliver.
              </p>
              <select
                value={testCategory}
                onChange={(e) => setTestCategory(e.target.value as NotificationPreferenceKey)}
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs font-medium text-[#0B1F3A]"
              >
                {categoriesMeta.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleDispatchTest}
                className="w-full py-2 px-4 rounded-lg border border-[#0B3D91] text-[#0B3D91] hover:bg-[#EFF6FF] text-xs font-semibold cursor-pointer"
              >
                Test Category Dispatch
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Full Notification Inspection Modal */}
      {selectedNotice && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-300 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 bg-[#0B1F3A] text-white flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-mono text-sky-300 uppercase">
                  {CATEGORY_LABELS[selectedNotice.category] || selectedNotice.category} ·{' '}
                  {getSeverityMeta(selectedNotice).label}
                </p>
                <h3 className="text-base font-bold mt-1 break-words">{selectedNotice.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                aria-label="Close notification detail"
                className="p-1 rounded text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {selectedNotice.message}
              </p>
              <div className="text-xs font-mono text-slate-500 border-t border-slate-200 pt-3 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {new Date(selectedNotice.createdAt).toLocaleString('en-ZA', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                </span>
                <span>{selectedNotice.isRead ? 'Read' : 'Unread'}</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {resolveActionTab(selectedNotice.actionUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      const tab = resolveActionTab(selectedNotice.actionUrl);
                      setSelectedNotice(null);
                      if (tab) onNavigateTab(tab);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50 cursor-pointer"
                  >
                    Open Related Module
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedNotice(null)}
                  className="px-4 py-2 rounded-xl bg-[#0B3D91] text-white text-xs font-semibold hover:bg-[#082E70] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
