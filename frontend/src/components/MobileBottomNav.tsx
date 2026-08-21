import { Icon } from './Icon'
import type { Page } from '../types'

type MobileBottomNavProps = {
  showPage: (page: Page) => void;
  currentPage: Page;
}

export function MobileBottomNav({ showPage, currentPage }: MobileBottomNavProps) {
  return (
    <>
    <nav className="mobile-bottom-nav">
      <button 
        className={`mobile-nav-btn home-btn ${currentPage === 'home' ? 'active' : ''}`}
        onClick={() => showPage('home')}
      >
        <Icon name="home" size={20} />
        <span>Home</span>
      </button>
      
      <button 
        className={`mobile-nav-btn risk-btn ${currentPage === 'ckd-prediction' ? 'active' : ''}`}
        onClick={() => showPage('ckd-prediction')}
      >
        <Icon name="activity" size={20} />
        <span>Risk</span>
      </button>

      <button 
        className={`mobile-nav-btn diet-btn ${currentPage === 'food-tools' ? 'active' : ''}`}
        onClick={() => showPage('food-tools')}
      >
        <Icon name="apple" size={20} />
        <span>Diet</span>
      </button>

      <button 
        className={`mobile-nav-btn twin-btn ${currentPage === 'wearable' ? 'active' : ''}`}
        onClick={() => showPage('wearable')}
      >
        <Icon name="clock" size={20} />
        <span>Twin</span>
      </button>

      <button 
        className={`mobile-nav-btn dash-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
        onClick={() => showPage('dashboard')}
      >
        <Icon name="layout-dashboard" size={20} />
        <span>Dash</span>
      </button>
    </nav>
    
    {/* Floating AI Assist Button — hidden on chatbot page */}
    {currentPage !== 'chatbot' && (
      <button 
        className="mobile-fab-ai"
        onClick={() => showPage('chatbot')}
        title="AI Assistant"
      >
        <Icon name="message-circle" size={24} />
      </button>
    )}
    </>
  )
}
