import { useState, useEffect, useRef } from 'react'
import { features, API_BASE_URL } from '../constants'
import type { Page } from '../types'
import { Icon } from './Icon'
import { Globe, ChevronDown } from 'lucide-react'

// short labels for the language switcher dropdown - keys must match the googtrans/i18n codes used elsewhere
const LANGUAGES: Record<string, string> = {
  'en': 'EN',
  'hi': 'हिन्दी',
  'ta': 'தமிழ்',
  'te': 'తెలుగు',
  'kn': 'ಕನ್ನಡ',
  'ml': 'മലയാളം',
  'mr': 'मराठी',
  'gu': 'ગુજરાતી',
  'bn': 'বাংলা',
  'pa': 'ਪੰਜਾਬੀ',
  'ur': 'اردو',
};

type HeaderProps = {
  mobileOpen: boolean
  featuresOpen: boolean
  setMobileOpen: (open: boolean) => void
  setFeaturesOpen: (open: boolean) => void
  showPage: (page: Page) => void
  scrollTo: (id: string) => void
  closeMenus: () => void
  user: { name: string; email: string } | null
  onLogout: () => void
}

// top nav bar: brand, desktop nav links, features mega-menu, user/lang dropdowns, and the
// mobile hamburger panel. mobileOpen/featuresOpen are lifted up to App.tsx so other UI (like
// clicking a page link) can close them too
export function Header({ mobileOpen, featuresOpen, setMobileOpen, setFeaturesOpen, showPage, scrollTo, closeMenus, user, onLogout }: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [language, setLanguage] = useState(() => localStorage.getItem('nephrocare_language') || 'en')
  // refs used purely to detect "click outside" for each dropdown, see the effect below
  const dropdownRef = useRef<HTMLDivElement>(null)
  const langDropdownRef = useRef<HTMLDivElement>(null)
  const mobileDropdownRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  const handleLanguageChange = async (newLang: string) => {
    setLanguage(newLang)
    localStorage.setItem('nephrocare_language', newLang)

    // Google Translate widget reads its target language from this cookie, and it
    // only re-translates the page on a fresh load, hence the reload below
    const target = `/en/${newLang}`;
    const match = document.cookie.match(/googtrans=([^;]+)/);
    const current = match ? match[1] : '';

    let needsReload = false;
    if (newLang === 'en' && current && current !== '/en/en') {
      // clear both cookie variants (no domain, and with domain) since we're not sure which one stuck
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=" + window.location.hostname + "; path=/;";
      needsReload = true;
    } else if (newLang !== 'en' && current !== target) {
      document.cookie = `googtrans=${target}; path=/`;
      document.cookie = `googtrans=${target}; domain=${window.location.hostname}; path=/`;
      needsReload = true;
    }

    if (user && needsReload) {
      // persist the choice server-side too, read-modify-write since profile has other preference fields
      try {
        const token = localStorage.getItem('auth_token')
        if (token) {
          const res = await fetch(`${API_BASE_URL}/api/patient/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
          const profile = await res.json()
          await fetch(`${API_BASE_URL}/api/patient/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ ...profile, preferences: { ...(profile.preferences || {}), language: newLang } })
          })
        }
      } catch (err) { console.error(err) }
    }

    if (needsReload) window.location.reload()
  }

  // closes whichever dropdown/menu is open when the user clicks anywhere outside it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(event.target as Node)) {
          setUserMenuOpen(false)
        }
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false)
      }
      // Close features mega-menu when clicking outside the entire header
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setFeaturesOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return <header className="header" ref={headerRef}>
    <a className="brand" href="#top" aria-label="NephroCare home" onClick={event => { event.preventDefault(); showPage('home') }}>
      <img className="brand-photo-logo" src="/logo.png" alt="" />
      <span className="brand-text">NephroCare<small>CKD PREDICTION SYSTEM</small></span>
    </a>
    <nav className="desktop-nav" aria-label="Main navigation">
      <button className="nav-link feature-trigger" onClick={() => setFeaturesOpen(!featuresOpen)} aria-expanded={featuresOpen}>Features <span className={featuresOpen ? 'chevron up' : 'chevron'}>⌄</span></button>
      <button className="nav-link" onClick={() => scrollTo('about')}>About</button>
      <button className="nav-link" onClick={() => scrollTo('resources')}>Resources</button>
    </nav>
    <div className="header-right-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div className="header-actions">
        <button className="signup-button dashboard-tab" onClick={() => showPage('chatbot')} style={{marginRight: '12px', background: '#236d9f', borderColor: '#236d9f'}}>AI Assistant</button>
        {user ? (
          <div className="user-profile-container" ref={dropdownRef} style={{ position: 'relative' }}>
            <div className="user-profile" onClick={() => setUserMenuOpen(!userMenuOpen)} style={{ cursor: 'pointer', userSelect: 'none' }}>
              {/* initials avatar: first letter of each word in the name, capped to 2 chars */}
              <div className="user-avatar" title={user.email}>
                {user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <span className="user-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {user.name}
                <span className="profile-chevron" style={{ fontSize: '10px', opacity: 0.6, transition: 'transform 0.2s', display: 'inline-block', transform: userMenuOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
              </span>
            </div>
            {userMenuOpen && (
              <div className="user-dropdown">
                <button 
                  type="button" 
                  className="dropdown-logout-btn"
                  style={{ color: '#236d9f', borderBottom: '1px solid #F1F5F9', marginBottom: '4px' }}
                  onClick={() => {
                    showPage('settings');
                    setUserMenuOpen(false);
                  }}
                >
                  <Icon name="settings" size={16} /> Settings
                </button>
                <button 
                  type="button" 
                  className="dropdown-logout-btn" 
                  onClick={() => {
                    onLogout();
                    setUserMenuOpen(false);
                  }}
                >
                  <Icon name="log-out" size={16} /> Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button type="button" className="signup-button" onClick={() => showPage('login')}>Login / Sign up</button>
          </>
        )}
      </div>

      <div className="lang-dropdown-container" ref={langDropdownRef} style={{ position: 'relative' }}>
        <button 
          onClick={() => setLangMenuOpen(!langMenuOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '6px 10px',
            borderRadius: '20px',
            border: '1px solid #E2E8F0',
            background: '#F8FAFC',
            fontSize: '12px',
            fontWeight: 600,
            color: '#334155',
            cursor: 'pointer',
          }}
        >
          <Globe size={14} />
          {LANGUAGES[language] ? LANGUAGES[language].substring(0,2).toUpperCase() : 'EN'}
          <ChevronDown size={12} style={{ opacity: 0.7, transform: langMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        
        {langMenuOpen && (
          <div className="lang-dropdown-menu" style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0,
            background: 'white', borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #E2E8F0',
            minWidth: '110px', padding: '6px', zIndex: 100,
            display: 'flex', flexDirection: 'column', gap: '2px',
            maxHeight: '300px', overflowY: 'auto'
          }}>
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <button
                key={code}
                onClick={() => {
                  setLangMenuOpen(false);
                  if (code !== language) handleLanguageChange(code);
                }}
                style={{
                  textAlign: 'left', padding: '8px 12px',
                  background: code === language ? '#F1F5F9' : 'transparent',
                  border: 'none', borderRadius: '6px',
                  fontSize: '13px', color: '#334155',
                  cursor: 'pointer',
                  fontWeight: code === language ? 600 : 400,
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => {
                  if (code !== language) e.currentTarget.style.background = '#F8FAFC'
                }}
                onMouseOut={(e) => {
                  if (code !== language) e.currentTarget.style.background = 'transparent'
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {!user && (
        <button 
          className="mobile-login-btn" 
          onClick={() => { showPage('login'); setMobileOpen(false); }}
        >
          Login/Signup
        </button>
      )}
      {user && (
        <div className="mobile-user-profile-container" ref={mobileDropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button 
            className="mobile-login-btn mobile-user-btn" 
            onClick={() => { setUserMenuOpen(!userMenuOpen); }}
          >
            {user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
          </button>
          
          {userMenuOpen && (
            <div className="user-dropdown" style={{ right: 0, top: 'calc(100% + 8px)' }}>
              <button 
                type="button" 
                className="dropdown-logout-btn"
                style={{ color: '#236d9f', borderBottom: '1px solid #F1F5F9', marginBottom: '4px' }}
                onClick={() => {
                  showPage('settings');
                  setUserMenuOpen(false);
                }}
              >
                <Icon name="settings" size={16} /> Settings
              </button>
              <button 
                type="button" 
                className="dropdown-logout-btn" 
                onClick={() => {
                  onLogout();
                  setUserMenuOpen(false);
                }}
              >
                <Icon name="log-out" size={16} /> Log out
              </button>
            </div>
          )}
        </div>
      )}
      <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu"><Icon name={mobileOpen ? 'x' : 'menu'} /></button>
    </div>

    {/* features mega-menu - routes by matching each feature's title string, so a title edit
        in constants.ts without a matching update here will silently fall through to closeMenus() */}
    {featuresOpen && <div className="mega-menu">
      <div className="mega-links">
        {features.map(feature => (
          <button
            type="button"
            key={feature.title}
            onClick={() => {
              if (feature.title === 'CKD Risk Prediction') {
                showPage('ckd-prediction');
              } else if (feature.title === 'Lab Report Analysis') {
                showPage('lab-report');
              } else if (feature.title === 'Nutrition & Intake Care' || feature.title === 'Food') {
                showPage('food-tools');
              } else if (feature.title === 'Ultrasound Analysis') {
                showPage('ultrasound');
              } else if (feature.title === 'Smart Alerts') {
                showPage('alerts');
              } else if (
                feature.title === 'Monitoring Dashboard' || 
                feature.title === 'Early Warning Alerts' || 
                feature.title === 'Doctor Summary Report' || 
                feature.title === 'WhatsApp Assistant'
              ) {
                showPage('dashboard');
              } else if (feature.title === 'Voice Prescription Assist') {
                showPage('voice-assist');
              } else {
                closeMenus();
              }
            }}
          >
            <span><Icon name={feature.icon} size={18} /></span>
            {feature.title}
          </button>
        ))}
      </div>
    </div>}

    {mobileOpen && <div className="mobile-panel">
      <button type="button" onClick={() => showPage('ckd-prediction')}>Risk Calculator</button>
      <button type="button" onClick={() => showPage('food-tools')}>Food Tools</button>
      <button type="button" onClick={() => showPage('ultrasound')}>Ultrasound Scan</button>
      <button type="button" onClick={() => showPage('dashboard')}>Dashboard</button>
      <button type="button" onClick={() => showPage('voice-assist')}>Voice Assist</button>
      <button type="button" onClick={() => scrollTo('about')}>About</button>
      <button type="button" onClick={() => scrollTo('resources')}>Resources</button>
    </div>}
  </header>
}
