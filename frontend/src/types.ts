export type Page = 'home' | 'ckd-prediction' | 'food-tools' | 'login' | 'signup' | 'dashboard' | 'ultrasound' | 'doctor-summary' | 'alerts' | 'lab-report' | 'chatbot' | 'settings' | 'voice-assist'

export type PredictionForm = {
  age: number | ''
  sex: string
  urine_albumin: number | ''
  blood_pressure: number | ''
  blood_glucose_random: number | ''
  blood_urea: number | ''
  serum_creatinine: number | ''
  sodium: number | ''
  potassium: number | ''
  hemoglobin: number | ''
  hypertension: string
  diabetes_mellitus: string
}

export type PredictionResult = {
  input: PredictionForm
  model: { source: string; trained_model_available: boolean; model_error?: string | null }
  risk: { probability: number; percent: number; label: string }
  kidney_function: { egfr_2021: number | null; egfr_category: string }
  lab_markers: { key: string; label: string; value: number; unit: string; status: string; range: string }[]
  warnings: { key: string; label: string; value: number; unit: string; status: string; range: string }[]
  recommendations: string[]
}

export type FoodAnalysis = {
  food_name: string
  display_name?: string
  category: string
  protein_g: number
  energy_kcal: number
  potassium_mg: number
  phosphorus_mg: number
  sodium_mg: number
  status: string
  kidney_score: number
  matched_food?: string
  image_url?: string
}

export type FoodScanResponse = {
  detected_foods: string[]
  analyses: FoodAnalysis[]
  warning?: string | null
}

export type FoodPlanResponse = {
  stage: string
  recommendations: FoodAnalysis[]
}

export type MealPlanResponse = {
  breakfast: FoodAnalysis[]
  lunch: FoodAnalysis[]
  snack: FoodAnalysis[]
  dinner: FoodAnalysis[]
  notes: string[]
}

export type UltrasoundScanResult = {
  image_quality: string
  observations: string[]
  severity: string
  recommendation: string
  error?: string
  cnn_predicted_class?: string
  cnn_confidence?: number
  cnn_confidence_std?: number
  cnn_probabilities?: number[]
  cnn_std_deviations?: number[]
  cnn_entropy?: number
  cnn_normalized_entropy?: number
  cnn_warning?: boolean
  gcam_img_base64?: string
  attention_img_base64?: string
  cnn_error?: string
}

export type ToastType = 'danger' | 'warning' | 'info' | 'success' | 'whatsapp';

export type Toast = {
  id: string
  type: ToastType
  title: string
  message: string
  action?: { label: string; url: string }
}

export type WhatsAppLog = {
  timestamp: string;
  title: string;
  message: string;
  status: 'Sent' | 'Simulated' | 'Failed';
}

export type StageProgressionResult = {
  current_stage: string
  stage_probabilities: Record<string, number>
  egfr: number | null
  annual_decline_rate: number
  progression_timeline: { stage: string; months: number; label: string }[]
  risk_factors: string[]
  model_info: {
    xgb_accuracy: number | null
    dnn_mae: number | null
    dnn_architecture: string
    dataset: string
  }
}
