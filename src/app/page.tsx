'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ShieldCheck,
  Coins,
  ArrowRight,
  GraduationCap,
  MessageSquare,
  Lock,
  ChevronDown,
  CheckCircle,
  Users,
  Compass,
  Star,
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
      q: 'How does university matching work on CampusConnect?',
      a: 'You can choose to match with students from your own university (like Lovely Professional University) or explore specific partner universities across India. You set your partner preferences (boys, girls, or everyone) and conversation topics. Our atomic matchmaking engine pairs you with an active, consenting peer.',
    },
    {
      q: 'How does the paid chat credits system work?',
      a: 'To maintain high quality, respect, and eliminate spam bots, conversations require chat credits (e.g. ₹9 for 1 credit or ₹29 for 5 credits). A credit is only deducted once a mutual, eligible conversation is successfully created. If no partner is found or you cancel, zero credits are consumed.',
    },
    {
      q: 'Is this platform strictly for students aged 18 and older?',
      a: 'Yes. CampusConnect is strictly restricted to adults aged 18 and above. Age confirmation is required during registration, and student ID or university email verification is enforced before full verified access is granted.',
    },
    {
      q: 'What universities are currently supported?',
      a: 'We initially target Lovely Professional University (LPU), alongside Delhi University (DU), VIT, and BITS Pilani. Our extensible architecture allows additional Indian and global universities to be added continuously by administrators.',
    },
    {
      q: 'Is my personal contact information or phone number exposed?',
      a: 'Never. Only your chosen display name, university badge, course, and public interests are visible. Your phone number, email address, physical location, and sensitive verification documents are never displayed to conversation partners.',
    },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Ambient Radial Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] radial-glow pointer-events-none" />

      {/* 1. HERO SECTION */}
      <section className="relative pt-20 pb-24 md:pt-32 md:pb-36 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-purple/10 border border-brand-purple/30 text-brand-purple text-xs font-semibold mb-8 animate-fade-in">
          <Sparkles className="w-4 h-4 text-brand-purple" />
          <span>The Premier Student Chat Network • Initially Launching for LPU</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
          Meet Students Beyond{' '}
          <span className="bg-gradient-to-r from-brand-purple via-electric-400 to-brand-cyan bg-clip-text text-transparent">
            Your Campus.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300 mb-10 leading-relaxed">
          Discover, match, and chat 1-on-1 with verified university students from Lovely
          Professional University and top campuses across India. Filter by university, gender
          preference, course, and interests.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Link
            href="/match"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-semibold flex items-center justify-center gap-2.5 shadow-xl shadow-brand-purple/25 hover:scale-[1.02] transition-transform"
          >
            <span>Find Your Campus</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-navy-850 hover:bg-navy-800 text-slate-200 font-semibold border border-navy-700 transition-colors flex items-center justify-center"
          >
            How It Works
          </a>
        </div>

        {/* Hero Preview Card Visual */}
        <div className="mt-16 relative max-w-4xl mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-brand-purple to-electric-500 rounded-3xl blur-xl opacity-20" />
          <div className="relative rounded-2xl border border-navy-750 bg-navy-900/90 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-navy-800 text-left">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs text-slate-400 font-mono ml-2">
                  Live Matchmaking Room • CampusConnect v1.0
                </span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Students Online
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="p-4 rounded-xl bg-navy-850 border border-navy-750">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-purple mb-2">
                  <GraduationCap className="w-4 h-4" /> Lovely Professional University
                </div>
                <h4 className="text-sm font-bold text-white mb-1">Aarav S. • B.Tech CSE</h4>
                <p className="text-xs text-slate-400">
                  "Hackathons, distributed systems, tech debates"
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> ID Verified Student
                </div>
              </div>

              <div className="p-4 rounded-xl bg-navy-850 border border-electric-500/40 relative">
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] bg-electric-500/20 text-electric-300 font-bold">
                  MATCHING
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-electric-400 mb-2">
                  <GraduationCap className="w-4 h-4" /> Delhi University
                </div>
                <h4 className="text-sm font-bold text-white mb-1">Rohan V. • Economics</h4>
                <p className="text-xs text-slate-400">
                  "Geopolitics, photography, fintech trends"
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> ID Verified Student
                </div>
              </div>

              <div className="p-4 rounded-xl bg-navy-850 border border-navy-750">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-purple mb-2">
                  <GraduationCap className="w-4 h-4" /> LPU (Lovely Professional)
                </div>
                <h4 className="text-sm font-bold text-white mb-1">Priya P. • MBA</h4>
                <p className="text-xs text-slate-400">
                  "Product design, marketing, indie music"
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> ID Verified Student
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS (3-STEP EXPLANATION) */}
      <section id="how-it-works" className="py-20 bg-navy-900/60 border-y border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-electric-400 mb-2">
              Simple & Transparent
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">
              Connect In Three Simple Steps
            </h3>
            <p className="text-sm text-slate-400 mt-3">
              Designed specifically for verified university students seeking genuine connections.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-card p-8 rounded-2xl relative">
              <div className="w-12 h-12 rounded-xl bg-brand-purple/20 border border-brand-purple/40 text-brand-purple flex items-center justify-center font-bold text-xl mb-6">
                1
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Verify Your University</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sign up with your university email or submit student ID verification. We verify that
                every member is an adult student aged 18+.
              </p>
            </div>

            <div className="glass-card p-8 rounded-2xl relative">
              <div className="w-12 h-12 rounded-xl bg-electric-500/20 border border-electric-500/40 text-electric-400 flex items-center justify-center font-bold text-xl mb-6">
                2
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Select Your Partner Filters</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose whether you want to chat with students from LPU or another university. Select
                preferred partner gender (boys, girls, or everyone) and interests.
              </p>
            </div>

            <div className="glass-card p-8 rounded-2xl relative">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xl mb-6">
                3
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Real-Time Private Chat</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Use an affordable chat credit (from ₹4.9) to establish a private real-time session.
                No spam bots, full safety moderation, and instant blocking controls.
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
            <h3 className="text-3xl font-extrabold text-white">
              Supported Universities
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Initially targeted at Lovely Professional University, with more campuses onboarded weekly.
            </p>
          </div>
          <Link
            href="/browse"
            className="mt-4 md:mt-0 text-sm font-semibold text-electric-400 hover:text-electric-300 flex items-center gap-1.5"
          >
            Browse all student profiles <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {APP_CONFIG.initialUniversities.map((uni) => (
            <div
              key={uni.code}
              className={`p-6 rounded-2xl border transition-all ${
                uni.code === 'LPU'
                  ? 'bg-gradient-to-b from-navy-850 to-navy-900 border-brand-purple/50 shadow-lg shadow-brand-purple/10'
                  : 'bg-navy-900/80 border-navy-800 hover:border-navy-700'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold px-2 py-1 rounded bg-navy-800 text-slate-200">
                  {uni.code}
                </span>
                {uni.code === 'LPU' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple border border-brand-purple/40">
                    Primary Campus
                  </span>
                )}
              </div>
              <h4 className="text-base font-bold text-white mb-1">{uni.name}</h4>
              <p className="text-xs text-slate-400 mb-4">{uni.city}, {uni.state}</p>
              <div className="text-[11px] text-slate-500 pt-3 border-t border-navy-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Verified Student Email
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. PRICING & CHAT PASSES */}
      <section id="pricing" className="py-20 bg-navy-900/50 border-y border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
              Transparent Pricing
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">
              Affordable Student Chat Passes
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Introductory pricing in Indian Rupees (₹). Credits are deducted atomically only when an
              active match is created. Unused credits never expire.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {APP_CONFIG.initialCreditPackages.map((pkg, idx) => (
              <div
                key={idx}
                className={`rounded-2xl p-8 border flex flex-col justify-between relative transition-all ${
                  pkg.isPopular
                    ? 'bg-navy-850 border-brand-purple shadow-xl shadow-brand-purple/20 md:-translate-y-2'
                    : 'bg-navy-900 border-navy-800'
                }`}
              >
                {pkg.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand-purple text-white text-[11px] font-bold tracking-wider uppercase">
                    Most Popular
                  </div>
                )}
                <div>
                  <h4 className="text-lg font-bold text-white mb-2">{pkg.name}</h4>
                  <div className="flex items-baseline gap-1 my-4">
                    <span className="text-4xl font-extrabold text-white">₹{pkg.priceInInr}</span>
                    <span className="text-xs text-slate-400">one-time pass</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">{pkg.description}</p>
                  <div className="space-y-2.5 text-xs text-slate-300 mb-8">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>{pkg.credits} Eligible Conversation Credits</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Full Gender & University Filtering</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>No deductions if no match found</span>
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
          <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-4">
            Safety Built Into the Core Architecture
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            CampusConnect is engineered from day one to protect student identity and prevent
            harassment, impersonation, and underage access.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800">
            <Lock className="w-6 h-6 text-brand-purple mb-4" />
            <h4 className="text-base font-bold text-white mb-2">18+ Adults Only</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Strict server-side validation rejects any underage sign-ups. High school and minors
              are not permitted on CampusConnect.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800">
            <Users className="w-6 h-6 text-electric-400 mb-4" />
            <h4 className="text-base font-bold text-white mb-2">Consent-Driven Discovery</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Students control their visibility settings. You can hide your profile from the browse
              page anytime or only engage in matching when ready.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800">
            <ShieldCheck className="w-6 h-6 text-emerald-400 mb-4" />
            <h4 className="text-base font-bold text-white mb-2">Instant Block & Report</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every chat window includes immediate one-click block and report tools. Reported chats
              are reviewed under strict administrative moderation.
            </p>
          </div>
        </div>
      </section>

      {/* 6. FAQ ACCORDION */}
      <section id="faq" className="py-20 bg-navy-900/60 border-t border-navy-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-white text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-navy-800 bg-navy-900 overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left flex items-center justify-between text-sm font-semibold text-white hover:text-electric-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      openFaq === idx ? 'rotate-180 text-electric-400' : 'text-slate-400'
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="p-5 pt-0 text-xs text-slate-400 leading-relaxed border-t border-navy-800/60">
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
        <div className="rounded-3xl bg-gradient-to-tr from-brand-purple/20 via-navy-850 to-electric-500/20 border border-brand-purple/30 p-12 relative overflow-hidden">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Ready to Connect Across Campus?
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto mb-8">
            Join Lovely Professional University and partner students today. Initial registration
            includes 2 complimentary introductory chat credits.
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
