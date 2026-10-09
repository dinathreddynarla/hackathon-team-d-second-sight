import type { Lang } from '../speech/speech'

// Indian road-sign model: YOLOv8n trained on the IRTSD dataset (Signalyze, irtsd-nano), 37 classes, int8 ONNX.
// Its training used horizontal flips, so it cannot tell mirrored signs apart: left/right pairs are spoken without a side.
export const SIGN_CLASSES = [
  'Crossroad',
  'Cycle Prohibited',
  'Gap in the Median',
  'Give Way',
  'Go Slow',
  'Horn Prohibited',
  'Hospital',
  'Keep Left',
  'Left turn',
  'Men at Work',
  'No Entry',
  'No Left Turn',
  'No Overtaking',
  'No Parking',
  'No Right Turn',
  'No Stopping',
  'Parking',
  'Pedestrian Crossing',
  'Right Turn',
  'Roundabout',
  'School Ahead',
  'Side Road Left',
  'Side Road Right',
  'Speed Breaker',
  'Speed Limit 20',
  'Speed Limit 30',
  'Speed Limit 40',
  'Speed Limit 50',
  'Speed Limit 60',
  'Speed Limit 80',
  'Stop',
  'T Intersection',
  'Traffic Signal Ahead',
  'U-Turn Prohibited',
  'U-turn',
  'Y Intersection',
  'Zigzag Road',
] as const

type Group =
  | 'crossroad'
  | 'noCycles'
  | 'medianGap'
  | 'giveWay'
  | 'goSlow'
  | 'noHorn'
  | 'hospital'
  | 'keepLeft'
  | 'turnAhead'
  | 'menAtWork'
  | 'noEntry'
  | 'noTurn'
  | 'noOvertaking'
  | 'noParking'
  | 'noStopping'
  | 'parking'
  | 'pedestrianCrossing'
  | 'roundabout'
  | 'schoolAhead'
  | 'sideRoad'
  | 'speedBreaker'
  | 'speedLimit'
  | 'stop'
  | 'tJunction'
  | 'signalAhead'
  | 'noUTurn'
  | 'uTurn'
  | 'yJunction'
  | 'zigzag'

const GROUP: Record<(typeof SIGN_CLASSES)[number], Group> = {
  Crossroad: 'crossroad',
  'Cycle Prohibited': 'noCycles',
  'Gap in the Median': 'medianGap',
  'Give Way': 'giveWay',
  'Go Slow': 'goSlow',
  'Horn Prohibited': 'noHorn',
  Hospital: 'hospital',
  'Keep Left': 'keepLeft',
  'Left turn': 'turnAhead',
  'Right Turn': 'turnAhead',
  'Men at Work': 'menAtWork',
  'No Entry': 'noEntry',
  'No Left Turn': 'noTurn',
  'No Right Turn': 'noTurn',
  'No Overtaking': 'noOvertaking',
  'No Parking': 'noParking',
  'No Stopping': 'noStopping',
  Parking: 'parking',
  'Pedestrian Crossing': 'pedestrianCrossing',
  Roundabout: 'roundabout',
  'School Ahead': 'schoolAhead',
  'Side Road Left': 'sideRoad',
  'Side Road Right': 'sideRoad',
  'Speed Breaker': 'speedBreaker',
  'Speed Limit 20': 'speedLimit',
  'Speed Limit 30': 'speedLimit',
  'Speed Limit 40': 'speedLimit',
  'Speed Limit 50': 'speedLimit',
  'Speed Limit 60': 'speedLimit',
  'Speed Limit 80': 'speedLimit',
  Stop: 'stop',
  'T Intersection': 'tJunction',
  'Traffic Signal Ahead': 'signalAhead',
  'U-Turn Prohibited': 'noUTurn',
  'U-turn': 'uTurn',
  'Y Intersection': 'yJunction',
  'Zigzag Road': 'zigzag',
}

type Names = { sign: string; speedLimit: (n: string) => string } & Record<Exclude<Group, 'speedLimit'>, string>

const NAMES: Record<Lang, Names> = {
  en: {
    sign: 'Sign',
    speedLimit: n => `speed limit ${n}`,
    crossroad: 'crossroad',
    noCycles: 'no cycles',
    medianGap: 'gap in the median',
    giveWay: 'give way',
    goSlow: 'go slow',
    noHorn: 'no horn',
    hospital: 'hospital',
    keepLeft: 'keep left',
    turnAhead: 'turn ahead',
    menAtWork: 'men at work',
    noEntry: 'no entry',
    noTurn: 'no turning',
    noOvertaking: 'no overtaking',
    noParking: 'no parking',
    noStopping: 'no stopping',
    parking: 'parking',
    pedestrianCrossing: 'pedestrian crossing',
    roundabout: 'roundabout',
    schoolAhead: 'school ahead',
    sideRoad: 'side road',
    speedBreaker: 'speed breaker',
    stop: 'stop',
    tJunction: 'T junction',
    signalAhead: 'traffic signal ahead',
    noUTurn: 'no U-turn',
    uTurn: 'U-turn',
    yJunction: 'Y junction',
    zigzag: 'zigzag road',
  },
  te: {
    sign: 'బోర్డు',
    speedLimit: n => `వేగ పరిమితి ${n}`,
    crossroad: 'కూడలి',
    noCycles: 'సైకిళ్ళు నిషేధం',
    medianGap: 'డివైడర్ గ్యాప్',
    giveWay: 'దారి ఇవ్వండి',
    goSlow: 'నెమ్మదిగా వెళ్ళండి',
    noHorn: 'హారన్ నిషేధం',
    hospital: 'ఆసుపత్రి',
    keepLeft: 'ఎడమవైపు ఉండండి',
    turnAhead: 'ముందు మలుపు',
    menAtWork: 'పని జరుగుతోంది',
    noEntry: 'ప్రవేశం లేదు',
    noTurn: 'మలుపు నిషేధం',
    noOvertaking: 'ఓవర్‌టేకింగ్ నిషేధం',
    noParking: 'పార్కింగ్ నిషేధం',
    noStopping: 'ఆపడం నిషేధం',
    parking: 'పార్కింగ్',
    pedestrianCrossing: 'పాదచారుల క్రాసింగ్',
    roundabout: 'రౌండ్అబౌట్',
    schoolAhead: 'ముందు పాఠశాల',
    sideRoad: 'పక్క రోడ్డు',
    speedBreaker: 'స్పీడ్ బ్రేకర్',
    stop: 'ఆగండి',
    tJunction: 'T కూడలి',
    signalAhead: 'ముందు ట్రాఫిక్ సిగ్నల్',
    noUTurn: 'U టర్న్ నిషేధం',
    uTurn: 'U టర్న్',
    yJunction: 'Y కూడలి',
    zigzag: 'వంకర రోడ్డు',
  },
  hi: {
    sign: 'संकेत',
    speedLimit: n => `गति सीमा ${n}`,
    crossroad: 'चौराहा',
    noCycles: 'साइकिल निषेध',
    medianGap: 'डिवाइडर में गैप',
    giveWay: 'रास्ता दें',
    goSlow: 'धीरे चलें',
    noHorn: 'हॉर्न निषेध',
    hospital: 'अस्पताल',
    keepLeft: 'बाएँ चलें',
    turnAhead: 'आगे मोड़',
    menAtWork: 'काम चालू है',
    noEntry: 'प्रवेश निषेध',
    noTurn: 'मुड़ना मना',
    noOvertaking: 'ओवरटेक मना',
    noParking: 'पार्किंग मना',
    noStopping: 'रुकना मना',
    parking: 'पार्किंग',
    pedestrianCrossing: 'पैदल पार पथ',
    roundabout: 'गोल चक्कर',
    schoolAhead: 'आगे स्कूल',
    sideRoad: 'साइड रोड',
    speedBreaker: 'स्पीड ब्रेकर',
    stop: 'रुकें',
    tJunction: 'टी चौराहा',
    signalAhead: 'आगे ट्रैफ़िक सिग्नल',
    noUTurn: 'यू टर्न मना',
    uTurn: 'यू टर्न',
    yJunction: 'वाई चौराहा',
    zigzag: 'घुमावदार सड़क',
  },
  ta: {
    sign: 'அடையாளப் பலகை',
    speedLimit: n => `வேக வரம்பு ${n}`,
    crossroad: 'சந்திப்பு',
    noCycles: 'சைக்கிள் தடை',
    medianGap: 'நடுத்தடுப்பு இடைவெளி',
    giveWay: 'வழி விடுங்கள்',
    goSlow: 'மெதுவாகச் செல்லுங்கள்',
    noHorn: 'ஹாரன் தடை',
    hospital: 'மருத்துவமனை',
    keepLeft: 'இடதுபுறம் செல்லுங்கள்',
    turnAhead: 'முன்னால் திருப்பம்',
    menAtWork: 'வேலை நடக்கிறது',
    noEntry: 'நுழைவு இல்லை',
    noTurn: 'திருப்பத் தடை',
    noOvertaking: 'முந்திச் செல்லத் தடை',
    noParking: 'நிறுத்தத் தடை',
    noStopping: 'நிற்கத் தடை',
    parking: 'வாகன நிறுத்தம்',
    pedestrianCrossing: 'பாதசாரி கடவை',
    roundabout: 'சுற்றுவட்டம்',
    schoolAhead: 'முன்னால் பள்ளி',
    sideRoad: 'பக்கச் சாலை',
    speedBreaker: 'வேகத்தடை',
    stop: 'நில்லுங்கள்',
    tJunction: 'டி சந்திப்பு',
    signalAhead: 'முன்னால் போக்குவரத்து விளக்கு',
    noUTurn: 'யு டர்ன் தடை',
    uTurn: 'யு டர்ன்',
    yJunction: 'ஒய் சந்திப்பு',
    zigzag: 'வளைவுச் சாலை',
  },
  kn: {
    sign: 'ಫಲಕ',
    speedLimit: n => `ವೇಗ ಮಿತಿ ${n}`,
    crossroad: 'ಕೂಡುರಸ್ತೆ',
    noCycles: 'ಸೈಕಲ್ ನಿಷೇಧ',
    medianGap: 'ಡಿವೈಡರ್ ಅಂತರ',
    giveWay: 'ದಾರಿ ಬಿಡಿ',
    goSlow: 'ನಿಧಾನವಾಗಿ ಹೋಗಿ',
    noHorn: 'ಹಾರನ್ ನಿಷೇಧ',
    hospital: 'ಆಸ್ಪತ್ರೆ',
    keepLeft: 'ಎಡಕ್ಕೆ ಇರಿ',
    turnAhead: 'ಮುಂದೆ ತಿರುವು',
    menAtWork: 'ಕೆಲಸ ನಡೆಯುತ್ತಿದೆ',
    noEntry: 'ಪ್ರವೇಶವಿಲ್ಲ',
    noTurn: 'ತಿರುವು ನಿಷೇಧ',
    noOvertaking: 'ಓವರ್‌ಟೇಕ್ ನಿಷೇಧ',
    noParking: 'ಪಾರ್ಕಿಂಗ್ ನಿಷೇಧ',
    noStopping: 'ನಿಲ್ಲಿಸುವುದು ನಿಷೇಧ',
    parking: 'ಪಾರ್ಕಿಂಗ್',
    pedestrianCrossing: 'ಪಾದಚಾರಿ ದಾಟುವಿಕೆ',
    roundabout: 'ವೃತ್ತ',
    schoolAhead: 'ಮುಂದೆ ಶಾಲೆ',
    sideRoad: 'ಪಕ್ಕದ ರಸ್ತೆ',
    speedBreaker: 'ಸ್ಪೀಡ್ ಬ್ರೇಕರ್',
    stop: 'ನಿಲ್ಲಿ',
    tJunction: 'ಟಿ ಜಂಕ್ಷನ್',
    signalAhead: 'ಮುಂದೆ ಟ್ರಾಫಿಕ್ ಸಿಗ್ನಲ್',
    noUTurn: 'ಯು ಟರ್ನ್ ನಿಷೇಧ',
    uTurn: 'ಯು ಟರ್ನ್',
    yJunction: 'ವೈ ಜಂಕ್ಷನ್',
    zigzag: 'ಅಂಕುಡೊಂಕು ರಸ್ತೆ',
  },
}

// The spoken key for a detected class: speed limits keep their number, mirror pairs share one key.
export function signKey(cls: number): string {
  const name = SIGN_CLASSES[cls] ?? ''
  const g = GROUP[name as (typeof SIGN_CLASSES)[number]]
  return g === 'speedLimit' ? `speedLimit:${name.replace(/\D/g, '')}` : (g ?? '')
}

export function signSentence(key: string, lang: Lang): string {
  const w = NAMES[lang]
  const [g, n] = key.split(':') as [Group, string | undefined]
  const name = g === 'speedLimit' ? w.speedLimit(n ?? '') : w[g]
  return `${w.sign}: ${name}`
}
