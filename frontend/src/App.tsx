import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { MobileBottomNav } from './components/MobileBottomNav'
import { Icon } from './components/Icon'
import { API_BASE_URL, blankPredictionForm, initialPredictionForm, numericPredictionKeys } from './constants'
import { FoodToolsPage, type FoodStage, type FoodTab, type YesNo } from './pages/FoodToolsPage'
import { HomePage } from './pages/HomePage'
import { PredictionPage, type PredictionStep } from './pages/PredictionPage'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { UltrasoundPage } from './pages/UltrasoundPage'
import { DoctorSummaryPage } from './pages/DoctorSummaryPage'
import { AlertsPage } from './pages/AlertsPage'
import { LabReportPage } from './pages/LabReportPage'
import { ChatbotPage } from './pages/ChatbotPage'
import { SettingsPage } from './pages/SettingsPage'
import { VoiceAssistPage } from './pages/VoiceAssistPage'
import type { FoodAnalysis, FoodPlanResponse, FoodScanResponse, MealPlanResponse, Page, PredictionForm, PredictionResult, UltrasoundScanResult, Toast, ToastType } from './types'
import { reportData } from './utils/format'
import { useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'

function App() {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [featuresOpen, setFeaturesOpen] = useState(false)
  const [page, setPage] = useState<Page>('home')
  const [form, setForm] = useState<PredictionForm>(initialPredictionForm)
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [predictionStep, setPredictionStep] = useState<PredictionStep>('calculator')
  const [uploadStatus, setUploadStatus] = useState('')
  const [extractedFields, setExtractedFields] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [foodTab, setFoodTab] = useState<FoodTab>('scan')
  const [foodName, setFoodName] = useState('')
  const [foodStage, setFoodStage] = useState<FoodStage>('G3a')
  const [foodHypertension, setFoodHypertension] = useState<YesNo>('no')
  const [foodDiabetes, setFoodDiabetes] = useState<YesNo>('no')
  const [foodLoading, setFoodLoading] = useState(false)
  const [foodError, setFoodError] = useState('')
  const [foodScan, setFoodScan] = useState<FoodScanResponse | null>(null)
  const [foodCheck, setFoodCheck] = useState<FoodAnalysis | null>(null)
  const [foodRecommendations, setFoodRecommendations] = useState<FoodAnalysis[]>([])
  const [mealPlan, setMealPlan] = useState<MealPlanResponse | null>(null)
  const [foodImagePreview, setFoodImagePreview] = useState('')
  const [ultrasoundResult, setUltrasoundResult] = useState<UltrasoundScanResult | null>(null)
  const [ultrasoundMetrics, setUltrasoundMetrics] = useState<{ egfr: number; probability: number } | null>(null)
  const [ultrasoundPreview, setUltrasoundPreview] = useState<string>('')

  // Global Toasts for Alerts
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (
    type: ToastType, 
    title: string, 
    message: string,
    action?: { label: string; url: string }
  ) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { id, type, title, message, action }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, action ? 8000 : 4500)
  }

  // Background Reminder Engine
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const medReminder = window.localStorage.getItem('nephrocare_med_reminder') === 'true';
      const foodReminder = window.localStorage.getItem('nephrocare_food_reminder') === 'true';
      const whatsappEnabled = window.localStorage.getItem('nephrocare_whatsapp_enabled') === 'true';
      const phoneRaw = window.localStorage.getItem('nephrocare_phone') || '';
      const phone = phoneRaw.replace(/"/g, ''); // Clean quotes if any
      const now = new Date();

      const sendBackgroundWhatsApp = async (title: string, message: string) => {
        if (!whatsappEnabled || !phone) return;
        try {
          const response = await fetch(`${API_BASE_URL}/api/send-whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: phone,
              message: `🔔 NephroCare Reminder\n\n*${title}*\n${message}`
            })
          });
          const data = await response.json();
          if (data.success) {
            addToast('whatsapp', 'WhatsApp Alert Sent', `📱 Sent to ${phone}: ${title}`);
            const wLogs = JSON.parse(window.localStorage.getItem('nephrocare_whatsapp_history') || '[]');
            window.localStorage.setItem('nephrocare_whatsapp_history', JSON.stringify([{ timestamp: new Date().toISOString(), title, message, status: 'Sent' }, ...wLogs].slice(0, 50)));
            window.dispatchEvent(new Event('storage'));
          } else {
            addToast('whatsapp', 'WhatsApp Simulated', `📱 [Simulated to ${phone}]: ${title}`);
            const wLogs = JSON.parse(window.localStorage.getItem('nephrocare_whatsapp_history') || '[]');
            window.localStorage.setItem('nephrocare_whatsapp_history', JSON.stringify([{ timestamp: new Date().toISOString(), title, message, status: 'Simulated' }, ...wLogs].slice(0, 50)));
            window.dispatchEvent(new Event('storage'));
          }
        } catch (err) {
          console.error('Failed to send background WhatsApp:', err);
        }
      };

      const reminderFreq = window.localStorage.getItem('nephrocare_med_freq') || 'Twice daily';
      const reminderTime1 = window.localStorage.getItem('nephrocare_med_time1') || '08:00';
      const reminderTime2 = window.localStorage.getItem('nephrocare_med_time2') || '20:00';

      const formatTime = (d: Date) => {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      };
      const currentTimeStr = formatTime(now);
      const todayStr = now.toDateString();

      if (medReminder) {
        // 1. Check actual scheduled time matching
        if (currentTimeStr === reminderTime1) {
          const lastSentDose1 = window.localStorage.getItem('nephrocare_last_med_dose1_date');
          if (lastSentDose1 !== todayStr) {
            const title = 'Medication Reminder (First Dose)';
            const msg = `It is time to take your morning CKD medication dose (scheduled at ${reminderTime1}).`;
            addToast('info', title, msg);
            sendBackgroundWhatsApp(title, msg);
            window.localStorage.setItem('nephrocare_last_med_dose1_date', todayStr);
          }
        }

        if (reminderFreq === 'Twice daily' || reminderFreq === 'Three times daily') {
          if (currentTimeStr === reminderTime2) {
            const lastSentDose2 = window.localStorage.getItem('nephrocare_last_med_dose2_date');
            if (lastSentDose2 !== todayStr) {
              const title = 'Medication Reminder (Second Dose)';
              const msg = `It is time to take your evening CKD medication dose (scheduled at ${reminderTime2}).`;
              addToast('info', title, msg);
              sendBackgroundWhatsApp(title, msg);
              window.localStorage.setItem('nephrocare_last_med_dose2_date', todayStr);
            }
          }
        }

        // 2. Active demo mode fallback: if no alert was EVER sent, trigger an initial demo alert to show it works
        const totalAlertsSent = window.localStorage.getItem('nephrocare_total_med_alerts_sent') || '0';
        if (totalAlertsSent === '0') {
          const title = 'Medication Reminder (Demo)';
          const msg = `This is a test reminder to verify your schedule settings. Your daily schedule is set to: ${reminderFreq} (${reminderTime1} / ${reminderTime2}).`;
          addToast('info', title, msg);
          sendBackgroundWhatsApp(title, msg);
          window.localStorage.setItem('nephrocare_total_med_alerts_sent', '1');
        }
      } else {
        // Reset demo counter if they toggle it off so they can test it again
        window.localStorage.setItem('nephrocare_total_med_alerts_sent', '0');
      }

      if (foodReminder) {
        // 1. Check actual scheduled meal times (Breakfast, Lunch, Dinner)
        const mealTimes = ['09:00', '13:00', '20:00'];
        if (mealTimes.includes(currentTimeStr)) {
          const lastSentFood = window.localStorage.getItem(`nephrocare_last_food_sent_${currentTimeStr}`);
          if (lastSentFood !== todayStr) {
            const title = 'Dietary Reminder';
            const msg = 'Have you logged your recent meals? Ensure they align with your kidney-safe diet plan.';
            addToast('success', title, msg);
            sendBackgroundWhatsApp(title, msg);
            window.localStorage.setItem(`nephrocare_last_food_sent_${currentTimeStr}`, todayStr);
          }
        }

        // 2. Active demo mode fallback for diet
        const totalFoodAlertsSent = window.localStorage.getItem('nephrocare_total_food_alerts_sent') || '0';
        if (totalFoodAlertsSent === '0') {
          const title = 'Dietary Reminder (Demo)';
          const msg = 'This is a test dietary reminder to verify your food log settings. (Fluid Limit: ' + (window.localStorage.getItem('nephrocare_fluid_limit') || '1.5') + 'L/day).';
          addToast('success', title, msg);
          sendBackgroundWhatsApp(title, msg);
          window.localStorage.setItem('nephrocare_total_food_alerts_sent', '1');
        }
      } else {
        // Reset demo counter if they toggle it off
        window.localStorage.setItem('nephrocare_total_food_alerts_sent', '0');
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [user]);

  // Synchronize database history data to localStorage on user login
  useEffect(() => {
    const syncDbData = async () => {
      if (!user) return
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) return
        
        // 1. Fetch patient profile
        const profileRes = await fetch(`${API_BASE_URL}/api/patient/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (profileRes.ok) {
          const profile = await profileRes.json()
          if (profile && Object.keys(profile).length > 0) {
            localStorage.setItem('nephrocare_profile', JSON.stringify(profile))
            // Sync form metrics from profile if applicable
            setForm(prev => ({
              ...prev,
              age: profile.dob ? new Date().getFullYear() - new Date(profile.dob).getFullYear() : prev.age,
              sex: profile.gender || prev.sex,
            }))
          }
        }

        // 2. Fetch history
        const historyRes = await fetch(`${API_BASE_URL}/api/patient/history`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (historyRes.ok) {
          const history = await historyRes.json()
          if (history.predictions) {
            localStorage.setItem('nephrocare_predictions', JSON.stringify(history.predictions))
          }
          if (history.scans) {
            localStorage.setItem('nephrocare_ultrasound_scans', JSON.stringify(history.scans))
          }
          if (history.symptoms) {
            localStorage.setItem('nephrocare_symptom_logs', JSON.stringify(history.symptoms))
          }
          if (history.foodChecks) {
            localStorage.setItem('nephrocare_food_checks', JSON.stringify(history.foodChecks))
          }
        }
      } catch (err) {
        console.error('Failed to sync history from database:', err)
      }
    }
    
    syncDbData()
  }, [user])

  const closeMenus = () => {
    setMobileOpen(false)
    setFeaturesOpen(false)
  }

  const scrollTo = (id: string) => {
    setPage('home')
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 0)
    closeMenus()
  }

  const showPage = (nextPage: Page) => {
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    closeMenus()
  }

  const submitPrediction = async (event: FormEvent) => {
    event.preventDefault()
    if (numericPredictionKeys.some(key => form[key] === '') || !form.sex || !form.hypertension || !form.diabetes_mellitus) {
      setError('Fill all values before calculating CKD risk.')
      return
    }
    setLoading(true)
    setError('')
    const predictionPayload = {
      ...form,
      ...Object.fromEntries(numericPredictionKeys.map(key => [key, Number(form[key])])),
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(predictionPayload),
      })
      if (!response.ok) throw new Error('Prediction service is unavailable.')
      const data = await response.json()
      setResult(data)
      
      try {
        const historyJson = localStorage.getItem('nephrocare_predictions')
        const history = historyJson ? JSON.parse(historyJson) : []
        const newEntry = {
          timestamp: new Date().toISOString(),
          egfr: data.kidney_function.egfr_2021 ?? 74,
          creatinine: Number(data.input.serum_creatinine) || 1.1,
          uacr: Number(data.input.urine_albumin) || 24,
          blood_pressure: Number(data.input.blood_pressure) || 80,
          blood_urea: Number(data.input.blood_urea) || 20,
          sodium: Number(data.input.sodium) || 138,
          potassium: Number(data.input.potassium) || 4.4,
          hemoglobin: Number(data.input.hemoglobin) || 13.5,
          risk_percent: data.risk.percent,
          stage: data.kidney_function.egfr_category
        }
        localStorage.setItem('nephrocare_predictions', JSON.stringify([newEntry, ...history]))
        
        const token = localStorage.getItem('auth_token')
        if (user && token) {
          fetch(`${API_BASE_URL}/api/patient/predictions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newEntry)
          }).catch(err => console.error('Failed to save prediction to DB:', err))
        }
      } catch (err) {
        console.error('Failed to save prediction to history:', err)
      }

      setPredictionStep('result')
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
    } catch {
      setError('The risk check is unavailable right now. Please make sure the NephroCare service is running, then try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReportUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadStatus(`Reading ${file.name}...`)
    setExtractedFields([])
    try {
      const payload = new FormData()
      payload.append('report', file)
      const response = await fetch(`${API_BASE_URL}/api/extract-report`, { method: 'POST', body: payload })
      if (!response.ok) throw new Error('Report extraction failed.')
      const data: { values?: Partial<PredictionForm>; matched_fields?: string[]; warning?: string | null } = await response.json()
      setForm(current => ({ ...current, ...(data.values ?? {}) }))
      setExtractedFields(data.matched_fields ?? [])
      setUploadStatus(data.warning ? data.warning : `${data.matched_fields?.length ?? 0} values autofilled from the report.`)
    } catch {
      setUploadStatus('Could not read this report. Make sure the API is running, or enter values manually.')
    } finally {
      event.target.value = ''
    }
  }

  const scanFoodImage = async (image: Blob, filename: string) => {
    setFoodLoading(true)
    setFoodError('')
    setFoodScan(null)
    setFoodImagePreview(current => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(image)
    })
    try {
      const payload = new FormData()
      payload.append('image', image, filename)
      const response = await fetch(`${API_BASE_URL}/api/scan-food-image`, { method: 'POST', body: payload })
      const data: FoodScanResponse & { error?: string } = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not scan the image.')
      setFoodScan(data)
      setFoodTab('scan')
    } catch (err) {
      setFoodError(err instanceof Error ? err.message : 'Could not scan the image.')
    } finally {
      setFoodLoading(false)
    }
  }

  const scanLiveFoodFrame = (image: Blob) => scanFoodImage(image, 'live-food-frame.jpg')

  const checkFood = async (foodNameOverride?: string) => {
    const selectedFood = (foodNameOverride ?? foodName).trim()
    if (!selectedFood) {
      setFoodError('Enter a food name.')
      return
    }
    setFoodName(selectedFood)
    setFoodLoading(true)
    setFoodError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/food-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ food_name: selectedFood }),
      })
      const data: FoodAnalysis & { error?: string } = await response.json()
      if (!response.ok) throw new Error(data.error || 'Food not found.')
      setFoodCheck(data)
      try {
        const historyJson = localStorage.getItem('nephrocare_food_checks')
        const history = historyJson ? JSON.parse(historyJson) : []
        const newEntry = {
          timestamp: new Date().toISOString(),
          food_name: data.food_name,
          safety_status: data.status,
          category: data.category
        }
        localStorage.setItem('nephrocare_food_checks', JSON.stringify([newEntry, ...history].slice(0, 5)))
        
        const token = localStorage.getItem('auth_token')
        if (user && token) {
          fetch(`${API_BASE_URL}/api/patient/food-checks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(newEntry)
          }).catch(err => console.error('Failed to save food check to DB:', err))
        }
      } catch (err) {
        console.error('Failed to save food check to history:', err)
      }
      setFoodTab('check')
    } catch (err) {
      setFoodError(err instanceof Error ? err.message : 'Food not found.')
    } finally {
      setFoodLoading(false)
    }
  }

  const loadRecommendations = async () => {
    setFoodLoading(true)
    setFoodError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/food-recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: result ? result.kidney_function.egfr_category : foodStage,
          hypertension: foodHypertension,
          diabetes_mellitus: foodDiabetes,
          limit: 6,
        }),
      })
      const data: FoodPlanResponse & { error?: string } = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load recommendations.')
      setFoodRecommendations(data.recommendations)
      setFoodTab('recommend')
    } catch (err) {
      setFoodError(err instanceof Error ? err.message : 'Could not load recommendations.')
    } finally {
      setFoodLoading(false)
    }
  }

  const loadMealPlan = async () => {
    setFoodLoading(true)
    setFoodError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/meal-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: result ? result.kidney_function.egfr_category : foodStage,
          hypertension: foodHypertension,
          diabetes_mellitus: foodDiabetes,
        }),
      })
      const data: MealPlanResponse & { error?: string } = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load meal plan.')
      setMealPlan(data)
      setFoodTab('plan')
    } catch (err) {
      setFoodError(err instanceof Error ? err.message : 'Could not load meal plan.')
    } finally {
      setFoodLoading(false)
    }
  }

  const updateNumber = (key: keyof PredictionForm, value: string) => {
    setForm({ ...form, [key]: value === '' ? '' : Number(value) })
  }

  const updateChoice = (key: keyof PredictionForm, value: string) => {
    setForm({ ...form, [key]: value })
  }

  const resetPrediction = () => {
    setForm(blankPredictionForm)
    setResult(null)
    setUploadStatus('')
    setExtractedFields([])
    setError('')
  }

  const activeReport = result ? reportData(result) : null

  return <div className="site-shell">
    {/* Global Toast Container */}
    <div className="toast-container" style={{ zIndex: 9999 }}>
      {toasts.map(toast => (
        <div key={toast.id} className={`toast-alert-card ${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'danger' && <Icon name="activity" size={24} />}
            {toast.type === 'warning' && <Icon name="alert-triangle" size={24} />}
            {toast.type === 'success' && <Icon name="check-circle" size={24} />}
            {toast.type === 'info' && <Icon name="info" size={24} />}
            {toast.type === 'whatsapp' && <Icon name="message-circle" size={24} />}
          </div>
          <div className="toast-content">
            <h4>{toast.title}</h4>
            <p>{toast.message}</p>
            {toast.action && (
              <a href={toast.action.url} target="_blank" rel="noopener noreferrer" className="toast-action-btn">
                {toast.action.label}
              </a>
            )}
          </div>
        </div>
      ))}
    </div>

    <Header
      mobileOpen={mobileOpen}
      featuresOpen={featuresOpen}
      setMobileOpen={setMobileOpen}
      setFeaturesOpen={setFeaturesOpen}
      showPage={showPage}
      scrollTo={scrollTo}
      closeMenus={closeMenus}
      user={user}
      onLogout={() => {
        logout()
        // Clear demo data so the next login is a fresh slate
        localStorage.removeItem('nephrocare_predictions')
        localStorage.removeItem('nephrocare_ultrasound_scans')
        localStorage.removeItem('nephrocare_symptom_logs')
        localStorage.removeItem('nephrocare_food_checks')
        localStorage.removeItem('nephrocare_profile')
      }}
    />

    {page === 'home' && <HomePage showPage={showPage} />}
    {page === 'login' && <AuthPage initialMode="login" showPage={showPage} onLoginSuccess={() => {}} />}
    {page === 'signup' && <AuthPage initialMode="signup" showPage={showPage} onLoginSuccess={() => {}} />}
    {page === 'dashboard' && <DashboardPage 
      user={user} 
      showPage={showPage} 
      predictionResult={result}
      predictionForm={form}
      mealPlan={mealPlan}
      checkFood={checkFood}
      foodCheck={foodCheck}
      foodScan={foodScan}
      ultrasoundResult={ultrasoundResult}
      ultrasoundMetrics={ultrasoundMetrics}
      setFoodTab={setFoodTab}
      addToast={addToast}
    />}
    {page === 'ultrasound' && <UltrasoundPage 
      showPage={showPage}
      result={ultrasoundResult}
      setResult={setUltrasoundResult}
      metrics={ultrasoundMetrics}
      setMetrics={setUltrasoundMetrics}
      imagePreview={ultrasoundPreview}
      setImagePreview={setUltrasoundPreview}
    />}
    {page === 'doctor-summary' && <DoctorSummaryPage showPage={showPage} user={user} />}
    {page === 'alerts' && <AlertsPage showPage={showPage} user={user} addToast={addToast} />}
    {page === 'chatbot' && <ChatbotPage showPage={showPage} user={user} form={form} />}
    {page === 'settings' && <SettingsPage showPage={showPage} user={user} />}
    {page === 'voice-assist' && <VoiceAssistPage showPage={showPage} user={user} />}
    {page === 'lab-report' && <LabReportPage 
      handleReportUpload={handleReportUpload}
      uploadStatus={uploadStatus}
      extractedFields={extractedFields}
      showPage={showPage}
    />}
    {page === 'food-tools' && <FoodToolsPage
      foodTab={foodTab}
      setFoodTab={setFoodTab}
      foodName={foodName}
      setFoodName={setFoodName}
      foodStage={foodStage}
      setFoodStage={setFoodStage}
      foodHypertension={foodHypertension}
      setFoodHypertension={setFoodHypertension}
      foodDiabetes={foodDiabetes}
      setFoodDiabetes={setFoodDiabetes}
      foodLoading={foodLoading}
      foodError={foodError}
      foodScan={foodScan}
      foodCheck={foodCheck}
      foodRecommendations={foodRecommendations}
      mealPlan={mealPlan}
      foodImagePreview={foodImagePreview}
      showPage={showPage}
      scanFoodImage={scanFoodImage}
      scanLiveFoodFrame={scanLiveFoodFrame}
      checkFood={checkFood}
      loadRecommendations={loadRecommendations}
      loadMealPlan={loadMealPlan}
    />}
    {page === 'ckd-prediction' && <PredictionPage
      predictionStep={predictionStep}
      setPredictionStep={setPredictionStep}
      form={form}
      result={result}
      activeReport={activeReport}
      uploadStatus={uploadStatus}
      extractedFields={extractedFields}
      loading={loading}
      error={error}
      showPage={showPage}
      submitPrediction={submitPrediction}
      handleReportUpload={handleReportUpload}
      updateNumber={updateNumber}
      updateChoice={updateChoice}
      resetPrediction={resetPrediction}
      user={user}
    />}

    <Footer showPage={showPage} scrollTo={scrollTo} addToast={addToast} />
    <MobileBottomNav showPage={showPage} currentPage={page} />
  </div>
}

export default App
