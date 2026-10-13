import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Scale, ArrowLeft } from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 text-xs text-slate-300 leading-relaxed">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
          <Scale className="w-7 h-7 text-electric-400" />
          Terms of Service
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Last Updated: October 2026 • Effective for all {APP_CONFIG.name} users.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6 sm:p-8 border border-navy-750 space-y-6">
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            1. Eligibility and 18+ Age Restriction
          </h2>
          <p>
            CampusConnect is strictly restricted to enrolled university students and adults aged 18
            years and older. By registering for an account or using the platform, you represent and
            warrant that you are at least 18 years of age. Any account created with false age claims
            will be immediately terminated without refund.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            2. University Affiliation and Verification
          </h2>
          <p>
            While any adult may create a standard account, full access to university-specific
            discovery and the verified student badge requires verification via official institutional
            email domain (e.g., @lpu.in) or administrator review of official student identification.
            Impersonation of a university student or submission of forged documentation is strictly
            prohibited.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            3. Chat Passes and Credits
          </h2>
          <p>
            CampusConnect utilizes a paid credit model to eliminate spam, automated bots, and bad
            actors. Chat credits are billed in Indian Rupees (INR) via supported payment providers
            such as Razorpay. Credits are consumed atomically when an eligible, consenting conversation
            is successfully matched. Unused credits remain in your account ledger indefinitely until
            consumed.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            4. User Conduct and Prohibited Actions
          </h2>
          <p>
            Users agree not to engage in harassment, stalking, hate speech, distribution of non-consensual
            sexual content, commercial advertising, spamming, extortion, or fraudulent behavior. Users
            must abide by the Community Guidelines at all times.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            5. Termination and Account Suspension
          </h2>
          <p>
            CampusConnect administrators reserve the right to suspend or permanently ban any account
            found violating our rules, without liability or credit restoration, to preserve student safety.
          </p>
        </section>
      </div>
    </div>
  );
}
