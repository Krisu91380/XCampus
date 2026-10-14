'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Coins, Video, MessageSquare, User as UserIcon } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isChatOpenOnMobile, setIsChatOpenOnMobile] = useState<boolean>(false);

  useEffect(() => {
    try {
      const cachedAvatar = localStorage.getItem('campusconnect_avatar');
      if (cachedAvatar) setAvatarUrl(cachedAvatar);
    } catch {}

    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.user?.profile?.avatarUrl) {
          setAvatarUrl(data.user.profile.avatarUrl);
        }
      })
      .catch(() => {});

    fetch('/api/friends')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.incoming)) {
          setUnreadCount(data.incoming.length);
        }
      })
      .catch(() => {});
  }, [pathname]);

  // Listen to mobile chat view open/close
  useEffect(() => {
    const handleMobileChatState = (e: any) => {
      setIsChatOpenOnMobile(Boolean(e.detail?.isOpen));
    };

    window.addEventListener('cc_mobile_chat_open', handleMobileChatState);
    return () => {
      window.removeEventListener('cc_mobile_chat_open', handleMobileChatState);
    };
  }, []);

  // Hide bottom nav inside full-screen video call or active individual chat room
  if (pathname.startsWith('/chat/')) {
    return null;
  }

  // Hide if messages page has an individual conversation actively open on mobile
  if (pathname === '/messages' && isChatOpenOnMobile) {
    return null;
  }

  const navItems = [
    {
      label: 'Discover Students',
      shortLabel: 'Discover',
      href: '/browse',
      icon: Compass,
      isActive: pathname === '/browse',
    },
    {
      label: 'Passes & Pricing',
      shortLabel: 'Pricing',
      href: '/pricing',
      icon: Coins,
      isActive: pathname === '/pricing',
    },
    {
      label: 'Monkey Room',
      shortLabel: 'Monkey Room',
      href: '/match',
      icon: Video,
      isActive: pathname === '/match',
    },
    {
      label: 'Messages',
      shortLabel: 'Messages',
      href: '/messages',
      icon: MessageSquare,
      isActive: pathname === '/messages',
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      label: 'Profile',
      shortLabel: 'Profile',
      href: '/profile',
      icon: UserIcon,
      isActive: pathname === '/profile',
      isAvatar: true,
    },
  ];

  return (
    <nav
      aria-label="Primary Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-navy-950/95 backdrop-blur-lg border-t border-slate-200 dark:border-navy-800 pb-[env(safe-area-inset-bottom)] shadow-lg transition-all"
    >
      {/* Desktop / Laptop / Tablet Bar (md and up) */}
      <div className="hidden md:flex items-center justify-around h-16 max-w-4xl mx-auto px-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all cursor-pointer relative ${
                item.isActive
                  ? 'text-brand-purple dark:text-electric-400 font-bold bg-purple-50/90 dark:bg-navy-850 border border-purple-200/80 dark:border-navy-700 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-navy-900 font-medium'
              }`}
              title={item.label}
            >
              {item.isAvatar && avatarUrl ? (
                <div
                  className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-all shrink-0 ${
                    item.isActive
                      ? 'border-brand-purple ring-2 ring-brand-purple/20'
                      : 'border-slate-300 dark:border-navy-700'
                  }`}
                >
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    item.isActive ? 'stroke-[2.4] text-brand-purple dark:text-electric-400' : 'stroke-[1.8]'
                  }`}
                />
              )}
              <span className="text-xs tracking-tight">{item.label}</span>

              {item.badge && item.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-brand-purple text-white font-mono font-bold text-[10px] leading-tight shadow-xs">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Mobile Bar (below md, touch-friendly iOS experience) */}
      <div className="flex md:hidden items-center justify-around h-14 px-2 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center w-14 h-full relative transition-colors ${
                item.isActive
                  ? 'text-slate-950 dark:text-white'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              title={item.label}
            >
              {item.isAvatar && avatarUrl ? (
                <div
                  className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-all ${
                    item.isActive
                      ? 'border-brand-purple ring-2 ring-brand-purple/20 scale-105'
                      : 'border-slate-300 dark:border-navy-700'
                  }`}
                >
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <Icon
                  className={`w-6 h-6 transition-transform ${
                    item.isActive ? 'scale-110 stroke-[2.4] text-brand-purple dark:text-electric-400' : 'stroke-[1.8]'
                  }`}
                />
              )}

              {/* Active Indicator Dot on mobile */}
              {item.isActive && !item.isAvatar && (
                <span className="w-1 h-1 rounded-full bg-brand-purple mt-0.5" />
              )}

              {/* Badge for unread items */}
              {item.badge && item.badge > 0 && (
                <span className="absolute top-2 right-2.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono font-bold text-[9px] leading-tight">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
