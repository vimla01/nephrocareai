import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Icon } from '../components/Icon'
import type { FoodAnalysis, FoodScanResponse, MealPlanResponse, Page } from '../types'

export type FoodTab = 'scan' | 'check' | 'recommend' | 'plan'
export type FoodStage = 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5'
export type YesNo = 'yes' | 'no'

type FoodToolsPageProps = {
  foodTab: FoodTab
  setFoodTab: (tab: FoodTab) => void
  foodName: string
  setFoodName: (name: string) => void
  foodStage: FoodStage
  setFoodStage: (stage: FoodStage) => void
  foodHypertension: YesNo
  setFoodHypertension: (value: YesNo) => void
  foodDiabetes: YesNo
  setFoodDiabetes: (value: YesNo) => void
  foodLoading: boolean
  foodError: string
  foodScan: FoodScanResponse | null
  foodCheck: FoodAnalysis | null
  foodRecommendations: FoodAnalysis[]
  mealPlan: MealPlanResponse | null
  foodImagePreview: string
  showPage: (page: Page) => void
  scanFoodImage: (image: Blob, filename: string) => Promise<void>
  scanLiveFoodFrame: (image: Blob) => Promise<void>
  checkFood: (foodNameOverride?: string) => void
  loadRecommendations: () => void
  loadMealPlan: () => void
}

const stageOptions: FoodStage[] = ['G1', 'G2', 'G3a', 'G3b', 'G4', 'G5']

function statusClass(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('safe')) return 'safe'
  if (normalized.includes('moderate')) return 'moderate'
  return 'risky'
}

export function FoodToolsPage({
  foodTab,
  setFoodTab,
  foodName,
  setFoodName,
  foodStage,
  setFoodStage,
  foodHypertension,
  setFoodHypertension,
  foodDiabetes,
  setFoodDiabetes,
  foodLoading,
  foodError,
  foodScan,
  foodCheck,
  foodRecommendations,
  mealPlan,
  foodImagePreview,
  showPage,
  scanFoodImage,
  scanLiveFoodFrame,
  checkFood,
  loadRecommendations,
  loadMealPlan,
}: FoodToolsPageProps) {
  useEffect(() => {
    const tabs: FoodTab[] = ['scan', 'check', 'recommend', 'plan']
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const currentIndex = tabs.indexOf(foodTab)
        if (e.key === 'ArrowRight') {
          const nextIndex = (currentIndex + 1) % tabs.length
          setFoodTab(tabs[nextIndex])
        } else {
          const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
          setFoodTab(tabs[prevIndex])
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [foodTab, setFoodTab])

  return <main className="food-page" id="top">
    <button className="back-button food-back-button" onClick={() => showPage('home')}><Icon name="arrow" size={16} /> Back</button>
    <section className="food-hero">
      <span className="eyebrow">Food</span>
      <h1>Food care tools</h1>
      <p>Scan a plate, check a food, compare kidney nutrients, and build a simple CKD-friendly meal plan from the Indian food dataset.</p>
      <div className="food-hero-strip" aria-label="Food tool highlights">
        <span><Icon name="camera" size={17} /> Camera scan</span>
        <span><Icon name="shield" size={17} /> Safety score</span>
        <span><Icon name="chef" size={17} /> Meal plan</span>
      </div>
    </section>

    <section className="nutrition-section nutrition-section-page">
      <div className="nutrition-tabs" role="tablist" aria-label="Food tools">
        {[
          ['scan', 'Camera'],
          ['check', 'Food safety'],
          ['recommend', 'Recommendations'],
          ['plan', 'AI meal planner'],
        ].map(([key, label]) => <button key={key} type="button" className={foodTab === key ? 'active' : ''} onClick={() => setFoodTab(key as FoodTab)}>{label}</button>)}
      </div>

      <div className="nutrition-grid">
        {foodError && <p className="nutrition-error">{foodError}</p>}
        {foodLoading && <p className="nutrition-status">Working in real time...</p>}
        {foodTab === 'scan' && <ScanFoodPanel foodScan={foodScan} foodImagePreview={foodImagePreview} foodLoading={foodLoading} scanFoodImage={scanFoodImage} scanLiveFoodFrame={scanLiveFoodFrame} checkFood={checkFood} />}
        {foodTab === 'check' && <CheckFoodPanel foodName={foodName} setFoodName={setFoodName} foodCheck={foodCheck} foodLoading={foodLoading} checkFood={checkFood} />}
        {foodTab === 'recommend' && <RecommendationsPanel foodStage={foodStage} setFoodStage={setFoodStage} foodHypertension={foodHypertension} setFoodHypertension={setFoodHypertension} foodDiabetes={foodDiabetes} setFoodDiabetes={setFoodDiabetes} foodLoading={foodLoading} loadRecommendations={loadRecommendations} foodRecommendations={foodRecommendations} checkFood={checkFood} />}
        {foodTab === 'plan' && <MealPlanPanel foodStage={foodStage} setFoodStage={setFoodStage} foodHypertension={foodHypertension} setFoodHypertension={setFoodHypertension} foodDiabetes={foodDiabetes} setFoodDiabetes={setFoodDiabetes} foodLoading={foodLoading} loadMealPlan={loadMealPlan} mealPlan={mealPlan} />}
      </div>
    </section>
  </main>
}

function ScanFoodPanel({ foodScan, foodImagePreview, foodLoading, scanFoodImage, scanLiveFoodFrame, checkFood }: Pick<FoodToolsPageProps, 'foodScan' | 'foodImagePreview' | 'foodLoading' | 'scanFoodImage' | 'scanLiveFoodFrame' | 'checkFood'>) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanInFlightRef = useRef(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [autoScan, setAutoScan] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [selectedPreview, setSelectedPreview] = useState('')

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraOn(false)
    setAutoScan(false)
  }

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    stopCamera()
    setCameraError('')
    setSelectedPhoto(file)
    setSelectedPreview(current => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })
  }

  const scanSelectedPhoto = async () => {
    if (!selectedPhoto || foodLoading) return
    await scanFoodImage(selectedPhoto, selectedPhoto.name)
  }

  const startCamera = async () => {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setCameraOn(true)
    } catch {
      setCameraError('Camera permission is blocked or unavailable on this device.')
    }
  }

  const captureFrame = async () => {
    const video = videoRef.current
    if (!video || !cameraOn || scanInFlightRef.current || video.videoWidth === 0) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const image = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!image) {
      setCameraError('Could not capture the camera frame.')
      return
    }
    scanInFlightRef.current = true
    try {
      await scanLiveFoodFrame(image)
    } finally {
      scanInFlightRef.current = false
    }
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (selectedPreview) URL.revokeObjectURL(selectedPreview)
  }, [selectedPreview])

  useEffect(() => {
    if (!cameraOn || !videoRef.current || !streamRef.current) return
    videoRef.current.srcObject = streamRef.current
    void videoRef.current.play().catch(() => setCameraError('Could not start the live camera preview.'))
  }, [cameraOn])

  useEffect(() => {
    if (!autoScan || !cameraOn) return undefined
    const timer = window.setInterval(() => {
      void captureFrame()
    }, 5500)
    void captureFrame()
    return () => window.clearInterval(timer)
  }, [autoScan, cameraOn])

  return <div className="food-workspace">
    <section className="food-camera-card">
      <div className="food-card-heading">
        <span><Icon name="camera" size={18} /> Live food scan</span>
        <small>{cameraOn ? 'Camera active' : 'Live or upload'}</small>
      </div>
      <div className={cameraOn || selectedPreview || foodImagePreview ? 'camera-drop has-preview' : 'camera-drop'}>
        {cameraOn && <video ref={videoRef} playsInline muted />}
        {!cameraOn && (selectedPreview || foodImagePreview) && <img src={selectedPreview || foodImagePreview} alt="Selected food preview" />}
        {!cameraOn && !selectedPreview && !foodImagePreview && <div onClick={startCamera} style={{ cursor: 'pointer' }}>
          <Icon name="camera" size={34} />
          <strong>Start camera or upload food photo</strong>
          <small>Live scan, JPG, PNG, WEBP</small>
        </div>}
      </div>
      {cameraError && <p className="food-warning">{cameraError}</p>}
      <div className="camera-actions">
        {cameraOn ? <>
          <button type="button" onClick={captureFrame} disabled={foodLoading}>Scan frame</button>
          <button type="button" className={autoScan ? 'active' : ''} onClick={() => setAutoScan(current => !current)} disabled={foodLoading && !autoScan}>{autoScan ? 'Auto scan on' : 'Auto scan'}</button>
          <button type="button" className="secondary" onClick={stopCamera}>Stop</button>
        </> : <button type="button" onClick={startCamera}>Start camera</button>}
        <label className="camera-upload-button">
          Upload photo
          <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} />
        </label>
        {selectedPhoto && <button type="button" className="scan-photo-button" onClick={scanSelectedPhoto} disabled={foodLoading}>
          {foodLoading ? 'Scanning...' : 'Scan photo'}
        </button>}
      </div>
    </section>

    <section className="food-results-card">
      <div className="food-card-heading">
        <span><Icon name="spark" size={18} /> Scan results</span>
        <small>{foodScan ? `${foodScan.analyses.length} matched` : 'Waiting for image'}</small>
      </div>
      {!foodScan && <div className="food-empty-state">
        <Icon name="food" size={32} />
        <strong>No scan yet</strong>
        <p>Choose an image and NephroCare will list detected foods with kidney safety ratings.</p>
      </div>}
      {foodScan && <>
        <p className="detected-foods" aria-label="Detected foods">
          <b>Detected</b>
          {foodScan.detected_foods.map((food, index) => <button key={food} type="button" onClick={() => checkFood(food)}>
            {food}{index < foodScan.detected_foods.length - 1 ? ',' : ''}
          </button>)}
        </p>
        {foodScan.warning && <p className="food-warning">{foodScan.warning}</p>}
        <FoodAnalysisGrid items={foodScan.analyses} />
      </>}
    </section>
  </div>
}

function CheckFoodPanel({ foodName, setFoodName, foodCheck, foodLoading, checkFood }: Pick<FoodToolsPageProps, 'foodName' | 'setFoodName' | 'foodCheck' | 'foodLoading' | 'checkFood'>) {
  return <div className="food-workspace compact">
    <section className="food-results-card">
      <div className="food-card-heading">
        <span><Icon name="shield" size={18} /> Food safety</span>
      </div>
      <p>Type a food name or choose a common Indian item to see whether it is safe, moderate, or risky for CKD.</p>
      <div className="nutrition-inline food-search-row">
        <input value={foodName} onChange={event => setFoodName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') checkFood() }} placeholder="Example: banana" />
        <button type="button" onClick={() => checkFood()} disabled={foodLoading}>Check</button>
      </div>
    </section>
    <section className="food-results-card">
      {foodCheck ? <FoodAnalysisCard item={foodCheck} /> : <div className="food-empty-state">
        <Icon name="clipboard" size={32} />
        <strong>No food checked yet</strong>
        <p>Results show potassium, phosphorus, sodium, calories, protein, and kidney score.</p>
      </div>}
    </section>
  </div>
}

function FoodFilters({ foodStage, setFoodStage, foodHypertension, setFoodHypertension, foodDiabetes, setFoodDiabetes, actionLabel, disabled, onAction }: {
  foodStage: FoodStage
  setFoodStage: (stage: FoodStage) => void
  foodHypertension: YesNo
  setFoodHypertension: (value: YesNo) => void
  foodDiabetes: YesNo
  setFoodDiabetes: (value: YesNo) => void
  actionLabel: string
  disabled: boolean
  onAction: () => void
}) {
  return <div className="nutrition-inline food-filter-row">
    <select value={foodStage} onChange={event => setFoodStage(event.target.value as FoodStage)}>
      {stageOptions.map(stage => <option key={stage} value={stage}>{stage}</option>)}
    </select>
    <select value={foodHypertension} onChange={event => setFoodHypertension(event.target.value as YesNo)}>
      <option value="no">No BP issue</option>
      <option value="yes">High BP</option>
    </select>
    <select value={foodDiabetes} onChange={event => setFoodDiabetes(event.target.value as YesNo)}>
      <option value="no">No diabetes</option>
      <option value="yes">Diabetes</option>
    </select>
    <button type="button" onClick={onAction} disabled={disabled}>{actionLabel}</button>
  </div>
}

function RecommendationsPanel(props: Pick<FoodToolsPageProps, 'foodStage' | 'setFoodStage' | 'foodHypertension' | 'setFoodHypertension' | 'foodDiabetes' | 'setFoodDiabetes' | 'foodLoading' | 'loadRecommendations' | 'foodRecommendations' | 'checkFood'>) {
  return <section className="food-results-card wide">
    <div className="food-card-heading">
      <span><Icon name="food" size={18} /> Food recommendations</span>
      <small>Stage-aware list</small>
    </div>
    <p>Choose a CKD stage and risk flags to get better food suggestions from the processed food dataset.</p>
    <FoodFilters {...props} actionLabel="Show foods" disabled={props.foodLoading} onAction={props.loadRecommendations} />
    {props.foodRecommendations.length ? <FoodAnalysisGrid items={props.foodRecommendations} onPick={props.checkFood} /> : <div className="food-empty-state inline">
      <Icon name="spark" size={30} />
      <strong>No recommendations loaded</strong>
      <p>Press Show foods to generate a kidney-aware list.</p>
    </div>}
  </section>
}

function MealPlanPanel(props: Pick<FoodToolsPageProps, 'foodStage' | 'setFoodStage' | 'foodHypertension' | 'setFoodHypertension' | 'foodDiabetes' | 'setFoodDiabetes' | 'foodLoading' | 'loadMealPlan' | 'mealPlan'>) {
  return <section className="food-results-card wide">
    <div className="food-card-heading">
      <span><Icon name="chef" size={18} /> AI meal planner</span>
      <small>Breakfast to dinner</small>
    </div>
    <p>Build a simple day plan from the same kidney-friendly food data.</p>
    <FoodFilters {...props} actionLabel="Build plan" disabled={props.foodLoading} onAction={props.loadMealPlan} />
    {props.mealPlan ? <div className="meal-plan">
      {(['breakfast', 'lunch', 'snack', 'dinner'] as const).map(slot => <div key={slot} className="meal-slot">
        <h3 className="meal-slot-title">{slot.charAt(0).toUpperCase() + slot.slice(1)}</h3>
        <div className="food-analysis-grid">
          {props.mealPlan?.[slot].map(item => <FoodAnalysisCard key={item.food_name} item={item} />)}
        </div>
      </div>)}
      <ul className="meal-plan-notes">{props.mealPlan.notes.map(note => <li key={note}>{note}</li>)}</ul>
    </div> : <div className="food-empty-state inline">
      <Icon name="chef" size={30} />
      <strong>No meal plan yet</strong>
      <p>Press Build plan to generate a full day of food ideas.</p>
    </div>}
  </section>
}

function FoodAnalysisGrid({ items, onPick }: { items: FoodAnalysis[]; onPick?: (foodName: string) => void }) {
  if (!items.length) {
    return <div className="food-empty-state inline">
      <Icon name="alert" size={30} />
      <strong>No matching food details</strong>
      <p>Detected foods did not match the local nutrition dataset.</p>
    </div>
  }
  return <div className="food-analysis-grid" role="list">
    {items.map(item => <FoodAnalysisCard key={item.food_name} item={item} onPick={onPick} />)}
  </div>
}

function FoodAnalysisCard({ item, onPick }: { item: FoodAnalysis; onPick?: (foodName: string) => void }) {
  const label = item.display_name || item.food_name
  return <article className={`food-analysis-card ${statusClass(item.status)}`} role="listitem">
    {item.image_url && <div className="food-analysis-image-wrapper"><img src={item.image_url} alt={label} loading="lazy" /></div>}
    <div className="food-analysis-content">
      <div className="food-analysis-top">
        <div>
          <strong>{label}</strong>
          <small>{item.category || item.matched_food || 'Food item'}</small>
        </div>
        <span className="status-badge">{item.status}</span>
      </div>
      <div className="food-score">
        <b>{item.kidney_score}</b>
        <small>score</small>
      </div>
      <div className="food-nutrients">
        <span><small>K</small><b>{item.potassium_mg} mg</b></span>
        <span><small>P</small><b>{item.phosphorus_mg} mg</b></span>
        <span><small>Na</small><b>{item.sodium_mg} mg</b></span>
        <span><small>Protein</small><b>{item.protein_g} g</b></span>
      </div>
      {onPick && <button type="button" onClick={() => onPick(label)}>Check details</button>}
    </div>
  </article>
}
