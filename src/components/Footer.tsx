'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Scale } from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';

export default function Footer() {
  const pathname = usePathname();

  // Hide footer completely on active chat rooms and messages dashboard
  if (pathname?.startsWith('/chat') || pathname === '/messages') {
    return null;
  }

  return (
    <footer className="border-t border-slate-200 dark:border-navy-850 bg-slate-100/90 dark:bg-navy-950 text-slate-600 dark:text-slate-400 text-sm transition-colors duration-150 pb-20 md:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
                CC
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                CC
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {APP_CONFIG.tagline} Verified university student discovery and social messaging platform.
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              Strictly 18+ Adults Only
            </div>
          </div>

          {/* Platform Exploration */}
          <div>
            <h4 className="text-slate-900 dark:text-white font-semibold text-xs tracking-wider uppercase mb-4">
              Explore CC
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/browse" className="hover:text-electric-500 dark:hover:text-electric-400 transition-colors">
                  Discover Students
                </Link>
              </li>
              <li>
                <Link href="/match" className="hover:text-electric-500 dark:hover:text-electric-400 transition-colors">
                  Monkey Room
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-electric-500 dark:hover:text-electric-400 transition-colors">
                  Passes & Pricing
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="hover:text-electric-500 dark:hover:text-electric-400 transition-colors">
                  How CC Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Safety & Legal */}
          <div>
            <h4 className="text-slate-900 dark:text-white font-semibold text-xs tracking-wider uppercase mb-4">
              Safety & Governance
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/guidelines" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Community Guidelines
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Privacy Policy & Retention
                </Link>
              </li>
              <li>
                <Link href="/refunds" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Refund & Credit Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-slate-900 dark:text-white font-semibold text-xs tracking-wider uppercase mb-4">
              Student Support
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <a href="mailto:support@x-campus.edu" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                  Contact Support (support@x-campus.edu)
                </a>
              </li>
              <li>
                <a href="mailto:safety@x-campus.edu" className="hover:text-rose-500 transition-colors">
                  Report Abuse & Safety Concerns
                </a>
              </li>
              <li>
                <span className="text-xs text-slate-500">
                  Targeted at Lovely Professional University & Indian higher-ed.
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-navy-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} CC. Built with student safety first.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Scale className="w-3.5 h-3.5 text-electric-500 dark:text-electric-400" /> Compliant Payment Ledger
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
