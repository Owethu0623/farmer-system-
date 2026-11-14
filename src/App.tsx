import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertOctagon,
  Award,
  Beef,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  CloudOff,
  CloudRain,
  FileSpreadsheet,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Mountain,
  Package,
  Settings,
  Shield,
  Sparkles,
  Sprout,
  Tractor,
  User,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import {
  EasyReadToggle,
  LanguageSelector,
  SaslBanner,
} from './components/AccessibilityControls';
import { AdminPortalView } from './components/AdminPortalView';
import { AuthViews } from './components/AuthViews';
import { BusinessPlannerView } from './components/BusinessPlannerView';
import { CropManagementView } from './components/CropManagementView';
import { ExpertPortalView } from './components/ExpertPortalView';
import { FarmManagement } from './components/FarmManagement';
import { GeminiAdvisorPanel } from './components/GeminiAdvisorPanel';
import { IncidentDamageView } from './components/IncidentDamageView';
import { LandingPage } from './components/LandingPage';
import { LearningCentreView } from './components/LearningCentreView';
import { LivestockMixedView } from './components/LivestockMixedView';
import { NotificationCentreView } from './components/NotificationCentreView';
import { OfflineSyncView } from './components/OfflineSyncView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { OrganisationPortalView } from './components/OrganisationPortalView';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { ReportingExportsView } from './components/ReportingExportsView';
import { RoleDashboard } from './components/RoleDashboards';
import { SoilLandView } from './components/SoilLandView';
import { StockInventoryView } from './components/StockInventoryView';
import { VisualAnalysisView } from './components/VisualAnalysisView';
import { WeatherIntelligenceView } from './components/WeatherIntelligenceView';
import { useAccessibility } from './hooks/useAccessibility';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { PWAInstallButton } from './hooks/usePWAInstall';
import { applyTranslationOverrides, t } from './i18n/translations';
import { apiRequest, getStoredToken, setStoredToken } from './lib/api';
import {
  downloadAndStoreOfflineBundle,
  loadOfflineBundle,
  loadOfflineQueue,
  syncPendingQueue,
} from './lib/offlineSync';
import {
  AuthUser,
  FarmItem,
  LanguageCode,
  NotificationItem,
  ProvinceInfo,
} from './types';

type WorkspaceTab =
  | 'dashboard'
  | 'expert_portal'
  | 'organisation_portal'
  | 'farms'
  | 'crops'
  | 'livestock'
  | 'mixed'
  | 'soil'
  | 'weather'
  | 'visual'
  | 'stock'
  | 'incidents'
  | 'planner'
  | 'learning'
  | 'reports'
  | 'advisor'
  | 'notifications'
  | 'admin'
  | 'offline'
  | 'profile'
  | 'settings';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [publicView, setPublicView] = useState<'landing' | 'auth'>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  const [preselectRole, setPreselectRole] = useState<
    'prospective_farmer' | 'existing_farmer' | undefined
  >(undefined);

  const [languageCode, setLanguageCode] = useState<LanguageCode>('en');
  const [largeMode, setLargeMode] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [provinces, setProvinces] = useState<ProvinceInfo[]>([]);
  const [farms, setFarms] = useState<FarmItem[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activationBannerCode, setActivationBannerCode] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [offlineCacheTimestamp, setOfflineCacheTimestamp] = useState<string | null>(null);

  const { isOnline } = useOnlineStatus();

  const {
    speak,
    stopSpeaking,
    isSpeaking,
    startVoiceInput,
    isListening,
    speechSupported,
    recognitionSupported,
  } = useAccessibility(languageCode, largeMode);

  useEffect(() => {
    try {
      registerSW({ immediate: true });
    } catch {
      // Service worker registration skipped in non-supported contexts
    }
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    try {
      const [farmsData, notifData] = await Promise.all([
        apiRequest<FarmItem[]>('/api/farms'),
        apiRequest<NotificationItem[]>('/api/notifications'),
      ]);
      setFarms(farmsData);
      setNotifications(notifData);
      if (farmsData.length > 0 && !selectedFarmId) {
        setSelectedFarmId(farmsData[0].id);
      }
      setRefreshKey((k) => k + 1);
    } catch {
      if (user?.id) {
        const cached = await loadOfflineBundle(user.id);
        if (cached) {
          setFarms(cached.farms);
          setOfflineCacheTimestamp(cached.downloadedAt);
          if (cached.farms.length > 0 && !selectedFarmId) {
            setSelectedFarmId(cached.farms[0].id);
          }
        }
      }
    }
  }, [selectedFarmId, user?.id]);

  const handleOperationalDataChanged = useCallback(() => {
    setRefreshKey((k) => k + 1);
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const refreshMetaTranslations = useCallback(() => {
    apiRequest<{
      overrides: { languageCode: LanguageCode; key: string; value: string }[];
    }>('/api/meta/translations')
      .then((res) => {
        if (Array.isArray(res.overrides)) {
          applyTranslationOverrides(res.overrides);
          setRefreshKey((k) => k + 1);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiRequest<ProvinceInfo[]>('/api/meta/provinces')
      .then(setProvinces)
      .catch(() => {});
    refreshMetaTranslations();

    const token = getStoredToken();
    if (!token) {
      // Check cookie session as well
      apiRequest<{ user: AuthUser }>('/api/auth/me')
        .then((res) => {
          setUser(res.user);
          setLanguageCode(res.user.preferredLanguageCode);
          setLargeMode(Boolean(res.user.profile?.accessibilityLargeText));
        })
        .catch(() => {})
        .finally(() => setBooting(false));
      return;
    }

    apiRequest<{ user: AuthUser }>('/api/auth/me')
      .then((res) => {
        setUser(res.user);
        setLanguageCode(res.user.preferredLanguageCode);
        setLargeMode(Boolean(res.user.profile?.accessibilityLargeText));
      })
      .catch(() => setStoredToken(null))
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (user && user.onboardingCompleted) {
      loadWorkspaceData();
    }
  }, [user, loadWorkspaceData]);

  useEffect(() => {
    if (!user?.id) {
      setPendingSyncCount(0);
      setOfflineCacheTimestamp(null);
      return;
    }
    const refreshQueueBadge = async () => {
      const [q, b] = await Promise.all([loadOfflineQueue(user.id), loadOfflineBundle(user.id)]);
      setPendingSyncCount(q.length);
      setOfflineCacheTimestamp(b?.downloadedAt || null);
    };
    refreshQueueBadge();
    const handler = () => {
      refreshQueueBadge();
    };
    window.addEventListener('fieldshift-offline-queue-changed', handler);
    return () => {
      window.removeEventListener('fieldshift-offline-queue-changed', handler);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!isOnline || !user?.id || !user.onboardingCompleted || user.roleCode === 'organisation_manager') {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const q = await loadOfflineQueue(user.id);
        const pendingTargets = q.filter((item) => item.syncState === 'pending');
        if (pendingTargets.length > 0 && !cancelled) {
          const res = await syncPendingQueue(user.id);
          if (!cancelled && res.syncedCount > 0) {
            loadWorkspaceData();
          }
        }
        if (!cancelled) {
          const refreshed = await downloadAndStoreOfflineBundle(user.id);
          if (!cancelled) {
            setOfflineCacheTimestamp(refreshed.downloadedAt);
          }
        }
      } catch {
        // Retry on next connection or manual sync
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOnline, user?.id, user?.onboardingCompleted, user?.roleCode, loadWorkspaceData]);

  const handleLanguageChange = async (code: LanguageCode) => {
    setLanguageCode(code);
    if (user) {
      try {
        const res = await apiRequest<{ user: AuthUser }>('/api/profile', {
          method: 'PUT',
          body: JSON.stringify({ preferredLanguageCode: code }),
        });
        setUser(res.user);
      } catch {
        // ignore
      }
    }
  };

  const handleToggleLargeMode = async () => {
    const next = !largeMode;
    setLargeMode(next);
    if (user) {
      try {
        const res = await apiRequest<{ user: AuthUser }>('/api/profile', {
          method: 'PUT',
          body: JSON.stringify({ accessibilityLargeText: next }),
        });
        setUser(res.user);
      } catch {
        // ignore
      }
    }
  };

  const handleLogout = async () => {
    stopSpeaking();
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    setFarms([]);
    setPublicView('landing');
    setActiveTab('dashboard');
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-[#F6F7F4] flex items-center justify-center">
        <p className="font-display font-semibold text-[#143326]">Loading Field Shift...</p>
      </div>
    );
  }

  // Unauthenticated Public Experience
  if (!user) {
    if (publicView === 'auth') {
      return (
        <AuthViews
          initialMode={authMode}
          preselectRole={preselectRole}
          languageCode={languageCode}
          onLanguageChange={handleLanguageChange}
          isSpeaking={isSpeaking}
          onSpeak={speak}
          onStopSpeaking={stopSpeaking}
          speechSupported={speechSupported}
          onBackHome={() => setPublicView('landing')}
          onAuthenticated={(authedUser, actCode) => {
            setUser(authedUser);
            setLanguageCode(authedUser.preferredLanguageCode);
            setLargeMode(Boolean(authedUser.profile?.accessibilityLargeText));
            if (actCode) setActivationBannerCode(actCode);
            setActiveTab('dashboard');
          }}
        />
      );
    }

    return (
      <LandingPage
        languageCode={languageCode}
        onLanguageChange={handleLanguageChange}
        largeMode={largeMode}
        onToggleLargeMode={handleToggleLargeMode}
        isSpeaking={isSpeaking}
        onSpeak={speak}
        onStopSpeaking={stopSpeaking}
        speechSupported={speechSupported}
        onNavigateAuth={(mode, role) => {
          setAuthMode(mode);
          setPreselectRole(role);
          setPublicView('auth');
        }}
      />
    );
  }

  // Onboarding Gate for Prospective & Existing Farmers
  if (
    !user.onboardingCompleted &&
    (user.roleCode === 'prospective_farmer' || user.roleCode === 'existing_farmer')
  ) {
    return (
      <OnboardingWizard
        user={user}
        provinces={provinces}
        languageCode={languageCode}
        onLanguageChange={handleLanguageChange}
        isSpeaking={isSpeaking}
        isListening={isListening}
        speechSupported={speechSupported}
        recognitionSupported={recognitionSupported}
        onSpeak={speak}
        onStopSpeaking={stopSpeaking}
        onStartVoiceInput={startVoiceInput}
        onCompleted={(updatedUser) => {
          setUser(updatedUser);
          loadWorkspaceData();
        }}
      />
    );
  }

  // Dedicated System Administrator Portal (dark forest-green sidebar shell without double sidebars)
  if (
    user.roleCode === 'system_administrator' &&
    (activeTab === 'dashboard' || activeTab === 'admin')
  ) {
    return (
      <AdminPortalView
        user={user}
        onNavigateWorkspace={(tab) => setActiveTab(tab)}
        onTranslationsUpdated={refreshMetaTranslations}
        onLogout={handleLogout}
      />
    );
  }

  const isAdminWithPrivateAccess =
    user.roleCode === 'system_administrator' &&
    user.permissions.includes('admin:private_farmer_records');

  const showFarmOps =
    user.roleCode === 'existing_farmer' ||
    user.roleCode === 'agricultural_expert' ||
    isAdminWithPrivateAccess;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const navItems: { id: WorkspaceTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    {
      id: 'dashboard',
      label: t(languageCode, 'navDashboard'),
      icon: <LayoutDashboard className="w-5 h-5" />,
      show:
        user.roleCode !== 'system_administrator' &&
        user.roleCode !== 'agricultural_expert' &&
        user.roleCode !== 'organisation_manager',
    },
    {
      id: 'expert_portal',
      label: t(languageCode, 'navExpertPortal'),
      icon: <Award className="w-5 h-5" />,
      show: user.roleCode === 'agricultural_expert',
    },
    {
      id: 'organisation_portal',
      label: t(languageCode, 'navOrganisationPortal'),
      icon: <Building2 className="w-5 h-5" />,
      show: user.roleCode === 'organisation_manager',
    },
    {
      id: 'farms',
      label: t(languageCode, 'navFarms'),
      icon: <Tractor className="w-5 h-5" />,
      show: showFarmOps,
    },
    {
      id: 'crops',
      label: t(languageCode, 'navCrops'),
      icon: <Sprout className="w-5 h-5" />,
      show: showFarmOps,
    },
    {
      id: 'livestock',
      label: t(languageCode, 'navLivestock'),
      icon: <Beef className="w-5 h-5" />,
      show: showFarmOps,
    },
    {
      id: 'mixed',
      label: t(languageCode, 'navMixed'),
      icon: <Layers className="w-5 h-5" />,
      show: showFarmOps,
    },
    {
      id: 'soil',
      label: t(languageCode, 'navSoilLand'),
      icon: <Mountain className="w-5 h-5" />,
      show: showFarmOps,
    },
    {
      id: 'weather',
      label: t(languageCode, 'navWeather'),
      icon: <CloudRain className="w-5 h-5" />,
      show: showFarmOps,
    },
    {
      id: 'visual',
      label: t(languageCode, 'navVisualAnalysis'),
      icon: <Camera className="w-5 h-5" />,
      show: showFarmOps,
    },
    {
      id: 'stock',
      label: t(languageCode, 'navStock'),
      icon: <Package className="w-5 h-5" />,
      show: showFarmOps,
    },
    {
      id: 'incidents',
      label: t(languageCode, 'navIncidents'),
      icon: <AlertOctagon className="w-5 h-5" />,
      show: showFarmOps,
    },
    {
      id: 'planner',
      label: t(languageCode, 'navBusinessPlanner'),
      icon: <Briefcase className="w-5 h-5" />,
      show: true,
    },
    {
      id: 'learning',
      label: t(languageCode, 'navLearningCentre'),
      icon: <BookOpen className="w-5 h-5" />,
      show: true,
    },
    {
      id: 'reports',
      label: t(languageCode, 'navReports'),
      icon: <FileSpreadsheet className="w-5 h-5" />,
      show: true,
    },
    {
      id: 'advisor',
      label: t(languageCode, 'navAdvisor'),
      icon: <Sparkles className="w-5 h-5" />,
      show: user.roleCode !== 'system_administrator',
    },
    {
      id: 'notifications',
      label:
        unreadCount > 0
          ? `${t(languageCode, 'navNotifications')} (${unreadCount})`
          : t(languageCode, 'navNotifications'),
      icon: <Bell className="w-5 h-5" />,
      show: true,
    },
    {
      id: 'admin',
      label: t(languageCode, 'navAdminPortal'),
      icon: <Shield className="w-5 h-5" />,
      show: user.roleCode === 'system_administrator',
    },
    {
      id: 'offline',
      label:
        pendingSyncCount > 0
          ? `${t(languageCode, 'navOfflineSync')} (${pendingSyncCount})`
          : t(languageCode, 'navOfflineSync'),
      icon: <CloudOff className="w-5 h-5" />,
      show: user.roleCode !== 'organisation_manager',
    },
    {
      id: 'profile',
      label: t(languageCode, 'navProfile'),
      icon: <User className="w-5 h-5" />,
      show: true,
    },
    {
      id: 'settings',
      label: t(languageCode, 'navSettings'),
      icon: <Settings className="w-5 h-5" />,
      show: true,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F6F7F4] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-[#E2E6DF]">
        <div className="h-16 px-6 flex items-center border-b border-[#E2E6DF]">
          <span className="font-display text-xl font-bold tracking-tight text-[#143326]">
            Field Shift
          </span>
        </div>

        <nav className="flex-1 px-4 py-5 space-y-1.5">
          {navItems
            .filter((i) => i.show)
            .map((item) => {
              const active =
                activeTab === item.id ||
                (activeTab === 'dashboard' &&
                  ((item.id === 'expert_portal' && user.roleCode === 'agricultural_expert') ||
                    (item.id === 'organisation_portal' &&
                      user.roleCode === 'organisation_manager')));
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1B4332] text-white'
                      : 'text-[#35443B] hover:bg-[#EDF2EC] hover:text-[#143326]'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
        </nav>

        <div className="p-4 border-t border-[#E2E6DF] space-y-3">
          <div className="px-2">
            <p className="text-sm font-semibold text-[#143326] truncate">
              {user.profile?.fullName || user.email}
            </p>
            <p className="text-xs text-[#4A5A50] truncate">{user.roleName}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[#D4DDD2] hover:bg-[#FDF2F2] hover:text-[#8E2424] text-sm font-semibold text-[#17201B] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{t(languageCode, 'signOut')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Workspace Utility Bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-[#E2E6DF] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-2 rounded-lg border border-[#D4DDD2] text-[#143326]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="font-display font-bold text-[#143326] lg:hidden">Field Shift</span>
            <span className="hidden sm:inline text-xs font-medium text-[#4A5A50]">
              {user.roleName} · {user.profile?.province || 'South Africa'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => setActiveTab('offline')}
              title={
                offlineCacheTimestamp
                  ? `Offline pack downloaded ${new Date(offlineCacheTimestamp).toLocaleString()}`
                  : 'Open Offline Storage & Sync'
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                !isOnline
                  ? 'bg-[#FDF2F2] border-[#E8B4B4] text-[#8E2424]'
                  : pendingSyncCount > 0
                  ? 'bg-[#FDF8EE] border-[#E5D3A3] text-[#8A5A00]'
                  : 'bg-[#F6F7F4] border-[#D4DDD2] text-[#143326] hover:bg-[#EDF2EC]'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>
                {isOnline
                  ? pendingSyncCount > 0
                    ? `Sync (${pendingSyncCount})`
                    : 'Online'
                  : `Offline${pendingSyncCount > 0 ? ` · ${pendingSyncCount} Queued` : ' · Cached'}`}
              </span>
            </button>
            <PWAInstallButton />
            <LanguageSelector value={languageCode} onChange={handleLanguageChange} compact />
            <div className="hidden sm:block">
              <EasyReadToggle
                largeMode={largeMode}
                onToggle={handleToggleLargeMode}
                languageCode={languageCode}
              />
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className="px-3 py-1.5 rounded-lg bg-[#EDF5EF] text-[#1B4332] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                {unreadCount} Alert{unreadCount === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-[#E2E6DF] px-4 py-3 space-y-1.5">
            {navItems
              .filter((i) => i.show)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold ${
                    activeTab === item.id
                      ? 'bg-[#1B4332] text-white'
                      : 'text-[#35443B] hover:bg-[#EDF2EC]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#8E2424]"
            >
              <LogOut className="w-5 h-5" />
              <span>{t(languageCode, 'signOut')}</span>
            </button>
          </div>
        )}

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
          <SaslBanner languageCode={languageCode} />

          {activationBannerCode && !user.isEmailVerified && (
            <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[#143326]">
              <span>
                Your account activation code is{' '}
                <span className="font-mono font-bold">{activationBannerCode}</span>. You can verify it anytime in Profile.
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="font-semibold text-[#1B4332] underline cursor-pointer"
              >
                Activate Now
              </button>
            </div>
          )}

          {(activeTab === 'expert_portal' ||
            (activeTab === 'dashboard' && user.roleCode === 'agricultural_expert')) && (
            <ExpertPortalView
              user={user}
              provinces={provinces}
              onRefreshWorkspace={loadWorkspaceData}
            />
          )}

          {(activeTab === 'organisation_portal' ||
            (activeTab === 'dashboard' && user.roleCode === 'organisation_manager')) && (
            <OrganisationPortalView
              user={user}
              provinces={provinces}
              onOpenReportsView={() => setActiveTab('reports')}
            />
          )}

          {activeTab === 'dashboard' &&
            user.roleCode !== 'agricultural_expert' &&
            user.roleCode !== 'organisation_manager' && (
              <RoleDashboard
                user={user}
                farms={farms}
                selectedFarmId={selectedFarmId}
                onSelectFarm={setSelectedFarmId}
                onOpenFarmsView={() => setActiveTab('farms')}
                onOpenCropsView={() => setActiveTab('crops')}
                onOpenLivestockView={() => setActiveTab('livestock')}
                onOpenMixedView={() => setActiveTab('mixed')}
                onOpenSoilLandView={() => setActiveTab('soil')}
                onOpenWeatherView={() => setActiveTab('weather')}
                onOpenVisualView={() => setActiveTab('visual')}
                onOpenStockView={() => setActiveTab('stock')}
                onOpenIncidentsView={() => setActiveTab('incidents')}
                onOpenPlannerView={() => setActiveTab('planner')}
                onOpenLearningView={() => setActiveTab('learning')}
                onOpenAdvisorView={() => setActiveTab('advisor')}
                onOpenReportsView={() => setActiveTab('reports')}
                refreshKey={refreshKey}
                provinces={provinces}
                languageCode={languageCode}
                isSpeaking={isSpeaking}
                speechSupported={speechSupported}
                onSpeak={speak}
                onStopSpeaking={stopSpeaking}
              />
            )}

          {activeTab === 'farms' && (
            <FarmManagement
              user={user}
              farms={farms}
              selectedFarmId={selectedFarmId}
              onSelectFarm={setSelectedFarmId}
              onRefreshFarms={loadWorkspaceData}
              provinces={provinces}
              languageCode={languageCode}
              isListening={isListening}
              recognitionSupported={recognitionSupported}
              onStartVoiceInput={startVoiceInput}
            />
          )}

          {activeTab === 'crops' && (
            <CropManagementView
              userId={user.id}
              farms={farms}
              selectedFarmId={selectedFarmId}
              onSelectFarmFilter={setSelectedFarmId}
              onDataChanged={handleOperationalDataChanged}
            />
          )}

          {(activeTab === 'livestock' || activeTab === 'mixed') && (
            <LivestockMixedView
              userId={user.id}
              initialSection={activeTab === 'mixed' ? 'mixed' : 'livestock'}
              farms={farms}
              selectedFarmId={selectedFarmId}
              onDataChanged={handleOperationalDataChanged}
            />
          )}

          {activeTab === 'soil' && (
            <SoilLandView
              farms={farms}
              selectedFarmId={selectedFarmId}
              onSelectFarm={setSelectedFarmId}
              languageCode={languageCode}
              isSpeaking={isSpeaking}
              speechSupported={speechSupported}
              onSpeak={speak}
              onStopSpeaking={stopSpeaking}
            />
          )}

          {activeTab === 'weather' && (
            <WeatherIntelligenceView
              userId={user.id}
              farms={farms}
              selectedFarmId={selectedFarmId}
              onSelectFarm={setSelectedFarmId}
              languageCode={languageCode}
              userRoleCode={user.roleCode}
              isSpeaking={isSpeaking}
              speechSupported={speechSupported}
              onSpeak={speak}
              onStopSpeaking={stopSpeaking}
            />
          )}

          {activeTab === 'visual' && (
            <VisualAnalysisView
              farms={farms}
              selectedFarmId={selectedFarmId}
              onSelectFarm={(id) => setSelectedFarmId(id)}
              languageCode={languageCode}
              isSpeaking={isSpeaking}
              isListening={isListening}
              speechSupported={speechSupported}
              recognitionSupported={recognitionSupported}
              onSpeak={speak}
              onStopSpeaking={stopSpeaking}
              onStartVoiceInput={startVoiceInput}
              onDataChanged={handleOperationalDataChanged}
              onOpenIncidentsView={() => setActiveTab('incidents')}
            />
          )}

          {activeTab === 'stock' && (
            <StockInventoryView
              userId={user.id}
              farms={farms}
              selectedFarmId={selectedFarmId}
              onSelectFarm={setSelectedFarmId}
              onDataChanged={handleOperationalDataChanged}
            />
          )}

          {activeTab === 'incidents' && (
            <IncidentDamageView
              userId={user.id}
              farms={farms}
              selectedFarmId={selectedFarmId}
              onSelectFarm={setSelectedFarmId}
              onDataChanged={handleOperationalDataChanged}
            />
          )}

          {activeTab === 'planner' && (
            <BusinessPlannerView
              user={user}
              farms={farms}
              provinces={provinces}
              languageCode={languageCode}
              isSpeaking={isSpeaking}
              speechSupported={speechSupported}
              onSpeak={speak}
              onStopSpeaking={stopSpeaking}
            />
          )}

          {activeTab === 'learning' && (
            <LearningCentreView
              user={user}
              languageCode={languageCode}
              largeMode={largeMode}
              isSpeaking={isSpeaking}
              speechSupported={speechSupported}
              onSpeak={speak}
              onStopSpeaking={stopSpeaking}
            />
          )}

          {activeTab === 'reports' && (
            <ReportingExportsView
              user={user}
              farms={farms}
              selectedFarmId={selectedFarmId}
            />
          )}

          {activeTab === 'advisor' && (
            <GeminiAdvisorPanel
              user={user}
              farms={farms}
              selectedFarmId={selectedFarmId}
              languageCode={languageCode}
              isSpeaking={isSpeaking}
              isListening={isListening}
              speechSupported={speechSupported}
              recognitionSupported={recognitionSupported}
              onSpeak={speak}
              onStopSpeaking={stopSpeaking}
              onStartVoiceInput={startVoiceInput}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationCentreView
              user={user}
              languageCode={languageCode}
              onNavigateTab={(tab) => setActiveTab(tab as WorkspaceTab)}
              onNotificationsChanged={loadWorkspaceData}
            />
          )}

          {activeTab === 'offline' && (
            <OfflineSyncView
              user={user}
              farms={farms}
              onSyncedDataChanged={handleOperationalDataChanged}
              onNavigateTab={(tab) => setActiveTab(tab as WorkspaceTab)}
            />
          )}

          {(activeTab === 'profile' || activeTab === 'settings') && (
            <ProfileSettingsView
              mode={activeTab}
              user={user}
              notifications={notifications}
              languageCode={languageCode}
              largeMode={largeMode}
              onToggleLargeMode={handleToggleLargeMode}
              onLanguageChange={handleLanguageChange}
              onUserUpdated={setUser}
              onNotificationsRefresh={loadWorkspaceData}
              onOpenNotifications={() => setActiveTab('notifications')}
              onAccountErased={() => {
                setStoredToken(null);
                setUser(null);
                setFarms([]);
                setPublicView('landing');
                setActiveTab('dashboard');
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
