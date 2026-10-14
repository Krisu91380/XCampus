'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Coins,
  ShieldCheck,
  CheckCircle,
  History,
  CreditCard,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Loader2,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import PaymentCheckoutModal from '@/components/PaymentCheckoutModal';

function PricingContent() {
  const searchParams = useSearchParams();
  const isRequired = searchParams.get('required') === 'true';

  const [data, setData] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const [authRes, pkgRes, histRes] = await Promise.all([
        fetch('/api/auth/me').then((r) => r.json()),
        fetch('/api/payments/packages').then((r) => r.json()),
        fetch('/api/payments/history').then((r) => r.json()),
      ]);

      if (authRes.authenticated) {
        setData(authRes.user);
      }
      if (pkgRes.success && pkgRes.packages?.length > 0) {
        setPackages(pkgRes.packages);
      } else {
        // Fallback default packages
        setPackages([
          {
            id: 'pkg-1',
            name: 'Campus Explorer',
            credits: 5,
            priceInInr: 29,
            description: '5 Conversation credits. Great starter pack for new connections.',
            isPopular: false,
          },
          {
            id: 'pkg-2',
            name: 'Semester Connector',
            credits: 15,
            priceInInr: 79,
            description: '15 Conversation credits. Best value for active students (₹5.2/chat).',
            isPopular: true,
          },
          {
            id: 'pkg-3',
            name: 'Campus Ultimate',
            credits: 35,
            priceInInr: 149,
            description: '35 Conversation credits. Maximum value across campus networks (₹4.2/chat).',
            isPopular: false,
          },
        ]);
      }
      if (histRes.success) {
        setHistory(histRes);
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBuyNow = (pkg: any) => {
    setSelectedPackage(pkg);
    setIsModalOpen(true);
  };

  const handlePaymentSuccess = (newBalance: number) => {
    if (data) {
      setData({ ...data, credits: newBalance });
    }
    loadData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Required Credit Gate Notice Banner */}
      {isRequired && (
        <div className="p-5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 flex items-start gap-3 shadow-xl shadow-amber-500/5 animate-fade-in">
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h3 className="font-bold text-amber-950 dark:text-white text-sm">
              You need chat credits to start a conversation. Choose a package and complete payment to continue.
            </h3>
            <p className="text-amber-900/80 dark:text-slate-300">
              CC is a premium, verified platform. Select any chat pass below to scan via UPI and begin connecting instantly.
            </p>
          </div>
        </div>
      )}

      {/* 1. Header & Current Balance */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold mb-3">
          <Coins className="w-4 h-4 text-amber-500" />
          <span>Pay Per Connection • Instant Online Checkout</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
          Chat Passes & Credit Packages
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Affordable introductory pricing for Indian university students. Credits never expire and
          are only consumed when a mutual connection is created.
        </p>

        {data && (
          <div className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white dark:bg-navy-850 border border-slate-200 dark:border-navy-750 text-xs text-slate-700 dark:text-slate-200 shadow-sm">
            <span>Your current verified balance:</span>
            <strong className="text-amber-600 dark:text-amber-400 font-mono text-sm">{data.credits ?? 0} Credits</strong>
          </div>
        )}
      </div>

      {/* 2. Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {packages.map((pkg, idx) => (
          <div
            key={pkg.id || idx}
            className={`rounded-3xl p-8 border flex flex-col justify-between relative transition-all ${
              pkg.isPopular
                ? 'bg-white dark:bg-gradient-to-b dark:from-navy-850 dark:to-navy-900 border-2 border-purple-600 shadow-xl shadow-purple-600/15 md:-translate-y-2'
                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-750 shadow-sm'
            }`}
          >
            {pkg.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full bg-purple-600 text-white text-[11px] font-bold tracking-wider uppercase shadow-md">
                Best Student Value
              </div>
            )}

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{pkg.name}</h3>
              <div className="flex items-baseline gap-1 my-4">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-white">₹{pkg.priceInInr}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">one-time payment</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{pkg.description}</p>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 mb-8">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>{pkg.credits} Chat Conversation Credits</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Target LPU or Any Supported University</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Full Gender Preference Filters</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Zero deductions if no match occurs</span>
                </div>
              </div>
            </div>

            {/* Buy Now Button with Payment Gateway Checkout */}
            <button
              type="button"
              onClick={() => handleBuyNow(pkg)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow-lg shadow-purple-600/25 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>Buy Now • ₹{pkg.priceInInr}</span>
            </button>
          </div>
        ))}
      </div>

      {/* 3. Auditable Credit Ledger & History */}
      {history && history.ledger && history.ledger.length > 0 && (
        <div className="rounded-3xl p-6 sm:p-8 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-750 max-w-5xl mx-auto space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-navy-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-purple-600 dark:text-brand-purple" />
              Auditable Credit Ledger & Transaction History
            </h3>
            <span className="text-xs text-slate-500">Immutable ledger records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-navy-800">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Change</th>
                  <th className="py-2.5 px-3">Balance After</th>
                  <th className="py-2.5 px-3">Ref ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-850 font-mono text-[11px]">
                {history.ledger.map((entry: any) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/40">
                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                      {format(new Date(entry.createdAt), 'dd MMM yyyy, hh:mm a')}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          entry.change > 0
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {entry.reason}
                      </span>
                    </td>
                    <td
                      className={`py-2.5 px-3 font-bold ${
                        entry.change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {entry.change > 0 ? `+${entry.change}` : entry.change}
                    </td>
                    <td className="py-2.5 px-3 text-slate-900 dark:text-white font-bold">{entry.balanceAfter}</td>
                    <td className="py-2.5 px-3 text-slate-400 dark:text-slate-500 truncate max-w-[150px]">
                      {entry.referenceId || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Online Payment Gateway Checkout Modal */}
      {selectedPackage && (
        <PaymentCheckoutModal
          packageId={selectedPackage.id}
          packageName={selectedPackage.name}
          priceInInr={selectedPackage.priceInInr}
          credits={selectedPackage.credits}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-purple" />
          <p className="text-xs">Loading pricing packages...</p>
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
