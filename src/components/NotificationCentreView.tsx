import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Globe,
  Lock,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Sliders,
  Smartphone,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  AuthUser,
  LanguageCode,
  NotificationCategory,
  NotificationDeliveryItem,
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
  const [subTab, setSubTab] = useState<'inbox' | 'preferences' | 'integrations'>('inbox');
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
          <h1 className="font-display text-2xl font-bold text-[#143326]">
            Central Notification & Communication Centre
          </h1>
          <p className="text-sm text-[#4A5A50] mt-0.5">
            Role-aware alerts in <span className="font-semibold uppercase">{user.preferredLanguageCode}</span> ·
            Strict preference enforcement except mandatory account security notices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={checkingReminders}
            onClick={handleCheckDueReminders}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#D4DDD2] bg-white hover:bg-[#EDF2EC] text-xs font-semibold text-[#143326] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingReminders ? 'animate-spin' : ''}`} />
            <span>{checkingReminders ? 'Checking...' : 'Check Activity & Weather Reminders'}</span>
          </button>
          {(feed?.unreadCount || 0) > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
          <p className="text-xs text-[#4A5A50]">Unread Alerts</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#143326] mt-1">
            {feed?.unreadCount ?? 0}
          </p>
        </div>
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
          <p className="text-xs text-[#4A5A50]">Total History</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#143326] mt-1">
            {feed?.notifications.length ?? 0}
          </p>
        </div>
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
          <p className="text-xs text-[#4A5A50]">Enabled Categories</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#1B4332] mt-1">
            {preferences
              ? Object.values(preferences.categories).filter(Boolean).length
              : 10}{' '}
            / 10
          </p>
        </div>
        <div className="bg-white border border-[#E2E6DF] rounded-xl p-4">
          <p className="text-xs text-[#4A5A50]">Delivery Attempts Logged</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#143326] mt-1">
            {feed?.deliveries.length ?? 0}
          </p>
        </div>
      </div>

      {feedbackBanner && (
        <div className="bg-[#EDF5EF] border border-[#BFD6C5] text-[#143326] rounded-xl px-4 py-3 text-sm font-medium">
          {feedbackBanner}
        </div>
      )}

      {errorBanner && (
        <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
          {errorBanner}
        </div>
      )}

      {/* Segmented Sub-Navigation */}
      <div className="inline-flex items-center gap-1 p-1 bg-[#EAECE6] rounded-xl">
        {[
          { id: 'inbox' as const, label: 'Notification History', icon: <Bell className="w-4 h-4" /> },
          { id: 'preferences' as const, label: 'Preferences & Consent', icon: <Sliders className="w-4 h-4" /> },
          { id: 'integrations' as const, label: 'Channel Readiness & Log', icon: <Send className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              subTab === tab.id
                ? 'bg-white text-[#143326] shadow-sm'
                : 'text-[#4A5A50] hover:text-[#143326]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white border border-[#E2E6DF] rounded-2xl p-8 text-sm text-[#4A5A50]">
          Loading notification centre...
        </div>
      ) : subTab === 'inbox' ? (
        <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3.5 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs font-semibold text-[#143326]"
              >
                <option value="all">All Categories</option>
                {categoriesMeta.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#35443B] cursor-pointer px-2">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  className="w-4 h-4 accent-[#1B4332]"
                />
                <span>Unread only</span>
              </label>
            </div>
            <span className="text-xs text-[#4A5A50] font-mono tabular-nums">
              Showing {filteredNotifications.length} item(s)
            </span>
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="font-semibold text-[#143326]">No notifications match this filter</p>
              <p className="text-xs text-[#4A5A50]">
                Try clearing filters or click “Check Activity & Weather Reminders” above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E6DF]">
              {filteredNotifications.map((n: NotificationItem) => {
                const targetTab = resolveActionTab(n.actionUrl);
                return (
                  <div
                    key={n.id}
                    className={`py-4 flex flex-wrap items-start justify-between gap-4 ${
                      n.isRead ? 'opacity-80' : ''
                    }`}
                  >
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#4A5A50]">
                        <span className="font-semibold text-[#1B4332]">
                          {CATEGORY_LABELS[n.category] || n.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(n.createdAt).toLocaleString()}
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
                            <span className="text-[#8E2424] font-semibold inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Mandatory Security
                            </span>
                          </>
                        )}
                        {!n.isRead && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#D97706]">Unread</span>
                          </>
                        )}
                      </div>
                      <p className="font-semibold text-sm text-[#143326]">{n.title}</p>
                      <p className="text-sm text-[#35443B]">{n.message}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {targetTab && (
                        <button
                          type="button"
                          onClick={() => onNavigateTab(targetTab)}
                          className="px-3 py-1.5 rounded-lg border border-[#D4DDD2] hover:bg-[#EDF2EC] text-xs font-semibold text-[#143326] whitespace-nowrap cursor-pointer"
                        >
                          Open Module
                        </button>
                      )}
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(n.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#EDF5EF] hover:bg-[#DCEBDD] text-xs font-semibold text-[#1B4332] whitespace-nowrap cursor-pointer"
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
          <div className="lg:col-span-8 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-[#143326]">
                Category Consent & Preferences
              </h2>
              <p className="text-xs text-[#4A5A50] mt-0.5">
                Disabled categories are strictly suppressed on the server. Mandatory account and security notices cannot be turned off.
              </p>
            </div>

            <div className="divide-y divide-[#E2E6DF]">
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
                      <p className="text-sm font-semibold text-[#143326] flex items-center gap-2">
                        <span>{meta.label}</span>
                        {meta.mandatorySecurity && (
                          <span className="text-xs font-normal text-[#8E2424] inline-flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" /> Required
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[#4A5A50]">{meta.description}</p>
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
                      className="w-5 h-5 accent-[#1B4332] shrink-0 mt-0.5"
                    />
                  </label>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[#E2E6DF] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-[#35443B]">
                <span>Quiet hours:</span>
                <input
                  type="time"
                  value={preferences.quietHoursStart}
                  onChange={(e) =>
                    setPreferences({ ...preferences, quietHoursStart: e.target.value })
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-[#D4DDD2] font-mono"
                />
                <span>to</span>
                <input
                  type="time"
                  value={preferences.quietHoursEnd}
                  onChange={(e) =>
                    setPreferences({ ...preferences, quietHoursEnd: e.target.value })
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-[#D4DDD2] font-mono"
                />
              </div>

              <button
                type="button"
                disabled={savingPrefs}
                onClick={handleSavePreferences}
                className="px-5 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                {savingPrefs ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-[#143326]">
                Delivery Channels
              </h3>
              <div className="space-y-3 text-sm">
                {[
                  { key: 'inApp' as const, label: 'In-App Notification Centre', icon: <Bell className="w-4 h-4 text-[#1B4332]" /> },
                  { key: 'email' as const, label: 'Email Digests & Warnings', icon: <Mail className="w-4 h-4 text-[#1B4332]" /> },
                  { key: 'sms' as const, label: 'Rural SMS Alerts', icon: <MessageSquare className="w-4 h-4 text-[#1B4332]" /> },
                  { key: 'push' as const, label: 'Browser / Mobile Push', icon: <Smartphone className="w-4 h-4 text-[#1B4332]" /> },
                ].map((ch) => (
                  <label key={ch.key} className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="inline-flex items-center gap-2 font-medium text-[#17201B]">
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
                      className="w-4 h-4 accent-[#1B4332]"
                    />
                  </label>
                ))}
              </div>
              <p className="text-xs text-[#4A5A50]">
                Language used for notifications:{' '}
                <span className="font-semibold text-[#143326] inline-flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {user.preferredLanguageCode.toUpperCase()}
                </span>
              </p>
            </div>

            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-3">
              <h3 className="font-display text-base font-bold text-[#143326]">
                Verify Preference Enforcement
              </h3>
              <p className="text-xs text-[#4A5A50]">
                Save your preferences first, then test any category to confirm disabled categories are blocked while security alerts always deliver.
              </p>
              <select
                value={testCategory}
                onChange={(e) => setTestCategory(e.target.value as NotificationPreferenceKey)}
                className="w-full px-3 py-2 rounded-lg border border-[#D4DDD2] bg-white text-xs font-medium"
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
                className="w-full py-2 px-4 rounded-lg border border-[#1B4332] text-[#1B4332] hover:bg-[#EDF5EF] text-xs font-semibold cursor-pointer"
              >
                Test Category Dispatch
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(feed?.integrationReadiness || []).map((ir) => (
              <div key={ir.channel} className="bg-white border border-[#E2E6DF] rounded-xl p-5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display font-bold text-sm text-[#143326] uppercase">
                    {ir.channel.replace('_', '-')} Channel
                  </p>
                  <span
                    className={`text-xs font-semibold ${
                      ir.configured ? 'text-[#16A34A]' : 'text-[#D97706]'
                    }`}
                  >
                    {ir.configured ? 'Connected' : 'Hook Ready'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#17201B]">{ir.providerLabel}</p>
                <p className="text-xs text-[#4A5A50]">{ir.detail}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#143326]">
              Recent Dispatch & Consent Audit Log
            </h2>
            {(feed?.deliveries || []).length === 0 ? (
              <p className="text-sm text-[#4A5A50]">
                No channel dispatch attempts recorded yet for your account.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E6DF] text-[#4A5A50]">
                      <th className="py-2 pr-4">Timestamp</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Channel</th>
                      <th className="py-2 pr-4">Outcome</th>
                      <th className="py-2 pr-4">Target</th>
                      <th className="py-2">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E6DF]">
                    {(feed?.deliveries || []).map((d: NotificationDeliveryItem) => (
                      <tr key={d.id}>
                        <td className="py-2.5 pr-4 font-mono tabular-nums whitespace-nowrap">
                          {new Date(d.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-4">{CATEGORY_LABELS[d.category] || d.category}</td>
                        <td className="py-2.5 pr-4 uppercase font-mono">{d.channel}</td>
                        <td className="py-2.5 pr-4 font-semibold text-[#143326]">
                          {d.status.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 pr-4 font-mono">{d.targetMasked}</td>
                        <td className="py-2.5 text-[#4A5A50]">{d.providerNote}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
