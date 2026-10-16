'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ShieldCheck,
  ArrowRight,
  GraduationCap,
  Lock,
  ChevronDown,
  CheckCircle,
  Users,
  Compass,
  Video,
  MessageSquare,
} from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';
import RazorpayButton from '@/components/RazorpayButton';

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const faqs = [
    {
      q: 'How does CC student networking work?',
      a: 'CC allows you to discover, connect, and chat 1-on-1 with verified students from Lovely Professional University and partner campuses across India. You can browse detailed student profiles, send friend requests, exchange messages, and start video calls directly with your friends.',
    },
    {
      q: 'How does 1-on-1 video calling work on CC?',
      a: 'CampusConnect provides end-to-end WebRTC video and audio calls with friends directly in your browser, with low-latency media streams, camera toggles, and mute controls.',
    },
    {
      q: 'How does the chat passes system work?',
      a: 'To maintain high quality, respect, and eliminate spam bots, starting new connection sessions uses credits (e.g. ₹29 for 5 credits). Once friends are connected, regular messaging remains free and persistent.',
    },
    {
      q: 'Is this platform strictly for students aged 18 and older?',
      a: 'Yes. CC is strictly restricted to verified adults aged 18 and above. Age confirmation is required during registration, and student institutional credentials are verified before full access is granted.',
    },
    {
      q: 'Is my personal contact information or phone number exposed?',
      a: 'Never. Only your chosen display name, username, university badge, course, and public profile details are visible. Your phone number, institutional email, and sensitive verification documents are never exposed.',
    },
  ];

  return (
    <div className="relative overflow-hidden transition-colors duration-150">
      {/* Ambient Radial Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] radial-glow pointer-events-none" />

      {/* 1. HERO SECTION */}
      <section className="relative pt-16 pb-20 md:pt-28 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-purple/10 border border-brand-purple/30 text-brand-purple text-xs font-semibold mb-6 animate-fade-in">
          <Sparkles className="w-4 h-4 text-brand-purple" />
          <span>The Verified Student Social Network • Launching for LPU & Top Campuses</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.1]">
          Connect Across Campuses on{' '}
          <span className="bg-gradient-to-r from-brand-purple via-electric-500 to-brand-cyan bg-clip-text text-transparent">
            CC.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-slate-300 mb-10 leading-relaxed">
          The verified social platform built for university students. Discover peers, chat in real-time,
          share projects, and hop into 1-on-1 video calls with students from Lovely Professional University and beyond.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Link
            href="/browse"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-semibold flex items-center justify-center gap-2.5 shadow-xl shadow-brand-purple/20 hover:scale-[1.02] transition-transform"
          >
            <Compass className="w-5 h-5" />
            <span>Discover Students</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/messages"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white dark:bg-navy-850 hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-200 dark:border-navy-700 transition-colors flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4 text-electric-500" />
            <span>Direct Messages</span>
          </Link>
        </div>

        {/* Hero Preview Card Visual */}
        <div className="mt-14 relative max-w-4xl mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-brand-purple to-electric-500 rounded-3xl blur-xl opacity-20" />
          <div className="relative rounded-2xl border border-slate-200 dark:border-navy-750 bg-white/95 dark:bg-navy-900/90 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 dark:border-navy-800 text-left">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono ml-2">
                  Social Discovery & Messaging • CC v2.0
                </span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Verified Students
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-850 border border-slate-200 dark:border-navy-750">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-purple mb-2">
                  <GraduationCap className="w-4 h-4" /> Lovely Professional University
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Aarav S. • B.Tech CSE</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  &ldquo;Hackathons, distributed systems, tech debates&rdquo;
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> ID Verified Student
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-850 border border-electric-500/40 relative">
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] bg-electric-500/20 text-electric-600 dark:text-electric-300 font-bold">
                  ACTIVE
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-electric-600 dark:text-electric-400 mb-2">
                  <GraduationCap className="w-4 h-4" /> Delhi University
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Rohan V. • Economics</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  &ldquo;Geopolitics, photography, fintech trends&rdquo;
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> ID Verified Student
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-850 border border-slate-200 dark:border-navy-750">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-purple mb-2">
                  <GraduationCap className="w-4 h-4" /> LPU (Lovely Professional)
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Priya P. • MBA</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  &ldquo;Product design, marketing, indie music&rdquo;
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> ID Verified Student
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS (3-STEP EXPLANATION) */}
      <section id="how-it-works" className="py-20 bg-slate-100/70 dark:bg-navy-900/60 border-y border-slate-200 dark:border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-electric-600 dark:text-electric-400 mb-2">
              Simple & Authentic
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Connect In Three Simple Steps
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
              Engineered for verified university students seeking meaningful peer networking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-card p-8 rounded-2xl relative">
              <div className="w-12 h-12 rounded-xl bg-brand-purple/10 border border-brand-purple/30 text-brand-purple flex items-center justify-center font-bold text-xl mb-6">
                1
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Verify Your Student Status</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Sign up with your university email or submit student credentials. Every member is verified
                to ensure a safe community of peers aged 18+.
              </p>
            </div>

            <div className="glass-card p-8 rounded-2xl relative">
              <div className="w-12 h-12 rounded-xl bg-electric-500/10 border border-electric-500/30 text-electric-600 dark:text-electric-400 flex items-center justify-center font-bold text-xl mb-6">
                2
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Discover & Add Friends</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Explore student profiles filtered by course, interests, and campus. Send friend requests
                and grow your academic and social network.
              </p>
            </div>

            <div className="glass-card p-8 rounded-2xl relative">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xl mb-6">
                3
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Chat & Video Calls</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Enjoy fast, persistent messaging with read receipts and jump into high-definition 1-on-1 video calls
                with accepted friends.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. UNIVERSITY DISCOVERY SECTION */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-brand-purple mb-2">
              Campus Directory
            </h2>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              Supported Universities
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Initially targeted at Lovely Professional University, with more campuses onboarded continuously.
            </p>
          </div>
          <Link
            href="/browse"
            className="mt-4 md:mt-0 text-sm font-semibold text-electric-600 dark:text-electric-400 hover:underline flex items-center gap-1.5"
          >
            Explore all student profiles <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {APP_CONFIG.initialUniversities.map((uni) => (
            <div
              key={uni.code}
              className={`p-6 rounded-2xl border transition-all ${
                uni.code === 'LPU'
                  ? 'bg-gradient-to-b from-brand-purple/5 to-white dark:from-navy-850 dark:to-navy-900 border-brand-purple/40 shadow-sm'
                  : 'bg-white dark:bg-navy-900/80 border-slate-200 dark:border-navy-800 hover:border-slate-300 dark:hover:border-navy-700'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200">
                  {uni.code}
                </span>
                {uni.code === 'LPU' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple border border-brand-purple/30">
                    Primary Campus
                  </span>
                )}
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">{uni.name}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{uni.city}, {uni.state}</p>
              <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-100 dark:border-navy-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Verified Student Access
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. PRICING & CHAT PASSES */}
      <section id="pricing" className="py-20 bg-slate-100/70 dark:bg-navy-900/50 border-y border-slate-200 dark:border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-2">
              Transparent Pricing
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Affordable Student Passes
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Introductory pricing in Indian Rupees (₹). Credits are consumed only when an eligible session
              is established. Unused credits never expire.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {APP_CONFIG.initialCreditPackages.map((pkg, idx) => (
              <div
                key={idx}
                className={`rounded-2xl p-8 border flex flex-col justify-between relative transition-all ${
                  pkg.isPopular
                    ? 'bg-white dark:bg-navy-850 border-brand-purple shadow-xl shadow-brand-purple/10 md:-translate-y-2'
                    : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-800'
                }`}
              >
                {pkg.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand-purple text-white text-[11px] font-bold tracking-wider uppercase">
                    Most Popular
                  </div>
                )}
                <div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{pkg.name}</h4>
                  <div className="flex items-baseline gap-1 my-4">
                    <span className="text-4xl font-extrabold text-slate-900 dark:text-white">₹{pkg.priceInInr}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">one-time pass</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{pkg.description}</p>
                  <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 mb-8">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>{pkg.credits} Eligible Conversation Credits</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>Full Campus & Academic Filtering</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>No deductions if session unfulfilled</span>
                    </div>
                  </div>
                </div>

                <RazorpayButton
                  packageId={`pkg-${idx + 1}`}
                  packageName={pkg.name}
                  priceInInr={pkg.priceInInr}
                  credits={pkg.credits}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. SAFETY & PRIVACY SECTION */}
      <section id="safety" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-4">
            Safety Built Into CC Core
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            CC is engineered to protect student identity and prevent harassment, impersonation,
            and unauthorized access.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800">
            <Lock className="w-6 h-6 text-brand-purple mb-4" />
            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">18+ Adults Only</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Strict server-side validation enforces adult access. Minors are not permitted on CC.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800">
            <Users className="w-6 h-6 text-electric-500 mb-4" />
            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">Consent-Driven Discovery</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Students control their visibility settings. You can hide your profile from public discovery
              at any time.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800">
            <ShieldCheck className="w-6 h-6 text-emerald-500 mb-4" />
            <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">Instant Block & Report</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Every chat window includes immediate one-click block and report tools under active moderation.
            </p>
          </div>
        </div>
      </section>

      {/* 6. FAQ ACCORDION */}
      <section id="faq" className="py-20 bg-slate-100/70 dark:bg-navy-900/60 border-t border-slate-200 dark:border-navy-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-white hover:text-electric-500 dark:hover:text-electric-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      openFaq === idx ? 'rotate-180 text-electric-500' : 'text-slate-400'
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="p-5 pt-0 text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-navy-800/60">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. BOTTOM CTA */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="rounded-3xl bg-gradient-to-tr from-brand-purple/10 via-white to-electric-500/10 dark:from-brand-purple/20 dark:via-navy-850 dark:to-electric-500/20 border border-brand-purple/30 p-12 relative overflow-hidden shadow-lg">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mb-4">
            Ready to Connect on CC?
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto mb-8">
            Join Lovely Professional University and partner students today. Free sign-up includes
            complimentary introductory credits.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold shadow-xl shadow-brand-purple/30 hover:scale-105 transition-transform"
          >
            <span>Create Student Account</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
