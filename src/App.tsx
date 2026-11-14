import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Award,
  Beef,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  CloudRain,
  FileSpreadsheet,
  Info,
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
import { FarmTransitionModal } from './components/FarmTransitionModal';
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
  BusinessPlanScenarioItem,
  FarmItem,
  LanguageCode,
  NotificationItem,
  ProvinceInfo,
  SavedProspectiveLocationItem,
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [provinces, setProvinces] = useState<ProvinceInfo[]>([]);
  const [farms, setFarms] = useState<FarmItem[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const [selectedNotifDetail, setSelectedNotifDetail] = useState<NotificationItem | null>(null);
  const [farmTransitionOpen, setFarmTransitionOpen] = useState(false);
  const [transitionSavedLocations, setTransitionSavedLocations] = useState<
    SavedProspectiveLocationItem[]
  >([]);
  const [transitionSavedPlans, setTransitionSavedPlans] = useState<BusinessPlanScenarioItem[]>([]);
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

  const handleOpenFarmTransitionModal = useCallback(async () => {
    try {
      const [prospDash, plannerOverview] = await Promise.all([
        apiRequest<{ savedLocations?: SavedProspectiveLocationItem[] }>(
          '/api/dashboard/prospective'
        ).catch(() => ({ savedLocations: [] })),
        apiRequest<{ savedPlans?: BusinessPlanScenarioItem[] }>(
          '/api/business-planner/overview'
        ).catch(() => ({ savedPlans: [] })),
      ]);
      setTransitionSavedLocations(prospDash.savedLocations || []);
      setTransitionSavedPlans(plannerOverview.savedPlans || []);
    } catch {
      // proceed with empty defaults if unavailable
    }
    setFarmTransitionOpen(true);
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setSelectedNotifDetail((curr) => (curr && curr.id === id ? { ...curr, isRead: true } : curr));
    } catch {
      // ignore read toggle error
    }
  }, []);

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
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center">
        <p className="font-display font-semibold text-[#0B1F3A]">Loading Field Shift...</p>
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
      icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
      show:
        user.roleCode !== 'system_administrator' &&
        user.roleCode !== 'agricultural_expert' &&
        user.roleCode !== 'organisation_manager',
    },
    {
      id: 'admin',
      label: t(languageCode, 'navAdminPortal'),
      icon: <Shield className="w-5 h-5 shrink-0" />,
      show: user.roleCode === 'system_administrator',
    },
    {
      id: 'expert_portal',
      label: t(languageCode, 'navExpertPortal'),
      icon: <Award className="w-5 h-5 shrink-0" />,
      show: user.roleCode === 'agricultural_expert',
    },
    {
      id: 'organisation_portal',
      label: t(languageCode, 'navOrganisationPortal'),
      icon: <Building2 className="w-5 h-5 shrink-0" />,
      show: user.roleCode === 'organisation_manager',
    },
    {
      id: 'farms',
      label: t(languageCode, 'navFarms'),
      icon: <Tractor className="w-5 h-5 shrink-0" />,
      show: showFarmOps,
    },
    {
      id: 'crops',
      label: t(languageCode, 'navCrops'),
      icon: <Sprout className="w-5 h-5 shrink-0" />,
      show: showFarmOps,
    },
    {
      id: 'livestock',
      label: t(languageCode, 'navLivestock'),
      icon: <Beef className="w-5 h-5 shrink-0" />,
      show: showFarmOps,
    },
    {
      id: 'mixed',
      label: t(languageCode, 'navMixed'),
      icon: <Layers className="w-5 h-5 shrink-0" />,
      show: showFarmOps,
    },
    {
      id: 'soil',
      label: t(languageCode, 'navSoilLand'),
      icon: <Mountain className="w-5 h-5 shrink-0" />,
      show: showFarmOps || user.roleCode === 'prospective_farmer',
    },
    {
      id: 'weather',
      label: t(languageCode, 'navWeather'),
      icon: <CloudRain className="w-5 h-5 shrink-0" />,
      show: showFarmOps || user.roleCode === 'prospective_farmer',
    },
    {
      id: 'visual',
      label: t(languageCode, 'navVisualAnalysis'),
      icon: <Camera className="w-5 h-5 shrink-0" />,
      show: showFarmOps,
    },
    {
      id: 'stock',
      label: t(languageCode, 'navStock'),
      icon: <Package className="w-5 h-5 shrink-0" />,
      show: showFarmOps,
    },
    {
      id: 'incidents',
      label: t(languageCode, 'navIncidents'),
      icon: <AlertOctagon className="w-5 h-5 shrink-0" />,
      show: showFarmOps,
    },
    {
      id: 'planner',
      label: t(languageCode, 'navBusinessPlanner'),
      icon: <Briefcase className="w-5 h-5 shrink-0" />,
      show: user.roleCode !== 'system_administrator',
    },
    {
      id: 'learning',
      label: t(languageCode, 'navLearningCentre'),
      icon: <BookOpen className="w-5 h-5 shrink-0" />,
      show: true,
    },
    {
      id: 'reports',
      label: t(languageCode, 'navReports'),
      icon: <FileSpreadsheet className="w-5 h-5 shrink-0" />,
      show: user.roleCode !== 'prospective_farmer',
    },
    {
      id: 'advisor',
      label: t(languageCode, 'navAdvisor'),
      icon: <Sparkles className="w-5 h-5 shrink-0" />,
      show: user.roleCode !== 'system_administrator',
    },
    {
      id: 'notifications',
      label:
        unreadCount > 0
          ? `${t(languageCode, 'navNotifications')} (${unreadCount})`
          : t(languageCode, 'navNotifications'),
      icon: <Bell className="w-5 h-5 shrink-0" />,
      show: true,
    },
    {
      id: 'offline',
      label:
        pendingSyncCount > 0
          ? `${t(languageCode, 'navOfflineSync')} (${pendingSyncCount})`
          : t(languageCode, 'navOfflineSync'),
      icon: <CloudOff className="w-5 h-5 shrink-0" />,
      show: user.roleCode !== 'organisation_manager' && user.roleCode !== 'system_administrator',
    },
  ];

  const isNavItemActive = (itemId: WorkspaceTab) =>
    activeTab === itemId ||
    (activeTab === 'dashboard' &&
      ((itemId === 'expert_portal' && user.roleCode === 'agricultural_expert') ||
        (itemId === 'organisation_portal' && user.roleCode === 'organisation_manager') ||
        (itemId === 'admin' && user.roleCode === 'system_administrator')));

  return (
    <div className="h-screen overflow-hidden bg-[#F1F5F9] flex flex-col lg:flex-row">
      {/* Unified Collapsible Desktop Sidebar for All 5 Roles */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:shrink-0 h-full bg-[#0B1F3A] text-white border-r border-[#163055] transition-all duration-200 ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        {/* Fixed Branding Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#163055] shrink-0">
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <span className="font-display text-lg font-bold tracking-tight text-white block truncate">
                Field Shift
              </span>
              <span className="text-[11px] font-mono text-[#93C5FD] uppercase tracking-wider block truncate">
                {user.roleCode === 'system_administrator' ? 'System Admin' : 'SA Agri Platform'}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-[#163055] min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer mx-auto lg:mx-0"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Independently Scrolling Primary Navigation */}
        <nav
          aria-label="Primary Workspace Navigation"
          className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1"
        >
          {navItems
            .filter((i) => i.show)
            .map((item) => {
              const active = isNavItemActive(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  title={sidebarCollapsed ? item.label : undefined}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center ${
                    sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3.5'
                  } py-2.5 min-h-[44px] rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0B3D91] text-white'
                      : 'text-[#CBD5E1] hover:bg-[#163055] hover:text-white'
                  }`}
                >
                  {item.icon}
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
        </nav>

        {/* Pinned Bottom Utility Footer (Profile, Settings, Sign Out) */}
        <div className="p-3 border-t border-[#163055] space-y-1.5 shrink-0 bg-[#08172C]">
          {!sidebarCollapsed && (
            <div className="px-2 pb-1">
              <p className="text-xs font-semibold text-white truncate">
                {user.profile?.fullName || user.email}
              </p>
              <p className="text-[11px] text-[#93C5FD] truncate">{user.roleName}</p>
            </div>
          )}

          <button
            type="button"
            title={sidebarCollapsed ? t(languageCode, 'navProfile') : undefined}
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center ${
              sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3.5'
            } py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#0B3D91] text-white'
                : 'text-[#E2E8F0] hover:bg-[#163055]'
            }`}
          >
            <User className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>{t(languageCode, 'navProfile')}</span>}
          </button>

          <button
            type="button"
            title={sidebarCollapsed ? t(languageCode, 'navSettings') : undefined}
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center ${
              sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3.5'
            } py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#0B3D91] text-white'
                : 'text-[#E2E8F0] hover:bg-[#163055]'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>{t(languageCode, 'navSettings')}</span>}
          </button>

          <button
            type="button"
            title={sidebarCollapsed ? t(languageCode, 'signOut') : undefined}
            onClick={handleLogout}
            className={`w-full flex items-center ${
              sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3.5'
            } py-2 min-h-[40px] rounded-xl border border-[#334155] hover:bg-[#FC3D21] hover:border-[#FC3D21] text-xs font-semibold text-white transition-colors cursor-pointer`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>{t(languageCode, 'signOut')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top Workspace Utility Bar */}
        <header className="shrink-0 z-20 bg-white border-b border-[#CBD5E1] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-2 min-h-[40px] min-w-[40px] rounded-lg border border-[#CBD5E1] text-[#0B1F3A] flex items-center justify-center"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="font-display font-bold text-[#0B1F3A] lg:hidden">Field Shift</span>
            <span className="hidden sm:inline text-xs font-semibold text-[#334155] truncate">
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                !isOnline
                  ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                  : pendingSyncCount > 0
                  ? 'bg-[#FFF7ED] border-[#FED7AA] text-[#9A3412]'
                  : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0B1F3A] hover:bg-[#E2E8F0]'
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifPopoverOpen((o) => !o)}
                aria-expanded={notifPopoverOpen}
                aria-label={`Notifications: ${unreadCount} unread notifications`}
                className={`inline-flex items-center gap-2 px-3 py-1.5 min-h-[40px] rounded-lg border text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                  unreadCount > 0
                    ? 'bg-[#EFF6FF] border-[#93C5FD] text-[#0B3D91] hover:bg-[#DBEAFE]'
                    : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#334155] hover:bg-[#E2E8F0]'
                }`}
              >
                <Bell className="w-4 h-4 shrink-0" />
                <span>
                  {unreadCount} Unread {unreadCount === 1 ? 'Notification' : 'Notifications'}
                </span>
              </button>

              {notifPopoverOpen && (
                <div className="absolute right-0 mt-2 w-[340px] sm:w-[400px] bg-white border border-slate-300 rounded-md shadow-xl z-40 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-[#0B1F3A] text-white">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Bell className="w-4 h-4 text-sky-300" />
                      <span>
                        Notifications ({unreadCount} unread)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNotifPopoverOpen(false);
                          setActiveTab('notifications');
                        }}
                        className="text-xs font-semibold text-sky-200 hover:text-white underline"
                      >
                        Open All
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifPopoverOpen(false)}
                        aria-label="Close notification preview"
                        className="text-slate-300 hover:text-white p-0.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-200">
                    {notifications.length === 0 ? (
                      <div className="p-5 text-center text-xs text-slate-600">
                        No notifications yet. Weather warnings, reminders, and agricultural updates will appear here.
                      </div>
                    ) : (
                      notifications.slice(0, 6).map((n) => {
                        const isCritical =
                          n.priority === 'urgent' ||
                          n.category === 'agricultural_incident' ||
                          n.category === 'account_security';
                        const isWarning =
                          !isCritical &&
                          (n.priority === 'high' || n.category === 'weather_warning');
                        return (
                          <div
                            key={n.id}
                            className={`p-3.5 text-left transition-colors ${
                              !n.isRead ? 'bg-sky-50/60' : 'bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                {isCritical ? (
                                  <AlertOctagon className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                                ) : isWarning ? (
                                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                ) : (
                                  <Info className="w-4 h-4 text-[#0B3D91] shrink-0 mt-0.5" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-[#0B1F3A] break-words">
                                      {n.title}
                                    </span>
                                    <span
                                      className={`text-[11px] font-semibold ${
                                        isCritical
                                          ? 'text-red-800'
                                          : isWarning
                                            ? 'text-amber-800'
                                            : 'text-slate-600'
                                      }`}
                                    >
                                      · {isCritical ? 'Critical Alert' : isWarning ? 'Warning' : 'Info'}
                                      {!n.isRead ? ' · Unread' : ' · Read'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-700 mt-1 line-clamp-2">
                                    {n.message}
                                  </p>
                                  <div className="text-[11px] font-mono text-slate-500 mt-1">
                                    {new Date(n.createdAt).toLocaleString('en-ZA', {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 mt-2">
                              {!n.isRead && (
                                <button
                                  type="button"
                                  onClick={() => void markNotificationRead(n.id)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Mark Read</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setNotifPopoverOpen(false);
                                  setSelectedNotifDetail(n);
                                  if (!n.isRead) void markNotificationRead(n.id);
                                }}
                                className="text-[11px] font-semibold text-[#0B3D91] hover:underline"
                              >
                                Read Full Notice
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifPopoverOpen(false);
                        setActiveTab('notifications');
                      }}
                      className="text-xs font-semibold text-[#0B3D91] hover:underline"
                    >
                      Open Notification Centre ({notifications.length} total)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0B1F3A] text-white border-b border-[#163055] px-4 py-3 space-y-1.5 max-h-[75vh] overflow-y-auto shrink-0">
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
                  className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm font-semibold ${
                    isNavItemActive(item.id)
                      ? 'bg-[#0B3D91] text-white'
                      : 'text-[#CBD5E1] hover:bg-[#163055]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            <div className="pt-2 mt-2 border-t border-[#163055] space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('profile');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm font-semibold text-[#E2E8F0] hover:bg-[#163055]"
              >
                <User className="w-5 h-5" />
                <span>{t(languageCode, 'navProfile')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('settings');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm font-semibold text-[#E2E8F0] hover:bg-[#163055]"
              >
                <Settings className="w-5 h-5" />
                <span>{t(languageCode, 'navSettings')}</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm font-semibold text-[#FCA5A5] hover:bg-[#163055]"
              >
                <LogOut className="w-5 h-5" />
                <span>{t(languageCode, 'signOut')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Independently Scrolling Main Content Area */}
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
            <SaslBanner languageCode={languageCode} />

            {user.isDemonstration && (
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-3 flex flex-wrap items-start gap-2.5 text-xs text-[#0B1F3A]">
                <Info className="w-4 h-4 text-[#0B3D91] shrink-0 mt-0.5" />
                <p>
                  <strong className="font-mono uppercase tracking-wide text-[#0B3D91]">
                    DEMONSTRATION DATA:
                  </strong>{' '}
                  You are signed into a seeded demonstration account showcasing realistic South
                  African agricultural workflows. Demonstration users and records are not real
                  registered customers.
                </p>
              </div>
            )}

            {activationBannerCode && !user.isEmailVerified && (
              <div className="bg-[#ECF5F2] border border-[#A7D7C5] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[#0B1F3A]">
                <span>
                  Your account activation code is{' '}
                  <span className="font-mono font-bold">{activationBannerCode}</span>. You can
                  verify it anytime in Profile.
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="font-semibold text-[#0B3D91] underline cursor-pointer"
                >
                  Activate Now
                </button>
              </div>
            )}

            {user.roleCode === 'system_administrator' &&
              (activeTab === 'dashboard' || activeTab === 'admin') && (
                <AdminPortalView
                  embedded
                  user={user}
                  onNavigateWorkspace={(tab) => setActiveTab(tab)}
                  onTranslationsUpdated={refreshMetaTranslations}
                  onLogout={handleLogout}
                />
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
              user.roleCode !== 'system_administrator' &&
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
                onOpenFarmTransition={() => void handleOpenFarmTransitionModal()}
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
              provinces={provinces}
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
              userRoleCode={user.roleCode}
              userProvince={user.profile?.province}
              provinces={provinces}
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
              userProvince={user.profile?.province}
              provinces={provinces}
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
              onOpenFarmTransition={() => void handleOpenFarmTransitionModal()}
              onProgressUpdated={() => setRefreshKey((k) => k + 1)}
            />
          )}

          {activeTab === 'reports' && user.roleCode !== 'prospective_farmer' && (
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
              onUserUpdated={(updated) => {
                setUser(updated);
                void loadWorkspaceData();
              }}
              onNotificationsRefresh={loadWorkspaceData}
              onOpenNotifications={() => setActiveTab('notifications')}
              onOpenFarmTransition={() => void handleOpenFarmTransitionModal()}
              onAccountErased={() => {
                setStoredToken(null);
                setUser(null);
                setFarms([]);
                setPublicView('landing');
                setActiveTab('dashboard');
              }}
            />
          )}
          </div>
        </main>
      </div>

      {/* Full Notification Inspection Modal */}
      {selectedNotifDetail && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-300 rounded-md shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 bg-[#0B1F3A] text-white flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-mono text-sky-300 uppercase">
                  {selectedNotifDetail.category.replace(/_/g, ' ')} ·{' '}
                  {selectedNotifDetail.priority === 'urgent' ||
                  selectedNotifDetail.category === 'agricultural_incident'
                    ? 'Critical Alert'
                    : selectedNotifDetail.priority === 'high' ||
                        selectedNotifDetail.category === 'weather_warning'
                      ? 'Warning'
                      : 'Informational'}
                </div>
                <h3 className="text-base font-bold mt-1 break-words">
                  {selectedNotifDetail.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotifDetail(null)}
                aria-label="Close notification detail"
                className="p-1 rounded text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {selectedNotifDetail.message}
              </p>
              <div className="text-xs font-mono text-slate-500 border-t border-slate-200 pt-3 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {new Date(selectedNotifDetail.createdAt).toLocaleString('en-ZA', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                </span>
                <span>{selectedNotifDetail.isRead ? 'Read' : 'Unread'}</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNotifDetail(null);
                    setActiveTab('notifications');
                  }}
                  className="px-3.5 py-2 rounded border border-slate-300 text-xs font-semibold text-[#0B1F3A] hover:bg-slate-50"
                >
                  Open Notification Centre
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNotifDetail(null)}
                  className="px-4 py-2 rounded bg-[#0B1F3A] text-white text-xs font-semibold hover:bg-[#14345c]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prospective -> Existing Farmer Registration Transition Modal */}
      {farmTransitionOpen && (
        <FarmTransitionModal
          isOpen={farmTransitionOpen}
          onClose={() => setFarmTransitionOpen(false)}
          user={user}
          provinces={provinces}
          savedLocations={transitionSavedLocations}
          savedPlans={transitionSavedPlans}
          onTransitionSuccess={(updatedUser, newFarm) => {
            setFarmTransitionOpen(false);
            setUser(updatedUser);
            setSelectedFarmId(newFarm.id);
            setActiveTab('dashboard');
            void loadWorkspaceData();
          }}
        />
      )}
    </div>
  );
}
