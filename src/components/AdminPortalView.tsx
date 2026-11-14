import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Globe,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sliders,
  Sprout,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  AdminEntitiesPayload,
  apiRequest,
  fetchAdminEntities,
  fetchPublicDatasets,
  resetAdminDemoData,
} from '../lib/api';
import {
  AdminFarmOversightPayload,
  AdminLanguageAuditRow,
  AdminPortalOverviewPayload,
  AdminTranslationEntry,
  AuditLogItem,
  AuthUser,
  LanguageCode,
  PublicDatasetRecord,
  RoleCode,
  SystemConfigPayload,
} from '../types';

type AdminSection =
  | 'overview'
  | 'users'
  | 'entities'
  | 'farms'
  | 'datasets'
  | 'languages'
  | 'config'
  | 'audit';

interface PermissionCatalogItem {
  key: string;
  label: string;
  group: string;
}

interface AdminPortalViewProps {
  embedded?: boolean;
  user: AuthUser;
  onNavigateWorkspace: (tab: 'learning' | 'reports' | 'profile' | 'settings') => void;
  onTranslationsUpdated: () => void;
  onLogout: () => void;
}

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({
  embedded = false,
  user,
  onNavigateWorkspace,
  onTranslationsUpdated,
  onLogout,
}) => {
  const [section, setSection] = useState<AdminSection>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Overview state
  const [overview, setOverview] = useState<AdminPortalOverviewPayload | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);

  // Users & Permissions state
  const [usersList, setUsersList] = useState<AuthUser[]>([]);
  const [permCatalog, setPermCatalog] = useState<PermissionCatalogItem[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [inspectedUser, setInspectedUser] = useState<{
    user: AuthUser;
    ownedFarmCount: number;
    activity: AuditLogItem[];
  } | null>(null);

  // Organisations & Specialists state
  const [entities, setEntities] = useState<AdminEntitiesPayload | null>(null);

  // Public Dataset Provenance state
  const [datasetsMeta, setDatasetsMeta] = useState<{
    datasets: PublicDatasetRecord[];
    disclaimer: string;
  } | null>(null);

  // Farm Oversight state
  const [farmOversight, setFarmOversight] = useState<AdminFarmOversightPayload | null>(null);
  const [farmProvFilter, setFarmProvFilter] = useState('');

  // Languages & Translations state
  const [languagesAudit, setLanguagesAudit] = useState<AdminLanguageAuditRow[]>([]);
  const [selectedLangCode, setSelectedLangCode] = useState<LanguageCode>('zu');
  const [translationEntries, setTranslationEntries] = useState<AdminTranslationEntry[]>([]);
  const [onlyMissingKeys, setOnlyMissingKeys] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  // System Config & Announcements state
  const [sysPayload, setSysPayload] = useState<SystemConfigPayload | null>(null);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnMsg, setNewAnnMsg] = useState('');
  const [newAnnRole, setNewAnnRole] = useState<RoleCode | 'all'>('all');
  const [newAnnSeverity, setNewAnnSeverity] = useState<'info' | 'advisory' | 'warning'>('advisory');

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditSearch, setAuditSearch] = useState('');

  const loadSectionData = useCallback(
    async (targetSection: AdminSection) => {
      setLoading(true);
      setError(null);
      try {
        if (targetSection === 'overview') {
          const data = await apiRequest<AdminPortalOverviewPayload>('/api/admin/overview');
          setOverview(data);
        } else if (targetSection === 'users') {
          const params = new URLSearchParams();
          if (userSearch) params.set('q', userSearch);
          if (roleFilter) params.set('role', roleFilter);
          if (statusFilter) params.set('status', statusFilter);
          const [uRes, catRes] = await Promise.all([
            apiRequest<AuthUser[]>(`/api/admin/users?${params.toString()}`),
            apiRequest<PermissionCatalogItem[]>('/api/admin/permissions/catalog'),
          ]);
          setUsersList(uRes);
          setPermCatalog(catRes);
        } else if (targetSection === 'entities') {
          const ent = await fetchAdminEntities();
          setEntities(ent);
        } else if (targetSection === 'datasets') {
          const ds = await fetchPublicDatasets();
          setDatasetsMeta(ds);
        } else if (targetSection === 'farms') {
          const data = await apiRequest<AdminFarmOversightPayload>('/api/admin/farm-oversight');
          setFarmOversight(data);
        } else if (targetSection === 'languages') {
          const [langsRes, entriesRes] = await Promise.all([
            apiRequest<AdminLanguageAuditRow[]>('/api/admin/languages'),
            apiRequest<AdminTranslationEntry[]>(`/api/admin/translations/${selectedLangCode}`),
          ]);
          setLanguagesAudit(langsRes);
          setTranslationEntries(entriesRes);
          const drafts: Record<string, string> = {};
          entriesRes.forEach((e) => {
            drafts[e.key] = e.currentValue;
          });
          setDraftValues(drafts);
        } else if (targetSection === 'config') {
          const data = await apiRequest<SystemConfigPayload>('/api/admin/system-config');
          setSysPayload(data);
        } else if (targetSection === 'audit') {
          const logs = await apiRequest<AuditLogItem[]>('/api/admin/audit-logs');
          setAuditLogs(logs);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unable to load administrative data.');
      } finally {
        setLoading(false);
      }
    },
    [userSearch, roleFilter, statusFilter, selectedLangCode]
  );

  useEffect(() => {
    loadSectionData(section);
  }, [section, loadSectionData]);

  const handleResetDemoData = async () => {
    setResettingDemo(true);
    setError(null);
    setNotice(null);
    try {
      const res = await resetAdminDemoData();
      setNotice(res.message);
      setShowResetConfirm(false);
      await loadSectionData(section);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to reset demonstration data.');
    } finally {
      setResettingDemo(false);
    }
  };

  const handleToggleUserStatus = async (target: AuthUser) => {
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest<{ user: AuthUser }>(`/api/admin/users/${target.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !target.isActive }),
      });
      setNotice(`${res.user.email} is now ${res.user.isActive ? 'Active' : 'Deactivated'}.`);
      await loadSectionData('users');
      if (inspectedUser?.user.id === target.id) {
        setInspectedUser({ ...inspectedUser, user: res.user });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update user status.');
    }
  };

  const handleAssignRole = async (target: AuthUser, roleCode: RoleCode) => {
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest<{ user: AuthUser }>(`/api/admin/users/${target.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ roleCode }),
      });
      setNotice(`Assigned role ${res.user.roleName} to ${res.user.email}.`);
      await loadSectionData('users');
      if (inspectedUser?.user.id === target.id) {
        setInspectedUser({ ...inspectedUser, user: res.user });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to assign role.');
    }
  };

  const handleInspectUser = async (userId: string) => {
    setError(null);
    try {
      const detail = await apiRequest<{
        user: AuthUser;
        ownedFarmCount: number;
        activity: AuditLogItem[];
      }>(`/api/admin/users/${userId}/activity`);
      setInspectedUser(detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load user profile & activity.');
    }
  };

  const handleToggleUserPermission = async (
    targetUser: AuthUser,
    permissionKey: string,
    isAllowed: boolean
  ) => {
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest<{ user: AuthUser }>(
        `/api/admin/users/${targetUser.id}/permissions`,
        {
          method: 'PATCH',
          body: JSON.stringify({ permissionKey, isAllowed }),
        }
      );
      setNotice(
        `${isAllowed ? 'Granted' : 'Revoked'} permission "${permissionKey}" for ${res.user.email}.`
      );
      await loadSectionData('users');
      if (inspectedUser?.user.id === targetUser.id) {
        await handleInspectUser(targetUser.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Permission update failed.');
    }
  };

  const handleToggleLanguageFlag = async (
    lang: AdminLanguageAuditRow,
    field: 'isActive' | 'hasAudioSupport' | 'hasSignLanguageSupport'
  ) => {
    setError(null);
    try {
      await apiRequest(`/api/admin/languages/${lang.code}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: !lang[field] }),
      });
      setNotice(`Updated language settings for ${lang.name}.`);
      await loadSectionData('languages');
      onTranslationsUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update language settings.');
    }
  };

  const handleSaveTranslationKey = async (key: string) => {
    const val = (draftValues[key] || '').trim();
    if (!val) {
      setError(`Translation value for "${key}" cannot be empty.`);
      return;
    }
    setError(null);
    try {
      const updated = await apiRequest<AdminTranslationEntry[]>(
        `/api/admin/translations/${selectedLangCode}`,
        {
          method: 'PUT',
          body: JSON.stringify({ key, value: val, reviewed: true }),
        }
      );
      setTranslationEntries(updated);
      setNotice(`Saved reviewed translation for "${key}" (${selectedLangCode.toUpperCase()}).`);
      onTranslationsUpdated();
      const langsRes = await apiRequest<AdminLanguageAuditRow[]>('/api/admin/languages');
      setLanguagesAudit(langsRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save translation.');
    }
  };

  const handleSaveSystemConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sysPayload) return;
    setError(null);
    try {
      const updated = await apiRequest<SystemConfigPayload>('/api/admin/system-config', {
        method: 'PUT',
        body: JSON.stringify(sysPayload.config),
      });
      setSysPayload(updated);
      setNotice('System configuration saved and logged in audit trail.');
      onTranslationsUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save system configuration.');
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnMsg.trim()) return;
    setError(null);
    try {
      await apiRequest('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: newAnnTitle,
          message: newAnnMsg,
          targetRole: newAnnRole,
          severity: newAnnSeverity,
        }),
      });
      setNewAnnTitle('');
      setNewAnnMsg('');
      setNotice('System announcement published.');
      await loadSectionData('config');
      onTranslationsUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create announcement.');
    }
  };

  const handleToggleAnnouncement = async (id: string, currentActive: boolean) => {
    try {
      await apiRequest(`/api/admin/announcements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !currentActive }),
      });
      await loadSectionData('config');
      onTranslationsUpdated();
    } catch {
      // ignore
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await apiRequest(`/api/admin/announcements/${id}`, { method: 'DELETE' });
      await loadSectionData('config');
      onTranslationsUpdated();
    } catch {
      // ignore
    }
  };

  const filteredTranslationEntries = useMemo(() => {
    return onlyMissingKeys
      ? translationEntries.filter((e) => e.isMissing || !e.reviewed)
      : translationEntries;
  }, [translationEntries, onlyMissingKeys]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        (l.actorEmail || '').toLowerCase().includes(q) ||
        l.entityType.toLowerCase().includes(q)
    );
  }, [auditLogs, auditSearch]);

  const navItems: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'users', label: 'Users & RBAC', icon: <Users className="w-4 h-4" /> },
    { id: 'entities', label: 'Orgs & Specialists', icon: <Building2 className="w-4 h-4" /> },
    { id: 'farms', label: 'Farm Oversight', icon: <Sprout className="w-4 h-4" /> },
    { id: 'datasets', label: 'Public Datasets', icon: <Database className="w-4 h-4" /> },
    { id: 'languages', label: '12 Languages', icon: <Globe className="w-4 h-4" /> },
    { id: 'config', label: 'System Config', icon: <Sliders className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit Logs', icon: <Activity className="w-4 h-4" /> },
  ];

  const renderSidebarLinks = (closeMobile?: boolean) => (
    <>
      <div className="space-y-1">
        <p className="px-3 pb-1 text-[11px] font-mono uppercase tracking-wider text-[#93C5FD]">
          Administration
        </p>
        {navItems.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                if (closeMobile) setMobileNavOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#0B3D91] text-white'
                  : 'text-[#CBD5E1] hover:bg-[#163055] hover:text-white'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="pt-4 mt-4 border-t border-[#163055] space-y-1">
        <p className="px-3 pb-1 text-[11px] font-mono uppercase tracking-wider text-[#93C5FD]">
          Platform Tools
        </p>
        <button
          type="button"
          onClick={() => onNavigateWorkspace('learning')}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-[#CBD5E1] hover:bg-[#163055] hover:text-white cursor-pointer whitespace-nowrap"
        >
          <BookOpen className="w-4 h-4" />
          <span>Learning Centre CMS</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigateWorkspace('reports')}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-[#CBD5E1] hover:bg-[#163055] hover:text-white cursor-pointer whitespace-nowrap"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Reports & Exports</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigateWorkspace('profile')}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-[#CBD5E1] hover:bg-[#163055] hover:text-white cursor-pointer whitespace-nowrap"
        >
          <User className="w-4 h-4" />
          <span>Admin Profile</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigateWorkspace('settings')}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-[#CBD5E1] hover:bg-[#163055] hover:text-white cursor-pointer whitespace-nowrap"
        >
          <Settings className="w-4 h-4" />
          <span>Accessibility Settings</span>
        </button>
      </div>
    </>
  );

  const renderMainContent = () => (
    <div className="space-y-6">
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#0B1F3A]">
              System Administration Portal
            </h1>
            <p className="text-sm text-[#475569] mt-0.5">
              Governance, RBAC permissions, multi-province farm oversight, public dataset provenance & 12-language management
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 bg-white border border-[#CBD5E1] rounded-xl p-1">
            {navItems.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  section === tab.id
                    ? 'bg-[#0B3D91] text-white'
                    : 'text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0B1F3A]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-[#ECF5F2] border border-[#A7D7C5] text-[#0B1F3A] rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#174C3C] shrink-0" />
          <span>{notice}</span>
        </div>
      )}

          {/* ============================================================== */}
          {/* 1. ADMINISTRATIVE DASHBOARD                                    */}
          {/* ============================================================== */}
          {section === 'overview' && overview && (
            <div className="space-y-6">
              <div className="bg-white border border-[#CBD5E1] rounded-xl px-4 py-3 text-xs text-[#0B1F3A] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#0B3D91] shrink-0" />
                <span>{overview.privacyNotice}</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
                  <p className="text-xs text-[#475569]">Total Registered Users</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                    {overview.stats.totalUsers}
                  </p>
                  <p className="text-xs text-[#0B3D91] mt-1 font-mono tabular-nums">
                    {overview.stats.realUsers ?? 0} real · {overview.stats.demonstrationUsers ?? 0} demo ·{' '}
                    {overview.stats.activeUsers} active
                  </p>
                </div>
                <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
                  <p className="text-xs text-[#475569]">Farmers Breakdown</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                    {overview.stats.existingFarmers + overview.stats.prospectiveFarmers}
                  </p>
                  <p className="text-xs text-[#475569] mt-1 font-mono tabular-nums">
                    {overview.stats.existingFarmers} existing · {overview.stats.prospectiveFarmers} prospective
                  </p>
                </div>
                <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
                  <p className="text-xs text-[#475569]">Experts & Organisations</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                    {overview.stats.agriculturalExperts + overview.stats.registeredOrganisations}
                  </p>
                  <p className="text-xs text-[#475569] mt-1 font-mono tabular-nums">
                    {overview.stats.agriculturalExperts} experts · {overview.stats.registeredOrganisations} orgs
                  </p>
                </div>
                <div className="bg-white border border-[#CBD5E1] rounded-xl p-4">
                  <p className="text-xs text-[#475569]">Registered Farms</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-[#0B1F3A] mt-1">
                    {overview.stats.totalRegisteredFarms}
                  </p>
                  <p className="text-xs text-[#475569] mt-1 font-mono tabular-nums">
                    {overview.stats.realFarms ?? 0} real · {overview.stats.demonstrationFarms ?? 0} demo ·{' '}
                    {overview.stats.totalHectares} ha
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Farms by Province */}
                <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#0B3D91]" />
                    <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                      Farms by Province
                    </h2>
                  </div>
                  {overview.farmsByProvince.length === 0 ? (
                    <p className="text-sm text-[#475569]">No farms registered yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const maxF = Math.max(
                          1,
                          ...overview.farmsByProvince.map((p) => p.farmCount)
                        );
                        return overview.farmsByProvince.map((prov) => (
                          <div key={prov.province} className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="font-semibold text-[#0B1F3A]">{prov.province}</span>
                              <span className="font-mono tabular-nums text-[#475569]">
                                {prov.farmCount} farm(s) · {prov.totalHectares} ha ·{' '}
                                {prov.incidentCount} incident(s)
                              </span>
                            </div>
                            <div className="h-2.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#174C3C]"
                                style={{
                                  width: `${Math.max(8, Math.round((prov.farmCount / maxF) * 100))}%`,
                                }}
                              />
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </section>

                {/* User & Farm Registration Trends */}
                <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    User & Farm Registration Trends
                  </h2>
                  <div className="space-y-2.5">
                    {overview.registrationTrends.map((tr) => (
                      <div
                        key={tr.period}
                        className="flex items-center justify-between text-xs border-b border-[#E2E8F0] pb-2"
                      >
                        <span className="font-mono font-semibold text-[#0B1F3A]">{tr.period}</span>
                        <div className="flex items-center gap-4 font-mono tabular-nums">
                          <span className="text-[#0B3D91]">+{tr.newUsers} user(s)</span>
                          <span className="text-[#334155]">+{tr.newFarms} farm(s)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Recent System Activity */}
              <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Recent System Activity
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSection('audit')}
                    className="text-xs font-semibold text-[#0B3D91] hover:underline cursor-pointer"
                  >
                    Open Full Audit Log →
                  </button>
                </div>
                <div className="divide-y divide-[#E2E8F0]">
                  {overview.recentActivity.slice(0, 10).map((log) => (
                    <div
                      key={log.id}
                      className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold text-[#0B1F3A]">
                          {log.action}
                        </span>{' '}
                        <span className="text-[#475569]">
                          · {log.actorEmail} · {log.entityType}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-[#475569]">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Demonstration Seed Management */}
              <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-base font-bold text-[#0B1F3A]">
                      Demonstration Data Maintenance (All 9 Provinces & 9 Specialist Categories)
                    </h2>
                    <p className="text-xs text-[#475569] mt-0.5">
                      Cleanly resets seeded demonstration accounts and sample provincial records while preserving all genuine registered customer accounts and farms.
                    </p>
                  </div>
                  {!showResetConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#E2E8F0] text-xs font-semibold text-[#0B1F3A] cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reset Demonstration Data</span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-[#B91C1C]">
                        Confirm reset of demo-only records?
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowResetConfirm(false)}
                        className="px-3 py-1.5 min-h-[38px] rounded-lg border border-[#CBD5E1] text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={resettingDemo}
                        onClick={handleResetDemoData}
                        className="px-3.5 py-1.5 min-h-[38px] rounded-lg bg-[#FC3D21] hover:bg-[#DC2626] text-white text-xs font-semibold cursor-pointer"
                      >
                        {resettingDemo ? 'Resetting...' : 'Yes, Reset Demo Records'}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ============================================================== */}
          {/* 2. USER & PERMISSIONS MANAGEMENT                               */}
          {/* ============================================================== */}
          {section === 'users' && (
            <div className="space-y-6">
              <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    User Directory ({usersList.length})
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#475569] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search name, email, province..."
                        className="pl-9 pr-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] text-sm"
                      />
                    </div>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white text-sm"
                    >
                      <option value="">All Roles</option>
                      <option value="prospective_farmer">Prospective Farmer</option>
                      <option value="existing_farmer">Existing Farmer</option>
                      <option value="agricultural_expert">Agricultural Expert</option>
                      <option value="organisation_manager">Organisation Manager</option>
                      <option value="system_administrator">System Administrator</option>
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white text-sm"
                    >
                      <option value="">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="inactive">Deactivated</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-xs text-[#475569]">
                        <th className="py-2.5 pr-4 font-semibold">User</th>
                        <th className="py-2.5 pr-4 font-semibold">Province / Lang</th>
                        <th className="py-2.5 pr-4 font-semibold">Role Assignment</th>
                        <th className="py-2.5 pr-4 font-semibold">Status</th>
                        <th className="py-2.5 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {usersList.map((u) => (
                        <tr key={u.id}>
                          <td className="py-3 pr-4">
                            <p className="font-semibold text-[#0B1F3A]">
                              {u.profile?.fullName || 'Unnamed User'}
                              {u.isDemonstration && (
                                <span className="ml-2 text-[10px] font-mono uppercase text-[#0B3D91]">
                                  DEMO
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-[#475569]">{u.email}</p>
                          </td>
                          <td className="py-3 pr-4 text-xs text-[#334155]">
                            {u.profile?.province || 'Unassigned'} · {u.preferredLanguageCode.toUpperCase()}
                          </td>
                          <td className="py-3 pr-4">
                            <select
                              value={u.roleCode}
                              disabled={u.id === user.id}
                              onChange={(e) => handleAssignRole(u, e.target.value as RoleCode)}
                              className="px-2.5 py-1.5 min-h-[36px] rounded-lg border border-[#CBD5E1] bg-white text-xs font-medium disabled:opacity-60"
                            >
                              <option value="prospective_farmer">Prospective Farmer</option>
                              <option value="existing_farmer">Existing Farmer</option>
                              <option value="agricultural_expert">Agricultural Expert</option>
                              <option value="organisation_manager">Organisation Manager</option>
                              <option value="system_administrator">System Administrator</option>
                            </select>
                          </td>
                          <td className="py-3 pr-4 text-xs font-semibold">
                            <span className={u.isActive ? 'text-[#174C3C]' : 'text-[#FC3D21]'}>
                              {u.isActive ? 'Active' : 'Deactivated'}
                            </span>
                          </td>
                          <td className="py-3 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleInspectUser(u.id)}
                              className="px-3 py-1.5 min-h-[36px] rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#0B1F3A] hover:bg-[#EFF6FF] cursor-pointer"
                            >
                              Profile & Permissions
                            </button>
                            {u.id !== user.id && (
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u)}
                                className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold border cursor-pointer ${
                                  u.isActive
                                    ? 'border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]'
                                    : 'border-[#A7D7C5] text-[#174C3C] hover:bg-[#ECF5F2]'
                                }`}
                              >
                                {u.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Inspected User Profile, Permissions & Activity */}
              {inspectedUser && (
                <section className="bg-white border border-[#0B3D91] rounded-2xl p-6 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E8F0] pb-4">
                    <div>
                      <p className="text-xs font-mono text-[#0B3D91]">
                        Account Profile & Granular Permissions
                      </p>
                      <h3 className="font-display text-xl font-bold text-[#0B1F3A]">
                        {inspectedUser.user.profile?.fullName} ({inspectedUser.user.email})
                      </h3>
                      <p className="text-xs text-[#475569] mt-1">
                        Role: {inspectedUser.user.roleName} · Province:{' '}
                        {inspectedUser.user.profile?.province || 'Unassigned'} · Owned Farms:{' '}
                        <span className="font-mono font-bold tabular-nums">
                          {inspectedUser.ownedFarmCount}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectedUser(null)}
                      className="px-3 py-1.5 min-h-[36px] rounded-lg border border-[#CBD5E1] text-xs font-semibold cursor-pointer"
                    >
                      Close Drawer
                    </button>
                  </div>

                  {/* Permission Toggles */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-[#0B3D91]" />
                      <h4 className="font-display font-bold text-[#0B1F3A] text-sm">
                        Manage Individual Permissions (All Changes Audited)
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {permCatalog.map((perm) => {
                        const granted = inspectedUser.user.permissions.includes(perm.key);
                        const isSensitive = perm.key === 'admin:private_farmer_records';
                        return (
                          <label
                            key={perm.key}
                            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 cursor-pointer ${
                              isSensitive
                                ? 'bg-[#FEF2F2] border-[#FECACA]'
                                : granted
                                ? 'bg-[#ECF5F2] border-[#A7D7C5]'
                                : 'bg-[#F8FAFC] border-[#CBD5E1]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={granted}
                              onChange={(e) =>
                                handleToggleUserPermission(
                                  inspectedUser.user,
                                  perm.key,
                                  e.target.checked
                                )
                              }
                              className="mt-0.5 accent-[#0B3D91]"
                            />
                            <div>
                              <p className="font-semibold text-[#0B1F3A]">{perm.label}</p>
                              <p className="font-mono text-[11px] text-[#475569]">
                                {perm.group} · {perm.key}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* User Account Activity */}
                  <div className="space-y-2 pt-3 border-t border-[#E2E8F0]">
                    <h4 className="font-display font-bold text-[#0B1F3A] text-sm">
                      Recent Account Activity ({inspectedUser.activity.length})
                    </h4>
                    {inspectedUser.activity.length === 0 ? (
                      <p className="text-xs text-[#475569]">No recorded activity for this user yet.</p>
                    ) : (
                      <div className="divide-y divide-[#E2E8F0] max-h-56 overflow-y-auto">
                        {inspectedUser.activity.map((act) => (
                          <div key={act.id} className="py-2 flex justify-between text-xs gap-2">
                            <span>
                              <span className="font-mono font-semibold text-[#0B1F3A]">
                                {act.action}
                              </span>{' '}
                              · {act.entityType}
                            </span>
                            <span className="font-mono tabular-nums text-[#475569]">
                              {new Date(act.createdAt).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* 3. FARM OVERSIGHT (Privacy Guardrail Enforced)                 */}
          {/* ============================================================== */}
          {section === 'farms' && farmOversight && (
            <div className="space-y-6">
              <div
                className={`rounded-xl border px-4 py-3 text-xs flex items-center gap-2 ${
                  farmOversight.hasPrivateRecordPermission
                    ? 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
                    : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#0B1F3A]'
                }`}
              >
                <Lock className="w-4 h-4 shrink-0" />
                <span>{farmOversight.privacyNotice}</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Farming Categories Distribution
                  </h2>
                  <div className="space-y-2.5">
                    {farmOversight.byCategory.map((c) => (
                      <div
                        key={c.category}
                        className="flex items-center justify-between text-xs border-b border-[#E2E8F0] pb-2"
                      >
                        <span className="font-semibold text-[#0B1F3A]">{c.category}</span>
                        <span className="font-mono tabular-nums text-[#0B3D91]">
                          {c.farmCount} farm(s)
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Provincial Distribution
                  </h2>
                  <div className="space-y-2.5">
                    {farmOversight.byProvince.map((p) => (
                      <div
                        key={p.province}
                        className="flex items-center justify-between text-xs border-b border-[#E2E8F0] pb-2"
                      >
                        <span className="font-semibold text-[#0B1F3A]">{p.province}</span>
                        <span className="font-mono tabular-nums text-[#334155]">
                          {p.farmCount} farm(s) · {p.hectares} ha
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Registered Farms Oversight ({farmOversight.farms.length})
                  </h2>
                  <select
                    value={farmProvFilter}
                    onChange={(e) => setFarmProvFilter(e.target.value)}
                    className="px-3 py-1.5 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
                  >
                    <option value="">All Provinces</option>
                    {farmOversight.byProvince.map((p) => (
                      <option key={p.province} value={p.province}>
                        {p.province}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-[#475569]">
                        <th className="py-2 pr-4 font-semibold">Reference</th>
                        <th className="py-2 pr-4 font-semibold">Province & District</th>
                        <th className="py-2 pr-4 font-semibold">Categories</th>
                        <th className="py-2 pr-4 font-semibold text-right">Hectares</th>
                        <th className="py-2 pr-4 font-semibold text-right">Fields</th>
                        <th className="py-2 font-semibold text-right">Incidents</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {farmOversight.farms
                        .filter((f) => !farmProvFilter || f.province === farmProvFilter)
                        .map((f) => (
                          <tr key={f.farmId}>
                            <td className="py-2.5 pr-4 font-semibold text-[#0B1F3A]">
                              <span>{f.farmNameDisplay}</span>
                              {f.isDemonstration && (
                                <span className="ml-2 text-[10px] font-mono uppercase text-[#0B3D91]">
                                  · DEMO
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pr-4 text-[#334155]">
                              {f.districtMunicipality}, {f.province}
                            </td>
                            <td className="py-2.5 pr-4 text-[#475569]">
                              {f.farmingCategories.join(' · ')}
                            </td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                              {f.farmSizeHectares} ha
                            </td>
                            <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                              {f.fieldCount}
                            </td>
                            <td className="py-2.5 text-right font-mono tabular-nums">
                              {f.incidentCount} ({f.activeIncidentCount} active)
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Reported Incidents Oversight Summary ({farmOversight.reportedIncidentsSummary.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-[#475569]">
                        <th className="py-2 pr-4 font-semibold">Farm Ref</th>
                        <th className="py-2 pr-4 font-semibold">Province</th>
                        <th className="py-2 pr-4 font-semibold">Incident Type</th>
                        <th className="py-2 pr-4 font-semibold">Status</th>
                        <th className="py-2 pr-4 font-semibold text-right">Affected Ha</th>
                        <th className="py-2 font-semibold text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {farmOversight.reportedIncidentsSummary.map((inc) => (
                        <tr key={inc.id}>
                          <td className="py-2 pr-4 font-mono font-semibold text-[#0B1F3A]">
                            {inc.farmReferenceCode}
                          </td>
                          <td className="py-2 pr-4">{inc.province}</td>
                          <td className="py-2 pr-4 capitalize">
                            {inc.incidentType.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2 pr-4 capitalize">{inc.status}</td>
                          <td className="py-2 pr-4 text-right font-mono tabular-nums">
                            {inc.affectedAreaHectares}
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums">
                            {inc.occurredAt.slice(0, 10)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ============================================================== */}
          {/* 4. LANGUAGE & TRANSLATION MANAGEMENT                           */}
          {/* ============================================================== */}
          {section === 'languages' && (
            <div className="space-y-6">
              <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                      12 Official South African Languages & Translation Readiness
                    </h2>
                    <p className="text-xs text-[#475569]">
                      Manage active status, voice/SASL support flags, and inspect missing translation keys.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateWorkspace('learning')}
                    className="px-3.5 py-2 min-h-[38px] rounded-xl bg-[#EFF6FF] text-[#0B3D91] text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Open Learning Material Translations →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-[#475569]">
                        <th className="py-2 pr-3 font-semibold">Language</th>
                        <th className="py-2 pr-3 font-semibold">Active</th>
                        <th className="py-2 pr-3 font-semibold">Audio</th>
                        <th className="py-2 pr-3 font-semibold">SASL</th>
                        <th className="py-2 pr-3 font-semibold text-right">UI Coverage</th>
                        <th className="py-2 pr-3 font-semibold text-right">Missing Keys</th>
                        <th className="py-2 font-semibold text-right">Learning Reviewed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {languagesAudit.map((lang) => (
                        <tr key={lang.code}>
                          <td className="py-2.5 pr-3">
                            <button
                              type="button"
                              onClick={() => setSelectedLangCode(lang.code)}
                              className="text-left font-semibold text-[#0B1F3A] hover:underline cursor-pointer"
                            >
                              {lang.name} ({lang.code.toUpperCase()})
                            </button>
                          </td>
                          <td className="py-2.5 pr-3">
                            <input
                              type="checkbox"
                              checked={lang.isActive}
                              disabled={lang.code === 'en'}
                              onChange={() => handleToggleLanguageFlag(lang, 'isActive')}
                              className="accent-[#0B3D91]"
                            />
                          </td>
                          <td className="py-2.5 pr-3">
                            <input
                              type="checkbox"
                              checked={lang.hasAudioSupport}
                              onChange={() => handleToggleLanguageFlag(lang, 'hasAudioSupport')}
                              className="accent-[#0B3D91]"
                            />
                          </td>
                          <td className="py-2.5 pr-3">
                            <input
                              type="checkbox"
                              checked={lang.hasSignLanguageSupport}
                              onChange={() =>
                                handleToggleLanguageFlag(lang, 'hasSignLanguageSupport')
                              }
                              className="accent-[#0B3D91]"
                            />
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                            {lang.translatedUiKeys}/{lang.totalUiKeys}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                            <span
                              className={
                                lang.missingUiKeys.length > 0
                                  ? 'text-[#B45309] font-bold'
                                  : 'text-[#174C3C]'
                              }
                            >
                              {lang.missingUiKeys.length}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums">
                            {lang.learningMaterialsReviewedCount}/{lang.totalPublishedMaterials}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Inline UI Translation Key Editor */}
              <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                      UI Translation Editor
                    </h3>
                    <select
                      value={selectedLangCode}
                      onChange={(e) => setSelectedLangCode(e.target.value as LanguageCode)}
                      className="px-3 py-1.5 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold"
                    >
                      {languagesAudit.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.name} ({l.missingUiKeys.length} missing)
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0B1F3A] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyMissingKeys}
                      onChange={(e) => setOnlyMissingKeys(e.target.checked)}
                      className="accent-[#0B3D91]"
                    />
                    <span>Show Missing / Unreviewed Keys Only</span>
                  </label>
                </div>

                <div className="divide-y divide-[#E2E8F0] max-h-[520px] overflow-y-auto">
                  {filteredTranslationEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className="py-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center text-xs"
                    >
                      <div className="lg:col-span-4">
                        <p className="font-mono font-semibold text-[#0B1F3A]">{entry.key}</p>
                        <p className="text-[#475569] mt-0.5">{entry.englishDefault}</p>
                      </div>
                      <div className="lg:col-span-6">
                        <input
                          type="text"
                          value={draftValues[entry.key] ?? ''}
                          onChange={(e) =>
                            setDraftValues((prev) => ({ ...prev, [entry.key]: e.target.value }))
                          }
                          placeholder={`Enter ${selectedLangCode.toUpperCase()} translation...`}
                          className={`w-full px-3 py-2 rounded-lg border text-xs ${
                            entry.isMissing ? 'border-[#E5A952] bg-[#FFFBEB]' : 'border-[#CBD5E1]'
                          }`}
                        />
                      </div>
                      <div className="lg:col-span-2 flex items-center justify-end gap-2">
                        <span
                          className={`text-[11px] font-semibold ${
                            entry.isMissing
                              ? 'text-[#B45309]'
                              : entry.reviewed
                              ? 'text-[#174C3C]'
                              : 'text-[#475569]'
                          }`}
                        >
                          {entry.isMissing ? 'Missing' : entry.reviewed ? 'Reviewed' : 'Draft'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSaveTranslationKey(entry.key)}
                          className="px-3 py-1.5 min-h-[34px] rounded-lg bg-[#0B3D91] hover:bg-[#082E70] text-white font-semibold cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ============================================================== */}
          {/* 5. SYSTEM CONFIGURATION & ANNOUNCEMENTS                        */}
          {/* ============================================================== */}
          {section === 'config' && sysPayload && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveSystemConfig}
                className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                      Application, Notification, Reference & AI Configuration
                    </h2>
                    <p className="text-xs text-[#475569]">
                      Last updated: {new Date(sysPayload.config.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 min-h-[40px] rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-xs font-semibold cursor-pointer"
                  >
                    Save System Configuration
                  </button>
                </div>

                {/* Application Settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
                      Platform Name
                    </label>
                    <input
                      type="text"
                      value={sysPayload.config.application.platformName}
                      onChange={(e) =>
                        setSysPayload({
                          ...sysPayload,
                          config: {
                            ...sysPayload.config,
                            application: {
                              ...sysPayload.config.application,
                              platformName: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
                      Max Media Upload (MB)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={sysPayload.config.application.maxMediaUploadMb}
                      onChange={(e) =>
                        setSysPayload({
                          ...sysPayload,
                          config: {
                            ...sysPayload.config,
                            application: {
                              ...sysPayload.config.application,
                              maxMediaUploadMb: Number(e.target.value) || 15,
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-sm font-mono"
                    />
                  </div>
                  <div className="flex flex-col justify-end space-y-2 text-xs">
                    <label className="inline-flex items-center gap-2 font-medium text-[#0B1F3A]">
                      <input
                        type="checkbox"
                        checked={sysPayload.config.application.allowSelfRegistration}
                        onChange={(e) =>
                          setSysPayload({
                            ...sysPayload,
                            config: {
                              ...sysPayload.config,
                              application: {
                                ...sysPayload.config.application,
                                allowSelfRegistration: e.target.checked,
                              },
                            },
                          })
                        }
                        className="accent-[#0B3D91]"
                      />
                      <span>Allow Farmer Self-Registration</span>
                    </label>
                    <label className="inline-flex items-center gap-2 font-medium text-[#0B1F3A]">
                      <input
                        type="checkbox"
                        checked={sysPayload.config.application.maintenanceMode}
                        onChange={(e) =>
                          setSysPayload({
                            ...sysPayload,
                            config: {
                              ...sysPayload.config,
                              application: {
                                ...sysPayload.config.application,
                                maintenanceMode: e.target.checked,
                              },
                            },
                          })
                        }
                        className="accent-[#0B3D91]"
                      />
                      <span>Maintenance Banner Active</span>
                    </label>
                  </div>
                </div>

                {/* Notification & Weather Alert Thresholds */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-[#E2E8F0]">
                  <div>
                    <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
                      Heavy Rain Alert Threshold (mm)
                    </label>
                    <input
                      type="number"
                      value={sysPayload.config.notifications.rainfallAlertThresholdMm}
                      onChange={(e) =>
                        setSysPayload({
                          ...sysPayload,
                          config: {
                            ...sysPayload.config,
                            notifications: {
                              ...sysPayload.config.notifications,
                              rainfallAlertThresholdMm: Number(e.target.value) || 35,
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
                      Heat Stress Threshold (°C)
                    </label>
                    <input
                      type="number"
                      value={sysPayload.config.notifications.heatAlertThresholdC}
                      onChange={(e) =>
                        setSysPayload({
                          ...sysPayload,
                          config: {
                            ...sysPayload.config,
                            notifications: {
                              ...sysPayload.config.notifications,
                              heatAlertThresholdC: Number(e.target.value) || 34,
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-sm font-mono"
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-wrap items-center gap-5 text-xs pt-4">
                    <label className="inline-flex items-center gap-2 font-medium text-[#0B1F3A]">
                      <input
                        type="checkbox"
                        checked={sysPayload.config.notifications.inAppAlertsEnabled}
                        onChange={(e) =>
                          setSysPayload({
                            ...sysPayload,
                            config: {
                              ...sysPayload.config,
                              notifications: {
                                ...sysPayload.config.notifications,
                                inAppAlertsEnabled: e.target.checked,
                              },
                            },
                          })
                        }
                        className="accent-[#0B3D91]"
                      />
                      <span>In-App Alerts Enabled</span>
                    </label>
                    <label className="inline-flex items-center gap-2 font-medium text-[#0B1F3A]">
                      <input
                        type="checkbox"
                        checked={sysPayload.config.notifications.incidentEscalationNotify}
                        onChange={(e) =>
                          setSysPayload({
                            ...sysPayload,
                            config: {
                              ...sysPayload.config,
                              notifications: {
                                ...sysPayload.config.notifications,
                                incidentEscalationNotify: e.target.checked,
                              },
                            },
                          })
                        }
                        className="accent-[#0B3D91]"
                      />
                      <span>Incident Escalation Notifications</span>
                    </label>
                  </div>
                </div>

                {/* Agricultural Reference & AI Config */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-[#E2E8F0]">
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-[#0B1F3A]">
                      Soil Lab & Agricultural Reference Guidance Note
                    </label>
                    <textarea
                      rows={2}
                      value={sysPayload.config.agriculturalReference.soilLabGuidanceNote}
                      onChange={(e) =>
                        setSysPayload({
                          ...sysPayload,
                          config: {
                            ...sysPayload.config,
                            agriculturalReference: {
                              ...sysPayload.config.agriculturalReference,
                              soilLabGuidanceNote: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs"
                    />
                    <label className="block text-xs font-semibold text-[#0B1F3A]">
                      Valuation Estimation Disclaimer
                    </label>
                    <textarea
                      rows={2}
                      value={sysPayload.config.agriculturalReference.valuationDisclaimerText}
                      onChange={(e) =>
                        setSysPayload({
                          ...sysPayload,
                          config: {
                            ...sysPayload.config,
                            agriculturalReference: {
                              ...sysPayload.config.agriculturalReference,
                              valuationDisclaimerText: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
                          Primary Gemini Model
                        </label>
                        <input
                          type="text"
                          value={sysPayload.config.ai.primaryModel}
                          onChange={(e) =>
                            setSysPayload({
                              ...sysPayload,
                              config: {
                                ...sysPayload.config,
                                ai: { ...sysPayload.config.ai, primaryModel: e.target.value },
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs font-mono"
                        />
                      </div>
                      <div className="flex flex-col justify-end space-y-1.5 text-xs">
                        <label className="inline-flex items-center gap-2 font-medium text-[#0B1F3A]">
                          <input
                            type="checkbox"
                            checked={sysPayload.config.ai.aiEnabled}
                            onChange={(e) =>
                              setSysPayload({
                                ...sysPayload,
                                config: {
                                  ...sysPayload.config,
                                  ai: { ...sysPayload.config.ai, aiEnabled: e.target.checked },
                                },
                              })
                            }
                            className="accent-[#0B3D91]"
                          />
                          <span>Gemini AI Features Enabled</span>
                        </label>
                        <label className="inline-flex items-center gap-2 font-medium text-[#0B1F3A]">
                          <input
                            type="checkbox"
                            checked={sysPayload.config.ai.visualAnalysisEnabled}
                            onChange={(e) =>
                              setSysPayload({
                                ...sysPayload,
                                config: {
                                  ...sysPayload.config,
                                  ai: {
                                    ...sysPayload.config.ai,
                                    visualAnalysisEnabled: e.target.checked,
                                  },
                                },
                              })
                            }
                            className="accent-[#0B3D91]"
                          />
                          <span>Visual Photo/Video Analysis Enabled</span>
                        </label>
                      </div>
                    </div>
                    <label className="block text-xs font-semibold text-[#0B1F3A]">
                      AI Diagnostic Safety Notice
                    </label>
                    <textarea
                      rows={2}
                      value={sysPayload.config.ai.advisorySafetyDisclaimer}
                      onChange={(e) =>
                        setSysPayload({
                          ...sysPayload,
                          config: {
                            ...sysPayload.config,
                            ai: {
                              ...sysPayload.config.ai,
                              advisorySafetyDisclaimer: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs"
                    />
                  </div>
                </div>
              </form>

              {/* External Integration Status */}
              <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                  External Integration Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sysPayload.integrations.map((intg) => (
                    <div
                      key={intg.id}
                      className="border border-[#E2E8F0] rounded-xl p-4 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm text-[#0B1F3A]">{intg.name}</p>
                        <span
                          className={`text-[11px] font-mono font-bold uppercase ${
                            intg.status === 'connected' || intg.status === 'active'
                              ? 'text-[#174C3C]'
                              : 'text-[#B45309]'
                          }`}
                        >
                          {intg.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-[#475569]">{intg.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* System Announcements */}
              <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-[#0B3D91]" />
                  <h3 className="font-display text-lg font-bold text-[#0B1F3A]">
                    System Announcements ({sysPayload.announcements.length})
                  </h3>
                </div>

                <form
                  onSubmit={handleCreateAnnouncement}
                  className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-4 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={newAnnTitle}
                      onChange={(e) => setNewAnnTitle(e.target.value)}
                      placeholder="Announcement headline..."
                      className="px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
                    />
                    <select
                      value={newAnnRole}
                      onChange={(e) => setNewAnnRole(e.target.value as RoleCode | 'all')}
                      className="px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
                    >
                      <option value="all">All Users</option>
                      <option value="existing_farmer">Existing Farmers</option>
                      <option value="prospective_farmer">Prospective Farmers</option>
                      <option value="agricultural_expert">Agricultural Experts</option>
                      <option value="organisation_manager">Organisations</option>
                    </select>
                    <select
                      value={newAnnSeverity}
                      onChange={(e) =>
                        setNewAnnSeverity(e.target.value as 'info' | 'advisory' | 'warning')
                      }
                      className="px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
                    >
                      <option value="info">Info</option>
                      <option value="advisory">Advisory</option>
                      <option value="warning">Warning</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <input
                      type="text"
                      required
                      value={newAnnMsg}
                      onChange={(e) => setNewAnnMsg(e.target.value)}
                      placeholder="Announcement message shown on farmer dashboards..."
                      className="flex-1 min-w-[240px] px-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] bg-white text-xs"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-lg bg-[#0B3D91] hover:bg-[#082E70] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Publish Announcement</span>
                    </button>
                  </div>
                </form>

                <div className="divide-y divide-[#E2E8F0]">
                  {sysPayload.announcements.map((a) => (
                    <div
                      key={a.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#0B1F3A]">
                          {a.title} ({a.severity} · target: {a.targetRole})
                        </p>
                        <p className="text-[#475569] mt-0.5">{a.message}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleAnnouncement(a.id, a.isActive)}
                          className={`px-3 py-1 rounded-lg border font-semibold cursor-pointer ${
                            a.isActive
                              ? 'border-[#A7D7C5] text-[#174C3C]'
                              : 'border-[#CBD5E1] text-[#475569]'
                          }`}
                        >
                          {a.isActive ? 'Active' : 'Paused'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(a.id)}
                          aria-label="Delete announcement"
                          className="p-1.5 rounded-lg text-[#B91C1C] hover:bg-[#FEF2F2] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ============================================================== */}
          {/* 6. AUDIT & SECURITY LOGS                                       */}
          {/* ============================================================== */}
          {section === 'audit' && (
            <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                    Administrative & Security Audit Logs ({filteredAuditLogs.length})
                  </h2>
                  <p className="text-xs text-[#475569]">
                    Immutable chronological record of logins, permission grants/revocations, oversight views, configuration changes, and report exports.
                  </p>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#475569] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Filter action, actor, entity..."
                    className="pl-9 pr-3 py-2 min-h-[38px] rounded-lg border border-[#CBD5E1] text-sm"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#475569]">
                      <th className="py-2 pr-4 font-semibold">Timestamp</th>
                      <th className="py-2 pr-4 font-semibold">Action</th>
                      <th className="py-2 pr-4 font-semibold">Actor</th>
                      <th className="py-2 pr-4 font-semibold">Entity</th>
                      <th className="py-2 font-semibold">Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 pr-4 font-mono tabular-nums text-[#475569] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-4 font-mono font-semibold text-[#0B1F3A]">
                          {log.action}
                        </td>
                        <td className="py-2.5 pr-4 text-[#334155]">{log.actorEmail || 'System'}</td>
                        <td className="py-2.5 pr-4 text-[#475569]">{log.entityType}</td>
                        <td className="py-2.5 font-mono text-[11px] text-[#475569]">
                          {JSON.stringify(log.details)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ============================================================== */}
          {/* 7. ORGANISATIONS & AGRICULTURAL SPECIALISTS DIRECTORY          */}
          {/* ============================================================== */}
          {section === 'entities' && entities && (
            <div className="space-y-6">
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-3 text-xs text-[#0B1F3A]">
                <strong className="font-mono uppercase text-[#0B3D91]">Verification Policy:</strong>{' '}
                Demonstration specialists are clearly marked{' '}
                <span className="font-mono font-semibold">DEMONSTRATION DATA</span> and do not claim
                real SACNASP or SAVC accreditation.
              </div>

              <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Registered & Demonstration Organisations ({entities.organisations.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-[#475569]">
                        <th className="py-2 pr-4 font-semibold">Organisation</th>
                        <th className="py-2 pr-4 font-semibold">Type & Focus</th>
                        <th className="py-2 pr-4 font-semibold">Province / District</th>
                        <th className="py-2 pr-4 font-semibold text-right">Members</th>
                        <th className="py-2 pr-4 font-semibold text-right">Authorised Farms</th>
                        <th className="py-2 font-semibold text-right">Projects</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {entities.organisations.map((org) => (
                        <tr key={org.id}>
                          <td className="py-2.5 pr-4 font-semibold text-[#0B1F3A]">
                            <div>{org.name}</div>
                            {org.isDemonstration && (
                              <span className="text-[10px] font-mono uppercase text-[#0B3D91]">
                                DEMONSTRATION DATA
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-[#334155]">
                            {org.organisationType.replace(/_/g, ' ')} · {org.primaryFocus}
                          </td>
                          <td className="py-2.5 pr-4 text-[#475569]">
                            {org.province} · {org.district}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                            {org.membersCount}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                            {org.authorisedFarmsCount}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums">
                            {org.projectsCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Agricultural Specialists Directory ({entities.specialists.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-[#475569]">
                        <th className="py-2 pr-4 font-semibold">Specialist</th>
                        <th className="py-2 pr-4 font-semibold">Category</th>
                        <th className="py-2 pr-4 font-semibold">Provinces Served</th>
                        <th className="py-2 pr-4 font-semibold">Verification / Regulatory</th>
                        <th className="py-2 pr-4 font-semibold text-right">Grants</th>
                        <th className="py-2 font-semibold text-right">Consultations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {entities.specialists.map((sp) => (
                        <tr key={sp.userId}>
                          <td className="py-2.5 pr-4">
                            <p className="font-semibold text-[#0B1F3A]">{sp.fullName}</p>
                            <p className="text-[#475569]">{sp.email}</p>
                            {sp.isDemonstration && (
                              <span className="text-[10px] font-mono uppercase text-[#0B3D91]">
                                DEMONSTRATION DATA
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 capitalize text-[#0B3D91] font-semibold">
                            {sp.specialisation.replace(/_/g, ' ')}
                          </td>
                          <td className="py-2.5 pr-4 text-[#334155]">
                            {sp.provincesServed.join(', ') || 'South Africa'}
                          </td>
                          <td className="py-2.5 pr-4 text-[#475569]">
                            <span className="font-mono">{sp.verificationStatus}</span>
                            {sp.regulatedService && sp.regulatoryBodyName
                              ? ` · Regulated (${sp.regulatoryBodyName})`
                              : ''}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                            {sp.activeFarmGrantsCount}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums">
                            {sp.consultationsCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ============================================================== */}
          {/* 8. PUBLIC SOUTH AFRICAN DATASET PROVENANCE                     */}
          {/* ============================================================== */}
          {section === 'datasets' && datasetsMeta && (
            <div className="space-y-6">
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-3 text-xs text-[#0B1F3A]">
                {datasetsMeta.disclaimer}
              </div>

              <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
                  Integrated & Referenced Public Datasets ({datasetsMeta.datasets.length})
                </h2>
                <div className="divide-y divide-[#E2E8F0]">
                  {datasetsMeta.datasets.map((ds) => (
                    <div key={ds.id} className="py-4 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-display text-sm font-bold text-[#0B1F3A]">
                            {ds.sourceName} — {ds.datasetOrApiName}
                          </p>
                          <p className="font-mono text-[#0B3D91] break-all">{ds.sourceUrl}</p>
                        </div>
                        <span
                          className={`font-mono font-semibold uppercase ${
                            ds.status === 'active'
                              ? 'text-[#174C3C]'
                              : ds.status === 'reference_only'
                              ? 'text-[#0B3D91]'
                              : 'text-[#B91C1C]'
                          }`}
                        >
                          {ds.integrationMode.replace(/_/g, ' ')} · {ds.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[#334155]">
                        <p>
                          <strong>Coverage:</strong> {ds.geographicCoverage}
                        </p>
                        <p>
                          <strong>Units:</strong> {ds.units}
                        </p>
                        <p>
                          <strong>Retrieved:</strong>{' '}
                          <span className="font-mono">{ds.retrievedAt}</span>
                        </p>
                      </div>
                      <p className="text-[#475569]">
                        <strong>Licence / Terms:</strong> {ds.licenceAndTerms}
                      </p>
                      <p className="text-[#475569]">
                        <strong>Limitations:</strong> {ds.limitations}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {loading && !overview && !usersList.length && !farmOversight && !sysPayload && !entities && !datasetsMeta && (
            <div className="bg-white border border-[#CBD5E1] rounded-2xl p-8 text-center text-sm text-[#475569]">
              Loading administration module...
            </div>
          )}
    </div>
  );

  if (embedded) {
    return renderMainContent();
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col lg:flex-row">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0B1F3A] text-white border-r border-[#163055]">
        <div className="h-16 px-6 flex items-center justify-between border-b border-[#163055]">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-[#93C5FD]" />
            <div>
              <p className="font-display text-lg font-bold tracking-tight leading-none">
                Field Shift
              </p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#93C5FD] mt-0.5">
                Admin Portal
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-5 overflow-y-auto">{renderSidebarLinks()}</nav>

        <div className="p-4 border-t border-[#163055] space-y-3">
          <div className="px-2">
            <p className="text-sm font-semibold text-white truncate">
              {user.profile?.fullName || user.email}
            </p>
            <p className="text-xs text-[#93C5FD] truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#FC3D21] text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b border-[#CBD5E1] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label="Toggle admin menu"
              className="lg:hidden p-2 rounded-lg border border-[#CBD5E1] text-[#0B1F3A]"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="font-display text-lg font-bold text-[#0B1F3A]">
              {navItems.find((n) => n.id === section)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#475569]">
            <span className="hidden sm:inline font-mono">
              System Administrator · {user.email}
            </span>
          </div>
        </header>

        {mobileNavOpen && (
          <div className="lg:hidden bg-[#0B1F3A] text-white px-4 py-4 space-y-3">
            {renderSidebarLinks(true)}
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#0B3D91] text-sm font-semibold text-white"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
          {renderMainContent()}
        </main>
      </div>
    </div>
  );
};
