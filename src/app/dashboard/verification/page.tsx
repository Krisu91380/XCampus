'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Upload,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

export default function StudentVerificationPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [universities, setUniversities] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [docType, setDocType] = useState<'INSTITUTION_EMAIL' | 'ID_CARD'>('INSTITUTION_EMAIL');
  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [idCardUrl, setIdCardUrl] = useState('');
  const [selectedUniId, setSelectedUniId] = useState('');

  const loadData = async () => {
    try {
      const [authRes, uniRes, verRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/universities'),
        fetch('/api/verification'),
      ]);

      const authData = await authRes.json();
      if (!authData.authenticated) {
        router.push('/login');
        return;
      }
      setUser(authData.user);

      const uniData = await uniRes.json();
      if (uniData.success) {
        setUniversities(uniData.universities);
        setSelectedUniId(authData.user?.university?.id || uniData.universities[0]?.id || '');
      }

      const verData = await verRes.json();
      if (verData.success) {
        setVerifications(verData.verifications);
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universityId: selectedUniId,
          documentType: docType,
          institutionalEmail: docType === 'INSTITUTION_EMAIL' ? institutionalEmail : undefined,
          idCardUrl: docType === 'ID_CARD' ? idCardUrl : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit verification');
      }

      setMessage({ text: data.message, type: 'success' });
      await loadData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-purple" />
        <p className="text-xs">Loading verification portal...</p>
      </div>
    );
  }

  const isAlreadyVerified = user?.role === 'VERIFIED_STUDENT';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-emerald-400" />
          University Student Verification
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Verify your student identity to earn the verified badge, increase match trust, and protect
          the campus network.
        </p>
      </div>

      {isAlreadyVerified ? (
        <div className="glass-card rounded-2xl p-8 border border-emerald-500/40 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Your Account is Officially Verified!</h2>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            You hold an active <strong className="text-emerald-400">Verified Student</strong> status
            for {user?.university?.name || 'Lovely Professional University'}. Your badge appears on
            all chats and discovery profiles.
          </p>
          <div className="pt-2">
            <Link
              href="/match"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white text-xs font-bold shadow-md shadow-brand-purple/20"
            >
              Start Chatting Now
            </Link>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-6 sm:p-8 border border-navy-750 space-y-6">
          {message && (
            <div
              className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Verification Method Tabs */}
          <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-navy-900 border border-navy-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setDocType('INSTITUTION_EMAIL')}
              className={`py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all ${
                docType === 'INSTITUTION_EMAIL'
                  ? 'bg-brand-purple text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Official University Email</span>
            </button>
            <button
              type="button"
              onClick={() => setDocType('ID_CARD')}
              className={`py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all ${
                docType === 'ID_CARD'
                  ? 'bg-brand-purple text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Upload Student ID Proof</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Target University
              </label>
              <select
                value={selectedUniId}
                onChange={(e) => setSelectedUniId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white focus:outline-none focus:border-brand-purple"
              >
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>

            {docType === 'INSTITUTION_EMAIL' ? (
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Official Institutional Email (e.g. @lpu.in)
                </label>
                <input
                  type="email"
                  required
                  value={institutionalEmail}
                  onChange={(e) => setInstitutionalEmail(e.target.value)}
                  placeholder="student.name@lpu.in"
                  className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Domains matching university records (e.g. lpu.in, du.ac.in) are verified instantly.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Student ID Card Image URL or Secure Document Link
                </label>
                <input
                  type="url"
                  required
                  value={idCardUrl}
                  onChange={(e) => setIdCardUrl(e.target.value)}
                  placeholder="https://... (secure image or storage link)"
                  className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Private & secure: Only administrators can view this image in the moderation queue.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold shadow-lg shadow-brand-purple/25 hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Evidence...</span>
                </>
              ) : (
                <span>Submit Verification</span>
              )}
            </button>
          </form>

          {/* Verification History */}
          {verifications.length > 0 && (
            <div className="pt-6 border-t border-navy-800">
              <h4 className="text-xs font-bold text-white mb-3">Submitted Verification Requests</h4>
              <div className="space-y-2">
                {verifications.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl bg-navy-900 border border-navy-800 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-200">
                        {v.documentType === 'INSTITUTION_EMAIL'
                          ? `Email: ${v.institutionalEmail}`
                          : 'Uploaded Student ID Document'}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        v.status === 'APPROVED'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : v.status === 'REJECTED'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
