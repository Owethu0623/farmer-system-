import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  CheckCircle2,
  Clock,
  Edit3,
  Film,
  Globe,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  SkipForward,
  Trash2,
} from 'lucide-react';
import { LANGUAGE_LIST } from '../i18n/translations';
import { apiRequest } from '../lib/api';
import { getOfflineStaleness, isLikelyOfflineError, loadOfflineBundle } from '../lib/offlineSync';
import {
  AuthUser,
  LanguageCode,
  LearningCategoryCode,
  LearningCategoryMeta,
  LearningCentrePayload,
  LearningContentType,
  LearningDifficulty,
  LearningMaterialViewItem,
} from '../types';
import { SpeakButton } from './AccessibilityControls';

// Static asset imports bundled cleanly by Vite for illustrated guides
import imgSoilCrops from '../assets/images/learn_soil_crops_1794665981693.jpg';
import imgPestDisease from '../assets/images/learn_pest_disease_1794665981588.jpg';
import imgLivestockHousing from '../assets/images/learn_livestock_housing_1794665981830.jpg';
import imgEquipmentSafety from '../assets/images/learn_equipment_safety_1794665980759.jpg';
import imgHeroFarmland from '../assets/images/hero_sa_farmland_1794662157430.jpg';
import imgProspectiveFarmer from '../assets/images/card_prospective_farmer_1794662158844.jpg';
import imgFieldMapping from '../assets/images/card_field_mapping_1794662159319.jpg';

const ILLUSTRATION_MAP: Record<string, { src: string; alt: string }> = {
  soil_crops: {
    src: imgSoilCrops,
    alt: 'Soil profile testing, organic mulch, and drip-irrigated young maize and vegetable seedlings',
  },
  pest_disease: {
    src: imgPestDisease,
    alt: 'Crop scouting magnification showing fungal leaf spot vs beneficial ladybug predator',
  },
  livestock_housing: {
    src: imgLivestockHousing,
    alt: 'Clean ventilated South African small-stock shelter, water troughs, and rotational grazing camps',
  },
  equipment_safety: {
    src: imgEquipmentSafety,
    alt: 'Knapsack sprayer calibration with PPE, tractor PTO guard, and maintenance kit',
  },
  farmland_hero: {
    src: imgHeroFarmland,
    alt: 'South African farmland hillside fields at morning light',
  },
  prospective_card: {
    src: imgProspectiveFarmer,
    alt: 'Smallholder checking soil quality and irrigation planning',
  },
  field_mapping: {
    src: imgFieldMapping,
    alt: 'Agricultural field boundaries and irrigation zoning',
  },
};

const CONTENT_TYPE_LABELS: Record<LearningContentType, string> = {
  article: 'Article',
  step_by_step_guide: 'Step-by-Step Guide',
  illustrated_guide: 'Illustrated Guide',
  video_lesson: 'Video Lesson',
};

const DIFFICULTY_LABELS: Record<LearningDifficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  experienced: 'Experienced',
};

interface LearningCentreViewProps {
  user: AuthUser;
  languageCode: LanguageCode;
  largeMode: boolean;
  isSpeaking: boolean;
  speechSupported: boolean;
  onSpeak: (txt: string) => void;
  onStopSpeaking: () => void;
}

export const LearningCentreView: React.FC<LearningCentreViewProps> = ({
  user,
  languageCode,
  largeMode,
  isSpeaking,
  speechSupported,
  onSpeak,
  onStopSpeaking,
}) => {
  const [payload, setPayload] = useState<LearningCentrePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [isCacheStale, setIsCacheStale] = useState(false);

  const [viewMode, setViewMode] = useState<'all' | 'saved' | 'progress' | 'admin'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | LearningCategoryCode>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | LearningDifficulty>('all');
  const [selectedType, setSelectedType] = useState<'all' | LearningContentType>('all');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Video storyboard player state
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);

  // Admin editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState({
    category: 'beginner_farming' as LearningCategoryCode,
    contentType: 'step_by_step_guide' as LearningContentType,
    difficulty: 'beginner' as LearningDifficulty,
    illustrationKey: 'soil_crops',
    videoUrl: '',
    videoDurationLabel: '',
    sourceAttribution: 'DALRRD / ARC Reviewed Extension Guidance',
    verifiedOfficialReference: true,
    status: 'draft' as 'published' | 'draft' | 'archived',
    estimatedMinutes: 6,
    tags: '',
    languageCode: 'en' as LanguageCode,
    title: '',
    summary: '',
    body: '',
    stepsText: '',
    reviewed: false,
  });

  // Admin translation manager state
  const [translationTargetId, setTranslationTargetId] = useState<string | null>(null);
  const [translationLang, setTranslationLang] = useState<LanguageCode>('zu');
  const [translationForm, setTranslationForm] = useState({
    title: '',
    summary: '',
    body: '',
    stepsText: '',
    reviewed: false,
  });

  const loadMaterials = useCallback(
    async (includeDrafts = false) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set('languageCode', languageCode);
        if (includeDrafts) qs.set('includeDrafts', 'true');
        const data = await apiRequest<LearningCentrePayload>(
          `/api/learning/materials?${qs.toString()}`
        );
        setPayload(data);
        setCachedAt(null);
        setIsCacheStale(false);
        setSelectedMaterialId((prev) =>
          prev && data.materials.some((m) => m.id === prev)
            ? prev
            : data.materials[0]?.id || null
        );
      } catch (err: unknown) {
        if (isLikelyOfflineError(err)) {
          const bundle = await loadOfflineBundle(user.id);
          if (bundle && bundle.learningGuides?.length > 0) {
            const staleness = getOfflineStaleness(bundle);
            const catMap = new Map<string, LearningCategoryMeta>();
            for (const m of bundle.learningGuides) {
              if (!catMap.has(m.category)) {
                catMap.set(m.category, {
                  code: m.category,
                  label: m.categoryLabel,
                  description: `${m.categoryLabel} offline guide`,
                });
              }
            }
            const completedCount = bundle.learningGuides.filter(
              (m) => m.userProgress.status === 'completed'
            ).length;
            const inProgressCount = bundle.learningGuides.filter(
              (m) => m.userProgress.status === 'in_progress'
            ).length;
            const savedCount = bundle.learningGuides.filter((m) => m.userProgress.isSaved).length;
            const offlinePayload: LearningCentrePayload = {
              categories: Array.from(catMap.values()),
              materials: bundle.learningGuides,
              canManageContent: false,
              learnerStats: {
                totalPublished: bundle.learningGuides.length,
                completedCount,
                inProgressCount,
                savedCount,
                overallPercent:
                  bundle.learningGuides.length > 0
                    ? Math.round((completedCount / bundle.learningGuides.length) * 100)
                    : 0,
              },
              officialGuidanceNotice:
                'Offline mode: viewing locally downloaded learning guides. Progress updates and bookmarks sync when internet returns.',
            };
            setPayload(offlinePayload);
            setCachedAt(bundle.downloadedAt);
            setIsCacheStale(staleness.isBundleStale);
            setSelectedMaterialId((prev) =>
              prev && offlinePayload.materials.some((m) => m.id === prev)
                ? prev
                : offlinePayload.materials[0]?.id || null
            );
            setNotice(
              `Offline mode: viewing ${offlinePayload.materials.length} downloaded guide(s) cached on ${new Date(
                bundle.downloadedAt
              ).toLocaleString()}.`
            );
            return;
          }
        }
        setError(err instanceof Error ? err.message : 'Unable to load learning materials.');
      } finally {
        setLoading(false);
      }
    },
    [languageCode, user.id]
  );

  useEffect(() => {
    loadMaterials(viewMode === 'admin');
  }, [loadMaterials, viewMode]);

  const filteredMaterials = useMemo(() => {
    const items = payload?.materials || [];
    const q = searchQuery.trim().toLowerCase();
    return items.filter((m) => {
      if (viewMode === 'saved' && !m.userProgress.isSaved) return false;
      if (viewMode === 'progress' && m.userProgress.status === 'not_started') return false;
      if (viewMode !== 'admin' && m.status !== 'published') return false;
      if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
      if (selectedDifficulty !== 'all' && m.difficulty !== selectedDifficulty) return false;
      if (selectedType !== 'all' && m.contentType !== selectedType) return false;
      if (q) {
        const hay = `${m.displayTitle} ${m.displaySummary} ${m.categoryLabel} ${m.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [payload?.materials, viewMode, selectedCategory, selectedDifficulty, selectedType, searchQuery]);

  const activeMaterial = useMemo(
    () =>
      filteredMaterials.find((m) => m.id === selectedMaterialId) ||
      filteredMaterials[0] ||
      payload?.materials.find((m) => m.id === selectedMaterialId) ||
      null,
    [filteredMaterials, payload?.materials, selectedMaterialId]
  );

  // Reset storyboard slide when switching articles
  useEffect(() => {
    setActiveSlideIndex(0);
    setVideoPlaying(false);
  }, [activeMaterial?.id]);

  // Auto-advance interactive video storyboard slides when playing
  useEffect(() => {
    if (!videoPlaying || !activeMaterial?.videoSlides?.length) return;
    const slides = activeMaterial.videoSlides;
    const currentSlide = slides[activeSlideIndex];
    const ms = Math.max(2500, (currentSlide?.durationSeconds || 5) * 1000);
    const timer = setTimeout(() => {
      if (activeSlideIndex + 1 < slides.length) {
        setActiveSlideIndex((i) => i + 1);
      } else {
        setVideoPlaying(false);
      }
    }, ms);
    return () => clearTimeout(timer);
  }, [videoPlaying, activeSlideIndex, activeMaterial]);

  const handleToggleSave = async (mat: LearningMaterialViewItem) => {
    setError(null);
    try {
      await apiRequest(`/api/learning/materials/${mat.id}/save`, {
        method: 'POST',
        body: JSON.stringify({ isSaved: !mat.userProgress.isSaved, languageCode }),
      });
      await loadMaterials(viewMode === 'admin');
    } catch (err: unknown) {
      if (isLikelyOfflineError(err)) {
        setNotice('Reading guides is available offline, while saving bookmark state requires internet connectivity.');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to update saved state.');
    }
  };

  const handleToggleStep = async (mat: LearningMaterialViewItem, stepIdx: number) => {
    setError(null);
    const current = mat.userProgress.completedSteps || [];
    const nextSteps = current.includes(stepIdx)
      ? current.filter((i) => i !== stepIdx)
      : [...current, stepIdx];
    try {
      await apiRequest(`/api/learning/materials/${mat.id}/progress`, {
        method: 'POST',
        body: JSON.stringify({
          completedSteps: nextSteps,
          totalSteps: mat.displaySteps.length,
          languageCode,
        }),
      });
      await loadMaterials(viewMode === 'admin');
    } catch (err: unknown) {
      if (isLikelyOfflineError(err)) {
        setNotice('Reading guides works offline; updating cloud progress percentage requires internet connectivity.');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to save step progress.');
    }
  };

  const handleMarkStatus = async (
    mat: LearningMaterialViewItem,
    status: 'completed' | 'not_started'
  ) => {
    setError(null);
    try {
      await apiRequest(`/api/learning/materials/${mat.id}/progress`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          completedSteps:
            status === 'completed' ? mat.displaySteps.map((_, idx) => idx) : [],
          totalSteps: mat.displaySteps.length,
          languageCode,
        }),
      });
      await loadMaterials(viewMode === 'admin');
    } catch (err: unknown) {
      if (isLikelyOfflineError(err)) {
        setNotice('Reading guides works offline; updating cloud completion status requires internet connectivity.');
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to update completion status.');
    }
  };

  // Admin Handlers
  const handleStartNewAdminItem = () => {
    setEditingId(null);
    setAdminForm({
      category: 'beginner_farming',
      contentType: 'step_by_step_guide',
      difficulty: 'beginner',
      illustrationKey: 'soil_crops',
      videoUrl: '',
      videoDurationLabel: '',
      sourceAttribution: 'DALRRD / ARC Reviewed Extension Guidance',
      verifiedOfficialReference: true,
      status: 'draft',
      estimatedMinutes: 6,
      tags: '',
      languageCode: 'en',
      title: '',
      summary: '',
      body: '',
      stepsText: '',
      reviewed: false,
    });
  };

  const handleEditAdminItem = (mat: LearningMaterialViewItem) => {
    setEditingId(mat.id);
    const tr = mat.translations?.en || mat.translations?.[mat.resolvedLanguageCode];
    setAdminForm({
      category: mat.category,
      contentType: mat.contentType,
      difficulty: mat.difficulty,
      illustrationKey: mat.illustrationKey || 'soil_crops',
      videoUrl: mat.videoUrl || '',
      videoDurationLabel: mat.videoDurationLabel || '',
      sourceAttribution: mat.sourceAttribution,
      verifiedOfficialReference: mat.verifiedOfficialReference,
      status: mat.status,
      estimatedMinutes: mat.estimatedMinutes,
      tags: mat.tags.join(', '),
      languageCode: 'en',
      title: tr?.title || mat.displayTitle,
      summary: tr?.summary || mat.displaySummary,
      body: tr?.body || mat.displayBody,
      stepsText: (tr?.steps || mat.displaySteps).join('\n'),
      reviewed: Boolean(tr?.reviewed),
    });
  };

  const handleSaveAdminMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const bodyPayload = {
      ...adminForm,
      steps: adminForm.stepsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      if (editingId) {
        await apiRequest(`/api/learning/admin/materials/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(bodyPayload),
        });
        setNotice(`Updated learning material "${adminForm.title}".`);
      } else {
        await apiRequest('/api/learning/admin/materials', {
          method: 'POST',
          body: JSON.stringify(bodyPayload),
        });
        setNotice(`Created learning material "${adminForm.title}".`);
      }
      handleStartNewAdminItem();
      await loadMaterials(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save learning material.');
    }
  };

  const handlePublishToggle = async (mat: LearningMaterialViewItem) => {
    const nextStatus = mat.status === 'published' ? 'draft' : 'published';
    setError(null);
    try {
      await apiRequest(`/api/learning/admin/materials/${mat.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice(`Material "${mat.displayTitle}" is now ${nextStatus}.`);
      await loadMaterials(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to change publish status.');
    }
  };

  const handleDeleteAdminItem = async (mat: LearningMaterialViewItem) => {
    setError(null);
    try {
      await apiRequest(`/api/learning/admin/materials/${mat.id}`, { method: 'DELETE' });
      setNotice(`Removed "${mat.displayTitle}".`);
      if (editingId === mat.id) handleStartNewAdminItem();
      await loadMaterials(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to delete material.');
    }
  };

  const handleOpenTranslationEditor = (mat: LearningMaterialViewItem, lang: LanguageCode = 'zu') => {
    setTranslationTargetId(mat.id);
    setTranslationLang(lang);
    const existing = mat.translations?.[lang];
    setTranslationForm({
      title: existing?.title || '',
      summary: existing?.summary || '',
      body: existing?.body || '',
      stepsText: (existing?.steps || []).join('\n'),
      reviewed: Boolean(existing?.reviewed),
    });
  };

  const handleTranslationLangSwitch = (lang: LanguageCode) => {
    setTranslationLang(lang);
    const mat = payload?.materials.find((m) => m.id === translationTargetId);
    const existing = mat?.translations?.[lang];
    setTranslationForm({
      title: existing?.title || '',
      summary: existing?.summary || '',
      body: existing?.body || '',
      stepsText: (existing?.steps || []).join('\n'),
      reviewed: Boolean(existing?.reviewed),
    });
  };

  const handleSaveTranslation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!translationTargetId) return;
    setError(null);
    setNotice(null);
    try {
      await apiRequest(
        `/api/learning/admin/materials/${translationTargetId}/translations/${translationLang}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            title: translationForm.title,
            summary: translationForm.summary,
            body: translationForm.body,
            steps: translationForm.stepsText
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean),
            reviewed: translationForm.reviewed,
          }),
        }
      );
      setNotice(
        `Saved ${translationLang.toUpperCase()} translation (${translationForm.reviewed ? 'Reviewed & Approved' : 'Draft'}).`
      );
      await loadMaterials(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save language version.');
    }
  };

  const renderIllustration = (mat: LearningMaterialViewItem) => {
    const asset = ILLUSTRATION_MAP[mat.illustrationKey] || ILLUSTRATION_MAP.soil_crops;
    const imgSrc = mat.customIllustrationDataUrl || asset.src;
    const isBroken = brokenImages[mat.id];

    if (isBroken || !imgSrc) {
      return (
        <div className="w-full h-56 rounded-xl bg-[#EDF5EF] border border-[#D4DDD2] flex flex-col items-center justify-center p-6 text-center">
          <BookOpen className="w-10 h-10 text-[#1B4332] mb-2" />
          <p className="font-display font-bold text-[#143326]">{mat.categoryLabel}</p>
          <p className="text-xs text-[#4A5A50] mt-1">{asset.alt}</p>
        </div>
      );
    }

    return (
      <figure className="space-y-1.5">
        <img
          src={imgSrc}
          alt={asset.alt}
          onError={() => setBrokenImages((prev) => ({ ...prev, [mat.id]: true }))}
          className="w-full h-56 sm:h-64 object-cover rounded-xl border border-[#E2E6DF]"
        />
        <figcaption className="text-xs text-[#4A5A50]">{asset.alt}</figcaption>
      </figure>
    );
  };

  const langMeta = LANGUAGE_LIST.find((l) => l.code === languageCode);
  const translationTargetMaterial =
    payload?.materials.find((m) => m.id === translationTargetId) || null;

  return (
    <div className="space-y-6">
      {/* Header & Learner Progress Overview */}
      <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#2D6A4F]">
              <BookOpen className="w-4 h-4" />
              <span>Agricultural Learning Centre · Beginner to Experienced</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#143326]">
              Practical Farming Guides & Training
            </h1>
            <p className="text-sm text-[#4A5A50]">
              Step-by-step field instructions, illustrations, video lessons, and audio playback across all 14 core farming disciplines.
            </p>
          </div>

          {/* Learner Progress Strip */}
          {payload && (
            <div className="grid grid-cols-3 gap-3 bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl px-4 py-3 text-center">
              <div>
                <p className="text-[11px] text-[#4A5A50]">Completed</p>
                <p className="font-mono text-lg font-bold tabular-nums text-[#1B4332]">
                  {payload.learnerStats.completedCount}/{payload.learnerStats.totalPublished}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#4A5A50]">Saved</p>
                <p className="font-mono text-lg font-bold tabular-nums text-[#143326]">
                  {payload.learnerStats.savedCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#4A5A50]">Progress</p>
                <p className="font-mono text-lg font-bold tabular-nums text-[#143326]">
                  {payload.learnerStats.overallPercent}%
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Sub-tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E2E6DF]">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'all', label: 'All Guides & Lessons' },
                { id: 'saved', label: `Saved (${payload?.learnerStats.savedCount || 0})` },
                { id: 'progress', label: 'My Progress' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === tab.id
                    ? 'bg-[#1B4332] text-white'
                    : 'bg-[#F6F7F4] text-[#35443B] border border-[#E2E6DF] hover:border-[#1B4332]'
                }`}
              >
                {tab.label}
              </button>
            ))}
            {payload?.canManageContent && (
              <button
                type="button"
                onClick={() => setViewMode('admin')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'admin'
                    ? 'bg-[#143326] text-white'
                    : 'bg-[#EDF5EF] text-[#1B4332] border border-[#BFD6C5] hover:bg-[#DCECE1]'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Content Administration</span>
              </button>
            )}
          </div>

          <p className="text-xs text-[#4A5A50] flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#1B4332]" />
            <span>
              Language: <strong className="text-[#143326]">{langMeta?.nativeName || languageCode}</strong> (shows reviewed translations where available)
            </span>
          </p>
        </div>
      </div>

      {/* Official Verification Disclaimer */}
      <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl px-4 py-3 text-xs sm:text-sm text-[#143326] flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" />
        <span>
          {payload?.officialGuidanceNotice ||
            'Published learning materials follow reviewed South African agricultural extension references. Consult a qualified agronomist or veterinarian for site-specific diagnosis or treatment.'}
        </span>
      </div>

      {cachedAt && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs sm:text-sm ${
            isCacheStale
              ? 'bg-[#FFF6EB] border-[#F0D3A8] text-[#6B440B]'
              : 'bg-[#F6F7F4] border-[#D4DDD2] text-[#35443B]'
          }`}
        >
          <span className="font-semibold">
            {isCacheStale ? 'Outdated Offline Guide Cache' : 'Viewing Saved Offline Learning Guides'}
          </span>{' '}
          · Downloaded <span className="font-mono">{new Date(cachedAt).toLocaleString()}</span>.
          {isCacheStale
            ? ' Cache is older than 24 hours — reconnect to refresh guides and sync reading progress.'
            : ' Guides remain readable offline; progress and bookmark updates require internet.'}
        </div>
      )}

      {error && (
        <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-[#EDF5EF] border border-[#BFD6C5] text-[#143326] rounded-xl px-4 py-3 text-sm">
          {notice}
        </div>
      )}

      {/* ADMIN CONTENT STUDIO */}
      {viewMode === 'admin' && payload?.canManageContent && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Create / Edit Form */}
            <form
              onSubmit={handleSaveAdminMaterial}
              className="lg:col-span-7 bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-[#143326]">
                  {editingId ? 'Edit Learning Material' : 'Create Learning Material'}
                </h2>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleStartNewAdminItem}
                    className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
                  >
                    + Create New Instead
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#35443B] mb-1">
                    Category (14 Official Disciplines)
                  </label>
                  <select
                    value={adminForm.category}
                    onChange={(e) =>
                      setAdminForm((p) => ({
                        ...p,
                        category: e.target.value as LearningCategoryCode,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                  >
                    {payload.categories.map((cat) => (
                      <option key={cat.code} value={cat.code}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#35443B] mb-1">
                    Format Type
                  </label>
                  <select
                    value={adminForm.contentType}
                    onChange={(e) =>
                      setAdminForm((p) => ({
                        ...p,
                        contentType: e.target.value as LearningContentType,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                  >
                    {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#35443B] mb-1">
                    Difficulty Level
                  </label>
                  <select
                    value={adminForm.difficulty}
                    onChange={(e) =>
                      setAdminForm((p) => ({
                        ...p,
                        difficulty: e.target.value as LearningDifficulty,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="experienced">Experienced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#35443B] mb-1">
                    Illustration Asset
                  </label>
                  <select
                    value={adminForm.illustrationKey}
                    onChange={(e) =>
                      setAdminForm((p) => ({ ...p, illustrationKey: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                  >
                    <option value="soil_crops">Soil Profile & Seedlings</option>
                    <option value="pest_disease">Crop Pest & Disease Scouting</option>
                    <option value="livestock_housing">Livestock Shelter & Grazing</option>
                    <option value="equipment_safety">Sprayers, PTO & PPE Safety</option>
                    <option value="farmland_hero">South African Farmland</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#35443B] mb-1">
                    Publish Status
                  </label>
                  <select
                    value={adminForm.status}
                    onChange={(e) =>
                      setAdminForm((p) => ({
                        ...p,
                        status: e.target.value as 'published' | 'draft' | 'archived',
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                  >
                    <option value="draft">Draft (Unpublished)</option>
                    <option value="published">Published (Live)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#35443B] mb-1">
                    Estimated Study Minutes
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={adminForm.estimatedMinutes}
                    onChange={(e) =>
                      setAdminForm((p) => ({
                        ...p,
                        estimatedMinutes: Math.max(1, Number(e.target.value) || 5),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] font-mono tabular-nums text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#35443B] mb-1">
                    Verified Source Attribution (Required for Official Accuracy)
                  </label>
                  <input
                    type="text"
                    value={adminForm.sourceAttribution}
                    onChange={(e) =>
                      setAdminForm((p) => ({ ...p, sourceAttribution: e.target.value }))
                    }
                    placeholder="e.g. ARC-Vegetable & Ornamental Plants Extension Bulletin"
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#35443B] mb-1">
                    English Base Title
                  </label>
                  <input
                    type="text"
                    required
                    value={adminForm.title}
                    onChange={(e) => setAdminForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#35443B] mb-1">
                    Summary
                  </label>
                  <input
                    type="text"
                    required
                    value={adminForm.summary}
                    onChange={(e) => setAdminForm((p) => ({ ...p, summary: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#35443B] mb-1">
                    Instructional Body
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={adminForm.body}
                    onChange={(e) => setAdminForm((p) => ({ ...p, body: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#35443B] mb-1">
                    Step-by-Step Instructions (one practical step per line)
                  </label>
                  <textarea
                    rows={3}
                    value={adminForm.stepsText}
                    onChange={(e) => setAdminForm((p) => ({ ...p, stepsText: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#35443B] mb-1">
                    Tags (comma-separated) & Optional Video URL
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={adminForm.tags}
                      onChange={(e) => setAdminForm((p) => ({ ...p, tags: e.target.value }))}
                      placeholder="soil, irrigation, maize"
                      className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                    />
                    <input
                      type="url"
                      value={adminForm.videoUrl}
                      onChange={(e) => setAdminForm((p) => ({ ...p, videoUrl: e.target.value }))}
                      placeholder="https://... (optional video link)"
                      className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-5 pt-1 text-xs text-[#17201B]">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminForm.verifiedOfficialReference}
                    onChange={(e) =>
                      setAdminForm((p) => ({
                        ...p,
                        verifiedOfficialReference: e.target.checked,
                      }))
                    }
                  />
                  <span>Verified against official SA agricultural extension source</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminForm.reviewed}
                    onChange={(e) =>
                      setAdminForm((p) => ({ ...p, reviewed: e.target.checked }))
                    }
                  />
                  <span>Mark English version Reviewed & Approved</span>
                </label>
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white text-sm font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{editingId ? 'Save Changes' : 'Create Learning Material'}</span>
              </button>
            </form>

            {/* Existing Materials Table + Language Version Manager */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-[#143326]">
                  Manage Catalog ({payload.materials.length})
                </h2>
                <div className="divide-y divide-[#E2E6DF] max-h-96 overflow-y-auto pr-1">
                  {payload.materials.map((m) => (
                    <div key={m.id} className="py-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#143326] truncate">
                            {m.displayTitle}
                          </p>
                          <p className="text-[11px] text-[#4A5A50]">
                            {m.categoryLabel} ·{' '}
                            <span
                              className={
                                m.status === 'published'
                                  ? 'text-[#1B4332] font-semibold'
                                  : 'text-[#9B6A16] font-semibold'
                              }
                            >
                              {m.status.toUpperCase()}
                            </span>{' '}
                            · Reviewed: {m.availableReviewedLanguages.join(', ').toUpperCase() || 'None'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleEditAdminItem(m)}
                          className="px-2.5 py-1 rounded-lg border border-[#D4DDD2] hover:bg-[#EDF2EC] font-semibold text-[#143326] cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTranslationEditor(m)}
                          className="px-2.5 py-1 rounded-lg border border-[#D4DDD2] hover:bg-[#EDF2EC] font-semibold text-[#1B4332] cursor-pointer"
                        >
                          Translations ({m.availableReviewedLanguages.length}/12)
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePublishToggle(m)}
                          className="px-2.5 py-1 rounded-lg border border-[#D4DDD2] hover:bg-[#EDF2EC] font-semibold text-[#35443B] cursor-pointer"
                        >
                          {m.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAdminItem(m)}
                          aria-label={`Delete ${m.displayTitle}`}
                          className="px-2 py-1 rounded-lg border border-[#E8B4B4] text-[#8E2424] hover:bg-[#FDF2F2] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Language Version Editor */}
              {translationTargetMaterial && (
                <form
                  onSubmit={handleSaveTranslation}
                  className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-bold text-[#143326]">
                      Language Version: {translationTargetMaterial.displayTitle}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setTranslationTargetId(null)}
                      className="text-xs text-[#4A5A50] hover:underline cursor-pointer"
                    >
                      Close
                    </button>
                  </div>

                  <select
                    value={translationLang}
                    onChange={(e) => handleTranslationLangSwitch(e.target.value as LanguageCode)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                  >
                    {LANGUAGE_LIST.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.nativeName} ({l.name})
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    required
                    value={translationForm.title}
                    onChange={(e) =>
                      setTranslationForm((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="Translated title..."
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                  <input
                    type="text"
                    required
                    value={translationForm.summary}
                    onChange={(e) =>
                      setTranslationForm((p) => ({ ...p, summary: e.target.value }))
                    }
                    placeholder="Translated summary..."
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                  <textarea
                    rows={3}
                    required
                    value={translationForm.body}
                    onChange={(e) =>
                      setTranslationForm((p) => ({ ...p, body: e.target.value }))
                    }
                    placeholder="Translated guide body..."
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                  <textarea
                    rows={3}
                    value={translationForm.stepsText}
                    onChange={(e) =>
                      setTranslationForm((p) => ({ ...p, stepsText: e.target.value }))
                    }
                    placeholder="Translated steps (one per line)..."
                    className="w-full px-3 py-2 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                  <label className="flex items-center gap-2 text-xs text-[#17201B] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={translationForm.reviewed}
                      onChange={(e) =>
                        setTranslationForm((p) => ({ ...p, reviewed: e.target.checked }))
                      }
                    />
                    <span>Reviewed & Approved for display to farmers</span>
                  </label>
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white text-xs font-semibold cursor-pointer"
                  >
                    Save {translationLang.toUpperCase()} Version
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LEARNER SEARCH, 14 CATEGORIES & READER */}
      {viewMode !== 'admin' && (
        <>
          {/* Filter Toolbar */}
          <div className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 text-[#4A5A50] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search soil, maize, irrigation, housing, tractor..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                />
              </div>

              <div className="md:col-span-3">
                <select
                  aria-label="Filter by learning category"
                  value={selectedCategory}
                  onChange={(e) =>
                    setSelectedCategory(e.target.value as 'all' | LearningCategoryCode)
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                >
                  <option value="all">All 14 Categories</option>
                  {(payload?.categories || []).map((cat: LearningCategoryMeta) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <select
                  aria-label="Filter by difficulty"
                  value={selectedDifficulty}
                  onChange={(e) =>
                    setSelectedDifficulty(e.target.value as 'all' | LearningDifficulty)
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                >
                  <option value="all">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="experienced">Experienced</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <select
                  aria-label="Filter by format"
                  value={selectedType}
                  onChange={(e) =>
                    setSelectedType(e.target.value as 'all' | LearningContentType)
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                >
                  <option value="all">All Formats</option>
                  {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 14 Category Selector Grid */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#E2E6DF]">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-[#143326] text-white'
                    : 'bg-[#F6F7F4] text-[#35443B] hover:bg-[#EDF2EC]'
                }`}
              >
                All Categories
              </button>
              {(payload?.categories || []).map((cat) => (
                <button
                  key={cat.code}
                  type="button"
                  onClick={() => setSelectedCategory(cat.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    selectedCategory === cat.code
                      ? 'bg-[#143326] text-white'
                      : 'bg-[#F6F7F4] text-[#35443B] hover:bg-[#EDF2EC]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Master-Detail Reader Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left List */}
            <aside className="lg:col-span-5 space-y-3">
              {loading && (
                <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 text-sm text-[#4A5A50]">
                  Loading learning materials...
                </div>
              )}

              {!loading && filteredMaterials.length === 0 && (
                <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 text-sm text-[#4A5A50]">
                  No guides match your current search or filters.
                </div>
              )}

              {filteredMaterials.map((mat) => {
                const isActive = activeMaterial?.id === mat.id;
                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => setSelectedMaterialId(mat.id)}
                    className={`w-full text-left rounded-2xl p-4 border transition-colors cursor-pointer space-y-2 ${
                      isActive
                        ? 'bg-[#EDF5EF] border-[#1B4332]'
                        : 'bg-white border-[#E2E6DF] hover:border-[#BFD6C5]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-[#2D6A4F]">
                        {mat.categoryLabel} · {CONTENT_TYPE_LABELS[mat.contentType]} ·{' '}
                        {DIFFICULTY_LABELS[mat.difficulty]}
                      </p>
                      {mat.userProgress.isSaved && (
                        <Bookmark className="w-4 h-4 text-[#1B4332] fill-[#1B4332] shrink-0" />
                      )}
                    </div>
                    <h3 className="font-display text-base font-bold text-[#143326]">
                      {mat.displayTitle}
                    </h3>
                    <p
                      className={`text-[#415047] line-clamp-2 ${
                        largeMode ? 'text-sm leading-relaxed' : 'text-xs'
                      }`}
                    >
                      {mat.displaySummary}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-[#4A5A50] pt-1">
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="w-3 h-3" />
                        {mat.estimatedMinutes} min
                        {mat.videoSlides && mat.videoSlides.length > 0 && ' · Interactive video'}
                      </span>
                      <span
                        className={`font-semibold ${
                          mat.userProgress.status === 'completed'
                            ? 'text-[#1B4332]'
                            : mat.userProgress.status === 'in_progress'
                            ? 'text-[#9B6A16]'
                            : 'text-[#4A5A50]'
                        }`}
                      >
                        {mat.userProgress.status === 'completed'
                          ? 'Completed (100%)'
                          : mat.userProgress.status === 'in_progress'
                          ? `In progress (${mat.userProgress.progressPercent}%)`
                          : 'Not started'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </aside>

            {/* Right Detail Reader */}
            <article className="lg:col-span-7">
              {activeMaterial ? (
                <div className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-5">
                  {/* Top Meta + Actions */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[#2D6A4F]">
                        {activeMaterial.categoryLabel} ·{' '}
                        {CONTENT_TYPE_LABELS[activeMaterial.contentType]} ·{' '}
                        {DIFFICULTY_LABELS[activeMaterial.difficulty]} ·{' '}
                        <span className="font-mono">{activeMaterial.estimatedMinutes} min</span>
                      </p>
                      <h2
                        className={`font-display font-bold text-[#143326] ${
                          largeMode ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                        }`}
                      >
                        {activeMaterial.displayTitle}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <SpeakButton
                        text={`${activeMaterial.displayTitle}. ${activeMaterial.displaySummary}. ${activeMaterial.displayBody}. Practical steps: ${activeMaterial.displaySteps.join('. ')}`}
                        languageCode={activeMaterial.resolvedLanguageCode}
                        isSpeaking={isSpeaking}
                        onSpeak={onSpeak}
                        onStop={onStopSpeaking}
                        supported={speechSupported}
                        label="Listen Guide"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleSave(activeMaterial)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                          activeMaterial.userProgress.isSaved
                            ? 'bg-[#EDF5EF] border-[#1B4332] text-[#143326]'
                            : 'bg-white border-[#D4DDD2] text-[#17201B] hover:bg-[#EDF2EC]'
                        }`}
                      >
                        <Bookmark
                          className={`w-4 h-4 ${
                            activeMaterial.userProgress.isSaved
                              ? 'fill-[#1B4332] text-[#1B4332]'
                              : ''
                          }`}
                        />
                        <span>{activeMaterial.userProgress.isSaved ? 'Saved' : 'Save'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Reviewed Language Resolution Status */}
                  <div className="bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl px-3.5 py-2.5 text-xs text-[#35443B] flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {activeMaterial.isExactLanguageReviewed ? (
                        <>
                          Showing <strong>reviewed {langMeta?.nativeName || languageCode}</strong>{' '}
                          version.
                        </>
                      ) : (
                        <>
                          Reviewed translation in{' '}
                          <strong>{langMeta?.nativeName || languageCode}</strong> is not yet published
                          — showing reviewed <strong>English</strong> reference.
                        </>
                      )}
                    </span>
                    <span className="text-[#4A5A50]">
                      Source: <strong className="text-[#143326]">{activeMaterial.sourceAttribution}</strong>
                    </span>
                  </div>

                  {/* Illustration */}
                  {renderIllustration(activeMaterial)}

                  {/* Educational Video or Interactive Storyboard Player */}
                  {activeMaterial.videoUrl && (
                    <div className="rounded-xl overflow-hidden border border-[#E2E6DF] bg-[#143326]">
                      <video
                        controls
                        src={activeMaterial.videoUrl}
                        className="w-full max-h-72"
                      >
                        Your browser does not support video playback.
                      </video>
                    </div>
                  )}

                  {activeMaterial.videoSlides && activeMaterial.videoSlides.length > 0 && (
                    <section className="bg-[#143326] text-white rounded-2xl p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#B7DEC4]">
                          <Film className="w-4 h-4" />
                          <span>
                            Interactive Video Lesson{' '}
                            {activeMaterial.videoDurationLabel
                              ? `· ${activeMaterial.videoDurationLabel}`
                              : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setVideoPlaying((p) => !p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#143326] text-xs font-semibold cursor-pointer"
                          >
                            {videoPlaying ? (
                              <>
                                <Pause className="w-3.5 h-3.5" />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5" />
                                <span>Play Slides</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSlideIndex(
                                (i) => (i + 1) % activeMaterial.videoSlides!.length
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2D6A4F] text-white text-xs font-semibold cursor-pointer"
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                            <span>Next Slide</span>
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const slide =
                          activeMaterial.videoSlides[activeSlideIndex] ||
                          activeMaterial.videoSlides[0];
                        return (
                          <div className="bg-[#1B4332] rounded-xl p-4 space-y-2 border border-[#2D6A4F]">
                            <p className="text-xs font-mono text-[#B7DEC4]">
                              Slide {activeSlideIndex + 1} of {activeMaterial.videoSlides.length} ·
                              Visual: {slide.visualCue}
                            </p>
                            <h3 className="font-display text-lg font-bold">{slide.heading}</h3>
                            <p className="text-sm text-[#DCE8DF] leading-relaxed">
                              {slide.caption}
                            </p>
                          </div>
                        );
                      })()}

                      <div className="flex flex-wrap gap-1.5">
                        {activeMaterial.videoSlides.map((sl, idx) => (
                          <button
                            key={sl.heading}
                            type="button"
                            onClick={() => setActiveSlideIndex(idx)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer ${
                              idx === activeSlideIndex
                                ? 'bg-white text-[#143326] font-bold'
                                : 'bg-[#1B4332] text-[#DCE8DF]'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Body Text */}
                  <div
                    className={`text-[#17201B] leading-relaxed space-y-3 ${
                      largeMode ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
                    }`}
                  >
                    <p className="font-medium text-[#143326]">{activeMaterial.displaySummary}</p>
                    <p>{activeMaterial.displayBody}</p>
                  </div>

                  {/* Step-by-Step Interactive Checklist */}
                  {activeMaterial.displaySteps.length > 0 && (
                    <section className="pt-4 border-t border-[#E2E6DF] space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-base font-bold text-[#143326]">
                          Practical Step-by-Step Checklist
                        </h3>
                        <span className="font-mono text-xs font-semibold tabular-nums text-[#2D6A4F]">
                          {activeMaterial.userProgress.progressPercent}% Complete
                        </span>
                      </div>

                      <div className="space-y-2">
                        {activeMaterial.displaySteps.map((step, idx) => {
                          const done = activeMaterial.userProgress.completedSteps.includes(idx);
                          return (
                            <button
                              key={`${activeMaterial.id}-step-${idx}`}
                              type="button"
                              onClick={() => handleToggleStep(activeMaterial, idx)}
                              className={`w-full text-left p-3.5 rounded-xl border flex items-start gap-3 transition-colors cursor-pointer ${
                                done
                                  ? 'bg-[#EDF5EF] border-[#1B4332] text-[#143326]'
                                  : 'bg-[#F6F7F4] border-[#E2E6DF] text-[#17201B] hover:border-[#BFD6C5]'
                              } ${largeMode ? 'text-base' : 'text-sm'}`}
                            >
                              <CheckCircle2
                                className={`w-5 h-5 shrink-0 mt-0.5 ${
                                  done ? 'text-[#1B4332]' : 'text-[#9AA89F]'
                                }`}
                              />
                              <span>
                                <strong className="font-mono mr-1.5">{idx + 1}.</strong>
                                <span className={done ? 'font-semibold' : ''}>{step}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Footer Actions & Completion */}
                  <div className="pt-4 border-t border-[#E2E6DF] flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[#4A5A50]">
                      Reviewed translations available:{' '}
                      <span className="font-mono font-semibold text-[#143326]">
                        {activeMaterial.availableReviewedLanguages.map((c) => c.toUpperCase()).join(' · ') ||
                          'EN'}
                      </span>
                    </p>

                    <div className="flex items-center gap-2">
                      {activeMaterial.userProgress.status === 'completed' ? (
                        <button
                          type="button"
                          onClick={() => handleMarkStatus(activeMaterial, 'not_started')}
                          className="px-4 py-2 rounded-xl border border-[#D4DDD2] bg-white text-xs font-semibold text-[#35443B] hover:bg-[#F6F7F4] cursor-pointer"
                        >
                          Reset Progress
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkStatus(activeMaterial, 'completed')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-xs font-semibold text-white cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Mark Lesson Complete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-[#E2E6DF] rounded-2xl p-8 text-center text-sm text-[#4A5A50]">
                  Select a guide or video lesson from the list to begin learning.
                </div>
              )}
            </article>
          </div>
        </>
      )}
    </div>
  );
};
