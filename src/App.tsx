import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertOctagon,
  Beef,
  Camera,
  CloudRain,
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
  X,
} from 'lucide-react';
import {
  EasyReadToggle,
  LanguageSelector,
  SaslBanner,
} from './components/AccessibilityControls';
import { AuthViews } from './components/AuthViews';
import { CropManagementView } from './components/CropManagementView';
import { FarmManagement } from './components/FarmManagement';
import { GeminiAdvisorPanel } from './components/GeminiAdvisorPanel';
import { IncidentDamageView } from './components/IncidentDamageView';
import { LandingPage } from './components/LandingPage';
import { LivestockMixedView } from './components/LivestockMixedView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { RoleDashboard } from './components/RoleDashboards';
import { SoilLandView } from './components/SoilLandView';
import { StockInventoryView } from './components/StockInventoryView';
import { VisualAnalysisView } from './components/VisualAnalysisView';
import { WeatherIntelligenceView } from './components/WeatherIntelligenceView';
import { useAccessibility } from './hooks/useAccessibility';
import { t } from './i18n/translations';
import { apiRequest, getStoredToken, setStoredToken } from './lib/api';
import {
  AuthUser,
  FarmItem,
  LanguageCode,
  NotificationItem,
  ProvinceInfo,
} from './types';

type WorkspaceTab =
  | 'dashboard'
  | 'farms'
  | 'crops'
  | 'livestock'
  | 'mixed'
  | 'soil'
  | 'weather'
  | 'visual'
  | 'stock'
  | 'incidents'
  | 'advisor'
  | 'admin'
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

  const {
    speak,
    stopSpeaking,
    isSpeaking,
    startVoiceInput,
    isListening,
    speechSupported,
    recognitionSupported,
  } = useAccessibility(languageCode, largeMode);

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
      // handled gracefully
    }
  }, [selectedFarmId]);

  const handleOperationalDataChanged = useCallback(() => {
    setRefreshKey((k) => k + 1);
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  useEffect(() => {
    apiRequest<ProvinceInfo[]>('/api/meta/provinces')
      .then(setProvinces)
      .catch(() => {});

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

  const showFarmOps =
    user.roleCode === 'existing_farmer' ||
    user.roleCode === 'agricultural_expert' ||
    user.roleCode === 'organisation_manager' ||
    user.roleCode === 'system_administrator';

  const navItems: { id: WorkspaceTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    {
      id: 'dashboard',
      label: t(languageCode, 'navDashboard'),
      icon: <LayoutDashboard className="w-5 h-5" />,
      show: true,
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
      id: 'advisor',
      label: t(languageCode, 'navAdvisor'),
      icon: <Sparkles className="w-5 h-5" />,
      show: true,
    },
    {
      id: 'admin',
      label: t(languageCode, 'navAdmin'),
      icon: <Shield className="w-5 h-5" />,
      show: user.roleCode === 'system_administrator',
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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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
                (activeTab === 'admin' && item.id === 'dashboard' && false);
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

          <div className="flex items-center gap-3">
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
                onClick={() => setActiveTab('profile')}
                className="px-3 py-1.5 rounded-lg bg-[#EDF5EF] text-[#1B4332] text-xs font-semibold cursor-pointer whitespace-nowrap"
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

          {activeTab === 'dashboard' && (
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
              onOpenAdvisorView={() => setActiveTab('advisor')}
              refreshKey={refreshKey}
              provinces={provinces}
              languageCode={languageCode}
              isSpeaking={isSpeaking}
              speechSupported={speechSupported}
              onSpeak={speak}
              onStopSpeaking={stopSpeaking}
            />
          )}

          {activeTab === 'admin' && (
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
              onOpenAdvisorView={() => setActiveTab('advisor')}
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
              farms={farms}
              selectedFarmId={selectedFarmId}
              onSelectFarmFilter={setSelectedFarmId}
              onDataChanged={handleOperationalDataChanged}
            />
          )}

          {(activeTab === 'livestock' || activeTab === 'mixed') && (
            <LivestockMixedView
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
              farms={farms}
              selectedFarmId={selectedFarmId}
              onSelectFarm={setSelectedFarmId}
              onDataChanged={handleOperationalDataChanged}
            />
          )}

          {activeTab === 'incidents' && (
            <IncidentDamageView
              farms={farms}
              selectedFarmId={selectedFarmId}
              onSelectFarm={setSelectedFarmId}
              onDataChanged={handleOperationalDataChanged}
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
            />
          )}
        </main>
      </div>
    </div>
  );
}
