import { useState, useEffect } from 'react'
import { Icon } from '../components/Icon'
import type { Page, WhatsAppLog, ToastType } from '../types'
import { Bell, Smartphone, Shield, Activity, Clock, Check } from 'lucide-react'
import { API_BASE_URL } from '../constants'
import '../styles/alerts.css'

type AlertsPageProps = {
  showPage: (page: Page) => void
  user: { name: string; email: string } | null
  addToast: (type: ToastType, title: string, message: string, action?: any) => void
}

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error)
    }
  }
  return [storedValue, setValue] as const
}

export function AlertsPage({ showPage, user, addToast }: AlertsPageProps) {
  const [whatsappEnabled, setWhatsappEnabled] = useLocalStorage('nephrocare_whatsapp_enabled', false)
  const [phone, setPhone] = useLocalStorage('nephrocare_phone', '')
  const [whatsappLogs, setWhatsappLogs] = useLocalStorage<WhatsAppLog[]>('nephrocare_whatsapp_history', [])

  const [medReminder, setMedReminder] = useLocalStorage('nephrocare_med_reminder', false)
  const [foodReminder, setFoodReminder] = useLocalStorage('nephrocare_food_reminder', false)

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const item = window.localStorage.getItem('nephrocare_whatsapp_history')
        if (item) {
          setWhatsappLogs(JSON.parse(item))
        }
      } catch (err) {
        console.error(err)
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  if (!user) {
    return (
      <main className="dashboard-page auth-wall">
        <div className="auth-wall-card">
          <div className="auth-wall-icon">
            <Icon name="shield" size={48} />
          </div>
          <h2>Smart Alerts is Locked</h2>
          <p>Please log in or create an account to configure your alerts.</p>
          <div className="auth-wall-actions">
            <button className="login-btn-primary" onClick={() => showPage('login')}>Log In</button>
            <button className="signup-btn-secondary" onClick={() => showPage('signup')}>Sign Up</button>
          </div>
        </div>
      </main>
    )
  }

  const testWhatsApp = async () => {
    if (!phone) {
      addToast('warning', 'Missing Phone', 'Please enter a phone number to test WhatsApp.')
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone,
          message: `🔔 NephroCare Test Alert\n\n*Connection Successful*\nYour WhatsApp alerts are now configured.`
        })
      })
      const data = await response.json()
      if (data.success) {
        addToast('success', 'Test Sent', `Test message sent to ${phone} automatically!`)
        setWhatsappLogs([{ timestamp: new Date().toISOString(), title: 'Test Alert', message: 'Connection Successful', status: 'Sent' as const }, ...whatsappLogs].slice(0, 50))
      } else {
        addToast(
          'danger',
          'Sandbox Opt-In Required',
          'Your number has not joined the Twilio Sandbox. You can send manually via WhatsApp Web or join your Twilio Sandbox first.',
          data.whatsapp_web_url ? { label: 'Send via WhatsApp Web', url: data.whatsapp_web_url } : undefined
        )
        setWhatsappLogs([{ timestamp: new Date().toISOString(), title: 'Test Alert', message: data.error || 'Failed to send (Sandbox Opt-In Required)', status: 'Failed' as const }, ...whatsappLogs].slice(0, 50))
      }
    } catch (err) {
      console.error(err)
      addToast(
        'danger',
        'Failed to Send (Network Error)',
        'Could not connect to the API backend.'
      )
      setWhatsappLogs([{ timestamp: new Date().toISOString(), title: 'Test Alert', message: 'Network connection failure', status: 'Failed' as const }, ...whatsappLogs].slice(0, 50))
    }
  }

  const clearHistory = () => {
    setWhatsappLogs([])
    window.localStorage.setItem('nephrocare_whatsapp_history', '[]')
    addToast('info', 'Logs Cleared', 'Notification history has been reset.')
  }

  return (
    <div className="alerts-page-container">
      {/* Title Header */}
      <div className="alerts-header">
        <h1>
          <span className="title-icon-wrapper"><Bell size={28} /></span>
          Smart Alerts & Reminders
        </h1>
        <p>Configure automated reminders and emergency WhatsApp notifications in a premium command dashboard.</p>
      </div>

      {/* Main Responsive Grid */}
      <div className="alerts-grid">
        {/* Left Column: Control Center */}
        <div className="alerts-column">
          <div className="alerts-card control-card">
            <div className="card-header-accent">
              <h2><Clock size={18} /> Automated Routines</h2>
              <p className="alerts-desc">Get timely notifications about your essential CKD routines.</p>
            </div>
            
            <div className="routine-toggle">
              <div className="routine-info">
                <h3>Medication Reminder</h3>
                <p>Alerts every few hours to take your prescriptions.</p>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={medReminder} 
                  onChange={(e) => {
                    setMedReminder(e.target.checked)
                    if (e.target.checked) addToast('info', 'Medication Alerts On', 'We will periodically remind you.')
                  }} 
                />
                <span className="slider round"></span>
              </label>
            </div>

            <div className="routine-toggle">
              <div className="routine-info">
                <h3>Diet & Hydration Logging</h3>
                <p>Gentle nudges to keep your food diary updated.</p>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={foodReminder} 
                  onChange={(e) => {
                    setFoodReminder(e.target.checked)
                    if (e.target.checked) addToast('success', 'Diet Alerts On', 'We will periodically remind you.')
                  }} 
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>

          <div className="alerts-card config-card">
            <div className="card-header-accent">
              <h2><Smartphone size={18} /> WhatsApp Integration</h2>
              <p className="alerts-desc">Receive critical alerts (like severe symptoms or highly abnormal lab results) directly to your phone.</p>
            </div>
            
            <div className="wa-config-box">
              <div className="form-group">
                <label>Phone Number (with Country Code)</label>
                <input 
                  type="text" 
                  placeholder="+919321754752" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  className="wa-input"
                />
              </div>

              <div className="inline-toggle">
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={whatsappEnabled} 
                    onChange={e => setWhatsappEnabled(e.target.checked)} 
                  />
                  <span className="slider round"></span>
                </label>
                <span className={`toggle-label ${whatsappEnabled ? 'enabled' : 'disabled'}`}>
                  {whatsappEnabled ? 'WhatsApp Alerts Enabled' : 'Enable WhatsApp Alerts'}
                </span>
              </div>
              
              <button className="btn-test-action" onClick={testWhatsApp} disabled={!whatsappEnabled || !phone}>
                Send Test Alert
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Phone Mockup & History Log */}
        <div className="alerts-column">
          <div className="alerts-double-visual-card">
            {/* Timeline Activity Log */}
            <div className="alerts-card history-timeline-card">
              <div className="history-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}><Activity size={18} /> Notification History</h2>
                {whatsappLogs.length > 0 && (
                  <button 
                    type="button" 
                    onClick={clearHistory}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  >
                    Clear Logs
                  </button>
                )}
              </div>
              <div className="timeline-container">
                {whatsappLogs.length === 0 ? (
                  <div className="empty-history">
                    <Shield size={32} />
                    <p>No alerts have been recorded yet.</p>
                  </div>
                ) : (
                  whatsappLogs.map((log, idx) => (
                    <div key={idx} className={`timeline-item status-${log.status.toLowerCase()}`}>
                      <div className="timeline-line"></div>
                      <div className="timeline-indicator-dot"></div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <strong>{log.title}</strong>
                          <span className="timeline-time">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p>{log.message}</p>
                        <div className="timeline-footer">
                          <span className={`status-badge badge-${log.status.toLowerCase()}`}>{log.status}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
