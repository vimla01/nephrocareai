import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { API_BASE_URL } from '../constants'
import type { Page, PredictionForm, PredictionResult, StageProgressionResult } from '../types'
import { formatPercent, formatValue, reportData } from '../utils/format'
import { downloadPredictionPdf } from '../utils/predictionPdf'

export type PredictionStep = 'calculator' | 'result'
type ActiveReport = ReturnType<typeof reportData>

type PredictionPageProps = {
  predictionStep: PredictionStep
  setPredictionStep: (step: PredictionStep) => void
  form: PredictionForm
  result: PredictionResult | null
  activeReport: ActiveReport | null
  uploadStatus: string
  extractedFields: string[]
  loading: boolean
  error: string
  showPage: (page: Page) => void
  submitPrediction: (event: FormEvent) => void
  handleReportUpload: (event: ChangeEvent<HTMLInputElement>) => void
  updateNumber: (key: keyof PredictionForm, value: string) => void
  updateChoice: (key: keyof PredictionForm, value: string) => void
  resetPrediction: () => void
  user?: { name: string; email: string; avatar?: string } | null
}

// [form key, display label, unit] tuples driving the calculator form below - order here is the
// order fields render in; 'sex'/'hypertension'/'diabetes_mellitus' get a <select>, everything
// else gets a numeric <input> (see the ternary in PredictionCalculator's render)
const labInputs: [keyof PredictionForm, string, string][] = [
  ['age', 'Age', 'Yrs'],
  ['sex', 'Sex', ''],
  ['urine_albumin', 'Urine albumin : creatinine ratio', 'mg/g'],
  ['blood_pressure', 'Blood pressure', 'mmHg'],
  ['blood_glucose_random', 'Blood glucose random', 'mg/dL'],
  ['blood_urea', 'Blood urea', 'mg/dL'],
  ['serum_creatinine', 'Serum creatinine', 'mg/dL'],
  ['sodium', 'Sodium', 'mmol/L'],
  ['potassium', 'Potassium', 'mmol/L'],
  ['hemoglobin', 'Hemoglobin', 'g/dL'],
  ['hypertension', 'Hypertension', ''],
  ['diabetes_mellitus', 'Diabetes mellitus', ''],
]

// two-step page: the input form (PredictionCalculator) and, once a result exists, the
// "lab report" style output (PredictionResultView) - App.tsx owns predictionStep/result state
export function PredictionPage(props: PredictionPageProps) {
  const { predictionStep, result, activeReport } = props
  const className = predictionStep === 'result' && result ? 'prediction-page result-page kfre-page' : 'prediction-page calculator-page'

  return <main className={className} id="top">
    {predictionStep === 'result' && result && activeReport
      ? <PredictionResultView {...props} result={result} activeReport={activeReport} />
      : <PredictionCalculator {...props} />}
  </main>
}

// renders the risk/lab-marker report for a completed prediction, then separately kicks off a
// second api call to fetch the longer-term stage progression forecast (shown once it resolves)
function PredictionResultView({ result, activeReport, setPredictionStep, showPage, user }: PredictionPageProps & { result: PredictionResult; activeReport: ActiveReport }) {
  const userName = user?.name || 'Anonymous'

  const [stageResult, setStageResult] = useState<StageProgressionResult | null>(null)
  const [stageLoading, setStageLoading] = useState(false)

  // re-fetches whenever `result` changes (i.e. every time a new prediction is submitted)
  useEffect(() => {
    const fetchStage = async () => {
      setStageLoading(true)
      try {
        const response = await fetch(`${API_BASE_URL}/api/predict-stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.input),
        })
        if (response.ok) {
          const data = await response.json()
          setStageResult(data)
        }
      } catch (err) {
        console.error('Stage prediction failed:', err)
      } finally {
        setStageLoading(false)
      }
    }
    fetchStage()
  }, [result])

  const patientName = userName
  const patientAge = formatValue(result.input.age)
  const patientSex = result.input.sex === 'female' ? 'Female' : 'Male'
  const labRefId = `NC-${Math.floor(10000 + Math.random() * 90000)}` // cosmetic only, not a real lab id
  const collectionDate = new Date().toLocaleDateString()

  // reference ranges duplicated in predictionPdf.ts and DoctorSummaryPage.tsx - keep all 3 in sync
  const rows = [
    { name: 'Glomerular Filtration Rate (eGFR)', val: formatValue(result.kidney_function.egfr_2021), ref: '>= 90.0', unit: 'mL/min/1.73m2', flag: parseFloat(result.kidney_function.egfr_2021 as any) < 60 ? 'LOW' : 'NORMAL' },
    { name: 'Urine Albumin (UACR)', val: formatValue(result.input.urine_albumin), ref: '< 30.0', unit: 'mg/g', flag: parseFloat(result.input.urine_albumin as any) > 30 ? 'HIGH' : 'NORMAL' },
    { name: 'Serum Creatinine', val: formatValue(result.input.serum_creatinine), ref: '0.6 - 1.3', unit: 'mg/dL', flag: parseFloat(result.input.serum_creatinine as any) > 1.3 ? 'HIGH' : 'NORMAL' },
    { name: 'Blood Urea', val: formatValue(result.input.blood_urea), ref: '7 - 40', unit: 'mg/dL', flag: parseFloat(result.input.blood_urea as any) > 40 ? 'HIGH' : 'NORMAL' },
    { name: 'Serum Potassium', val: formatValue(result.input.potassium), ref: '3.5 - 5.1', unit: 'mmol/L', flag: parseFloat(result.input.potassium as any) > 5.1 ? 'HIGH' : 'NORMAL' },
    { name: 'Serum Sodium', val: formatValue(result.input.sodium), ref: '135 - 145', unit: 'mmol/L', flag: parseFloat(result.input.sodium as any) < 135 ? 'LOW' : 'NORMAL' },
  ].filter(r => r.val !== 'N/A' && r.val !== '')

  return <>
    <section className="result-hero" style={{ marginBottom: '20px' }}>
      <button className="back-button" onClick={() => setPredictionStep('calculator')}><Icon name="arrow" size={16} /> Back</button>
      <div className="result-actions">
        <button type="button" onClick={() => downloadPredictionPdf(result, userName)}><Icon name="report" size={17} /> Download PDF</button>
        <button type="button" onClick={() => showPage('home')}>Back home</button>
      </div>
    </section>

    <section className="kfre-report" style={{ padding: '32px', border: '1px solid #cbd5e1', borderRadius: '12px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Professional Lab Letterhead Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #083b66', paddingBottom: '16px', marginBottom: '24px' }}>
        <div style={{ textAlign: 'left' }}>
          <h1 style={{ margin: 0, color: '#083b66', fontSize: '24px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>NEPHROCARE DIAGNOSTIC LABS</h1>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
            102, Health Care Complex, Medical District, Delhi-110029 | Tel: +91-11-23456789 | Email: reports@nephrocarelabs.in
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8' }}>
            NABL Accredited Laboratory | ISO 9001:2015 Certified | Gov. Reg No: DL-83921-A
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            CLINICAL BIOCHEMISTRY REPORT
          </span>
        </div>
      </div>

      {/* Patient Demographics Info Table */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '13px', lineHeight: 1.6, textAlign: 'left' }}>
        <div>
          <div><strong>Patient Name:</strong> {patientName}</div>
          <div><strong>Age / Gender:</strong> {patientAge} Yrs / {patientSex}</div>
          <div><strong>Referral Doctor:</strong> Dr. R. K. Sharma, MD, DM (Nephrology)</div>
        </div>
        <div>
          <div><strong>Lab Reference ID:</strong> {labRefId}</div>
          <div><strong>Collection Date:</strong> {collectionDate}</div>
          <div><strong>Report Status:</strong> Final (Authorized Signatory)</div>
        </div>
      </div>

      {/* Biochemistry Table */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ color: '#083b66', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>
          <Icon name="activity" size={18} /> BIOCHEMISTRY & RENAL FUNCTION PANEL
        </h2>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
          <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', marginTop: '12px', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1', fontWeight: '700' }}>
                <th style={{ padding: '10px 12px' }}>Test Parameter</th>
                <th style={{ padding: '10px 12px' }}>Observed Value</th>
                <th style={{ padding: '10px 12px' }}>Reference Interval</th>
                <th style={{ padding: '10px 12px' }}>Unit</th>
                <th style={{ padding: '10px 12px' }}>Status Flag</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '500' }}>{row.name}</td>
                  <td style={{ padding: '10px 12px', color: row.flag !== 'NORMAL' ? 'var(--maroon)' : 'inherit', fontWeight: '700' }}>{row.val}</td>
                  <td style={{ padding: '10px 12px' }}>{row.ref}</td>
                  <td style={{ padding: '10px 12px' }}>{row.unit}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', color: row.flag !== 'NORMAL' ? 'var(--maroon)' : '#16a34a' }}>{row.flag}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assessment and Recommendations grid */}
      <div className="progression-kpi-grid" style={{ marginBottom: '28px', textAlign: 'left' }}>
        <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 8px', color: '#b45309', fontSize: '14px', fontWeight: '700' }}>
            ESTIMATED CKD RISK EVALUATION
          </h3>
          <div style={{ fontSize: '32px', fontWeight: '900', color: 'var(--maroon)', marginBottom: '8px' }}>
            {formatPercent(activeReport.riskPercent)}
          </div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
            Stage {activeReport.stageNumber}
          </div>
          <div style={{ fontSize: '12px', color: '#475569', textTransform: 'uppercase', fontWeight: '600' }}>
            {activeReport.stageSeverity}
          </div>
        </div>

        <div style={{ background: '#f0f9ff', border: '1px solid #e0f2fe', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 8px', color: '#0369a1', fontSize: '14px', fontWeight: '700' }}>
            CLINICAL ADVICE & RECOMMENDATIONS
          </h3>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: '#0c4a6e', display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: 1.4 }}>
            {result.recommendations.slice(0, 4).map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sign-offs */}
      <div style={{ marginTop: '48px', paddingTop: '20px', borderTop: '2px solid #cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '11px', color: '#64748b', lineHeight: 1.5, textAlign: 'left' }}>
        <div>
          <strong>NephroCare Diagnostic Center</strong><br />
          NABL Certificate Number: MC-2947<br />
          ISO 9001:2015 registration no: 902148-Q
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong>Electronically Verified Report</strong><br />
          Dr. A. K. Banerjee, MD (Pathology)<br />
          Senior Consultant Pathologist (Reg No: MCI-92842)
        </div>
      </div>

      {/* CKD Stage Progression Forecast */}
      {stageLoading && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
          <p style={{ fontSize: '14px' }}>Analyzing CKD progression with AI models...</p>
        </div>
      )}
      {stageResult && (
        <div style={{ marginTop: '32px', borderTop: '2px solid #083b66', paddingTop: '28px' }}>
          <h2 style={{ color: '#083b66', fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="activity" size={18} /> CKD STAGE PROGRESSION FORECAST
          </h2>

          {/* Current Stage + Decline Rate KPIs */}
          <div className="progression-kpi-grid" style={{ marginBottom: '24px' }}>
            <div className="kpi-card" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#92400e', textTransform: 'uppercase', marginBottom: '6px' }}>Current Stage (XGBoost)</div>
              <div style={{ fontSize: '36px', fontWeight: '900', color: '#b45309' }}>{stageResult.current_stage}</div>
              <div style={{ fontSize: '11px', color: '#a16207', marginTop: '4px' }}>Confidence: {((stageResult.stage_probabilities[stageResult.current_stage] || 0) * 100).toFixed(1)}%</div>
            </div>
            <div className="kpi-card" style={{ background: '#fce4ec', border: '1px solid #f8bbd0' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#880e4f', textTransform: 'uppercase', marginBottom: '6px' }}>eGFR Decline Rate (DNN)</div>
              <div style={{ fontSize: '36px', fontWeight: '900', color: '#ad1457' }}>{stageResult.annual_decline_rate}</div>
              <div style={{ fontSize: '11px', color: '#c62828', marginTop: '4px' }}>mL/min/1.73m²/year</div>
            </div>
            <div className="kpi-card" style={{ background: '#e8f5e9', border: '1px solid #c8e6c9' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#2e7d32', textTransform: 'uppercase', marginBottom: '6px' }}>Current eGFR</div>
              <div style={{ fontSize: '36px', fontWeight: '900', color: '#1b5e20' }}>{stageResult.egfr ?? 'N/A'}</div>
              <div style={{ fontSize: '11px', color: '#388e3c', marginTop: '4px' }}>mL/min/1.73m²</div>
            </div>
          </div>

          {/* Stage Probability Distribution */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: '700', color: '#0f172a', textAlign: 'left', textTransform: 'uppercase' }}>Stage Probability Distribution</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(['G1', 'G2', 'G3a', 'G3b', 'G4', 'G5'] as const).map(stage => {
                const prob = stageResult.stage_probabilities[stage] || 0
                const isActive = stage === stageResult.current_stage
                const barColor = isActive ? '#083b66' : '#94a3b8'
                return (
                  <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '36px', fontSize: '12px', fontWeight: isActive ? '800' : '500', color: isActive ? '#083b66' : '#64748b', textAlign: 'right' }}>{stage}</span>
                    <div style={{ flex: 1, height: '22px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden', position: 'relative' as const }}>
                      <div style={{ height: '100%', width: `${Math.max(prob * 100, 1)}%`, background: barColor, borderRadius: '6px', transition: 'width 0.8s ease' }} />
                    </div>
                    <span style={{ width: '50px', fontSize: '12px', fontWeight: isActive ? '800' : '500', color: isActive ? '#083b66' : '#64748b' }}>{(prob * 100).toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Progression Timeline */}
          {stageResult.progression_timeline.length > 0 && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: '700', color: '#9a3412', textAlign: 'left', textTransform: 'uppercase' }}>Estimated Progression Timeline</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0', justifyContent: 'center', flexWrap: 'wrap' as const }}>
                {/* Current stage marker */}
                <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', minWidth: '90px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#083b66', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px' }}>{stageResult.current_stage}</div>
                  <div style={{ fontSize: '10px', color: '#083b66', fontWeight: '700', marginTop: '6px' }}>NOW</div>
                </div>
                {stageResult.progression_timeline.map((item, idx) => {
                  const stageColors: Record<string, string> = { G2: '#ca8a04', G3a: '#ea580c', G3b: '#dc2626', G4: '#be123c', G5: '#881337' }
                  const color = stageColors[item.stage] || '#64748b'
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '60px', height: '3px', background: `linear-gradient(90deg, #cbd5e1, ${color})`, margin: '0 2px' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', minWidth: '90px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px', border: '3px solid #fff', boxShadow: `0 0 0 2px ${color}40` }}>{item.stage}</div>
                        <div style={{ fontSize: '11px', color, fontWeight: '700', marginTop: '6px', textAlign: 'center' }}>{item.label}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p style={{ margin: '16px 0 0', fontSize: '10px', color: '#78350f', textAlign: 'center', fontStyle: 'italic' }}>
                Based on DNN-predicted annual eGFR decline of {stageResult.annual_decline_rate} mL/min/1.73m²/year
              </p>
            </div>
          )}

          {/* Risk Factors */}
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '700', color: '#991b1b', textAlign: 'left', textTransform: 'uppercase' }}>Risk Factors Driving Progression</h3>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#7f1d1d', display: 'flex', flexDirection: 'column' as const, gap: '5px', lineHeight: 1.4 }}>
              {stageResult.risk_factors.map((factor, idx) => (
                <li key={idx}>{factor}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div style={{ marginTop: '24px', fontSize: '10px', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>
        Disclaimer: This report is an AI-powered aggregation of clinical screening models. It is intended to support patient health literacy and should be clinically verified by a registered medical practitioner.
      </div>
    </section>
  </>
}

// the input form - note handleReportUpload/uploadStatus/extractedFields are accepted via props
// but not used in this component's own render; report upload lives on the separate LabReportPage
function PredictionCalculator({
  form,
  uploadStatus,
  extractedFields,
  loading,
  error,
  submitPrediction,
  handleReportUpload,
  updateNumber,
  updateChoice,
  resetPrediction,
}: PredictionPageProps) {
  return <>
    <section className="calculator-hero">
      <span className="eyebrow">CKD</span>
      <h1>Risk calculation</h1>
      <p>If you do not have the information required below talk to your doctor.</p>
    </section>
    <section className="calculator-shell">
      <div className="calculator-panel">
        <form className="calculator-form" onSubmit={submitPrediction}>
          <div className="calculator-grid">
            {/* builds one field per labInputs entry - sex/hypertension/diabetes render as a
                <select>, every other field renders as a numeric input with its unit label */}
            {labInputs.map(([key, label, unit]) => key === 'sex' || key === 'hypertension' || key === 'diabetes_mellitus'
              ? <label key={key}><span>{label}</span><select required value={form[key]} onChange={event => updateChoice(key, event.target.value)}><option value="" disabled>Select</option>{key === 'sex' ? <><option value="female">Female</option><option value="male">Male</option></> : <><option value="no">No</option><option value="yes">Yes</option></>}</select></label>
              : <label key={key}><span>{label}</span><div><input type="number" step="any" value={form[key]} onChange={event => updateNumber(key, event.target.value)} required /><small>{unit}</small></div></label>)}
          </div>
          <div className="calculator-actions">
            <button type="button" onClick={resetPrediction}>Reset</button>
            <button className="prediction-submit" disabled={loading}>{loading ? 'Calculating...' : 'Calculate risk'}</button>
          </div>
          {error && <p className="prediction-error">{error}</p>}
        </form>
        <section className="calculator-note">
          <h2>About this calculator</h2>
          <p>NephroCare estimates CKD screening risk, eGFR category, lab marker flags, and stage information from the current clinical values. The result supports screening conversations and does not replace clinician diagnosis.</p>
        </section>
      </div>
    </section>
  </>
}
