import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ShieldCheck, Activity, Globe, ClipboardList, MessageCircle, Shield, CheckCircle, Smartphone, Lock, Terminal, Download, ArrowRight, Star, ShoppingCart, Megaphone, Building2, HeartPulse, GraduationCap, Banknote, Cpu, Truck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import WhatsAppShieldLogo from '../components/ui/WhatsAppShieldLogo';
import { cn } from '../components/ui/cn';
import { SHIELD_HOME } from '../utils/paths';

const TESTIMONIALS = [
  { name: 'Ahmed Khan', role: 'Marketing Director', company: 'Sparks Digital, PK', initials: 'AK', color: 'bg-gradient-to-br from-blue-400 to-blue-600', text: 'WhatsApp Shield saved us hours of manual work. Validating 10,000 numbers used to take two days. Now it is done in 30 minutes with zero issues.' },
  { name: 'Maria Silva', role: 'CRM Manager', company: 'TechRetail, BR', initials: 'MS', color: 'bg-gradient-to-br from-purple-400 to-purple-600', text: 'The Shield Mode gives me peace of mind. I can clean our entire customer database without worrying about account flags. Absolutely essential tool.' },
  { name: 'James Okonkwo', role: 'Growth Lead', company: 'AfriMarket, NG', initials: 'JO', color: 'bg-gradient-to-br from-emerald-400 to-emerald-600', text: 'The multi-format number detection is incredible. Paste any format from any country and it just works. The country detection cards are a nice touch.' },
  { name: 'Yuki Tanaka', role: 'Engineering Lead', company: 'Sakura Tech, JP', initials: 'YT', color: 'bg-gradient-to-br from-rose-400 to-rose-600', text: 'Clean, well-architected software. The real-time terminal and export options are exactly what we needed for our lead validation pipeline.' },
  { name: 'Sarah Chen', role: 'Operations Manager', company: 'Global Connect, SG', initials: 'SC', color: 'bg-gradient-to-br from-amber-400 to-amber-600', text: 'We use it weekly for verifying our SEA contact lists. The PDF export feature with country breakdown is perfect for client reporting.' },
  { name: 'Omar Al-Rashid', role: 'Data Analyst', company: 'Raya Digital, AE', initials: 'OA', color: 'bg-gradient-to-br from-cyan-400 to-cyan-600', text: 'The clean QR-code connection and instant validation reports make it effortless. Our lead pipeline runs smoothly every single week.' },
];

const AVATAR_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-500'];

const brands = [
  { icon: ShoppingCart, label: 'E-Commerce', desc: 'Retail & Marketplaces' },
  { icon: Megaphone, label: 'Marketing', desc: 'Agencies & Campaigns' },
  { icon: Building2, label: 'Real Estate', desc: 'Property & Rentals' },
  { icon: HeartPulse, label: 'Healthcare', desc: 'Clinics & Telehealth' },
  { icon: GraduationCap, label: 'Education', desc: 'EdTech & Institutions' },
  { icon: Banknote, label: 'Finance', desc: 'Banking & FinTech' },
  { icon: Cpu, label: 'Technology', desc: 'SaaS & Engineering' },
  { icon: Truck, label: 'Logistics', desc: 'Shipping & Delivery' },
];

function TestimonialsCarousel() {
  return (
    <div className="group/testimonials relative overflow-hidden">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-r from-surface to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-l from-surface to-transparent z-10 pointer-events-none" />

      <div className="overflow-hidden">
        <div className="flex gap-6 testimonial-track" style={{ animationDuration: '40s' }}>
          {/* First set */}
          {TESTIMONIALS.map((t, i) => (
            <div
              key={`a-${i}`}
              className="min-w-[260px] sm:min-w-[300px] max-w-[340px] p-6 rounded-2xl bg-surface border border-border/60 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, si) => (
                  <Star key={si} size={14} className="text-warning fill-warning" />
                ))}
              </div>
              <p className="text-sm text-text-secondary leading-relaxed flex-1 mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3 mt-auto pt-4 border-t border-border/30">
                <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm`}>
                  {t.initials}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-text-primary truncate">{t.name}</p>
                  <p className="text-xs text-text-muted truncate">{t.company}</p>
                </div>
              </div>
            </div>
          ))}
          {/* Duplicate for seamless loop */}
          {TESTIMONIALS.map((t, i) => (
            <div
              key={`b-${i}`}
              className="min-w-[260px] sm:min-w-[300px] max-w-[340px] p-6 rounded-2xl bg-surface border border-border/60 hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, si) => (
                  <Star key={si} size={14} className="text-warning fill-warning" />
                ))}
              </div>
              <p className="text-sm text-text-secondary leading-relaxed flex-1 mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3 mt-auto pt-4 border-t border-border/30">
                <div className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm`}>
                  {t.initials}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-text-primary truncate">{t.name}</p>
                  <p className="text-xs text-text-muted truncate">{t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Helper for scroll animations
const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const LandingPage = () => {
  return (
    <div className="w-full flex flex-col items-center">
      
      {/* 1. Hero Section */}
       <section className="relative w-full min-h-[80vh] sm:min-h-[85vh] flex items-center justify-center overflow-hidden py-10 sm:py-14 lg:py-18 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 z-0 bg-background">
          <div className="absolute inset-0 dark:mesh-gradient-dark mesh-gradient-light opacity-100" />
        </div>
        
        <div className="relative z-10 w-full max-w-4xl lg:max-w-5xl mx-auto text-center flex flex-col items-center gap-4 sm:gap-6 lg:gap-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex items-center justify-center p-2.5 sm:p-3 lg:p-4 rounded-full bg-surface border border-border shadow-2xl"
          >
            <WhatsAppShieldLogo size={28} className="text-primary sm:size-[36] lg:size-[48]" />
          </motion.div>
          
           <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-display font-bold tracking-tight leading-tight text-text-primary px-2"
          >
            Verify WhatsApp Numbers <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">At Scale. Safely.</span>
          </motion.h1>
          
           <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-sm sm:text-base lg:text-lg text-text-secondary max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto leading-relaxed px-4"
          >
            The enterprise-grade platform for validating massive phone number lists against WhatsApp's network, engineered with strict anti-ban jitter delays.
          </motion.p>
          
           <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto mt-2 sm:mt-3 lg:mt-4 px-4 sm:px-0"
          >
            <Button size="lg" className="w-full sm:w-auto h-11 sm:h-12 lg:h-14 px-5 sm:px-6 lg:px-8 text-sm lg:text-lg rounded-full shadow-[0_0_30px_rgba(0,217,126,0.3)] hover:shadow-[0_0_40px_rgba(0,217,126,0.5)] transition-all" asChild>
              <Link to="/user-guide">How It Works <Activity className="ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-11 sm:h-12 lg:h-14 px-5 sm:px-6 lg:px-8 text-sm lg:text-lg rounded-full" asChild>
              <Link to={SHIELD_HOME}>Get Started <ArrowRight className="ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" /></Link>
            </Button>
          </motion.div>
          
           <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-wrap justify-center gap-3 sm:gap-4 lg:gap-6 mt-4 sm:mt-6 lg:mt-8 text-xs sm:text-sm text-text-secondary"
          >
            <div className="flex items-center gap-1.5"><ShieldCheck className="text-primary h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" /> Shield Mode Protected</div>
            <div className="flex items-center gap-1.5"><Activity className="text-primary h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" /> Real-Time Validation</div>
            <div className="flex items-center gap-1.5"><Lock className="text-primary h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-5 lg:w-5" /> Zero Data Storage</div>
          </motion.div>
        </div>
      </section>

      {/* 2. Features Section */}
      <section id="features" className="w-full py-16 sm:py-24 bg-surface border-t border-border px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-display font-bold mb-3 sm:mb-4 px-2">Everything You Need to Validate at Scale</h2>
            <p className="text-sm sm:text-base lg:text-lg text-text-secondary max-w-2xl mx-auto px-4">A complete suite of tools designed for high-throughput WhatsApp audience validation without compromising account safety.</p>
          </div>
          
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {[
              { icon: ShieldCheck, title: 'Shield Mode Anti-Ban', desc: 'Algorithmic jitter delays and automatic cool-down periods prevent your account from being flagged.' },
              { icon: Activity, title: 'Real-Time Stream', desc: 'Watch the validation happen live in a secure, sandboxed terminal with real-time ETA calculations.' },
              { icon: Globe, title: 'Global Number Support', desc: 'Auto-formatting and validation for 195+ countries. Just paste and let our engine do the rest.' },
              { icon: ClipboardList, title: 'Audit Logs & History', desc: 'Every campaign is saved locally on your machine. Review past runs and access historical data instantly.' },
              { icon: Download, title: 'Multi-Format Export', desc: 'Export your clean, validated lists to CSV, TXT, JSON, or generate executive-ready PDF reports.' },
              { icon: MessageCircle, title: 'Safe Dispatcher', desc: 'Generate secure wa.me links for your validated audience to streamline your outreach operations.' }
            ].map((feature, idx) => (
              <motion.div key={idx} variants={fadeUpVariants}>
                <Card className="h-full hover:-translate-y-1 sm:hover:-translate-y-2 transition-transform duration-300 hover:shadow-xl hover:border-primary/50 group">
                  <CardContent className="p-5 sm:p-8">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                      <feature.icon size={20} className="sm:size-[28]" />
                    </div>
                    <h3 className="text-base sm:text-xl font-bold mb-2 sm:mb-3">{feature.title}</h3>
                    <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 2.5 Testimonials Section */}
      <section id="testimonials" className="w-full py-16 sm:py-24 bg-surface border-t border-border px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-display font-bold mb-3 sm:mb-4">Trusted by Professionals</h2>
            <p className="text-sm sm:text-base lg:text-lg text-text-secondary max-w-2xl mx-auto px-4">Hear from teams that use WhatsApp Shield every day to keep their operations running.</p>
          </div>

          <TestimonialsCarousel />
        </div>
      </section>

      {/* 2.75 Brand Showcase Section */}
      <section className="w-full py-14 sm:py-20 bg-background border-t border-border px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-14">
            <p className="text-[10px] sm:text-sm font-medium text-text-muted uppercase tracking-widest mb-2 sm:mb-3">Trusted Across Industries</p>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold px-2">Used by teams in every sector</h2>
          </div>

          <div className="group/brands relative">
            <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            <div className="overflow-hidden">
              <div className="flex items-center gap-8 sm:gap-16 brand-track py-2">
                {brands.map((brand, i) => {
                  const Icon = brand.icon;
                  return (
                    <div
                      key={`a-${i}`}
                      className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 rounded-xl border border-border/40 bg-surface/50 grayscale hover:grayscale-0 hover:border-primary/30 hover:bg-surface hover:shadow-sm transition-all duration-500 cursor-default shrink-0"
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary/60 group-hover:text-primary transition-colors duration-500">
                        <Icon size={16} className="sm:size-[20]" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-text-primary">{brand.label}</p>
                        <p className="text-[10px] sm:text-xs text-text-muted">{brand.desc}</p>
                      </div>
                    </div>
                  );
                })}
                {/* Duplicate for seamless loop */}
                {brands.map((brand, i) => {
                  const Icon = brand.icon;
                  return (
                    <div
                      key={`b-${i}`}
                      className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 rounded-xl border border-border/40 bg-surface/50 grayscale hover:grayscale-0 hover:border-primary/30 hover:bg-surface hover:shadow-sm transition-all duration-500 cursor-default shrink-0"
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary/60 group-hover:text-primary transition-colors duration-500">
                        <Icon size={16} className="sm:size-[20]" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-text-primary">{brand.label}</p>
                        <p className="text-[10px] sm:text-xs text-text-muted">{brand.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. How It Works Section */}
      <section id="how-it-works" className="w-full py-16 sm:py-24 bg-background px-4 sm:px-6 lg:px-8 overflow-hidden relative">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12 sm:mb-20">
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-display font-bold mb-3 sm:mb-4">How It Works</h2>
            <p className="text-sm sm:text-base lg:text-lg text-text-secondary px-4">Four simple steps to a perfectly validated WhatsApp audience.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[12%] right-[12%] h-0.5 bg-border -z-10" />
            
            {[
              { num: '01', icon: Smartphone, title: 'Link WhatsApp', desc: 'Scan the QR code to connect your session securely.' },
              { num: '02', icon: Globe, title: 'Import Audience', desc: 'Paste numbers or upload a CSV file.' },
              { num: '03', icon: Shield, title: 'Shield Scan', desc: 'Engine validates numbers safely using jitter delays.' },
              { num: '04', icon: Download, title: 'Export Results', desc: 'Download your clean list in any format.' }
            ].map((step, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                viewport={{ once: true, margin: "-50px" }}
                className="flex flex-col items-center text-center relative"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-surface border-4 border-background shadow-lg flex items-center justify-center mb-4 sm:mb-6 relative group">
                  <div className="absolute inset-0 rounded-full border border-primary/30 scale-110 group-hover:scale-125 group-hover:border-primary/60 transition-all duration-500" />
                  <step.icon size={24} className="text-primary sm:size-[32]" />
                  <div className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center text-[10px] sm:text-xs shadow-md">
                    {step.num}
                  </div>
                </div>
                <h3 className="text-base sm:text-xl font-bold mb-1 sm:mb-2">{step.title}</h3>
                <p className="text-xs sm:text-sm text-text-secondary px-2">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Security Section */}
      <section id="security" className="w-full py-16 sm:py-24 bg-background border-y border-border px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-surface/30 backdrop-blur-sm" />
        <div className="max-w-7xl mx-auto relative z-10">
          <Card className="bg-surface border-border/50 overflow-hidden relative shadow-xl">
            <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-10 pointer-events-none overflow-hidden hidden lg:block">
               <Shield size={600} className="absolute -right-20 -top-20 text-primary animate-pulse-ring" strokeWidth={0.5} />
            </div>

            <CardContent className="p-5 sm:p-8 md:p-16 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12">
              <div>
                 <Badge variant="outline" className="text-primary border-primary/30 mb-4 sm:mb-6 bg-primary/10 text-[10px] sm:text-xs">Enterprise Security</Badge>
                 <h2 className="text-2xl sm:text-3xl lg:text-5xl font-display font-bold mb-4 sm:mb-6">Built for Account Safety</h2>
                 <p className="text-sm sm:text-base lg:text-lg text-text-secondary mb-6 sm:mb-8 leading-relaxed">
                   WhatsApp Shield is engineered specifically to prevent your number from being flagged during bulk operations.
                 </p>
                 <Button variant="default" asChild>
                   <Link to={SHIELD_HOME}>Activate Shield Mode <ArrowRight className="ml-2 h-3 w-3 sm:h-4 sm:w-4" /></Link>
                 </Button>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                 {[
                   { title: 'Sandboxed Architecture', desc: 'Runs entirely on your local machine. No external servers.', icon: Terminal },
                   { title: 'Jitter Delays', desc: 'Randomized intervals between checks mimic human behavior.', icon: Activity },
                   { title: 'Zero Number Storage', desc: 'We never store or upload your target audience lists.', icon: Lock },
                   { title: 'End-to-End Privacy', desc: 'Your session keys remain strictly on your local gateway.', icon: ShieldCheck }
                 ].map((item, idx) => (
                   <div key={idx} className="bg-surface/50 p-4 sm:p-6 rounded-xl border border-border hover:border-primary/30 transition-all">
                     <item.icon size={18} className="text-primary mb-3 sm:mb-4 sm:size-[24]" />
                     <h4 className="text-sm sm:text-base font-bold text-text-primary mb-1 sm:mb-2">{item.title}</h4>
                     <p className="text-xs sm:text-sm text-text-secondary">{item.desc}</p>
                   </div>
                 ))}
               </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 5. Use Cases Section */}
      <section className="w-full py-16 sm:py-24 bg-background px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-display font-bold mb-3 sm:mb-4">Built for Professionals</h2>
            <p className="text-sm sm:text-base lg:text-lg text-text-secondary">Who uses WhatsApp Shield?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
            {[
              { 
                title: 'Marketing Teams', 
                icon: Activity,
                points: ['Clean lead databases before campaigns', 'Reduce bounce rates on API broadcasts', 'Segment active vs inactive users']
              },
              { 
                title: 'Sales Operations', 
                icon: ClipboardList,
                points: ['Verify prospect numbers before outreach', 'Generate direct wa.me links for SDRs', 'Maintain CRM data hygiene']
              },
              { 
                title: 'Support Centers', 
                icon: MessageCircle,
                points: ['Validate customer contact channels', 'Audit support ticketing databases', 'Ensure delivery of critical alerts']
              }
            ].map((useCase, idx) => (
              <Card key={idx} className="bg-surface border-border hover:border-primary/50 transition-colors">
                <CardContent className="p-5 sm:p-8">
                  <useCase.icon size={24} className="text-primary mb-4 sm:mb-6 sm:size-[32]" />
                  <h3 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-6">{useCase.title}</h3>
                  <ul className="space-y-2 sm:space-y-4">
                    {useCase.points.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 sm:gap-3">
                        <CheckCircle size={15} className="text-primary shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm text-text-secondary">{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
    </div>
  );
};

export default LandingPage;
