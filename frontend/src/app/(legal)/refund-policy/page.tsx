import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { CheckCircle, XCircle } from 'lucide-react';

export default function RefundPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-4xl font-bold mb-2">Refund <span className="gradient-text">Policy</span></h1>
          <p className="text-text-secondary mb-10">Last updated: February 28, 2026</p>

          {/* Policy at a glance */}
          <div className="glass-card p-6 mb-8 space-y-4">
            <h2 className="text-xl font-semibold">Policy at a Glance</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-success/10 border border-success/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={18} className="text-success" />
                  <p className="font-semibold text-success">0–2 Total Orders</p>
                </div>
                <p className="text-sm text-text-secondary">Full refund, no questions asked. We want you to feel safe trying Genverce.</p>
              </div>
              <div className="p-4 bg-brand/10 border border-brand/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={18} className="text-brand-light" />
                  <p className="font-semibold text-brand-light">3+ Orders</p>
                </div>
                <p className="text-sm text-text-secondary">Refund available for the last 2 orders only. Build trust before refunding.</p>
              </div>
              <div className="p-4 bg-error/10 border border-error/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={18} className="text-error" />
                  <p className="font-semibold text-error">Maximum Lifetime Cap</p>
                </div>
                <p className="text-sm text-text-secondary">Maximum 10 videos worth of payment eligible for refund over your account lifetime.</p>
              </div>
              <div className="p-4 bg-surface border border-border rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={18} className="text-text-secondary" />
                  <p className="font-semibold text-text-secondary">After 30 Days</p>
                </div>
                <p className="text-sm text-text-secondary">Refunds not available after 30 days from the original order date.</p>
              </div>
            </div>
          </div>

          <div className="prose prose-invert space-y-8 text-text-secondary">
            {[
              { title: 'How to Request a Refund', content: 'To request a refund, log into your Genverce account and navigate to Dashboard > Orders. Find the relevant order and click "Raise Issue". Select "Refund Request" as the issue type and provide a brief reason. Our team will review your request within 24 hours. Approved refunds are processed back to your original payment method within 5–10 business days.' },
              { title: 'Instant Delivery Orders', content: 'For orders placed with Instant Delivery, please note that the video was generated and delivered without human review. Refunds for instant delivery orders are subject to the same policy rules as quality-checked orders. Quality concerns are taken seriously but the lack of pre-delivery review is disclosed at checkout.' },
              { title: 'Quality Issues', content: 'If you receive a video that does not match your project brief, contains technical errors, or fails to deliver the agreed content, you are entitled to a free regeneration or a refund regardless of your order history, provided you raise the issue within 7 days of delivery.' },
              { title: 'Non-Refundable Items', content: 'Custom Avatar packages (priced on request) are non-refundable once work has begun. Monthly subscription plans are non-refundable after more than 5 videos have been generated within that billing cycle.' },
              { title: 'Contact', content: 'For refund-related queries, raise a ticket from your dashboard or email support@genverce.ai. We aim to respond within 24 hours.' },
            ].map(section => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold text-text-primary mb-3">{section.title}</h2>
                <p className="leading-relaxed">{section.content}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
