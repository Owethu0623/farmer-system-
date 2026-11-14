import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sprout, Tractor } from 'lucide-react';
import { LANGUAGE_LIST, t } from '../i18n/translations';
import { apiRequest } from '../lib/api';
import { AuthUser, LanguageCode, ProvinceInfo } from '../types';
import { LanguageSelector, SpeakButton, VoiceInputButton } from './AccessibilityControls';
import { InteractiveFarmMap, SpatialUpdatePayload } from './InteractiveFarmMap';

interface OnboardingWizardProps {
  user: AuthUser;
  provinces: ProvinceInfo[];
  languageCode: LanguageCode;
  onLanguageChange: (code: LanguageCode) => void;
  isSpeaking: boolean;
  isListening: boolean;
  speechSupported: boolean;
  recognitionSupported: boolean;
  onSpeak: (text: string) => void;
  onStopSpeaking: () => void;
  onStartVoiceInput: (cb: (text: string) => void) => void;
  onCompleted: (updatedUser: AuthUser) => void;
}

const FARMING_TYPE_OPTIONS = [
  'Vegetables & Horticulture',
  'Maize & Dryland Grain',
  'Poultry & Layers',
  'Beef & Nguni Cattle',
  'Goats & Sheep',
  'Citrus & Subtropical Fruit',
  'Mixed Crop & Livestock',
];

const RESOURCE_OPTIONS = [
  'Borehole Water',
  'River / Dam Access',
  'Municipal Water',
  'Tractor / Implements Access',
  'Seed & Input Capital',
  'Fencing & Kraal',
  'Local Cooperative Access',
  'Extension Officer Support',
];

const INTEREST_OPTIONS = [
  'Spinach & Cabbage',
  'Tomatoes & Tunnel Veg',
  'White / Yellow Maize',
  'Broilers & Eggs',
  'Nguni / Beef Cattle',
  'Boer Goats & Sheep',
  'Drip Irrigation',
  'Agro-Processing',
];

const GOAL_OPTIONS = [
  'Generate steady monthly income',
  'Supply local schools & fresh markets',
  'Build family food security',
  'Expand to commercial scale',
  'Create local rural jobs',
];

const WATER_OPTIONS = [
  'Borehole & Storage Tank',
  'Perennial River / Stream',
  'Earth Dam & Drip Irrigation',
  'Municipal Supply',
  'Rain-fed Only',
];

const CROP_PRESETS = [
  'Yellow Maize',
  'White Maize',
  'Swiss Chard (Spinach)',
  'Cabbage',
  'Tomatoes',
  'Potatoes',
  'Butternut',
  'Soybeans',
  'Citrus / Oranges',
  'Lucerne',
];

const LIVESTOCK_PRESETS = [
  'Nguni Cattle',
  'Bonsmara / Beef Cattle',
  'Boer Goats',
  'Dorper Sheep',
  'Free-Range Layers',
  'Broiler Chickens',
  'Pigs',
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  user,
  provinces,
  languageCode,
  onLanguageChange,
  isSpeaking,
  isListening,
  speechSupported,
  recognitionSupported,
  onSpeak,
  onStopSpeaking,
  onStartVoiceInput,
  onCompleted,
}) => {
  const isProspective = user.roleCode === 'prospective_farmer';
  const [step, setStep] = useState(1);
  const totalSteps = 4;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(user.profile?.fullName || '');
  const [province, setProvince] = useState(user.profile?.province || provinces[0]?.name || 'KwaZulu-Natal');
  const activeLanguageInfo = useMemo(
    () => LANGUAGE_LIST.find((l) => l.code === languageCode) || LANGUAGE_LIST[0],
    [languageCode]
  );

  const provinceObj = useMemo(
    () => provinces.find((p) => p.name === province) || provinces[0],
    [provinces, province]
  );

  const [district, setDistrict] = useState(
    user.profile?.district || provinceObj?.districts[0]?.name || ''
  );

  const districtObj = useMemo(
    () => provinceObj?.districts.find((d) => d.name === district) || provinceObj?.districts[0],
    [provinceObj, district]
  );

  // Prospective Farmer state
  const [preferredFarmingType, setPreferredFarmingType] = useState(FARMING_TYPE_OPTIONS[0]);
  const [intendedLandSize, setIntendedLandSize] = useState(2);
  const [landAccessStatus, setLandAccessStatus] = useState('Community / Tribal Land');
  const [availableResources, setAvailableResources] = useState<string[]>(['Borehole Water']);
  const [farmingExperience, setFarmingExperience] = useState('Home garden or family plot');
  const [agriculturalInterests, setAgriculturalInterests] = useState<string[]>(['Spinach & Cabbage']);
  const [farmingGoals, setFarmingGoals] = useState<string[]>(['Generate steady monthly income']);

  // Existing Farmer state
  const [farmName, setFarmName] = useState('');
  const [localMunicipality, setLocalMunicipality] = useState(
    districtObj?.localMunicipalities[0] || ''
  );
  const [townOrVillage, setTownOrVillage] = useState('');
  const [farmSizeHectares, setFarmSizeHectares] = useState(10);
  const [yearsOfExperience, setYearsOfExperience] = useState(5);
  const [waterAvailability, setWaterAvailability] = useState(WATER_OPTIONS[0]);
  const [farmingActivities, setFarmingActivities] = useState<string[]>([FARMING_TYPE_OPTIONS[0]]);
  const [existingCrops, setExistingCrops] = useState<string[]>(['Yellow Maize']);
  const [existingLivestock, setExistingLivestock] = useState<string[]>([]);
  const [spatial, setSpatial] = useState<SpatialUpdatePayload | null>(null);

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const handleProvinceSelect = (name: string) => {
    setProvince(name);
    const p = provinces.find((item) => item.name === name);
    const d = p?.districts[0];
    setDistrict(d?.name || '');
    setLocalMunicipality(d?.localMunicipalities[0] || '');
    setSpatial(null);
  };

  const handleDistrictSelect = (name: string) => {
    setDistrict(name);
    const d = provinceObj?.districts.find((item) => item.name === name);
    setLocalMunicipality(d?.localMunicipalities[0] || '');
    setSpatial(null);
  };

  const currentLat = spatial?.latitude ?? districtObj?.center.lat ?? -28.4793;
  const currentLng = spatial?.longitude ?? districtObj?.center.lng ?? 24.6727;

  const stepNarration = isProspective
    ? `Step ${step} of ${totalSteps}. Prospective Farmer Onboarding. Choose your options by tapping the large buttons.`
    : `Step ${step} of ${totalSteps}. Existing Farm Registration. Capture your farm location using GPS or the interactive OpenStreetMap and draw your farm boundary.`;

  const submitProspective = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ user: AuthUser }>('/api/onboarding/prospective', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          preferredLanguageCode: languageCode,
          province,
          district,
          preferredFarmingType,
          intendedLandSizeHectares: intendedLandSize,
          landAccessStatus,
          availableResources,
          farmingExperience,
          agriculturalInterests,
          farmingGoals,
        }),
      });
      onCompleted(res.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save onboarding profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitExisting = async () => {
    setError(null);
    if (!farmName.trim() || !townOrVillage.trim()) {
      setError('Please enter your farm name and town or village name.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{ user: AuthUser }>('/api/onboarding/existing', {
        method: 'POST',
        body: JSON.stringify({
          farmName,
          province,
          districtMunicipality: district,
          localMunicipality,
          townOrVillage,
          latitude: currentLat,
          longitude: currentLng,
          locationSource: spatial?.locationSource || 'municipal_center',
          locationDescription: spatial?.locationDescription || '',
          locationConfirmed: Boolean(spatial?.locationConfirmed),
          gpsLatitude: spatial?.gpsLatitude ?? null,
          gpsLongitude: spatial?.gpsLongitude ?? null,
          gpsAccuracyMeters: spatial?.gpsAccuracyMeters ?? null,
          gpsCapturedAt: spatial?.gpsCapturedAt ?? null,
          farmSizeHectares,
          farmingActivities,
          yearsOfExperience,
          waterAvailability,
          existingCrops,
          existingLivestock,
          boundaryGeojson: spatial?.boundaryGeojson || null,
          preferredLanguageCode: languageCode,
        }),
      });
      onCompleted(res.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not complete farm registration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white border border-[#CBD5E1] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] text-[#0B3D91] flex items-center justify-center shrink-0">
              {isProspective ? <Sprout className="w-6 h-6" /> : <Tractor className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-xs font-semibold text-[#0B3D91]">
                {isProspective ? 'Prospective Farmer Journey' : 'Existing Farmer Journey'} · Step {step} of {totalSteps}
              </p>
              <h1 className="font-display text-xl font-bold text-[#0B1F3A]">
                {isProspective ? 'Start Your Farming Plan' : 'Register Your First Farm'}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <LanguageSelector value={languageCode} onChange={onLanguageChange} compact />
            <SpeakButton
              text={stepNarration}
              languageCode={languageCode}
              isSpeaking={isSpeaking}
              onSpeak={onSpeak}
              onStop={onStopSpeaking}
              supported={speechSupported}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-colors ${
                idx <= step ? 'bg-[#0B3D91]' : 'bg-[#CBD5E1]'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="bg-white border border-[#CBD5E1] rounded-2xl p-6 sm:p-8 space-y-6">
          {/* PROSPECTIVE FARMER WIZARD */}
          {isProspective && step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">
                  Confirm Your Full Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tap here or use Speak Answer"
                    className="flex-1 px-4 py-3.5 rounded-xl border border-[#CBD5E1] text-base"
                  />
                  <VoiceInputButton
                    languageCode={languageCode}
                    isListening={isListening}
                    supported={recognitionSupported}
                    onStart={() => onStartVoiceInput((txt) => setFullName(txt))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">
                  Farming Experience
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    'No prior experience (Complete beginner)',
                    'Home garden or family plot',
                    'Worked on a farm (1-3 years)',
                    'Agricultural training / college',
                  ].map((exp) => (
                    <button
                      key={exp}
                      type="button"
                      onClick={() => setFarmingExperience(exp)}
                      className={`p-3.5 rounded-xl border text-left text-sm font-semibold transition-colors cursor-pointer ${
                        farmingExperience === exp
                          ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                          : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:border-[#0B3D91]'
                      }`}
                    >
                      {exp}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3">
                Preferred language: <strong className="text-[#0B1F3A]">{activeLanguageInfo.nativeName}</strong> ({activeLanguageInfo.name}). You can switch languages anytime using the dropdown in the top bar.
              </p>
            </div>
          )}

          {isProspective && step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">
                  Where do you plan to farm? (Province)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {provinces.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => handleProvinceSelect(p.name)}
                      className={`p-3.5 rounded-xl border text-left font-semibold text-sm transition-colors cursor-pointer ${
                        province === p.name
                          ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                          : 'bg-white border-[#CBD5E1] hover:border-[#0B3D91]'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">Select District</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(provinceObj?.districts || []).map((d) => (
                    <button
                      key={d.name}
                      type="button"
                      onClick={() => handleDistrictSelect(d.name)}
                      className={`p-3.5 rounded-xl border text-left font-medium text-sm transition-colors cursor-pointer ${
                        district === d.name
                          ? 'bg-[#EFF6FF] border-[#0B3D91] text-[#0B1F3A] font-semibold'
                          : 'bg-white border-[#CBD5E1] hover:border-[#0B3D91]'
                      }`}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isProspective && step === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">
                  Preferred Farming Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {FARMING_TYPE_OPTIONS.map((ft) => (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => setPreferredFarmingType(ft)}
                      className={`p-3.5 rounded-xl border text-left text-sm font-semibold transition-colors cursor-pointer ${
                        preferredFarmingType === ft
                          ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                          : 'bg-white border-[#CBD5E1] hover:border-[#0B3D91]'
                      }`}
                    >
                      {ft}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-[#0B1F3A]">
                  Available or Intended Land Size (Hectares)
                </label>
                <div className="flex flex-wrap gap-2">
                  {[0.5, 1, 2, 5, 10, 25].map((ha) => (
                    <button
                      key={ha}
                      type="button"
                      onClick={() => setIntendedLandSize(ha)}
                      className={`px-3.5 py-2.5 rounded-lg border text-sm font-mono font-semibold cursor-pointer ${
                        intendedLandSize === ha
                          ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                          : 'bg-white border-[#CBD5E1]'
                      }`}
                    >
                      {ha} ha
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-[#0B1F3A]">
                  Land Access Situation
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Still looking for land',
                    'Community / Tribal Land',
                    'Leasing / Municipal Commonage',
                    'Family or Owned Land',
                  ].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setLandAccessStatus(opt)}
                      className={`p-3 rounded-xl border text-left text-sm font-medium cursor-pointer ${
                        landAccessStatus === opt
                          ? 'bg-[#EFF6FF] border-[#0B3D91] text-[#0B1F3A] font-semibold'
                          : 'bg-white border-[#CBD5E1]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isProspective && step === 4 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">
                  Available Resources (Tap all that apply)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {RESOURCE_OPTIONS.map((res) => {
                    const checked = availableResources.includes(res);
                    return (
                      <button
                        key={res}
                        type="button"
                        onClick={() => toggleItem(availableResources, setAvailableResources, res)}
                        className={`p-3 rounded-xl border text-left text-sm flex items-center justify-between cursor-pointer ${
                          checked
                            ? 'bg-[#ECF5F2] border-[#174C3C] text-[#0B1F3A] font-semibold'
                            : 'bg-white border-[#CBD5E1]'
                        }`}
                      >
                        <span>{res}</span>
                        {checked && <Check className="w-4 h-4 text-[#174C3C]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">
                  Agricultural Interests
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {INTEREST_OPTIONS.map((item) => {
                    const checked = agriculturalInterests.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleItem(agriculturalInterests, setAgriculturalInterests, item)}
                        className={`p-3 rounded-xl border text-left text-sm flex items-center justify-between cursor-pointer ${
                          checked
                            ? 'bg-[#ECF5F2] border-[#174C3C] text-[#0B1F3A] font-semibold'
                            : 'bg-white border-[#CBD5E1]'
                        }`}
                      >
                        <span>{item}</span>
                        {checked && <Check className="w-4 h-4 text-[#174C3C]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">Your Farming Goals</label>
                <div className="grid grid-cols-1 gap-2">
                  {GOAL_OPTIONS.map((g) => {
                    const checked = farmingGoals.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleItem(farmingGoals, setFarmingGoals, g)}
                        className={`p-3 rounded-xl border text-left text-sm flex items-center justify-between cursor-pointer ${
                          checked
                            ? 'bg-[#ECF5F2] border-[#174C3C] text-[#0B1F3A] font-semibold'
                            : 'bg-white border-[#CBD5E1]'
                        }`}
                      >
                        <span>{g}</span>
                        {checked && <Check className="w-4 h-4 text-[#174C3C]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* EXISTING FARMER WIZARD */}
          {!isProspective && step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">
                  1. Farm Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={farmName}
                    onChange={(e) => setFarmName(e.target.value)}
                    placeholder="e.g. Vlakfontein Family Farm"
                    className="flex-1 px-4 py-3.5 rounded-xl border border-[#CBD5E1] text-base"
                  />
                  <VoiceInputButton
                    languageCode={languageCode}
                    isListening={isListening}
                    supported={recognitionSupported}
                    onStart={() => onStartVoiceInput((txt) => setFarmName(txt))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-[#0B1F3A]">
                    Farm Size (Hectares)
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.5}
                    value={farmSizeHectares}
                    onChange={(e) => setFarmSizeHectares(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-[#CBD5E1] font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-[#0B1F3A]">
                    Years of Farming Experience
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={yearsOfExperience}
                    onChange={(e) => setYearsOfExperience(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-[#CBD5E1] font-mono"
                  />
                </div>
              </div>

              <p className="text-xs text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3">
                Preferred language: <strong className="text-[#0B1F3A]">{activeLanguageInfo.nativeName}</strong> ({activeLanguageInfo.name}). You can change this anytime using the dropdown in the top bar.
              </p>
            </div>
          )}

          {!isProspective && step === 2 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">Province</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {provinces.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => handleProvinceSelect(p.name)}
                      className={`p-3 rounded-xl border text-left text-sm font-semibold cursor-pointer ${
                        province === p.name
                          ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                          : 'bg-white border-[#CBD5E1]'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-[#0B1F3A]">
                    District Municipality
                  </label>
                  <select
                    value={district}
                    onChange={(e) => handleDistrictSelect(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#CBD5E1] bg-white"
                  >
                    {(provinceObj?.districts || []).map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-[#0B1F3A]">
                    Local Municipality
                  </label>
                  <select
                    value={localMunicipality}
                    onChange={(e) => setLocalMunicipality(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#CBD5E1] bg-white"
                  >
                    {(districtObj?.localMunicipalities || []).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-[#0B1F3A]">
                  Town or Village Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={townOrVillage}
                    onChange={(e) => setTownOrVillage(e.target.value)}
                    placeholder="e.g. Mooi River / Bergville"
                    className="flex-1 px-4 py-3 rounded-xl border border-[#CBD5E1]"
                  />
                  <VoiceInputButton
                    languageCode={languageCode}
                    isListening={isListening}
                    supported={recognitionSupported}
                    onStart={() => onStartVoiceInput((txt) => setTownOrVillage(txt))}
                  />
                </div>
              </div>
            </div>
          )}

          {!isProspective && step === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">
                  Water Availability
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {WATER_OPTIONS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWaterAvailability(w)}
                      className={`p-3.5 rounded-xl border text-left text-sm font-semibold cursor-pointer ${
                        waterAvailability === w
                          ? 'bg-[#0B3D91] text-white border-[#0B3D91]'
                          : 'bg-white border-[#CBD5E1]'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">
                  Farming Activities
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FARMING_TYPE_OPTIONS.map((act) => {
                    const active = farmingActivities.includes(act);
                    return (
                      <button
                        key={act}
                        type="button"
                        onClick={() => toggleItem(farmingActivities, setFarmingActivities, act)}
                        className={`p-3 rounded-xl border text-left text-sm flex items-center justify-between cursor-pointer ${
                          active
                            ? 'bg-[#ECF5F2] border-[#174C3C] text-[#0B1F3A] font-semibold'
                            : 'bg-white border-[#CBD5E1]'
                        }`}
                      >
                        <span>{act}</span>
                        {active && <Check className="w-4 h-4 text-[#174C3C]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!isProspective && step === 4 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">
                  Existing Crops (Tap all grown on this farm)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CROP_PRESETS.map((crop) => {
                    const active = existingCrops.includes(crop);
                    return (
                      <button
                        key={crop}
                        type="button"
                        onClick={() => toggleItem(existingCrops, setExistingCrops, crop)}
                        className={`p-2.5 rounded-xl border text-left text-sm flex items-center justify-between cursor-pointer ${
                          active
                            ? 'bg-[#ECF5F2] border-[#174C3C] text-[#0B1F3A] font-semibold'
                            : 'bg-white border-[#CBD5E1]'
                        }`}
                      >
                        <span>{crop}</span>
                        {active && <Check className="w-4 h-4 text-[#174C3C]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-base font-bold text-[#0B1F3A]">
                  Existing Livestock (Optional)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LIVESTOCK_PRESETS.map((stock) => {
                    const active = existingLivestock.includes(stock);
                    return (
                      <button
                        key={stock}
                        type="button"
                        onClick={() => toggleItem(existingLivestock, setExistingLivestock, stock)}
                        className={`p-2.5 rounded-xl border text-left text-sm flex items-center justify-between cursor-pointer ${
                          active
                            ? 'bg-[#ECF5F2] border-[#174C3C] text-[#0B1F3A] font-semibold'
                            : 'bg-white border-[#CBD5E1]'
                        }`}
                      >
                        <span>{stock}</span>
                        {active && <Check className="w-4 h-4 text-[#174C3C]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <InteractiveFarmMap
                latitude={currentLat}
                longitude={currentLng}
                locationSource={spatial?.locationSource || 'municipal_center'}
                locationDescription={spatial?.locationDescription || ''}
                locationConfirmed={Boolean(spatial?.locationConfirmed)}
                gpsLatitude={spatial?.gpsLatitude}
                gpsLongitude={spatial?.gpsLongitude}
                gpsAccuracyMeters={spatial?.gpsAccuracyMeters}
                gpsCapturedAt={spatial?.gpsCapturedAt}
                boundary={spatial?.boundaryGeojson || null}
                onSpatialChange={setSpatial}
                title="GPS Farm Location, Search & Boundary Drawing"
              />
            </div>
          )}

          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="inline-flex items-center gap-2 px-5 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 font-semibold text-sm text-[#0B1F3A] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t(languageCode, 'backLabel')}</span>
            </button>

            {step < totalSteps ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(totalSteps, s + 1))}
                className="inline-flex items-center gap-2 px-6 min-h-[44px] rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white font-semibold text-sm cursor-pointer"
              >
                <span>{t(languageCode, 'saveAndContinue')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={isProspective ? submitProspective : submitExisting}
                className="inline-flex items-center gap-2 px-6 min-h-[44px] rounded-xl bg-[#174C3C] hover:bg-[#113B2E] disabled:opacity-60 text-white font-semibold text-sm cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{submitting ? 'Saving...' : t(languageCode, 'completeSetup')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
