'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, AlertTriangle } from 'lucide-react';

const ERROR_MESSAGES: Record<string, { title: string; message: string; warning?: boolean }> = {
  google_not_configured: {
    title: 'Google Sign-In Not Configured',
    message: 'Google OAuth is not configured yet. The administrator must add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the environment variables.',
    warning: true,
  },
  cancelled: {
    title: 'Sign-In Cancelled',
    message: 'Google sign-in was cancelled. You can try again or use your email and password.',
  },
  invalid_state: {
    title: 'Session Expired',
    message: 'The sign-in request expired or security validation failed. Please click "Continue with Google" again.',
  },
  token_exchange_failed: {
    title: 'Authentication Error',
    message: 'Could not complete token exchange with Google. Please verify your Google Cloud OAuth client credentials.',
  },
  email_not_verified: {
    title: 'Unverified Email',
    message: 'Your Google email address is not verified by Google. Please verify your email with Google first.',
  },
  suspended: {
    title: 'Account Suspended',
    message: 'This account has been suspended by administration. Please contact support.',
  },
  failed: {
    title: 'Sign-In Failed',
    message: 'An error occurred during Google authentication. Please try again or use email and password.',
  },
};

export function OAuthErrorBanner() {
  const searchParams = useSearchParams();
  const errorKey = searchParams.get('error');

  if (!errorKey || !ERROR_MESSAGES[errorKey]) {
    return null;
  }

  const { title, message, warning } = ERROR_MESSAGES[errorKey];

  return (
    <div
      className={`p-4 rounded-xl border text-xs flex items-start gap-3 mb-6 animate-fade-in ${
        warning
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
      }`}
    >
      {warning ? (
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
      ) : (
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
      )}
      <div className="space-y-0.5">
        <p className="font-semibold text-white">{title}</p>
        <p className="leading-relaxed opacity-90">{message}</p>
      </div>
    </div>
  );
}
