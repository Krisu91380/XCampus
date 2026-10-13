'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sparkles,
  ShieldCheck,
  Coins,
  MessageSquare,
  Compass,
  LayoutDashboard,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  User as UserIcon,
} from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuth();
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-navy-800/80 bg-navy-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center shadow-lg shadow-brand-purple/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-electric-400 bg-clip-text text-transparent">
              {APP_CONFIG.name}
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple border border-brand-purple/20">
              LPU & Universities
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link
            href="/#how-it-works"
            className="text-slate-300 hover:text-white transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="/browse"
            className={`transition-colors flex items-center gap-1.5 ${
              pathname === '/browse' ? 'text-electric-400' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            Browse Students
          </Link>
          <Link
            href="/pricing"
            className={`transition-colors flex items-center gap-1.5 ${
              pathname === '/pricing' ? 'text-electric-400' : 'text-slate-300 hover:text-white'
            }`}
          >
            Pricing
          </Link>
          <Link
            href="/#safety"
            className="text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Safety
          </Link>

          {user && (
            <>
              <Link
                href="/match"
                className={`transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
                  pathname === '/match'
                    ? 'bg-electric-500/20 border-electric-500 text-electric-300'
                    : 'bg-navy-850 border-navy-700 text-slate-200 hover:border-electric-500/50'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-electric-400" />
                Find Match
              </Link>

              <Link
                href="/dashboard"
                className={`transition-colors flex items-center gap-1.5 ${
                  pathname === '/dashboard' ? 'text-brand-purple' : 'text-slate-300 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>

              {(user.role === 'ADMIN' || user.role === 'MODERATOR') && (
                <Link
                  href="/admin"
                  className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 hover:bg-amber-500/20"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Admin
                </Link>
              )}
            </>
          )}
        </nav>

        {/* User Status & Action Controls */}
        <div className="hidden md:flex items-center gap-3">
          {loading ? (
            <div className="w-24 h-8 bg-navy-800/60 animate-pulse rounded-lg" />
          ) : user ? (
            <div className="flex items-center gap-3">
              {/* Credit Balance Pill */}
              <Link
                href="/pricing"
                title="Your Chat Credits balance. Click to buy passes."
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:border-amber-400 transition-colors shadow-sm"
              >
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{user.credits} Credits</span>
              </Link>

              {/* User Identity / Logout */}
              <div className="flex items-center gap-2 pl-2 border-l border-navy-800">
                <span className="text-xs text-slate-300 font-medium max-w-[120px] truncate">
                  {user.profile?.displayName || user.email}
                </span>
                <button
                  onClick={handleLogout}
                  title="Sign out of CampusConnect"
                  className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors rounded-lg hover:bg-navy-850"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-slate-200 hover:text-white px-3 py-1.5 rounded-lg hover:bg-navy-850 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium px-4 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-medium shadow-md shadow-brand-purple/25 hover:opacity-95 transition-opacity"
              >
                Join Free (18+)
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu toggle button */}
        <div className="flex md:hidden items-center gap-2">
          {user && (
            <Link
              href="/pricing"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-semibold border border-amber-500/30"
            >
              <Coins className="w-3 h-3 text-amber-400" />
              <span>{user.credits}</span>
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-navy-800 bg-navy-950 px-4 pt-3 pb-6 space-y-3">
          <Link
            href="/#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-300 font-medium"
          >
            How It Works
          </Link>
          <Link
            href="/browse"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-300 font-medium"
          >
            Browse Students
          </Link>
          <Link
            href="/pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-300 font-medium"
          >
            Pricing & Passes
          </Link>
          <Link
            href="/#safety"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-300 font-medium"
          >
            Safety & Verification
          </Link>

          {user ? (
            <div className="pt-3 border-t border-navy-800 space-y-2">
              <Link
                href="/match"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-electric-400 font-medium"
              >
                ⚡ Matchmaking Room
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-brand-purple font-medium"
              >
                👤 Student Dashboard
              </Link>
              {(user.role === 'ADMIN' || user.role === 'MODERATOR') && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-amber-400 font-medium"
                >
                  🛡️ Admin Dashboard
                </Link>
              )}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left py-2 text-rose-400 font-medium flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-navy-800 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 text-slate-200 font-medium bg-navy-850 rounded-xl"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 text-white font-medium bg-gradient-to-r from-brand-purple to-electric-500 rounded-xl"
              >
                Join Free (18+)
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
