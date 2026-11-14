import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { LANGUAGE_LIST, t } from '../i18n/translations';
import { apiRequest, setStoredToken } from '../lib/api';
import { AuthUser, ExpertSpecialisation, LanguageCode, OrganisationType, RoleCode } from '../types';
import { LanguageSelector, SpeakButton } from './AccessibilityControls';

interface AuthViewsProps {
  initialMode: 'login' | 'register' | 'reset';
  preselectRole?: 'prospective_farmer' | 'existing_farmer';
  languageCode: LanguageCode;
  onLanguageChange: (code: LanguageCode) => void;
  isSpeaking: boolean;
  onSpeak: (text: string) => void;
  onStopSpeaking: () => void;
  speechSupported: boolean;
  onBackHome: () => void;
  onAuthenticated: (user: AuthUser, activationCode?: string) => void;
}

const DEMO_ACCOUNTS: { label: string; email: string; role: string }[] = [
  { label: 'Prospective Farmer (Thabo)', email: 'thabo.mokoena@fieldshift.co.za', role: 'Sesotho · Free State' },
  { label: 'Existing Farmer (Nomsa)', email: 'nomsa.dlamini@fieldshift.co.za', role: 'isiZulu · 2 Farms in KZN' },
  { label: 'Agricultural Expert (Dr. Pieter)', email: 'pieter.vandermerwe@fieldshift.co.za', role: 'Afrikaans · Western Cape' },
  { label: 'Organisation Manager (Lindiwe)', email: 'lindiwe.nkosi@fieldshift.co.za', role: 'siSwati · Mpumalanga' },
  { label: 'System Administrator (Sipho)', email: 'admin@fieldshift.co.za', role: 'English · Full Admin' },
];

export const AuthViews: React.FC<AuthViewsProps> = ({
  initialMode,
  preselectRole,
  languageCode,
  onLanguageChange,
  isSpeaking,
  onSpeak,
  onStopSpeaking,
  speechSupported,
  onBackHome,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [roleCode, setRoleCode] = useState<RoleCode>(preselectRole || 'prospective_farmer');
  const [selectedLang, setSelectedLang] = useState<LanguageCode>(languageCode);
  const [expertSpecialisation, setExpertSpecialisation] =
    useState<ExpertSpecialisation>('agronomist');
  const [expertQualifications, setExpertQualifications] = useState('');
  const [organisationName, setOrganisationName] = useState('');
  const [organisationType, setOrganisationType] = useState<OrganisationType>('cooperative');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showDemoHelpers, setShowDemoHelpers] = useState(false);

  // Password reset state
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [previewResetCode, setPreviewResetCode] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiRequest<{ user: AuthUser; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setStoredToken(data.token);
      onAuthenticated(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiRequest<{ user: AuthUser; token: string; activationCode: string }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            fullName,
            email,
            password,
            roleCode,
            preferredLanguageCode: selectedLang,
            ...(roleCode === 'agricultural_expert'
              ? {
                  expertSpecialisation,
                  expertQualifications: expertQualifications.trim() || undefined,
                }
              : {}),
            ...(roleCode === 'organisation_manager'
              ? {
                  organisationName: organisationName.trim() || undefined,
                  organisationType,
                }
              : {}),
          }),
        }
      );
      setStoredToken(data.token);
      onLanguageChange(selectedLang);
      onAuthenticated(data.user, data.activationCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      const data = await apiRequest<{ message: string; previewResetCode?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      setInfoMessage(data.message);
      if (data.previewResetCode) {
        setPreviewResetCode(data.previewResetCode);
        setResetCode(data.previewResetCode);
      }
      setResetStep('confirm');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not initiate password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      const data = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, resetCode, newPassword }),
      });
      setInfoMessage(data.message);
      setMode('login');
      setResetStep('request');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  const pageGuide =
    mode === 'register'
      ? 'Create your Field Shift account. Choose whether you want to start farming, already have a farm, or advise farmers. Pick your preferred language.'
      : mode === 'reset'
      ? 'Enter your email address to receive a password reset code, then set a new password.'
      : 'Sign in with your email and password to open your Field Shift workspace.';

  return (
    <div className="min-h-screen bg-[#F6F7F4] flex flex-col">
      <header className="bg-white border-b border-[#E2E6DF]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#143326] hover:text-[#2D6A4F] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Field Shift</span>
          </button>
          <div className="flex items-center gap-3">
            <LanguageSelector value={languageCode} onChange={onLanguageChange} compact />
            <SpeakButton
              text={pageGuide}
              languageCode={languageCode}
              isSpeaking={isSpeaking}
              onSpeak={onSpeak}
              onStop={onStopSpeaking}
              supported={speechSupported}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Segmented Tab Switch */}
          <div className="flex items-center gap-1 p-1 bg-[#F1F3EF] rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                mode === 'login' ? 'bg-white text-[#143326] shadow-sm' : 'text-[#4A5A50]'
              }`}
            >
              {t(languageCode, 'signIn')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                mode === 'register' ? 'bg-white text-[#143326] shadow-sm' : 'text-[#4A5A50]'
              }`}
            >
              {t(languageCode, 'register')}
            </button>
          </div>

          {error && (
            <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm font-medium">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="bg-[#EDF5EF] border border-[#BFD6C5] text-[#143326] rounded-xl px-4 py-3 text-sm font-medium flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-bold text-[#143326]">
                  Welcome back to Field Shift
                </h1>
                <p className="text-sm text-[#4A5A50] mt-1">
                  Sign in to manage your farms, fields, and agricultural guidance.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#17201B]">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="farmer@example.co.za"
                  className="w-full px-4 py-3 rounded-xl border border-[#D4DDD2] bg-white text-[#17201B] focus:outline-none focus:border-[#1B4332]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-[#17201B]">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setError(null);
                      setInfoMessage(null);
                    }}
                    className="text-xs font-semibold text-[#2D6A4F] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-[#D4DDD2] bg-white text-[#17201B] focus:outline-none focus:border-[#1B4332]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#4A5A50] hover:text-[#143326] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-5 rounded-xl bg-[#1B4332] hover:bg-[#143326] disabled:opacity-60 text-white font-semibold text-base transition-colors cursor-pointer"
              >
                {loading ? 'Signing in...' : t(languageCode, 'signIn')}
              </button>

              {/* Seeded Role Credentials Helper for Evaluators */}
              <div className="pt-4 border-t border-[#E2E6DF]">
                <button
                  type="button"
                  onClick={() => setShowDemoHelpers(!showDemoHelpers)}
                  className="text-xs font-semibold text-[#2D6A4F] hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {showDemoHelpers
                      ? 'Hide seeded test accounts'
                      : 'Test any of the 5 seeded South African roles'}
                  </span>
                </button>

                {showDemoHelpers && (
                  <div className="mt-3 space-y-2 bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-3">
                    <p className="text-xs text-[#4A5A50]">
                      Click any seeded account below to populate credentials and sign in through the real backend authenticator (Password: <span className="font-mono font-semibold text-[#17201B]">FieldShift2026!</span>):
                    </p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {DEMO_ACCOUNTS.map((acc) => (
                        <button
                          key={acc.email}
                          type="button"
                          onClick={() => {
                            setEmail(acc.email);
                            setPassword('FieldShift2026!');
                          }}
                          className="text-left px-3 py-2 rounded-lg bg-white border border-[#D4DDD2] hover:border-[#1B4332] flex items-center justify-between gap-2 text-xs cursor-pointer"
                        >
                          <span className="font-semibold text-[#143326]">{acc.label}</span>
                          <span className="text-[#4A5A50]">{acc.role}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-bold text-[#143326]">
                  Create your Field Shift account
                </h1>
                <p className="text-sm text-[#4A5A50] mt-1">
                  Simple registration with guided onboarding in your chosen language.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#17201B]">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Zanele Mabaso"
                  className="w-full px-4 py-3 rounded-xl border border-[#D4DDD2] bg-white text-[#17201B] focus:outline-none focus:border-[#1B4332]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#17201B]">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="zanele@example.co.za"
                  className="w-full px-4 py-3 rounded-xl border border-[#D4DDD2] bg-white text-[#17201B] focus:outline-none focus:border-[#1B4332]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#17201B]">
                  How will you use Field Shift?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      code: 'prospective_farmer' as RoleCode,
                      title: 'Prospective Farmer',
                      desc: 'I want to start farming',
                    },
                    {
                      code: 'existing_farmer' as RoleCode,
                      title: 'Existing Farmer',
                      desc: 'I already own or run a farm',
                    },
                    {
                      code: 'agricultural_expert' as RoleCode,
                      title: 'Agricultural Expert',
                      desc: 'Extension officer or agronomist',
                    },
                    {
                      code: 'organisation_manager' as RoleCode,
                      title: 'Organisation Manager',
                      desc: 'Cooperative or agribusiness lead',
                    },
                  ].map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => setRoleCode(r.code)}
                      className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                        roleCode === r.code
                          ? 'bg-[#EDF5EF] border-[#1B4332] text-[#143326]'
                          : 'bg-white border-[#D4DDD2] text-[#17201B] hover:border-[#2D6A4F]'
                      }`}
                    >
                      <p className="font-semibold text-sm">{r.title}</p>
                      <p className="text-xs text-[#4A5A50] mt-0.5">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {roleCode === 'agricultural_expert' && (
                <div className="bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#2D6A4F]">
                    Agricultural Expert Details
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#17201B]">
                        Specialisation
                      </label>
                      <select
                        value={expertSpecialisation}
                        onChange={(e) =>
                          setExpertSpecialisation(e.target.value as ExpertSpecialisation)
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                      >
                        <option value="agronomist">Agronomist</option>
                        <option value="soil_specialist">Soil Specialist</option>
                        <option value="livestock_specialist">Livestock Specialist</option>
                        <option value="veterinarian">Veterinarian</option>
                        <option value="agricultural_consultant">Agricultural Consultant</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#17201B]">
                        Qualifications (Optional)
                      </label>
                      <input
                        type="text"
                        value={expertQualifications}
                        onChange={(e) => setExpertQualifications(e.target.value)}
                        placeholder="e.g. BSc Agric (Agronomy), Pr.Sci.Nat"
                        className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {roleCode === 'organisation_manager' && (
                <div className="bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#2D6A4F]">
                    Organisation Registration
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#17201B]">
                        Organisation Name
                      </label>
                      <input
                        type="text"
                        value={organisationName}
                        onChange={(e) => setOrganisationName(e.target.value)}
                        placeholder="e.g. Eastern Cape Smallholder Co-op"
                        className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#17201B]">
                        Organisation Type
                      </label>
                      <select
                        value={organisationType}
                        onChange={(e) => setOrganisationType(e.target.value as OrganisationType)}
                        className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                      >
                        <option value="cooperative">Agricultural Cooperative</option>
                        <option value="agricultural_company">Agricultural Company</option>
                        <option value="extension_agency">Extension Agency</option>
                        <option value="research_body">Research Body</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#17201B]">
                  Preferred Language (12 Official Languages)
                </label>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value as LanguageCode)}
                  className="w-full px-4 py-3 rounded-xl border border-[#D4DDD2] bg-white text-[#17201B] focus:outline-none focus:border-[#1B4332]"
                >
                  {LANGUAGE_LIST.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName} ({l.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#17201B]">
                  Password (min 8 characters, letters & numbers)
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  className="w-full px-4 py-3 rounded-xl border border-[#D4DDD2] bg-white text-[#17201B] focus:outline-none focus:border-[#1B4332]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-5 rounded-xl bg-[#1B4332] hover:bg-[#143326] disabled:opacity-60 text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <UserPlus className="w-5 h-5" />
                <span>{loading ? 'Creating account...' : t(languageCode, 'register')}</span>
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#143326]">
                    Reset Your Password
                  </h1>
                  <p className="text-sm text-[#4A5A50] mt-1">
                    Request a reset code and choose a new password.
                  </p>
                </div>
                <KeyRound className="w-6 h-6 text-[#1B4332]" />
              </div>

              {resetStep === 'request' ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-[#17201B]">
                      Registered Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#D4DDD2] bg-white text-[#17201B]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-[#1B4332] text-white font-semibold cursor-pointer"
                  >
                    {loading ? 'Generating code...' : 'Request Reset Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetConfirm} className="space-y-4">
                  {previewResetCode && (
                    <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl p-3 text-xs text-[#143326]">
                      Reset code generated for testing: <span className="font-mono font-bold">{previewResetCode}</span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-[#17201B]">Reset Code</label>
                    <input
                      type="text"
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#D4DDD2] font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-[#17201B]">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#D4DDD2]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-[#1B4332] text-white font-semibold cursor-pointer"
                  >
                    {loading ? 'Updating password...' : 'Save New Password'}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-sm font-semibold text-[#2D6A4F] hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
