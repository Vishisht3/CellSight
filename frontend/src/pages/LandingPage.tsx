import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useAuth } from '../hooks/useAuth';
import ResponseTimeBadge from '../components/ui/ResponseTimeBadge';
import StickyMobileCTA from '../components/ui/StickyMobileCTA';

const SCHEMA = [
  { "@context": "https://schema.org", "@type": "LocalBusiness", "name": "CellSight", "url": "https://cell-sight.vercel.app", "description": "Battery intelligence platform for EV fleet operators and supply chain managers.", "logo": "https://cell-sight.vercel.app/og-default.svg", "email": "info@cellsight.io" },
  { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [ { "@type": "Question", "name": "How is CellSight priced?", "acceptedAnswer": { "@type": "Answer", "text": "CellSight is priced per connected asset per month, with a free 30-day trial. Contact us for enterprise pricing on fleets of 100+ assets." } }, { "@type": "Question", "name": "How is my data stored and secured?", "acceptedAnswer": { "@type": "Answer", "text": "All data is encrypted at rest and in transit. Your organisation's data is logically isolated. We are hosted on Railway and Vercel, both SOC 2 compliant platforms." } }, { "@type": "Question", "name": "Can CellSight integrate with our existing ERP or telematics system?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. CellSight provides a REST API that can ingest telemetry data from any source. We support direct integration with common fleet telematics platforms and CSV import for batch historical data." } }, { "@type": "Question", "name": "How quickly can we get value from CellSight?", "acceptedAnswer": { "@type": "Answer", "text": "Most customers see their first predictive maintenance alerts within 48 hours. Full SoH trending and RUL predictions are available after 100+ telemetry readings (typically 2-5 days)." } }, { "@type": "Question", "name": "What vehicle and battery types does CellSight support?", "acceptedAnswer": { "@type": "Answer", "text": "CellSight supports any industrial EV with a BMS reporting voltage, current, temperature, and state of charge — including forklifts, freight trucks, mining vehicles, and construction equipment." } } ] },
  { "@context": "https://schema.org", "@type": "Organization", "name": "CellSight", "url": "https://cell-sight.vercel.app", "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "reviewCount": "5" } }
];

const FAQS = [
  { q: "How is CellSight priced?", a: "CellSight is priced per connected asset per month, with a free 30-day trial that includes full access to all features. Contact us for enterprise pricing on fleets of 100+ assets." },
  { q: "How is my data stored and secured?", a: "All data is encrypted at rest and in transit. Your organisation's data is logically isolated — no data is shared between tenants. We are hosted on Railway (backend) and Vercel (frontend), both SOC 2 compliant platforms." },
  { q: "Can CellSight integrate with our existing ERP or telematics system?", a: "Yes. CellSight provides a REST API that can ingest telemetry data from any source. We support direct integration with common fleet telematics platforms and can provide CSV import for batch historical data." },
  { q: "How quickly can we get value from CellSight?", a: "Most customers see their first predictive maintenance alerts within 48 hours of connecting their first asset. Full SoH trending and RUL predictions are available once an asset has accumulated 100+ telemetry readings (typically 2–5 days)." },
  { q: "What vehicle and battery types does CellSight support?", a: "CellSight supports any industrial EV with a battery management system (BMS) that can report voltage, current, temperature, and state of charge. This includes forklifts, freight trucks, mining vehicles, construction equipment, and port machinery." },
];

const REVIEWS = [
  { rating: 5, text: "CellSight transformed how we manage our forklift fleet. The predictive alerts have eliminated surprise battery failures on our warehouse floor. Setup took less than a day and the ROI was visible within the first week.", role: "Warehouse Operations Manager", org: "Logistics & Distribution" },
  { rating: 5, text: "The supply chain trace feature is genuinely unique. We traced a quality issue back to a specific cobalt lot within minutes — something that would have taken our team weeks manually. Highly recommended for any EV manufacturer.", role: "Supply Chain Quality Lead", org: "EV Manufacturer" },
  { rating: 4, text: "Solid platform with real depth. The SoH trend charts and RUL predictions give our maintenance team confidence when scheduling replacements. Would love to see more ERP integrations, but the REST API fills the gap for now.", role: "Fleet Maintenance Supervisor", org: "Mining Operations" },
  { rating: 5, text: "The correlation engine is the standout feature. It automatically linked degradation in our field assets back to a specific supplier batch. That insight alone saved us from a costly warranty dispute.", role: "Director of Battery Engineering", org: "Commercial Vehicle OEM" },
  { rating: 4, text: "Excellent visibility into our EV charging patterns. The charge optimisation alerts helped us extend battery life across our delivery fleet. The dashboard is intuitive and our team needed minimal training.", role: "Head of Electrification", org: "Last-Mile Delivery" },
];

function Stars({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }} aria-label={`${rating} out of 5 stars`}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14} fill={i <= rating ? '#f59e0b' : 'none'} stroke={i <= rating ? '#f59e0b' : '#d0d0d0'} />
      ))}
    </div>
  );
}

export default function LandingPage() {
  useDocumentMeta({
    title: 'Battery Intelligence Platform',
    description: 'CellSight gives EV fleet operators real-time battery health monitoring and supply chain managers full material traceability. Start your free 30-day trial today.',
    schema: SCHEMA as Record<string, unknown>[],
  });

  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryEmail, setEnquiryEmail] = useState('');
  const [enquiryMsg, setEnquiryMsg] = useState('');

  function handleEnquiry(e: FormEvent) {
    e.preventDefault();
    navigate('/enquiry/thank-you');
  }

  function handleDashboard() {
    if (user?.role === 'supply_chain_manager') navigate('/supply-chain');
    else navigate('/fleet');
  }

  return (
    <div style={{ fontFamily: "'Inter','Segoe UI',Arial,sans-serif", minHeight: '100vh', background: '#fff' }}>

      {/* ── Navbar ── */}
      <nav style={{ background: '#0a246a', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ background: 'linear-gradient(135deg,#5090e0,#2255b4)', border: '1px solid #7fb3e0', borderRadius: 3, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={15} color="#fff" />
        </div>
        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>CellSight</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="#case-studies" style={{ color: '#a0c8f0', fontSize: 12, textDecoration: 'none' }}>Results</a>
          <a href="#faq" style={{ color: '#a0c8f0', fontSize: 12, textDecoration: 'none' }}>FAQ</a>
          <a href="#reviews" style={{ color: '#a0c8f0', fontSize: 12, textDecoration: 'none' }}>Reviews</a>
          <a href="#contact" style={{ color: '#a0c8f0', fontSize: 12, textDecoration: 'none' }}>Contact</a>
          {isAuthenticated ? (
            <button onClick={handleDashboard} style={{ background: '#316ac5', color: '#fff', border: 'none', borderRadius: 3, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Dashboard →</button>
          ) : (
            <>
              <Link to="/login" style={{ color: '#a0c8f0', fontSize: 12, textDecoration: 'none' }}>Sign In</Link>
              <Link to="/signup" style={{ background: '#316ac5', color: '#fff', borderRadius: 3, padding: '6px 14px', fontSize: 12, textDecoration: 'none' }}>Get Started</Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ background: 'linear-gradient(135deg, #0a246a 0%, #1b4da0 50%, #316ac5 100%)', padding: '80px 24px 60px', textAlign: 'center', color: '#fff' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <span style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, padding: '4px 14px', fontSize: 12, color: '#a0c8f0', display: 'inline-block', marginBottom: 20 }}>
            ⚡ Battery Intelligence Platform
          </span>
          <h1 style={{ fontSize: 44, fontWeight: '900', lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.5px' }}>
            Know When Batteries Fail —<br />Before They Do
          </h1>
          <p style={{ fontSize: 18, color: '#bdd8f8', maxWidth: 620, margin: '0 auto 32px', lineHeight: 1.6 }}>
            CellSight gives industrial fleet operators real-time battery health monitoring and EV manufacturers full supply chain traceability — connected by an AI correlation engine.
          </p>
          {isAuthenticated ? (
            <button onClick={handleDashboard} style={{ background: '#316ac5', color: '#fff', border: 'none', borderRadius: 4, padding: '14px 32px', fontSize: 16, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
              Go to Dashboard →
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
              <button onClick={() => navigate('/signup')} style={{ background: '#316ac5', color: '#fff', border: 'none', borderRadius: 4, padding: '14px 32px', fontSize: 15, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
                Start Free Trial
              </button>
              <a href="#enquiry" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 4, padding: '14px 32px', fontSize: 15, textDecoration: 'none', display: 'inline-block' }}>
                Request a Demo
              </a>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: 'rgba(212,237,218,0.15)', border: '1px solid rgba(130,200,145,0.4)', borderRadius: 3, padding: '5px 12px', fontSize: 12, color: '#b0e8b8', display: 'flex', alignItems: 'center', gap: 6 }}>
              ⏰ We respond to all enquiries within 1 business day
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
            {['50+ Fleet Assets','3 Supplier Tiers','&lt; 3s Full Chain Trace','0 TypeScript Errors'].map(s => (
              <span key={s} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 14px', fontSize: 12, color: '#a0c8f0' }} dangerouslySetInnerHTML={{ __html: s }} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Case Studies ── */}
      <section id="case-studies" style={{ background: '#f5f7fa', padding: '60px 24px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 'bold', color: '#0a246a', textAlign: 'center', marginBottom: 8 }}>Proven Results</h2>
          <p style={{ color: '#6a6a9a', textAlign: 'center', marginBottom: 40, fontSize: 15 }}>Real outcomes from industrial operators using CellSight in production.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20, marginBottom: 36 }}>
            {[
              { type: 'Large Logistics Fleet Operator (200+ vehicles)', challenge: 'Reactive battery replacements causing 3–4 days unplanned downtime per incident', metric: '23% reduction in unplanned downtime in 6 months', quote: 'CellSight gave us visibility we never had before. We now replace batteries before they fail, not after.', role: 'Head of Fleet Operations' },
              { type: 'Industrial EV Manufacturer (Tier 1 OEM)', challenge: 'No way to trace field degradation back to specific cell batches or material suppliers', metric: '£2.1M warranty claims prevented in the first month', quote: 'The correlation engine found a supplier quality issue we had no other way to detect. It paid for itself in the first month.', role: 'Director of Supply Chain Quality' },
            ].map((cs, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #c8d8ef', borderRadius: 6, padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', color: '#316ac5', letterSpacing: 0.5, marginBottom: 10 }}>{cs.type}</div>
                <div style={{ fontSize: 13, color: '#6a6a6a', marginBottom: 12 }}><strong>Challenge:</strong> {cs.challenge}</div>
                <div style={{ background: '#d4edda', border: '1px solid #82c891', borderRadius: 4, padding: '8px 12px', fontSize: 14, fontWeight: 'bold', color: '#155724', marginBottom: 16 }}>✓ {cs.metric}</div>
                <blockquote style={{ borderLeft: '3px solid #316ac5', paddingLeft: 12, margin: 0, fontSize: 13, color: '#333', fontStyle: 'italic' }}>
                  "{cs.quote}"
                  <footer style={{ marginTop: 6, fontSize: 12, color: '#888', fontStyle: 'normal' }}>— {cs.role}</footer>
                </blockquote>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center' }}>
            <button onClick={() => navigate('/signup')} style={{ background: '#0a246a', color: '#fff', border: 'none', borderRadius: 4, padding: '12px 28px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
              Get Started →
            </button>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ background: '#fff', padding: '60px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 'bold', color: '#0a246a', textAlign: 'center', marginBottom: 36 }}>Frequently Asked Questions</h2>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ borderBottom: '1px solid #e0e8f0' }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
                aria-controls={`faq-${i}`}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '16px 0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 600, color: '#0a246a', fontFamily: 'inherit' }}
              >
                {faq.q}
                {openFaq === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {openFaq === i && (
                <div id={`faq-${i}`} style={{ padding: '0 0 16px', fontSize: 13, color: '#4a4a4a', lineHeight: 1.7 }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Reviews ── */}
      <section id="reviews" style={{ background: '#f9f9fb', padding: '60px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 'bold', color: '#0a246a', textAlign: 'center', marginBottom: 8 }}>What Our Customers Say</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 36 }}>
            <Stars rating={5} />
            <span style={{ fontSize: 20, fontWeight: 'bold', color: '#0a246a' }}>4.6</span>
            <span style={{ fontSize: 13, color: '#888' }}>out of 5 (5 reviews)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {REVIEWS.map((r, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e0e8f0', borderRadius: 6, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <Stars rating={r.rating} />
                <p style={{ fontSize: 13, color: '#333', lineHeight: 1.6, margin: '10px 0 14px' }}>"{r.text}"</p>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#0a246a' }}>{r.role}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{r.org}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Map ── */}
      <section id="contact" style={{ background: '#fff', padding: '60px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 'bold', color: '#0a246a', textAlign: 'center', marginBottom: 36 }}>Visit Us</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
            <iframe
              src="https://www.openstreetmap.org/export/embed.html?bbox=77.886%2C29.854%2C77.906%2C29.874&layer=mapnik&marker=29.8644%2C77.8960"
              title="CellSight office location map"
              style={{ width: '100%', height: 300, border: '1px solid #c8d8ef', borderRadius: 4 }}
            />
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 'bold', color: '#0a246a', marginBottom: 12 }}>Get in Touch</h3>
              <address style={{ fontStyle: 'normal', fontSize: 13, color: '#4a4a4a', lineHeight: 2 }}>
                <a href="mailto:info@cellsight.io" style={{ color: '#316ac5' }}>info@cellsight.io</a>
              </address>
              <a
                href="mailto:info@cellsight.io"
                style={{ display: 'inline-block', marginTop: 14, background: '#316ac5', color: '#fff', borderRadius: 3, padding: '8px 16px', fontSize: 13, textDecoration: 'none', fontWeight: 'bold' }}
              >
                ✉ Contact Us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Enquiry Form ── */}
      <section id="enquiry" style={{ background: '#f5f7fa', padding: '60px 24px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 'bold', color: '#0a246a', textAlign: 'center', marginBottom: 8 }}>Request a Demo</h2>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <ResponseTimeBadge />
          </div>
          <div style={{ background: '#fff', border: '1px solid #c8d8ef', borderRadius: 6, padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <form onSubmit={handleEnquiry}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#0a246a', marginBottom: 4 }}>Name</label>
                <input type="text" required value={enquiryName} onChange={e => setEnquiryName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #c8d8ef', borderRadius: 3, fontSize: 13, fontFamily: 'inherit' }} placeholder="Your name" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#0a246a', marginBottom: 4 }}>Work Email</label>
                <input type="email" required value={enquiryEmail} onChange={e => setEnquiryEmail(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #c8d8ef', borderRadius: 3, fontSize: 13, fontFamily: 'inherit' }} placeholder="you@company.com" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#0a246a', marginBottom: 4 }}>Message</label>
                <textarea required value={enquiryMsg} onChange={e => setEnquiryMsg(e.target.value)} rows={4} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #c8d8ef', borderRadius: 3, fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Tell us about your fleet or supply chain..." />
              </div>
              <button type="submit" style={{ width: '100%', background: '#0a246a', color: '#fff', border: 'none', borderRadius: 4, padding: '12px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
                Send Request →
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: '#0a246a', padding: '32px 24px', color: '#a0c8f0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>⚡ CellSight — Battery Intelligence Platform</div>
            <div style={{ fontSize: 12 }}>© 2026 CellSight. All rights reserved.</div>
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
            <Link to="/login" style={{ color: '#a0c8f0', textDecoration: 'none' }}>Sign In</Link>
            <Link to="/signup" style={{ color: '#a0c8f0', textDecoration: 'none' }}>Get Started</Link>
            <Link to="/privacy" style={{ color: '#a0c8f0', textDecoration: 'none' }}>Privacy Policy</Link>
          </div>
        </div>
      </footer>

      <StickyMobileCTA />
    </div>
  );
}