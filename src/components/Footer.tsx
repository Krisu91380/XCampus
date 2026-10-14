'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Shield, Heart, Scale } from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';

export default function Footer() {
  const pathname = usePathname();

  // Hide footer completely on active chat rooms and messages dashboard
  if (pathname?.startsWith('/chat') || pathname === '/messages') {
    return null;
  }
  return (
    <footer className="border-t border-navy-800 bg-navy-950 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                {APP_CONFIG.name}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {APP_CONFIG.tagline} Verified university-to-university student discovery and private chatting platform.
            </p>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-navy-850 border border-navy-750 text-xs text-amber-300">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              Strictly 18+ Adults Only
            </div>
          </div>

          {/* Platform Exploration */}
          <div>
            <h4 className="text-white font-semibold text-xs tracking-wider uppercase mb-4">
              Explore
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/browse" className="hover:text-electric-400 transition-colors">
                  Browse Student Profiles
                </Link>
              </li>
              <li>
                <Link href="/match" className="hover:text-electric-400 transition-colors">
                  University Matchmaker
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-electric-400 transition-colors">
                  Chat Passes & Pricing
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="hover:text-electric-400 transition-colors">
                  How Matching Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Safety & Legal */}
          <div>
            <h4 className="text-white font-semibold text-xs tracking-wider uppercase mb-4">
              Safety & Governance
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/guidelines" className="hover:text-white transition-colors">
                  Community Guidelines
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy & Retention
                </Link>
              </li>
              <li>
                <Link href="/refunds" className="hover:text-white transition-colors">
                  Refund & Credit Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Support & Abuse */}
          <div>
            <h4 className="text-white font-semibold text-xs tracking-wider uppercase mb-4">
              Student Support
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/#faq" className="hover:text-white transition-colors">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <a href="mailto:support@campusconnect.edu" className="hover:text-white transition-colors">
                  Contact Support (support@campusconnect.edu)
                </a>
              </li>
              <li>
                <a href="mailto:safety@campusconnect.edu" className="hover:text-rose-400 transition-colors">
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

        <div className="mt-12 pt-8 border-t border-navy-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {APP_CONFIG.name}. Built with student safety first.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-slate-400">
              <Scale className="w-3.5 h-3.5 text-electric-400" /> Compliant Payment Ledger
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
