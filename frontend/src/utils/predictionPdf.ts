import { stageOrder } from '../constants'
import type { PredictionResult } from '../types'
import { formatPercent, formatValue, modelSourceSummary, reportData, stageGfrBand, stageNumber, wrapText } from './format'

const pageWidth = 612
const pageHeight = 792

function pdfEscape(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function pdfText(x: number, y: number, text: string, size = 11, color = '0 0 0', font = '/F1') {
  return `BT ${color} rg ${font} ${size} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET`
}

function pdfWrappedText(x: number, y: number, text: string, size = 11, color = '0 0 0', maxLength = 76) {
  const lines = wrapText(text, maxLength)
  return lines.map((line, index) => pdfText(x, y - index * Math.round(size * 1.45), line, size, color)).join('\n')
}

function pdfRect(x: number, y: number, w: number, h: number, fill: string, stroke?: string) {
  if (stroke) return `q ${fill} rg ${stroke} RG 1 w ${x} ${y} ${w} ${h} re B Q`
  return `q ${fill} rg ${x} ${y} ${w} ${h} re f Q`
}

function createPdfBlob(pages: string[]) {
  const objects = Array<string>(3 + pages.length * 2)
  const pageObjectNumbers = pages.map((_, index) => 4 + index * 2)
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map(number => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`
  objects[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'

  pages.forEach((content, index) => {
    const pageObjectIndex = 3 + index * 2
    const contentObjectIndex = pageObjectIndex + 1
    const contentObjectNumber = contentObjectIndex + 1
    objects[pageObjectIndex] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    objects[contentObjectIndex] = `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`
  })

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}

function buildPredictionPdf(result: PredictionResult, userName: string): Blob {
  const now = new Date()
  const report = reportData(result)
  const page: string[] = []
  const navy = '0.05 0.23 0.40'
  const maroon = '0.74 0.04 0.24'
  const muted = '0.31 0.36 0.42'
  const pale = '0.98 0.99 1.00'
  const softBlue = '0.86 0.93 0.98'
  const softRose = '0.98 0.87 0.91'
  
  const patientName = userName
  const patientAge = formatValue(result.input.age)
  const patientSex = result.input.sex === 'female' ? 'Female' : 'Male'
  const labRefId = `NC-${Math.floor(10000 + Math.random() * 90000)}`
  const collectionDate = now.toLocaleDateString()

  const rows = [
    { name: 'Glomerular Filtration Rate (eGFR)', val: formatValue(result.kidney_function.egfr_2021), ref: '>= 90.0', unit: 'mL/min/1.73m2', flag: parseFloat(result.kidney_function.egfr_2021 as any) < 60 ? 'LOW' : 'NORMAL' },
    { name: 'Urine Albumin (UACR)', val: formatValue(result.input.urine_albumin), ref: '< 30.0', unit: 'mg/g', flag: parseFloat(result.input.urine_albumin as any) > 30 ? 'HIGH' : 'NORMAL' },
    { name: 'Serum Creatinine', val: formatValue(result.input.serum_creatinine), ref: '0.6 - 1.3', unit: 'mg/dL', flag: parseFloat(result.input.serum_creatinine as any) > 1.3 ? 'HIGH' : 'NORMAL' },
    { name: 'Blood Urea', val: formatValue(result.input.blood_urea), ref: '7 - 40', unit: 'mg/dL', flag: parseFloat(result.input.blood_urea as any) > 40 ? 'HIGH' : 'NORMAL' },
    { name: 'Serum Potassium', val: formatValue(result.input.potassium), ref: '3.5 - 5.1', unit: 'mmol/L', flag: parseFloat(result.input.potassium as any) > 5.1 ? 'HIGH' : 'NORMAL' },
    { name: 'Serum Sodium', val: formatValue(result.input.sodium), ref: '135 - 145', unit: 'mmol/L', flag: parseFloat(result.input.sodium as any) < 135 ? 'LOW' : 'NORMAL' },
  ].filter(r => r.val !== 'N/A' && r.val !== '')

  page.push(
    // Page Background
    pdfRect(0, 0, pageWidth, pageHeight, pale),
    
    // Header Banner Line
    pdfRect(42, 735, 528, 2, navy),
    
    // Lab Header Details
    pdfText(42, 752, 'NEPHROCARE DIAGNOSTIC LABS', 18, navy),
    pdfText(380, 755, 'CLINICAL BIOCHEMISTRY REPORT', 10, maroon),
    pdfText(42, 720, '102, Health Care Complex, Medical District, Delhi-110029 | Tel: +91-11-23456789', 8, muted),
    pdfText(42, 708, 'NABL Accredited Laboratory | ISO 9001:2015 Certified | Gov. Reg No: DL-83921-A', 7, muted),
    
    // Patient Metadata Box
    pdfRect(42, 610, 528, 80, pale, '0.77 0.82 0.86'),
    
    // Left column metadata
    pdfText(54, 672, `Patient Name:   ${patientName}`, 10, '0 0 0'),
    pdfText(54, 654, `Age / Gender:   ${patientAge} Yrs / ${patientSex}`, 10, '0 0 0'),
    pdfText(54, 636, `Referral Dr:    Dr. R. K. Sharma, MD, DM`, 10, '0 0 0'),
    
    // Right column metadata
    pdfText(330, 672, `Lab Reference ID:  ${labRefId}`, 10, '0 0 0'),
    pdfText(330, 654, `Collection Date:   ${collectionDate}`, 10, '0 0 0'),
    pdfText(330, 636, `Report Status:     Final (Authorized)`, 10, '0 0 0'),
    
    // Biochemistry Table Header
    pdfRect(42, 570, 528, 18, '0.9 0.93 0.96'),
    pdfText(48, 575, 'TEST PARAMETER', 9, navy),
    pdfText(230, 575, 'VALUE', 9, navy),
    pdfText(310, 575, 'REFERENCE INTERVAL', 9, navy),
    pdfText(440, 575, 'UNIT', 9, navy),
    pdfText(510, 575, 'STATUS', 9, navy)
  )

  // Draw biochemistry rows dynamically
  rows.forEach((row, i) => {
    const y = 546 - i * 22
    const rowColor = i % 2 === 0 ? '1 1 1' : '0.97 0.98 0.99'
    page.push(
      pdfRect(42, y - 6, 528, 22, rowColor, '0.9 0.92 0.94'),
      pdfText(48, y, row.name, 9, '0 0 0'),
      pdfText(230, y, row.val, 9, row.flag !== 'NORMAL' ? maroon : '0 0 0'),
      pdfText(310, y, row.ref, 9, '0.3 0.3 0.3'),
      pdfText(440, y, row.unit, 9, '0.3 0.3 0.3'),
      pdfText(510, y, row.flag, 9, row.flag !== 'NORMAL' ? maroon : '0.1 0.6 0.3')
    )
  })

  // Set next position Y after table
  const nextY = 546 - rows.length * 22 - 30

  // Draw Assessment & Stage Card (left side)
  page.push(
    pdfRect(42, nextY - 110, 250, 120, '1 0.98 0.92', '0.9 0.8 0.5'),
    pdfText(54, nextY - 10, 'ESTIMATED CKD RISK EVALUATION', 9, maroon),
    pdfText(54, nextY - 45, `${formatPercent(report.riskPercent)}`, 32, maroon),
    pdfText(54, nextY - 70, `STAGE CLASSIFICATION: STAGE ${report.stageNumber}`, 10, '0 0 0'),
    pdfText(54, nextY - 90, `Severity: ${report.stageSeverity}`, 9, '0.4 0.4 0.4'),

    // Draw Recommendations Card (right side)
    pdfRect(320, nextY - 110, 250, 120, '0.93 0.96 0.98', '0.7 0.8 0.9'),
    pdfText(332, nextY - 10, 'CLINICAL ADVICE & RECOMMENDATIONS', 9, navy)
  )

  // Add recommendations text inside card
  const recs = result.recommendations.slice(0, 3)
  recs.forEach((rec, idx) => {
    page.push(
      pdfWrappedText(332, nextY - 32 - idx * 26, `• ${rec}`, 8, '0.1 0.2 0.3', 52)
    )
  })

  // Sign-off block at bottom
  page.push(
    pdfRect(42, 100, 528, 1, '0.77 0.82 0.86'),
    pdfText(42, 85, 'Electronically Verified Report - Authorized Signatory', 8, muted),
    pdfText(42, 70, 'Dr. A. K. Banerjee, MD (Pathology), Senior Pathologist', 8, '0 0 0'),
    pdfText(380, 85, 'Accreditation Code: NABL-MC-2947', 8, muted),
    pdfText(380, 70, 'License Registration: MCI-92842', 8, '0 0 0')
  )

  return createPdfBlob([page.join('\n')])
}

export function downloadPredictionPdf(result: PredictionResult, userName: string = 'Anonymous') {
  const blob = buildPredictionPdf(result, userName)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nephrocare-ckd-risk-${new Date().toISOString().split('T')[0]}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
