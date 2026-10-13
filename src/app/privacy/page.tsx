import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
          <Lock className="w-7 h-7 text-emerald-400" />
          Privacy Policy & Data Retention
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Designed with data minimization and student safety at its core.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6 sm:p-8 border border-navy-750 space-y-6">
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            1. Data Minimization Principles
          </h2>
          <p>
            We collect only the minimum information necessary to authenticate users, prevent abuse,
            and facilitate student matching. We never display your email address, phone number, physical
            address, or sensitive student ID verification images to other users or search engines.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            2. Private Chat Confidentiality
          </h2>
          <p>
            Private 1-on-1 messages are accessible only to the participants of that specific
            conversation. CampusConnect employees and administrators do not casually browse or monitor
            private student chats. In the event an abuse report is submitted, only the reported
            conversation transcript is accessible through a logged and audited administrative workflow.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            3. Payment Information
          </h2>
          <p>
            Payment transactions are processed by certified PCI-DSS compliant providers (Razorpay).
            CampusConnect never collects, stores, or sees your credit card numbers, debit card details,
            or UPI PINs. We store only the order reference IDs and transaction amounts necessary for our
            auditable credit ledger.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            4. Data Retention & Deletion Rights
          </h2>
          <p>
            You may request complete account deletion at any time by contacting{' '}
            <code className="text-electric-400">privacy@campusconnect.edu</code>. Upon account deletion,
            your profile is scrubbed, and all active matchmaking queue entries are removed immediately.
          </p>
        </section>
      </div>
    </div>
  );
}
