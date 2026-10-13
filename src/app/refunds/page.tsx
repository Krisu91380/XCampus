import React from 'react';
import Link from 'next/link';
import { Coins, CheckCircle, ArrowLeft } from 'lucide-react';

export default function RefundsPage() {
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
          <Coins className="w-7 h-7 text-amber-400" />
          Refund & Credit Restoration Policy
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Fair, transparent rules protecting student chat passes.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6 sm:p-8 border border-navy-750 space-y-6">
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            1. Zero-Charge Matchmaking Guarantee
          </h2>
          <p>
            You are never charged for searching. A credit is deducted from your balance atomically only
            when an eligible, compatible conversation with a live student partner is created. If you
            cancel your search or if no match is available, exactly 0 credits are deducted.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            2. Automatic Credit Restoration
          </h2>
          <p>
            If a conversation partner terminates the chat within the first 60 seconds without exchanging
            meaningful messages, or if an account is reported and suspended by moderators for bad faith,
            your conversation credit is restored back to your account ledger upon review.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            3. Financial Payment Refunds
          </h2>
          <p>
            If you purchased a chat pass via Razorpay and experienced a technical gateway error where
            money was debited from your bank but credits were not reflected, please contact{' '}
            <code className="text-electric-400">payments@campusconnect.edu</code> with your Razorpay
            Payment ID. Confirmed duplicate transactions are refunded back to the original payment source
            within 5-7 business days.
          </p>
        </section>
      </div>
    </div>
  );
}
