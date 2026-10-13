import React from 'react';
import Link from 'next/link';
import { HeartHandshake, ShieldAlert, ArrowLeft } from 'lucide-react';

export default function GuidelinesPage() {
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
          <HeartHandshake className="w-7 h-7 text-brand-purple" />
          Community Guidelines
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Our standards for building a respectful and empowering student network.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6 sm:p-8 border border-navy-750 space-y-6">
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            1. Respect and Mutual Consent
          </h2>
          <p>
            Treat fellow students with dignity. Harassment, sexual coercion, stalking, insults, or
            unsolicited explicit remarks will lead to an immediate ban and revocation of all credits.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            2. Anti-Spam and Commercial Solicitation
          </h2>
          <p>
            CampusConnect is built for genuine peer conversations. Using the platform to promote
            services, sell course notes, distribute affiliate links, or solicit commercial transactions
            is prohibited.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            3. Instant Blocking and Reporting
          </h2>
          <p>
            If you encounter anyone who makes you feel uncomfortable, use the in-chat Block or Report
            buttons immediately. Our safety team acts swiftly on community feedback.
          </p>
        </section>
      </div>
    </div>
  );
}
