import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <span className="text-xl font-bold">
                Gen<span className="gradient-text">verce</span>
              </span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">
              The future of influence is AI. Hire AI influencers, get
              professional content, instantly.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-4">
              Platform
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/influencers"
                  className="text-sm text-text-secondary hover:text-brand-light transition-colors"
                >
                  Explore Influencers
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-sm text-text-secondary hover:text-brand-light transition-colors"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/signup"
                  className="text-sm text-text-secondary hover:text-brand-light transition-colors"
                >
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-4">
              Legal
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-text-secondary hover:text-brand-light transition-colors"
                >
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-text-secondary hover:text-brand-light transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/refund-policy"
                  className="text-sm text-text-secondary hover:text-brand-light transition-colors"
                >
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-4">
              Contact
            </h4>
            <ul className="space-y-2">
              <li className="text-sm text-text-secondary">
                support@genverce.ai
              </li>
              <li className="text-sm text-text-secondary">
                Available 24/7
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-secondary">
            &copy; {new Date().getFullYear()} Genverce. All rights reserved. All
            influencers on this platform are AI-generated.
          </p>
          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <span>Powered by</span>
            <span className="gradient-text font-semibold">AI</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
