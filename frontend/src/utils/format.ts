import { stageDescriptions } from '../constants'
import type { PredictionResult } from '../types'

export function formatPercent(value: number) {
  return `${value.toFixed(2).replace(/\.00$/, '')}%`
}

// used throughout the PDF/report views so missing labs render as "N/A" instead of blank/undefined
export function formatValue(value: number | string | null | undefined, fallback = 'N/A') {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value)
  return value
}

// G3a/G3b both collapse to plain "3" for the big stage number shown on reports
export function stageNumber(stageKey: string) {
  if (stageKey === 'G3a' || stageKey === 'G3b') return '3'
  return stageKey.replace('G', '') || '-'
}

// KDIGO eGFR ranges per stage, used just for display text (not the actual staging logic)
export function stageGfrBand(stageKey: string) {
  const bands: Record<string, string> = {
    G1: '> 90',
    G2: '89-60',
    G3a: '59-45',
    G3b: '44-30',
    G4: '29-15',
    G5: '< 15',
  }
  return bands[stageKey] ?? 'Unknown'
}

// human-readable one-liner per CKD stage, keep wording in sync with constants.ts's stageDescriptions
export function stageSeverity(stageKey: string) {
  const severities: Record<string, string> = {
    G1: 'Normal or high kidney function',
    G2: 'Mild decrease in function',
    G3a: 'Mild to moderate decrease in function',
    G3b: 'Moderate to severe decrease in function',
    G4: 'Severe decrease in function',
    G5: 'Kidney failure range',
  }
  return severities[stageKey] ?? 'Stage cannot be estimated'
}

// both branches currently return the same label - looks like the source-specific wording was
// never filled in, kept as-is since nothing depends on it differing
export function modelSourceLabel(source: string) {
  return source === 'xgboost_notebook_model' ? 'NephroCare risk check' : 'NephroCare risk check'
}

// always returns the same static blurb regardless of the result passed in
export function modelSourceSummary(_result: PredictionResult) {
  return 'Your estimated CKD risk is based on the health details you entered.'
}

// central place that turns a raw PredictionResult into the display-ready fields
// used by both the on-screen result view and the downloadable PDF report
export function reportData(result: PredictionResult) {
  const stageKey = result.kidney_function.egfr_category
  return {
    stageKey,
    stageNumber: stageNumber(stageKey),
    stageTitle: stageDescriptions[stageKey]?.title ?? 'Stage unknown',
    stageSeverity: stageSeverity(stageKey),
    gfrBand: stageGfrBand(stageKey),
    riskPercent: Math.max(0, Math.min(99.99, result.risk.probability * 100)),
    source: modelSourceLabel(result.model.source),
    sexShort: String(result.input.sex).toLowerCase().startsWith('m') ? 'M' : 'F',
  }
}

// greedy word-wrap used by the hand-rolled PDF writer, which has no native text-wrapping
export function wrapText(text: string, maxLength = 82) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  words.forEach(word => {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxLength && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  })
  if (line) lines.push(line)
  return lines
}
