import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Smartphone, ClipboardList, Shield, Activity, FileText, Globe, Check, ArrowRight, Users, Search, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { SHIELD_HOME } from '../utils/paths';

const STEPS = [
  {
    num: 1,
    icon: Smartphone,
    title: 'Connect Your WhatsApp',
    desc: 'Open WhatsApp on your phone, go to Linked Devices, and scan the QR code shown on the Dashboard. Each connection is initiated manually by you — a fresh QR code is generated every time you connect.',
    ctas: [{ text: 'Scan QR Code', to: SHIELD_HOME, icon: Smartphone }],
    wireframe: ({ theme }) => (
      <svg viewBox="0 0 320 140" className="w-full max-w-md" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="319" height="139" rx="11.5" stroke={theme === 'dark' ? '#1F2937' : '#E2E8F0'} fill={theme === 'dark' ? '#111827' : '#FFFFFF'} />
        <rect x="16" y="16" width="140" height="108" rx="8" stroke={theme === 'dark' ? '#374151' : '#CBD5E1'} fill={theme === 'dark' ? '#0A0F1C' : '#F8FAFC'} strokeDasharray="3 3" />
        <rect x="42" y="42" width="88" height="56" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <rect x="50" y="74" width="72" height="4" rx="2" fill={theme === 'dark' ? '#374151' : '#CBD5E1'} />
        <rect x="60" y="40" width="52" height="4" rx="2" fill={theme === 'dark' ? '#6B7280' : '#94A3B8'} />
        <rect x="50" y="46" width="72" height="24" rx="2" fill={theme === 'dark' ? '#4ADE80' : '#10B981'} opacity="0.3" />
        <circle cx="94" cy="58" r="8" fill={theme === 'dark' ? '#4ADE80' : '#10B981'} opacity="0.6" />
        <rect x="45" y="34" width="6" height="6" rx="1" fill={theme === 'dark' ? '#4ADE80' : '#10B981'} />
        <rect x="42" y="95" width="88" height="4" rx="2" fill={theme === 'dark' ? '#4ADE80' : '#10B981'} />
        <text x="156" y="36" fontSize="10" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Scanning QR from phone...</text>
        <text x="156" y="54" fontSize="10" fill={theme === 'dark' ? '#6B7280' : '#94A3B8'} fontFamily="monospace">Phone: Samsung Galaxy</text>
        <text x="156" y="104" fontSize="10" fill={theme === 'dark' ? '#4ADE80' : '#10B981'} fontFamily="monospace">Scan complete! Connected.</text>
        <rect x="176" y="20" width="120" height="24" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <rect x="184" y="26" width="32" height="12" rx="2" fill={theme === 'dark' ? '#374151' : '#CBD5E1'} />
        <rect x="224" y="26" width="60" height="12" rx="2" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} />
        <rect x="176" y="50" width="120" height="24" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <rect x="184" y="56" width="72" height="12" rx="2" fill={theme === 'dark' ? '#374151' : '#CBD5E1'} />
        <rect x="264" y="56" width="24" height="12" rx="2" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
      </svg>
    )
  },
  {
    num: 2,
    icon: ClipboardList,
    title: 'Add Your Numbers',
    desc: 'Paste phone numbers directly into the input area, upload a CSV or TXT file, or use the Range Generator for sequential numbers. The tool automatically detects and normalizes every format.',
    wireframe: ({ theme }) => (
      <svg viewBox="0 0 320 140" className="w-full max-w-md" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="319" height="139" rx="11.5" stroke={theme === 'dark' ? '#1F2937' : '#E2E8F0'} fill={theme === 'dark' ? '#111827' : '#FFFFFF'} />
        <rect x="16" y="96" width="288" height="28" rx="6" fill={theme === 'dark' ? '#0A0F1C' : '#F8FAFC'} stroke={theme === 'dark' ? '#374151' : '#CBD5E1'} strokeDasharray="2 2" />
        <text x="28" y="114" fontSize="10" fill={theme === 'dark' ? '#6B7280' : '#94A3B8'} fontFamily="monospace">+92 300 1234567, (555) 123-4567, 0092...</text>
        <rect x="16" y="16" width="72" height="24" rx="6" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} opacity="0.15" stroke={theme === 'dark' ? '#00D97E' : '#00B86E'} strokeWidth="0.5" />
        <text x="24" y="32" fontSize="10" fill={theme === 'dark' ? '#4ADE80' : '#059669'} fontFamily="monospace" fontWeight="600">Paste</text>
        <rect x="96" y="16" width="72" height="24" rx="6" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="104" y="32" fontSize="10" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Upload File</text>
        <rect x="176" y="16" width="72" height="24" rx="6" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="184" y="32" fontSize="10" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Range Gen</text>
        <rect x="16" y="56" width="40" height="16" rx="4" fill={theme === 'dark' ? '#374151' : '#E2E8F0'} />
        <text x="20" y="68" fontSize="8" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">PK</text>
        <rect x="60" y="56" width="40" height="16" rx="4" fill={theme === 'dark' ? '#374151' : '#E2E8F0'} />
        <text x="64" y="68" fontSize="8" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">US</text>
        <rect x="104" y="56" width="40" height="16" rx="4" fill={theme === 'dark' ? '#374151' : '#E2E8F0'} />
        <text x="108" y="68" fontSize="8" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">GB</text>
        <rect x="148" y="56" width="40" height="16" rx="4" fill={theme === 'dark' ? '#374151' : '#E2E8F0'} />
        <text x="152" y="68" fontSize="8" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">DE</text>
        <text x="200" y="68" fontSize="10" fill={theme === 'dark' ? '#6B7280' : '#94A3B8'} fontFamily="monospace">+3 more detected</text>
        <text x="16" y="86" fontSize="9" fill={theme === 'dark' ? '#6B7280' : '#94A3B8'} fontFamily="monospace">3 countries detected, 32 numbers</text>
      </svg>
    )
  },
  {
    num: 3,
    icon: Shield,
    title: 'Configure Safety Settings',
    desc: 'Shield Mode adds randomized jitter delays and automatic cool-down breaks every 10 checks, protecting your account from anti-spam flags. Adjust delay timing between 0.5s and 10s.',
    wireframe: ({ theme }) => (
      <svg viewBox="0 0 320 140" className="w-full max-w-md" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="319" height="139" rx="11.5" stroke={theme === 'dark' ? '#1F2937' : '#E2E8F0'} fill={theme === 'dark' ? '#111827' : '#FFFFFF'} />
        <rect x="16" y="16" width="188" height="48" rx="8" stroke={theme === 'dark' ? '#00D97E' : '#00B86E'} strokeWidth="0.5" fill={theme === 'dark' ? '#111827' : '#FFFFFF'} opacity="0.8" />
        <rect x="24" y="24" width="28" height="28" rx="6" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} opacity="0.2" />
        <text x="30" y="42" fontSize="12" fill={theme === 'dark' ? '#4ADE80' : '#059669'} fontFamily="monospace">S</text>
        <text x="60" y="34" fontSize="10" fill={theme === 'dark' ? '#F9FAFB' : '#0F172A'} fontFamily="monospace" fontWeight="600">Shield Mode Protection</text>
        <rect x="60" y="42" width="64" height="16" rx="4" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} />
        <text x="64" y="54" fontSize="8" fill={theme === 'dark' ? '#0A0F1C' : '#FFFFFF'} fontFamily="monospace" fontWeight="600">Active</text>
        <rect x="210" y="16" width="36" height="20" rx="10" fill={theme === 'dark' ? '#4ADE80' : '#10B981'} />
        <circle cx="222" cy="26" r="7" fill={theme === 'dark' ? '#0A0F1C' : '#FFFFFF'} />
        <rect x="16" y="76" width="188" height="24" rx="6" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} opacity="0.6" />
        <rect x="24" y="84" width="60" height="8" rx="4" fill={theme === 'dark' ? '#374151' : '#CBD5E1'} />
        <rect x="24" y="84" width="36" height="8" rx="4" fill={theme === 'dark' ? '#4ADE80' : '#10B981'} />
        <text x="164" y="92" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">3.0s</text>
        <rect x="216" y="76" width="88" height="48" rx="8" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="224" y="94" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Estimated</text>
        <text x="224" y="108" fontSize="12" fill={theme === 'dark' ? '#F9FAFB' : '#0F172A'} fontFamily="monospace" fontWeight="bold">3m 15s</text>
        <text x="224" y="118" fontSize="8" fill={theme === 'dark' ? '#6B7280' : '#94A3B8'} fontFamily="monospace">for 65 numbers</text>
      </svg>
    )
  },
  {
    num: 4,
    icon: Activity,
    title: 'Start Scanning',
    desc: 'Watch the live terminal as each number is checked against WhatsApp registry. A progress bar tracks completion, and real-time stats cards show registered, unregistered, and invalid counts as they update.',
    wireframe: ({ theme }) => (
      <svg viewBox="0 0 320 140" className="w-full max-w-md" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="319" height="139" rx="11.5" stroke={theme === 'dark' ? '#1F2937' : '#E2E8F0'} fill={theme === 'dark' ? '#111827' : '#FFFFFF'} />
        <rect x="16" y="16" width="288" height="18" rx="9" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <rect x="16" y="16" width="156" height="18" rx="9" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} />
        <text x="130" y="28" fontSize="8" fill={theme === 'dark' ? '#0A0F1C' : '#FFFFFF'} fontFamily="monospace" fontWeight="600">47 / 65 checked (72%)</text>
        <rect x="16" y="42" width="288" height="50" rx="6" fill={theme === 'dark' ? '#0A0F1C' : '#F8FAFC'} />
        <text x="24" y="58" fontSize="9" fill={theme === 'dark' ? '#4ADE80' : '#059669'} fontFamily="monospace">[+923001234567] Active WhatsApp account</text>
        <text x="24" y="72" fontSize="9" fill={theme === 'dark' ? '#F87171' : '#DC2626'} fontFamily="monospace">[+15551234567] Not registered</text>
        <text x="24" y="86" fontSize="9" fill={theme === 'dark' ? '#FBBF24' : '#D97706'} fontFamily="monospace">[+491701234567] Invalid format</text>
        <rect x="16" y="100" width="68" height="24" rx="6" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="22" y="116" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Registered: 32</text>
        <rect x="92" y="100" width="76" height="24" rx="6" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="98" y="116" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Unregistered: 10</text>
        <rect x="176" y="100" width="60" height="24" rx="6" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="182" y="116" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Invalid: 5</text>
      </svg>
    )
  },
  {
    num: 5,
    icon: FileText,
    title: 'View and Export Results',
    desc: 'Review a detailed validation breakdown with pie charts and per-number status. Export results to CSV, TXT, JSON, or PDF format with registered counts, unregistered numbers, and profile details included.',
    ctas: [{ text: 'Go to Shield', to: SHIELD_HOME, icon: Activity }],
    wireframe: ({ theme }) => (
      <svg viewBox="0 0 320 140" className="w-full max-w-md" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="319" height="139" rx="11.5" stroke={theme === 'dark' ? '#1F2937' : '#E2E8F0'} fill={theme === 'dark' ? '#111827' : '#FFFFFF'} />
        <circle cx="48" cy="48" r="24" fill={theme === 'dark' ? '#00D97E' : '#10B981'} opacity="0.15" />
        <circle cx="48" cy="48" r="18" fill={theme === 'dark' ? '#00D97E' : '#10B981'} opacity="0.3" />
        <circle cx="60" cy="42" r="10" fill={theme === 'dark' ? '#EF4444' : '#DC2626'} opacity="0.4" />
        <circle cx="38" cy="56" r="8" fill={theme === 'dark' ? '#F59E0B' : '#D97706'} opacity="0.4" />
        <rect x="88" y="24" width="60" height="16" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="94" y="36" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Registered: 32</text>
        <rect x="88" y="44" width="60" height="16" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="94" y="56" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Unregistered: 10</text>
        <rect x="88" y="64" width="60" height="16" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="94" y="76" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Invalid: 5</text>
        <rect x="16" y="96" width="62" height="28" rx="6" stroke={theme === 'dark' ? '#374151' : '#CBD5E1'} strokeWidth="0.5" fill={theme === 'dark' ? '#111827' : '#FFFFFF'} />
        <text x="24" y="114" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">CSV</text>
        <rect x="86" y="96" width="62" height="28" rx="6" stroke={theme === 'dark' ? '#374151' : '#CBD5E1'} strokeWidth="0.5" fill={theme === 'dark' ? '#111827' : '#FFFFFF'} />
        <text x="96" y="114" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">TXT</text>
        <rect x="156" y="96" width="62" height="28" rx="6" stroke={theme === 'dark' ? '#374151' : '#CBD5E1'} strokeWidth="0.5" fill={theme === 'dark' ? '#111827' : '#FFFFFF'} />
        <text x="166" y="114" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">JSON</text>
        <rect x="226" y="96" width="78" height="28" rx="6" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} />
        <text x="234" y="114" fontSize="9" fill={theme === 'dark' ? '#0A0F1C' : '#FFFFFF'} fontFamily="monospace" fontWeight="600">PDF Report</text>
      </svg>
    )
  },
  {
    num: 6,
    icon: Globe,
    title: 'Check Number Format Guide',
    desc: 'Visit the Number Format Guide to see all supported patterns from around the world. The guide includes a live demo converter, downloadable sample CSV files, and a visual range generator reference.',
    wireframe: ({ theme }) => (
      <svg viewBox="0 0 320 140" className="w-full max-w-md" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="319" height="139" rx="11.5" stroke={theme === 'dark' ? '#1F2937' : '#E2E8F0'} fill={theme === 'dark' ? '#111827' : '#FFFFFF'} />
        <rect x="16" y="16" width="288" height="36" rx="8" stroke={theme === 'dark' ? '#00D97E' : '#00B86E'} strokeWidth="0.5" fill={theme === 'dark' ? '#111827' : '#FFFFFF'} opacity="0.8" />
        <rect x="24" y="24" width="56" height="20" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="30" y="38" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Try it live</text>
        <text x="88" y="38" fontSize="9" fill={theme === 'dark' ? '#6B7280' : '#94A3B8'} fontFamily="monospace">Type any number...</text>
        <rect x="224" y="24" width="68" height="20" rx="4" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} />
        <text x="232" y="38" fontSize="9" fill={theme === 'dark' ? '#0A0F1C' : '#FFFFFF'} fontFamily="monospace" fontWeight="600">Normalize</text>
        <rect x="16" y="64" width="288" height="24" rx="6" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="24" y="80" fontSize="9" fill={theme === 'dark' ? '#6B7280' : '#94A3B8'} fontFamily="monospace">Search formats by country or pattern...</text>
        <rect x="16" y="96" width="55" height="28" rx="4" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} opacity="0.15" />
        <text x="20" y="114" fontSize="9" fill={theme === 'dark' ? '#4ADE80' : '#059669'} fontFamily="monospace" fontWeight="600">Formats</text>
        <rect x="79" y="96" width="55" height="28" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="84" y="114" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">CSV</text>
        <rect x="142" y="96" width="80" height="28" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="148" y="114" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Range Gen</text>
        <rect x="16" y="130" width="288" height="1" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} opacity="0.3" />
        <rect x="16" y="130" width="55" height="1" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} />
      </svg>
    ),
    ctas: [{ text: 'Open Number Format Guide', to: '/number-formats', icon: Globe }]
  },
  {
    num: 7,
    icon: Users,
    title: 'Generate Leads from Validated Numbers',
    desc: 'Convert validated WhatsApp numbers into structured leads with one click. Filter by registration status and country to build targeted lead lists. Each lead captures the WhatsApp profile, avatar, and status text for seamless CRM integration.',
    ctas: [{ text: 'Start Generating Leads', to: SHIELD_HOME, icon: ArrowRight, variant: 'default' }],
    wireframe: ({ theme }) => (
      <svg viewBox="0 0 320 140" className="w-full max-w-md" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="319" height="139" rx="11.5" stroke={theme === 'dark' ? '#1F2937' : '#E2E8F0'} fill={theme === 'dark' ? '#111827' : '#FFFFFF'} />
        <rect x="16" y="16" width="288" height="28" rx="6" fill={theme === 'dark' ? '#0A0F1C' : '#F8FAFC'} stroke={theme === 'dark' ? '#374151' : '#CBD5E1'} strokeDasharray="2 2" />
        <text x="24" y="34" fontSize="9" fill={theme === 'dark' ? '#6B7280' : '#94A3B8'} fontFamily="monospace">Leads generated: 24 from 32 registered numbers</text>
        <rect x="16" y="52" width="288" height="20" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="24" y="65" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">+92 300 1234567  |  Ahmed Khan  |  WhatsApp Active  |  Pakistan</text>
        <rect x="16" y="76" width="288" height="20" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="24" y="89" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">+1 555 987 6543  |  Sarah Chen  |  WhatsApp Active  |  USA</text>
        <rect x="16" y="100" width="288" height="20" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="24" y="113" fontSize="9" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">+44 20 7123 4567  |  James Okonkwo  |  WhatsApp Active  |  UK</text>
        <rect x="16" y="126" width="16" height="8" rx="2" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} />
        <text x="40" y="133" fontSize="7" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Showing 3 of 24 leads</text>
      </svg>
    )
  },
  {
    num: 8,
    icon: Search,
    title: 'Find Target Businesses by Region',
    desc: 'Use the country breakdown in your validation results to identify high-potential markets. Filter leads by country code and industry tag to segment audiences by region. Export targeted lists for region-specific outreach campaigns with wa.me links.',
    ctas: [{ text: 'Generate Leads', to: SHIELD_HOME, icon: ArrowRight }],
    wireframe: ({ theme }) => (
      <svg viewBox="0 0 320 140" className="w-full max-w-md" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="319" height="139" rx="11.5" stroke={theme === 'dark' ? '#1F2937' : '#E2E8F0'} fill={theme === 'dark' ? '#111827' : '#FFFFFF'} />
        <rect x="16" y="16" width="200" height="24" rx="6" fill={theme === 'dark' ? '#0A0F1C' : '#F8FAFC'} stroke={theme === 'dark' ? '#374151' : '#CBD5E1'} />
        <text x="24" y="31" fontSize="9" fill={theme === 'dark' ? '#6B7280' : '#94A3B8'} fontFamily="monospace">Search by country, industry, or tag...</text>
        <rect x="226" y="16" width="78" height="24" rx="6" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} />
        <text x="236" y="32" fontSize="9" fill={theme === 'dark' ? '#0A0F1C' : '#FFFFFF'} fontFamily="monospace" fontWeight="600">Filter</text>
        <rect x="16" y="48" width="80" height="20" rx="4" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} opacity="0.15" />
        <text x="22" y="62" fontSize="8" fill={theme === 'dark' ? '#4ADE80' : '#059669'} fontFamily="monospace">Pakistan</text>
        <rect x="104" y="48" width="80" height="20" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="110" y="62" fontSize="8" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">UAE</text>
        <rect x="192" y="48" width="80" height="20" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <text x="198" y="62" fontSize="8" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">United Kingdom</text>
        <rect x="16" y="80" width="288" height="44" rx="6" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <rect x="24" y="88" width="24" height="24" rx="4" fill={theme === 'dark' ? '#374151' : '#CBD5E1'} />
        <text x="56" y="98" fontSize="9" fill={theme === 'dark' ? '#F9FAFB' : '#0F172A'} fontFamily="monospace" fontWeight="600">Sparks Digital, PK</text>
        <text x="56" y="110" fontSize="8" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">Marketing Agency . 15 leads</text>
        <rect x="240" y="90" width="56" height="16" rx="4" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} opacity="0.2" />
        <text x="248" y="102" fontSize="8" fill={theme === 'dark' ? '#4ADE80' : '#059669'} fontFamily="monospace">wa.me Link</text>
      </svg>
    )
  },
  {
    num: 9,
    icon: MessageCircle,
    title: 'Start Outreach Campaigns & Track Deals',
    desc: 'Launch outreach campaigns using validated WhatsApp numbers with direct wa.me links. Track campaign status, monitor delivery rates, and manage follow-ups. Every campaign is saved locally in your history for review and conversion measurement.',
    ctas: [{ text: 'Go to Shield', to: SHIELD_HOME, icon: ArrowRight, variant: 'default' }],
    wireframe: ({ theme }) => (
      <svg viewBox="0 0 320 140" className="w-full max-w-md" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="319" height="139" rx="11.5" stroke={theme === 'dark' ? '#1F2937' : '#E2E8F0'} fill={theme === 'dark' ? '#111827' : '#FFFFFF'} />
        <rect x="16" y="16" width="160" height="24" rx="6" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} opacity="0.15" />
        <text x="22" y="32" fontSize="9" fill={theme === 'dark' ? '#4ADE80' : '#059669'} fontFamily="monospace" fontWeight="600">Active Campaigns (3)</text>
        <rect x="16" y="48" width="288" height="24" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <rect x="24" y="54" width="60" height="12" rx="3" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} />
        <text x="28" y="63" fontSize="7" fill={theme === 'dark' ? '#0A0F1C' : '#FFFFFF'} fontFamily="monospace" fontWeight="600">Active</text>
        <text x="96" y="63" fontSize="9" fill={theme === 'dark' ? '#F9FAFB' : '#0F172A'} fontFamily="monospace" fontWeight="600">PK Market Outreach</text>
        <text x="220" y="63" fontSize="8" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">12/15 sent</text>
        <rect x="16" y="76" width="288" height="24" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <rect x="24" y="82" width="50" height="12" rx="3" fill={theme === 'dark' ? '#FBBF24' : '#D97706'} />
        <text x="28" y="91" fontSize="7" fill={theme === 'dark' ? '#0A0F1C' : '#FFFFFF'} fontFamily="monospace" fontWeight="600">Draft</text>
        <text x="86" y="91" fontSize="9" fill={theme === 'dark' ? '#F9FAFB' : '#0F172A'} fontFamily="monospace" fontWeight="600">AE Real Estate Q2</text>
        <text x="220" y="91" fontSize="8" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">0/24 sent</text>
        <rect x="16" y="104" width="288" height="24" rx="4" fill={theme === 'dark' ? '#1F2937' : '#E2E8F0'} />
        <rect x="24" y="110" width="60" height="12" rx="3" fill={theme === 'dark' ? '#00D97E' : '#00B86E'} />
        <text x="28" y="119" fontSize="7" fill={theme === 'dark' ? '#0A0F1C' : '#FFFFFF'} fontFamily="monospace" fontWeight="600">Active</text>
        <text x="96" y="119" fontSize="9" fill={theme === 'dark' ? '#F9FAFB' : '#0F172A'} fontFamily="monospace" fontWeight="600">SG Tech Leads Follow-up</text>
        <text x="220" y="119" fontSize="8" fill={theme === 'dark' ? '#9CA3AF' : '#475569'} fontFamily="monospace">8/10 replied</text>
      </svg>
    )
  }
];

export default function UserGuidePage() {
  const [activeSection, setActiveSection] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [visibleSections, setVisibleSections] = useState(new Set());
  const sectionRefs = useRef([]);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const t = document.querySelector('[data-theme]')?.getAttribute('data-theme') || 'dark';
    setTheme(t);
    const observer = new MutationObserver(() => {
      const updated = document.querySelector('[data-theme]')?.getAttribute('data-theme') || 'dark';
      setTheme(updated);
    });
    const el = document.querySelector('[data-theme]');
    if (el) observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0);
      const sections = sectionRefs.current;
      let active = 0;
      sections.forEach((section, i) => {
        if (!section) return;
        const rect = section.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.4) {
          active = i;
        }
      });
      setActiveSection(active);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections(prev => new Set(prev).add(Number(entry.target.dataset.index)));
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (index) => {
    const el = sectionRefs.current[index];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getStepCircleState = (i) => {
    if (i < activeSection) return 'completed';
    if (i === activeSection) return 'active';
    return 'inactive';
  };

  const fillColor = theme === 'dark' ? '#00D97E' : '#00B86E';
  const dotGridColor = theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';

  return (
    <div className="relative min-h-screen">
      {/* Fixed scroll progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-border">
        <div
          className="h-full transition-all duration-150 ease-out"
          style={{ width: `${scrollProgress}%`, backgroundColor: fillColor }}
        />
      </div>

      {/* Dot grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, ${dotGridColor} 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
        <div className="flex gap-8 py-12">
          {/* Sticky sidebar desktop */}
          <nav className="hidden lg:flex flex-col w-16 shrink-0 items-center pt-20">
            <div className="flex flex-col items-center gap-6 sticky top-24">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted -rotate-90 whitespace-nowrap mb-4">Steps</span>
              {STEPS.map((step, i) => {
                const state = getStepCircleState(i);
                return (
                  <button
                    key={i}
                    onClick={() => scrollToSection(i)}
                    className="group relative flex items-center justify-center w-full"
                    title={step.title}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                        state === 'completed'
                          ? 'border-[#00D97E] bg-[#00D97E]'
                          : state === 'active'
                          ? 'border-[#00D97E] bg-[#00D97E]/20 shadow-[0_0_8px_rgba(0,217,126,0.4)]'
                          : 'border-text-muted/40 bg-transparent'
                      }`}
                    >
                      {state === 'completed' && (
                        <Check size={10} className="text-white absolute inset-0 m-auto" />
                      )}
                    </div>
                    <span
                      className={`absolute left-8 text-xs whitespace-nowrap transition-opacity duration-200 opacity-0 group-hover:opacity-100 ${
                        state === 'active' ? 'text-[#00D97E]' : 'text-text-secondary'
                      }`}
                    >
                      {step.title}
                    </span>
                  </button>
                );
              })}
              {/* Vertical connecting line behind dots */}
              <div className="absolute top-0 bottom-0 left-[7px] w-0.5 -z-10 bg-border" />
              <div
                className="absolute top-0 left-[7px] w-0.5 -z-10 transition-all duration-300"
                style={{
                  height: `${(activeSection / (STEPS.length - 1)) * 100}%`,
                  backgroundColor: fillColor
                }}
              />
            </div>
          </nav>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="mb-12 pt-8">
              <h1 className="text-3xl md:text-4xl font-display font-bold mb-3">How to Use WhatsApp Shield</h1>
              <p className="text-text-secondary max-w-2xl">
                Follow these six steps to safely validate phone numbers using WhatsApp Shield.
              </p>
            </div>

            <div className="space-y-16">
              {STEPS.map((step, i) => {
                const isVisible = visibleSections.has(i);
                return (
                  <section
                    key={i}
                    ref={(el) => sectionRefs.current[i] = el}
                    data-index={i}
                    className="scroll-mt-20"
                  >
                    <div
                      className={`transition-all duration-400 ease-out ${
                        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
                      }`}
                    >
                      <div className="flex gap-6 lg:gap-8">
                        {/* Left number column */}
                        <div className="hidden sm:flex flex-col items-center shrink-0">
                          <div className="w-14 h-14 rounded-full border-2 border-primary/40 flex items-center justify-center text-2xl font-bold font-display text-primary bg-background relative z-10">
                            {step.num}
                          </div>
                          {i < STEPS.length - 1 && (
                            <div className="w-0.5 flex-1 bg-border relative mt-4 overflow-hidden">
                              <div
                                className="absolute top-0 left-0 w-full transition-all duration-700"
                                style={{
                                  height: isVisible ? '100%' : '0%',
                                  backgroundColor: fillColor
                                }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Card content */}
                        <div className="flex-1 pb-8 min-w-0">
                          <div
                            className="p-5 md:p-7 rounded-2xl border border-border bg-surface relative overflow-hidden transition-all duration-400"
                            style={{
                              transitionDelay: isVisible ? '0ms' : '0ms',
                              opacity: isVisible ? 1 : 0,
                              transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                              transition: 'opacity 0.4s ease-out, transform 0.4s ease-out'
                            }}
                          >
                            {/* Step header */}
                            <div className="flex items-center gap-3 mb-4">
                              <div className="sm:hidden w-10 h-10 rounded-full border-2 border-primary/40 flex items-center justify-center font-bold font-display text-primary shrink-0">
                                {step.num}
                              </div>
                              <div className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <step.icon size={22} className="text-primary" />
                              </div>
                              <div>
                                <h2 className="text-lg md:text-xl font-display font-semibold">{step.title}</h2>
                              </div>
                            </div>

                            {/* Description */}
                            <p className="text-text-secondary leading-relaxed mb-5 text-sm md:text-base">{step.desc}</p>

                            {/* SVG Wireframe */}
                            <div className="rounded-xl border border-border bg-background/50 p-3 md:p-4 overflow-hidden">
                              {step.wireframe({ theme })}
                            </div>

                            {step.ctas && step.ctas.map((cta, ci) => (
                              <div key={ci} className="mt-4">
                                <Link to={cta.to}>
                                  <Button variant={cta.variant || 'outline'} size="sm">
                                    <cta.icon size={14} className="mr-2" /> {cta.text}
                                  </Button>
                                </Link>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom CTA section */}
        <div className="text-center py-16 border-t border-border mt-16">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">Ready to Start?</h2>
          <p className="text-text-secondary max-w-lg mx-auto mb-8">
            Connect your WhatsApp, validate your numbers, and start generating leads in minutes.
          </p>
          <Link to={SHIELD_HOME}>
            <Button variant="default" size="lg" className="h-14 px-10 text-lg rounded-full shadow-[0_0_30px_rgba(0,217,126,0.3)] hover:shadow-[0_0_40px_rgba(0,217,126,0.5)] transition-all">
              Start Generating Leads <ArrowRight size={20} className="ml-2" />
            </Button>
          </Link>
        </div>

        {/* Mobile dot indicator */}
        <div className="lg:hidden fixed right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40">
          {STEPS.map((step, i) => (
            <button
              key={i}
              onClick={() => scrollToSection(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i === activeSection ? 'bg-primary scale-125' : 'bg-border'
              }`}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
