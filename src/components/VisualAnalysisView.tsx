import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Film,
  Image as ImageIcon,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { isLikelyOfflineError } from '../lib/offlineSync';
import {
  CropItem,
  FarmItem,
  IncidentType,
  LanguageCode,
  LivestockGroupItem,
  VisualAnalysisCategory,
  VisualAnalysisItem,
} from '../types';
import { SpeakButton, VoiceInputButton } from './AccessibilityControls';

interface VisualAnalysisViewProps {
  farms: FarmItem[];
  selectedFarmId: string | null;
  onSelectFarm: (farmId: string) => void;
  languageCode: LanguageCode;
  isSpeaking: boolean;
  isListening: boolean;
  speechSupported: boolean;
  recognitionSupported: boolean;
  onSpeak: (text: string) => void;
  onStopSpeaking: () => void;
  onStartVoiceInput: (onResult: (transcript: string) => void) => void;
  onDataChanged: () => void;
  onOpenIncidentsView: () => void;
}

const ANALYSIS_CATEGORIES: { value: VisualAnalysisCategory; label: string; hint: string }[] = [
  { value: 'crop_condition', label: 'Crop condition', hint: 'Vigour, canopy, leaf colour, flowering or stress' },
  { value: 'plant_disease', label: 'Possible plant diseases', hint: 'Spots, rust, blight, mildew, wilting' },
  { value: 'pest_damage', label: 'Pest damage', hint: 'Chewed leaves, stalk borers, aphids, caterpillars' },
  { value: 'soil_field_condition', label: 'Soil and field condition', hint: 'Crusting, erosion, compaction, cover' },
  { value: 'flooding', label: 'Flooding', hint: 'Standing floodwater or washout lines' },
  { value: 'waterlogging', label: 'Waterlogging', hint: 'Saturated root zones and yellowing from poor drainage' },
  { value: 'livestock_appearance', label: 'Livestock appearance', hint: 'Body condition, coat, posture, udder/hoof visible checks' },
  { value: 'animal_health', label: 'Possible animal health concerns', hint: 'Wounds, ticks, discharge, lameness, lethargy' },
  { value: 'equipment_damage', label: 'Equipment damage', hint: 'Tractor, sprayer, irrigation pump or implement wear' },
  { value: 'infrastructure_damage', label: 'Infrastructure damage', hint: 'Fencing, boreholes, sheds, dam walls, shade nets' },
];

async function compressImageFileToBase64(file: File, maxWidth = 1200): Promise<{ mimeType: string; dataBase64: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file format.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas compression unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const previewUrl = canvas.toDataURL('image/jpeg', 0.84);
        const dataBase64 = previewUrl.replace(/^data:image\/jpeg;base64,/, '');
        resolve({ mimeType: 'image/jpeg', dataBase64, previewUrl });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function captureVideoFrameToJpeg(videoEl: HTMLVideoElement, maxWidth = 1024): { mimeType: string; dataBase64: string; previewUrl: string } | null {
  if (!videoEl.videoWidth || !videoEl.videoHeight) return null;
  const scale = Math.min(1, maxWidth / videoEl.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(videoEl.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(videoEl.videoHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  const previewUrl = canvas.toDataURL('image/jpeg', 0.82);
  return {
    mimeType: 'image/jpeg',
    dataBase64: previewUrl.replace(/^data:image\/jpeg;base64,/, ''),
    previewUrl,
  };
}

export const VisualAnalysisView: React.FC<VisualAnalysisViewProps> = ({
  farms,
  selectedFarmId,
  onSelectFarm,
  languageCode,
  isSpeaking,
  isListening,
  speechSupported,
  recognitionSupported,
  onSpeak,
  onStopSpeaking,
  onStartVoiceInput,
  onDataChanged,
  onOpenIncidentsView,
}) => {
  const activeFarmId = selectedFarmId || farms[0]?.id || '';
  const activeFarm = useMemo(
    () => farms.find((f) => f.id === activeFarmId) || null,
    [farms, activeFarmId]
  );

  const [crops, setCrops] = useState<CropItem[]>([]);
  const [livestock, setLivestock] = useState<LivestockGroupItem[]>([]);
  const [history, setHistory] = useState<VisualAnalysisItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Submission Form State
  const [targetType, setTargetType] = useState<'field_crop' | 'livestock' | 'farm_general'>('field_crop');
  const [fieldId, setFieldId] = useState<string>('');
  const [cropId, setCropId] = useState<string>('');
  const [livestockGroupId, setLivestockGroupId] = useState<string>('');
  const [category, setCategory] = useState<VisualAnalysisCategory>('crop_condition');
  const [userQuestion, setUserQuestion] = useState('');

  // Media State
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [mediaFileName, setMediaFileName] = useState<string>('');
  const [mediaMimeType, setMediaMimeType] = useState<string>('image/jpeg');
  const [frames, setFrames] = useState<{ mimeType: string; dataBase64: string; previewUrl: string; label: string }[]>([]);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Live Camera Modal
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Convert-to-incident modal state
  const [incidentModalItem, setIncidentModalItem] = useState<VisualAnalysisItem | null>(null);
  const [incType, setIncType] = useState<IncidentType>('crop_disease');
  const [incTitle, setIncTitle] = useState('');
  const [incAffectedQty, setIncAffectedQty] = useState('0');
  const [incAffectedUnit, setIncAffectedUnit] = useState('plants');
  const [incAffectedAreaHa, setIncAffectedAreaHa] = useState('0');
  const [incImpactZar, setIncImpactZar] = useState('0');
  const [savingActionId, setSavingActionId] = useState<string | null>(null);

  const selectedRecordIdRef = useRef<string | null>(null);
  selectedRecordIdRef.current = selectedRecordId;

  const loadFarmTargetsAndHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const qs = activeFarmId ? `?farmId=${encodeURIComponent(activeFarmId)}` : '';
      const [cropsRes, livestockRes, historyRes] = await Promise.all([
        apiRequest<CropItem[]>(`/api/crops${qs}`),
        apiRequest<LivestockGroupItem[]>(`/api/livestock${qs}`),
        apiRequest<VisualAnalysisItem[]>(`/api/visual-analysis${qs}`),
      ]);
      setCrops(cropsRes);
      setLivestock(livestockRes);
      setHistory(historyRes);
      if (historyRes.length > 0 && (!selectedRecordIdRef.current || !historyRes.some((h) => h.id === selectedRecordIdRef.current))) {
        setSelectedRecordId(historyRes[0].id);
      }
    } catch (err: unknown) {
      if (isLikelyOfflineError(err)) {
        setError(
          'Online connection required: live AI photo/video inspection requires internet connectivity. While offline, capture farm incidents in Incident & Damage Log or Offline Sync.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Unable to load visual analysis records.');
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [activeFarmId]);

  useEffect(() => {
    loadFarmTargetsAndHistory();
  }, [loadFarmTargetsAndHistory]);

  // Attach camera stream reliably once modal mounts
  useEffect(() => {
    if (cameraOpen && cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [cameraOpen]);

  // Cleanup camera stream and video URLs on unmount
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((tr) => tr.stop());
      }
      if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
    };
  }, [videoObjectUrl]);

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((tr) => tr.stop());
      cameraStreamRef.current = null;
    }
    setCameraOpen(false);
    setCameraError(null);
  };

  const handleOpenCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Live camera access is unavailable in this browser. Please use the Photo Upload button below.');
      setCameraOpen(true);
      return;
    }
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError('Camera permission denied or no camera detected. You can still upload any photo file.');
    }
  };

  const handleSnapCameraPhoto = () => {
    const vid = cameraVideoRef.current;
    if (!vid) return;
    const snapped = captureVideoFrameToJpeg(vid, 1200);
    if (!snapped) {
      setCameraError('Camera stream not ready yet.');
      return;
    }
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
      setVideoObjectUrl(null);
    }
    setMediaType('image');
    setMediaFileName(`camera-capture-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.jpg`);
    setMediaMimeType('image/jpeg');
    setFrames([{ ...snapped, label: 'Camera capture' }]);
    stopCamera();
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
      setVideoObjectUrl(null);
    }
    try {
      const compressed = await compressImageFileToBase64(file, 1200);
      setMediaType('image');
      setMediaFileName(file.name);
      setMediaMimeType('image/jpeg');
      setFrames([{ ...compressed, label: file.name }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to process image.');
    }
    e.target.value = '';
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
    const objUrl = URL.createObjectURL(file);
    setVideoObjectUrl(objUrl);
    setMediaType('video');
    setMediaFileName(file.name);
    setMediaMimeType(file.type || 'video/mp4');
    setFrames([]);
    e.target.value = '';
  };

  const handleCaptureVideoFrame = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (frames.length >= 4) {
      setError('Maximum 4 selected video frames per analysis. Remove one frame to capture another.');
      return;
    }
    const snapped = captureVideoFrameToJpeg(vid, 1024);
    if (!snapped) {
      setError('Wait for the video to finish loading metadata before capturing a frame.');
      return;
    }
    const timestampSec = vid.currentTime.toFixed(1);
    setFrames((prev) => [...prev, { ...snapped, label: `Frame @ ${timestampSec}s` }]);
  };

  const [extractingFrames, setExtractingFrames] = useState(false);

  const handleAutoExtractKeyFrames = async () => {
    const vid = videoRef.current;
    if (!vid || !Number.isFinite(vid.duration) || vid.duration <= 0) {
      setError('Wait for video duration to load before extracting frames.');
      return;
    }
    setExtractingFrames(true);
    setError(null);
    const originalTime = vid.currentTime;
    const targetFractions = [0.15, 0.5, 0.85];
    const extracted: { mimeType: string; dataBase64: string; previewUrl: string; label: string }[] = [];

    try {
      for (const frac of targetFractions) {
        const targetSec = Math.min(Math.max(0.1, vid.duration * frac), Math.max(0.1, vid.duration - 0.1));
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            vid.removeEventListener('seeked', onSeeked);
            resolve();
          };
          vid.addEventListener('seeked', onSeeked, { once: true });
          vid.currentTime = targetSec;
          setTimeout(() => {
            vid.removeEventListener('seeked', onSeeked);
            resolve();
          }, 900);
        });
        const snapped = captureVideoFrameToJpeg(vid, 1024);
        if (snapped) {
          extracted.push({ ...snapped, label: `Key frame @ ${targetSec.toFixed(1)}s` });
        }
      }
      if (extracted.length > 0) {
        setFrames(extracted);
      }
    } finally {
      vid.currentTime = originalTime;
      setExtractingFrames(false);
    }
  };

  const handleSubmitAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarmId) {
      setError('Please select a registered farm first.');
      return;
    }
    if (frames.length === 0) {
      setError(
        mediaType === 'video'
          ? 'Please play or scrub your video and click "Capture Video Frame" on at least 1 key frame.'
          : 'Please take or upload a photograph to analyse.'
      );
      return;
    }

    setAnalyzing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const created = await apiRequest<VisualAnalysisItem>('/api/visual-analysis', {
        method: 'POST',
        body: JSON.stringify({
          farmId: activeFarmId,
          fieldId: targetType === 'field_crop' ? fieldId || null : null,
          cropId: targetType === 'field_crop' ? cropId || null : null,
          livestockGroupId: targetType === 'livestock' ? livestockGroupId || null : null,
          category,
          mediaType,
          mediaFileName,
          mediaMimeType,
          frames: frames.map((f) => ({ mimeType: f.mimeType, dataBase64: f.dataBase64 })),
          mediaPreviewDataUrl: frames[0].previewUrl,
          userQuestion,
          languageCode,
        }),
      });
      setHistory((prev) => [created, ...prev]);
      setSelectedRecordId(created.id);
      setSuccessMsg('Visual agricultural assessment completed and saved to your farm history.');
      setUserQuestion('');
      onDataChanged();
    } catch (err: unknown) {
      if (isLikelyOfflineError(err)) {
        setError(
          'Live AI photo/video analysis requires an active internet connection. If this is an urgent field issue, capture it offline in Incident & Damage Management.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Visual analysis failed.');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveAsFarmRecord = async (item: VisualAnalysisItem) => {
    setSavingActionId(item.id);
    setError(null);
    try {
      const updated = await apiRequest<VisualAnalysisItem>(
        `/api/visual-analysis/${item.id}/save-farm-record`,
        { method: 'POST' }
      );
      setHistory((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setSuccessMsg(updated.linkedRecordNote || 'Saved to farm record.');
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save farm record.');
    } finally {
      setSavingActionId(null);
    }
  };

  const openConvertToIncidentModal = (item: VisualAnalysisItem) => {
    const mapCat: Record<VisualAnalysisCategory, IncidentType> = {
      crop_condition: 'crop_disease',
      plant_disease: 'crop_disease',
      pest_damage: 'pest_outbreak',
      soil_field_condition: 'heavy_rainfall',
      flooding: 'flooding',
      waterlogging: 'flooding',
      livestock_appearance: 'livestock_illness',
      animal_health: 'livestock_illness',
      equipment_damage: 'equipment_damage',
      infrastructure_damage: 'infrastructure_damage',
    };
    setIncidentModalItem(item);
    setIncType(mapCat[item.category]);
    setIncTitle(`Visual Inspection: ${item.possibleFindings[0] || item.category}`.slice(0, 120));
    setIncAffectedQty('0');
    setIncAffectedUnit(item.cropId ? 'plants' : item.livestockGroupId ? 'head' : 'units');
    setIncAffectedAreaHa('0');
    setIncImpactZar('0');
  };

  const handleConfirmConvertToIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentModalItem) return;
    setSavingActionId(incidentModalItem.id);
    setError(null);
    try {
      const res = await apiRequest<{ analysis: VisualAnalysisItem }>(
        `/api/visual-analysis/${incidentModalItem.id}/convert-to-incident`,
        {
          method: 'POST',
          body: JSON.stringify({
            incidentType: incType,
            title: incTitle,
            affectedQuantity: Number(incAffectedQty) || 0,
            affectedUnit: incAffectedUnit,
            affectedAreaHectares: Number(incAffectedAreaHa) || 0,
            estimatedFinancialImpactZar: Number(incImpactZar) || 0,
          }),
        }
      );
      setHistory((prev) => prev.map((x) => (x.id === res.analysis.id ? res.analysis : x)));
      setIncidentModalItem(null);
      setSuccessMsg('Incident created and linked to Stock & Incident Management.');
      onDataChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create farm incident.');
    } finally {
      setSavingActionId(null);
    }
  };

  const handleDeleteAnalysis = async (id: string) => {
    try {
      await apiRequest(`/api/visual-analysis/${id}`, { method: 'DELETE' });
      setHistory((prev) => prev.filter((x) => x.id !== id));
      if (selectedRecordId === id) setSelectedRecordId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to remove record.');
    }
  };

  const activeResult = useMemo(
    () => history.find((h) => h.id === selectedRecordId) || history[0] || null,
    [history, selectedRecordId]
  );

  if (farms.length === 0) {
    return (
      <div className="bg-white border border-[#E2E6DF] rounded-2xl p-8 text-center space-y-2">
        <Camera className="w-8 h-8 text-[#1B4332] mx-auto" />
        <h2 className="font-display text-xl font-bold text-[#143326]">
          Register a Farm Before Visual Inspection
        </h2>
        <p className="text-sm text-[#4A5A50]">
          Visual agricultural analyses are securely linked to your registered farms, fields, and livestock groups.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#143326]">
            Visual Agricultural Analysis
          </h1>
          <p className="text-sm text-[#4A5A50]">
            Capture or upload field, crop, livestock, equipment, or flood photographs and video frames for AI inspection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#4A5A50]">Farm:</label>
          <select
            value={activeFarmId}
            onChange={(e) => onSelectFarm(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm font-semibold text-[#143326]"
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Prominent Clinical / Agronomic Safety Banner */}
      <div className="bg-[#FDF8EE] border border-[#E5D3A3] rounded-2xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-[#8A5A00] shrink-0 mt-0.5" />
        <div className="text-sm text-[#4E3500] space-y-1">
          <p className="font-bold text-[#3D2800]">
            Preliminary Decision Support Only — Not a Confirmed Medical, Veterinary, or Laboratory Diagnosis
          </p>
          <p className="text-xs leading-relaxed">
            AI visual observations highlight possible causes based on image appearance alone. Field Shift never recommends hazardous or restricted chemicals. Contact a registered South African veterinarian, agricultural extension officer, or certified agronomist for serious livestock illness, spreading crop disease, or chemical treatment advice.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-[#FDF2F2] border border-[#E8B4B4] rounded-xl px-4 py-3 text-sm text-[#8E2424] flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl px-4 py-3 text-sm text-[#143326] flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#1B4332]" />
            {successMsg}
          </span>
          <button
            type="button"
            onClick={onOpenIncidentsView}
            className="text-xs font-semibold text-[#1B4332] underline cursor-pointer"
          >
            Open Incident Dashboard
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Capture & Submission Workflow */}
        <form
          onSubmit={handleSubmitAnalysis}
          className="lg:col-span-5 bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-5"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-[#E2E6DF]">
            <Sparkles className="w-5 h-5 text-[#1B4332]" />
            <h2 className="font-display text-lg font-bold text-[#143326]">
              New Visual Inspection
            </h2>
          </div>

          {/* Target Field / Crop / Livestock Selection */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#4A5A50]">
              1. Select Field or Livestock Group
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'field_crop' as const, label: 'Field / Crop' },
                { id: 'livestock' as const, label: 'Livestock' },
                { id: 'farm_general' as const, label: 'Farm / Infra' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTargetType(opt.id)}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                    targetType === opt.id
                      ? 'bg-[#1B4332] text-white border-[#1B4332]'
                      : 'bg-[#F6F7F4] text-[#17201B] border-[#D4DDD2] hover:border-[#1B4332]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {targetType === 'field_crop' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Field</label>
                  <select
                    value={fieldId}
                    onChange={(e) => setFieldId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                  >
                    <option value="">All / General Fields</option>
                    {(activeFarm?.fields || []).map((fl) => (
                      <option key={fl.id} value={fl.id}>
                        {fl.name} ({fl.areaHectares} ha)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Crop</label>
                  <select
                    value={cropId}
                    onChange={(e) => setCropId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                  >
                    <option value="">Optional crop link</option>
                    {crops.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.cropName} ({c.cropVariety})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {targetType === 'livestock' && (
              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                  Livestock Group / Herd
                </label>
                <select
                  value={livestockGroupId}
                  onChange={(e) => setLivestockGroupId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                >
                  <option value="">Select herd or flock...</option>
                  {livestock.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.groupName} ({g.animalType} · {g.quantity} head)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4A5A50]">
              2. Analysis Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as VisualAnalysisCategory)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm font-semibold text-[#143326]"
            >
              {ANALYSIS_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#4A5A50]">
              {ANALYSIS_CATEGORIES.find((c) => c.value === category)?.hint}
            </p>
          </div>

          {/* Photo or Video Capture */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#4A5A50]">
              3. Capture or Upload Photograph / Video
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleOpenCamera}
                className="min-h-[44px] px-3 py-2 rounded-xl border border-[#1B4332] bg-[#EDF5EF] text-[#143326] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#DCEBDF] cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Take Photo</span>
              </button>

              <label className="min-h-[44px] px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-[#17201B] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#F6F7F4] cursor-pointer">
                <Upload className="w-4 h-4 text-[#1B4332]" />
                <span>Upload Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />
              </label>

              <label className="min-h-[44px] px-3 py-2 rounded-xl border border-[#D4DDD2] bg-white text-[#17201B] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#F6F7F4] cursor-pointer">
                <Film className="w-4 h-4 text-[#1B4332]" />
                <span>Upload Video</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Video Player + Frame Extractor */}
            {videoObjectUrl && (
              <div className="bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-[#143326] font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-[#1B4332]" />
                    Video Frame Selector ({mediaFileName})
                  </span>
                  <span className="font-mono">{frames.length}/4 frames</span>
                </div>
                <video
                  ref={videoRef}
                  src={videoObjectUrl}
                  controls
                  onLoadedData={() => {
                    if (frames.length === 0 && videoRef.current) {
                      const snapped = captureVideoFrameToJpeg(videoRef.current, 1024);
                      if (snapped) {
                        setFrames([{ ...snapped, label: 'Initial frame (0.0s)' }]);
                      }
                    }
                  }}
                  className="w-full max-h-56 rounded-lg bg-black object-contain"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureVideoFrame}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#2D6A4F] cursor-pointer"
                  >
                    Capture Frame at Current Position
                  </button>
                  <button
                    type="button"
                    disabled={extractingFrames}
                    onClick={handleAutoExtractKeyFrames}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#1B4332] bg-white text-[#143326] text-xs font-semibold hover:bg-[#EDF5EF] disabled:opacity-50 cursor-pointer"
                  >
                    {extractingFrames ? 'Extracting Key Frames...' : 'Auto-Extract 3 Key Frames'}
                  </button>
                </div>
              </div>
            )}

            {/* Selected Frames Preview */}
            {frames.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5">
                {frames.map((fr, idx) => (
                  <div
                    key={idx}
                    className="relative border border-[#D4DDD2] rounded-xl overflow-hidden bg-[#F6F7F4]"
                  >
                    <img
                      src={fr.previewUrl}
                      alt={fr.label}
                      className="w-full h-28 object-cover"
                    />
                    <div className="px-2 py-1 flex items-center justify-between text-[11px] text-[#35443B] bg-white border-t border-[#E2E6DF]">
                      <span className="truncate font-mono">{fr.label}</span>
                      <button
                        type="button"
                        onClick={() => setFrames((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-[#8E2424] font-semibold cursor-pointer"
                        title="Remove frame"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optional Farmer Question */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#4A5A50]">
                4. Optional Question
              </label>
              <VoiceInputButton
                languageCode={languageCode}
                isListening={isListening}
                supported={recognitionSupported}
                onStart={() =>
                  onStartVoiceInput((txt) =>
                    setUserQuestion((prev) => (prev ? `${prev} ${txt}` : txt))
                  )
                }
              />
            </div>
            <textarea
              rows={2}
              value={userQuestion}
              onChange={(e) => setUserQuestion(e.target.value)}
              placeholder="E.g. Are these leaf spots nutrient stress or fungal damage? Should I inspect nearby rows?"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={analyzing || frames.length === 0}
            className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-[#143326] text-white font-semibold text-sm hover:bg-[#1B4332] disabled:opacity-50 cursor-pointer"
          >
            {analyzing ? 'Analysing Visual Media with Gemini AI...' : 'Submit for Visual Agricultural Analysis'}
          </button>
        </form>

        {/* Right: Results & Analysis History */}
        <div className="lg:col-span-7 space-y-5">
          {activeResult ? (
            <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#E2E6DF]">
                <div>
                  <p className="text-xs font-mono text-[#4A5A50]">
                    Analysed {new Date(activeResult.analyzedAt).toLocaleString()} ·{' '}
                    {activeResult.mediaType === 'video'
                      ? `Video (${activeResult.analyzedFramesCount} frame${activeResult.analyzedFramesCount === 1 ? '' : 's'})`
                      : 'Photograph'}
                  </p>
                  <h2 className="font-display text-xl font-bold text-[#143326] mt-0.5">
                    {ANALYSIS_CATEGORIES.find((c) => c.value === activeResult.category)?.label ||
                      activeResult.category}
                  </h2>
                  <p className="text-xs text-[#4A5A50] mt-0.5">
                    Farm: <span className="font-semibold text-[#143326]">{activeResult.farmName}</span>
                    {activeResult.fieldName ? ` · Field: ${activeResult.fieldName}` : ''}
                    {activeResult.cropName ? ` · Crop: ${activeResult.cropName}` : ''}
                    {activeResult.livestockGroupName
                      ? ` · Herd: ${activeResult.livestockGroupName}`
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <SpeakButton
                    text={`Visual analysis for ${activeResult.farmName}. Possible findings: ${activeResult.possibleFindings.join('. ')}. Possible causes: ${activeResult.possibleCauses.join('. ')}. Explanation: ${activeResult.explanation}. Confidence: ${activeResult.confidenceLevel}. ${activeResult.uncertaintyNote}. Recommended next steps: ${activeResult.recommendedActions.join('. ')}. Note: ${activeResult.safetyDisclaimer}`}
                    languageCode={languageCode}
                    isSpeaking={isSpeaking}
                    onSpeak={onSpeak}
                    onStop={onStopSpeaking}
                    supported={speechSupported}
                  />
                </div>
              </div>

              {/* Media Preview + Confidence */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                <div className="sm:col-span-5">
                  {activeResult.mediaPreviewDataUrl ? (
                    <img
                      src={activeResult.mediaPreviewDataUrl}
                      alt={activeResult.mediaFileName}
                      className="w-full h-48 object-cover rounded-xl border border-[#E2E6DF]"
                    />
                  ) : (
                    <div className="w-full h-48 rounded-xl border border-[#E2E6DF] bg-[#F6F7F4] flex items-center justify-center text-xs text-[#4A5A50]">
                      <ImageIcon className="w-5 h-5 mr-1.5" />
                      {activeResult.mediaFileName}
                    </div>
                  )}
                  <p className="text-[11px] font-mono text-[#4A5A50] mt-1.5 truncate">
                    File: {activeResult.mediaFileName}
                  </p>
                </div>

                <div className="sm:col-span-7 space-y-3">
                  <div className="bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-3.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#4A5A50]">Visual Confidence</span>
                      <span className="font-mono font-bold text-[#143326]">
                        {activeResult.confidenceLevel}
                      </span>
                    </div>
                    <p className="text-xs text-[#35443B] mt-1.5 leading-relaxed">
                      {activeResult.uncertaintyNote}
                    </p>
                  </div>

                  {activeResult.userQuestion && (
                    <div className="text-xs text-[#35443B] bg-white border border-[#E2E6DF] rounded-xl p-3">
                      <span className="font-semibold text-[#143326]">Question: </span>
                      {activeResult.userQuestion}
                    </div>
                  )}
                </div>
              </div>

              {/* Findings & Causes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#143326]">
                    Possible Visual Findings
                  </h3>
                  <ul className="space-y-1.5 text-sm text-[#17201B]">
                    {activeResult.possibleFindings.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-mono text-xs text-[#2D6A4F] mt-0.5">{i + 1}.</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#F6F7F4] border border-[#E2E6DF] rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#143326]">
                    Possible Causes
                  </h3>
                  <ul className="space-y-1.5 text-sm text-[#17201B]">
                    {activeResult.possibleCauses.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-mono text-xs text-[#2D6A4F] mt-0.5">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Detailed Explanation */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#143326]">
                  Explanation
                </h3>
                <p className="text-sm text-[#17201B] leading-relaxed">{activeResult.explanation}</p>
              </div>

              {/* Recommended Actions */}
              <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#143326]">
                  Recommended Next Steps
                </h3>
                <ul className="space-y-1.5 text-sm text-[#143326]">
                  {activeResult.recommendedActions.map((act, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Safety Notice */}
              <div className="text-xs text-[#6B4A00] bg-[#FDF8EE] border border-[#E5D3A3] rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{activeResult.safetyDisclaimer}</span>
              </div>

              {/* Convert to Incident or Save as Farm Record */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E2E6DF]">
                <div className="flex flex-wrap gap-2.5">
                  {activeResult.linkedIncidentId ? (
                    <button
                      type="button"
                      onClick={onOpenIncidentsView}
                      className="min-h-[42px] px-4 py-2 rounded-xl border border-[#1B4332] bg-[#EDF5EF] text-[#143326] text-xs font-semibold cursor-pointer"
                    >
                      Linked to Farm Incident (View Dashboard)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openConvertToIncidentModal(activeResult)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#8E2424] text-white text-xs font-semibold hover:bg-[#731C1C] flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileWarning className="w-4 h-4" />
                      <span>Save as Farm Incident</span>
                    </button>
                  )}

                  {activeResult.linkedRecordNote ? (
                    <span className="min-h-[42px] px-3.5 py-2 rounded-xl border border-[#D4DDD2] bg-[#F6F7F4] text-xs font-semibold text-[#1B4332] inline-flex items-center gap-1.5">
                      <ClipboardCheck className="w-4 h-4" />
                      {activeResult.linkedRecordNote}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={savingActionId === activeResult.id}
                      onClick={() => handleSaveAsFarmRecord(activeResult)}
                      className="min-h-[42px] px-4 py-2 rounded-xl border border-[#D4DDD2] bg-white hover:bg-[#EDF2EC] text-[#143326] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span>Save as Farm Record</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteAnalysis(activeResult.id)}
                  className="text-xs text-[#8E2424] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>
            </section>
          ) : (
            <div className="bg-white border border-[#E2E6DF] rounded-2xl p-8 text-center space-y-2">
              <Camera className="w-8 h-8 text-[#2D6A4F] mx-auto" />
              <p className="font-display font-bold text-[#143326]">
                {loadingHistory ? 'Loading inspection history...' : 'No visual inspections recorded yet'}
              </p>
              <p className="text-sm text-[#4A5A50]">
                Upload or capture a photograph or video frame on the left to inspect crops, soil, livestock, or equipment.
              </p>
            </div>
          )}

          {/* Secure Inspection History List */}
          {history.length > 0 && (
            <section className="bg-white border border-[#E2E6DF] rounded-2xl p-5 space-y-3">
              <h3 className="font-display text-base font-bold text-[#143326]">
                Saved Visual Analysis History ({history.length})
              </h3>
              <div className="divide-y divide-[#E2E6DF]">
                {history.map((item) => {
                  const isSelected = activeResult?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedRecordId(item.id)}
                      className={`w-full text-left py-3 px-3 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#EDF5EF]' : 'hover:bg-[#F6F7F4]'
                      }`}
                    >
                      {item.mediaPreviewDataUrl ? (
                        <img
                          src={item.mediaPreviewDataUrl}
                          alt={item.mediaFileName}
                          className="w-14 h-14 rounded-lg object-cover border border-[#E2E6DF] shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg border border-[#E2E6DF] bg-[#F6F7F4] flex items-center justify-center shrink-0">
                          <ImageIcon className="w-5 h-5 text-[#4A5A50]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-[#143326] truncate">
                            {ANALYSIS_CATEGORIES.find((c) => c.value === item.category)?.label ||
                              item.category}
                          </p>
                          <span className="text-xs font-mono tabular-nums text-[#4A5A50] shrink-0">
                            {new Date(item.analyzedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-[#35443B] truncate mt-0.5">
                          {item.possibleFindings[0] || item.explanation}
                        </p>
                        <p className="text-[11px] text-[#4A5A50] mt-0.5 font-mono">
                          {item.farmName} · Confidence: {item.confidenceLevel}
                          {item.linkedIncidentId ? ' · Incident Linked' : ''}
                          {item.linkedRecordNote ? ' · Saved to Record' : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Live Camera Modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E6DF] rounded-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#143326]">
                Capture Field or Livestock Photo
              </h3>
              <button type="button" onClick={stopCamera} className="p-1.5 text-[#4A5A50] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            {cameraError ? (
              <div className="bg-[#FDF2F2] border border-[#E8B4B4] rounded-xl p-3 text-sm text-[#8E2424]">
                {cameraError}
              </div>
            ) : (
              <video
                ref={cameraVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-72 rounded-xl bg-black object-cover"
              />
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={stopCamera}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#D4DDD2] text-sm font-semibold"
              >
                Cancel
              </button>
              {!cameraError && (
                <button
                  type="button"
                  onClick={handleSnapCameraPhoto}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-[#1B4332] text-white text-sm font-semibold cursor-pointer"
                >
                  Snap Photograph
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save as Farm Incident Modal */}
      {incidentModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmConvertToIncident}
            className="bg-white border border-[#E2E6DF] rounded-2xl max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#143326]">
                Save Visual Inspection as Farm Incident
              </h3>
              <button
                type="button"
                onClick={() => setIncidentModalItem(null)}
                className="text-[#4A5A50] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#4A5A50]">
              If this issue damaged plants or livestock, enter the affected quantity below so crop/livestock remaining stock updates automatically while preserving original counts.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Incident Type</label>
                <select
                  value={incType}
                  onChange={(e) => setIncType(e.target.value as IncidentType)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
                >
                  <option value="crop_disease">Crop disease</option>
                  <option value="pest_outbreak">Pest outbreak</option>
                  <option value="flooding">Flooding</option>
                  <option value="heavy_rainfall">Heavy rainfall</option>
                  <option value="storm_damage">Storm damage</option>
                  <option value="drought">Drought</option>
                  <option value="livestock_illness">Livestock illness</option>
                  <option value="livestock_death">Livestock death</option>
                  <option value="equipment_damage">Equipment damage</option>
                  <option value="infrastructure_damage">Infrastructure damage</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Incident Title</label>
                <input
                  type="text"
                  required
                  value={incTitle}
                  onChange={(e) => setIncTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                    Affected Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={incAffectedQty}
                    onChange={(e) => setIncAffectedQty(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">Unit</label>
                  <input
                    type="text"
                    value={incAffectedUnit}
                    onChange={(e) => setIncAffectedUnit(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm"
                  />
                </div>
              </div>
              {incidentModalItem.cropId && (() => {
                const linkedCrop = crops.find((c) => c.id === incidentModalItem.cropId);
                if (!linkedCrop) return null;
                const beforeRem = Math.max(0, linkedCrop.plantingQuantity - linkedCrop.damagedPlants);
                const applied = Math.min(beforeRem, Math.max(0, Number(incAffectedQty) || 0));
                return (
                  <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl p-3 text-xs text-[#143326]">
                    <p className="font-bold">Stock Impact Preview ({linkedCrop.cropName})</p>
                    <p className="font-mono tabular-nums mt-0.5">
                      Original: {linkedCrop.plantingQuantity.toLocaleString()} · New Damage: {applied.toLocaleString()} · Remaining After: {Math.max(0, beforeRem - applied).toLocaleString()}
                    </p>
                  </div>
                );
              })()}
              {incidentModalItem.livestockGroupId && (() => {
                const linkedGrp = livestock.find((g) => g.id === incidentModalItem.livestockGroupId);
                if (!linkedGrp) return null;
                const appliedLoss = incType === 'livestock_death'
                  ? Math.min(linkedGrp.quantity, Math.max(0, Math.round(Number(incAffectedQty) || 0)))
                  : 0;
                return (
                  <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl p-3 text-xs text-[#143326]">
                    <p className="font-bold">Livestock Stock Preview ({linkedGrp.groupName})</p>
                    <p className="font-mono tabular-nums mt-0.5">
                      Current Head: {linkedGrp.quantity} · Loss: {appliedLoss} · Remaining After: {Math.max(0, linkedGrp.quantity - appliedLoss)}
                    </p>
                  </div>
                );
              })()}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                    Affected Area (ha)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={incAffectedAreaHa}
                    onChange={(e) => setIncAffectedAreaHa(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A5A50] mb-1">
                    Est. Financial Impact (ZAR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={incImpactZar}
                    onChange={(e) => setIncImpactZar(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D4DDD2] text-sm font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIncidentModalItem(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#D4DDD2] text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingActionId === incidentModalItem.id}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#8E2424] text-white text-sm font-semibold cursor-pointer"
              >
                Record Farm Incident
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
