import React, { useState, useEffect, useRef } from 'react'
import { Icon } from '../components/Icon'
import { API_BASE_URL } from '../constants'
import type { Page } from '../types'

interface VoiceAssistPageProps {
  showPage: (page: Page) => void
  user: { name: string; email: string } | null
}

interface Medication {
  name: string
  dose?: string
  frequency?: string
  duration?: string
  route?: string
  confidence?: number
}

interface Nutrient {
  nutrient: string
  limit?: string
  value?: number
  unit?: string
  confidence?: number
}

interface DrugInteraction {
  interaction_type: string
  severity: string // low, moderate, high, critical
  description: string
  recommendation: string
}

interface VoiceAnalysisResult {
  analysis_id: string
  transcript: string
  risk_score: number
  risk_category: string
  critical_alerts: number
  medications: Medication[]
  nutrients: Nutrient[]
  interactions: DrugInteraction[]
  recommendations: string[]
  patient_summary: string
  doctor_summary: string
  timestamp: string
}

// records or accepts an uploaded prescription audio clip, sends it to the backend for
// transcription + drug-safety analysis, and renders the structured result on the left
// while the right sidebar holds editable "patient context" used to tailor that analysis
export function VoiceAssistPage({ showPage, user }: VoiceAssistPageProps) {
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [result, setResult] = useState<VoiceAnalysisResult | null>(null)

  // Patient settings to customize the analysis - defaults pre-fill a plausible Stage 3 CKD
  // patient so the demo has sensible values without requiring the user to fill anything in first
  const [ckdStage, setCkdStage] = useState<number>(3)
  const [potassium, setPotassium] = useState<string>('4.8')
  const [creatinine, setCreatinine] = useState<string>('1.8')
  const [egfr, setEgfr] = useState<string>('42')
  const [allergies, setAllergies] = useState<string>('penicillin, NSAIDs')

  const timerRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startRecording = async () => {
    setError('')
    setResult(null)
    audioChunksRef.current = []
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const file = new File([audioBlob], 'prescription_recording.wav', { type: 'audio/wav' })
        setAudioFile(file)
        analyzeAudio(file)
      }

      mediaRecorder.start()
      setRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.warn('Microphone access denied or not available, using simulation mode', err)
      // no mic access: just fake the recording UI/timer, actual stop will show an error instead of a file
      setRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    }
  }

  const stopRecording = () => {
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // real recorder path: stopping it fires onstop above, which kicks off analyzeAudio()
      mediaRecorderRef.current.stop()
      // Stop all tracks to release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    } else {
      // no real recorder was ever created (mic was denied) - despite the name this doesn't
      // simulate audio, it just surfaces the error and tells the user to upload a file instead
      simulateRecording()
    }
  }

  const simulateRecording = () => {
    setError('Microphone not detected or permission denied. Please upload an audio file instead.')
    setRecording(false)
    setRecordingTime(0)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0])
      setResult(null)
      setError('')
    }
  }

  // sends the audio plus the sidebar's patient-context fields as multipart form data;
  // called both automatically after recording stops and manually for an uploaded/re-analyzed file
  const analyzeAudio = async (fileToAnalyze: File) => {
    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('audio_file', fileToAnalyze)
    formData.append('patient_id', user ? user.email : 'anonymous_patient')
    formData.append('ckd_stage', ckdStage.toString())
    if (potassium) formData.append('potassium', potassium)
    if (creatinine) formData.append('creatinine', creatinine)
    if (egfr) formData.append('egfr', egfr)
    if (allergies) formData.append('allergies', allergies)

    try {
      const response = await fetch(`${API_BASE_URL}/api/voice/analyze`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to analyze prescription audio.')
      }

      const data = await response.json()
      if (data.success) {
        setResult(data)
      } else {
        throw new Error(data.error || 'Prescription analysis was unsuccessful.')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An error occurred during audio analysis. Ensure the backend server is running.')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remainingSecs = secs % 60
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`
  }

  return (
    <div className="voice-page-layout wearable-page-container" style={{ minHeight: 'calc(100vh - 120px)', padding: '20px' }}>
      {/* LEFT COLUMN: Main Voice Analysis Workspace */}
      <div className="wearable-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '28px' }}>
        {/* Workspace Header */}
        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
          {/* Close button pinned to top-right */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button 
              onClick={() => showPage('home')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '20px', color: '#64748b', cursor: 'pointer', fontSize: '12px', padding: '4px 12px' }}
            >
              <Icon name="x" size={14} /> Close
            </button>
          </div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#083b66', margin: 0, fontSize: '22px' }}>
            <span style={{ color: 'var(--blue)', display: 'inline-flex' }}><Icon name="mic" size={24} /></span>
            Voice Prescription Assist
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#64748b' }}>
            Speak or upload audio to analyze prescriptions for kidney safety and drug interactions.
          </p>
        </div>

        {/* Recording Controls Card */}
        <div style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'center',
          border: '1px solid #e2e8f0',
          marginBottom: '24px'
        }}>
          {recording ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '16px' }}>
                <span className="wave-bar" style={{ animationDelay: '0.1s' }} />
                <span className="wave-bar" style={{ animationDelay: '0.2s' }} />
                <span className="wave-bar" style={{ animationDelay: '0.3s' }} />
                <span className="wave-bar" style={{ animationDelay: '0.4s' }} />
                <span className="wave-bar" style={{ animationDelay: '0.5s' }} />
              </div>
              <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>Recording Prescription Audio...</h3>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--blue)', margin: '0 0 16px' }}>{formatTime(recordingTime)}</p>
              <button 
                onClick={stopRecording}
                className="voice-btn stop"
                style={{ background: '#ef4444', border: 'none', color: 'white', padding: '10px 24px', borderRadius: '30px', fontWeight: 600, cursor: 'pointer' }}
              >
                Stop & Analyze
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
              <div className="voice-btn-row">
                <button 
                  onClick={startRecording}
                  disabled={loading}
                  className="voice-record-btn"
                >
                  <Icon name="mic" size={18} /> Start Recording
                </button>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                  <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                </div>
                <label className="voice-upload-btn">
                  <Icon name="camera" size={18} /> Upload Audio
                  <input type="file" accept="audio/*" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
              </div>
              {audioFile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '6px 16px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  <Icon name="clipboard" size={14} />
                  <span style={{ fontSize: '13px', color: '#334155', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{audioFile.name}</span>
                  <button 
                    onClick={() => analyzeAudio(audioFile)}
                    disabled={loading}
                    style={{ background: 'none', border: 'none', color: 'var(--blue)', fontWeight: 600, cursor: 'pointer', fontSize: '13px', padding: 0 }}
                  >
                    Analyze Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
            <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '16px', color: '#64748b', fontSize: '14px' }}>Transcribing and checking prescription safety...</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '16px', color: '#b91c1c', marginBottom: '24px', display: 'flex', alignItems: 'start', gap: '8px' }}>
            <span style={{ display: 'inline-flex', marginTop: '2px' }}><Icon name="alert-triangle" size={16} /></span>
            <div>
              <h4 style={{ margin: 0, fontWeight: 600 }}>Analysis Failed</h4>
              <p style={{ margin: '4px 0 0', fontSize: '13px' }}>{error}</p>
            </div>
          </div>
        )}

        {/* Results Panel */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Risk Assessment Summary */}
            <div style={{ display: 'flex', gap: '16px', background: result.risk_score > 50 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${result.risk_score > 50 ? '#fee2e2' : '#bbf7d0'}`, borderRadius: '12px', padding: '16px' }}>
              <div style={{
                background: result.risk_score > 50 ? '#ef4444' : '#22c55e',
                color: 'white',
                padding: '12px',
                borderRadius: '8px',
                textAlign: 'center',
                minWidth: '80px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.8 }}>Risk</span>
                <span style={{ fontSize: '24px', fontWeight: 700 }}>{result.risk_score}</span>
              </div>
              <div>
                <h3 style={{ margin: 0, color: result.risk_score > 50 ? '#991b1b' : '#166534', fontSize: '16px', fontWeight: 600 }}>
                  Safety Check Category: {result.risk_category.toUpperCase()}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: result.risk_score > 50 ? '#b91c1c' : '#15803d' }}>
                  {result.critical_alerts > 0 ? (
                    `⚠ Warning: Found ${result.critical_alerts} critical alerts that require immediate attention.`
                  ) : (
                    'No critical alerts found. The prescription is safe for your kidney health stage.'
                  )}
                </p>
              </div>
            </div>

            {/* Transcript Card */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
              <h4 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '14px', fontWeight: 600 }}>Transcription</h4>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#334155', fontStyle: 'italic', lineHeight: 1.5 }}>
                "{result.transcript}"
              </p>
            </div>

            {/* Grid of Medications and Interactions */}
            <div className="progression-kpi-grid">
              {/* Medications */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--blue)' }}><Icon name="report" size={16} /></span>
                  Prescribed Medications
                </h4>
                {result.medications.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>No medications detected in prescription.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {result.medications.map((med, idx) => (
                      <div key={idx} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{med.name}</strong>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>{med.dose} {med.frequency}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#94a3b8', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                          {med.route}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nutrients / Diet limits */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--blue)' }}><Icon name="food" size={16} /></span>
                  Nutrients & Intake limits
                </h4>
                {result.nutrients.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>No specific nutrient guidelines detected.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {result.nutrients.map((nut, idx) => (
                      <div key={idx} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{nut.nutrient}</strong>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>Limit: {nut.limit}</span>
                        </div>
                        {nut.value && (
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--blue)' }}>
                            {nut.value} {nut.unit}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Interactions / Warnings */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
              <h4 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--blue)' }}><Icon name="alert-triangle" size={16} /></span>
                Detected Interactions & Safety Warnings
              </h4>
              {result.interactions.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#22c55e', fontWeight: 500, margin: 0 }}>✓ No clinical drug interactions or contraindications found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {result.interactions.map((inter, idx) => {
                    const getSeverityColor = (sev: string) => {
                      switch (sev) {
                        case 'critical': return { bg: '#fee2e2', border: '#fecaca', text: '#ef4444' }
                        case 'high': return { bg: '#ffedd5', border: '#fed7aa', text: '#f97316' }
                        case 'moderate': return { bg: '#fef9c3', border: '#fef08a', text: '#eab308' }
                        default: return { bg: '#f1f5f9', border: '#e2e8f0', text: '#64748b' }
                      }
                    }
                    const colors = getSeverityColor(inter.severity)
                    return (
                      <div key={idx} style={{ padding: '12px 16px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: colors.text, background: 'white', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${colors.border}` }}>
                            {inter.severity} severity
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{inter.interaction_type.replace('_', '-')}</span>
                        </div>
                        <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{inter.description}</p>
                        <p style={{ margin: 0, fontSize: '12.5px', color: '#475569' }}><strong>Recommendation:</strong> {inter.recommendation}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Recommendations */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
              <h4 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--blue)' }}><Icon name="check-circle" size={16} /></span>
                Personalized Care Recommendations
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {result.recommendations.map((rec, idx) => (
                  <li key={idx} style={{ fontSize: '13.5px', color: '#334155' }}>{rec}</li>
                ))}
              </ul>
            </div>

            {/* Patient & Doctor Summaries */}
            <div className="progression-kpi-grid">
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '14px', fontWeight: 600 }}>Patient Summary</h4>
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                  {result.patient_summary}
                </div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '14px', fontWeight: 600 }}>Clinician / Doctor Summary</h4>
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                  {result.doctor_summary}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Patient Context Settings */}
      <div className="wearable-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ margin: 0, color: '#083b66', fontSize: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icon name="settings" size={18} />
          Patient Settings
        </h3>

        <div className="settings-field">
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>CKD Stage</label>
          <select 
            value={ckdStage} 
            onChange={e => setCkdStage(parseInt(e.target.value))}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
          >
            <option value="1">Stage 1: Normal</option>
            <option value="2">Stage 2: Mild</option>
            <option value="3">Stage 3: Moderate</option>
            <option value="4">Stage 4: Severe</option>
            <option value="5">Stage 5: Failure</option>
          </select>
        </div>

        <div className="settings-field">
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>eGFR (mL/min/1.73m²)</label>
          <input 
            type="number" 
            value={egfr} 
            onChange={e => setEgfr(e.target.value)} 
            placeholder="e.g. 45"
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
          />
        </div>

        <div className="settings-field">
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Serum Creatinine (mg/dL)</label>
          <input 
            type="number" 
            value={creatinine} 
            onChange={e => setCreatinine(e.target.value)} 
            placeholder="e.g. 1.8"
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
          />
        </div>

        <div className="settings-field">
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Serum Potassium (mmol/L)</label>
          <input 
            type="number" 
            value={potassium} 
            onChange={e => setPotassium(e.target.value)} 
            placeholder="e.g. 4.8"
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
          />
        </div>

        <div className="settings-field">
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Known Drug Allergies</label>
          <input 
            type="text" 
            value={allergies} 
            onChange={e => setAllergies(e.target.value)} 
            placeholder="e.g. aspirin, penicillin"
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
          />
          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>Comma separated list</span>
        </div>

        <div style={{ marginTop: '12px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9', fontSize: '12.5px', color: '#64748b' }}>
          <h5 style={{ margin: '0 0 6px', fontWeight: 600, color: '#0f172a' }}>Personalized Safeguards</h5>
          Changing these values alters the medication safety rules and drug interaction warning triggers.
        </div>
      </div>
    </div>
  )
}
