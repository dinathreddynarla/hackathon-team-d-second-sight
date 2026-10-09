import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { Capacitor } from '@capacitor/core'

import type { TargetClass } from '../vision/detector'
import type { Side, Target } from '../vision/distance'

// Languages with a full sentence table. A language appears in the app only when its voice is installed on the phone.
export const LANGS = ['en', 'te', 'hi', 'ta', 'kn'] as const
export type Lang = (typeof LANGS)[number]
// Things worth naming when the user asks "what is around me", beyond the eight that get warnings.
export const EXTRA_CLASSES = [
  'traffic light',
  'stop sign',
  'bench',
  'chair',
  'fire hydrant',
  'potted plant',
  'dining table',
  'umbrella',
  'backpack',
  'handbag',
  'suitcase',
  'bottle',
  'cell phone',
  'cat',
  'horse',
  'bird',
  'bed',
  'toilet',
] as const
export type ExtraClass = (typeof EXTRA_CLASSES)[number]
export type Range = 'oneStep' | 'twoSteps' | 'close' | 'metres' | 'far'
export type Phrase =
  | 'ready'
  | 'stopped'
  | 'nothingAround'
  | 'calibrated'
  | 'noPerson'
  | 'setupIntro'
  | 'voicesInstalled'
  | 'voiceTest'
  | 'setupDone'
  | 'sosPrompt'
  | 'sosSent'
  | 'sosFailed'
  | 'sosCancelled'
  | 'noSosNumber'
  | 'cameraFailed'
  | 'modelMissing'
  | 'voiceMissing'
  | 'languageName'
  | 'batteryLow'
  | 'batteryCritical'
  | 'cameraBlocked'
  | 'tooDark'
  | 'cameraClear'
  | 'detectionSlow'
  | 'crowded'
  | 'helpPrompt'
  | 'stillPrompt'
  | 'calling1'
  | 'calling2'
  | 'calling3'
  | 'noAnswer'
  | 'callEnded'
  | 'nobodyAnswered'
  | 'callFailed'
  | 'callingStopped'
  | 'waitingForCall'
  | 'callOffer'
  | 'shortcutHelp'

type Words = {
  tag: string
  // Telugu, Hindi, Tamil and Kannada say where before what: "left, car, 8 metres".
  sideFirst: boolean
  extra: Record<ExtraClass, string>
  also: string
  textSays: string
  label: Record<TargetClass, string>
  plural: Record<TargetClass, string>
  side: Record<Side, string>
  range: Record<Range, string>
  metres: (n: number) => string
  andMore: (n: number) => string
  guide: { left: string; right: string; stop: string }
  approaching: string
  phrase: Record<Phrase, string>
}

const WORDS: Record<Lang, Words> = {
  en: {
    tag: 'en-IN',
    sideFirst: false,
    extra: {
      'traffic light': 'traffic light',
      'stop sign': 'stop sign',
      bench: 'bench',
      chair: 'chair',
      'fire hydrant': 'fire hydrant',
      'potted plant': 'plant pot',
      'dining table': 'table',
      umbrella: 'umbrella',
      backpack: 'backpack',
      handbag: 'handbag',
      suitcase: 'suitcase',
      bottle: 'bottle',
      'cell phone': 'phone',
      cat: 'cat',
      horse: 'horse',
      bird: 'bird',
      bed: 'bed',
      toilet: 'toilet',
    },
    also: 'Also',
    textSays: 'Text says',
    label: {
      person: 'person',
      car: 'car',
      motorcycle: 'motorcycle',
      bicycle: 'bicycle',
      bus: 'bus',
      truck: 'truck',
      dog: 'dog',
      cow: 'cow',
    },
    plural: {
      person: 'people',
      car: 'cars',
      motorcycle: 'motorcycles',
      bicycle: 'bicycles',
      bus: 'buses',
      truck: 'trucks',
      dog: 'dogs',
      cow: 'cows',
    },
    side: { left: 'left', ahead: 'ahead', right: 'right' },
    range: { oneStep: 'one step', twoSteps: 'two steps', close: 'close', metres: '', far: 'far' },
    metres: n => `${n} metres`,
    andMore: n => `and ${n} more`,
    guide: { left: 'move left', right: 'move right', stop: 'stop' },
    approaching: 'coming',
    phrase: {
      ready: 'Second Sight ready',
      stopped: 'stopped',
      nothingAround: 'nothing detected around you',
      calibrated: 'calibrated',
      noPerson: 'no person in view',
      setupIntro: 'One time setup. Tap install voices, then choose your language.',
      voicesInstalled: 'Now tap test voice.',
      voiceTest: 'The voice works. Setup done.',
      setupDone: 'Setup done. No internet is needed from now on.',
      sosPrompt: 'Are you okay? Tap the screen to cancel, or your contacts will be messaged and called in 15 seconds.',
      sosSent: 'Help message sent.',
      sosFailed: 'Could not send the help message.',
      sosCancelled: 'Cancelled.',
      noSosNumber: 'No emergency contact saved. Add one in settings.',
      cameraFailed: 'Camera did not start. Check the camera permission.',
      modelMissing: 'Detection could not start. Reinstall the app.',
      voiceMissing: 'That voice is not installed. Open settings and tap install offline voices.',
      languageName: 'English',
      batteryLow: 'Battery {n} percent. Charge soon.',
      batteryCritical: 'Battery {n} percent. Charge now.',
      cameraBlocked: 'Camera blocked. Clear the lens.',
      tooDark: "Camera can't see. Warnings may be missed.",
      cameraClear: 'Camera clear.',
      detectionSlow: 'Detection is slow. Warnings may be late.',
      crowded: 'Crowd ahead.',
      helpPrompt: 'Asking for help. Tap to cancel.',
      stillPrompt: 'You have not moved for 30 seconds. Are you okay? Tap the screen to cancel.',
      calling1: 'Calling contact one.',
      calling2: 'Calling contact two.',
      calling3: 'Calling contact three.',
      noAnswer: 'No answer.',
      callEnded: 'Calls finished.',
      nobodyAnswered: 'Nobody answered.',
      callFailed: 'Could not call.',
      callingStopped: 'Stopped calling.',
      waitingForCall: 'Waiting for the current call to end.',
      callOffer: 'Tap anywhere to call your contact.',
      shortcutHelp:
        'Find Second Sight in this list, open it, and turn on its shortcut. Then holding both volume keys opens the app.',
    },
  },
  te: {
    tag: 'te-IN',
    sideFirst: true,
    extra: {
      'traffic light': 'ట్రాఫిక్ లైట్',
      'stop sign': 'స్టాప్ బోర్డు',
      bench: 'బెంచ్',
      chair: 'కుర్చీ',
      'fire hydrant': 'ఫైర్ హైడ్రంట్',
      'potted plant': 'మొక్క కుండీ',
      'dining table': 'టేబుల్',
      umbrella: 'గొడుగు',
      backpack: 'బ్యాగ్',
      handbag: 'హ్యాండ్‌బ్యాగ్',
      suitcase: 'సూట్‌కేస్',
      bottle: 'సీసా',
      'cell phone': 'ఫోన్',
      cat: 'పిల్లి',
      horse: 'గుర్రం',
      bird: 'పక్షి',
      bed: 'మంచం',
      toilet: 'టాయిలెట్',
    },
    also: 'ఇంకా',
    textSays: 'రాసి ఉన్నది',
    label: {
      person: 'వ్యక్తి',
      car: 'కారు',
      motorcycle: 'బైక్',
      bicycle: 'సైకిల్',
      bus: 'బస్సు',
      truck: 'లారీ',
      dog: 'కుక్క',
      cow: 'ఆవు',
    },
    plural: {
      person: 'మంది',
      car: 'కార్లు',
      motorcycle: 'బైక్‌లు',
      bicycle: 'సైకిళ్ళు',
      bus: 'బస్సులు',
      truck: 'లారీలు',
      dog: 'కుక్కలు',
      cow: 'ఆవులు',
    },
    side: { left: 'ఎడమవైపు', ahead: 'ముందు', right: 'కుడివైపు' },
    range: { oneStep: 'ఒక అడుగు', twoSteps: 'రెండు అడుగులు', close: 'దగ్గరగా', metres: '', far: 'దూరంగా' },
    metres: n => `${n} మీటర్లు`,
    andMore: n => `ఇంకా ${n}`,
    guide: { left: 'ఎడమకు జరగండి', right: 'కుడికి జరగండి', stop: 'ఆగండి' },
    approaching: 'వస్తోంది',
    phrase: {
      ready: 'సెకండ్ సైట్ సిద్ధం',
      stopped: 'ఆగింది',
      nothingAround: 'చుట్టూ ఏమీ లేదు',
      calibrated: 'కాలిబ్రేట్ అయింది',
      noPerson: 'ఎవరూ కనిపించడం లేదు',
      setupIntro: 'ఒకసారి సెటప్. ఇన్‌స్టాల్ వాయిసెస్ నొక్కి, ఇంగ్లీష్ ఇండియా మరియు తెలుగు ఎంచుకోండి.',
      voicesInstalled: 'ఇప్పుడు టెస్ట్ వాయిస్ నొక్కండి.',
      voiceTest: 'వాయిస్ పనిచేస్తోంది. సెటప్ పూర్తయింది.',
      setupDone: 'సెటప్ పూర్తయింది. ఇకపై ఇంటర్నెట్ అవసరం లేదు.',
      sosPrompt:
        'మీరు బాగున్నారా? రద్దు చేయడానికి స్క్రీన్ నొక్కండి, లేకపోతే పదిహేను సెకన్లలో మీ కాంటాక్ట్‌లకు సందేశం, కాల్ వెళ్తాయి.',
      sosSent: 'సహాయ సందేశం పంపబడింది.',
      sosFailed: 'సహాయ సందేశం పంపలేకపోయాం.',
      sosCancelled: 'రద్దు చేయబడింది.',
      noSosNumber: 'అత్యవసర కాంటాక్ట్ సేవ్ కాలేదు. సెట్టింగ్స్‌లో జోడించండి.',
      cameraFailed: 'కెమెరా ప్రారంభం కాలేదు. కెమెరా అనుమతి ఇవ్వండి.',
      modelMissing: 'డిటెక్షన్ ప్రారంభం కాలేదు.',
      voiceMissing: 'ఆ వాయిస్ ఇన్‌స్టాల్ కాలేదు. సెట్టింగ్స్ తెరిచి, ఇన్‌స్టాల్ ఆఫ్‌లైన్ వాయిసెస్ నొక్కండి.',
      languageName: 'తెలుగు',
      batteryLow: 'బ్యాటరీ {n} శాతం. త్వరలో ఛార్జ్ చేయండి.',
      batteryCritical: 'బ్యాటరీ {n} శాతం. ఇప్పుడే ఛార్జ్ చేయండి.',
      cameraBlocked: 'కెమెరాకు అడ్డు ఉంది. లెన్స్ శుభ్రం చేయండి.',
      tooDark: 'కెమెరాకు కనిపించడం లేదు. హెచ్చరికలు తప్పిపోవచ్చు.',
      cameraClear: 'కెమెరా స్పష్టం.',
      detectionSlow: 'డిటెక్షన్ నెమ్మదిగా ఉంది. హెచ్చరికలు ఆలస్యం కావచ్చు.',
      crowded: 'ముందు రద్దీ ఉంది.',
      helpPrompt: 'సహాయం అడుగుతోంది. రద్దు చేయడానికి నొక్కండి.',
      stillPrompt: 'మీరు ముప్పై సెకన్లుగా కదలలేదు. బాగున్నారా? రద్దు చేయడానికి స్క్రీన్ నొక్కండి.',
      calling1: 'మొదటి కాంటాక్ట్‌కు కాల్ చేస్తున్నాం.',
      calling2: 'రెండవ కాంటాక్ట్‌కు కాల్ చేస్తున్నాం.',
      calling3: 'మూడవ కాంటాక్ట్‌కు కాల్ చేస్తున్నాం.',
      noAnswer: 'సమాధానం లేదు.',
      callEnded: 'కాల్‌లు ముగిశాయి.',
      nobodyAnswered: 'ఎవరూ సమాధానం ఇవ్వలేదు.',
      callFailed: 'కాల్ చేయలేకపోయాం.',
      callingStopped: 'కాల్ చేయడం ఆపేశాం.',
      waitingForCall: 'ప్రస్తుత కాల్ ముగిసే వరకు వేచి ఉన్నాం.',
      callOffer: 'మీ కాంటాక్ట్‌కు కాల్ చేయడానికి ఎక్కడైనా నొక్కండి.',
      shortcutHelp:
        'ఈ జాబితాలో సెకండ్ సైట్ తెరిచి దాని షార్ట్‌కట్ ఆన్ చేయండి. తర్వాత రెండు వాల్యూమ్ బటన్లు నొక్కి పట్టుకుంటే యాప్ తెరుచుకుంటుంది.',
    },
  },
  hi: {
    tag: 'hi-IN',
    sideFirst: true,
    extra: {
      'traffic light': 'ट्रैफ़िक लाइट',
      'stop sign': 'स्टॉप बोर्ड',
      bench: 'बेंच',
      chair: 'कुर्सी',
      'fire hydrant': 'फ़ायर हाइड्रेंट',
      'potted plant': 'गमला',
      'dining table': 'मेज़',
      umbrella: 'छाता',
      backpack: 'बैग',
      handbag: 'हैंडबैग',
      suitcase: 'सूटकेस',
      bottle: 'बोतल',
      'cell phone': 'फ़ोन',
      cat: 'बिल्ली',
      horse: 'घोड़ा',
      bird: 'चिड़िया',
      bed: 'बिस्तर',
      toilet: 'शौचालय',
    },
    also: 'साथ में',
    textSays: 'लिखा है',
    label: {
      person: 'व्यक्ति',
      car: 'कार',
      motorcycle: 'बाइक',
      bicycle: 'साइकिल',
      bus: 'बस',
      truck: 'ट्रक',
      dog: 'कुत्ता',
      cow: 'गाय',
    },
    plural: {
      person: 'लोग',
      car: 'कारें',
      motorcycle: 'बाइकें',
      bicycle: 'साइकिलें',
      bus: 'बसें',
      truck: 'ट्रक',
      dog: 'कुत्ते',
      cow: 'गायें',
    },
    side: { left: 'बाईं ओर', ahead: 'सामने', right: 'दाईं ओर' },
    range: { oneStep: 'एक कदम', twoSteps: 'दो कदम', close: 'पास', metres: '', far: 'दूर' },
    metres: n => `${n} मीटर`,
    andMore: n => `और ${n}`,
    guide: { left: 'बाईं ओर हटें', right: 'दाईं ओर हटें', stop: 'रुकें' },
    approaching: 'आ रहा है',
    phrase: {
      ready: 'सेकंड साइट तैयार',
      stopped: 'रुक गया',
      nothingAround: 'आसपास कुछ नहीं मिला',
      calibrated: 'कैलिब्रेट हो गया',
      noPerson: 'कोई व्यक्ति नहीं दिख रहा',
      setupIntro: 'एक बार का सेटअप। इंस्टॉल वॉइस दबाएँ, फिर अपनी भाषा चुनें।',
      voicesInstalled: 'अब टेस्ट वॉइस दबाएँ।',
      voiceTest: 'आवाज़ काम कर रही है। सेटअप पूरा।',
      setupDone: 'सेटअप पूरा। अब इंटरनेट की ज़रूरत नहीं।',
      sosPrompt: 'क्या आप ठीक हैं? रद्द करने के लिए स्क्रीन दबाएँ, नहीं तो पंद्रह सेकंड में मदद का संदेश जाएगा।',
      sosSent: 'मदद का संदेश भेज दिया गया।',
      sosFailed: 'मदद का संदेश नहीं भेजा जा सका।',
      sosCancelled: 'रद्द किया गया।',
      noSosNumber: 'आपातकालीन नंबर सेव नहीं है। सेटिंग्स में जोड़ें।',
      cameraFailed: 'कैमरा शुरू नहीं हुआ। कैमरा की अनुमति दें।',
      modelMissing: 'पहचान शुरू नहीं हो सकी। ऐप दोबारा इंस्टॉल करें।',
      voiceMissing: 'यह आवाज़ इंस्टॉल नहीं है। सेटिंग्स खोलें और ऑफ़लाइन वॉइस इंस्टॉल करें।',
      languageName: 'हिन्दी',
      batteryLow: 'बैटरी {n} प्रतिशत। जल्दी चार्ज करें।',
      batteryCritical: 'बैटरी {n} प्रतिशत। अभी चार्ज करें।',
      cameraBlocked: 'कैमरा ढका है। लेंस साफ़ करें।',
      tooDark: 'कैमरा देख नहीं पा रहा। चेतावनियाँ छूट सकती हैं।',
      cameraClear: 'कैमरा साफ़।',
      helpPrompt: 'मदद माँगी जा रही है। रद्द करने के लिए दबाएँ।',
      stillPrompt: 'आप तीस सेकंड से हिले नहीं। क्या आप ठीक हैं? रद्द करने के लिए स्क्रीन दबाएँ।',
      callOffer: 'अपने संपर्क को कॉल करने के लिए कहीं भी दबाएँ।',
      shortcutHelp:
        'इस सूची में सेकंड साइट खोलें और उसका शॉर्टकट चालू करें। फिर दोनों वॉल्यूम बटन दबाकर रखने से ऐप खुल जाएगा।',
      detectionSlow: 'पहचान धीमी है। चेतावनियाँ देर से आ सकती हैं।',
      crowded: 'आगे भीड़ है।',
      calling1: 'पहले संपर्क को कॉल कर रहे हैं।',
      calling2: 'दूसरे संपर्क को कॉल कर रहे हैं।',
      calling3: 'तीसरे संपर्क को कॉल कर रहे हैं।',
      noAnswer: 'जवाब नहीं मिला।',
      callEnded: 'कॉल पूरे हुए।',
      nobodyAnswered: 'किसी ने जवाब नहीं दिया।',
      callFailed: 'कॉल नहीं हो सका।',
      callingStopped: 'कॉल करना बंद किया।',
      waitingForCall: 'चल रहे कॉल के खत्म होने का इंतज़ार है।',
    },
  },
  ta: {
    tag: 'ta-IN',
    sideFirst: true,
    extra: {
      'traffic light': 'போக்குவரத்து விளக்கு',
      'stop sign': 'நிறுத்த பலகை',
      bench: 'பெஞ்ச்',
      chair: 'நாற்காலி',
      'fire hydrant': 'தீ அணைப்பு குழாய்',
      'potted plant': 'பூந்தொட்டி',
      'dining table': 'மேசை',
      umbrella: 'குடை',
      backpack: 'பை',
      handbag: 'கைப்பை',
      suitcase: 'சூட்கேஸ்',
      bottle: 'பாட்டில்',
      'cell phone': 'போன்',
      cat: 'பூனை',
      horse: 'குதிரை',
      bird: 'பறவை',
      bed: 'படுக்கை',
      toilet: 'கழிப்பறை',
    },
    also: 'மேலும்',
    textSays: 'எழுதியிருப்பது',
    label: {
      person: 'நபர்',
      car: 'கார்',
      motorcycle: 'பைக்',
      bicycle: 'சைக்கிள்',
      bus: 'பேருந்து',
      truck: 'லாரி',
      dog: 'நாய்',
      cow: 'மாடு',
    },
    plural: {
      person: 'நபர்கள்',
      car: 'கார்கள்',
      motorcycle: 'பைக்குகள்',
      bicycle: 'சைக்கிள்கள்',
      bus: 'பேருந்துகள்',
      truck: 'லாரிகள்',
      dog: 'நாய்கள்',
      cow: 'மாடுகள்',
    },
    side: { left: 'இடதுபுறம்', ahead: 'முன்னால்', right: 'வலதுபுறம்' },
    range: { oneStep: 'ஒரு அடி', twoSteps: 'இரண்டு அடி', close: 'அருகில்', metres: '', far: 'தொலைவில்' },
    metres: n => `${n} மீட்டர்`,
    andMore: n => `மேலும் ${n}`,
    guide: { left: 'இடதுபுறம் நகருங்கள்', right: 'வலதுபுறம் நகருங்கள்', stop: 'நில்லுங்கள்' },
    approaching: 'வருகிறது',
    phrase: {
      ready: 'செகண்ட் சைட் தயார்',
      stopped: 'நிறுத்தப்பட்டது',
      nothingAround: 'சுற்றிலும் எதுவும் இல்லை',
      calibrated: 'அளவீடு முடிந்தது',
      noPerson: 'யாரும் தெரியவில்லை',
      setupIntro: 'ஒருமுறை அமைப்பு. குரல்களை நிறுவு என்பதைத் தட்டி, உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்.',
      voicesInstalled: 'இப்போது குரலைச் சோதி என்பதைத் தட்டவும்.',
      voiceTest: 'குரல் வேலை செய்கிறது. அமைப்பு முடிந்தது.',
      setupDone: 'அமைப்பு முடிந்தது. இனி இணையம் தேவையில்லை.',
      sosPrompt:
        'நீங்கள் நலமா? ரத்து செய்ய திரையைத் தட்டவும், இல்லையெனில் பதினைந்து வினாடிகளில் உதவிச் செய்தி அனுப்பப்படும்.',
      sosSent: 'உதவிச் செய்தி அனுப்பப்பட்டது.',
      sosFailed: 'உதவிச் செய்தியை அனுப்ப முடியவில்லை.',
      sosCancelled: 'ரத்து செய்யப்பட்டது.',
      noSosNumber: 'அவசர எண் சேமிக்கப்படவில்லை. அமைப்புகளில் சேர்க்கவும்.',
      cameraFailed: 'கேமரா தொடங்கவில்லை. கேமரா அனுமதியை வழங்கவும்.',
      modelMissing: 'கண்டறிதல் தொடங்கவில்லை. செயலியை மீண்டும் நிறுவவும்.',
      voiceMissing: 'அந்தக் குரல் நிறுவப்படவில்லை. அமைப்புகளில் ஆஃப்லைன் குரல்களை நிறுவவும்.',
      languageName: 'தமிழ்',
      batteryLow: 'பேட்டரி {n} சதவீதம். விரைவில் சார்ஜ் செய்யவும்.',
      batteryCritical: 'பேட்டரி {n} சதவீதம். இப்போதே சார்ஜ் செய்யவும்.',
      cameraBlocked: 'கேமரா மறைக்கப்பட்டுள்ளது. லென்ஸைச் சுத்தம் செய்யவும்.',
      tooDark: 'கேமராவுக்குத் தெரியவில்லை. எச்சரிக்கைகள் தவறலாம்.',
      cameraClear: 'கேமரா தெளிவு.',
      helpPrompt: 'உதவி கேட்கப்படுகிறது. ரத்து செய்ய தட்டவும்.',
      stillPrompt: 'நீங்கள் முப்பது வினாடிகளாக அசையவில்லை. நலமா? ரத்து செய்ய திரையைத் தட்டவும்.',
      callOffer: 'உங்கள் தொடர்புக்கு அழைக்க எங்கும் தட்டவும்.',
      shortcutHelp:
        'இந்தப் பட்டியலில் செகண்ட் சைட்டைத் திறந்து அதன் ஷார்ட்கட்டை இயக்கவும். பிறகு இரண்டு ஒலி பொத்தான்களையும் அழுத்திப் பிடித்தால் செயலி திறக்கும்.',
      detectionSlow: 'கண்டறிதல் மெதுவாக உள்ளது. எச்சரிக்கைகள் தாமதமாகலாம்.',
      crowded: 'முன்னால் கூட்டம்.',
      calling1: 'முதல் தொடர்பை அழைக்கிறோம்.',
      calling2: 'இரண்டாவது தொடர்பை அழைக்கிறோம்.',
      calling3: 'மூன்றாவது தொடர்பை அழைக்கிறோம்.',
      noAnswer: 'பதில் இல்லை.',
      callEnded: 'அழைப்புகள் முடிந்தன.',
      nobodyAnswered: 'யாரும் பதிலளிக்கவில்லை.',
      callFailed: 'அழைக்க முடியவில்லை.',
      callingStopped: 'அழைப்பது நிறுத்தப்பட்டது.',
      waitingForCall: 'தற்போதைய அழைப்பு முடியும் வரை காத்திருக்கிறோம்.',
    },
  },
  kn: {
    tag: 'kn-IN',
    sideFirst: true,
    extra: {
      'traffic light': 'ಟ್ರಾಫಿಕ್ ಲೈಟ್',
      'stop sign': 'ನಿಲ್ಲಿಸಿ ಫಲಕ',
      bench: 'ಬೆಂಚ್',
      chair: 'ಕುರ್ಚಿ',
      'fire hydrant': 'ಅಗ್ನಿಶಾಮಕ ನಲ್ಲಿ',
      'potted plant': 'ಹೂಕುಂಡ',
      'dining table': 'ಮೇಜು',
      umbrella: 'ಛತ್ರಿ',
      backpack: 'ಬ್ಯಾಗ್',
      handbag: 'ಕೈಚೀಲ',
      suitcase: 'ಸೂಟ್‌ಕೇಸ್',
      bottle: 'ಬಾಟಲಿ',
      'cell phone': 'ಫೋನ್',
      cat: 'ಬೆಕ್ಕು',
      horse: 'ಕುದುರೆ',
      bird: 'ಹಕ್ಕಿ',
      bed: 'ಹಾಸಿಗೆ',
      toilet: 'ಶೌಚಾಲಯ',
    },
    also: 'ಜೊತೆಗೆ',
    textSays: 'ಬರೆದಿರುವುದು',
    label: {
      person: 'ವ್ಯಕ್ತಿ',
      car: 'ಕಾರು',
      motorcycle: 'ಬೈಕ್',
      bicycle: 'ಸೈಕಲ್',
      bus: 'ಬಸ್',
      truck: 'ಲಾರಿ',
      dog: 'ನಾಯಿ',
      cow: 'ಹಸು',
    },
    plural: {
      person: 'ಜನರು',
      car: 'ಕಾರುಗಳು',
      motorcycle: 'ಬೈಕ್‌ಗಳು',
      bicycle: 'ಸೈಕಲ್‌ಗಳು',
      bus: 'ಬಸ್‌ಗಳು',
      truck: 'ಲಾರಿಗಳು',
      dog: 'ನಾಯಿಗಳು',
      cow: 'ಹಸುಗಳು',
    },
    side: { left: 'ಎಡಕ್ಕೆ', ahead: 'ಮುಂದೆ', right: 'ಬಲಕ್ಕೆ' },
    range: { oneStep: 'ಒಂದು ಹೆಜ್ಜೆ', twoSteps: 'ಎರಡು ಹೆಜ್ಜೆ', close: 'ಹತ್ತಿರ', metres: '', far: 'ದೂರ' },
    metres: n => `${n} ಮೀಟರ್`,
    andMore: n => `ಇನ್ನೂ ${n}`,
    guide: { left: 'ಎಡಕ್ಕೆ ಸರಿಯಿರಿ', right: 'ಬಲಕ್ಕೆ ಸರಿಯಿರಿ', stop: 'ನಿಲ್ಲಿ' },
    approaching: 'ಬರುತ್ತಿದೆ',
    phrase: {
      ready: 'ಸೆಕೆಂಡ್ ಸೈಟ್ ಸಿದ್ಧ',
      stopped: 'ನಿಲ್ಲಿಸಲಾಗಿದೆ',
      nothingAround: 'ಸುತ್ತಲೂ ಏನೂ ಕಾಣುತ್ತಿಲ್ಲ',
      calibrated: 'ಮಾಪನ ಮುಗಿದಿದೆ',
      noPerson: 'ಯಾರೂ ಕಾಣುತ್ತಿಲ್ಲ',
      setupIntro: 'ಒಂದು ಬಾರಿಯ ಸೆಟಪ್. ಧ್ವನಿಗಳನ್ನು ಸ್ಥಾಪಿಸಿ ಒತ್ತಿ, ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.',
      voicesInstalled: 'ಈಗ ಧ್ವನಿ ಪರೀಕ್ಷಿಸಿ ಒತ್ತಿ.',
      voiceTest: 'ಧ್ವನಿ ಕೆಲಸ ಮಾಡುತ್ತಿದೆ. ಸೆಟಪ್ ಮುಗಿದಿದೆ.',
      setupDone: 'ಸೆಟಪ್ ಮುಗಿದಿದೆ. ಇನ್ನು ಇಂಟರ್ನೆಟ್ ಬೇಕಿಲ್ಲ.',
      sosPrompt:
        'ನೀವು ಚೆನ್ನಾಗಿದ್ದೀರಾ? ರದ್ದುಮಾಡಲು ಪರದೆಯನ್ನು ಒತ್ತಿ, ಇಲ್ಲದಿದ್ದರೆ ಹದಿನೈದು ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಸಹಾಯ ಸಂದೇಶ ಹೋಗುತ್ತದೆ.',
      sosSent: 'ಸಹಾಯ ಸಂದೇಶ ಕಳುಹಿಸಲಾಗಿದೆ.',
      sosFailed: 'ಸಹಾಯ ಸಂದೇಶ ಕಳುಹಿಸಲು ಆಗಲಿಲ್ಲ.',
      sosCancelled: 'ರದ್ದುಮಾಡಲಾಗಿದೆ.',
      noSosNumber: 'ತುರ್ತು ಸಂಖ್ಯೆ ಉಳಿಸಿಲ್ಲ. ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ ಸೇರಿಸಿ.',
      cameraFailed: 'ಕ್ಯಾಮೆರಾ ಶುರುವಾಗಲಿಲ್ಲ. ಕ್ಯಾಮೆರಾ ಅನುಮತಿ ನೀಡಿ.',
      modelMissing: 'ಪತ್ತೆ ಶುರುವಾಗಲಿಲ್ಲ. ಆ್ಯಪ್ ಮತ್ತೆ ಸ್ಥಾಪಿಸಿ.',
      voiceMissing: 'ಆ ಧ್ವನಿ ಸ್ಥಾಪಿಸಿಲ್ಲ. ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ ಆಫ್‌ಲೈನ್ ಧ್ವನಿಗಳನ್ನು ಸ್ಥಾಪಿಸಿ.',
      languageName: 'ಕನ್ನಡ',
      batteryLow: 'ಬ್ಯಾಟರಿ {n} ಶೇಕಡಾ. ಬೇಗ ಚಾರ್ಜ್ ಮಾಡಿ.',
      batteryCritical: 'ಬ್ಯಾಟರಿ {n} ಶೇಕಡಾ. ಈಗಲೇ ಚಾರ್ಜ್ ಮಾಡಿ.',
      cameraBlocked: 'ಕ್ಯಾಮೆರಾ ಮುಚ್ಚಿದೆ. ಲೆನ್ಸ್ ಸ್ವಚ್ಛಗೊಳಿಸಿ.',
      tooDark: 'ಕ್ಯಾಮೆರಾಗೆ ಕಾಣುತ್ತಿಲ್ಲ. ಎಚ್ಚರಿಕೆಗಳು ತಪ್ಪಬಹುದು.',
      cameraClear: 'ಕ್ಯಾಮೆರಾ ಸ್ಪಷ್ಟ.',
      helpPrompt: 'ಸಹಾಯ ಕೇಳಲಾಗುತ್ತಿದೆ. ರದ್ದುಮಾಡಲು ಒತ್ತಿ.',
      stillPrompt: 'ನೀವು ಮೂವತ್ತು ಸೆಕೆಂಡುಗಳಿಂದ ಅಲುಗಾಡಿಲ್ಲ. ಚೆನ್ನಾಗಿದ್ದೀರಾ? ರದ್ದುಮಾಡಲು ಪರದೆಯನ್ನು ಒತ್ತಿ.',
      callOffer: 'ನಿಮ್ಮ ಸಂಪರ್ಕಕ್ಕೆ ಕರೆ ಮಾಡಲು ಎಲ್ಲಿಯಾದರೂ ಒತ್ತಿ.',
      shortcutHelp:
        'ಈ ಪಟ್ಟಿಯಲ್ಲಿ ಸೆಕೆಂಡ್ ಸೈಟ್ ತೆರೆದು ಅದರ ಶಾರ್ಟ್‌ಕಟ್ ಆನ್ ಮಾಡಿ. ನಂತರ ಎರಡೂ ವಾಲ್ಯೂಮ್ ಬಟನ್ ಒತ್ತಿ ಹಿಡಿದರೆ ಆ್ಯಪ್ ತೆರೆಯುತ್ತದೆ.',
      detectionSlow: 'ಪತ್ತೆ ನಿಧಾನವಾಗಿದೆ. ಎಚ್ಚರಿಕೆಗಳು ತಡವಾಗಬಹುದು.',
      crowded: 'ಮುಂದೆ ಜನಸಂದಣಿ.',
      calling1: 'ಮೊದಲ ಸಂಪರ್ಕಕ್ಕೆ ಕರೆ ಮಾಡುತ್ತಿದ್ದೇವೆ.',
      calling2: 'ಎರಡನೇ ಸಂಪರ್ಕಕ್ಕೆ ಕರೆ ಮಾಡುತ್ತಿದ್ದೇವೆ.',
      calling3: 'ಮೂರನೇ ಸಂಪರ್ಕಕ್ಕೆ ಕರೆ ಮಾಡುತ್ತಿದ್ದೇವೆ.',
      noAnswer: 'ಉತ್ತರವಿಲ್ಲ.',
      callEnded: 'ಕರೆಗಳು ಮುಗಿದಿವೆ.',
      nobodyAnswered: 'ಯಾರೂ ಉತ್ತರಿಸಲಿಲ್ಲ.',
      callFailed: 'ಕರೆ ಮಾಡಲು ಆಗಲಿಲ್ಲ.',
      callingStopped: 'ಕರೆ ಮಾಡುವುದನ್ನು ನಿಲ್ಲಿಸಲಾಗಿದೆ.',
      waitingForCall: 'ಈಗಿನ ಕರೆ ಮುಗಿಯುವವರೆಗೆ ಕಾಯುತ್ತಿದ್ದೇವೆ.',
    },
  },
}

// Steps when near (a cane user counts steps), whole metres rounded DOWN beyond, so an error is always on the safe side.
export function rangeOf(metres: number): Range {
  // Boundaries are inclusive downward: exactly 3.0 m is "two steps". When in doubt, say nearer.
  return metres <= 1.5 ? 'oneStep' : metres <= 3 ? 'twoSteps' : metres < 5 ? 'close' : metres < 20 ? 'metres' : 'far'
}
export function bucketIndex(metres: number): number {
  const r = rangeOf(metres)
  return r === 'metres'
    ? 10 + Math.floor(metres)
    : ['oneStep', 'twoSteps', 'close'].indexOf(r) >= 0
      ? ['oneStep', 'twoSteps', 'close'].indexOf(r)
      : 99
}
function rangeWords(metres: number, lang: Lang): string {
  const w = WORDS[lang]
  const r = rangeOf(metres)
  return r === 'metres' ? w.metres(Math.floor(metres)) : w.range[r]
}

// Motion first, then where, then how far. Under 1.5 s to say. Telugu keeps side first.
export function sentence(t: Target, lang: Lang): string {
  const w = WORDS[lang]
  const range = rangeWords(t.distance, lang)
  if (w.sideFirst)
    return t.approaching
      ? `${w.side[t.side]} ${w.label[t.label]} ${w.approaching}, ${range}`
      : `${w.side[t.side]} ${w.label[t.label]}, ${range}`
  return t.approaching
    ? `${w.label[t.label]} ${w.approaching}, ${w.side[t.side]}, ${range}`
    : `${w.label[t.label]} ${w.side[t.side]}, ${range}`
}

// Asked-for summary: groups by object and side with the nearest range, at most three groups, "and N more" for the rest.
export function scanSentence(targets: Target[], lang: Lang): string {
  const w = WORDS[lang]
  if (targets.length === 0) return w.phrase.nothingAround
  const groups = new Map<string, { t: Target; n: number }>()
  for (const t of [...targets].sort((a, b) => a.distance - b.distance)) {
    const key = `${t.label}:${t.side}`
    const g = groups.get(key)
    if (g) g.n++
    else groups.set(key, { t, n: 1 })
  }
  const all = [...groups.values()]
  const shown = all.slice(0, 3)
  const rest = all.slice(3).reduce((n, g) => n + g.n, 0)
  const parts = shown.map(({ t, n }) => {
    const noun = n > 1 ? `${n} ${w.plural[t.label]}` : w.label[t.label]
    const range = rangeWords(t.distance, lang)
    return w.sideFirst ? `${w.side[t.side]} ${noun}, ${range}` : `${noun} ${w.side[t.side]}, ${range}`
  })
  if (rest > 0) parts.push(w.andMore(rest))
  return parts.join('. ')
}

// "What is around me": the warning objects with where and how far, other things by name, then any readable text.
export function describeSentence(targets: Target[], extras: ExtraClass[], text: string | null, lang: Lang): string {
  const w = WORDS[lang]
  const objects = targets.length ? scanSentence(targets, lang) : ''
  const names = extras.map(e => w.extra[e]).join(', ')
  const others = names ? (objects ? `${w.also}: ${names}` : names) : ''
  const reading = text ? `${w.textSays}: ${text}` : ''
  const parts = [objects, others, reading].filter(Boolean)
  return parts.length ? parts.join('. ') : w.phrase.nothingAround
}

// Which of the translated languages this phone can speak offline right now. English is always offered.
export async function installedLangs(): Promise<Lang[]> {
  const found: Lang[] = []
  for (const l of LANGS) {
    if (l === 'en') {
      found.push(l)
      continue
    }
    try {
      if (Capacitor.isNativePlatform()) {
        if ((await TextToSpeech.isLanguageSupported({ lang: WORDS[l].tag })).supported) found.push(l)
      } else if (speechSynthesis.getVoices().some(v => v.lang.toLowerCase().startsWith(l))) found.push(l)
    } catch {
      /* engine not ready: leave it out */
    }
  }
  return found
}

export function phrase(key: Phrase, lang: Lang): string {
  return WORDS[lang].phrase[key]
}

// One mouth: a sentence always finishes. While it plays, only the newest request is kept and spoken next.
let busy = false
let pending: { text: string; lang: Lang; at: number; key?: string } | null = null
const PENDING_TTL_MS = 1500 // a sentence that waited longer describes a street that no longer exists
let currentKey: string | null = null
// The detection loop reports what is in front of the lens right now; a queued warning about something else is dropped.
export function setCurrentTarget(key: string | null) {
  currentKey = key
}

let onVoiceFailure: ((lang: Lang, text: string) => void) | null = null
// The app decides what happens when a language's voice cannot speak (see App.tsx). It gets the sentence that was lost.
export function setVoiceFailureHandler(handler: ((lang: Lang, text: string) => void) | null) {
  onVoiceFailure = handler
}

// Generous upper bound on how long a sentence takes to say: words at 2.6 per second plus engine start-up.
function speakingTimeMs(text: string): number {
  return (text.split(/\s+/).length / 2.6) * 1000 + 1200
}

export async function stopSpeaking(): Promise<void> {
  if (Capacitor.isNativePlatform()) await TextToSpeech.stop().catch(() => undefined)
  else speechSynthesis.cancel()
}

async function speakRaw(text: string, lang: Lang): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      // Android never settles a sentence that was stopped mid-way. The guard settles it anyway, so nothing that
      // waits on speech (the queue, the SOS countdown) can hang forever.
      await Promise.race([
        TextToSpeech.speak({ text, lang: WORDS[lang].tag, rate: 1.0, category: 'ambient' }),
        new Promise<void>(resolve => window.setTimeout(resolve, speakingTimeMs(text))),
      ])
    } catch (err) {
      // A missing voice must not mean silence. Only "not supported" means missing; other errors are transient.
      const message = err instanceof Error ? err.message : String(err)
      if (lang !== 'en' && /not supported/i.test(message)) onVoiceFailure?.(lang, text)
    }
    return
  }
  // Browser fallback for the Mac and the phone's Chrome; the WebView has no speechSynthesis.
  await new Promise<void>(resolve => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = WORDS[lang].tag
    const guard = window.setTimeout(resolve, speakingTimeMs(text)) // headless engines never fire onend
    u.onend = u.onerror = () => {
      clearTimeout(guard)
      resolve()
    }
    speechSynthesis.speak(u)
  })
}

// Routine sentences wait their turn. An urgent one (something moving, or within two steps) cuts in at once.
// Resolves true when the sentence was spoken to the end, false when it had to wait or was cut off.
let generation = 0
export async function speak(text: string, lang: Lang, urgent = false, key?: string): Promise<boolean> {
  if (busy && !urgent) {
    pending = { text, lang, at: performance.now(), key }
    return false
  }
  if (busy) {
    generation++
    pending = null
    await stopSpeaking()
  }
  const mine = ++generation
  busy = true
  let heard = false
  try {
    await speakRaw(text, lang)
  } finally {
    heard = mine === generation
    if (heard) {
      busy = false
      const next = pending
      pending = null
      const fresh = next && performance.now() - next.at < PENDING_TTL_MS && (!next.key || next.key === currentKey)
      if (next && fresh) void speak(next.text, next.lang)
    }
  }
  return heard
}
export function isSpeaking(): boolean {
  return busy
}

// For what the user must hear now: the answer to their own tap, a failure, the fall alert. It cuts in on whatever is
// being said. A routine sentence that has to wait is dropped after 1.5 s; these must never be dropped.
export function announce(key: Phrase, lang: Lang): void {
  void speak(phrase(key, lang), lang, true)
}

// What was last announced per object kind, so a static thing is not repeated every few seconds.
const announced = new Map<string, { side: string; bucket: number; tier: number; t: number; distance: number }>()
let paused = false
let lastSpokenAt = -1e9
export function pauseWarnings(on: boolean) {
  paused = on
  if (on) announced.clear()
}

// Threat tier: 0 static and far, 1 moving beyond 5 m, 2 within 5 m, 3 within two steps, 4 one step.
function tierOf(t: Target): number {
  return t.distance <= 1.5 ? 4 : t.distance <= 3 ? 3 : t.distance < 5 ? 2 : t.approaching ? 1 : 0
}

// Interrupt the voice only for a jump to within two steps, or something that was far/static and is suddenly moving close.
// Otherwise sentences wait their turn: a side change after 1.5 s, a moving object every 2.5 s,
// a static one only if it gets a bucket closer or after 10 s.
export function warn(t: Target, lang: Lang, now: number): string | null {
  if (paused) return null
  const bucket = bucketIndex(t.distance)
  const tier = tierOf(t)
  const prev = announced.get(t.label)
  const escalated = prev ? tier > prev.tier : tier >= 2
  // The same object re-spoken within a second needs a real change: a different side or at least 1 m nearer.
  if (prev && escalated && now - prev.t < 1000 && prev.side === t.side && prev.distance - t.distance < 1) return null
  const urgent = escalated && (tier >= 3 || (tier === 2 && t.approaching && (!prev || prev.tier === 0)))
  const due =
    !prev ||
    escalated ||
    (prev.side !== t.side && now - prev.t >= 1500) ||
    (t.approaching ? now - prev.t >= 2500 : bucket < prev.bucket || now - prev.t > 10000)
  if (!due) return null
  if (busy && !urgent) return null
  // Never two sentences within a second unless something is at one step; that is what "right… left" flapping sounds like.
  if (now - lastSpokenAt < 1000 && tier < 4) return null
  lastSpokenAt = now
  announced.set(t.label, { side: t.side, bucket, tier, t: now, distance: t.distance })
  const text = sentence(t, lang)
  void speak(text, lang, urgent, `${t.label}:${t.side}`)
  if (t.distance < 3) navigator.vibrate?.(200)
  return text
}
