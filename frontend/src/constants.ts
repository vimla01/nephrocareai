import type { IconName } from './components/Icon'
import type { PredictionForm } from './types'

// two env var names supported for historical reasons, fall back to local api
export const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

// drives both the header's "Features" mega-menu and the homepage feature list
export const features = [
  { icon: 'activity' as IconName, title: 'CKD Risk Prediction' },
  { icon: 'food' as IconName, title: 'Nutrition & Intake Care' },
  { icon: 'camera' as IconName, title: 'Ultrasound Analysis' },
  { icon: 'alert' as IconName, title: 'Smart Alerts' },
  { icon: 'chart' as IconName, title: 'Monitoring Dashboard' },
  { icon: 'mic' as IconName, title: 'Voice Prescription Assist' },
]

// pre-filled "healthy-ish" demo values so the calculator isn't empty on first load
export const initialPredictionForm: PredictionForm = {
  age: 48,
  sex: 'female',
  urine_albumin: 30,
  blood_pressure: 80,
  blood_glucose_random: 121,
  blood_urea: 36,
  serum_creatinine: 1.2,
  sodium: 138,
  potassium: 4.4,
  hemoglobin: 15.4,
  hypertension: 'no',
  diabetes_mellitus: 'no',
}

// used by resetPrediction() in App.tsx to clear the form back to empty inputs
export const blankPredictionForm: PredictionForm = {
  age: '',
  sex: '',
  urine_albumin: '',
  blood_pressure: '',
  blood_glucose_random: '',
  blood_urea: '',
  serum_creatinine: '',
  sodium: '',
  potassium: '',
  hemoglobin: '',
  hypertension: '',
  diabetes_mellitus: '',
}

// the subset of form fields that are numbers, not selects - used to validate/coerce before submit
export const numericPredictionKeys: (keyof PredictionForm)[] = [
  'age',
  'urine_albumin',
  'blood_pressure',
  'blood_glucose_random',
  'blood_urea',
  'serum_creatinine',
  'sodium',
  'potassium',
  'hemoglobin',
]

// keyed by the backend's egfr_category codes (G1..G5, Unknown) - shown on the result/report pages
export const stageDescriptions: Record<string, { title: string; description: string }> = {
  G1: { title: 'Stage 1', description: 'Normal or high eGFR. CKD usually requires other evidence such as albumin in urine.' },
  G2: { title: 'Stage 2', description: 'Mild decrease in kidney function. Review albumin and clinical context.' },
  G3a: { title: 'Stage 3a', description: 'Mild to moderate decrease in kidney function.' },
  G3b: { title: 'Stage 3b', description: 'Moderate to severe decrease in kidney function.' },
  G4: { title: 'Stage 4', description: 'Severe decrease in kidney function. Nephrology planning is important.' },
  G5: { title: 'Stage 5', description: 'Kidney failure range. Urgent clinician review is needed.' },
  Unknown: { title: 'Stage unknown', description: 'Stage cannot be estimated from the submitted values.' },
}

// human-facing labels for each PredictionForm field, used in the extracted-fields summary
export const labInputLabels: Record<keyof PredictionForm, string> = {
  age: 'Age',
  sex: 'Sex',
  urine_albumin: 'Urine albumin',
  blood_pressure: 'Blood pressure',
  blood_glucose_random: 'Blood glucose random',
  blood_urea: 'Blood urea',
  serum_creatinine: 'Serum creatinine',
  sodium: 'Sodium',
  potassium: 'Potassium',
  hemoglobin: 'Hemoglobin',
  hypertension: 'Hypertension',
  diabetes_mellitus: 'Diabetes mellitus',
}
