'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, ShieldAlert, X, Loader2 } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />,
          iconBg: 'bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900/40',
          confirmBtn:
            'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-500/20 focus:ring-red-500',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
          iconBg: 'bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/40',
          confirmBtn:
            'bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-500/20 focus:ring-amber-500',
        };
      case 'primary':
      default:
        return {
          icon: <ShieldAlert className="w-6 h-6 text-purple-600 dark:text-purple-400" />,
          iconBg: 'bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-900/40',
          confirmBtn:
            'bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20 focus:ring-purple-500',
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => {
        if (!isLoading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl shrink-0 ${vStyles.iconBg}`}>
            {vStyles.icon}
          </div>
          <div className="flex-1 pr-6">
            <h3
              id="confirm-dialog-title"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
            >
              {title}
            </h3>
            <div className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={async () => {
              await onConfirm();
            }}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 flex items-center gap-2 ${vStyles.confirmBtn}`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
