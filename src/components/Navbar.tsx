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
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-md shadow-purple-600/20 group-hover:scale-105 transition-transform text-white font-black text-base sm:text-lg tracking-wider shrink-0">
            CC
          </div>
          <span className="text-xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-purple-700 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-purple-400 bg-clip-text text-transparent">
            CampusConnect
          </span>
        </Link>

        {/* Primary Horizontal Navigation Row (Desktop Only: md and up) */}
        <nav aria-label="Desktop Primary Navigation" className="hidden md:flex items-center gap-1 lg:gap-2">
          {[
            { label: 'Discover Students', href: '/browse', icon: Compass },
            { label: 'Passes & Pricing', href: '/pricing', icon: Coins },
            {
              label: 'Messages',
              href: '/messages',
              icon: MessageSquare,
              badge: pendingFriendRequestsCount > 0 ? pendingFriendRequestsCount : undefined,
            },
            { label: 'Profile', href: '/profile', icon: UserIcon },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all relative ${
                  isActive
                    ? 'text-brand-purple dark:text-electric-400 bg-purple-50/90 dark:bg-navy-850 font-bold border border-purple-200/80 dark:border-navy-700 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-navy-850'
                }`}
                title={item.label}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-brand-purple dark:text-electric-400 stroke-[2.2]' : 'text-slate-500 dark:text-slate-400 stroke-[1.8]'
                  }`}
                />
                <span className="tracking-tight">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-brand-purple text-white font-mono font-bold text-[10px] leading-tight shadow-xs">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Status, Theme Switch & Secondary Action Controls (Desktop) */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs font-semibold hover:border-amber-400 transition-colors shadow-xs"
              >
                <Coins className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>{user.credits} Credits</span>
              </Link>

              {/* Admin Panel button */}
              {(user.role === 'ADMIN' || user.role === 'MODERATOR') && (
                <Link
                  href="/admin"
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 hover:bg-amber-500/20"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </Link>
              )}

              {/* User Identity / Profile / Logout */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-navy-800">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 hover:opacity-85 transition-opacity"
                  title="View and edit your CC profile"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-navy-800 flex items-center justify-center text-slate-800 dark:text-slate-100 text-xs font-bold border border-slate-300 dark:border-navy-700 shrink-0">
                    {user.profile?.avatarUrl ? (
                      <img
                        src={user.profile.avatarUrl}
                        alt={user.profile.displayName || 'Avatar'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    {(user.profile?.displayName?.[0] || user.email?.[0] || 'S').toUpperCase()}
                  </div>
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold max-w-[120px] truncate">
                    {user.profile?.displayName || user.email}
                  </span>
                </Link>

                {/* Visible Logout Button */}
                <button
                  onClick={handleLogout}
                  title="Sign out of CC"
                  className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-navy-850 cursor-pointer"
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

        {/* Mobile Top Header Controls */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/pricing"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300 text-xs font-semibold border border-amber-500/30"
                title="Credits"
              >
                <Coins className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>{user.credits}</span>
              </Link>

              <Link
                href="/profile"
                className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 dark:bg-navy-800 flex items-center justify-center text-slate-800 dark:text-slate-100 text-xs font-bold border border-slate-300 dark:border-navy-700 shrink-0"
              >
                {user.profile?.avatarUrl ? (
                  <img
                    src={user.profile.avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}
                {(user.profile?.displayName?.[0] || user.email?.[0] || 'S').toUpperCase()}
              </Link>

              <button
                onClick={handleLogout}
                title="Sign out of CC"
                className="p-1 text-slate-400 hover:text-rose-500"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-brand-purple text-white shadow-xs"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>

    </header>
  );
}
