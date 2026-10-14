import type { Metadata } from 'next';
import './globals.css';
import { APP_CONFIG } from '@/lib/config';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import GlobalIncomingCallBanner from '@/components/GlobalIncomingCallBanner';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: `${APP_CONFIG.name} — ${APP_CONFIG.tagline}`,
  description: 'Verified student-to-student social platform. Connect with university students across Lovely Professional University and beyond.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('cc_theme');
                if (t === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-navy-950 dark:text-slate-100 antialiased selection:bg-brand-purple/30 selection:text-white transition-colors duration-150">
        <ThemeProvider>
          <GlobalIncomingCallBanner />
          <Navbar />
          <main className="flex-1 flex flex-col min-h-0">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
