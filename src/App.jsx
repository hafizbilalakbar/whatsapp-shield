import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { ScrollToTop } from './components/ui/ScrollToTop';
import { NavigationProgress } from './components/ui/NavigationProgress';
import { AppLoader } from './components/ui/AppLoader';

import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import CampaignHistoryPage from './pages/CampaignHistoryPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
import DataProcessingPage from './pages/DataProcessingPage';
import NumberFormatsPage from './pages/NumberFormatsPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import UserGuidePage from './pages/UserGuidePage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import ChangelogPage from './pages/ChangelogPage';
import FAQPage from './pages/FAQPage';
import MessageAgentPage from './pages/MessageAgentPage';
import ErrorBoundary from './components/ErrorBoundary';

const PAGE_TITLES = {
  '/': { title: 'WhatsApp Shield — Bulk WhatsApp Number Validation', desc: 'Enterprise-grade platform for validating phone numbers against WhatsApp network with anti-ban shield mode.' },
  '/shield': { title: 'Shield — WhatsApp Shield', desc: 'Validate WhatsApp numbers in bulk with real-time progress and safety features.' },
  '/dashboard': { title: 'Dashboard — WhatsApp Shield', desc: 'Validate WhatsApp numbers in bulk with real-time progress and safety features.' },
  '/history': { title: 'History — WhatsApp Shield', desc: 'View and manage your past WhatsApp number validation history.' },
  '/privacy-policy': { title: 'Privacy Policy — WhatsApp Shield', desc: 'Privacy policy for WhatsApp Shield — your data stays local.' },
  '/terms': { title: 'Terms of Service — WhatsApp Shield', desc: 'Terms of service for using WhatsApp Shield.' },
  '/data-processing': { title: 'Data Processing — WhatsApp Shield', desc: 'Data processing information for WhatsApp Shield.' },
  '/number-formats': { title: 'Number Format Guide — WhatsApp Shield', desc: 'Supported phone number formats for WhatsApp Shield validation.' },
  '/profile': { title: 'Profile — WhatsApp Shield', desc: 'Your WhatsApp Shield profile, session history, and validation stats.' },
  '/settings': { title: 'Settings — WhatsApp Shield', desc: 'Centralized settings for WhatsApp Shield and WhatsApp Message Agent.' },
  '/user-guide': { title: 'User Guide — WhatsApp Shield', desc: 'Step-by-step guide to using WhatsApp Shield for number validation.' },
  '/about': { title: 'About — WhatsApp Shield', desc: 'About WhatsApp Shield — a privacy-first bulk number validation tool.' },
  '/contact': { title: 'Contact — WhatsApp Shield', desc: 'Get in touch with the WhatsApp Shield team.' },
  '/changelog': { title: 'Changelog — WhatsApp Shield', desc: 'Release notes and update history for WhatsApp Shield.' },
  '/faq': { title: 'FAQ — WhatsApp Shield', desc: 'Frequently asked questions about WhatsApp Shield.' },
  '/message-agent': { title: 'WhatsApp Message Agent — Communication & CRM', desc: 'Professional WhatsApp communication platform with AI-powered customer interaction and CRM management.' },
};

function App() {
  const location = useLocation();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const meta = PAGE_TITLES[location.pathname] || PAGE_TITLES['/'];
    document.title = meta.title;
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute('content', meta.desc);
  }, [location.pathname]);

  return (
    <>
      {!appReady ? (
        <AppLoader onFinish={() => setAppReady(true)} />
      ) : (
        <>
          <ScrollToTop />
          <NavigationProgress />
          <Layout>
            <div key={location.pathname} className="animate-page-enter flex flex-col flex-1">
              <Routes location={location}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/shield" element={<DashboardPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/history" element={<CampaignHistoryPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/data-processing" element={<DataProcessingPage />} />
                <Route path="/number-formats" element={<NumberFormatsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/user-guide" element={<UserGuidePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/changelog" element={<ChangelogPage />} />
                <Route path="/faq" element={<FAQPage />} />
                <Route path="/message-agent" element={<ErrorBoundary><MessageAgentPage /></ErrorBoundary>} />
              </Routes>
            </div>
          </Layout>
        </>
      )}
    </>
  );
}

export default App;
