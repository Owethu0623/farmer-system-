import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { store } from './store.ts';
import {
  LanguageCode,
  SanitizedUser,
  VisualAnalysisCategory,
  VisualAnalysisRecord,
} from './types.ts';

const CATEGORY_LABELS: Record<VisualAnalysisCategory, string> = {
  crop_condition: 'Crop condition',
  plant_disease: 'Possible plant diseases',
  pest_damage: 'Pest damage',
  soil_field_condition: 'Soil and field condition',
  flooding: 'Flooding',
  waterlogging: 'Waterlogging',
  livestock_appearance: 'Livestock appearance',
  animal_health: 'Possible animal health concerns',
  equipment_damage: 'Equipment damage',
  infrastructure_damage: 'Infrastructure damage',
};

const SAFETY_DISCLAIMER =
  'Preliminary visual assessment only — not a confirmed medical, veterinary, or laboratory agricultural diagnosis. Never apply restricted or hazardous chemicals without certified agronomic guidance. Contact a qualified agricultural extension officer, agronomist, or registered veterinarian for serious or spreading concerns.';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 35000,
      retryOptions: { attempts: 1 },
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientDeadlineOrOverload(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('504') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('TimeoutError') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET') ||
    msg.includes('fetch failed') ||
    msg.includes('overloaded') ||
    msg.includes('aborted')
  );
}

function formatVisualGeminiError(err: unknown): string {
  const errObj = err as
    | { message?: string; cause?: { message?: string; code?: string } }
    | undefined;
  const combined = `${errObj?.message || String(err)} ${errObj?.cause?.message || ''}`.trim();
  if (
    combined.includes('API_KEY_INVALID') ||
    combined.includes('PERMISSION_DENIED') ||
    combined.includes('403')
  ) {
    return 'Gemini API key permission denied or invalid. Please check GEMINI_API_KEY in Settings > Secrets.';
  }
  if (combined.includes('RESOURCE_EXHAUSTED') || combined.includes('429')) {
    return 'Gemini API quota reached (429). Please wait briefly or check Settings > Secrets.';
  }
  if (combined.includes('TimeoutError') || combined.includes('DEADLINE_EXCEEDED')) {
    return 'Visual analysis timed out on Gemini AI. Please retry with a clearer, smaller image or fewer frames.';
  }
  return `Visual agricultural analysis failed (${combined.slice(0, 160)}).`;
}

function resolveLanguageName(code: LanguageCode): string {
  const lang = store.db.languages.find((l) => l.code === code);
  if (!lang) return 'English';
  if (code === 'sasl') {
    return 'Plain, short, visually structured English suitable for South African Sign Language (SASL) users';
  }
  return `${lang.name} (${lang.nativeName})`;
}

export async function runVisualAgriculturalAnalysis(params: {
  user: SanitizedUser;
  farmId: string;
  fieldId?: string | null;
  livestockGroupId?: string | null;
  cropId?: string | null;
  category: VisualAnalysisCategory;
  mediaType: 'image' | 'video';
  mediaFileName: string;
  mediaMimeType: string;
  frames: { mimeType: string; dataBase64: string }[];
  mediaPreviewDataUrl: string | null;
  userQuestion?: string;
  languageCode: LanguageCode;
}): Promise<VisualAnalysisRecord> {
  const farm = store.db.farms.find((f) => f.id === params.farmId);
  if (!farm) throw new Error('Selected farm not found.');

  const location = store.db.farmLocations.find((l) => l.farmId === farm.id);
  const field = params.fieldId
    ? store.db.fields.find((fl) => fl.id === params.fieldId && fl.farmId === farm.id)
    : null;
  const livestock = params.livestockGroupId
    ? store.db.livestockGroups.find(
        (g) => g.id === params.livestockGroupId && g.farmId === farm.id
      )
    : null;
  const crop = params.cropId
    ? store.db.crops.find((c) => c.id === params.cropId && c.farmId === farm.id)
    : field
    ? store.db.crops.find((c) => c.fieldId === field.id && c.farmId === farm.id)
    : null;

  const contextLines = [
    `Farm: ${farm.name} (${location ? `${location.townOrVillage}, ${location.districtMunicipality}, ${location.province}` : 'South Africa'})`,
    `Analysis Category: ${CATEGORY_LABELS[params.category]}`,
    `Media Submitted: ${params.mediaType === 'video' ? `Video (${params.frames.length} selected frame(s) from ${params.mediaFileName})` : `Photograph (${params.mediaFileName})`}`,
    field ? `Selected Field: ${field.name} (${field.areaHectares} ha, Soil: ${field.soilType}, Irrigation: ${field.irrigationType})` : '',
    crop ? `Linked Crop: ${crop.cropName} (${crop.cropVariety}), stage ${crop.growthStage}, planted ${crop.plantingQuantity}, damaged ${crop.damagedPlants}` : '',
    livestock ? `Selected Livestock Group: ${livestock.groupName} (${livestock.animalType} - ${livestock.breed}), ${livestock.quantity} head, current status ${livestock.healthStatus}` : '',
    params.userQuestion ? `Farmer Question: ${params.userQuestion}` : 'Farmer Question: Provide general visual assessment and safe next steps.',
  ]
    .filter(Boolean)
    .join('\n');

  const languageName = resolveLanguageName(params.languageCode);
  const ai = getGeminiClient();

  let possibleFindings: string[];
  let explanation: string;
  let possibleCauses: string[];
  let confidenceLevel: 'Low' | 'Moderate' | 'High' = 'Moderate';
  let uncertaintyNote: string;
  let recommendedActions: string[];
  let poweredBy: 'gemini' | 'grounded_fallback' = 'gemini';

  if (!ai) {
    poweredBy = 'grounded_fallback';
    possibleFindings = [
      `Visual submission received for ${CATEGORY_LABELS[params.category]} on ${farm.name}.`,
      params.mediaType === 'video'
        ? `${params.frames.length} video frame(s) captured for visual inspection.`
        : 'Field/livestock photograph attached for inspection.',
    ];
    explanation =
      params.category === 'soil_field_condition'
        ? 'Visual soil and field surface inspection requires GEMINI_API_KEY configured in server secrets. Remember: visual inspection only observes surface crusting, residue cover, exposed stones, erosion gullies, or standing water — it CANNOT measure soil pH, N-P-K, or organic matter %. Your image is stored safely against this field for extension review.'
        : 'Gemini multimodal analysis requires GEMINI_API_KEY configured in server secrets. Meanwhile, your media has been recorded safely against your farm record so you can save it as an incident or share it with an agricultural extension officer or veterinarian.';
    possibleCauses = [
      'Awaiting live multimodal AI visual inspection or on-site field/veterinary inspection.',
    ];
    confidenceLevel = 'Low';
    uncertaintyNote =
      'Image inspection has not been processed by Gemini AI yet because GEMINI_API_KEY is not active in this runtime.';
    recommendedActions =
      params.category === 'soil_field_condition'
        ? [
            'Inspect surface crusting, stubble/mulch cover, and standing water drainage channels physically across the field.',
            'Submit a 0–20 cm composite soil sample to an accredited laboratory to measure pH, P, K, and organic matter %.',
          ]
        : [
            'Save this media record as a Farm Incident if urgent damage or illness is visible.',
            'Consult your local provincial agricultural extension officer or registered veterinarian for physical inspection.',
          ];
  } else {
    const parts: Array<
      | { inlineData: { mimeType: string; data: string } }
      | { text: string }
    > = params.frames.slice(0, 4).map((f) => ({
      inlineData: {
        mimeType: f.mimeType || 'image/jpeg',
        data: f.dataBase64.replace(/^data:[^;]+;base64,/, ''),
      },
    }));

    parts.push({
      text: `Analyse the attached ${params.mediaType === 'video' ? 'video frame(s)' : 'photograph'} carefully in ${languageName}.\n\nFarm Context:\n${contextLines}`,
    });

    const schema = {
      type: Type.OBJECT,
      properties: {
        possibleFindings: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '2 to 4 concrete visual observations seen in the photograph/frames.',
        },
        explanation: {
          type: Type.STRING,
          description: `Clear, plain-language explanation of what appears in the visual media and what it could indicate, written in ${languageName}.`,
        },
        possibleCauses: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '2 to 4 plausible agricultural, environmental, mechanical, or health causes.',
        },
        confidenceLevel: {
          type: Type.STRING,
          description: 'One of: Low, Moderate, High depending on image clarity and visual certainty.',
        },
        uncertaintyNote: {
          type: Type.STRING,
          description: 'Explicit explanation of visual limitations, lighting/angle uncertainty, and why physical/lab confirmation is needed.',
        },
        recommendedActions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '3 to 4 safe, practical next steps. Include contacting a qualified agronomist/extension officer or registered veterinarian for serious issues.',
        },
      },
      required: [
        'possibleFindings',
        'explanation',
        'possibleCauses',
        'confidenceLevel',
        'uncertaintyNote',
        'recommendedActions',
      ],
    };

    const systemInstruction = [
      `You are Field Shift's South African visual agricultural inspection assistant.`,
      `Respond strictly in ${languageName}.`,
      `CRITICAL SAFETY & HONESTY RULES:`,
      `1. Clearly state findings as *possible* visual observations—NEVER claim a confirmed medical, veterinary, or laboratory diagnosis.`,
      `2. NEVER recommend dangerous, restricted, or banned chemical pesticides, herbicides, or prescription veterinary drugs/dosages.`,
      `3. For serious crop disease, severe pest outbreaks, structural/machinery hazards, or any livestock illness/injury, explicitly recommend consulting a qualified agricultural extension officer, agronomist, or registered veterinarian.`,
      `4. If the image is blurry, dark, or ambiguous, mark confidenceLevel as "Low" and state the visual uncertainty honestly.`,
      params.category === 'soil_field_condition'
        ? `5. SOIL SURFACE RULE: Only describe visible surface conditions (soil crusting, crop residue/mulch cover, exposed rock/stones, erosion rills/gullies, standing water or drainage clues, visible vegetation health). NEVER fabricate or guess numeric soil pH, NPK, CEC, or organic matter % from a photo — explicitly state that a laboratory soil test is required for chemical fertility.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    try {
      let rawText = '';
      const attempts: Array<{
        model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
        thinkingLevel: ThinkingLevel;
        timeoutMs: number;
        backoffBeforeMs: number;
      }> = [
        { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, timeoutMs: 25000, backoffBeforeMs: 0 },
        { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL, timeoutMs: 20000, backoffBeforeMs: 750 },
        { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL, timeoutMs: 15000, backoffBeforeMs: 1500 },
      ];

      let lastErr: unknown;
      for (const attempt of attempts) {
        if (attempt.backoffBeforeMs > 0) {
          await sleep(attempt.backoffBeforeMs);
        }
        try {
          const res = await ai.models.generateContent({
            model: attempt.model,
            contents: { parts },
            config: {
              abortSignal: AbortSignal.timeout(attempt.timeoutMs),
              thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
              responseMimeType: 'application/json',
              responseSchema: schema,
              systemInstruction,
            },
          });
          rawText = (res.text || '{}').trim();
          lastErr = undefined;
          break;
        } catch (err) {
          lastErr = err;
          if (!isTransientDeadlineOrOverload(err)) throw err;
        }
      }
      if (lastErr) throw lastErr;

      const cleanedJson = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleanedJson || '{}') as {
        possibleFindings?: string[];
        explanation?: string;
        possibleCauses?: string[];
        confidenceLevel?: string;
        uncertaintyNote?: string;
        recommendedActions?: string[];
      };

      possibleFindings = Array.isArray(parsed.possibleFindings) && parsed.possibleFindings.length
        ? parsed.possibleFindings
        : ['Visual review completed; inspect field directly to confirm extent.'];
      explanation =
        parsed.explanation ||
        'Visual observations recorded; confirm on-site with field measurements.';
      possibleCauses = Array.isArray(parsed.possibleCauses) && parsed.possibleCauses.length
        ? parsed.possibleCauses
        : ['Multiple environmental or management factors could contribute.'];
      const confNorm = String(parsed.confidenceLevel || 'Moderate').toLowerCase();
      confidenceLevel = confNorm.includes('high')
        ? 'High'
        : confNorm.includes('low')
        ? 'Low'
        : 'Moderate';
      uncertaintyNote =
        parsed.uncertaintyNote ||
        'Visual inspection from photographs/video frames cannot confirm internal tissue, soil chemistry, or clinical veterinary status.';
      recommendedActions =
        Array.isArray(parsed.recommendedActions) && parsed.recommendedActions.length
          ? parsed.recommendedActions
          : [
              'Log the affected area or count in Farm Incidents to track changes over time.',
              'Seek guidance from a qualified South African agricultural extension officer or veterinarian if symptoms spread.',
            ];
    } catch (err) {
      throw new Error(formatVisualGeminiError(err));
    }
  }

  const now = new Date().toISOString();
  const record: VisualAnalysisRecord = {
    id: `vis-${crypto.randomUUID()}`,
    farmId: farm.id,
    fieldId: field?.id || null,
    livestockGroupId: livestock?.id || null,
    cropId: crop?.id || null,
    ownerId: params.user.id,
    category: params.category,
    mediaType: params.mediaType,
    mediaFileName: params.mediaFileName.slice(0, 200),
    mediaMimeType: params.mediaMimeType,
    analyzedFramesCount: Math.max(1, params.frames.length),
    mediaPreviewDataUrl: params.mediaPreviewDataUrl,
    userQuestion: String(params.userQuestion || '').trim(),
    possibleFindings,
    explanation,
    possibleCauses,
    confidenceLevel,
    uncertaintyNote,
    recommendedActions,
    safetyDisclaimer: SAFETY_DISCLAIMER,
    poweredBy,
    linkedIncidentId: null,
    linkedRecordNote: null,
    analyzedAt: now,
    createdAt: now,
  };

  store.db.visualAnalyses.unshift(record);
  store.logAudit(
    params.user.id,
    'VISUAL_ANALYSIS_COMPLETED',
    'VisualAnalysis',
    record.id,
    {
      farmId: farm.id,
      category: params.category,
      mediaType: params.mediaType,
      frames: record.analyzedFramesCount,
      poweredBy,
    },
    '127.0.0.1'
  );

  return record;
}

export function enrichVisualAnalysis(record: VisualAnalysisRecord) {
  const farm = store.db.farms.find((f) => f.id === record.farmId);
  const field = record.fieldId
    ? store.db.fields.find((fl) => fl.id === record.fieldId)
    : null;
  const livestock = record.livestockGroupId
    ? store.db.livestockGroups.find((g) => g.id === record.livestockGroupId)
    : null;
  const crop = record.cropId ? store.db.crops.find((c) => c.id === record.cropId) : null;

  return {
    ...record,
    farmName: farm?.name || 'Farm',
    fieldName: field?.name || null,
    livestockGroupName: livestock ? `${livestock.groupName} (${livestock.animalType})` : null,
    cropName: crop ? `${crop.cropName} (${crop.cropVariety})` : null,
  };
}
