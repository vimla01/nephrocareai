import type { ChangeEvent } from 'react'
import { Icon } from '../components/Icon'
import { labInputLabels } from '../constants'
import type { PredictionForm, Page } from '../types'

type LabReportPageProps = {
  handleReportUpload: (event: ChangeEvent<HTMLInputElement>) => void
  uploadStatus: string
  extractedFields: string[]
  showPage: (page: Page) => void
}

// thin upload UI - the actual OCR/extraction happens in App.tsx's handleReportUpload,
// this page just shows the file picker and the resulting status/extracted-field list
export function LabReportPage({
  handleReportUpload,
  uploadStatus,
  extractedFields,
  showPage,
}: LabReportPageProps) {
  return (
    <main className="prediction-page calculator-page" id="top">
      <section className="calculator-hero">
        <span className="eyebrow">Lab Reports</span>
        <h1>Lab Report Analysis</h1>
        <p>Upload a clinical lab report to automatically extract your kidney function metrics.</p>
      </section>
      <section className="calculator-shell">
        <div className="calculator-panel">
          <div className="report-upload" style={{ marginBottom: '24px' }}>
            <div>
              <span className="eyebrow">AI Autofill</span>
              <p>Upload a PDF, image, text, or CSV report.</p>
            </div>
            <label>
              <Icon name="report" size={20} /> Choose report
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv" onChange={handleReportUpload} />
            </label>
          </div>
          {uploadStatus && (
            <p className="upload-status" style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
              {uploadStatus}
              {/* map raw field keys (e.g. serum_creatinine) back to their human label for display */}
              {extractedFields.length ? ` Extracted: ${extractedFields.map(field => labInputLabels[field as keyof PredictionForm] ?? field).join(', ')}.` : ''}
            </p>
          )}
          
          <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
            <button className="btn-secondary" onClick={() => showPage('dashboard')}>Go to Dashboard</button>
            <button className="btn-primary" onClick={() => showPage('ckd-prediction')}>Review Extracted Values</button>
          </div>
          
          <section className="calculator-note" style={{ marginTop: '48px' }}>
            <h2>About this analysis</h2>
            <p>Our AI safely extracts vital markers like Creatinine, Sodium, and eGFR directly from your uploaded diagnostic reports, saving you from manual data entry. Please review the extracted values before running a CKD prediction.</p>
          </section>
        </div>
      </section>
    </main>
  )
}
