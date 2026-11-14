import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Download,
  Globe,
  History,
  Info,
  Lock,
  RotateCcw,
  Shield,
  Sprout,
  Tractor,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { LANGUAGE_LIST } from '../i18n/translations';
import { apiRequest, revertFarmerToProspective } from '../lib/api';
import { wipeUserOfflineVault } from '../lib/offlineSync';
import { getSastDateString } from '../lib/saTime';
import { AuthUser, LanguageCode, NotificationItem, PopiaPrivacySummaryPayload } from '../types';
import { EasyReadToggle } from './AccessibilityControls';

interface ProfileSettingsViewProps {
  mode: 'profile' | 'settings';
  user: AuthUser;
  notifications: NotificationItem[];
  languageCode: LanguageCode;
  largeMode: boolean;
  onToggleLargeMode: () => void;
  onLanguageChange: (code: LanguageCode) => void;
  onUserUpdated: (user: AuthUser) => void;
  onNotificationsRefresh: () => Promise<void>;
  onOpenNotifications?: () => void;
  onOpenFarmTransition?: () => void;
  onAccountErased?: () => void;
}

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  mode,
  user,
  notifications,
  languageCode,
  largeMode,
  onToggleLargeMode,
  onLanguageChange,
  onUserUpdated,
  onNotificationsRefresh,
  onOpenNotifications,
  onOpenFarmTransition,
  onAccountErased,
}) => {
  const [fullName, setFullName] = useState(user.profile?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(user.profile?.phoneNumber || '');
  const [province, setProvince] = useState(user.profile?.province || '');
  const [district, setDistrict] = useState(user.profile?.district || '');
  const [bio, setBio] = useState(user.profile?.bio || '');
  const [audioGuidance, setAudioGuidance] = useState(
    user.profile?.accessibilityAudioGuidance || false
  );
  const [voiceInput, setVoiceInput] = useState(user.profile?.accessibilityVoiceInput || false);
  const [activationCode, setActivationCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Journey transition / revert state
  const [revertReason, setRevertReason] = useState('');
  const [revertingJourney, setRevertingJourney] = useState(false);

  // Full notification detail modal
  const [selectedNotice, setSelectedNotice] = useState<NotificationItem | null>(null);

  // POPIA privacy summary & erasure controls
  const [privacySummary, setPrivacySummary] = useState<PopiaPrivacySummaryPayload | null>(null);
  const [exportingData, setExportingData] = useState(false);
  const [erasePassword, setErasePassword] = useState('');
  const [eraseConfirmText, setEraseConfirmText] = useState('');
  const [erasingAccount, setErasingAccount] = useState(false);

  useEffect(() => {
    if (mode === 'profile') {
      apiRequest<PopiaPrivacySummaryPayload>('/api/privacy/summary')
        .then(setPrivacySummary)
        .catch(() => {});
    }
  }, [mode]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiRequest<{ user: AuthUser }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName,
          phoneNumber,
          province,
          district,
          bio,
          preferredLanguageCode: languageCode,
          accessibilityLargeText: largeMode,
          accessibilityAudioGuidance: audioGuidance,
          accessibilityVoiceInput: voiceInput,
        }),
      });
      onUserUpdated(res.user);
      setMessage('Profile and settings saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await apiRequest<{ user: AuthUser; message: string }>('/api/auth/activate', {
        method: 'POST',
        body: JSON.stringify({ code: activationCode }),
      });
      onUserUpdated(res.user);
      setMessage(res.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Activation failed.');
    }
  };

  const markRead = async (id: string) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'POST' });
    await onNotificationsRefresh();
  };

  const handleRevertToProspective = async () => {
    setRevertingJourney(true);
    setError(null);
    setMessage(null);
    try {
      const res = await revertFarmerToProspective(revertReason.trim() || undefined);
      onUserUpdated(res.user);
      setRevertReason('');
      setMessage(
        `Workspace switched to Prospective Farmer mode. All ${res.preservedFarmsCount} farm record(s), business plans, saved locations, and learning history remain safely preserved.`
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to switch farmer journey mode.'
      );
    } finally {
      setRevertingJourney(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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
        boxClass: 'bg-[#FEF2F2]/60 border-[#FECACA]',
      };
    }
    if (isWarning) {
      return {
        label: 'Warning',
        icon: <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />,
        textClass: 'text-[#B45309]',
        boxClass: 'bg-[#FFFBEB]/60 border-[#FDE68A]',
      };
    }
    return {
      label: 'Informational',
      icon: <Info className="w-4 h-4 text-[#0B3D91] shrink-0 mt-0.5" />,
      textClass: 'text-[#0B3D91]',
      boxClass: 'bg-[#F8FAFC] border-[#E2E8F0]',
    };
  };

  const handleDownloadPopiaExport = async () => {
    setExportingData(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await apiRequest<Record<string, unknown>>('/api/privacy/export');
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `field-shift-popia-export-${getSastDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage('Personal data export downloaded (POPIA Section 23).');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to export personal data.');
    } finally {
      setExportingData(false);
    }
  };

  const handleEraseAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (eraseConfirmText.trim() !== 'ERASE MY ACCOUNT') {
      setError('Type "ERASE MY ACCOUNT" exactly to confirm permanent deletion.');
      return;
    }
    setErasingAccount(true);
    try {
      await apiRequest('/api/privacy/erase-account', {
        method: 'POST',
        body: JSON.stringify({
          password: erasePassword,
          confirmationText: eraseConfirmText.trim(),
        }),
      });
      await wipeUserOfflineVault(user.id);
      if (onAccountErased) {
        onAccountErased();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not complete account erasure.');
    } finally {
      setErasingAccount(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
          {mode === 'profile' ? 'User Profile & Notifications' : 'Language & Accessibility Settings'}
        </h1>
        <p className="text-sm text-[#475569] mt-0.5">
          Role: {user.roleName} · {user.email}
        </p>
      </div>

      {message && (
        <div className="bg-[#ECF5F2] border border-[#A7D7C5] text-[#174C3C] rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#174C3C] shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Account Activation Card if not yet verified */}
      {!user.isEmailVerified && (
        <form
          onSubmit={handleActivate}
          className="bg-white border border-[#BFDBFE] rounded-2xl p-6 space-y-3"
        >
          <div className="flex items-center gap-2 font-display font-bold text-[#0B1F3A]">
            <UserCheck className="w-5 h-5 text-[#0B3D91]" />
            <span>Activate Your Account</span>
          </div>
          <p className="text-sm text-[#334155]">
            Enter the 6-character activation code from your welcome notification below.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              required
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
              placeholder="e.g. A1B2C3"
              className="px-4 py-2.5 rounded-xl border border-[#CBD5E1] font-mono uppercase"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold cursor-pointer"
            >
              Verify & Activate
            </button>
          </div>
        </form>
      )}

      {mode === 'profile' ? (
        <div className="space-y-6">
          <form
            onSubmit={handleSave}
            className="bg-white border border-[#E2E8F0] rounded-2xl p-6 space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">Personal Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-[#0F172A]">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-sm text-[#0F172A]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-[#0F172A]">Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+27 ..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-sm font-mono text-[#0F172A]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-[#0F172A]">Province</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-sm text-[#0F172A]"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-[#0F172A]">District</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-sm text-[#0F172A]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-[#0F172A]">Short Bio / Farming Notes</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#CBD5E1] text-sm text-[#0F172A]"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          {/* Farmer Journey & Farm Transition Management */}
          {(user.roleCode === 'prospective_farmer' || user.roleCode === 'existing_farmer') && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {user.roleCode === 'prospective_farmer' ? (
                      <Sprout className="w-5 h-5 text-[#174C3C]" />
                    ) : (
                      <Tractor className="w-5 h-5 text-[#0B3D91]" />
                    )}
                    <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                      Farmer Journey & Farm Transition
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                    Current stage:{' '}
                    <strong className="text-[#0B1F3A]">
                      {user.roleCode === 'prospective_farmer'
                        ? 'Prospective Farmer (Planning & Land Exploration)'
                        : 'Existing Farmer (Active Farm Operations)'}
                    </strong>
                    . Both journeys share this single Field Shift account, preserving your login, saved locations, business plans, learning completions, and preferences.
                  </p>
                </div>

                {user.roleCode === 'prospective_farmer' && onOpenFarmTransition && (
                  <button
                    type="button"
                    onClick={onOpenFarmTransition}
                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#174C3C] hover:bg-[#113A2E] text-white text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>I Now Have a Farm — Register My Farm</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {user.roleCode === 'existing_farmer' && (
                <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <RotateCcw className="w-4 h-4 text-[#0B3D91] shrink-0 mt-0.5" />
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-[#0B1F3A]">
                        Correct or Reverse Farm Transition (Non-Destructive)
                      </p>
                      <p className="text-xs text-[#475569] leading-relaxed">
                        If you transitioned prematurely or wish to return to Prospective Planning Mode, you can switch back here without deleting any registered farms, business plans, saved locations, or historical records.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={revertReason}
                      onChange={(e) => setRevertReason(e.target.value)}
                      placeholder="Optional note (e.g. Still finalising lease or site check)"
                      className="flex-1 min-w-0 px-3.5 py-2 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#0F172A]"
                    />
                    <button
                      type="button"
                      disabled={revertingJourney}
                      onClick={handleRevertToProspective}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl border border-[#0B3D91] text-[#0B3D91] hover:bg-[#EFF6FF] disabled:opacity-60 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>
                        {revertingJourney
                          ? 'Switching...'
                          : 'Switch to Prospective Planning Mode'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {user.profile?.journeyHistory && user.profile.journeyHistory.length > 0 && (
                <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#475569]">
                    <History className="w-3.5 h-3.5" />
                    <span>Recorded Journey History ({user.profile.journeyHistory.length} events)</span>
                  </div>
                  <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-xl px-4">
                    {user.profile.journeyHistory.map((entry) => (
                      <div key={entry.id} className="py-2.5 text-xs space-y-0.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#0B1F3A]">
                            {entry.fromRole.replace(/_/g, ' ')} → {entry.toRole.replace(/_/g, ' ')}
                            {entry.farmName ? ` · ${entry.farmName}` : ''}
                          </span>
                          <span className="font-mono text-[#475569] tabular-nums">
                            {new Date(entry.occurredAt).toLocaleString('en-ZA', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        <p className="text-[#475569]">{entry.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notifications */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Bell className="w-5 h-5 text-[#0B3D91]" />
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Notifications
                </h2>
                <span className="text-xs font-mono text-[#475569]">
                  · {notifications.length} total notifications · {unreadCount} unread
                </span>
              </div>
              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  className="px-3.5 py-2 rounded-xl border border-[#CBD5E1] hover:bg-[#F1F5F9] text-xs font-semibold text-[#0B1F3A] whitespace-nowrap cursor-pointer"
                >
                  Open Notification Centre & Preferences
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-[#475569]">No notifications yet.</p>
            ) : (
              <div className="space-y-2.5">
                {notifications.map((n) => {
                  const sev = getSeverityMeta(n);
                  return (
                    <div
                      key={n.id}
                      className={`p-3.5 rounded-xl border flex flex-wrap items-start justify-between gap-3 ${sev.boxClass}`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {sev.icon}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={`font-semibold ${sev.textClass}`}>{sev.label}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-[#475569] tabular-nums">
                              {new Date(n.createdAt).toLocaleString('en-ZA', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
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
                          <p className="text-xs text-[#334155] line-clamp-2">{n.message}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNotice(n);
                            if (!n.isRead) void markRead(n.id);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0B3D91] whitespace-nowrap cursor-pointer"
                        >
                          Read Full Notice
                        </button>
                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={() => markRead(n.id)}
                            className="px-3 py-1.5 rounded-lg bg-[#ECF5F2] border border-[#A7D7C5] text-xs font-semibold text-[#174C3C] whitespace-nowrap cursor-pointer"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* POPIA Privacy, Retention & Account Control */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-[#0B3D91]" />
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    POPIA Privacy, Data Retention & Account Rights
                  </h2>
                </div>
                <p className="text-xs text-[#475569]">
                  Protection of Personal Information Act (South Africa) controls for your personal records, farm locations, financial plans, and media.
                </p>
              </div>
              <button
                type="button"
                disabled={exportingData}
                onClick={handleDownloadPopiaExport}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-[#CBD5E1] hover:bg-[#F1F5F9] text-xs font-semibold text-[#0B1F3A] whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-[#0B3D91]" />
                <span>{exportingData ? 'Preparing Export...' : 'Download Personal Data (JSON)'}</span>
              </button>
            </div>

            {privacySummary && (
              <>
                <p className="text-xs text-[#0B1F3A] bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3.5 leading-relaxed">
                  {privacySummary.popiaComplianceNotice}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                    <p className="text-[#475569]">Owned Farms</p>
                    <p className="font-mono text-base font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                      {privacySummary.ownedFarmsCount}
                    </p>
                  </div>
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                    <p className="text-[#475569]">Active Sharing Grants</p>
                    <p className="font-mono text-base font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                      {privacySummary.activeSharingGrantsCount}
                    </p>
                  </div>
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                    <p className="text-[#475569]">Stored Photos/Frames</p>
                    <p className="font-mono text-base font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                      {privacySummary.storedMediaCount}
                    </p>
                  </div>
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                    <p className="text-[#475569]">Session Timeout</p>
                    <p className="font-mono text-base font-bold tabular-nums text-[#0B1F3A] mt-0.5">
                      {privacySummary.sessionTimeoutHours}h ({privacySummary.activeSessionsCount} active)
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                    Data Retention & Deletion Policy
                  </p>
                  <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-xl px-4">
                    {privacySummary.retentionSchedule.map((item) => (
                      <div key={item.category} className="py-2.5 text-xs">
                        <p className="font-semibold text-[#0B1F3A]">{item.category}</p>
                        <p className="text-[#475569] mt-0.5">{item.rule}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Permanent Account Erasure */}
            <form
              onSubmit={handleEraseAccount}
              className="pt-4 border-t border-[#E2E8F0] space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-[#B91C1C]">
                <Trash2 className="w-4 h-4" />
                <span>Permanent Account & Personal Data Erasure (POPIA Section 24)</span>
              </div>
              <p className="text-xs text-[#475569]">
                Deletes your account, personal profile, farm locations, crop/livestock logs, stored photos, weather reports, business plans, and local offline vault, while anonymising audit references.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="password"
                  required
                  value={erasePassword}
                  onChange={(e) => setErasePassword(e.target.value)}
                  placeholder="Confirm current password"
                  className="px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-sm"
                />
                <input
                  type="text"
                  required
                  value={eraseConfirmText}
                  onChange={(e) => setEraseConfirmText(e.target.value)}
                  placeholder='Type "ERASE MY ACCOUNT"'
                  className="px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] font-mono text-xs"
                />
                <button
                  type="submit"
                  disabled={erasingAccount}
                  className="px-4 py-2.5 rounded-xl bg-[#FC3D21] hover:bg-[#DC2626] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  {erasingAccount ? 'Erasing Account...' : 'Permanently Erase My Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSave}
          className="bg-white border border-[#E2E8F0] rounded-2xl p-6 space-y-6"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#0B3D91]" />
              <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                Preferred Language (12 Official Languages)
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {LANGUAGE_LIST.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => onLanguageChange(l.code)}
                  className={`p-3 rounded-xl border text-left cursor-pointer ${
                    languageCode === l.code
                      ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                      : 'bg-white border-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <p className="font-semibold text-sm">{l.nativeName}</p>
                  <p className={`text-xs ${languageCode === l.code ? 'text-[#DBEAFE]' : 'text-[#475569]'}`}>
                    {l.name}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[#E2E8F0] space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
              Accessibility Options
            </h2>
            <div className="flex flex-wrap gap-3">
              <EasyReadToggle
                largeMode={largeMode}
                onToggle={onToggleLargeMode}
                languageCode={languageCode}
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-[#0F172A] cursor-pointer">
              <input
                type="checkbox"
                checked={audioGuidance}
                onChange={(e) => setAudioGuidance(e.target.checked)}
                className="w-5 h-5 accent-[#0B3D91]"
              />
              <span>Show Audio Guidance (Read Aloud) controls across onboarding and guides</span>
            </label>
            <label className="flex items-center gap-3 text-sm text-[#0F172A] cursor-pointer">
              <input
                type="checkbox"
                checked={voiceInput}
                onChange={(e) => setVoiceInput(e.target.checked)}
                className="w-5 h-5 accent-[#0B3D91]"
              />
              <span>Enable Voice Dictation buttons on form fields</span>
            </label>
          </div>

          <div className="pt-4 border-t border-[#E2E8F0] space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1F3A]">
              <Shield className="w-4 h-4 text-[#174C3C]" />
              <span>Active Role Permissions ({user.permissions.length})</span>
            </div>
            <p className="text-xs font-mono text-[#475569]">
              {user.permissions.join(' · ')}
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white font-semibold text-sm cursor-pointer"
          >
            {saving ? 'Saving Preferences...' : 'Save Application Settings'}
          </button>
        </form>
      )}

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
                  {selectedNotice.category.replace(/_/g, ' ')} ·{' '}
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
              <div className="flex justify-end">
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
