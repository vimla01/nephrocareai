import { useState, useMemo } from 'react'
import { Icon } from '../components/Icon'
import type { Page, PredictionResult, PredictionForm, MealPlanResponse, FoodAnalysis, FoodScanResponse, UltrasoundScanResult, ToastType } from '../types'
import type { FoodTab } from './FoodToolsPage'
import { API_BASE_URL } from '../constants'

// useState backed by localStorage - reads once on mount, writes through on every update.
// used throughout this page instead of plain useState wherever the value should survive a reload
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error)
    }
  }

  return [storedValue, setValue] as const
}

interface PredictionHistory {
  timestamp: string;
  egfr: number;
  creatinine: number;
  uacr: number;
  blood_pressure: number;
  blood_urea: number;
  sodium: number;
  potassium: number;
  hemoglobin: number;
  risk_percent: number;
  stage: string;
}

interface UltrasoundHistory {
  timestamp: string;
  severity: string;
  image_quality: string;
  kidney_size_mm?: number;
  cortical_thickness_mm?: number;
  observations: string[];
  recommendation: string;
  image_url?: string;
}

interface SymptomLog {
  timestamp: string;
  fatigue: 'none' | 'mild' | 'severe';
  swelling: 'none' | 'mild' | 'severe';
  nausea: 'none' | 'mild' | 'severe';
  appetite: 'none' | 'mild' | 'severe';
  urination: 'none' | 'mild' | 'severe';
  itchySkin: 'none' | 'mild' | 'severe';
  shortnessOfBreath: 'none' | 'mild' | 'severe';
  metallicTaste: 'none' | 'mild' | 'severe';
  urinationChanges: 'none' | 'mild' | 'severe';
}

// note: only mealPlan is actually used below - predictionResult, predictionForm, checkFood, foodCheck,
// foodScan, ultrasoundResult, ultrasoundMetrics and setFoodTab are currently unused here; this page
// reads its own copies of prediction/ultrasound history straight from localStorage instead (see below)
type DashboardPageProps = {
  user: { name: string; email: string } | null
  showPage: (page: Page) => void
  predictionResult?: PredictionResult | null
  predictionForm?: PredictionForm
  mealPlan?: MealPlanResponse | null
  checkFood?: any
  foodCheck?: FoodAnalysis | null
  foodScan?: FoodScanResponse | null
  ultrasoundResult?: UltrasoundScanResult | null
  ultrasoundMetrics?: any
  setFoodTab?: (tab: FoodTab) => void
  addToast: (type: ToastType, title: string, message: string, action?: { label: string; url: string }) => void
}

// e.g. "5 min ago" / "Yesterday" / a full date once it's more than 2 days old
function getRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (diffInSeconds < 172800) return 'Yesterday';
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DashboardPage({ 
  user, 
  showPage, 
  predictionResult, 
  predictionForm,
  mealPlan,
  checkFood,
  foodCheck,
  foodScan,
  ultrasoundResult,
  ultrasoundMetrics,
  setFoodTab,
  addToast
}: DashboardPageProps) {
  // Histories - all newest-first arrays, written to by App.tsx (predictions), UltrasoundPage
  // (scans) and this page itself (symptom logs)
  const [predictions] = useLocalStorage<PredictionHistory[]>('nephrocare_predictions', [])
  const [ultrasounds] = useLocalStorage<UltrasoundHistory[]>('nephrocare_ultrasound_scans', [])
  const [symptomLogs, setSymptomLogs] = useLocalStorage<SymptomLog[]>('nephrocare_symptom_logs', [])

  // Navigation states
  const [activeLabTab, setActiveLabTab] = useState<'kidney' | 'electrolytes' | 'blood' | 'all'>('kidney')

  // Modals and tooltips state
  const [isUsModalOpen, setIsUsModalOpen] = useState(false)

  // fires when a symptom is logged as severe - tries the real Twilio-backed API first, and
  // falls back to a wa.me deep link toast if that fails so the alert is never silently dropped
  const sendWhatsAppNotification = async (title: string, message: string) => {
    const whatsappEnabled = JSON.parse(window.localStorage.getItem('nephrocare_whatsapp_enabled') || 'false');
    const phoneRaw = window.localStorage.getItem('nephrocare_phone') || '';
    const phone = phoneRaw.replace(/"/g, ''); // Fix json stringified quotes if any
    
    if (!whatsappEnabled || !phone) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/send-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phone,
          message: `🔔 NephroCare Alert\n\n*${title}*\n${message}`
        })
      })
      const data = await response.json()
      if (data.success) {
        addToast('whatsapp', 'WhatsApp Alert Sent', `📱 Sent to ${phone}: ${title}`)
        const wLogs = JSON.parse(window.localStorage.getItem('nephrocare_whatsapp_history') || '[]');
        window.localStorage.setItem('nephrocare_whatsapp_history', JSON.stringify([{ timestamp: new Date().toISOString(), title, message, status: 'Sent' }, ...wLogs].slice(0, 50)));
      } else {
        addToast(
          'whatsapp',
          'WhatsApp Simulated',
          `📱 [Simulated to ${phone}]: ${title}`,
          data.whatsapp_web_url ? { label: 'Send via WhatsApp Web', url: data.whatsapp_web_url } : undefined
        )
        const wLogs = JSON.parse(window.localStorage.getItem('nephrocare_whatsapp_history') || '[]');
        window.localStorage.setItem('nephrocare_whatsapp_history', JSON.stringify([{ timestamp: new Date().toISOString(), title, message, status: 'Simulated' }, ...wLogs].slice(0, 50)));
      }
    } catch (err) {
      console.error('Error dispatching WhatsApp alert:', err)
      const cleanPhone = phone.replace(/[^\d]/g, '')
      const webUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(`🔔 NephroCare Alert\n\n*${title}*\n${message}`)}`
      addToast(
        'whatsapp',
        'WhatsApp Simulated',
        `📱 [Simulated to ${phone}]: ${title}`,
        { label: 'Send via WhatsApp Web', url: webUrl }
      )
      const wLogs = JSON.parse(window.localStorage.getItem('nephrocare_whatsapp_history') || '[]');
      window.localStorage.setItem('nephrocare_whatsapp_history', JSON.stringify([{ timestamp: new Date().toISOString(), title, message, status: 'Failed' }, ...wLogs].slice(0, 50)));
    }
  }

  // Default symptom set representing all tracked symptoms
  const defaultSymptoms = {
    fatigue: 'none',
    swelling: 'none',
    nausea: 'none',
    appetite: 'none',
    urination: 'none',
    itchySkin: 'none',
    shortnessOfBreath: 'none',
    metallicTaste: 'none',
    urinationChanges: 'none'
  };

  // Merge latest logged entry with default set
  const latestSymptoms = useMemo(() => {
    const raw = symptomLogs[0] || {};
    return {
      ...defaultSymptoms,
      ...raw
    };
  }, [symptomLogs]);

  // logs one symptom's new severity as a brand-new snapshot (carrying over all the other
  // symptoms' last-known values), and pings WhatsApp immediately if it's marked severe
  const handleSymptomChange = (symptom: keyof Omit<SymptomLog, 'timestamp'>, severity: 'none' | 'mild' | 'severe') => {
    const newLog: SymptomLog = {
      ...latestSymptoms,
      timestamp: new Date().toISOString(),
      [symptom]: severity
    };
    setSymptomLogs([newLog, ...symptomLogs]);
    if (severity === 'severe') {
      sendWhatsAppNotification(`Severe ${symptom.toUpperCase()}`, `You logged severe ${symptom}. Please contact your clinical coordinator immediately.`);
    }
    
    const token = localStorage.getItem('auth_token')
    if (user && token) {
      fetch(`${API_BASE_URL}/api/patient/symptom-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newLog)
      }).catch(err => console.error('Failed to save symptom log to DB:', err))
    }
  }

  // Composite Symptom Severity Score (0-100) - simple average of per-symptom severity weights,
  // shown as the "Load: X%" badge on the symptom tracker card
  const symptomScore = useMemo(() => {
    const weights = { none: 0, mild: 35, severe: 100 }
    const keys = ['fatigue', 'swelling', 'nausea', 'appetite', 'urination', 'itchySkin', 'shortnessOfBreath', 'metallicTaste', 'urinationChanges'] as const
    const sum = keys.reduce((acc, key) => acc + weights[latestSymptoms[key] || 'none'], 0)
    return Math.round(sum / keys.length)
  }, [latestSymptoms])

  const latestPrediction = predictions[0];
  const latestUltrasound = ultrasounds[0];

  // builds a standalone HTML "clinical summary" document in a new tab and immediately prints it -
  // same window.print() approach as DoctorSummaryPage, but this one has no dedicated page/route,
  // it's assembled here as a raw html string since it needs its own popup window
  const generateDoctorReport = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return // popup blocked - silently bail rather than showing a broken window

    const riskVal = latestPrediction ? `${latestPrediction.risk_percent.toFixed(1)}%` : 'No assessment data'
    const stageVal = latestPrediction ? latestPrediction.stage : 'N/A'
    const egfrVal = latestPrediction ? `${latestPrediction.egfr} mL/min/1.73m²` : 'N/A'
    const acrVal = latestPrediction ? `${latestPrediction.uacr} mg/g` : 'N/A'
    const creatVal = latestPrediction ? `${latestPrediction.creatinine} mg/dL` : 'N/A'
    const ureaVal = latestPrediction ? `${latestPrediction.blood_urea} mg/dL` : 'N/A'
    const sodVal = latestPrediction ? `${latestPrediction.sodium} mEq/L` : 'N/A'
    const potVal = latestPrediction ? `${latestPrediction.potassium} mmol/L` : 'N/A'
    const hemoglobinVal = latestPrediction ? `${latestPrediction.hemoglobin} g/dL` : 'N/A'

    const usSeverity = latestUltrasound ? latestUltrasound.severity : 'N/A'
    const usSize = latestUltrasound ? `${latestUltrasound.kidney_size_mm || '--'} mm` : 'N/A'
    const usThickness = latestUltrasound ? `${latestUltrasound.cortical_thickness_mm || '--'} mm` : 'N/A'
    const usObs = latestUltrasound ? latestUltrasound.observations.join(', ') : 'None'

    const sympString = Object.entries(latestSymptoms)
      .filter(([k]) => k !== 'timestamp')
      .map(([k, v]) => {
        let label = k.toUpperCase()
        if (k === 'itchySkin') label = 'ITCHY SKIN'
        if (k === 'shortnessOfBreath') label = 'SHORTNESS OF BREATH'
        if (k === 'metallicTaste') label = 'METALLIC TASTE'
        if (k === 'urinationChanges') label = 'URINATION CHANGES'
        return `${label}: ${v}`
      })
      .join(', ')

    const reportHtml = `
      <html>
        <head>
          <title>NephroCare Clinical Summary Report</title>
          <style>
            body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #083b66; padding-bottom: 16px; margin-bottom: 24px; }
            .title { color: #083b66; font-size: 24px; font-weight: bold; margin: 0; }
            .meta { text-align: right; font-size: 12px; color: #64748b; }
            .section { margin-bottom: 24px; }
            .section-title { font-size: 15px; font-weight: bold; color: #083b66; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
            .label { font-size: 11px; color: #64748b; font-weight: bold; }
            .value { font-size: 15px; font-weight: bold; color: #0f172a; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; padding: 8px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-size: 11px; color: #475569; }
            td { padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 12px; }
            .disclaimer { font-size: 10px; color: #94a3b8; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">NEPHROCARE PATIENT ASSESSMENT SUMMARY</h1>
              <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">Comprehensive Patient Assessment Document</p>
            </div>
            <div class="meta">
              <div><strong>Patient Name:</strong> ${user?.name}</div>
              <div><strong>Email:</strong> ${user?.email}</div>
              <div><strong>Generated Date:</strong> ${new Date().toLocaleString()}</div>
            </div>
          </div>
          
          <div class="section">
            <h2 class="section-title">1. Patient Overview</h2>
            <div class="grid">
              <div class="card">
                <div class="label">CKD RISK PROBABILITY</div>
                <div class="value">${riskVal}</div>
              </div>
              <div class="card">
                <div class="label">CURRENT CKD CLINICAL STAGE</div>
                <div class="value">${stageVal}</div>
              </div>
              <div class="card">
                <div class="label">ESTIMATED GFR (eGFR)</div>
                <div class="value">${egfrVal}</div>
              </div>
              <div class="card">
                <div class="label">ACR (UACR RATIO)</div>
                <div class="value">${acrVal}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">2. Laboratory Evaluation Data</h2>
            <table>
              <thead>
                <tr>
                  <th>Biomarker</th>
                  <th>Observed Value</th>
                  <th>Clinical Reference Range</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Serum Creatinine</td>
                  <td><strong>${creatVal}</strong></td>
                  <td>0.6 - 1.2 mg/dL</td>
                  <td>${latestPrediction && latestPrediction.creatinine > 1.2 ? 'Elevated' : 'Normal'}</td>
                </tr>
                <tr>
                  <td>Blood Urea Nitrogen (BUN)</td>
                  <td><strong>${ureaVal}</strong></td>
                  <td>7 - 20 mg/dL</td>
                  <td>${latestPrediction && latestPrediction.blood_urea > 20 ? 'Elevated' : 'Normal'}</td>
                </tr>
                <tr>
                  <td>eGFR</td>
                  <td><strong>${egfrVal}</strong></td>
                  <td>&gt; 90 mL/min/1.73m²</td>
                  <td>${latestPrediction && latestPrediction.egfr < 90 ? 'Decreased' : 'Normal'}</td>
                </tr>
                <tr>
                  <td>Sodium (mEq/L)</td>
                  <td><strong>${sodVal}</strong></td>
                  <td>135 - 145 mEq/L</td>
                  <td>Normal</td>
                </tr>
                <tr>
                  <td>Potassium (mmol/L)</td>
                  <td><strong>${potVal}</strong></td>
                  <td>3.5 - 5.0 mmol/L</td>
                  <td>${latestPrediction && latestPrediction.potassium > 5.0 ? 'Elevated' : 'Normal'}</td>
                </tr>
                <tr>
                  <td>Hemoglobin (g/dL)</td>
                  <td><strong>${hemoglobinVal}</strong></td>
                  <td>12.0 - 17.5 g/dL</td>
                  <td>Normal</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2 class="section-title">3. Structural Imaging & Symptom Metrics</h2>
            <div class="grid">
              <div class="card">
                <div class="label">Ultrasound Structural Findings</div>
                <div class="value">${usSeverity} severity status</div>
                <div style="margin-top: 4px; font-size: 11px; color: #475569;">
                  Size: ${usSize} | Cortex thickness: ${usThickness}<br/>
                  Observations: ${usObs}
                </div>
              </div>
              <div class="card">
                <div class="label">Active Logged Symptoms</div>
                <div class="value">${sympString}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">4. Nutrition & Meal Plan Recommendations</h2>
            <div class="card">
              <strong>Kidney-Safe Recommended Foods:</strong> Apples, Blueberries, Cabbage, Cauliflower, Egg Whites, Garlic, Onions.<br/><br/>
              <strong>Foods to Restrict/Limit:</strong> Bananas, High-potassium dal, Processed meats, Carbonated dark sodas, Avocados.
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">5. Physician Sign-off & Notes</h2>
            <div style="border: 1px dashed #cbd5e1; height: 100px; border-radius: 8px; padding: 12px; font-size: 11px; color: #94a3b8;">
              Clinical Notes / Observations:<br/><br/><br/>
              Signature: ___________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: __________________
            </div>
          </div>

          <p class="disclaimer">
            <strong>Clinical Disclaimer:</strong> This clinical summary report is automatically generated based on patient bio-telemetry logs. It is intended for consultation purposes and does not constitute formal medical diagnosis.
          </p>
        </body>
      </html>
    `
    printWindow.document.write(reportHtml)
    printWindow.document.close()
    printWindow.print()
  }

  if (!user) {
    return (
      <main className="dashboard-page auth-wall">
        <div className="auth-wall-card">
          <div className="auth-wall-icon">
            <Icon name="shield" size={48} />
          </div>
          <h2>Monitoring Dashboard is Locked</h2>
          <p>Please log in or create an account to access your personal dashboard.</p>
          <div className="auth-wall-actions">
            <button className="login-btn-primary" onClick={() => showPage('login')}>Log In</button>
            <button className="signup-btn-secondary" onClick={() => showPage('signup')}>Sign Up</button>
          </div>
        </div>
      </main>
    )
  }

  // Stage details mapping - takes the backend's egfr_category code (e.g. "G3a") and returns
  // a plain-language blurb; note this duplicates the wording in constants.ts's stageDescriptions
  const getStageDescription = (stage: string) => {
    const cleanStage = stage.replace(/^G/, 'Stage ');
    switch (cleanStage) {
      case 'Stage 1': return 'Normal or high kidney function with mild structural damage.'
      case 'Stage 2': return 'Mild GFR reduction (eGFR 60-89 mL/min).'
      case 'Stage 3a': return 'Moderate GFR reduction (eGFR 45-59 mL/min).'
      case 'Stage 3b': return 'Moderate GFR reduction (eGFR 30-44 mL/min).'
      case 'Stage 4': return 'Severe GFR reduction (eGFR 15-29 mL/min).'
      case 'Stage 5': return 'Kidney failure (eGFR <15 GFR).'
      default: return 'No active stage diagnosed.'
    }
  }

  // position (0-5) of the current stage along the Stage 1..5 progression timeline strip
  const getStageIndex = (stage: string) => {
    const cleanStage = stage.replace(/^G/, 'Stage ');
    const stages = ['Stage 1', 'Stage 2', 'Stage 3a', 'Stage 3b', 'Stage 4', 'Stage 5']
    return stages.indexOf(cleanStage)
  }

  // Risk Gauge Math - precomputes the svg circle's stroke-dasharray/dashoffset so the ring
  // fill visually represents riskPercent (see the <circle> using these below)
  const riskPercent = latestPrediction ? latestPrediction.risk_percent : 0
  const riskRadius = 40
  const riskStroke = 6
  const riskCircumference = riskRadius * 2 * Math.PI
  const riskOffset = riskCircumference - (Math.min(riskPercent, 100) / 100) * riskCircumference

  // Reference Ranges and Position mapping for custom progress lines.
  // Returns value percentage relative to safety bounds - centers the reference range in the
  // middle of the bar by padding both ends with half the range, so out-of-range values still
  // land somewhere sensible on the 0-100 bar instead of clipping immediately
  const getProgressPercent = (value: number, minRef: number, maxRef: number) => {
    const range = maxRef - minRef
    const pct = ((value - (minRef - range * 0.5)) / (range * 2)) * 100
    return Math.min(100, Math.max(0, pct))
  }

  return (
    <div className="dashboard-page" style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', 'Raleway', sans-serif" }}>
      
      {/* Scope specific scoped custom styling overrides for high-fidelity SaaS aesthetics */}
      <style>{`
        /* Sidebar Navigation Menu - .sidebar/.sidebar-logo below aren't used by any element
           currently rendered on this page (there's no left nav in the JSX), left in in case
           a sidebar comes back later */
        .sidebar {
          width: 260px;
          background: #ffffff;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          box-sizing: border-box;
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          font-size: 19px;
          color: #083b66;
          margin-bottom: 28px;
          padding-left: 8px;
        }
        .sidebar-logo small {
          display: block;
          font-size: 9px;
          color: #64748b;
          font-weight: 600;
          margin-top: 2px;
        }
        .menu-section-label {
          font-size: 10.5px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 18px 0 8px 8px;
          text-align: left;
        }
        .menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 10px;
          color: #475569;
          font-size: 13.5px;
          font-weight: 600;
          text-align: left;
          background: transparent;
          border: none;
          cursor: pointer;
          width: 100%;
          transition: all 0.2s;
        }
        .menu-item:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .menu-item.active {
          background: #fff5f7; /* Soft pink */
          color: #9F1239;      /* Crimson text */
        }
        
        /* Main Layout Content */
        .content-area {
          flex: 1;
          padding: 32px clamp(24px, 4vw, 56px);
          overflow-y: auto;
          box-sizing: border-box;
        }
        .dashboard-grid-custom {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 24px;
        }
        .card-custom {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.015);
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-sizing: border-box;
        }
        .card-custom-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .card-custom-header h3 {
          margin: 0;
          font-size: 15.5px;
          font-weight: 700;
          color: #083b66;
        }
        
        /* KPI top cards */
        .kpi-row-custom {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .kpi-card-custom {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.01);
          text-align: left;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .kpi-card-custom:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }
        @media (max-width: 1400px) {
          .kpi-row-custom {
            grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
            gap: 10px;
          }
          .kpi-card-custom {
            padding: 12px 8px;
            gap: 8px;
          }
        }
        
        /* Lab tabs */
        .lab-tab-btn {
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 12.5px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .lab-tab-btn.active {
          background: #083b66;
          color: #ffffff;
        }
        
        /* Custom progress bar */
        .custom-prog-bar {
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
          margin-top: 6px;
          position: relative;
        }
        .custom-prog-fill {
          height: 100%;
          border-radius: 3px;
        }

        /* Responsive Symptom Tracker */
        .symptom-row {
          display: flex;
          gap: 8px;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .symptom-name {
          font-size: 13px;
          font-weight: 700;
          color: #475569;
          text-transform: capitalize;
        }
        .symptom-buttons {
          display: flex;
          gap: 4px;
        }
        .symptom-btn {
          border: none;
          font-size: 10px;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 700;
          transition: all 0.2s;
        }
        .btn-full { display: none; }
        .btn-short { display: inline; }

        @media (max-width: 600px) {
          .symptom-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
            padding: 12px 0;
          }
          .symptom-buttons {
            width: 100%;
            justify-content: space-between;
            gap: 8px;
          }
          .symptom-btn {
            flex: 1;
            padding: 10px !important;
            font-size: 13px !important;
            border-radius: 8px;
          }
          .btn-short { display: none; }
          .btn-full { display: inline; }
        }

        /* Dashboard Responsive Grids */
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 20px;
        }
        .dashboard-main-grid {
          display: grid;
          grid-template-columns: 1.8fr 1.2fr;
          gap: 28px;
          margin-bottom: 28px;
        }
        .dashboard-charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .dashboard-labs-grid {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 24px;
        }
        .dashboard-twin-mini-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          background: #f8fafc;
          padding: 14px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }
        .dashboard-bottom-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
        }

        @media (max-width: 900px) {
          .dashboard-main-grid,
          .dashboard-labs-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }

        @media (max-width: 768px) {
          .dashboard-charts-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }

        @media (max-width: 600px) {
          .dashboard-page {
            overflow-x: hidden !important;
          }
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
          .dashboard-header button {
            width: 100%;
            justify-content: center;
          }
          .content-area {
            padding: 16px !important;
          }
          .kpi-row-custom {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
            margin-bottom: 16px !important;
          }
          .kpi-card-custom {
            padding: 8px 10px !important;
            gap: 8px !important;
            border-radius: 10px !important;
          }
          .kpi-card-custom div:first-child {
            width: 28px !important;
            height: 28px !important;
          }
          .kpi-card-custom svg {
            width: 14px !important;
            height: 14px !important;
          }
          .kpi-card-custom strong {
            font-size: 13.5px !important;
          }
          .kpi-card-custom span {
            font-size: 9.5px !important;
          }
          .kpi-card-custom:last-child {
            grid-column: span 2 !important;
          }
          .dashboard-bottom-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .dashboard-twin-mini-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* RIGHT MAIN CONTENT AREA */}
      <div className="content-area">
        
        {/* Header Navigation */}
        <header className="dashboard-header">
          <div>
            <span style={{ fontSize: '11.5px', color: '#9F1239', fontWeight: 'bold', textTransform: 'uppercase', background: '#fff5f7', padding: '4px 10px', borderRadius: '12px', letterSpacing: '0.5px' }}>
              Patient Portal
            </span>
            <h2 style={{ margin: '8px 0 2px', fontSize: '26px', color: '#083b66', fontWeight: '800' }}>Hii, {user?.name || 'Patient'}! 👋</h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Unified diagnostic summary and real-time biometric analysis.</p>
          </div>
          <button 
            type="button" 
            onClick={generateDoctorReport}
            style={{ background: '#083b66', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(8,59,102,0.15)' }}
          >
            <Icon name="file-text" size={16} /> Generate Doctor Report
          </button>
        </header>

        {/* 1. TOP SECTION: HEALTH OVERVIEW KPI CARDS WITH ULTRASOUND IMAGE PREVIEW */}
        <section className="kpi-row-custom">
          
          {/* Card: Risk */}
          <div className="kpi-card-custom" onClick={() => showPage('ckd-prediction')}>
            <div style={{ background: '#fff5f7', color: '#9f1239', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="activity" size={20} />
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>CKD Risk</span>
              <strong style={{ fontSize: '17px', color: '#9f1239' }}>
                {latestPrediction ? `${latestPrediction.risk_percent.toFixed(1)}%` : 'N/A'}
              </strong>
              <span style={{ fontSize: '9px', color: '#16a34a', display: 'block', fontWeight: 'bold', marginTop: '2px' }}>View Details ➔</span>
            </div>
          </div>

          {/* Card: Stage */}
          <div className="kpi-card-custom" onClick={() => showPage('ckd-prediction')}>
            <div style={{ background: '#fffbeb', color: '#f59e0b', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="activity" size={20} />
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>CKD Stage</span>
              <strong style={{ fontSize: '17px', color: '#f59e0b' }}>
                {latestPrediction ? latestPrediction.stage : 'N/A'}
              </strong>
              <span style={{ fontSize: '9px', color: '#f59e0b', display: 'block', fontWeight: 'bold', marginTop: '2px' }}>
                {latestPrediction ? 'View Details ➔' : 'Not Screened'}
              </span>
            </div>
          </div>

          {/* Card: eGFR */}
          <div className="kpi-card-custom" onClick={() => showPage('ckd-prediction')}>
            <div style={{ background: '#f0fdf4', color: '#16a34a', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="lab" size={20} />
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>eGFR Rate</span>
              <strong style={{ fontSize: '17px', color: '#16a34a' }}>
                {latestPrediction ? `${latestPrediction.egfr} mL` : 'N/A'}
              </strong>
              <span style={{ fontSize: '9px', color: '#16a34a', display: 'block', fontWeight: 'bold', marginTop: '2px' }}>View Details ➔</span>
            </div>
          </div>

          {/* Card: ACR */}
          <div className="kpi-card-custom" onClick={() => showPage('ckd-prediction')}>
            <div style={{ background: '#eff6ff', color: '#2563eb', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="lab" size={20} />
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>ACR Ratio</span>
              <strong style={{ fontSize: '17px', color: '#2563eb' }}>
                {latestPrediction ? `${latestPrediction.uacr} mg/g` : 'N/A'}
              </strong>
              <span style={{ fontSize: '9px', color: '#2563eb', display: 'block', fontWeight: 'bold', marginTop: '2px' }}>View Details ➔</span>
            </div>
          </div>

          {/* Ultrasound Scan KPI Image Preview Section at Top */}
          <div className="kpi-card-custom" onClick={() => setIsUsModalOpen(true)}>
            {latestUltrasound && latestUltrasound.image_url ? (
              <div style={{ width: '42px', height: '42px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                <img src={latestUltrasound.image_url} alt="US Scan" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <div style={{ background: '#eff6ff', color: '#083b66', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="camera" size={20} />
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Ultrasound Scan</span>
              <strong style={{ fontSize: '15px', color: '#083b66', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {latestUltrasound ? `${latestUltrasound.severity} Scan` : 'No Image'}
              </strong>
              <span style={{ fontSize: '9px', color: '#083b66', display: 'block', fontWeight: 'bold', marginTop: '2px' }}>View Scan ➔</span>
            </div>
          </div>

          {/* Card: Last Assessed */}
          <div className="kpi-card-custom">
            <div style={{ background: '#eff6ff', color: '#083b66', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="calendar" size={20} />
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Last Assessed</span>
              <strong style={{ fontSize: '13px', color: '#475569', display: 'block', marginTop: '2px' }}>
                {latestPrediction ? getRelativeTime(latestPrediction.timestamp) : 'N/A'}
              </strong>
              <span style={{ fontSize: '9px', color: '#64748b', display: 'block' }}>View History</span>
            </div>
          </div>

          {/* Card: Health Status */}
          <div className="kpi-card-custom">
            <div style={{ background: '#f5f5f5', color: '#4b5563', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="shield" size={20} />
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Health Status</span>
              <strong style={{
                fontSize: '13px',
                color: !latestPrediction ? '#4b5563' : latestPrediction.risk_percent < 20 ? '#15803d' : latestPrediction.risk_percent < 45 ? '#b45309' : '#b91c1c',
                display: 'block',
                marginTop: '2px'
              }}>
                {!latestPrediction ? 'Unknown' : latestPrediction.risk_percent < 20 ? 'Optimal' : latestPrediction.risk_percent < 45 ? 'Needs Monitoring' : 'Critical'}
              </strong>
              <span style={{ fontSize: '9px', color: '#64748b' }}>View Insights</span>
            </div>
          </div>

        </section>

        {/* 2. MAIN SPLIT GRID: LEFT (Risk, Stage, Labs) vs RIGHT (Big Ultrasound Diagnostic Scan Card) */}
        <div className="dashboard-main-grid">
          
          {/* LEFT SUB-COLUMN: Risk, Stage, and Tabbed Labs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Risk and Stage Side-by-Side */}
            <div className="dashboard-charts-grid">
              
              {/* Card: AI Clinical Risk Assessment */}
              <div className="card-custom">
                <div className="card-custom-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon name="activity" size={18} />
                    <h3>AI Clinical Risk Assessment</h3>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                  {latestPrediction ? (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                      {/* Gauge dial */}
                      <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                        <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx="50" cy="50" r={riskRadius} fill="transparent" stroke="#f1f5f9" strokeWidth={riskStroke} />
                          <circle 
                            cx="50" 
                            cy="50" 
                            r={riskRadius} 
                            fill="transparent" 
                            stroke={riskPercent > 40 ? '#ef4444' : riskPercent > 20 ? '#f59e0b' : '#10b981'} 
                            strokeWidth={riskStroke} 
                            strokeDasharray={riskCircumference}
                            strokeDashoffset={riskOffset}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <strong style={{ fontSize: '18px', color: '#083b66' }}>{riskPercent.toFixed(0)}%</strong>
                          <span style={{ fontSize: '9px', color: '#64748b' }}>Risk</span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: riskPercent < 20 ? '#dcfce7' : riskPercent < 45 ? '#fef3c7' : '#fee2e2',
                          color: riskPercent < 20 ? '#166534' : riskPercent < 45 ? '#92400e' : '#991b1b'
                        }}>
                          {riskPercent < 20 ? 'Low Risk Group' : riskPercent < 45 ? 'Moderate' : 'Severe'}
                        </span>
                      </div>

                      <button 
                        type="button" 
                        onClick={() => showPage('ckd-prediction')} 
                        style={{ width: '100%', background: '#9f1239', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                      >
                        New Assessment
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
                      <p>Run risk calculations.</p>
                      <button type="button" className="login-btn-primary" onClick={() => showPage('ckd-prediction')}>Start</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Card: Clinical Stage Status */}
              <div className="card-custom">
                <div className="card-custom-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon name="activity" size={18} />
                    <h3>Clinical Stage Status</h3>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', flex: 1 }}>
                  {latestPrediction ? (
                    <>
                      <div>
                        <strong style={{ fontSize: '20px', color: '#083b66' }}>{latestPrediction.stage}</strong>
                        <span style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          {getStageDescription(latestPrediction.stage)}
                        </span>
                      </div>

                      {/* Horizontal progression line timeline */}
                      <div style={{ position: 'relative', marginTop: '8px', marginBottom: '8px' }}>
                        <div style={{ position: 'absolute', top: '7px', left: '10px', right: '10px', height: '2px', background: '#e2e8f0', zIndex: 1 }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                          {['Stage 1', 'Stage 2', 'Stage 3a', 'Stage 3b', 'Stage 4', 'Stage 5'].map((stg, idx) => {
                            const activeIdx = getStageIndex(latestPrediction.stage)
                            const isReached = idx <= activeIdx
                            const isCurrent = idx === activeIdx
                            return (
                              <div key={stg} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  background: isCurrent ? '#9F1239' : isReached ? '#f59e0b' : '#cbd5e1',
                                  border: '2.5px solid #ffffff',
                                  boxShadow: '0 1.5px 3px rgba(0,0,0,0.1)'
                                }} />
                                <span style={{ fontSize: '8px', fontWeight: 'bold', color: isCurrent ? '#083b66' : '#64748b', marginTop: '4px' }}>
                                  {stg.split(' ')[1]}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: '13.5px', padding: '20px 0' }}>
                      <button type="button" className="login-btn-primary" onClick={() => showPage('ckd-prediction')}>Run Screening</button>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Split row: Laboratory Values (narrower) & AI Meal Planner */}
            <div className="dashboard-labs-grid">
              
              {/* Card: Laboratory Values Dashboard */}
              <div className="card-custom">
                <div className="card-custom-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon name="lab" size={18} />
                    <h3>Laboratory Values</h3>
                  </div>
                  {/* Sub-tabs menu */}
                  <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                    <button type="button" className={`lab-tab-btn ${activeLabTab === 'kidney' ? 'active' : ''}`} onClick={() => setActiveLabTab('kidney')}>Kidney Function</button>
                    <button type="button" className={`lab-tab-btn ${activeLabTab === 'electrolytes' ? 'active' : ''}`} onClick={() => setActiveLabTab('electrolytes')}>Electrolytes</button>
                    <button type="button" className={`lab-tab-btn ${activeLabTab === 'blood' ? 'active' : ''}`} onClick={() => setActiveLabTab('blood')}>Blood Profile</button>
                    <button type="button" className={`lab-tab-btn ${activeLabTab === 'all' ? 'active' : ''}`} onClick={() => setActiveLabTab('all')}>All</button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                  {latestPrediction ? (
                    <>
                      {/* Item: Creatinine (Kidney, All) */}
                      {(activeLabTab === 'kidney' || activeLabTab === 'all') && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                            <span style={{ color: '#334155' }}>Serum Creatinine</span>
                            <span style={{ color: latestPrediction.creatinine > 1.2 ? '#ef4444' : '#16a34a' }}>{latestPrediction.creatinine} mg/dL</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                            <span>Ref: 0.6 - 1.2 mg/dL</span>
                            <span style={{ fontWeight: 'bold', color: latestPrediction.creatinine > 1.2 ? '#b91c1c' : '#15803d' }}>
                              {latestPrediction.creatinine > 1.2 ? 'Elevated' : 'Normal'}
                            </span>
                          </div>
                          <div className="custom-prog-bar">
                            <div className="custom-prog-fill" style={{ width: `${getProgressPercent(latestPrediction.creatinine, 0.6, 1.2)}%`, background: latestPrediction.creatinine > 1.2 ? '#ef4444' : '#10b981' }} />
                          </div>
                        </div>
                      )}

                      {/* Item: BUN / Urea (Kidney, All) */}
                      {(activeLabTab === 'kidney' || activeLabTab === 'all') && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                            <span style={{ color: '#334155' }}>Blood Urea (BUN)</span>
                            <span style={{ color: latestPrediction.blood_urea > 20 ? '#ef4444' : '#16a34a' }}>{latestPrediction.blood_urea} mg/dL</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                            <span>Ref: 7 - 20 mg/dL</span>
                            <span style={{ fontWeight: 'bold', color: latestPrediction.blood_urea > 20 ? '#b91c1c' : '#15803d' }}>
                              {latestPrediction.blood_urea > 20 ? 'High' : 'Normal'}
                            </span>
                          </div>
                          <div className="custom-prog-bar">
                            <div className="custom-prog-fill" style={{ width: `${getProgressPercent(latestPrediction.blood_urea, 7, 20)}%`, background: latestPrediction.blood_urea > 20 ? '#ef4444' : '#10b981' }} />
                          </div>
                        </div>
                      )}

                      {/* Item: eGFR Rate (Kidney, All) */}
                      {(activeLabTab === 'kidney' || activeLabTab === 'all') && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                            <span style={{ color: '#334155' }}>eGFR Rate</span>
                            <span style={{ color: latestPrediction.egfr < 90 ? '#f59e0b' : '#10b981' }}>{latestPrediction.egfr} mL/min</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                            <span>Ref: &gt; 90 mL/min</span>
                            <span style={{ fontWeight: 'bold', color: latestPrediction.egfr < 90 ? '#b45309' : '#15803d' }}>
                              {latestPrediction.egfr < 90 ? 'Moderate' : 'Optimal'}
                            </span>
                          </div>
                          <div className="custom-prog-bar">
                            <div className="custom-prog-fill" style={{ width: `${getProgressPercent(latestPrediction.egfr, 60, 120)}%`, background: latestPrediction.egfr < 90 ? '#f59e0b' : '#10b981' }} />
                          </div>
                        </div>
                      )}

                      {/* Item: Sodium (Electrolytes, All) */}
                      {(activeLabTab === 'electrolytes' || activeLabTab === 'all') && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                            <span style={{ color: '#334155' }}>Sodium</span>
                            <span style={{ color: '#16a34a' }}>{latestPrediction.sodium} mEq/L</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                            <span>Ref: 135 - 145 mEq/L</span>
                            <span style={{ fontWeight: 'bold', color: '#15803d' }}>Normal</span>
                          </div>
                          <div className="custom-prog-bar">
                            <div className="custom-prog-fill" style={{ width: `${getProgressPercent(latestPrediction.sodium, 135, 145)}%`, background: '#10b981' }} />
                          </div>
                        </div>
                      )}

                      {/* Item: Potassium (Electrolytes, All) */}
                      {(activeLabTab === 'electrolytes' || activeLabTab === 'all') && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                            <span style={{ color: '#334155' }}>Potassium</span>
                            <span style={{ color: latestPrediction.potassium > 5.0 ? '#ef4444' : '#16a34a' }}>{latestPrediction.potassium} mmol/L</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                            <span>Ref: 3.5 - 5.0 mmol/L</span>
                            <span style={{ fontWeight: 'bold', color: latestPrediction.potassium > 5.0 ? '#b91c1c' : '#15803d' }}>
                              {latestPrediction.potassium > 5.0 ? 'High' : 'Normal'}
                            </span>
                          </div>
                          <div className="custom-prog-bar">
                            <div className="custom-prog-fill" style={{ width: `${getProgressPercent(latestPrediction.potassium, 3.5, 5.0)}%`, background: latestPrediction.potassium > 5.0 ? '#ef4444' : '#10b981' }} />
                          </div>
                        </div>
                      )}

                      {/* Item: Hemoglobin (Blood, All) */}
                      {(activeLabTab === 'blood' || activeLabTab === 'all') && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                            <span style={{ color: '#334155' }}>Hemoglobin</span>
                            <span style={{ color: '#16a34a' }}>{latestPrediction.hemoglobin} g/dL</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                            <span>Ref: 12.0 - 17.5 g/dL</span>
                            <span style={{ fontWeight: 'bold', color: '#15803d' }}>Normal</span>
                          </div>
                          <div className="custom-prog-bar">
                            <div className="custom-prog-fill" style={{ width: `${getProgressPercent(latestPrediction.hemoglobin, 12, 17.5)}%`, background: '#10b981' }} />
                          </div>
                        </div>
                      )}

                    </>
                  ) : (
                    <div style={{ color: '#64748b', fontSize: '13px', padding: '20px 0', textAlign: 'center' }}>
                      No lab metrics available.
                    </div>
                  )}
                </div>
              </div>

              {/* Card: AI Meal Planner */}
              <div className="card-custom">
                <div className="card-custom-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#083b66', display: 'inline-flex' }}><Icon name="food" size={18} /></span>
                    <h3 style={{ color: '#083b66' }}>AI Meal Planner</h3>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' }}>
                  {mealPlan ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {(['breakfast', 'lunch', 'dinner'] as const).map((slot) => {
                        const foods = mealPlan[slot]
                        if (!foods || foods.length === 0) return null
                        return (
                          <div key={slot} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', display: 'block' }}>
                              {slot}
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                              {foods.map((food) => (
                                <span 
                                  key={food.food_name} 
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: food.status.toLowerCase() === 'good' ? '#dcfce7' : food.status.toLowerCase() === 'limit' ? '#fef3c7' : '#fee2e2',
                                    color: food.status.toLowerCase() === 'good' ? '#166534' : food.status.toLowerCase() === 'limit' ? '#92400e' : '#991b1b'
                                  }}
                                >
                                  {food.display_name || food.food_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                      <p style={{ margin: '0 0 12px' }}>No active meal plan generated.</p>
                      <button 
                        type="button" 
                        onClick={() => showPage('food-tools')} 
                        style={{ background: '#083b66', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        Generate Meal Plan
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT SUB-COLUMN: BIG ULTRASOUND DIAGNOSTIC SCAN CARD */}
          <div className="card-custom" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
            <div className="card-custom-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#083b66', display: 'inline-flex' }}><Icon name="camera" size={20} /></span>
                <h3 style={{ color: '#083b66' }}>Ultrasound Diagnostic Scan</h3>
              </div>
              {latestUltrasound && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  background: latestUltrasound.severity === 'Normal' ? '#dcfce7' : '#fee2e2',
                  color: latestUltrasound.severity === 'Normal' ? '#166534' : '#991b1b'
                }}>
                  {latestUltrasound.severity}
                </span>
              )}
            </div>

            {latestUltrasound ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                
                {/* Large structured medical ultrasound image window */}
                {latestUltrasound.image_url ? (
                  <div style={{ width: '100%', height: '220px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #cbd5e1', position: 'relative', background: '#020617' }}>
                    <img 
                      src={latestUltrasound.image_url} 
                      alt="Diagnostic Scan View" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.85 }} 
                    />
                    
                    {/* Simulated live medical ROI crosshair bounding box */}
                    <div style={{ position: 'absolute', top: '10%', left: '15%', right: '15%', bottom: '20%', border: '1px dashed #10b981', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(2,6,23,0.75)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', border: '1px solid rgba(16,185,129,0.3)' }}>
                      ⬤ ROI BOUNDARIES CONNECTED
                    </div>
                    <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(2,6,23,0.75)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold' }}>
                      Diagnostic Area Target
                    </div>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '220px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1', color: '#94a3b8', fontSize: '13px', gap: '8px' }}>
                    <Icon name="camera" size={32} />
                    <span>No Scan Image Logged</span>
                  </div>
                )}

                {/* Measurements and size indicators */}
                <div className="dashboard-twin-mini-grid">
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>KIDNEY LENGTH</span>
                    <span style={{ fontSize: '11.5px', color: '#334155', display: 'block', lineHeight: '1.4' }}>
                      Normal range is <strong>100 - 120 mm</strong>. Shrinkage below 90 mm indicates kidney atrophy or scarring.
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>CORTEX THICKNESS</span>
                    <span style={{ fontSize: '11.5px', color: '#334155', display: 'block', lineHeight: '1.4' }}>
                      Normal range is <strong>15 - 25 mm</strong>. Thinning below 10 mm indicates nephron loss and chronic damage.
                    </span>
                  </div>
                </div>

                {/* Bullet findings */}
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>AI Clinical Observations</span>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                    {latestUltrasound.observations.slice(0, 3).map((obs, idx) => (
                      <li key={idx} style={{ marginBottom: '6px' }}>{obs}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  <button 
                    type="button" 
                    onClick={() => setIsUsModalOpen(true)}
                    style={{ flex: 1, background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    View All Observations
                  </button>
                  <button 
                    type="button" 
                    onClick={() => showPage('ultrasound')}
                    style={{ flex: 1, background: '#083b66', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Configure Scan
                  </button>
                </div>

              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#64748b', fontSize: '13.5px', padding: '40px 0', textAlign: 'center' }}>
                <span style={{ color: '#083b66', marginBottom: '12px', display: 'inline-flex' }}><Icon name="camera" size={36} /></span>
                <p style={{ margin: '0 0 12px' }}>Upload renal structural scanner imagery to generate visual diagnostics.</p>
                <button type="button" className="login-btn-primary" onClick={() => showPage('ultrasound')} style={{ background: '#083b66' }}>Upload Scan</button>
              </div>
            )}

          </div>

        </div>

        {/* 3. BOTTOM SECTION: RECENT LABS LIST, AI DIET GUIDES, SYMPTOMS, ACTIONS */}
        <div className="dashboard-bottom-grid">
          
          {/* Card: Recent Laboratory Results */}
          <div className="card-custom" style={{ textAlign: 'left' }}>
            <div className="card-custom-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="lab" size={18} />
                <h3>Recent Lab Results</h3>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {predictions.slice(0, 4).map((p, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', display: 'block' }}>Assessment Result</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(p.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'block' }}>eGFR: {p.egfr}</span>
                    <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>Normal</span>
                  </div>
                </div>
              ))}
              {predictions.length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: '13px', padding: '20px 0', textAlign: 'center' }}>No logs yet.</div>
              )}
            </div>
          </div>

          {/* Card: AI Dietary Recommendations */}
          <div className="card-custom" style={{ textAlign: 'left' }}>
            <div className="card-custom-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="heart" size={18} />
                <h3>AI Recommendations</h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <strong style={{ fontSize: '12px', color: '#166534', display: 'block', marginBottom: '4px' }}>Recommended Foods</strong>
                <span style={{ fontSize: '12px', color: '#14532d', lineHeight: 1.4 }}>Apples, Blueberries, Cabbage, Cauliflower, Egg Whites.</span>
              </div>
              <div style={{ background: '#fff1f2', padding: '12px', borderRadius: '10px', border: '1px solid #fecdd3' }}>
                <strong style={{ fontSize: '12px', color: '#991b1b', display: 'block', marginBottom: '4px' }}>Limit or Avoid</strong>
                <span style={{ fontSize: '12px', color: '#7f1d1d', lineHeight: 1.4 }}>Bananas, Processed meats, Dark colas, High-sodium chips.</span>
              </div>
            </div>
          </div>

          {/* Card: Symptom Tracker */}
          <div className="card-custom" style={{ textAlign: 'left' }}>
            <div className="card-custom-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="activity" size={18} />
                <h3>Symptom Tracker</h3>
              </div>
              <span style={{ background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}>Load: {symptomScore}%</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {['fatigue', 'swelling', 'nausea', 'appetite', 'urination', 'itchySkin', 'shortnessOfBreath', 'metallicTaste', 'urinationChanges'].map((symp) => {
                const sKey = symp as keyof Omit<SymptomLog, 'timestamp'>
                const currentVal = latestSymptoms[sKey] || 'none'
                
                // Friendly display name
                let displayName = symp
                if (symp === 'appetite') displayName = 'loss of appetite'
                if (symp === 'itchySkin') displayName = 'itchy skin'
                if (symp === 'shortnessOfBreath') displayName = 'shortness of breath'
                if (symp === 'metallicTaste') displayName = 'metallic taste'
                if (symp === 'urinationChanges') displayName = 'urination changes'

                return (
                  <div key={symp} className="symptom-row">
                    <span className="symptom-name">{displayName}</span>
                    <div className="symptom-buttons">
                      {['none', 'mild', 'severe'].map((sev) => {
                        const active = currentVal === sev
                        return (
                          <button
                            key={sev}
                            type="button"
                            onClick={() => handleSymptomChange(sKey, sev as any)}
                            className="symptom-btn"
                            style={{
                              background: active ? (sev === 'none' ? '#cbd5e1' : sev === 'mild' ? '#dcfce7' : '#fee2e2') : '#f1f5f9',
                              color: active ? (sev === 'none' ? '#0f172a' : sev === 'mild' ? '#15803d' : '#b91c1c') : '#64748b'
                            }}
                          >
                            <span className="btn-short">{sev === 'none' ? 'N' : sev === 'mild' ? 'M' : 'S'}</span>
                            <span className="btn-full">{sev === 'none' ? 'None' : sev === 'mild' ? 'Mild' : 'Severe'}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Card: Quick Actions */}
          <div className="card-custom" style={{ textAlign: 'left' }}>
            <div className="card-custom-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="shield" size={18} />
                <h3>Quick Actions</h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <button type="button" onClick={() => showPage('ckd-prediction')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', width: '100%', fontSize: '12.5px', fontWeight: 'bold', color: '#475569' }}>
                <span>Add New Lab Result</span>
                <span>➔</span>
              </button>
              <button type="button" onClick={generateDoctorReport} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', width: '100%', fontSize: '12.5px', fontWeight: 'bold', color: '#475569' }}>
                <span>Download Report Summary</span>
                <span>➔</span>
              </button>
              <button type="button" onClick={() => showPage('chatbot')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', width: '100%', fontSize: '12.5px', fontWeight: 'bold', color: '#475569' }}>
                <span>Consult AI Assistant</span>
                <span>➔</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Ultrasound observations detailed view Modal */}
      {isUsModalOpen && latestUltrasound && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', maxWidth: '520px', width: '100%', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', textAlign: 'left', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#083b66', fontWeight: 'bold' }}>Detailed Ultrasound Observations</h3>
              <button 
                type="button" 
                onClick={() => setIsUsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '24px', fontWeight: 'bold', color: '#ef4444', cursor: 'pointer', padding: '0 8px', marginTop: '-4px' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px', color: '#334155' }}>
              <div><strong>Scan Severity Rating:</strong> {latestUltrasound.severity}</div>
              {latestUltrasound.kidney_size_mm && (
                <div><strong>Kidney Size:</strong> {latestUltrasound.kidney_size_mm} mm</div>
              )}
              {latestUltrasound.cortical_thickness_mm && (
                <div><strong>Cortical Thickness:</strong> {latestUltrasound.cortical_thickness_mm} mm</div>
              )}
              <div><strong>Image Capture Quality:</strong> {latestUltrasound.image_quality}</div>
              
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <strong>AI Extracted Findings:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: '20px', lineHeight: 1.5 }}>
                  {latestUltrasound.observations.map((obs, index) => (
                    <li key={index} style={{ marginBottom: '4px' }}>{obs}</li>
                  ))}
                </ul>
              </div>

              {latestUltrasound.image_url && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', textAlign: 'center' }}>
                  <img src={latestUltrasound.image_url} alt="Full Scan" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'contain' }} />
                </div>
              )}

              <div style={{ background: '#eff6ff', color: '#1e40af', padding: '12px', borderRadius: '8px', fontSize: '12.5px', marginTop: '6px' }}>
                <strong>Recommendation:</strong> {latestUltrasound.recommendation}
              </div>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button 
                type="button" 
                onClick={() => setIsUsModalOpen(false)}
                style={{ background: '#083b66', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
