import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { FileText } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Acceptance of Terms',
    content:
      'By accessing or using Genverce ("the Platform"), you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you may not use our services. Genverce is an AI-native influencer marketplace where all talent consists exclusively of proprietary AI avatars.',
  },
  {
    title: 'Description of Service',
    content:
      'Genverce provides an AI-powered influencer marketplace where customers can browse AI influencer profiles, engage in real-time chat with AI influencer agents, and commission professionally generated marketing videos. All influencers on this platform are artificial intelligence systems — no human creators, freelancers, or third-party talent are involved.',
  },
  {
    title: 'User Accounts',
    content:
      'You must provide accurate, complete, and current information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use. We reserve the right to suspend or terminate accounts that violate these terms.',
  },
  {
    title: 'AI Content Disclosure',
    content:
      'All videos generated on Genverce are produced using artificial intelligence. By default, all generated content includes an AI disclosure label. Customers may opt to disable this disclosure label prior to checkout. Genverce is not responsible for any consequences arising from the use of AI-generated content without proper disclosure in jurisdictions that require it.',
  },
  {
    title: 'Payment and Pricing',
    content:
      'All prices are in USD. Payments are processed securely via Stripe. By completing a purchase, you authorize Genverce to charge your payment method for the selected package. Package prices are: Single Video ($9.99), Pack of 5 ($39.99), Pack of 10 ($70.00), Monthly Starter ($199/mo, 30 videos), Monthly Growth ($499/mo, 100 videos).',
  },
  {
    title: 'Refund Policy',
    content:
      'Our refund policy is as follows: Customers with 0–2 total orders are eligible for a full refund with no questions asked. Customers with 3 or more orders may only request refunds for their most recent 2 orders. The maximum lifetime refund eligibility is 10 videos worth of payment. Refunds are not available after 30 days from the order date. Refer to our full Refund Policy page for complete details.',
  },
  {
    title: 'Intellectual Property',
    content:
      'Upon delivery and full payment, customers receive a license to use the generated videos for commercial purposes. Genverce retains all rights to the underlying AI models, influencer identities, and generation technology. You may not claim ownership of the AI influencer identities or resell them as your own creations.',
  },
  {
    title: 'Prohibited Uses',
    content:
      'You may not use Genverce to create content that is illegal, defamatory, fraudulent, or violates any third-party rights. Political advertising, adult content, and content designed to deceive consumers are strictly prohibited. We reserve the right to reject, cancel, or refund any order that violates these restrictions.',
  },
  {
    title: 'Limitation of Liability',
    content:
      'To the maximum extent permitted by applicable law, Genverce shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill. Our total liability shall not exceed the amount paid by you in the 30 days preceding the claim.',
  },
  {
    title: 'Contact',
    content: 'For questions about these Terms, please contact us at legal@genverce.ai.',
  },
];

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

          {/* Header */}
          <div className="mb-8 sm:mb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-brand-light" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold">
                Terms &amp; <span className="gradient-text">Conditions</span>
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
