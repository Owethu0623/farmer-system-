import { LanguageCode } from '../types';

export interface TranslationBundle {
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  getStarted: string;
  signIn: string;
  register: string;
  signOut: string;
  navHome: string;
  navPlatform: string;
  navLanguages: string;
  navAccessibility: string;
  navDashboard: string;
  navFarms: string;
  navCrops: string;
  navLivestock: string;
  navMixed: string;
  navSoilLand: string;
  navWeather: string;
  navVisualAnalysis: string;
  navStock: string;
  navIncidents: string;
  navAdvisor: string;
  navAdmin: string;
  navProfile: string;
  navSettings: string;
  prospectiveTitle: string;
  prospectiveDesc: string;
  existingTitle: string;
  existingDesc: string;
  languagePrompt: string;
  listenInstruction: string;
  stopListening: string;
  speakInput: string;
  largeTextLabel: string;
  onboardingWelcome: string;
  saveAndContinue: string;
  backLabel: string;
  completeSetup: string;
  saslVisualNote: string;
}

export const LANGUAGE_LIST: {
  code: LanguageCode;
  name: string;
  nativeName: string;
  greeting: string;
  speechLang: string;
}[] = [
  { code: 'en', name: 'English', nativeName: 'English', greeting: 'Welcome to your farm workspace', speechLang: 'en-ZA' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', greeting: 'Welkom by jou plaaswerkspasie', speechLang: 'af-ZA' },
  { code: 'zu', name: 'isiZulu', nativeName: 'isiZulu', greeting: 'Siyakwamukela epulazini lakho', speechLang: 'zu-ZA' },
  { code: 'xh', name: 'isiXhosa', nativeName: 'isiXhosa', greeting: 'Wamkelekile kwifama yakho', speechLang: 'xh-ZA' },
  { code: 'nso', name: 'Sepedi', nativeName: 'Sepedi', greeting: 'Re a go amogela polaseng ya gago', speechLang: 'nso-ZA' },
  { code: 'st', name: 'Sesotho', nativeName: 'Sesotho', greeting: 'O amohelehile polasing ya hao', speechLang: 'st-ZA' },
  { code: 'tn', name: 'Setswana', nativeName: 'Setswana', greeting: 'O amogelesegile kwa polaseng ya gago', speechLang: 'tn-ZA' },
  { code: 'ss', name: 'siSwati', nativeName: 'siSwati', greeting: 'Wemukelekile epulazini lakho', speechLang: 'ss-ZA' },
  { code: 've', name: 'Tshivenda', nativeName: 'Tshivenḓa', greeting: 'No ṱanganedzwa bulasini yaṋu', speechLang: 've-ZA' },
  { code: 'ts', name: 'Xitsonga', nativeName: 'Xitsonga', greeting: 'Mi amukeriwile epurasini ra n’wina', speechLang: 'ts-ZA' },
  { code: 'nr', name: 'isiNdebele', nativeName: 'isiNdebele', greeting: 'Wamukelekile epulazini lakho', speechLang: 'nr-ZA' },
  { code: 'sasl', name: 'South African Sign Language', nativeName: 'SASL (Visual)', greeting: 'Visual Sign Language Guide Ready', speechLang: 'en-ZA' },
];

const BASE_EN: TranslationBundle = {
  tagline: 'Your Farm. Your Language. Better Decisions.',
  heroTitle: 'South African agricultural intelligence built for every farmer.',
  heroSubtitle:
    'Discover viable farmland opportunities, map your fields, and get practical crop, soil, and livestock guidance in any of South Africa’s 12 official languages.',
  getStarted: 'Start Free Account',
  signIn: 'Sign In',
  register: 'Create Account',
  signOut: 'Sign Out',
  navHome: 'Overview',
  navPlatform: 'Journeys',
  navLanguages: '12 Languages',
  navAccessibility: 'Accessibility',
  navDashboard: 'Dashboard',
  navFarms: 'Farms & Map',
  navCrops: 'Crops',
  navLivestock: 'Livestock',
  navMixed: 'Mixed Farming',
  navSoilLand: 'Soil & Land',
  navWeather: 'Weather',
  navVisualAnalysis: 'Visual Analysis',
  navStock: 'Stock & Valuation',
  navIncidents: 'Incidents & Damage',
  navAdvisor: 'AI Assistant',
  navAdmin: 'Administration',
  navProfile: 'Profile',
  navSettings: 'Settings',
  prospectiveTitle: 'I want to start farming',
  prospectiveDesc: 'Explore land suitability, beginner farming opportunities, training, and step-by-step business planning.',
  existingTitle: 'I already have a farm',
  existingDesc: 'Register multiple farms, map field boundaries, track crops and livestock, and manage water decisions.',
  languagePrompt: 'Choose your preferred language',
  listenInstruction: 'Listen to instructions',
  stopListening: 'Stop audio',
  speakInput: 'Speak answer',
  largeTextLabel: 'Large Text & Buttons',
  onboardingWelcome: 'Let us set up your farm profile step by step.',
  saveAndContinue: 'Next Step',
  backLabel: 'Previous',
  completeSetup: 'Finish Setup',
  saslVisualNote: 'SASL Visual Mode active: short sentences, clear icons, and sign-language interpreter cue cards enabled.',
};

export const TRANSLATIONS: Record<LanguageCode, Partial<TranslationBundle>> = {
  en: BASE_EN,
  af: {
    tagline: 'Jou Plaas. Jou Taal. Beter Besluite.',
    heroTitle: 'Suid-Afrikaanse landbou-intelligensie vir elke boer.',
    heroSubtitle:
      'Ontdek geskikte boerderygeleenthede, karteer jou lande, en kry praktiese gewas-, grond- en veeraad in enige van Suid-Afrika se 12 amptelike tale.',
    getStarted: 'Begin Gratis Rekening',
    signIn: 'Meld Aan',
    register: 'Skep Rekening',
    signOut: 'Meld Af',
    navDashboard: 'Paneelbord',
    navFarms: 'Plase & Kaart',
    navCrops: 'Gewasse',
    navLivestock: 'Vee',
    navMixed: 'Gemengde Boerdery',
    navSoilLand: 'Grond & Land',
    navWeather: 'Weer',
    navVisualAnalysis: 'Visuele Analise',
    navStock: 'Voorraad & Waarde',
    navIncidents: 'Voorvalle & Skade',
    navAdvisor: 'KI-Assistent',
    navAdmin: 'Administrasie',
    navProfile: 'Profiel',
    navSettings: 'Instellings',
    prospectiveTitle: 'Ek wil begin boer',
    prospectiveDesc: 'Verken grondgeskiktheid, nuwe boerderygeleenthede, beginnersgidse en sakebeplanning.',
    existingTitle: 'Ek het reeds ’n plaas',
    existingDesc: 'Registreer veelvuldige plase, karteer kampe en lande, en bestuur gewasse, vee en water.',
    languagePrompt: 'Kies jou voorkeurtaal',
    listenInstruction: 'Luister na instruksies',
    speakInput: 'Praat antwoord',
    largeTextLabel: 'Groot Teks & Knoppies',
    saveAndContinue: 'Volgende Stap',
    backLabel: 'Vorige',
    completeSetup: 'Voltooi Opstelling',
  },
  zu: {
    tagline: 'Ipulazi Lakho. Ulimi Lwakho. Izinqumo Ezingcono.',
    heroTitle: 'Ubuhlakani bezolimo baseNingizimu Afrika bakhelwe bonke abalimi.',
    heroSubtitle:
      'Thola amathuba okulima, dweba imingcele yamasimu akho, futhi uthole izeluleko zezitshalo, inhlabathi nemfuyo nganoma yiluphi ulimi olusemthethweni lwe-12.',
    getStarted: 'Qala I-Akhawunti Yamahhala',
    signIn: 'Ngena',
    register: 'Bhalisa',
    signOut: 'Phuma',
    navDashboard: 'Ibhodi',
    navFarms: 'Amapulazi Nemephu',
    navCrops: 'Izitshalo',
    navLivestock: 'Imfuyo',
    navMixed: 'Ukulima Okuxubile',
    navSoilLand: 'Inhlabathi Nomhlaba',
    navWeather: 'Isimo Sezulu',
    navVisualAnalysis: 'Ukuhlolwa Kwezithombe',
    navStock: 'Isitoko Nenani',
    navIncidents: 'Izehlakalo Nomonakalo',
    navAdvisor: 'Umeluleki We-AI',
    navAdmin: 'Abaphathi',
    navProfile: 'Iphrofayela',
    navSettings: 'Izilungiselelo',
    prospectiveTitle: 'Ngifuna ukuqala ukulima',
    prospectiveDesc: 'Hlola ukufaneleka komhlaba, amathuba okulima, izifundo zabaqalayo kanye nokuhlela ibhizinisi.',
    existingTitle: 'Nginokwepulazi kakade',
    existingDesc: 'Bhalisa amapulazi amaningi, phatha amasimu, izitshalo, imfuyo namanzi.',
    languagePrompt: 'Khetha ulimi oluthandayo',
    listenInstruction: 'Lalela imiyalelo',
    speakInput: 'Khuluma impendulo',
    largeTextLabel: 'Umbhalo Omkhulu Nezinkinobho',
    saveAndContinue: 'Okulandelayo',
    backLabel: 'Emuva',
    completeSetup: 'Qedela',
  },
  xh: {
    tagline: 'Ifama Yakho. Ulwimi Lwakho. Izigqibo Ezingcono.',
    heroTitle: 'Ubuchule bezolimo baseMzantsi Afrika obulungiselelwe wonke umfama.',
    heroSubtitle:
      'Fumana amathuba okulima, chonga imida yamasimi akho, kwaye ufumane iingcebiso zezityalo, umhlaba nemfuyo ngolwimi lwakho.',
    getStarted: 'Qala I-Akhawunti Simahla',
    signIn: 'Ngena',
    register: 'Bhalisa',
    signOut: 'Phuma',
    navDashboard: 'Ideshibhodi',
    navFarms: 'Iifama Nemephu',
    navCrops: 'Izityalo',
    navLivestock: 'Imfuyo',
    navAdvisor: 'Umcebisi',
    navAdmin: 'Ulawulo',
    navProfile: 'Iprofayile',
    navSettings: 'Useto',
    prospectiveTitle: 'Ndifuna ukuqala ukulima',
    prospectiveDesc: 'Hlola ukulunga komhlaba, amathuba amatsha, izikhokelo zabaqalayo kunye nesicwangciso soshishino.',
    existingTitle: 'Sele ndinayo ifama',
    existingDesc: 'Bhalisa iifama ezininzi, lawula amasimi, izityalo, imfuyo kunye namanzi.',
    languagePrompt: 'Khetha ulwimi oluthandayo',
    listenInstruction: 'Mamela imiyalelo',
    speakInput: 'Thetha impendulo',
    largeTextLabel: 'Umbhalo Omkhulu',
    saveAndContinue: 'Okulandelayo',
    backLabel: 'Emva',
    completeSetup: 'Gqibezela',
  },
  nso: {
    tagline: 'Polasa ya Gago. Polelo ya Gago. Diphetho tše Kaone.',
    heroTitle: 'Bohlale bja temo bja Afrika Borwa bja balemi ka moka.',
    heroSubtitle:
      'Hwetša menyetla ya temo, swaya mellwane ya mašemo a gago, gomme o hwetše keletšo ka polelo ye o e ratago.',
    getStarted: 'Thoma Akhaonto ya Mahala',
    signIn: 'Tsena',
    register: 'Ngwadiša',
    signOut: 'Etšwa',
    navDashboard: 'Letlakala la Temo',
    navFarms: 'Dipolasa & Mmapa',
    navCrops: 'Dibjalo',
    navLivestock: 'Diruiwa',
    navAdvisor: 'Moeletši',
    navProfile: 'Profaele',
    navSettings: 'Dipeakanyo',
    prospectiveTitle: 'Ke nyaka go thoma go lema',
    prospectiveDesc: 'Lekola mobu, menyetla ya temo, dithuto tša mathomo le peakanyo ya kgwebo.',
    existingTitle: 'Ke šetše ke na le polasa',
    existingDesc: 'Ngwadiša dipolasa tše dintši, laola mašemo, dibjalo, diruiwa le meetse.',
    languagePrompt: 'Kgetha polelo ye o e ratago',
    listenInstruction: 'Theeletša ditaelo',
    saveAndContinue: 'Tšwela Pele',
    backLabel: 'Morago',
    completeSetup: 'Fetša',
  },
  st: {
    tagline: 'Polasi ya Hao. Puo ya Hao. Diqeto tse Betere.',
    heroTitle: 'Bohlale ba temo ba Afrika Borwa bakeng sa balemi bohle.',
    heroSubtitle:
      'Fumana menyetla ya temo, rala meedi ya masimo a hao, mme o fumane keletso ka puo ya hao.',
    getStarted: 'Qala Akhaonto ya Mahala',
    signIn: 'Kena',
    register: 'Ingodise',
    signOut: 'Tswa',
    navDashboard: 'Boto ya Taolo',
    navFarms: 'Mapolasi & Mmapa',
    navCrops: 'Dijalo',
    navLivestock: 'Mehlape',
    navAdvisor: 'Moeletsi',
    navProfile: 'Profaele',
    navSettings: 'Ditlhophiso',
    prospectiveTitle: 'Ke batla ho qala ho lema',
    prospectiveDesc: 'Hlahloba mobu o loketseng, menyetla ya temo, tataiso ya ba qalang le moralo wa kgwebo.',
    existingTitle: 'Ke se ke na le polasi',
    existingDesc: 'Ngodisa mapolasi a mangata, laola masimo, dijalo, mehlape le metsi.',
    languagePrompt: 'Kgetha puo eo o e ratang',
    listenInstruction: 'Mamela ditaelo',
    saveAndContinue: 'E latelang',
    backLabel: 'Morao',
    completeSetup: 'Qetela',
  },
  tn: {
    tagline: 'Polase ya Gago. Puo ya Gago. Ditshwetso tse di Botoka.',
    heroTitle: 'Botlhale jwa temothuo jwa Aforika Borwa jwa balemi botlhe.',
    heroSubtitle:
      'Bona ditshono tsa temo, tshwaya melelwane ya masimo, mme o bone dikgakololo ka puo ya gago.',
    getStarted: 'Simolola Akhaonto ya Mahala',
    signIn: 'Tsena',
    register: 'Kwadisa',
    signOut: 'Tswa',
    navDashboard: 'Boto',
    navFarms: 'Dipolase & Mmapa',
    navCrops: 'Dijalo',
    navLivestock: 'Leruo',
    navAdvisor: 'Mogakolodi',
    navProfile: 'Porofaele',
    navSettings: 'Dithulaganyo',
    prospectiveTitle: 'Ke batla go simolola go lema',
    prospectiveDesc: 'Sekaseka mmu, ditshono tsa temo, thuto ya tshimologo le thulaganyo ya kgwebo.',
    existingTitle: 'Ke setse ke na le polase',
    existingDesc: 'Kwadisa dipolase tse dintsi, laola masimo, dijalo, leruo le metsi.',
    languagePrompt: 'Tlhopha puo e o e ratang',
    listenInstruction: 'Reetsa ditaelo',
    saveAndContinue: 'Tswelela',
    backLabel: 'Morago',
    completeSetup: 'Fetsa',
  },
  ss: {
    tagline: 'Lipulazi Lakho. Lulwimi Lwakho. Tincumo Letincono.',
    heroTitle: 'Lwati lwetekulima lwaseNingizimu Afrika lwabo bonkhe balimi.',
    getStarted: 'Cala Mahhala',
    signIn: 'Ngena',
    register: 'Bhalisa',
    signOut: 'Phuma',
    navFarms: 'Emapulazi Nemephu',
    navCrops: 'Tilimo',
    navLivestock: 'Imfuyo',
    prospectiveTitle: 'Ngifuna kucala kulima',
    existingTitle: 'Senginalo lipulazi',
    languagePrompt: 'Khetsa lulwimi lwakho',
    listenInstruction: 'Lalela ticondziso',
    saveAndContinue: 'Chubeka',
    backLabel: 'Emuva',
    completeSetup: 'Cedzela',
  },
  ve: {
    tagline: 'Bulasi Yaṋu. Luambo Lwaṋu. Tsheo Dza Khwiṋe.',
    heroTitle: 'Vhuṱali ha zwa vhulimi ha Afrika Tshipembe ha vhalimi vhoṱhe.',
    getStarted: 'Thoma Mahala',
    signIn: 'Dzhena',
    register: 'Ṅwalisa',
    signOut: 'Bva',
    navFarms: 'Mabulasi & Mmapa',
    navCrops: 'Zwiḽiwa',
    navLivestock: 'Zwilimo na Zwifuwo',
    prospectiveTitle: 'Ndi ṱoḓa u thoma u lima',
    existingTitle: 'Ndi na bulasi kale',
    languagePrompt: 'Nangani luambo lwaṋu',
    listenInstruction: 'Thetshelesani ndaela',
    saveAndContinue: 'Bvelani phanḓa',
    backLabel: 'Murahu',
    completeSetup: 'Fhedzani',
  },
  ts: {
    tagline: 'Purasi ra Wena. Ririmi ra Wena. Swiboho leswinene.',
    heroTitle: 'Vutivi bya vurimi bya Afrika-Dzonga bya varimi hinkwavo.',
    getStarted: 'Sungula Mahala',
    signIn: 'Nghena',
    register: 'Tsarisa',
    signOut: 'Huma',
    navFarms: 'Mapurasi & Mmapa',
    navCrops: 'Swibyariwa',
    navLivestock: 'Swifuwo',
    prospectiveTitle: 'Ndzi lava ku sungula ku rima',
    existingTitle: 'Ndzi na purasi se',
    languagePrompt: 'Hlawula ririmi ra wena',
    listenInstruction: 'Yingisa swiletelo',
    saveAndContinue: 'Yana emahlweni',
    backLabel: 'Endzhaku',
    completeSetup: 'Hetisa',
  },
  nr: {
    tagline: 'Ipulazi Lakho. Ilimi Lakho. Iinqunto Ezingcono.',
    heroTitle: 'Ihlakanipho lezokulima leSewula Afrika labo boke abalimi.',
    getStarted: 'Thoma Simahla',
    signIn: 'Ngena',
    register: 'Tlolela',
    signOut: 'Phuma',
    navFarms: 'Amapulazi Nemephu',
    navCrops: 'Iintjalo',
    navLivestock: 'Ifuyo',
    prospectiveTitle: 'Ngifuna ukuthoma ukulima',
    existingTitle: 'Senginalo ipulazi',
    languagePrompt: 'Khetha ilimi lakho',
    listenInstruction: 'Lalela iinqophiso',
    saveAndContinue: 'Ragela phambili',
    backLabel: 'Emva',
    completeSetup: 'Qedelela',
  },
  sasl: {
    tagline: 'Your Farm · Sign Language Visual Mode · Clear Decisions',
    heroTitle: 'Clear visual farm guidance built for South African Sign Language users.',
    heroSubtitle:
      'Short, plain sentences. Clear step icons. Visual farm boundary mapping and structured SASL-ready guidance.',
    getStarted: 'Start Account (Visual Guide)',
    signIn: 'Sign In',
    register: 'Create Account',
    signOut: 'Sign Out',
    languagePrompt: 'Visual & SASL Language Selected',
    saslVisualNote:
      'SASL Visual Mode Active: Every screen uses short plain statements, clear icons, and structured numbered steps ready for SASL video interpretation.',
  },
};

export function t(lang: LanguageCode, key: keyof TranslationBundle): string {
  return TRANSLATIONS[lang]?.[key] || BASE_EN[key];
}

export function getSpeechLangCode(lang: LanguageCode): string {
  return LANGUAGE_LIST.find((l) => l.code === lang)?.speechLang || 'en-ZA';
}
