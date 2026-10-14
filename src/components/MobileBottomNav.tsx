'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Video, MessageCircle, User as UserIcon } from 'lucide-react';

export default function MobileBottomNav() {
  const pathname = usePathname();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isChatOpenOnMobile, setIsChatOpenOnMobile] = useState<boolean>(false);

  useEffect(() => {
    // Check cached avatar
    try {
      const cachedAvatar = localStorage.getItem('campusconnect_avatar');
      if (cachedAvatar) setAvatarUrl(cachedAvatar);
    } catch {}

    // Check user & avatar
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.user?.profile?.avatarUrl) {
          setAvatarUrl(data.user.profile.avatarUrl);
        }
      })
      .catch(() => {});

    // Check unread count
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

  // Also hide if messages page has an individual conversation actively open on mobile
  if (pathname === '/messages' && isChatOpenOnMobile) {
    return null;
  }

  const navItems = [
    {
      label: 'Home',
      href: '/',
      icon: Home,
      isActive: pathname === '/',
    },
    {
      label: 'Discover',
      href: '/browse',
      icon: Search,
      isActive: pathname === '/browse',
    },
    {
      label: 'Monkey Room',
      href: '/match',
      icon: Video,
      isActive: pathname === '/match',
    },
    {
      label: 'Messages',
      href: '/messages',
      icon: MessageCircle,
      isActive: pathname === '/messages',
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      label: 'Profile',
      href: '/profile',
      icon: UserIcon,
      isActive: pathname === '/profile',
      isAvatar: true,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-navy-950/95 backdrop-blur-lg border-t border-slate-200 dark:border-navy-800 pb-[env(safe-area-inset-bottom)] shadow-lg transition-transform duration-200"
    >
      <div className="flex items-center justify-around h-14 px-2 max-w-md mx-auto">
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
                    item.isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
                  }`}
                />
              )}

              {/* Active Indicator Dot */}
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
