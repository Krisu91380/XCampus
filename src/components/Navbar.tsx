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
  Video,
} from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';
import { ThemeToggle } from '@/components/ThemeProvider';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState<number>(0);

  const fetchAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated) {
        setUser(data.user);
        // Fetch friend requests count
        try {
          const friendRes = await fetch('/api/friends');
          const friendData = await friendRes.json();
          if (friendData.success) {
            setPendingFriendRequestsCount(
              friendData.incomingCount || (friendData.incoming ? friendData.incoming.length : 0)
            );
          }
        } catch {
          //
        }
      } else {
        setUser(null);
        setPendingFriendRequestsCount(0);
      }
    } catch {
      setUser(null);
      setPendingFriendRequestsCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuth();
    const interval = setInterval(fetchAuth, 10000);
    return () => clearInterval(interval);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setPendingFriendRequestsCount(0);
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/90 bg-white/95 dark:border-navy-850 dark:bg-navy-950/90 backdrop-blur-md transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* CC Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-md shadow-purple-600/20 group-hover:scale-105 transition-transform text-white font-black text-base sm:text-lg tracking-wider shrink-0">
            CC
          </div>
          <span className="text-xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-purple-700 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-purple-400 bg-clip-text text-transparent">
            CampusConnect
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link
            href="/browse"
            className={`transition-colors flex items-center gap-1.5 ${
              pathname === '/browse'
                ? 'text-electric-500 dark:text-electric-400 font-semibold'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            Discover Students
          </Link>

          <Link
            href="/pricing"
            className={`transition-colors flex items-center gap-1.5 ${
              pathname === '/pricing'
                ? 'text-electric-500 dark:text-electric-400 font-semibold'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            Passes & Pricing
          </Link>

          {user && (
            <>
              {/* Monkey Room / Match Room */}
              <Link
                href="/match"
                className={`transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                  pathname === '/match'
                    ? 'bg-electric-500/10 border-electric-500/50 text-electric-600 dark:bg-electric-500/20 dark:border-electric-500 dark:text-electric-300'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:border-electric-400 dark:bg-navy-850 dark:border-navy-700 dark:text-slate-200 dark:hover:border-electric-500/50'
                }`}
              >
                <Video className="w-3.5 h-3.5 text-electric-500" />
                Monkey Room
              </Link>

              {/* Messages */}
              <Link
                href="/messages"
                className={`transition-colors flex items-center gap-1.5 ${
                  pathname === '/messages' || pathname.startsWith('/chat')
                    ? 'text-electric-500 dark:text-electric-400 font-bold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Messages</span>
                {pendingFriendRequestsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-electric-500 text-[10px] text-white font-mono font-bold animate-pulse">
                    {pendingFriendRequestsCount}
                  </span>
                )}
              </Link>

              {/* Profile */}
              <Link
                href="/profile"
                className={`transition-colors flex items-center gap-1.5 ${
                  pathname === '/profile'
                    ? 'text-brand-purple font-bold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>Profile</span>
              </Link>

              {/* Admin Panel button */}
              {(user.role === 'ADMIN' || user.role === 'MODERATOR') && (
                <Link
                  href="/admin"
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 hover:bg-amber-500/20"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Admin
                </Link>
              )}
            </>
          )}
        </nav>

        {/* User Status, Theme Switch & Action Controls */}
        <div className="hidden md:flex items-center gap-3">
          {/* Light / Dark Mode Toggle */}
          <ThemeToggle />

          {loading ? (
            <div className="w-24 h-8 bg-slate-200 dark:bg-navy-800/60 animate-pulse rounded-lg" />
          ) : user ? (
            <div className="flex items-center gap-3">
              {/* Credit Balance Pill */}
              <Link
                href="/pricing"
                title="Your Chat Credits balance. Click to buy passes."
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs font-semibold hover:border-amber-400 transition-colors shadow-sm"
              >
                <Coins className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>{user.credits} Credits</span>
              </Link>

              {/* User Identity / Profile / Logout */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-navy-800">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 hover:opacity-85 transition-opacity"
                  title="View and edit your CC profile"
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center text-white text-xs font-bold border border-slate-200 dark:border-navy-700 shrink-0">
                    {user.profile?.avatarUrl ? (
                      <img
                        src={user.profile.avatarUrl}
                        alt={user.profile.displayName || 'Avatar'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (user.profile?.displayName?.[0] || user.email?.[0] || 'S').toUpperCase()
                    )}
                  </div>
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-medium max-w-[110px] truncate">
                    {user.profile?.displayName || user.email}
                  </span>
                </Link>

                {/* Visible Logout Button */}
                <button
                  onClick={handleLogout}
                  title="Sign out of CC"
                  className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-navy-850"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-850 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium px-4 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white shadow-md shadow-brand-purple/20 hover:opacity-95 transition-opacity"
              >
                Join CC (18+)
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu toggle & theme button */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          {user && (
            <Link
              href="/pricing"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300 text-xs font-semibold border border-amber-500/30"
            >
              <Coins className="w-3 h-3 text-amber-500 dark:text-amber-400" />
              <span>{user.credits}</span>
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg focus:outline-none"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 px-4 pt-3 pb-6 space-y-3 shadow-lg">
          <Link
            href="/browse"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-700 dark:text-slate-300 font-medium"
          >
            🧭 Discover Students
          </Link>
          <Link
            href="/pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-700 dark:text-slate-300 font-medium"
          >
            💎 Passes & Pricing
          </Link>
          <Link
            href="/#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-slate-700 dark:text-slate-300 font-medium"
          >
            ℹ️ How CC Works
          </Link>

          {user ? (
            <div className="pt-3 border-t border-slate-200 dark:border-navy-800 space-y-2">
              <Link
                href="/messages"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between py-2 text-electric-600 dark:text-electric-400 font-medium"
              >
                <span>💬 Messages & Chats</span>
                {pendingFriendRequestsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-electric-500 text-[10px] text-white font-mono font-bold">
                    {pendingFriendRequestsCount} new
                  </span>
                )}
              </Link>
              <Link
                href="/match"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-slate-700 dark:text-slate-300 font-medium"
              >
                📹 Monkey Room
              </Link>
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-slate-700 dark:text-slate-300 font-medium"
              >
                👤 My Profile
              </Link>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-brand-purple font-medium"
              >
                📊 Student Dashboard
              </Link>
              {(user.role === 'ADMIN' || user.role === 'MODERATOR') && (
                <div className="pt-2 border-t border-slate-100 dark:border-navy-800/80 space-y-1">
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-amber-600 dark:text-amber-400 font-semibold"
                  >
                    🛡️ Admin Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full text-left py-2 text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Admin Logout
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left py-2 text-rose-500 font-medium flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-slate-200 dark:border-navy-800 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 text-slate-700 dark:text-slate-200 font-medium bg-slate-100 dark:bg-navy-850 rounded-xl"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 text-white font-medium bg-gradient-to-r from-brand-purple to-electric-500 rounded-xl"
              >
                Join CC Free (18+)
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
