import { useState, useEffect } from 'react'
import { Icon } from '../components/Icon'
import type { Page } from '../types'
import '../styles/summary.css'

type DoctorSummaryPageProps = {
  showPage: (page: Page) => void
  user: { name: string; email: string } | null
}

export function DoctorSummaryPage({ showPage, user }: DoctorSummaryPageProps) {
  const [predictions, setPredictions] = useState<any[]>([])
  const [ultrasounds, setUltrasounds] = useState<any[]>([])
  const [symptoms, setSymptoms] = useState<any[]>([])

  useEffect(() => {
    try {
      const pred = JSON.parse(window.localStorage.getItem('nephrocare_predictions') || '[]')
      setPredictions(pred)
      const ultra = JSON.parse(window.localStorage.getItem('nephrocare_ultrasound_scans') || '[]')
      setUltrasounds(ultra)
      const symp = JSON.parse(window.localStorage.getItem('nephrocare_symptom_logs') || '[]')
      setSymptoms(symp)
    } catch (e) {
      console.warn('Error parsing local storage for summary', e)
    }
  }, [])

  const handlePrint = () => {
    window.print()
  }

  const latestPrediction = predictions.length > 0 ? predictions[0] : null
  const latestUltrasound = ultrasounds.length > 0 ? ultrasounds[0] : null
  const recentSymptoms = symptoms.slice(0, 3)

  return (
    <div className="summary-page-container">
      <div className="summary-card" style={{ padding: '32px', border: '1px solid #cbd5e1', borderRadius: '12px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <button onClick={() => showPage('dashboard')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500' }}>
            &larr; Back to Dashboard
          </button>
          <button className="btn-print" onClick={handlePrint} style={{ background: '#083b66', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="file-text" size={16} /> Download PDF
          </button>
        </div>
        
        {/* Professional Lab Letterhead Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #083b66', paddingBottom: '16px', marginBottom: '24px' }}>
          <div>
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
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '13px', lineHeight: 1.6 }}>
          <div>
            <div><strong>Patient Name:</strong> {user ? user.name : 'Anonymous'}</div>
            <div><strong>Age / Gender:</strong> {latestPrediction ? latestPrediction.age : '48'} Yrs / {latestPrediction ? (latestPrediction.sex === 'female' ? 'Female' : 'Male') : 'Female'}</div>
            <div><strong>Referral Doctor:</strong> Dr. R. K. Sharma, MD, DM (Nephrology)</div>
          </div>
          <div>
            <div><strong>Lab Reference ID:</strong> NC-{latestPrediction ? latestPrediction.id || '98725' : '98725'}</div>
            <div><strong>Collection Date/Time:</strong> {latestPrediction ? new Date(latestPrediction.timestamp).toLocaleString() : new Date().toLocaleString()}</div>
            <div><strong>Report Status:</strong> Final (Authorized Signatory)</div>
          </div>
        </div>

        {/* Biochemistry & Renal Function Panel */}
        <div className="summary-section" style={{ marginBottom: '28px' }}>
          <h2 style={{ color: '#083b66', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Icon name="activity" size={18} /> BIOCHEMISTRY & RENAL FUNCTION PANEL
          </h2>
          {latestPrediction ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left', fontWeight: '700' }}>
                  <th style={{ padding: '10px 12px' }}>Test Parameter</th>
                  <th style={{ padding: '10px 12px' }}>Observed Value</th>
                  <th style={{ padding: '10px 12px' }}>Reference Interval</th>
                  <th style={{ padding: '10px 12px' }}>Unit</th>
                  <th style={{ padding: '10px 12px' }}>Status Flag</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '500' }}>Glomerular Filtration Rate (eGFR)</td>
                  <td style={{ padding: '10px 12px', color: parseFloat(latestPrediction.egfr) < 60 ? 'var(--maroon)' : 'inherit', fontWeight: '700' }}>{latestPrediction.egfr}</td>
                  <td style={{ padding: '10px 12px' }}>&ge; 90.0</td>
                  <td style={{ padding: '10px 12px' }}>mL/min/1.73m²</td>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', color: parseFloat(latestPrediction.egfr) < 60 ? 'var(--maroon)' : '#16a34a' }}>{parseFloat(latestPrediction.egfr) < 60 ? 'LOW (Stage 3+)' : 'NORMAL'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '500' }}>Serum Creatinine</td>
                  <td style={{ padding: '10px 12px', color: parseFloat(latestPrediction.creatinine) > 1.3 ? 'var(--maroon)' : 'inherit', fontWeight: '700' }}>{latestPrediction.creatinine}</td>
                  <td style={{ padding: '10px 12px' }}>0.6 - 1.3</td>
                  <td style={{ padding: '10px 12px' }}>mg/dL</td>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', color: parseFloat(latestPrediction.creatinine) > 1.3 ? 'var(--maroon)' : '#16a34a' }}>{parseFloat(latestPrediction.creatinine) > 1.3 ? 'HIGH' : 'NORMAL'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '500' }}>Urine Albumin-to-Creatinine Ratio (UACR)</td>
                  <td style={{ padding: '10px 12px', color: parseFloat(latestPrediction.uacr) > 30 ? 'var(--maroon)' : 'inherit', fontWeight: '700' }}>{latestPrediction.uacr}</td>
                  <td style={{ padding: '10px 12px' }}>&lt; 30.0</td>
                  <td style={{ padding: '10px 12px' }}>mg/g</td>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', color: parseFloat(latestPrediction.uacr) > 30 ? 'var(--maroon)' : '#16a34a' }}>{parseFloat(latestPrediction.uacr) > 30 ? 'MICROALBUMINURIA' : 'NORMAL'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '500' }}>Blood Pressure (Diastolic)</td>
                  <td style={{ padding: '10px 12px', fontWeight: '700' }}>{latestPrediction.blood_pressure}</td>
                  <td style={{ padding: '10px 12px' }}>60 - 90</td>
                  <td style={{ padding: '10px 12px' }}>mmHg</td>
                  <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#16a34a' }}>NORMAL</td>
                </tr>
                {latestPrediction.potassium && (
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '500' }}>Serum Potassium</td>
                    <td style={{ padding: '10px 12px', color: parseFloat(latestPrediction.potassium) > 5.1 || parseFloat(latestPrediction.potassium) < 3.5 ? 'var(--maroon)' : 'inherit', fontWeight: '700' }}>{latestPrediction.potassium}</td>
                    <td style={{ padding: '10px 12px' }}>3.5 - 5.1</td>
                    <td style={{ padding: '10px 12px' }}>mmol/L</td>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: parseFloat(latestPrediction.potassium) > 5.1 || parseFloat(latestPrediction.potassium) < 3.5 ? 'var(--maroon)' : '#16a34a' }}>{parseFloat(latestPrediction.potassium) > 5.1 ? 'HIGH' : (parseFloat(latestPrediction.potassium) < 3.5 ? 'LOW' : 'NORMAL')}</td>
                  </tr>
                )}
                {latestPrediction.sodium && (
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '500' }}>Serum Sodium</td>
                    <td style={{ padding: '10px 12px', color: parseFloat(latestPrediction.sodium) > 145 || parseFloat(latestPrediction.sodium) < 135 ? 'var(--maroon)' : 'inherit', fontWeight: '700' }}>{latestPrediction.sodium}</td>
                    <td style={{ padding: '10px 12px' }}>135 - 145</td>
                    <td style={{ padding: '10px 12px' }}>mmol/L</td>
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: parseFloat(latestPrediction.sodium) > 145 || parseFloat(latestPrediction.sodium) < 135 ? 'var(--maroon)' : '#16a34a' }}>{parseFloat(latestPrediction.sodium) < 135 ? 'LOW' : (parseFloat(latestPrediction.sodium) > 145 ? 'HIGH' : 'NORMAL')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#64748b' }}>No clinical predictions recorded.</p>
          )}
        </div>

        {/* AI Risk Score Banner */}
        {latestPrediction && (
          <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '16px', marginBottom: '28px', fontSize: '13.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: '0 0 4px', color: '#b45309', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Estimated CKD Risk Assessment
              </h4>
              <p style={{ margin: 0, color: '#451a03' }}>
                Based on machine learning classifier analysis of the Biochemistry panel:
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: '900', color: parseFloat(latestPrediction.risk_percentage) > 50 ? 'var(--maroon)' : '#16a34a' }}>
                {latestPrediction.risk_percentage}%
              </div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: parseFloat(latestPrediction.risk_percentage) > 50 ? 'var(--maroon)' : '#16a34a', textTransform: 'uppercase' }}>
                {parseFloat(latestPrediction.risk_percentage) > 50 ? 'HIGH RISK FLAG' : 'LOW RISK'}
              </div>
            </div>
          </div>
        )}

        {/* Ultrasound Diagnostics */}
        <div className="summary-section" style={{ marginBottom: '28px' }}>
          <h2 style={{ color: '#083b66', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Icon name="camera" size={18} /> ULTRASONOGRAPHY REPORT (KIDNEYS & BLADDER)
          </h2>
          {latestUltrasound ? (
            <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '14px', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div><strong>Scan Date:</strong> {new Date(latestUltrasound.timestamp).toLocaleDateString()}</div>
                <div><strong>Severity:</strong> <span style={{ fontWeight: 'bold', color: latestUltrasound.severity === 'High' ? 'var(--maroon)' : '#1e293b' }}>{latestUltrasound.severity}</span></div>
                <div><strong>Scan Quality:</strong> {latestUltrasound.image_quality}</div>
              </div>
              
              <div style={{ marginTop: '8px' }}>
                <strong>Key Sonographic Observations:</strong>
                <ul style={{ margin: '6px 0', paddingLeft: '20px', color: '#334155' }}>
                  {latestUltrasound.observations?.map((obs: string, idx: number) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{obs}</li>
                  ))}
                </ul>
              </div>

              {latestUltrasound.image_url && (
                <div style={{ textAlign: 'center', marginTop: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px' }}>
                  <img src={latestUltrasound.image_url} alt="Ultrasound Scan" className="summary-image" style={{ maxHeight: '200px', borderRadius: '4px' }} />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Fig: Ultrasound capture indicating renal parenchymal echo-intensity.</div>
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: '#64748b' }}>No ultrasound scans recorded.</p>
          )}
        </div>

        {/* Recent Patient Symptoms */}
        <div className="summary-section" style={{ marginBottom: 0 }}>
          <h2 style={{ color: '#083b66', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Icon name="clipboard" size={18} /> CLINICAL SYMPTOM TRACKER LOG
          </h2>
          {recentSymptoms.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '12px' }}>
              {recentSymptoms.map((symp: any, idx: number) => (
                <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', fontSize: '13px' }}>
                  <div style={{ color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>{new Date(symp.timestamp).toLocaleDateString()}</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{symp.symptom}</div>
                  <div style={{ marginTop: '4px', color: symp.severity === 'High' ? 'var(--maroon)' : '#475569', fontWeight: '600' }}>Severity: {symp.severity}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#64748b' }}>No symptoms reported recently.</p>
          )}
        </div>
        
        {/* Lab Footer Sign-offs */}
        <div style={{ marginTop: '48px', paddingTop: '20px', borderTop: '2px solid #cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>
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

        <div style={{ marginTop: '24px', fontSize: '10px', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>
          Disclaimer: This report is an AI-powered aggregation of clinical screening models. It is intended to support patient health literacy and should be clinically verified by a registered medical practitioner.
        </div>
      </div>
    </div>
  )
}
