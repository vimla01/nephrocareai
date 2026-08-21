import { useState, useEffect } from 'react'
import {
  User, Bell, Shield, Activity, Pill, Utensils, Smartphone,
  ChevronRight, Moon, Sun, Save, CheckCircle, AlertTriangle,
  Phone, Mail, Globe, Clock, Trash2, Download, Upload, Lock,
  Eye, EyeOff, HelpCircle, Info
} from 'lucide-react'
import '../styles/settings.css'
import { API_BASE_URL } from '../constants'

type SettingsSection =
  | 'profile'
  | 'notifications'
  | 'health'
  | 'medications'
  | 'diet'
  | 'wearable'
  | 'privacy'
  | 'data'

interface UserProfile {
  name: string
  email: string
  phone: string
  dob: string
  gender: string
  ckdStage: string
  nephrologist: string
  bloodType: string
  emergencyContact: string
}

const defaultProfile: UserProfile = {
  name: 'Anonymous Patient',
  email: 'patient@nephrocare.ai',
  phone: '',
  dob: '',
  gender: '',
  ckdStage: 'G3a',
  nephrologist: '',
  bloodType: '',
  emergencyContact: ''
}

import type { Page } from '../types'

interface SettingsPageProps {
  user: { name: string; email: string } | null
  showPage: (p: Page) => void
}

export function SettingsPage({ user, showPage }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('nephrocare_profile')
      return saved ? { ...defaultProfile, ...JSON.parse(saved) } : {
        ...defaultProfile,
        name: user?.name || defaultProfile.name,
        email: user?.email || defaultProfile.email
      }
    } catch { return defaultProfile }
  })

  // Notification prefs
  const [medReminder, setMedReminder] = useState(() => localStorage.getItem('nephrocare_med_reminder') === 'true')
  const [foodReminder, setFoodReminder] = useState(() => localStorage.getItem('nephrocare_food_reminder') === 'true')
  const [labReminder, setLabReminder] = useState(() => localStorage.getItem('nephrocare_lab_reminder') === 'true')
  const [wearableAlerts, setWearableAlerts] = useState(() => localStorage.getItem('nephrocare_wearable_alerts') !== 'false')
  const [whatsappAlerts, setWhatsappAlerts] = useState(() => (localStorage.getItem('nephrocare_whatsapp_enabled') || localStorage.getItem('nephrocare_whatsapp_alerts')) === 'true')
  const [emailAlerts, setEmailAlerts] = useState(() => localStorage.getItem('nephrocare_email_alerts') !== 'false')

  // Health prefs
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('nephrocare_dark_mode') === 'true')
  const [egfrUnit, setEgfrUnit] = useState(() => localStorage.getItem('nephrocare_egfr_unit') || 'mL/min/1.73m²')
  const [weightUnit, setWeightUnit] = useState(() => localStorage.getItem('nephrocare_weight_unit') || 'kg')
  const [tempUnit, setTempUnit] = useState(() => localStorage.getItem('nephrocare_temp_unit') || 'Celsius')
  const [language, setLanguage] = useState(() => localStorage.getItem('nephrocare_language') || 'en')

  // Medication prefs
  const [reminderFreq, setReminderFreq] = useState(() => localStorage.getItem('nephrocare_med_freq') || 'Twice daily')
  const [reminderTime1, setReminderTime1] = useState(() => localStorage.getItem('nephrocare_med_time1') || '08:00')
  const [reminderTime2, setReminderTime2] = useState(() => localStorage.getItem('nephrocare_med_time2') || '20:00')

  // Diet prefs
  const [dietRestriction, setDietRestriction] = useState(() => localStorage.getItem('nephrocare_diet') || 'Low Potassium')
  const [dailyCalories, setDailyCalories] = useState(() => localStorage.getItem('nephrocare_calories') || '1800')
  const [fluidLimit, setFluidLimit] = useState(() => localStorage.getItem('nephrocare_fluid_limit') || '1.5')

  // Privacy prefs
  const [shareWithDoctor, setShareWithDoctor] = useState(() => localStorage.getItem('nephrocare_share_doctor') !== 'false')
  const [anonymousAnalytics, setAnonymousAnalytics] = useState(() => localStorage.getItem('nephrocare_analytics') !== 'false')
  const [twoFactor, setTwoFactor] = useState(() => localStorage.getItem('nephrocare_2fa') === 'true')
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  // Fetch profile from backend on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (user && token) {
      fetch(`${API_BASE_URL}/api/patient/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && Object.keys(data).length > 0) {
          setProfile(prev => {
            const newProfile = { ...prev, ...data }
            localStorage.setItem('nephrocare_profile', JSON.stringify(newProfile))
            if (newProfile.phone) {
              localStorage.setItem('nephrocare_phone', newProfile.phone)
            }
            return newProfile
          })
          if (data.preferences) {
             const p = data.preferences
             if (p.medReminder !== undefined) setMedReminder(p.medReminder)
             if (p.foodReminder !== undefined) setFoodReminder(p.foodReminder)
             if (p.labReminder !== undefined) setLabReminder(p.labReminder)
             if (p.wearableAlerts !== undefined) setWearableAlerts(p.wearableAlerts)
             if (p.whatsappAlerts !== undefined) setWhatsappAlerts(p.whatsappAlerts)
             if (p.emailAlerts !== undefined) setEmailAlerts(p.emailAlerts)
             if (p.darkMode !== undefined) setDarkMode(p.darkMode)
             if (p.egfrUnit !== undefined) setEgfrUnit(p.egfrUnit)
             if (p.weightUnit !== undefined) setWeightUnit(p.weightUnit)
             if (p.tempUnit !== undefined) setTempUnit(p.tempUnit)
             if (p.reminderFreq !== undefined) setReminderFreq(p.reminderFreq)
             if (p.reminderTime1 !== undefined) setReminderTime1(p.reminderTime1)
             if (p.reminderTime2 !== undefined) setReminderTime2(p.reminderTime2)
             if (p.dietRestriction !== undefined) setDietRestriction(p.dietRestriction)
             if (p.dailyCalories !== undefined) setDailyCalories(p.dailyCalories)
             if (p.fluidLimit !== undefined) setFluidLimit(p.fluidLimit)
             
             const localLang = localStorage.getItem('nephrocare_language')
             if (p.language !== undefined && (!localLang || localLang === p.language)) {
               setLanguage(p.language)
             } else if (p.language !== undefined && localLang && localLang !== p.language) {
               // If backend differs from local, we must sync local to backend to avoid being overwritten on next load
                const token = localStorage.getItem('auth_token')
                fetch(`${API_BASE_URL}/api/patient/profile`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ ...data, preferences: { ...p, language: localLang } })
                }).catch(console.error)
             }
             if (p.fluidLimit !== undefined) setFluidLimit(p.fluidLimit)
             if (p.shareWithDoctor !== undefined) setShareWithDoctor(p.shareWithDoctor)
             if (p.anonymousAnalytics !== undefined) setAnonymousAnalytics(p.anonymousAnalytics)
             if (p.twoFactor !== undefined) setTwoFactor(p.twoFactor)
          }
        }
      })
      .catch(err => console.error('Failed to load profile from DB:', err))
    }
  }, [user])

  // Apply dark mode to document whenever it changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-mode')
    } else {
      document.documentElement.classList.remove('dark-mode')
    }
  }, [darkMode])

  // Dispatch language change event so chatbot and other pages can react
  useEffect(() => {
    localStorage.setItem('nephrocare_language', language)
    
    const target = `/en/${language}`;
    const match = document.cookie.match(/googtrans=([^;]+)/);
    const current = match ? match[1] : '';
    
    if (language === 'en' && current && current !== '/en/en') {
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=" + window.location.hostname + "; path=/;";
      window.location.reload();
    } else if (language !== 'en' && current !== target) {
      document.cookie = `googtrans=${target}; path=/`;
      document.cookie = `googtrans=${target}; domain=${window.location.hostname}; path=/`;
      window.location.reload();
    }

    window.dispatchEvent(new CustomEvent('nephrocare_language_change', { detail: { language } }))
  }, [language])

  const handleDarkModeToggle = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('nephrocare_dark_mode', String(next))
  }

  // Save state
  const [saved, setSaved] = useState(false)

  const saveAll = () => {
    localStorage.setItem('nephrocare_profile', JSON.stringify(profile))
    localStorage.setItem('nephrocare_phone', profile.phone)
    
    const token = localStorage.getItem('auth_token')
    if (user && token) {
      const payload = {
        ...profile,
        preferences: {
          medReminder, foodReminder, labReminder, wearableAlerts, whatsappAlerts, emailAlerts,
          darkMode, egfrUnit, weightUnit, tempUnit, language, reminderFreq, reminderTime1, reminderTime2,
          dietRestriction, dailyCalories, fluidLimit, shareWithDoctor, anonymousAnalytics, twoFactor
        }
      }
      fetch(`${API_BASE_URL}/api/patient/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }).catch(err => console.error('Failed to save profile to DB:', err))
    }

    localStorage.setItem('nephrocare_med_reminder', String(medReminder))
    localStorage.setItem('nephrocare_food_reminder', String(foodReminder))
    localStorage.setItem('nephrocare_lab_reminder', String(labReminder))
    localStorage.setItem('nephrocare_wearable_alerts', String(wearableAlerts))
    localStorage.setItem('nephrocare_whatsapp_enabled', String(whatsappAlerts))
    localStorage.setItem('nephrocare_whatsapp_alerts', String(whatsappAlerts))
    localStorage.setItem('nephrocare_email_alerts', String(emailAlerts))
    localStorage.setItem('nephrocare_dark_mode', String(darkMode))
    localStorage.setItem('nephrocare_egfr_unit', egfrUnit)
    localStorage.setItem('nephrocare_weight_unit', weightUnit)
    localStorage.setItem('nephrocare_temp_unit', tempUnit)
    localStorage.setItem('nephrocare_language', language)
    localStorage.setItem('nephrocare_med_freq', reminderFreq)
    localStorage.setItem('nephrocare_med_time1', reminderTime1)
    localStorage.setItem('nephrocare_med_time2', reminderTime2)
    localStorage.setItem('nephrocare_diet', dietRestriction)
    localStorage.setItem('nephrocare_calories', dailyCalories)
    localStorage.setItem('nephrocare_fluid_limit', fluidLimit)
    localStorage.setItem('nephrocare_share_doctor', String(shareWithDoctor))
    localStorage.setItem('nephrocare_analytics', String(anonymousAnalytics))
    localStorage.setItem('nephrocare_2fa', String(twoFactor))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const exportData = () => {
    const data = {
      profile,
      predictions: JSON.parse(localStorage.getItem('nephrocare_predictions') || '[]'),
      scans: JSON.parse(localStorage.getItem('nephrocare_ultrasound_scans') || '[]'),
      exportedAt: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `nephrocare_data_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  const clearAllData = () => {
    if (window.confirm('Are you sure? This will clear all your saved health data locally. This cannot be undone.')) {
      ['nephrocare_predictions', 'nephrocare_ultrasound_scans', 'nephrocare_symptom_logs', 'nephrocare_food_checks'].forEach(k => localStorage.removeItem(k))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 8) return
    const token = localStorage.getItem('auth_token')
    if (!token) return
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        alert('Your password has been successfully updated!')
        setNewPassword('')
      } else {
        alert(data.error || 'Failed to update password')
      }
    } catch (err) {
      alert('Network error while updating password')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = e.currentTarget.closest('.settings-grid-2');
      if (form) {
        const elements = Array.from(form.querySelectorAll('input, select')) as HTMLElement[];
        const index = elements.indexOf(e.currentTarget);
        if (index > -1 && index < elements.length - 1) {
          elements[index + 1].focus();
        }
      }
    }
  };

  const navItems: { id: SettingsSection; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'profile',       label: 'Profile',        icon: <User size={18} />,        desc: 'Personal info & CKD details' },
    { id: 'notifications', label: 'Notifications',  icon: <Bell size={18} />,        desc: 'Reminders & alerts' },
    { id: 'medications',   label: 'Medications',    icon: <Pill size={18} />,        desc: 'Medication schedule & reminders' },
    { id: 'diet',          label: 'Diet & Fluids',  icon: <Utensils size={18} />,    desc: 'Dietary restrictions & goals' },
    { id: 'wearable',      label: 'Wearable',       icon: <Smartphone size={18} />,  desc: 'Device & telemetry settings' },
    { id: 'privacy',       label: 'Privacy',        icon: <Shield size={18} />,      desc: 'Password, 2FA & data clearing' },
  ]

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <span className="settings-eyebrow">Account Settings</span>
          <h1 className="settings-title">Personalize NephroCare</h1>
          <p className="settings-subtitle">Manage your profile, reminders, health units, privacy and data preferences.</p>
        </div>
        <button className={`settings-save-btn ${saved ? 'saved' : ''}`} onClick={saveAll}>
          {saved ? <><CheckCircle size={16} /> Saved!</> : <><Save size={16} /> Save Changes</>}
        </button>
      </div>

      <div className="settings-layout">
        {/* Sidebar Nav */}
        <aside className="settings-sidebar">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`settings-nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <div className="settings-nav-icon">{item.icon}</div>
              <div className="settings-nav-text">
                <span className="settings-nav-label">{item.label}</span>
                <span className="settings-nav-desc">{item.desc}</span>
              </div>
              <ChevronRight size={14} className="settings-nav-arrow" />
            </button>
          ))}
        </aside>

        {/* Content Panel */}
        <main className="settings-content">

          {/* ─── PROFILE ─── */}
          {activeSection === 'profile' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <User size={20} />
                <div>
                  <h2>Patient Profile</h2>
                  <p>Your personal and medical identity details used across all NephroCare features.</p>
                </div>
              </div>

              <div className="settings-avatar-row">
                <div className="settings-avatar">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '17px' }}>{profile.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{profile.email}</div>
                  <div className="settings-ckd-badge">CKD Stage {profile.ckdStage}</div>
                </div>
              </div>

              <div className="settings-grid-2">
                <div className="settings-field">
                  <label>Full Name</label>
                  <input type="text" value={profile.name} onChange={e => setProfile(p => ({...p, name: e.target.value}))} onKeyDown={handleKeyDown} placeholder="Your full name" />
                </div>
                <div className="settings-field">
                  <label>Email Address</label>
                  <input type="email" value={profile.email} onChange={e => setProfile(p => ({...p, email: e.target.value}))} onKeyDown={handleKeyDown} placeholder="you@example.com" />
                </div>
                <div className="settings-field">
                  <label>Phone Number</label>
                  <input type="tel" value={profile.phone} onChange={e => setProfile(p => ({...p, phone: e.target.value}))} onKeyDown={handleKeyDown} placeholder="+91 XXXXX XXXXX" />
                </div>
                <div className="settings-field">
                  <label>Date of Birth</label>
                  <input type="date" value={profile.dob} onChange={e => setProfile(p => ({...p, dob: e.target.value}))} onKeyDown={handleKeyDown} />
                </div>
                <div className="settings-field">
                  <label>Gender</label>
                  <select value={profile.gender} onChange={e => setProfile(p => ({...p, gender: e.target.value}))} onKeyDown={handleKeyDown}>
                    <option value="">Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Non-binary</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>
                <div className="settings-field">
                  <label>Blood Type</label>
                  <select value={profile.bloodType} onChange={e => setProfile(p => ({...p, bloodType: e.target.value}))} onKeyDown={handleKeyDown}>
                    <option value="">Select blood type</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="settings-field">
                  <label>CKD Stage</label>
                  <select value={profile.ckdStage} onChange={e => setProfile(p => ({...p, ckdStage: e.target.value}))} onKeyDown={handleKeyDown}>
                    {['G1','G2','G3a','G3b','G4','G5'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="settings-field">
                  <label>Nephrologist Name</label>
                  <input type="text" value={profile.nephrologist} onChange={e => setProfile(p => ({...p, nephrologist: e.target.value}))} onKeyDown={handleKeyDown} placeholder="Dr. Full Name" />
                </div>
                <div className="settings-field settings-field-full">
                  <label>Emergency Contact</label>
                  <input type="text" value={profile.emergencyContact} onChange={e => setProfile(p => ({...p, emergencyContact: e.target.value}))} onKeyDown={handleKeyDown} placeholder="Name — +91 XXXXX XXXXX" />
                </div>
              </div>
            </div>
          )}

          {/* ─── NOTIFICATIONS ─── */}
          {activeSection === 'notifications' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <Bell size={20} />
                <div>
                  <h2>Notification Preferences</h2>
                  <p>Control which reminders and alerts NephroCare sends you during the day.</p>
                </div>
              </div>

              <div className="settings-toggle-group">
                <h3 className="settings-group-title">Health Reminders</h3>

                <ToggleRow
                  icon={<Pill size={16} />}
                  label="Medication Reminders"
                  desc="Get notified when it's time to take your CKD medications"
                  value={medReminder}
                  onChange={setMedReminder}
                  color="blue"
                />
                <ToggleRow
                  icon={<Utensils size={16} />}
                  label="Dietary Check-ins"
                  desc="Periodic reminders to log meals and stay on your kidney-safe diet"
                  value={foodReminder}
                  onChange={setFoodReminder}
                  color="green"
                />
                <ToggleRow
                  icon={<Activity size={16} />}
                  label="Lab Test Reminders"
                  desc="Alert when monthly eGFR or creatinine check is due"
                  value={labReminder}
                  onChange={setLabReminder}
                  color="amber"
                />
                <ToggleRow
                  icon={<Smartphone size={16} />}
                  label="Wearable Anomaly Alerts"
                  desc="Instant notifications for abnormal heart rate, SpO2, or kidney stress"
                  value={wearableAlerts}
                  onChange={setWearableAlerts}
                  color="red"
                />
              </div>

              <div className="settings-toggle-group">
                <h3 className="settings-group-title">Delivery Channels</h3>

                <ToggleRow
                  icon={<Mail size={16} />}
                  label="Email Notifications"
                  desc="Receive weekly summary and critical alerts via email"
                  value={emailAlerts}
                  onChange={setEmailAlerts}
                  color="blue"
                />
                <ToggleRow
                  icon={<Phone size={16} />}
                  label="WhatsApp Alerts"
                  desc="Get real-time alerts through WhatsApp (requires phone number)"
                  value={whatsappAlerts}
                  onChange={setWhatsappAlerts}
                  color="green"
                />
              </div>
            </div>
          )}

          {/* ─── MEDICATIONS ─── */}
          {activeSection === 'medications' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <Pill size={20} />
                <div>
                  <h2>Medication Schedule</h2>
                  <p>Set reminder frequency and exact times for your daily CKD medications.</p>
                </div>
              </div>

              <div className="settings-grid-2">
                <div className="settings-field">
                  <label>Reminder Frequency</label>
                  <select value={reminderFreq} onChange={e => setReminderFreq(e.target.value)} onKeyDown={handleKeyDown}>
                    <option>Once daily</option>
                    <option>Twice daily</option>
                    <option>Three times daily</option>
                    <option>With meals only</option>
                  </select>
                </div>
                <div className="settings-field">
                  <label>First Dose Time</label>
                  <input type="time" value={reminderTime1} onChange={e => setReminderTime1(e.target.value)} onKeyDown={handleKeyDown} />
                </div>
                {(reminderFreq === 'Twice daily' || reminderFreq === 'Three times daily') && (
                  <div className="settings-field">
                    <label>Second Dose Time</label>
                    <input type="time" value={reminderTime2} onChange={e => setReminderTime2(e.target.value)} onKeyDown={handleKeyDown} />
                  </div>
                )}
              </div>

              <div className="settings-med-preview">
                <div className="settings-med-preview-header">
                  <Clock size={14} />
                  <span>Today's Medication Schedule Preview</span>
                </div>
                <div className="settings-med-timeline">
                  <div className="settings-med-dot blue">
                    <span>{reminderTime1}</span>
                    <span>Morning Dose</span>
                  </div>
                  {(reminderFreq === 'Twice daily' || reminderFreq === 'Three times daily') && (
                    <div className="settings-med-dot green">
                      <span>{reminderTime2}</span>
                      <span>Evening Dose</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="settings-info-card warning">
                <AlertTriangle size={15} />
                <span>Always follow your nephrologist's prescription. These reminders are a convenience tool only.</span>
              </div>
            </div>
          )}

          {/* ─── DIET ─── */}
          {activeSection === 'diet' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <Utensils size={20} />
                <div>
                  <h2>Diet & Fluid Goals</h2>
                  <p>Configure dietary restrictions and daily fluid intake targets used by the Food Tools feature.</p>
                </div>
              </div>

              <div className="settings-grid-2">
                <div className="settings-field">
                  <label>Primary Dietary Restriction</label>
                  <select value={dietRestriction} onChange={e => setDietRestriction(e.target.value)} onKeyDown={handleKeyDown}>
                    <option>Low Potassium</option>
                    <option>Low Phosphorus</option>
                    <option>Low Sodium</option>
                    <option>Low Protein</option>
                    <option>Renal Diet (All Restricted)</option>
                    <option>No Restrictions</option>
                  </select>
                </div>
                <div className="settings-field">
                  <label>Daily Calorie Target (kcal)</label>
                  <input type="number" value={dailyCalories} min={1000} max={3500}
                    onChange={e => setDailyCalories(e.target.value)} onKeyDown={handleKeyDown} placeholder="e.g. 1800" />
                </div>
                <div className="settings-field">
                  <label>Daily Fluid Limit (Litres)</label>
                  <input type="number" value={fluidLimit} min={0.5} max={4} step={0.1}
                    onChange={e => setFluidLimit(e.target.value)} onKeyDown={handleKeyDown} placeholder="e.g. 1.5" />
                </div>
              </div>

              <div className="settings-diet-chips">
                {['Potassium', 'Phosphorus', 'Sodium', 'Protein', 'Fluid'].map(nutrient => (
                  <div key={nutrient} className={`settings-diet-chip ${dietRestriction.toLowerCase().includes(nutrient.toLowerCase()) || dietRestriction === 'Renal Diet (All Restricted)' ? 'restricted' : 'normal'}`}>
                    {dietRestriction.toLowerCase().includes(nutrient.toLowerCase()) || dietRestriction === 'Renal Diet (All Restricted)'
                      ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                    {nutrient}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── WEARABLE ─── */}
          {activeSection === 'wearable' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <Smartphone size={20} />
                <div>
                  <h2>Wearable Twin Settings</h2>
                  <p>Configure how the digital wearable twin collects and processes your telemetry data.</p>
                </div>
              </div>

              <div className="settings-wearable-status">
                <div className="wearable-dot active"></div>
                <div>
                  <div style={{ fontWeight: 600 }}>NephroCare Wearable Twin</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Simulated stream active — update interval: 5s</div>
                </div>
                <span className="wearable-status-badge">Connected</span>
              </div>

              <div className="settings-toggle-group">
                <h3 className="settings-group-title">Alert Thresholds</h3>
                <ToggleRow
                  icon={<Activity size={16} />}
                  label="Wearable Anomaly Alerts"
                  desc="Notify when SpO2 drops below 92% or HR exceeds 94 BPM"
                  value={wearableAlerts}
                  onChange={setWearableAlerts}
                  color="red"
                />
              </div>

              <div className="settings-grid-2" style={{ marginTop: '20px' }}>
                <div className="settings-stat-card">
                  <div className="settings-stat-label">Heart Rate Threshold</div>
                  <div className="settings-stat-value">94 <span>BPM</span></div>
                </div>
                <div className="settings-stat-card">
                  <div className="settings-stat-label">SpO₂ Minimum</div>
                  <div className="settings-stat-value">92 <span>%</span></div>
                </div>
                <div className="settings-stat-card">
                  <div className="settings-stat-label">Kidney Stress Alert</div>
                  <div className="settings-stat-value">&gt; 70 <span>/100</span></div>
                </div>
                <div className="settings-stat-card">
                  <div className="settings-stat-label">Skin Temp Alert</div>
                  <div className="settings-stat-value">38.5 <span>°C</span></div>
                </div>
              </div>

              <div className="settings-info-card">
                <Info size={15} />
                <span>Thresholds are medically calibrated for CKD patients. Contact your nephrologist before adjusting.</span>
              </div>
            </div>
          )}

          {/* ─── PRIVACY ─── */}
          {activeSection === 'privacy' && (
            <div className="settings-section">
              <div className="settings-section-header">
                <Shield size={20} />
                <div>
                  <h2>Privacy & Security</h2>
                  <p>Manage your data sharing preferences, password, and account security.</p>
                </div>
              </div>

              <div className="settings-toggle-group">
                <h3 className="settings-group-title">Data Sharing</h3>
                <ToggleRow
                  icon={<HelpCircle size={16} />}
                  label="Share Data with Nephrologist"
                  desc="Allow your doctor to access your dashboard summaries and AI reports"
                  value={shareWithDoctor}
                  onChange={setShareWithDoctor}
                  color="blue"
                />
                <ToggleRow
                  icon={<Globe size={16} />}
                  label="Anonymous Analytics"
                  desc="Help improve NephroCare by sharing anonymized usage data"
                  value={anonymousAnalytics}
                  onChange={setAnonymousAnalytics}
                  color="green"
                />
                <ToggleRow
                  icon={<Lock size={16} />}
                  label="Two-Factor Authentication"
                  desc="Add an extra security layer with OTP verification on login"
                  value={twoFactor}
                  onChange={setTwoFactor}
                  color="amber"
                />
              </div>

              <div className="settings-data-cards" style={{ marginBottom: '24px' }}>
                <div className="settings-data-card danger" style={{ border: '1px solid #fca5a5' }}>
                  <div className="settings-data-card-icon danger"><Trash2 size={22} /></div>
                  <div>
                    <div className="settings-data-card-title">Clear All Health Data</div>
                    <div className="settings-data-card-desc">Permanently remove all locally stored predictions, scans, and logs. Cannot be undone.</div>
                  </div>
                  <button className="settings-data-btn danger-btn" onClick={clearAllData}>Clear Data</button>
                </div>
              </div>

              <div className="settings-password-box">
                <h3 className="settings-group-title">Change Password</h3>
                <div className="settings-password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password..."
                    onKeyDown={handleKeyDown}
                  />
                  <button onClick={() => setShowPassword(p => !p)} className="settings-eye-btn">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button onClick={handleChangePassword} className="settings-change-pw-btn" disabled={newPassword.length < 8}>
                  {newPassword.length < 8 ? 'Minimum 8 characters' : 'Update Password'}
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

// ─── Reusable Toggle Row ───
function ToggleRow({ icon, label, desc, value, onChange, color }: {
  icon: React.ReactNode; label: string; desc: string;
  value: boolean; onChange: (v: boolean) => void; color: string
}) {
  return (
    <div className="settings-toggle-row">
      <div className={`settings-toggle-icon ${color}`}>{icon}</div>
      <div className="settings-toggle-text">
        <div className="settings-toggle-label">{label}</div>
        <div className="settings-toggle-desc">{desc}</div>
      </div>
      <button
        className={`settings-toggle-switch ${value ? 'on' : 'off'}`}
        onClick={() => onChange(!value)}
        aria-label={label}
      >
        <span className="settings-toggle-thumb" />
      </button>
    </div>
  )
}
