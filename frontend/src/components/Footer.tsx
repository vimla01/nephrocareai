import { useState } from 'react'
import type { Page, ToastType } from '../types'
import { 
  Mail, 
  Send, 
  Shield, 
  Activity, 
  Heart,
  BookOpen,
  Phone,
  FileText
} from 'lucide-react'

type FooterProps = {
  showPage: (page: Page) => void
  scrollTo: (id: string) => void
  addToast?: (
    type: ToastType, 
    title: string, 
    message: string,
    action?: { label: string; url: string }
  ) => void
}

export function Footer({ showPage, scrollTo, addToast }: FooterProps) {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      if (addToast) {
        addToast('danger', 'Invalid Email', 'Please enter a valid email address.')
      }
      return
    }
    setSubscribed(true)
    if (addToast) {
      addToast('success', 'Subscribed!', 'Successfully subscribed to NephroCare Kidney Health newsletter.')
    }
    setEmail('')
    setTimeout(() => setSubscribed(false), 5000)
  }

  return <footer id="resources" className="footer-container">
    <div className="footer-glass-card">
      <div className="footer-main">
        {/* Brand & Newsletter Column */}
        <div className="footer-column footer-brand-column">
        <a className="brand footer-brand" href="#top" onClick={event => { event.preventDefault(); showPage('home') }}>
          <img className="footer-logo" src="/logo.png" alt="" />
          <span className="brand-text">NephroCare<small>CKD PREDICTION SYSTEM</small></span>
        </a>
        <p className="footer-description">
          An integrated AI-driven screening and monitoring companion designed to assist patients in tracking kidney risk factors, nutrition, and daily clinical telemetry.
        </p>
        
        <div className="footer-newsletter">
          <h4>Stay Informed</h4>
          <p>Get daily kidney care tips, scientific insights, and stage progression guidelines.</p>
          <form onSubmit={handleSubscribe} className="newsletter-form">
            <input 
              type="email" 
              placeholder="Enter your email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              aria-label="Email address for newsletter"
            />
            <button type="submit" disabled={subscribed} aria-label="Subscribe to newsletter">
              <Send size={16} />
            </button>
          </form>
          {subscribed && <span className="newsletter-success">Thank you for subscribing!</span>}
        </div>
      </div>

      {/* Column 2: AI Screening & Diagnostics */}
      <div className="footer-column">
        <h4>AI Diagnostics</h4>
        <nav className="footer-nav-col" aria-label="AI Diagnostics links">
          <button type="button" onClick={() => showPage('ckd-prediction')}>
            <Activity size={14} /> CKD Risk Predictor
          </button>
          <button type="button" onClick={() => showPage('ultrasound')}>
            <Activity size={14} /> Ultrasound AI Analyzer
          </button>
          <button type="button" onClick={() => showPage('lab-report')}>
            <Activity size={14} /> Lab Report Reader
          </button>
          <button type="button" onClick={() => showPage('wearable')}>
            <Activity size={14} /> Wearable Digital Twin
          </button>
          <button type="button" onClick={() => showPage('voice-assist')}>
            <Activity size={14} /> Voice Assist Intake
          </button>
        </nav>
      </div>

      {/* Column 3: Care & Nutrition */}
      <div className="footer-column">
        <h4>Care & Nutrition</h4>
        <nav className="footer-nav-col" aria-label="Care & Nutrition links">
          <button type="button" onClick={() => showPage('food-tools')}>
            <Heart size={14} /> Food safety scanner
          </button>
          <button type="button" onClick={() => showPage('food-tools')}>
            <Heart size={14} /> Diet recommendations
          </button>
          <button type="button" onClick={() => showPage('food-tools')}>
            <Heart size={14} /> Meal planner
          </button>
          <button type="button" onClick={() => showPage('dashboard')}>
            <Heart size={14} /> Monitoring Dashboard
          </button>
          <button type="button" onClick={() => showPage('alerts')}>
            <Heart size={14} /> Care Alerts & reminders
          </button>
          <button type="button" onClick={() => showPage('chatbot')}>
            <Heart size={14} /> AI Assistant Chatbot
          </button>
        </nav>
      </div>

      {/* Column 4: Learning & Support */}
      <div className="footer-column">
        <h4>Trust & Learning</h4>
        <nav className="footer-nav-col" aria-label="Trust & Learning links">
          <button type="button" onClick={() => scrollTo('about')}>
            <BookOpen size={14} /> About CKD Stages
          </button>
          <button type="button" onClick={() => scrollTo('resources')}>
            <BookOpen size={14} /> Kidney Learning Videos
          </button>
          <button type="button" onClick={() => showPage('doctor-summary')}>
            <FileText size={14} /> Doctor Summary Report
          </button>
          <button type="button" onClick={() => showPage('settings')}>
            <FileText size={14} /> Account Settings
          </button>
          <a href="mailto:support@nephrocare.org" className="footer-email-link">
            <Phone size={14} /> Support & Contact
          </a>
        </nav>
      </div>
    </div>

    <div className="footer-social-bar">
      <hr className="footer-divider" />
      <div className="footer-socials">
        <a href="https://github.com/Shrutika009/nephrocare" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
        </a>
        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>
        </a>
        <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17z" /><polygon points="10 15 15 12 10 9" /></svg>
        </a>
        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg>
        </a>
      </div>
    </div>
    </div>

  </footer>
}
