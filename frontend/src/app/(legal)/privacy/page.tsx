import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { ShieldCheck } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Information We Collect',
    content:
      "We collect information you provide directly to us, such as when you create an account (name, email, password), place an order (project briefs, payment details via Stripe), or contact support. We also automatically collect usage data including IP addresses, browser type, pages visited, and interaction patterns.",
  },
  {
    title: 'How We Use Your Information',
    content:
      'We use your information to provide and improve our services, process payments, communicate about orders, detect and prevent fraud, comply with legal obligations, and personalize your experience. We analyze chat interactions with AI influencers (stored anonymously) to improve AI quality.',
  },
  {
    title: 'Data Storage and Security',
    content:
      'Your data is stored in secure PostgreSQL databases and processed through industry-standard encryption. Chat messages are stored for service continuity and AI improvement. Video content is stored on AWS S3 with CloudFront CDN delivery. We implement appropriate technical and organizational measures to protect your data.',
  },
  {
    title: 'AI Interactions',
    content:
      'Conversations with AI influencers are stored to maintain conversation history and improve AI model performance. These conversations may be reviewed by our quality assurance team. By using chat features, you consent to this storage and potential review.',
  },
  {
    title: 'Third-Party Services',
    content:
      "We use Stripe for payment processing (subject to Stripe's Privacy Policy), AWS for storage, Pinecone for AI memory management, OpenAI (ChatGPT models) for AI generation, and ElevenLabs for voice synthesis. Each service has its own privacy practices.",
  },
  {
    title: 'Data Retention',
    content:
      'We retain your account data for as long as your account is active. Order records are retained for 7 years for tax and compliance purposes. Chat history is retained for 12 months. You may request deletion of non-legally-required data at any time.',
  },
  {
    title: 'Your Rights',
    content:
      'You have the right to access, correct, or delete your personal data. You may request a data export at any time. To exercise these rights, contact privacy@genverce.ai. We will respond within 30 days.',
  },
  {
    title: 'Contact',
    content:
      'For privacy inquiries, contact our Data Protection team at privacy@genverce.ai.',
  },
];

export default function PrivacyPage() {
  return (  
    <>
      <Navbar />
      <main className="min-h-screen pt-20 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

          {/* Header */}
          <div className="mb-8 sm:mb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={20} className="text-brand-light" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold">
                Privacy <span className="gradient-text">Policy</span>
              </h1>
            </div>
            <p className="text-sm text-text-secondary">Last updated: February 28, 2026</p>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {SECTIONS.map((section, i) => (
              <section
                key={i}
                id={`section-${i + 1}`}
                className="glass-card p-4 sm:p-6 scroll-mt-24"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center text-xs font-bold text-brand-light">
                    {i + 1}
                  </span>
                  <h2 className="text-base sm:text-lg font-semibold text-text-primary leading-snug pt-0.5">
                    {section.title}
                  </h2>
                </div>
                <p className="text-sm sm:text-base text-text-secondary leading-relaxed pl-10">
                  {section.content}
                </p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
