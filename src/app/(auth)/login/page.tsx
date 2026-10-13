'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, AlertCircle, Loader2, KeyRound, ArrowRight } from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        body: JSON.stringify({ email, password }),
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
  };

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 p-2.5 rounded-2xl bg-electric-500/15 text-electric-400 mb-4">
          <KeyRound className="w-5 h-5" />
        </div>
        <h1 className="text-3xl font-extrabold text-white">Sign In to {APP_CONFIG.name}</h1>
        <p className="text-xs text-slate-400 mt-2">
          Enter your university or personal email to access your chat dashboard.
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
            <label className="block text-slate-300 font-semibold mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. aarav.sharma@lpu.in"
              className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-electric-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-electric-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold text-sm shadow-xl shadow-brand-purple/25 hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
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

        {/* Demo Fast-Fill Buttons for Instant Evaluation */}
        <div className="mt-8 pt-6 border-t border-navy-800">
          <p className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
            Quick Test Accounts:
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fillDemoAccount('aarav.sharma@lpu.in', 'StudentPass123!')}
              className="w-full p-2 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-750 text-left text-[11px] text-slate-300 flex items-center justify-between"
            >
              <span>👤 Aarav (LPU B.Tech, 5 Credits)</span>
              <span className="text-electric-400 font-mono">Fill</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('priya.patel@lpu.in', 'StudentPass123!')}
              className="w-full p-2 rounded-lg bg-navy-900 hover:bg-navy-850 border border-navy-750 text-left text-[11px] text-slate-300 flex items-center justify-between"
            >
              <span>👤 Priya (LPU MBA, 8 Credits)</span>
              <span className="text-electric-400 font-mono">Fill</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('admin@campusconnect.edu', 'AdminSecurePassword123!')}
              className="w-full p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-left text-[11px] text-amber-300 flex items-center justify-between"
            >
              <span>🛡️ Platform Super Admin</span>
              <span className="text-amber-400 font-mono">Fill</span>
            </button>
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
