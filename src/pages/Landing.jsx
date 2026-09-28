import useI18nStore from '../store/i18nStore';
import { LanguageSwitcher } from '../components/layout/Layout';
import '../styles/Landing.css';

export default function Landing({ onLogin }) {
  const { t } = useI18nStore();

  const protocolMetrics = [
    { label: t('landing.metricNonCustodial'), value: '100%', sub: t('landing.metricNonCustodialSub') },
    { label: t('landing.metricPrivacy'), value: 'E2E', sub: t('landing.metricPrivacySub') },
    { label: t('landing.metricSpeed'), value: '<1s', sub: t('landing.metricSpeedSub') },
    { label: t('landing.metricAutomation'), value: 'AI/Rules', sub: t('landing.metricAutomationSub') },
  ];

  const features = [
    {
      badge: t('landing.feat1Badge'),
      title: t('landing.feat1Title'),
      desc: t('landing.feat1Desc'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      tag: t('landing.feat1Tag'),
    },
    {
      badge: t('landing.feat2Badge'),
      title: t('landing.feat2Title'),
      desc: t('landing.feat2Desc'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      tag: t('landing.feat2Tag'),
    },
    {
      badge: t('landing.feat3Badge'),
      title: t('landing.feat3Title'),
      desc: t('landing.feat3Desc'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      tag: t('landing.feat3Tag'),
    },
    {
      badge: t('landing.feat4Badge'),
      title: t('landing.feat4Title'),
      desc: t('landing.feat4Desc'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      tag: t('landing.feat4Tag'),
    },
    {
      badge: t('landing.feat5Badge'),
      title: t('landing.feat5Title'),
      desc: t('landing.feat5Desc'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      tag: t('landing.feat5Tag'),
    },
    {
      badge: t('landing.feat6Badge'),
      title: t('landing.feat6Title'),
      desc: t('landing.feat6Desc'),
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      tag: t('landing.feat6Tag'),
    },
  ];

  const workflowSteps = [
    {
      step: '01',
      title: t('landing.wf1Title'),
      desc: t('landing.wf1Desc'),
    },
    {
      step: '02',
      title: t('landing.wf2Title'),
      desc: t('landing.wf2Desc'),
    },
    {
      step: '03',
      title: t('landing.wf3Title'),
      desc: t('landing.wf3Desc'),
    },
  ];

  return (
    <div className="landing">
      {/* Top Header */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-logo-group">
            <img src="/obscural.svg" alt="Obscural" className="landing-logo-img" />
            <span className="landing-logo-name">Obscural</span>
          </div>
          <div className="landing-header-actions">
            <LanguageSwitcher />
            <button className="landing-header-btn" onClick={onLogin}>
              {t('landing.launch')}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="landing-content">
        {/* 1. Hero Section */}
        <section className="landing-hero-section">
          <div className="landing-hero-badge">
            <span className="landing-badge-dot" />
            {t('landing.tagline')}
          </div>

          <h1 className="landing-title">
            Obscural
          </h1>

          <div className="landing-desc-group">
            <p className="landing-desc">
              {t('landing.heroDesc1')}
            </p>
            <p className="landing-desc">
              {t('landing.heroDesc2')}
            </p>
          </div>

          <div className="landing-cta-card">
            <p className="landing-cta-text">{t('landing.ready')}</p>
            <p className="landing-cta-sub">{t('landing.readySub')}</p>
            <button className="landing-launch-btn" onClick={onLogin}>
              {t('landing.signIn')}
            </button>
          </div>
        </section>

        {/* 2. Protocol Telemetry Metrics */}
        <section className="landing-metrics-section">
          <div className="landing-metrics-grid">
            {protocolMetrics.map((m, idx) => (
              <div key={idx} className="landing-metric-card">
                <span className="landing-metric-label">{m.label}</span>
                <span className="landing-metric-value">{m.value}</span>
                <span className="landing-metric-sub">{m.sub}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Key Capabilities Bento Grid */}
        <section className="landing-features-section">
          <div className="landing-section-header">
            <span className="landing-section-eyebrow">{t('landing.featuresEyebrow')}</span>
            <h2 className="landing-section-title">{t('landing.featuresTitle')}</h2>
            <p className="landing-section-subtitle">
              {t('landing.featuresSubtitle')}
            </p>
          </div>

          <div className="landing-features-grid">
            {features.map((f, idx) => (
              <div key={idx} className="landing-feature-card">
                <div className="landing-feature-header">
                  <div className="landing-feature-icon-box">
                    {f.icon}
                  </div>
                  <span className="landing-feature-tag">{f.tag}</span>
                </div>
                <span className="landing-feature-badge">{f.badge}</span>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Workflow Section */}
        <section className="landing-workflow-section">
          <div className="landing-section-header">
            <span className="landing-section-eyebrow">{t('landing.workflowEyebrow')}</span>
            <h2 className="landing-section-title">{t('landing.workflowTitle')}</h2>
            <p className="landing-section-subtitle">
              {t('landing.workflowSubtitle')}
            </p>
          </div>

          <div className="landing-workflow-grid">
            {workflowSteps.map((step, idx) => (
              <div key={idx} className="landing-workflow-card">
                <div className="landing-workflow-num">{step.step}</div>
                <h3 className="landing-workflow-title">{step.title}</h3>
                <p className="landing-workflow-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Bottom Action Cockpit */}
        <section className="landing-bottom-cockpit">
          <div className="landing-cockpit-card">
            <div className="landing-cockpit-content">
              <span className="landing-cockpit-eyebrow">{t('landing.cockpitEyebrow')}</span>
              <h2 className="landing-cockpit-title">{t('landing.cockpitTitle')}</h2>
              <p className="landing-cockpit-desc">
                {t('landing.cockpitDesc')}
              </p>
            </div>
            <button className="landing-launch-btn" onClick={onLogin}>
              {t('landing.launch')}
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-line" />
        <p className="landing-footer-text">
          {t('landing.footer')}
        </p>
      </footer>
    </div>
  );
}
