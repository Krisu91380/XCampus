'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Shield, AlertCircle, CheckCircle2, Loader2, ArrowRight, Eye, EyeOff, Coins } from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';

export default function RegisterPage() {
  const router = useRouter();
  const [universities, setUniversities] = useState<any[]>([]);
  const [loadingUnis, setLoadingUnis] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    dateOfBirth: '',
    universityId: '',
    gender: 'PREFER_NOT_TO_SAY',
    course: '',
    academicYear: '1st Year',
    bio: '',
    termsAccepted: false,
  });

  const [tagInput, setTagInput] = useState('');
  const [interests, setInterests] = useState<string[]>(['Coding', 'Campus Life']);

  useEffect(() => {
    fetch('/api/universities')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUniversities(data.universities);
          if (data.universities.length > 0) {
            // Default to LPU if present
            const lpu = data.universities.find((u: any) => u.code === 'LPU');
            setFormData((prev) => ({
              ...prev,
              universityId: lpu ? lpu.id : data.universities[0].id,
            }));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingUnis(false));
  }, []);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !interests.includes(val) && interests.length < 8) {
        setInterests([...interests, val]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tag: string) => {
    setInterests(interests.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.termsAccepted) {
      setErrorMessage('You must accept the Terms of Service and 18+ eligibility requirement.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          email: formData.email.trim(),
          displayName: formData.displayName.trim(),
          interests,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          const firstError = Object.values(data.errors)[0] as string[];
          throw new Error(firstError?.[0] || 'Validation error');
        }
        throw new Error(data.message || 'Registration failed');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 p-2.5 rounded-2xl bg-brand-purple/15 text-brand-purple mb-4">
          <Sparkles className="w-5 h-5" />
        </div>
        <h1 className="text-3xl font-extrabold text-white">Join {APP_CONFIG.name}</h1>
        <p className="text-xs text-slate-400 mt-2">
          Strictly for university students aged 18 and older. Get 5 free chat credits upon sign-up.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6 sm:p-8 border border-navy-750 shadow-2xl">
        {/* Welcome Bonus Callout */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-brand-purple/15 to-electric-500/15 border border-amber-500/30 flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <p className="font-bold text-amber-300">Welcome Bonus: 5 Free Credits</p>
            <p className="text-[11px] text-slate-300">Every new student account starts with 5 free chat passes automatically!</p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 mb-6 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Display Name */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Display Name / Preferred Name *
            </label>
            <input
              type="text"
              required
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="e.g. Aarav Sharma"
              className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Email Address (University or Personal) *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. student@lpu.in or name@gmail.com"
              className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple transition-colors"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Tip: Using your institutional @lpu.in email grants instant verified student status!
            </p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Secure Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Min 8 characters, 1 uppercase, 1 number"
                className="w-full px-4 py-2.5 pr-11 rounded-xl bg-navy-900 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg transition-colors focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Date of Birth (Age Gate 18+) */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
              <span>Date of Birth (Must be 18+) *</span>
              <span className="text-[10px] text-amber-400 font-medium">Adults Only</span>
            </label>
            <input
              type="date"
              required
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple transition-colors"
            />
          </div>

          {/* University Selection */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Your University *
            </label>
            {loadingUnis ? (
              <div className="h-10 bg-navy-900 animate-pulse rounded-xl" />
            ) : (
              <select
                value={formData.universityId}
                onChange={(e) => setFormData({ ...formData, universityId: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white focus:outline-none focus:border-brand-purple transition-colors"
              >
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Gender & Academic Year */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Gender (For Partner Preferences)
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white focus:outline-none focus:border-brand-purple transition-colors"
              >
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                <option value="MALE">Male (Boy)</option>
                <option value="FEMALE">Female (Girl)</option>
                <option value="NON_BINARY">Non-Binary</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Academic Year
              </label>
              <select
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white focus:outline-none focus:border-brand-purple transition-colors"
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="Postgraduate">Postgraduate</option>
              </select>
            </div>
          </div>

          {/* Course */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Course / Major (Optional)
            </label>
            <input
              type="text"
              value={formData.course}
              onChange={(e) => setFormData({ ...formData, course: e.target.value })}
              placeholder="e.g. B.Tech Computer Science, MBA, BA Economics"
              className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple transition-colors"
            />
          </div>

          {/* Interests Tags */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Interests & Hobbies (Press Enter to add)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {interests.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg bg-brand-purple/20 border border-brand-purple/30 text-brand-purple font-medium flex items-center gap-1"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-rose-400 ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add interest tag (e.g. Gaming, Hackathons, Music)..."
              className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple transition-colors"
            />
          </div>

          {/* Terms Agreement */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={formData.termsAccepted}
                onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                className="mt-0.5 rounded border-navy-700 bg-navy-900 text-brand-purple focus:ring-brand-purple"
              />
              <span className="text-[11px] text-slate-400 leading-relaxed">
                I certify that I am at least 18 years old and a current university student. I accept the{' '}
                <Link href="/terms" className="text-electric-400 underline" target="_blank">
                  Terms of Service
                </Link>
                ,{' '}
                <Link href="/privacy" className="text-electric-400 underline" target="_blank">
                  Privacy Policy
                </Link>
                , and agree to abide by the{' '}
                <Link href="/guidelines" className="text-electric-400 underline" target="_blank">
                  Community Guidelines
                </Link>
                .
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 text-white font-bold text-sm shadow-xl shadow-brand-purple/25 hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Complete Registration & Claim 5 Free Credits</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-navy-800 text-center text-xs text-slate-400">
          Already registered?{' '}
          <Link href="/login" className="text-electric-400 hover:underline font-semibold">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
}
