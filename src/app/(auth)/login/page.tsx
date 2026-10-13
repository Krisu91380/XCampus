'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, ArrowRight, AlertCircle, Loader2, Eye, EyeOff, User, ShieldCheck } from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid email or password.');
      }

      if (data.user?.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 p-2.5 rounded-2xl bg-electric-500/15 text-electric-400 mb-4">
          <KeyRound className="w-5 h-5" />
        </div>
        <h1 className="text-3xl font-extrabold text-white">Sign In to {APP_CONFIG.name}</h1>
        <p className="text-xs text-slate-400 mt-2">
          Enter your university email or student ID to access your chat dashboard.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6 sm:p-8 border border-navy-750 shadow-2xl">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 mb-6 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Email Address or Student ID
            </label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. aarav.sharma@lpu.in or aarav.sharma"
              className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-electric-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 pr-11 rounded-xl bg-navy-900 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-electric-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg transition-colors focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold text-sm shadow-xl shadow-brand-purple/25 hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Test Accounts with Fill Buttons */}
        <div className="mt-6 pt-6 border-t border-navy-750">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span>Quick Demo Accounts</span>
            <span className="text-[10px] text-electric-400 font-normal">Click Fill to auto-test</span>
          </p>

          <div className="space-y-2">
            <div className="p-2.5 rounded-xl bg-navy-900/90 border border-navy-750 hover:border-navy-700 flex items-center justify-between transition-colors">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-brand-purple shrink-0" />
                  <span className="font-semibold text-white text-xs">Aarav Sharma</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-brand-purple/20 text-brand-purple font-mono">
                    Student (LPU)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                  aarav.sharma@lpu.in
                </p>
              </div>
              <button
                type="button"
                onClick={() => fillDemoAccount('aarav.sharma@lpu.in', 'StudentPass123!')}
                className="px-3 py-1.5 rounded-lg bg-electric-500/20 hover:bg-electric-500/30 text-electric-400 font-bold text-xs transition-colors border border-electric-500/30 shrink-0 cursor-pointer"
              >
                Fill
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-navy-900/90 border border-navy-750 hover:border-navy-700 flex items-center justify-between transition-colors">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span className="font-semibold text-white text-xs">Priya Patel</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-400 font-mono">
                    Student (LPU)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                  priya.patel@lpu.in
                </p>
              </div>
              <button
                type="button"
                onClick={() => fillDemoAccount('priya.patel@lpu.in', 'StudentPass123!')}
                className="px-3 py-1.5 rounded-lg bg-electric-500/20 hover:bg-electric-500/30 text-electric-400 font-bold text-xs transition-colors border border-electric-500/30 shrink-0 cursor-pointer"
              >
                Fill
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 hover:border-amber-500/40 flex items-center justify-between transition-colors">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-semibold text-amber-300 text-xs">Platform Super Admin</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                    Admin
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                  admin@campusconnect.edu
                </p>
              </div>
              <button
                type="button"
                onClick={() => fillDemoAccount('admin@campusconnect.edu', 'AdminSecurePassword123!')}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs transition-colors border border-amber-500/30 shrink-0 cursor-pointer"
              >
                Fill
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          New student?{' '}
          <Link href="/register" className="text-brand-purple hover:underline font-semibold">
            Create an account (18+)
          </Link>
        </div>
      </div>
    </div>
  );
}
