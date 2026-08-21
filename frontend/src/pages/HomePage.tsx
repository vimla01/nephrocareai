import { Icon } from '../components/Icon'
import type { Page } from '../types'

type HomePageProps = {
  showPage: (page: Page) => void
}

export function HomePage({ showPage }: HomePageProps) {
  return <main id="top">
    <section className="hero hero-openmrs">
      <span className="hero-shape hero-shape-left" aria-hidden="true" />
      <span className="hero-shape hero-shape-right" aria-hidden="true" />
      <div className="hero-copy">
        <h1>NephroCare<br />for <strong>CKD</strong><br />prediction and <em>everyday care</em></h1>
        <p className="hero-text">An AI-powered CKD care companion for early detection, stage screening, lab report support, kidney-friendly nutrition, meal planning, reminders, symptom tracking, monitoring alerts, and doctor-ready summaries.</p>
        <div className="hero-actions"><button className="primary-button" onClick={() => showPage('ckd-prediction')}>Check CKD risk <Icon name="arrow" size={18} /></button></div>
      </div>
      <div className="hero-media" aria-hidden="true">
        <div className="hero-image-card">
          <video src="/vid.mp4" autoPlay muted loop playsInline />
        </div>
      </div>
    </section>

    <section className="ckd-about-section" id="about">
      <div className="ckd-about-image" aria-hidden="true">
        <img src="/image1.jpg" alt="" />
      </div>
      <div className="ckd-about-heading">
        <span className="eyebrow">Kidney health basics</span>
        <h2>About chronic kidney disease (CKD)</h2>
        <p>Your kidneys perform many important functions that help keep your body balanced and healthy. They help with:</p>
        <ul>
          <li>Removing waste products and extra water from your body</li>
          <li>Supporting the production of red blood cells</li>
          <li>Balancing important minerals in your blood</li>
          <li>Helping control your blood pressure</li>
          <li>Keeping your bones healthy</li>
        </ul>
        <p>Chronic kidney disease (CKD) happens when the kidneys have been damaged for at least 3 months and can no longer do their jobs as well as they should.</p>
        <p>CKD can also increase the risk of other health problems, including heart disease and stroke. It usually develops slowly and may cause very few symptoms in the early stages. CKD is divided into 5 stages to help guide care and treatment decisions.</p>
      </div>
    </section>

    <section className="about-section causes-section">
      <div className="causes-heading">
        <span className="eyebrow">Kidney info</span>
        <h2>Common causes of CKD</h2>
      </div>
      <div className="causes-copy">
        <p>The two leading causes of chronic kidney disease are diabetes and high blood pressure. CKD can also be connected to inherited conditions, immune disorders, kidney stones, infections, and other kidney or urinary tract problems.</p>
        <p>Early screening helps because CKD often develops slowly and may have few symptoms at first.</p>
      </div>
      <div className="causes-chart" aria-label="CKD cause percentages">
        <div className="ckd-ring"><span><b>CKD</b></span></div>
      </div>
      <div className="cause-list">
        <div><span className="cause-dot diabetes" /><strong>Diabetes</strong><b>45%</b></div>
        <div><span className="cause-dot pressure" /><strong>Hypertension</strong><b>25%</b></div>
        <div><span className="cause-dot immune" /><strong>Immune / inherited</strong><b>15%</b></div>
        <div><span className="cause-dot other" /><strong>Other causes</strong><b>15%</b></div>
      </div>
    </section>

    <section className="video-section" aria-label="Kidney education videos">
      <span className="eyebrow">Video gallery</span>
      <h2>Learn kidney basics visually.</h2>
      <div className="video-grid">
        <article>
          <iframe title="Chronic kidney disease overview video" src="https://www.youtube.com/embed/FN3MFhYPWWo" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          <h3>CKD overview</h3>
          <p>Understand what CKD means and why early screening matters.</p>
        </article>
        <article>
          <iframe title="eGFR and uACR kidney number video" src="https://www.youtube.com/embed/OSNXwuvP910" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          <h3>Kidney numbers</h3>
          <p>Learn how eGFR and urine albumin help describe kidney health.</p>
        </article>
        <article>
          <iframe title="CKD nutrition and kidney diet video" src="https://www.youtube.com/embed/ZC3FMcNLtqg" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          <h3>Food and daily care</h3>
          <p>Explore kidney-friendly nutrition and everyday support habits.</p>
        </article>
      </div>
    </section>
  </main>
}
