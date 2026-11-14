import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { SOUTH_AFRICA_PROVINCES, BEGINNER_GUIDES } from './southAfricaData.ts';
import { buildIncidentDashboard } from './incidents.ts';
import { getFarmSoilAndLandIntelligence } from './soilLandIntelligence.ts';
import { buildStockOverview } from './stockInventory.ts';
import { store } from './store.ts';
import { LanguageCode, SanitizedUser } from './types.ts';
import { getFarmWeatherIntelligence } from './weather.ts';

function getGeminiClient(timeoutMs = 15000): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: timeoutMs,
      retryOptions: {
        attempts: 1,
      },
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientDeadlineOrOverloadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('504') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('TimeoutError') ||
    msg.includes('aborted')
  );
}

async function generateStructuredJson(
  ai: GoogleGenAI,
  params: {
    contents: string;
    systemInstruction: string;
    responseSchema: Record<string, unknown>;
  }
): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: params.contents,
      config: {
        abortSignal: AbortSignal.timeout(15000),
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: params.responseSchema,
        systemInstruction: params.systemInstruction,
      },
    });
    return (response.text || '{}').trim();
  } catch (primaryErr) {
    if (!isTransientDeadlineOrOverloadError(primaryErr)) {
      throw primaryErr;
    }
    const fallbackResponse = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: params.contents,
      config: {
        abortSignal: AbortSignal.timeout(15000),
        responseMimeType: 'application/json',
        responseSchema: params.responseSchema,
        systemInstruction: params.systemInstruction,
      },
    });
    return (fallbackResponse.text || '{}').trim();
  }
}

function formatGeminiError(err: unknown): string {
  const errObj = err as { message?: string; status?: number; cause?: { message?: string; code?: string } } | undefined;
  const msg = errObj?.message || String(err);
  const causeMsg = errObj?.cause?.message || errObj?.cause?.code || '';
  const combined = `${msg} ${causeMsg}`.trim();
  if (combined.includes('API_KEY_INVALID') || combined.includes('PERMISSION_DENIED') || combined.includes('403')) {
    return 'Gemini API key permission denied or invalid. Please check GEMINI_API_KEY in Settings > Secrets.';
  }
  if (combined.includes('RESOURCE_EXHAUSTED') || combined.includes('429')) {
    return 'Gemini API quota reached (429). Please wait briefly or check your quota in Settings > Secrets.';
  }
  if (combined.includes('NOT_FOUND') || combined.includes('404')) {
    return `Gemini model error: ${combined}`;
  }
  if (combined.includes('TimeoutError') || combined.includes('aborted') || combined.includes('ETIMEDOUT') || combined.includes('DEADLINE_EXCEEDED')) {
    return `Gemini AI request timed out (${combined.slice(0, 120)}). Please try again.`;
  }
  return `Agricultural assistant could not reach Gemini AI (${combined.slice(0, 180)}).`;
}

function resolveLanguageName(code: LanguageCode): string {
  const lang = store.db.languages.find((l) => l.code === code);
  if (!lang) return 'English';
  if (code === 'sasl') {
    return 'Plain, short, visually structured English designed for South African Sign Language (SASL) users and visual interpreters, using short clear sentences and numbered action steps';
  }
  return `${lang.name} (${lang.nativeName})`;
}

export interface GroundedFarmContext {
  farmId: string | null;
  farmName: string | null;
  contextText: string;
  facts: {
    totalRegisteredPlants: number;
    damagedPlants: number;
    remainingPlants: number;
    totalCultivatedHa: number;
    totalLivestockHead: number;
    totalExpensesZar: number;
    totalWaterLiters: number;
    hasLabSoilReport: boolean;
    weatherAvailable: boolean;
    activeWarningsCount: number;
    stormOrDamageIncidentsCount: number;
    missingItems: string[];
    supportingSnippets: string[];
  };
}

export async function assembleFullFarmAiContext(
  user: SanitizedUser,
  requestedFarmId?: string | null
): Promise<GroundedFarmContext> {
  const missingItems: string[] = [];
  const supportingSnippets: string[] = [];

  // Determine target farm
  let targetFarm = requestedFarmId
    ? store.db.farms.find((f) => f.id === requestedFarmId)
    : undefined;
  if (!targetFarm && user.roleCode === 'existing_farmer') {
    targetFarm = store.db.farms.find((f) => f.ownerId === user.id);
  }

  if (!targetFarm) {
    // Prospective / general user context
    const pd = user.profile?.prospectiveData;
    const prov = SOUTH_AFRICA_PROVINCES.find((p) => p.name === user.profile?.province);
    if (!pd) missingItems.push('No specific farm registered yet.');
    if (prov) {
      supportingSnippets.push(
        `Province Reference (${prov.name}): ${prov.climateZone}, rainfall ${prov.annualRainfallMm}, commodities: ${prov.keyCommodities.join(', ')}.`
      );
    }
    const text = [
      `User Role: ${user.roleName}`,
      `Province: ${user.profile?.province || 'South Africa'}, District: ${user.profile?.district || 'Unspecified'}`,
      pd
        ? `Prospective Plan: ${pd.intendedLandSizeHectares} ha for ${pd.preferredFarmingType}, Land access: ${pd.landAccessStatus}, Resources: ${pd.availableResources.join(', ') || 'None specified'}, Goals: ${pd.farmingGoals.join(', ') || 'None specified'}.`
        : 'No active farm selected.',
      prov ? `Regional Climate Knowledge: ${prov.climateZone}, Annual Rainfall: ${prov.annualRainfallMm}.` : '',
      `Approved SA Guides: ${BEGINNER_GUIDES.map((g) => `${g.title}: ${g.summary}`).join(' | ')}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      farmId: null,
      farmName: null,
      contextText: text,
      facts: {
        totalRegisteredPlants: 0,
        damagedPlants: 0,
        remainingPlants: 0,
        totalCultivatedHa: 0,
        totalLivestockHead: 0,
        totalExpensesZar: 0,
        totalWaterLiters: 0,
        hasLabSoilReport: false,
        weatherAvailable: false,
        activeWarningsCount: 0,
        stormOrDamageIncidentsCount: 0,
        missingItems: [...missingItems, 'No farm location or laboratory soil report linked yet.'],
        supportingSnippets,
      },
    };
  }

  const location = store.db.farmLocations.find((l) => l.farmId === targetFarm.id) || null;
  const boundary = store.db.farmBoundaries.find((b) => b.farmId === targetFarm.id) || null;
  const fields = store.db.fields.filter((fl) => fl.farmId === targetFarm.id);
  const crops = store.db.crops.filter((c) => c.farmId === targetFarm.id);
  const cropActivities = store.db.cropActivities.filter((a) => a.farmId === targetFarm.id);
  const livestock = store.db.livestockGroups.filter((g) => g.farmId === targetFarm.id);
  const livestockRecords = store.db.livestockRecords.filter((r) => r.farmId === targetFarm.id);
  const mixedEntries = store.db.mixedFarmingEntries.filter((e) => e.farmId === targetFarm.id);

  const [soilIntel, weatherIntel] = await Promise.all([
    getFarmSoilAndLandIntelligence(targetFarm.id).catch(() => null),
    getFarmWeatherIntelligence(targetFarm.id).catch(() => null),
  ]);

  const totalRegisteredPlants = crops.reduce((s, c) => s + c.plantingQuantity, 0);
  const damagedPlants = crops.reduce((s, c) => s + c.damagedPlants, 0);
  const remainingPlants = Math.max(0, totalRegisteredPlants - damagedPlants);
  const totalCultivatedHa = Number(
    crops.reduce((s, c) => s + c.cultivatedAreaHectares, 0).toFixed(2)
  );
  const totalLivestockHead = livestock.reduce((s, g) => s + g.quantity, 0);
  const totalExpensesZar = Number(
    mixedEntries.reduce((s, e) => s + e.expenseZar, 0).toFixed(2)
  );
  const totalWaterLiters = mixedEntries.reduce((s, e) => s + e.waterLiters, 0);
  const damageIncidents = cropActivities.filter((a) =>
    ['damage', 'pest', 'disease'].includes(a.activityType)
  );

  const stockOverview = buildStockOverview([targetFarm.id], targetFarm.id);
  const incidentSummary = buildIncidentDashboard([targetFarm.id], targetFarm.id);
  const visualAnalyses = store.db.visualAnalyses
    .filter((v) => v.farmId === targetFarm.id)
    .slice(0, 6);

  if (!soilIntel?.hasLabReport) {
    missingItems.push('No farmer-uploaded laboratory soil report on file (only mapped estimates exist).');
  }
  if (!boundary) {
    missingItems.push('Farm polygon boundary not drawn yet (using registered farm hectares).');
  }
  if (!weatherIntel?.serviceAvailable) {
    missingItems.push('Live meteorological weather forecast unavailable at query time.');
  }
  if (crops.length === 0) missingItems.push('No registered crop records for this farm.');
  if (livestock.length === 0) missingItems.push('No registered livestock records for this farm.');
  if (totalExpensesZar === 0) missingItems.push('No expense records logged in Mixed Farming yet.');

  supportingSnippets.push(
    `Farm "${targetFarm.name}": ${boundary ? `${boundary.calculatedAreaHectares} ha mapped boundary` : `${targetFarm.farmSizeHectares} ha registered`}, Water: ${targetFarm.waterAvailability}.`
  );
  if (crops.length > 0) {
    supportingSnippets.push(
      `Crops (${crops.length}): ${totalRegisteredPlants.toLocaleString()} planted, ${damagedPlants.toLocaleString()} damaged, ${remainingPlants.toLocaleString()} remaining across ${totalCultivatedHa} ha.`
    );
  }
  if (livestock.length > 0) {
    supportingSnippets.push(
      `Livestock (${livestock.length} groups): ${totalLivestockHead.toLocaleString()} total head (${livestock.map((g) => `${g.quantity} ${g.animalType}`).join(', ')}).`
    );
  }
  supportingSnippets.push(
    `Stock Valuation: Total remaining stock R${stockOverview.totals.totalRemainingStockValueZar.toLocaleString()} (Crop stock R${stockOverview.totals.totalCropStockValueZar.toLocaleString()}, Livestock R${stockOverview.totals.totalLivestockValueZar.toLocaleString()}, Damaged loss R${stockOverview.totals.totalDamagedStockValueZar.toLocaleString()}).`
  );
  if (incidentSummary.summary.totalIncidents > 0) {
    supportingSnippets.push(
      `Incidents (${incidentSummary.summary.totalIncidents}): ${incidentSummary.summary.activeCount} active, ${incidentSummary.summary.monitoringCount} monitoring, est. impact R${incidentSummary.summary.totalFinancialImpactZar.toLocaleString()}.`
    );
  }
  if (soilIntel?.latestLabReport) {
    const r = soilIntel.latestLabReport;
    supportingSnippets.push(
      `Lab Soil Report (${r.laboratoryName}, ${r.sampleDate}): pH(H2O) ${r.soilPhWater ?? 'N/A'}, ${r.soilTextureClass}, OM ${r.organicMatterPercent ?? 'N/A'}%, P ${r.phosphorusMgKg ?? 'N/A'} mg/kg, K ${r.potassiumMgKg ?? 'N/A'} mg/kg.`
    );
  }
  if (weatherIntel?.serviceAvailable && weatherIntel.current) {
    supportingSnippets.push(
      `Live Weather (${weatherIntel.source}): ${weatherIntel.current.temperatureC}°C, ${weatherIntel.current.humidityPercent}% RH, Wind ${weatherIntel.current.windSpeedKmh} km/h, Past 14d rain ${weatherIntel.historicalRainfall.past14DaysMm ?? 0} mm.`
    );
  }

  const contextLines = [
    `FARM RECORD: ${targetFarm.name} (ID: ${targetFarm.id})`,
    `Location: ${location ? `${location.townOrVillage}, ${location.localMunicipality}, ${location.districtMunicipality}, ${location.province} (Lat ${location.latitude}, Lng ${location.longitude}, Source: ${location.locationSource})` : 'No location'}`,
    `Land Size: ${boundary ? `${boundary.calculatedAreaHectares} ha (drawn polygon)` : `${targetFarm.farmSizeHectares} ha (farmer-entered)`}, Water: ${targetFarm.waterAvailability}, Experience: ${targetFarm.yearsOfExperience} yrs`,
    `Fields (${fields.length}): ${fields.map((fl) => `${fl.name}: ${fl.areaHectares} ha, ${fl.cropOrLivestock}, soil ${fl.soilType}, irrigation ${fl.irrigationType}, status ${fl.status}`).join(' | ') || 'None'}`,
    `SOIL INTELLIGENCE: ${soilIntel ? `Lab Report Present: ${soilIntel.hasLabReport ? 'YES' : 'NO'}. Metrics: ${soilIntel.soilMetrics.map((m) => `${m.label}: Lab=${m.labValue ?? 'None'}, Mapped=${m.mappedEstimate ?? 'None'} (${m.sourceType})`).join('; ')}` : 'Unavailable'}`,
    `WEATHER & WARNINGS: ${
      weatherIntel?.serviceAvailable
        ? `Current ${weatherIntel.current?.temperatureC}°C, RH ${weatherIntel.current?.humidityPercent}%, Wind ${weatherIntel.current?.windSpeedKmh} km/h. Past 14d rain: ${weatherIntel.historicalRainfall.past14DaysMm} mm, Past 30d rain: ${weatherIntel.historicalRainfall.past30DaysMm} mm. Next 3 days: ${weatherIntel.daily.slice(0, 3).map((d) => `${d.date}: ${d.tempMinC}-${d.tempMaxC}C, rain ${d.precipitationMm}mm (${d.precipProbabilityPercent ?? '?'}%)`).join(' | ')}. Ops: Spray=${weatherIntel.operationsWindow.sprayingStatus}, Plant=${weatherIntel.operationsWindow.plantingStatus}, Irrigate=${weatherIntel.operationsWindow.irrigationStatus}. Active Warnings (${weatherIntel.warnings.length}): ${weatherIntel.warnings.map((w) => `${w.title}: ${w.whatIsHappening}`).join('; ') || 'None'}`
        : `Weather service unavailable (${weatherIntel?.unavailableReason || 'offline'}).`
    }`,
    `REGISTERED CROPS (${crops.length}): Total Planted=${totalRegisteredPlants}, Damaged=${damagedPlants}, Remaining=${remainingPlants}, Total Cultivated=${totalCultivatedHa} ha. Details: ${
      crops
        .map(
          (c) =>
            `${c.cropName} (${c.cropVariety}) planted ${c.plantingDate}, qty ${c.plantingQuantity}, damaged ${c.damagedPlants}, remaining ${Math.max(0, c.plantingQuantity - c.damagedPlants)}, stage ${c.growthStage}, area ${c.cultivatedAreaHectares} ha, soil "${c.soilInformation}", irrigation "${c.irrigationMethod}", fertiliser "${c.fertiliserInformation}", harvested ${c.harvestedQuantityKg} kg, est value R${c.estimatedValueZar}`
        )
        .join(' | ') || 'None'
    }`,
    `STOCK & INVENTORY VALUATION (${stockOverview.valuationDate.slice(0, 10)}): Remaining Stock Value R${stockOverview.totals.totalRemainingStockValueZar}, Crop Stock Value R${stockOverview.totals.totalCropStockValueZar}, Livestock Value R${stockOverview.totals.totalLivestockValueZar}, Stored Production Value R${stockOverview.totals.totalStoredProductionValueZar}, Damaged Loss R${stockOverview.totals.totalDamagedStockValueZar}, Net Value Change R${stockOverview.totals.netStockValueChangeZar}. Crop Stored/Sold: ${stockOverview.cropStocks.map((cs) => `${cs.cropName}: stored ${cs.storedProductionKg}kg, sold ${cs.soldKg}kg (R${cs.salesValueZar})`).join(' | ') || 'None'}`,
    `FARM INCIDENTS & DAMAGE LOGS (${incidentSummary.summary.totalIncidents}): Active=${incidentSummary.summary.activeCount}, Monitoring=${incidentSummary.summary.monitoringCount}, Resolved=${incidentSummary.summary.resolvedCount}, Financial Impact R${incidentSummary.summary.totalFinancialImpactZar}. Recent: ${
      incidentSummary.incidents
        .slice(0, 8)
        .map((i) => `${i.occurredAt.slice(0, 10)} [${i.incidentType}/${i.status}] ${i.title}: qty ${i.affectedQuantity} ${i.affectedUnit}, impact R${i.estimatedFinancialImpactZar}`)
        .join(' | ') || 'None'
    }`,
    `VISUAL ANALYSES (${visualAnalyses.length}): ${
      visualAnalyses
        .map((v) => `${v.analyzedAt.slice(0, 10)} [${v.category}] ${v.possibleFindings[0] || v.explanation.slice(0, 80)}`)
        .join(' | ') || 'None'
    }`,
    `CROP ACTIVITIES & INCIDENTS (${cropActivities.length}): ${
      cropActivities
        .slice(0, 20)
        .map((a) => `${a.activityDate} [${a.activityType}] ${a.quantity} ${a.unit} (R${a.valueZar}): ${a.notes}`)
        .join(' | ') || 'None'
    }`,
    `LIVESTOCK GROUPS (${livestock.length}, Total ${totalLivestockHead} head): ${
      livestock
        .map(
          (g) =>
            `${g.groupName} (${g.animalType} - ${g.breed}), qty ${g.quantity}, tag ${g.identificationNumber || 'Group'}, health ${g.healthStatus}, feeding "${g.feedingInformation}", grazing "${g.grazingInformation}", housing "${g.housingInformation}", unit value R${g.estimatedUnitValueZar}`
        )
        .join(' | ') || 'None'
    }`,
    `LIVESTOCK LEDGER RECORDS (${livestockRecords.length}): ${
      livestockRecords
        .slice(0, 15)
        .map((r) => `${r.recordDate} [${r.recordType}] qtyChange ${r.quantityChange}, prod ${r.productionAmount} ${r.productionUnit}, R${r.valueZar}: ${r.notes}`)
        .join(' | ') || 'None'
    }`,
    `MIXED FARMING & EXPENSES (${mixedEntries.length} logs, Total Expenses R${totalExpensesZar}, Total Water Logged ${totalWaterLiters} L): ${
      mixedEntries
        .slice(0, 15)
        .map((e) => `${e.entryDate} [${e.entryCategory}] ${e.title}: expense R${e.expenseZar}, prod ${e.productionQuantity} ${e.productionUnit}, water ${e.waterLiters} L (${e.notes})`)
        .join(' | ') || 'None'
    }`,
    `MISSING DATA FLAGS: ${missingItems.join(' | ') || 'Core datasets present.'}`,
  ];

  return {
    farmId: targetFarm.id,
    farmName: targetFarm.name,
    contextText: contextLines.join('\n'),
    facts: {
      totalRegisteredPlants,
      damagedPlants,
      remainingPlants,
      totalCultivatedHa,
      totalLivestockHead,
      totalExpensesZar,
      totalWaterLiters,
      hasLabSoilReport: Boolean(soilIntel?.hasLabReport),
      weatherAvailable: Boolean(weatherIntel?.serviceAvailable),
      activeWarningsCount: weatherIntel?.warnings.length || 0,
      stormOrDamageIncidentsCount: Math.max(damageIncidents.length, incidentSummary.summary.totalIncidents),
      missingItems,
      supportingSnippets,
    },
  };
}

export interface AiStructuredAnswer {
  answer: string;
  supportingInformation: string[];
  assumptions: string[];
  missingInformation: string[];
  uncertaintyNote: string;
  suggestedActions: string[];
  languageName: string;
  poweredBy: 'gemini' | 'grounded_fallback';
  farmName: string | null;
  generatedAt: string;
}

function buildDeterministicFallbackAnswer(
  question: string,
  languageName: string,
  ctx: GroundedFarmContext
): AiStructuredAnswer {
  const qLower = question.toLowerCase();
  let answer = `Grounded Farm Summary (${languageName}) for ${ctx.farmName || 'your account'}:\n`;

  if (qLower.includes('how many plants') || qLower.includes('registered')) {
    answer += `You currently have ${ctx.facts.totalRegisteredPlants.toLocaleString()} planted units recorded across ${ctx.facts.totalCultivatedHa} ha, with ${ctx.facts.damagedPlants.toLocaleString()} damaged plants and ${ctx.facts.remainingPlants.toLocaleString()} remaining recorded plants.`;
  } else if (qLower.includes('expense') || qLower.includes('cost') || qLower.includes('spend')) {
    answer += `Recorded farm expenses in Mixed Farming logs currently total R${ctx.facts.totalExpensesZar.toLocaleString()}. Any input costs not logged in Mixed Farming or crop/livestock purchase logs are excluded.`;
  } else if (qLower.includes('storm') || qLower.includes('damage')) {
    answer += `Your farm records show ${ctx.facts.damagedPlants.toLocaleString()} damaged plants and ${ctx.facts.stormOrDamageIncidentsCount} logged damage/pest/disease incidents. Review the Crop Activity History table for exact incident dates and notes.`;
  } else {
    answer += `Reviewed ${ctx.facts.supportingSnippets.join(' ')} Based on your current records, prioritise verifying any missing soil laboratory data, aligning irrigation to current weather forecasts, and recording all expenses and field incidents.`;
  }

  return {
    answer,
    supportingInformation: ctx.facts.supportingSnippets.length
      ? ctx.facts.supportingSnippets
      : ['Profile & regional climate baseline used.'],
    assumptions: [
      'Calculations use only records entered into Field Shift and live coordinate telemetry where available.',
      'Connect a GEMINI_API_KEY in Settings > Secrets for full multilingual conversational reasoning.',
    ],
    missingInformation: ctx.facts.missingItems.length
      ? ctx.facts.missingItems
      : ['No major dataset gaps detected for this farm.'],
    uncertaintyNote:
      'Agricultural estimates carry climate, pest, and market price uncertainty. Field Shift never guarantees crop yields or financial profits.',
    suggestedActions: [
      !ctx.facts.hasLabSoilReport
        ? 'Upload a composite 0–20 cm laboratory soil report in Soil & Land Intelligence.'
        : 'Review your latest soil report nutrients against active crop stages.',
      'Check the Weather Intelligence operations window before spraying or irrigating.',
    ],
    languageName,
    poweredBy: 'grounded_fallback',
    farmName: ctx.farmName,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateAgriculturalAdvice(params: {
  question: string;
  languageCode: LanguageCode;
  user: SanitizedUser;
  farmId?: string | null;
  conversationHistory?: { role: 'user' | 'assistant'; text: string }[];
}): Promise<AiStructuredAnswer> {
  const languageName = resolveLanguageName(params.languageCode);
  const ctx = await assembleFullFarmAiContext(params.user, params.farmId);
  const ai = getGeminiClient();

  if (!ai) {
    return buildDeterministicFallbackAnswer(params.question, languageName, ctx);
  }

  const historyText = (params.conversationHistory || [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Farmer' : 'Advisor'}: ${m.text}`)
    .join('\n');

  try {
    const rawJson = await generateStructuredJson(ai, {
      contents: [
        historyText ? `Recent Conversation:\n${historyText}\n` : '',
        `Current Farmer Question: ${params.question}`,
        `\nVerified Grounded Farm & Regional Data:\n${ctx.contextText}`,
      ]
        .filter(Boolean)
        .join('\n'),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: {
            type: Type.STRING,
            description: `Clear, practical, grounded agricultural answer in ${languageName}. Reference exact numbers from the farm records when present.`,
          },
          supportingInformation: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Exact farm records, measurements, weather figures, or knowledge facts used.',
          },
          assumptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Explicit assumptions made due to incomplete or seasonal conditions.',
          },
          missingInformation: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Missing farm records, lab reports, or telemetry needed for higher precision.',
          },
          uncertaintyNote: {
            type: Type.STRING,
            description: 'Honest statement of uncertainty and explicit note that yields/profits are not guaranteed.',
          },
          suggestedActions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2 to 4 concrete, realistic next actions for the farmer.',
          },
        },
        required: [
          'answer',
          'supportingInformation',
          'assumptions',
          'missingInformation',
          'uncertaintyNote',
          'suggestedActions',
        ],
      },
      systemInstruction: [
        `You are Field Shift's South African agricultural decision-support assistant.`,
        `Respond strictly in ${languageName}.`,
        `CRITICAL RELIABILITY RULES:`,
        `1. Answer using ONLY the verified farm records, soil data, weather data, crops, livestock, expenses, and South African agricultural context provided.`,
        `2. NEVER invent or fabricate farm records, soil test figures, weather forecasts, or historical incidents.`,
        `3. Distinguish farmer-uploaded lab soil measurements from mapped geospatial estimates.`,
        `4. NEVER guarantee yields, rainfall, or financial profits.`,
        `5. Keep prose clear, respectful, and easy to read aloud for both experienced and first-time farmers.`,
      ].join(' '),
    });

    const parsed = JSON.parse(rawJson) as Partial<AiStructuredAnswer>;
    return {
      answer: parsed.answer || 'Unable to generate guidance right now.',
      supportingInformation: Array.isArray(parsed.supportingInformation)
        ? parsed.supportingInformation
        : ctx.facts.supportingSnippets,
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
      missingInformation: Array.isArray(parsed.missingInformation)
        ? parsed.missingInformation
        : ctx.facts.missingItems,
      uncertaintyNote:
        parsed.uncertaintyNote ||
        'Recommendations depend on actual field verification, rainfall variability, and market prices; outcomes are not guaranteed.',
      suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
      languageName,
      poweredBy: 'gemini',
      farmName: ctx.farmName,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Gemini API error:', err);
    throw new Error(formatGeminiError(err));
  }
}

export interface AiFarmAnalyticsReport {
  farmName: string;
  generatedAt: string;
  poweredBy: 'gemini' | 'grounded_fallback';
  farmPerformanceSummary: string;
  cropPerformanceInsights: string;
  livestockPerformanceInsights: string;
  weatherImpactSummary: string;
  stockSummary: string;
  productionEstimates: string;
  expenseSummary: string;
  agriculturalOpportunities: string[];
  suggestedNextActions: string[];
  supportingInformation: string[];
  assumptionsAndMissingInfo: string[];
}

export async function generateFarmAiAnalytics(params: {
  user: SanitizedUser;
  farmId?: string | null;
  languageCode: LanguageCode;
}): Promise<AiFarmAnalyticsReport> {
  const languageName = resolveLanguageName(params.languageCode);
  const ctx = await assembleFullFarmAiContext(params.user, params.farmId);
  const ai = getGeminiClient();
  const farmName = ctx.farmName || 'Selected Agricultural Portfolio';

  if (!ai) {
    return {
      farmName,
      generatedAt: new Date().toISOString(),
      poweredBy: 'grounded_fallback',
      farmPerformanceSummary: `${farmName}: Managing ${ctx.facts.totalCultivatedHa} cultivated crop ha, ${ctx.facts.remainingPlants.toLocaleString()} remaining plants, and ${ctx.facts.totalLivestockHead.toLocaleString()} livestock head.`,
      cropPerformanceInsights: `${ctx.facts.totalRegisteredPlants.toLocaleString()} planted vs ${ctx.facts.damagedPlants.toLocaleString()} damaged (${ctx.facts.stormOrDamageIncidentsCount} logged damage/pest/disease incidents).`,
      livestockPerformanceInsights: `Current recorded herd/flock inventory stands at ${ctx.facts.totalLivestockHead.toLocaleString()} animals across registered groups.`,
      weatherImpactSummary: ctx.facts.weatherAvailable
        ? `Live coordinate weather connected with ${ctx.facts.activeWarningsCount} active agricultural warning(s).`
        : 'Live weather feed unavailable; review seasonal provincial rainfall guidance.',
      stockSummary: `Remaining plants: ${ctx.facts.remainingPlants.toLocaleString()} · Livestock head: ${ctx.facts.totalLivestockHead.toLocaleString()} · Logged water: ${ctx.facts.totalWaterLiters.toLocaleString()} L.`,
      productionEstimates:
        'Production depends on weather, irrigation timing, and pest management. Harvest yields and market prices are estimates only and cannot be guaranteed.',
      expenseSummary: `Recorded mixed-farming and operational expenses total R${ctx.facts.totalExpensesZar.toLocaleString()}.`,
      agriculturalOpportunities: [
        'Use crop residues and harvested fodder to reduce winter livestock feed purchases.',
        'Schedule irrigation and spraying directly against coordinate weather windows.',
      ],
      suggestedNextActions: [
        !ctx.facts.hasLabSoilReport
          ? 'Submit a composite soil sample for laboratory testing and upload it in Soil & Land Intelligence.'
          : 'Apply top-dressing aligned with your uploaded laboratory soil report.',
        'Review active agricultural weather warnings before field spraying or irrigation.',
      ],
      supportingInformation: ctx.facts.supportingSnippets,
      assumptionsAndMissingInfo: ctx.facts.missingItems,
    };
  }

  try {
    const rawJson = await generateStructuredJson(ai, {
      contents: `Generate a structured agricultural intelligence analytics report in ${languageName} using ONLY these verified farm records:\n\n${ctx.contextText}`,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          farmPerformanceSummary: { type: Type.STRING },
          cropPerformanceInsights: { type: Type.STRING },
          livestockPerformanceInsights: { type: Type.STRING },
          weatherImpactSummary: { type: Type.STRING },
          stockSummary: { type: Type.STRING },
          productionEstimates: { type: Type.STRING },
          expenseSummary: { type: Type.STRING },
          agriculturalOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedNextActions: { type: Type.ARRAY, items: { type: Type.STRING } },
          supportingInformation: { type: Type.ARRAY, items: { type: Type.STRING } },
          assumptionsAndMissingInfo: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'farmPerformanceSummary',
          'cropPerformanceInsights',
          'livestockPerformanceInsights',
          'weatherImpactSummary',
          'stockSummary',
          'productionEstimates',
          'expenseSummary',
          'agriculturalOpportunities',
          'suggestedNextActions',
          'supportingInformation',
          'assumptionsAndMissingInfo',
        ],
      },
      systemInstruction: [
        `You are Field Shift's South African agricultural analytics engine.`,
        `Write strictly in ${languageName}.`,
        `Never invent records, never guarantee yields or profits, and explicitly highlight missing data (such as missing lab soil reports or unlogged expenses).`,
      ].join(' '),
    });

    const parsed = JSON.parse(rawJson) as Omit<
      AiFarmAnalyticsReport,
      'farmName' | 'generatedAt' | 'poweredBy'
    >;

    return {
      farmName,
      generatedAt: new Date().toISOString(),
      poweredBy: 'gemini',
      ...parsed,
    };
  } catch (err) {
    console.error('Gemini Analytics error:', err);
    throw new Error(formatGeminiError(err));
  }
}
