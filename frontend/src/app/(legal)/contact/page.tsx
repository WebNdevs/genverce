'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Mail,
  MessageSquare,
  Sparkles,
  Send,
  CheckCircle2,
  Clock,
  MapPin,
  Building2,
  HelpCircle,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { toast } from '@/components/ui/toaster';

const CONTACT_INFO = [
  {
    icon: Mail,
    title: 'Support & Queries',
    detail: 'support@genverce.ai',
    description: '24/7 technical and order support for all customers',
  },
  {
    icon: Building2,
    title: 'Sales & Enterprise',
    detail: 'sales@genverce.ai',
    description: 'Agency volume discounts & custom AI influencer scoping',
  },
  {
    icon: Clock,
    title: 'Response Time',
    detail: '< 2 Hours Average',
    description: 'Our AI and human team are available 24/7 worldwide',
  },
  {
    icon: MapPin,
    title: 'Headquarters',
    detail: 'San Francisco, CA',
    description: 'Remote-first global infrastructure',
  },
];

const TOPICS = [
  'General Inquiry',
  'Custom AI Influencer Request',
  'Order & Billing Support',
  'Technical Support',
  'Agency & Enterprise Licensing',
  'Partnership Opportunities',
];

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'error',
      });
      return;
    }

    setSubmitting(true);

    // Simulate clean form submission
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      toast({
        title: 'Message sent successfully!',
        description: 'Thank you for reaching out. Our support team will reply to your email within 2 hours.',
        variant: 'success',
      });
      setName('');
      setEmail('');
      setMessage('');
    }, 1000);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 pb-24 relative overflow-hidden bg-background">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand/5 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto mb-12 sm:mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-brand/30 bg-brand/5 mb-4">
              <Sparkles size={14} className="text-brand-light" />
              <span className="text-xs font-semibold text-brand-light">We&apos;re Here to Help</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
              Get in <span className="gradient-text">Touch</span>
            </h1>
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed">
              Have questions about our AI influencers, custom avatar creation, orders, or enterprise solutions? Send us a message and our team will get back to you promptly.
            </p>
          </motion.div>

          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-start">

            {/* LEFT COLUMN: Contact Information Cards (5 cols) */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-5 space-y-6"
            >
              <div className="glass-card p-6 sm:p-8 space-y-6">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2.5">
                  <MessageSquare size={20} className="text-brand-light" />
                  Contact Information
                </h2>

                <div className="space-y-5">
                  {CONTACT_INFO.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={i} className="flex items-start gap-4 p-3.5 rounded-xl bg-surface/50 border border-border/60 hover:border-brand/30 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand-light flex-shrink-0 mt-0.5">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text-secondary">{item.title}</p>
                          <p className="text-sm font-semibold text-text-primary mt-0.5">{item.detail}</p>
                          <p className="text-xs text-text-secondary/80 mt-1 leading-relaxed">{item.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Helpful Quick Links Card */}
              <div className="glass-card p-6 border-brand/20 bg-gradient-to-br from-brand/5 via-surface/40 to-transparent">
                <div className="flex items-center gap-2 mb-3 text-brand-light font-semibold text-sm">
                  <HelpCircle size={18} />
                  Looking for Something Else?
                </div>
                <ul className="space-y-2.5 text-xs sm:text-sm">
                  <li>
                    <Link
                      href="/custom-avatar/request"
                      className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 hover:bg-background border border-border/60 hover:border-brand/40 text-text-secondary hover:text-text-primary transition-all group"
                    >
                      <span>Request Custom AI Influencer</span>
                      <ArrowRight size={14} className="text-brand-light group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/influencers"
                      className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 hover:bg-background border border-border/60 hover:border-brand/40 text-text-secondary hover:text-text-primary transition-all group"
                    >
                      <span>Browse Available AI Talent</span>
                      <ArrowRight size={14} className="text-brand-light group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/terms"
                      className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 hover:bg-background border border-border/60 hover:border-brand/40 text-text-secondary hover:text-text-primary transition-all group"
                    >
                      <span>Terms &amp; Refund Policy</span>
                      <ArrowRight size={14} className="text-brand-light group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </li>
                </ul>
              </div>
            </motion.div>

            {/* RIGHT COLUMN: Interactive Contact Form (7 cols) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-7"
            >
              <div className="glass-card p-6 sm:p-8 relative">
                {submitted ? (
                  <div className="py-12 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-success/10 border border-success/30 text-success flex items-center justify-center mx-auto animate-bounce">
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-text-primary">Thank You!</h3>
                    <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
                      Your message has been delivered. Our support team is reviewing your query and will reply to your email shortly.
                    </p>
                    <button
                      onClick={() => setSubmitted(false)}
                      className="btn-ghost text-sm py-2 px-6 mt-4 inline-flex items-center gap-2"
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <h2 className="text-xl font-bold text-text-primary mb-1">Send Us a Message</h2>
                      <p className="text-xs sm:text-sm text-text-secondary mb-6">Fill out the form below and we will respond as soon as possible.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-2">
                          Your Full Name <span className="text-brand-light">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Sarah Jenkins"
                          className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-2">
                          Email Address <span className="text-brand-light">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="sarah@company.com"
                          className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-2">
                        Inquiry Topic <span className="text-brand-light">*</span>
                      </label>
                      <select
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                      >
                        {TOPICS.map((item) => (
                          <option key={item} value={item} className="bg-background text-text-primary">
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-2">
                        Your Message <span className="text-brand-light">*</span>
                      </label>
                      <textarea
                        required
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Tell us details about your request, project, or question..."
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full btn-brand py-3.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand/20 disabled:opacity-60 transition-all"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Sending Message...</span>
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          <span>Send Message</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>

          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
