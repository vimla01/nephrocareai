import React, { useState, useEffect, useRef } from 'react'
import { Icon } from '../components/Icon'
import { API_BASE_URL } from '../constants'
import { Page, PredictionForm } from '../types'

type Message = {
  role: 'user' | 'assistant'
  content: string
  assessment?: string
  explanation?: string
  educational_information?: string
  kidney_specific_guidance?: string
  questions_for_nephrologist?: string[]
  references?: string[]
  emergency_detected?: boolean
  timestamp: string
}

interface ChatbotPageProps {
  showPage: (page: Page) => void
  user: { name: string; email: string } | null
  form: PredictionForm
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'ta', name: 'Tamil (தமிழ்)' },
  { code: 'te', name: 'Telugu (తెలుగు)' },
  { code: 'kn', name: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml', name: 'Malayalam (മലയാളം)' },
  { code: 'mr', name: 'Marathi (मराठी)' },
  { code: 'gu', name: 'Gujarati (ગુજરાતી)' },
  { code: 'bn', name: 'Bengali (বাংলা)' },
  { code: 'pa', name: 'Punjabi (ਪੰਜਾਬಿ)' },
  { code: 'ur', name: 'Urdu (اردو)' }
]

const QUICK_REPLIES_MAP: Record<string, string[]> = {
  en: ["What foods should I avoid with high potassium?", "What is the normal range of eGFR?", "What does Stage 3 CKD mean?", "Can I take ibuprofen with kidney issues?"],
  hi: ["उच्च पोटेशियम में कौन से खाद्य पदार्थ नहीं खाने चाहिए?", "eGFR की सामान्य सीमा क्या है?", "CKD स्टेज 3 का क्या मतलब है?", "किडनी की बीमारी में ibuprofen ले सकते हैं?"],
  ta: ["அதிக பொட்டாசியம் உணவில் என்ன தவிர்க்கணும்?", "eGFR இன் சாதாரண அளவு என்ன?", "CKD நிலை 3 என்றால் என்ன?", "சிறுநீரக பிரச்சினையில் ibuprofen எடுக்கலாமா?"],
  te: ["అధిక పొటాషియంలో ఏ ఆహారాలు మానాలి?", "eGFR యొక్క సాధారణ పరిధి ఏమిటి?", "CKD దశ 3 అంటే ఏమిటి?", "మూత్రపిండ సమస్యలో ibuprofen తీసుకోవచ్చా?"],
  kn: ["ಹೆಚ್ಚಿನ ಪೊಟ್ಯಾಸಿಯಂನಲ್ಲಿ ಯಾವ ಆಹಾರ ತಪ್ಪಿಸಬೇಕು?", "eGFR ಸಾಮಾನ್ಯ ವ್ಯಾಪ್ತಿ ಏನು?", "CKD ಹಂತ 3 ಎಂದರೆ ಏನು?", "ಮೂತ್ರಪಿಂಡ ಸಮಸ್ಯೆಯಲ್ಲಿ ibuprofen ತೆಗೆದುಕೊಳ್ಳಬಹುದೇ?"],
  ml: ["ഉയർന്ന പൊട്ടാസ്യത്തിൽ ഏതു ഭക്ഷണം ഒഴിവാക്കണം?", "eGFR-ന്റെ സാധാരണ ശ്രേണി എത്രയാണ്?", "CKD ഘട്ടം 3 എന്നാൽ എന്ത്?", "വൃക്ക പ്രശ്നങ്ങളിൽ ibuprofen കഴിക്കാമോ?"],
  mr: ["उच्च पोटॅशियममध्ये कोणते अन्न टाळावे?", "eGFR ची सामान्य श्रेणी काय आहे?", "CKD टप्पा 3 म्हणजे काय?", "मूत्रपिंडाच्या समस्येत ibuprofen घेता येतो का?"],
  gu: ["ઉચ્ચ પોટેશિયમ સાથે ક્યા ખોરાક ટાળવા?", "eGFR ની સામાન્ય શ્રેણી શું છે?", "CKD સ્ટેજ 3 નો અર્થ શું?", "કિડની સમસ્યામાં ibuprofen લઈ શકાય?"],
  bn: ["উচ্চ পটাশিয়ামে কোন খাবার এড়ানো উচিত?", "eGFR এর স্বাভাবিক পরিসীমা কত?", "CKD স্টেজ 3 মানে কী?", "কিডনির সমস্যায় ibuprofen নিতে পারি?"],
  pa: ["ਉੱਚ ਪੋਟਾਸ਼ੀਅਮ ਵਿੱਚ ਕਿਹੜਾ ਖਾਣਾ ਛੱਡਣਾ ਚਾਹੀਦਾ?", "eGFR ਦੀ ਸਧਾਰਨ ਸੀਮਾ ਕੀ ਹੈ?", "CKD ਪੜਾਅ 3 ਦਾ ਕੀ ਅਰਥ ਹੈ?", "ਗੁਰਦੇ ਦੀ ਸਮੱਸਿਆ ਵਿੱਚ ibuprofen ਲੈ ਸਕਦੇ ਹਾਂ?"],
  ur: ["زیادہ پوٹاشیم میں کون سی غذائیں چھوڑیں؟", "eGFR کی معمول کی حد کیا ہے؟", "CKD مرحلہ 3 کا مطلب کیا ہے؟", "گردے کی تکلیف میں ibuprofen لے سکتے ہیں؟"],
}

const WELCOME_MESSAGES: Record<string, string> = {
  en: `Hello {name}! I am your AI Nephrology Assistant. I can explain kidney functions, KDIGO guidelines, evaluate lab results, check drug safety, and answer your kidney-health questions. How can I support you today?`,
  hi: `नमस्ते {name}! मैं आपका AI नेफ्रोलॉजी सहायक हूँ। मैं गुर्दे के कार्य, KDIGO दिशानिर्देश, लैब रिपोर्ट विश्लेषण, दवाओं की सुरक्षा जाँच, और आपके गुर्दे से जुड़े सवालों का जवाब दे सकता हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?`,
  ta: `வணக்கம் {name}! நான் உங்கள் AI நெஃப்ரோலஜி உதவியாளர். சிறுநீரக செயல்பாடு, KDIGO வழிகாட்டுதல்கள், ஆய்வக முடிவுகள், மருந்து பாதுகாப்பு ஆகியவற்றை விளக்க முடியும். இன்று உங்களுக்கு எப்படி உதவலாம்?`,
  te: `నమస్కారం {name}! నేను మీ AI నెఫ్రాలజీ సహాయకుడిని. మూత్రపిండ క్రియలు, KDIGO మార్గదర్శకాలు, ల్యాబ్ నివేదికలు, ఔషధ భద్రత వివరించగలను. ఈరోజు మీకు ఎలా సహాయం చేయగలను?`,
  kn: `ನಮಸ್ಕಾರ {name}! ನಾನು ನಿಮ್ಮ AI ನೆಫ್ರಾಲಜಿ ಸಹಾಯಕ. ಮೂತ್ರಪಿಂಡ ಕಾರ್ಯಗಳು, KDIGO ಮಾರ್ಗಸೂಚಿಗಳು, ಲ್ಯಾಬ್ ವರದಿ, ಔಷಧ ಸುರಕ್ಷತೆ ವಿವರಿಸಬಲ್ಲೆ. ಇಂದು ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?`,
  ml: `നമസ്കാരം {name}! ഞാൻ നിങ്ങളുടെ AI നെഫ്രോളജി സഹായകൻ. വൃക്ക പ്രവർത്തനം, KDIGO മാർഗ്ഗനിർദ്ദേശങ്ങൾ, ലാബ് ഫലങ്ങൾ, മരുന്ന് സുരക്ഷ വിശദീകരിക്കാൻ കഴിയും. ഇന്ന് ഞാൻ എങ്ങനെ സഹായിക്കട്ടെ?`,
  mr: `नमस्कार {name}! मी तुमचा AI नेफ्रोलॉजी सहाय्यक आहे. मूत्रपिंडाचे कार्य, KDIGO मार्गदर्शक तत्त्वे, लॅब निकाल, औषधांची सुरक्षितता सांगू शकतो. आज मी तुमची कशी मदत करू?`,
  gu: `નમસ્તે {name}! હું તમારો AI નેફ્રોલૉજી સહાયક છું. કિડની કાર્ય, KDIGO માર્ગદર્શિકા, લૅબ રિપોર્ટ, દવા સુરક્ષા સમજાવી શકું છું. આજે હું કેવી મદદ કરી શકું?`,
  bn: `নমস্কার {name}! আমি আপনার AI নেফ্রোলজি সহায়ক। কিডনির কার্যকারিতা, KDIGO গাইডলাইন, ল্যাব রিপোর্ট, ওষুধ সুরক্ষা ব্যাখ্যা করতে পারি। আজ কীভাবে সাহায্য করব?`,
  pa: `ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ {name}! ਮੈਂ ਤੁਹਾਡਾ AI ਨੇਫ੍ਰੋਲੋਜੀ ਸਹਾਇਕ ਹਾਂ। ਗੁਰਦੇ ਦੇ ਕੰਮ, KDIGO ਦਿਸ਼ਾ-ਨਿਰਦੇਸ਼, ਲੈਬ ਨਤੀਜੇ ਅਤੇ ਦਵਾਈ ਸੁਰੱਖਿਆ ਦੱਸ ਸਕਦਾ ਹਾਂ। ਅੱਜ ਕਿਵੇਂ ਮਦਦ ਕਰਾਂ?`,
  ur: `السلام علیکم {name}! میں آپ کا AI نیفرولوجی معاون ہوں۔ گردے کے افعال، KDIGO رہنما اصول، لیب رپورٹ، دوا کی حفاظت وضاحت کر سکتا ہوں۔ آج آپ کی کیا مدد کروں؟`,
}

const renderMessageContent = (content: string) => {
  let text = content;
  
  // 1. Match and extract hospital cards
  const hospitals: Array<{ name: string; address: string; phone: string; mapsUrl: string }> = [];
  const hospitalRegex = /\d+\.\s+([^\n]+)\n\s+-\s+Address:\s+([^\n]+)\n\s+-\s+Phone:\s+([^\n]+)\n\s+-\s+Google Maps:\s+\[View on Google Maps\]\(([^)]+)\)/g;
  
  let hMatch;
  while ((hMatch = hospitalRegex.exec(content)) !== null) {
    hospitals.push({
      name: hMatch[1],
      address: hMatch[2],
      phone: hMatch[3],
      mapsUrl: hMatch[4]
    });
  }
  
  text = text.replace(hospitalRegex, '');

  // 2. Match and extract doctor cards
  const doctors: Array<{ name: string; hospital: string; phone: string }> = [];
  const doctorRegex = /•\s+([^\n]+)\n\s+-\s+Hospital:\s+([^\n]+)\n\s+-\s+Phone:\s+([^\n]+)/g;
  
  let dMatch;
  while ((dMatch = doctorRegex.exec(content)) !== null) {
    doctors.push({
      name: dMatch[1],
      hospital: dMatch[2],
      phone: dMatch[3]
    });
  }
  
  text = text.replace(doctorRegex, '');
  
  text = text.replace(/####\s+Recommended\s+Nephrology\s+&\s+Kidney\s+Care\s+Centers\s*\(India\)\s*\n/gi, '');
  text = text.replace(/####\s+Recommended\s+Kidney\s+&\s+Neurology\s+Specialists\s*\n/gi, '');

  const lines = text.split('\n');
  const renderedLines: React.ReactNode[] = [];
  let mapsQuery: string | null = null;

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(content)) !== null) {
    const url = linkMatch[2];
    if (url.includes('google.com/maps/search')) {
      try {
        const urlObj = new URL(url);
        const query = urlObj.searchParams.get('query');
        if (query && !mapsQuery) {
          mapsQuery = query;
        }
      } catch (e) {
        if (url.includes('query=')) {
          const partsQuery = url.split('query=')[1];
          if (partsQuery && !mapsQuery) {
            mapsQuery = decodeURIComponent(partsQuery.split('&')[0]);
          }
        }
      }
    }
  }

  const parseLinks = (lineText: string, lineKey: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    const innerLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    while ((match = innerLinkRegex.exec(lineText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(lineText.substring(lastIndex, match.index));
      }
      
      const label = match[1];
      const url = match[2];
      
      if (url.includes('google.com/maps/search')) {
        parts.push(
          <a 
            key={`${lineKey}-${match.index}`}
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: 'white', 
              color: '#0284c7', 
              border: '1px solid #0284c7', 
              padding: '6px 14px', 
              borderRadius: '20px', 
              textDecoration: 'none', 
              fontWeight: 600, 
              fontSize: '12.5px', 
              margin: '4px 4px',
              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.05)',
              transition: 'all 0.2s',
              verticalAlign: 'middle'
            }}
            className="maps-redirect-btn"
          >
            {label}
          </a>
        );
      } else {
        parts.push(
          <a 
            key={`${lineKey}-${match.index}`}
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'underline' }}
          >
            {label}
          </a>
        );
      }
      
      lastIndex = innerLinkRegex.lastIndex;
    }
    
    if (lastIndex < lineText.length) {
      parts.push(lineText.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : lineText;
  };

  lines.forEach((line, index) => {
    const lineKey = `line-${index}`;
    const trimmed = line.trim();
    
    if (trimmed.startsWith('### ')) {
      const headerText = trimmed.replace('### ', '');
      renderedLines.push(
        <h3 key={lineKey} style={{ margin: '14px 0 6px', color: '#0f172a', fontSize: '16px', fontWeight: 700 }}>
          {parseLinks(headerText, lineKey)}
        </h3>
      );
    } else if (trimmed.startsWith('#### ')) {
      const headerText = trimmed.replace('#### ', '');
      renderedLines.push(
        <h4 key={lineKey} style={{ margin: '12px 0 6px', color: '#334155', fontSize: '14.5px', fontWeight: 700 }}>
          {parseLinks(headerText, lineKey)}
        </h4>
      );
    } else if (trimmed.startsWith('##### ')) {
      const headerText = trimmed.replace('##### ', '');
      renderedLines.push(
        <h5 key={lineKey} style={{ margin: '10px 0 4px', color: '#475569', fontSize: '13px', fontWeight: 700 }}>
          {parseLinks(headerText, lineKey)}
        </h5>
      );
    } else {
      if (trimmed === '---' || trimmed === '') {
        renderedLines.push(<div key={lineKey} style={{ minHeight: '8px' }} />);
      } else {
        renderedLines.push(
          <div key={lineKey} style={{ margin: '4px 0' }}>
            {parseLinks(line, lineKey)}
          </div>
        );
      }
    }
  });

  return (
    <div>
      <div>{renderedLines}</div>
      
      {hospitals.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Recommended Kidney & Neurology Care Centers
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
            {hospitals.map((h, i) => (
              <div 
                key={i} 
                style={{ 
                  background: 'white', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '12px', 
                  padding: '16px', 
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0369a1' }}>
                  {h.name}
                </div>
                <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ fontSize: '14px' }}>📍</span>
                  <span>{h.address}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px' }}>📞</span>
                  <a href={`tel:${h.phone.replace(/\s+/g, '')}`} style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>
                    {h.phone}
                  </a>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <a 
                    href={h.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      background: 'var(--blue)',
                      color: 'white',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '12.5px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    Directions
                  </a>
                  <a 
                    href={`tel:${h.phone.replace(/\s+/g, '')}`}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '12.5px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    📞 Call Hospital
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {doctors.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ color: '#0f172a', fontSize: '14px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            👨‍⚕️ Recommended Kidney & Neurology Specialists
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            {doctors.map((d, i) => (
              <div 
                key={i} 
                style={{ 
                  background: '#f8fafc', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '12px', 
                  padding: '14px', 
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f172a' }}>
                  {d.name}
                </div>
                <div style={{ fontSize: '12.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🏢</span>
                  <span>{d.hospital}</span>
                </div>
                <div style={{ fontSize: '12.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📞</span>
                  <a href={`tel:${d.phone.replace(/\s+/g, '')}`} style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>
                    {d.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {mapsQuery && (
        <div style={{ marginTop: '18px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ background: '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
             Live Google Maps Preview
          </div>
          <iframe 
            src={`https://maps.google.com/maps?q=${encodeURIComponent(mapsQuery)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
            width="100%" 
            height="260" 
            style={{ border: 0, display: 'block' }} 
            allowFullScreen 
            loading="lazy"
            title="Google Maps Location Preview"
          />
        </div>
      )}
    </div>
  );
};

export function ChatbotPage({ showPage, user, form }: ChatbotPageProps) {
  const userName = user ? user.name : 'there'
  const makeWelcome = (lang: string) => {
    const msg = (WELCOME_MESSAGES[lang] || WELCOME_MESSAGES['en']).replace('{name}', userName)
    return { role: 'assistant' as const, content: msg, assessment: msg, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  }

  // Read persisted language on first render
  const savedLang = localStorage.getItem('nephrocare_language') || 'en'
  const [messages, setMessages] = useState<Message[]>([makeWelcome(savedLang)])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedLang, setSelectedLang] = useState(savedLang)

  // Voice-to-text state
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)

  const LANG_TO_BCP47: Record<string, string> = {
    en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN',
    kn: 'kn-IN', ml: 'ml-IN', mr: 'mr-IN', gu: 'gu-IN',
    bn: 'bn-IN', pa: 'pa-IN', ur: 'ur-IN'
  }

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    setVoiceError(null)
    const recognition = new SpeechRecognition()
    recognition.lang = LANG_TO_BCP47[selectedLang] || 'en-IN'
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.continuous = false

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null }
    recognition.onerror = (e: any) => {
      setIsListening(false)
      recognitionRef.current = null
      if (e.error !== 'aborted') {
        setVoiceError(e.error === 'not-allowed'
          ? 'Microphone access denied. Please allow microphone in browser settings.'
          : `Voice error: ${e.error}`
        )
      }
    }
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join('')
      setInput(transcript)
      if (e.results[e.results.length - 1].isFinal) {
        recognition.stop()
        // Auto-detect language from the spoken transcript
        // and switch the language selector so the next mic session
        // and the API call both use the correct language
        const spoken = transcript.trim()
        if (spoken) {
          // We cannot call detectLangFromText here (it closes over selectedLang at call time),
          // so inline the same logic
          const counts: Record<string, number> = {}
          for (const ch of spoken) {
            const c = ch.codePointAt(0) ?? 0
            if      (c >= 0x0900 && c <= 0x097F) counts.hi  = (counts.hi  || 0) + 1
            else if (c >= 0x0B80 && c <= 0x0BFF) counts.ta  = (counts.ta  || 0) + 1
            else if (c >= 0x0C00 && c <= 0x0C7F) counts.te  = (counts.te  || 0) + 1
            else if (c >= 0x0C80 && c <= 0x0CFF) counts.kn  = (counts.kn  || 0) + 1
            else if (c >= 0x0D00 && c <= 0x0D7F) counts.ml  = (counts.ml  || 0) + 1
            else if (c >= 0x0A80 && c <= 0x0AFF) counts.gu  = (counts.gu  || 0) + 1
            else if (c >= 0x0980 && c <= 0x09FF) counts.bn  = (counts.bn  || 0) + 1
            else if (c >= 0x0A00 && c <= 0x0A7F) counts.pa  = (counts.pa  || 0) + 1
            else if (c >= 0x0600 && c <= 0x06FF) counts.ur  = (counts.ur  || 0) + 1
          }
          let best = '', max = 0
          for (const [lang, cnt] of Object.entries(counts)) {
            if (cnt > max) { max = cnt; best = lang }
          }
          if (max >= 2 && best) {
            setSelectedLang(best)
            localStorage.setItem('nephrocare_language', best)
          }
        }
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }

  // Reset chat with translated welcome when language changes
  const handleLangChange = (lang: string) => {
    setSelectedLang(lang)
    setMessages([makeWelcome(lang)])
  }

  // Listen for live language changes from Settings page
  useEffect(() => {
    const handler = (e: Event) => {
      const lang = (e as CustomEvent).detail?.language
      if (lang) {
        setSelectedLang(lang)
        setMessages([makeWelcome(lang)])
      }
    }
    window.addEventListener('nephrocare_language_change', handler)
    return () => window.removeEventListener('nephrocare_language_change', handler)
  }, [])
  
  // Custom context editable state
  const [customAge, setCustomAge] = useState<string>(form.age ? form.age.toString() : '48')
  const [customGender, setCustomGender] = useState<string>(form.sex || 'female')
  const [customEgfr, setCustomEgfr] = useState<string>('60')
  const [customCreatinine, setCustomCreatinine] = useState<string>(form.serum_creatinine ? form.serum_creatinine.toString() : '1.2')
  const [customPotassium, setCustomPotassium] = useState<string>(form.potassium ? form.potassium.toString() : '4.4')
  const [customSodium, setCustomSodium] = useState<string>(form.sodium ? form.sodium.toString() : '138')
  const [customMedications, setCustomMedications] = useState<string>('')
  const [customComorbidities, setCustomComorbidities] = useState<string>('')
  
  // Geolocation and Autolocate state hooks
  const [autolocating, setAutolocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locationInput, setLocationInput] = useState('')

  const handleAutolocate = () => {
    console.log("Autolocate button clicked...")
    if (!navigator.geolocation) {
      console.warn("Geolocation API not supported on this browser/context.")
      setLocationError("Geolocation is not supported by your browser.")
      return
    }
    
    setAutolocating(true)
    setLocationError(null)
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        console.log(`Successfully located user: lat=${lat}, lng=${lng}`)
        setAutolocating(false)
        handleSendMessage(
          "Show kidney care hospitals and nephrologists near my location.",
          `Show kidney care hospitals and nephrologists near my location (latitude: ${lat.toFixed(4)}, longitude: ${lng.toFixed(4)})`
        )
      },
      (error) => {
        console.error("Geolocation request failed:", error)
        setAutolocating(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location permission was denied. Please write your city manually below.")
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location position information is unavailable.")
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out.")
            break;
          default:
            setLocationError("An unknown error occurred while retrieving location.")
        }
      },
      { timeout: 10000 }
    )
  }

  const handleManualSearch = () => {
    if (!locationInput.trim()) return
    console.log(`Triggering manual location search for: ${locationInput.trim()}`)
    handleSendMessage(`Show kidney care hospitals and nephrologists in ${locationInput.trim()}`)
    setLocationInput('')
  }

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ─── Romanized keyword banks per language ───────────────────────────────
  const ROMANIZED_KEYWORDS: Record<string, string[]> = {
    hi: [
      // core grammar words
      'kya','hai','hain','hoon','tha','thi','the','nahi','nahin',
      'mujhe','mera','meri','mere','aap','tum','main','hum','unka','uska',
      'yeh','woh','iska','inka',
      // question words
      'kaise','kyun','kyunki','kab','kahan','kitna','kaun','kaunsa',
      // verbs / common phrases
      'bata','bataiye','chahiye','karo','hoga','samjhao','batao','dijiye',
      'karein','sakte','sakti','milega','hota','hoti','karta','karti',
      // medical (Hindi transliteration) - NO English words here
      'gurdey','dawai','goli','dard','bukhar','ilaj','bimari','sehat','dawa','upay',
    ],
    ta: [
      'enna','eppadi','yenna','vanakkam','nandri','romba','illai','aam',
      'sollunga','puriyala','seivathu','eppothu','yaar','enga','epdi',
      'naan','enakku','neenga','ungalukku','marundhu','vali'
    ],
    te: [
      'emiti','ela','meeru','naku','cheppandi','antaru','ledu','avunu',
      'cheyandi','emi','endi','mari','okavela','chestanu',
      'nenu','miku','bagunda','mandulu','nopi'
    ],
    kn: [
      'yaake','hege','illa','beku','ide','hagide','nimma','nanu','avaru',
      'eno','yaru','yelli','helri','madri','madbeku',
      'nanna','nimage','oushadhi','novu'
    ],
    ml: [
      'enthu','evide','undo','alla','aayi','nanni','paranjal','enganey',
      'parayamo','ulla','tharam','venam','illatha',
      'njan','ningal','marunnu','vedana'
    ],
    mr: [
      'kay','ahe','nahi','mazhe','tumhi','mala','kasa','kiti','kadhi',
      'kuthe','karun','sangal','dyave','milel','aahe',
      'mi','aapan','aushadh','dukhne'
    ],
    gu: [
      'shu','chhe','nathi','maro','tamaro','ane','che','ketlu','kyare',
      'kya','tame','hoon','karje','aavjo',
      'mane','dava','dukhavo'
    ],
    bn: [
      'ki','ache','nei','amar','tomar','kemon','kothay','kobe','keno',
      'bolo','korte','hobe','jano','dekho',
      'ami','apni','oshudh','byatha'
    ],
    pa: [
      'ki','hai','nahin','mera','tera','tusi','main','assi','kyon',
      'kive','kiddan','dasso','karo','hoga','sahi',
      'sancho','dawai','dard'
    ],
    ur: [
      'kya','hai','hain','mujhe','nahi','aap','mere','chahiye',
      'batayein','theek','dawa','ilaj','marz',
    ],
  }

  /**
   * Step 1 – Unicode script detection (fast, high confidence).
   * Step 2 – Romanized keyword matching as fallback (handles transliterated text).
   */
  const detectLangFromText = (text: string): string => {
    // ── STEP 1: Unicode script ranges ──────────────────────────────────
    const counts: Record<string, number> = {}
    for (const ch of text) {
      const c = ch.codePointAt(0) ?? 0
      if      (c >= 0x0900 && c <= 0x097F) counts.hi  = (counts.hi  || 0) + 1
      else if (c >= 0x0B80 && c <= 0x0BFF) counts.ta  = (counts.ta  || 0) + 1
      else if (c >= 0x0C00 && c <= 0x0C7F) counts.te  = (counts.te  || 0) + 1
      else if (c >= 0x0C80 && c <= 0x0CFF) counts.kn  = (counts.kn  || 0) + 1
      else if (c >= 0x0D00 && c <= 0x0D7F) counts.ml  = (counts.ml  || 0) + 1
      else if (c >= 0x0A80 && c <= 0x0AFF) counts.gu  = (counts.gu  || 0) + 1
      else if (c >= 0x0980 && c <= 0x09FF) counts.bn  = (counts.bn  || 0) + 1
      else if (c >= 0x0A00 && c <= 0x0A7F) counts.pa  = (counts.pa  || 0) + 1
      else if (c >= 0x0600 && c <= 0x06FF) counts.ur  = (counts.ur  || 0) + 1
    }
    let best = '', max = 0
    for (const [lang, cnt] of Object.entries(counts)) {
      if (cnt > max) { max = cnt; best = lang }
    }
    if (max >= 2) {
      if (best === 'hi' && selectedLang === 'mr') return 'mr'
      return best
    }

    // ── STEP 2: Romanized keyword matching ─────────────────────────────
    const words = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    const scores: Record<string, number> = {}
    for (const [lang, keywords] of Object.entries(ROMANIZED_KEYWORDS)) {
      for (const word of words) {
        if (word.length > 1 && keywords.includes(word)) {
          scores[lang] = (scores[lang] || 0) + 1
        }
      }
    }
    let rBest = '', rMax = 0
    for (const [lang, score] of Object.entries(scores)) {
      if (score > rMax) { rMax = score; rBest = lang }
    }
    // Require at least 1 keyword hit to switch language
    return rMax >= 1 ? rBest : ''
  }

  const handleSendMessage = async (textToSend: string, backendText?: string) => {
    if (!textToSend.trim() || loading) return

    // Auto-detect the language script used in the message
    const autoLang = detectLangFromText(textToSend)
    const langToUse = autoLang || selectedLang
    if (autoLang && autoLang !== selectedLang) {
      setSelectedLang(autoLang)
      localStorage.setItem('nephrocare_language', autoLang)
    }

    // Clean user message coordinates text for UI bubble display
    const displayContent = textToSend.replace(/\s*\(latitude:\s*-?\d+\.\d+,\s*longitude:\s*-?\d+\.\d+\)/gi, '')

    const userMsg: Message = {
      role: 'user',
      content: displayContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build patient context object
    const patientContext = {
      user_id: user ? user.email : 'anonymous',
      age: parseInt(customAge) || undefined,
      gender: customGender,
      current_egfr: parseFloat(customEgfr) || undefined,
      current_creatinine: parseFloat(customCreatinine) || undefined,
      current_potassium: parseFloat(customPotassium) || undefined,
      current_sodium: parseFloat(customSodium) || undefined,
      medications: customMedications.split(',').map(m => m.trim()).filter(m => m !== ''),
      comorbidities: customComorbidities.split(',').map(c => c.trim()).filter(c => c !== '')
    }

    // Build conversation history in format required by api
    const history = messages.slice(1).map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    try {
      const response = await fetch(`${API_BASE_URL}/api/chatbot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: backendText || textToSend,
          language: langToUse,
          history: history,
          patient_context: patientContext
        })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        if (response.status === 503 || errData.error === 'overload') {
          throw new Error('__overload__')
        }
        throw new Error('API server returned an error.')
      }

      const data = await response.json()
      
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.assessment,
        assessment: data.assessment,
        explanation: data.explanation,
        educational_information: data.educational_information,
        kidney_specific_guidance: data.kidney_specific_guidance,
        questions_for_nephrologist: data.questions_for_nephrologist || [],
        references: data.references || [],
        emergency_detected: data.emergency_detected,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch (error: any) {
      console.error(error)
      const isOverload = error?.message === '__overload__'
      const errorMsg: Message = {
        role: 'assistant',
        content: isOverload
          ? '⏳ The AI assistant is currently busy due to high traffic. Please wait a moment and try again — your question has not been lost!'
          : '⚠️ Something went wrong connecting to the assistant. Please check your connection and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="wearable-page-container chatbot-container">
      {/* LEFT COLUMN: Main Chat Interface */}
      <div className="wearable-card chatbot-main-card">
        {/* Header bar */}
        <div className="chatbot-header">
          <div className="chatbot-title-area">
            <h2>
              <span><Icon name="activity" size={24} /></span>
              AI Nephrology Assistant
            </h2>
            <p>
              KDIGO-compliant medical support. (Education only, not diagnostics)
            </p>
          </div>

          <div className="chatbot-lang-select">
            <label>Language:</label>
            <select
              value={selectedLang}
              onChange={e => handleLangChange(e.target.value)}
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Safety Warning */}
        <div style={{ background: '#fffbeb', borderLeft: '4px solid #d97706', padding: '12px 16px', borderRadius: '4px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <span style={{ color: '#d97706', marginTop: '2px', display: 'inline-flex' }}><Icon name="alert" size={18} /></span>
          <div style={{ fontSize: '12px', color: '#78350f', lineHeight: 1.5 }}>
            <strong>Safety Disclaimer:</strong> This assistant is designed to provide health education and references to standard nephrology guidelines. It does not replace professional medical evaluations. **In case of emergency symptoms (difficulty breathing, chest pain), go to the nearest emergency room immediately.**
          </div>
        </div>



        {/* Chat Balloon History */}
        <div className="chatbot-history">
          {messages.map((msg, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%',
                background: msg.role === 'user' ? '#e0f2fe' : '#f8fafc',
                color: msg.role === 'user' ? '#0369a1' : '#0f172a',
                padding: '16px',
                borderRadius: '16px',
                borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderTopLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
                border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                {/* Standard Message content */}
                <div style={{ fontSize: '14.5px', lineHeight: 1.6 }}>
                  {renderMessageContent(msg.content)}
                </div>

                {/* Structured Medical Breakdown (Assistant responses only) */}
                {msg.role === 'assistant' && (msg.explanation || msg.kidney_specific_guidance || (msg.questions_for_nephrologist && msg.questions_for_nephrologist.length > 0)) && (
                  <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {msg.explanation && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', marginBottom: '2px' }}>Clinical Explanation</div>
                        <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>{msg.explanation}</div>
                      </div>
                    )}

                    {msg.educational_information && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', marginBottom: '2px' }}>Educational Context</div>
                        <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>{msg.educational_information}</div>
                      </div>
                    )}

                    {msg.kidney_specific_guidance && (
                      <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid var(--green)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '2px' }}>Kidney Nutrition & Lifestyle Guidance</div>
                        <div style={{ fontSize: '13px', color: '#14532d', lineHeight: 1.5 }}>{msg.kidney_specific_guidance}</div>
                      </div>
                    )}

                    {msg.questions_for_nephrologist && msg.questions_for_nephrologist.length > 0 && (
                      <div style={{ background: '#f0f9ff', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid var(--blue)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', marginBottom: '4px' }}>Questions for your Doctor</div>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#0c4a6e', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {msg.questions_for_nephrologist.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {msg.references && msg.references.length > 0 && (
                      <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong>References:</strong>
                        <ul style={{ margin: 0, paddingLeft: '14px' }}>
                          {msg.references.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px', fontSize: '10px', opacity: 0.6 }}>
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ background: '#f1f5f9', padding: '12px 18px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block', animation: 'typingDot 1.2s ease-in-out infinite', animationDelay: '0s' }} />
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block', animation: 'typingDot 1.2s ease-in-out infinite', animationDelay: '0.2s' }} />
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block', animation: 'typingDot 1.2s ease-in-out infinite', animationDelay: '0.4s' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Footer Container (Quick Replies & Input) */}
        <div className="chatbot-footer" style={{ flexShrink: 0 }}>
          {/* Quick replies */}
          <div className="chatbot-quick-replies" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {(QUICK_REPLIES_MAP[selectedLang] || QUICK_REPLIES_MAP['en']).map((reply: string, i: number) => (
              <button
                key={i}
                type="button"
                disabled={loading}
                onClick={() => handleSendMessage(reply)}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  padding: '6px 12px',
                  borderRadius: '16px',
                  fontSize: '12.5px',
                  color: '#334155',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                className="quick-reply-chip"
              >
                {reply}
              </button>
            ))}
          </div>

          {/* Input box */}
          {voiceError && (
            <div style={{ marginBottom: '8px', padding: '8px 12px', background: '#fee2e2', borderRadius: '8px', fontSize: '12.5px', color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{voiceError}</span>
              <button onClick={() => setVoiceError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: '14px', lineHeight: 1 }}>✕</button>
            </div>
          )}
          <form onSubmit={e => { e.preventDefault(); handleSendMessage(input) }} style={{ display: 'flex', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={input}
                disabled={loading}
                onChange={e => setInput(e.target.value)}
                placeholder={isListening ? 'Listening... speak now' : 'Ask about guidelines, potassium levels...'}
                style={{
                  width: '100%',
                  padding: '12px 50px 12px 16px',
                  borderRadius: '10px',
                  border: isListening ? '2px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
              />
              {/* Mic button inside input */}
              <button
                type="button"
                title={isListening ? 'Stop listening' : `Voice input (${LANG_TO_BCP47[selectedLang] || 'en-IN'})`}
                onClick={isListening ? stopListening : startListening}
                disabled={loading}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: isListening ? '#ef4444' : 'transparent',
                  border: isListening ? 'none' : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '5px 7px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isListening ? 'white' : '#475569',
                  transition: 'all 0.2s',
                  boxShadow: isListening ? '0 0 0 4px rgba(239,68,68,0.2)' : 'none',
                  animation: isListening ? 'micPulse 1s ease-in-out infinite' : 'none'
                }}
              >
                {isListening ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                )}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: 'var(--blue)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Send
              <Icon name="arrow" size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Patient Context Dashboard */}
      <div className="chatbot-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <section className="wearable-card" style={{ padding: '20px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#083b66', margin: '0 0 16px', fontSize: '18px' }}>
            <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Icon name="file-text" size={20} /></span>
            Active Patient Context
          </h3>
          <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
            Configure metrics below to customize the AI assistant's advice to your specific vitals/CKD stage.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Age</label>
                <input
                  type="number"
                  value={customAge}
                  onChange={e => setCustomAge(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Gender</label>
                <select
                  value={customGender}
                  onChange={e => setCustomGender(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: 'white' }}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>eGFR (mL/min)</label>
                <input
                  type="number"
                  value={customEgfr}
                  onChange={e => setCustomEgfr(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Creatinine (mg/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={customCreatinine}
                  onChange={e => setCustomCreatinine(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Potassium (mmol/L)</label>
                <input
                  type="number"
                  step="0.1"
                  value={customPotassium}
                  onChange={e => setCustomPotassium(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Sodium (mmol/L)</label>
                <input
                  type="number"
                  value={customSodium}
                  onChange={e => setCustomSodium(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Active Medications (comma separated)</label>
              <input
                type="text"
                placeholder="e.g. Lisinopril, Atorvastatin"
                value={customMedications}
                onChange={e => setCustomMedications(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Comorbidities (comma separated)</label>
              <input
                type="text"
                placeholder="e.g. Hypertension, Diabetes Type 2"
                value={customComorbidities}
                onChange={e => setCustomComorbidities(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          </div>
        </section>

        {/* Live Location Hospital Finder Widget Card */}
        <div style={{ 
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', 
          color: '#0f172a', 
          border: '1px solid #bae6fd',
          padding: '16px 20px', 
          borderRadius: '12px', 
          boxShadow: '0 4px 12px rgba(3, 105, 161, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#0369a1' }}>
                📍 Dialysis & Kidney Care Finder
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#334155', opacity: 0.9 }}>
                Share your location to instantly list kidney care centers and contact specialists near your live GPS coordinates.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAutolocate}
              disabled={autolocating}
              style={{
                background: '#0284c7',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '25px',
                fontWeight: 700,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 6px rgba(2, 132, 199, 0.15)',
                transition: 'transform 0.2s',
                outline: 'none'
              }}
            >
              {autolocating ? '🛰️ Sharing...' : 'Share your location'}
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #bae6fd', paddingTop: '12px' }}>
            <input 
              type="text" 
              placeholder="Or enter your city manually (e.g. Mumbai, Delhi)..." 
              value={locationInput}
              onChange={e => setLocationInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleManualSearch(); } }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                fontSize: '13px',
                color: '#334155',
                background: 'white'
              }}
            />
            <button
              type="button"
              onClick={handleManualSearch}
              disabled={!locationInput.trim()}
              style={{
                background: '#0284c7',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.1)'
              }}
            >
              Search
            </button>
          </div>
        </div>

        {locationError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 500 }}>
            ⚠️ {locationError}
          </div>
        )}
      </div>
    </div>
  )
}
