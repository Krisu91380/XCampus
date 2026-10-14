'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Heart,
  Lock,
  AtSign,
  UserCheck,
  User,
  Mail,
  GraduationCap,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  ShieldCheck,
  Coins,
  Users,
  Camera,
  Trash2,
  Edit3,
  Globe,
  Github,
  Linkedin,
  Instagram,
  Twitter,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  X,
  Save,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeProvider';

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [credits, setCredits] = useState<number>(0);
  const [friendsCount, setFriendsCount] = useState<number>(0);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Form Fields
  const [editForm, setEditForm] = useState({
    displayName: '',
    username: '',
    relationshipStatus: 'Single',
    relationshipVisible: false,
    gender: 'PREFER_NOT_TO_SAY',
    bio: '',
    course: '',
    branch: '',
    academicYear: '',
    semester: '',
    language: 'English',
    interestsInput: '',
    skillsInput: '',
    github: '',
    linkedin: '',
    instagram: '',
    twitter: '',
    website: '',
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchProfileData = async () => {
    try {
      const [profileRes, authRes, friendsRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/auth/me'),
        fetch('/api/friends'),
      ]);

      const profileData = await profileRes.json();
      const authData = await authRes.json();
      const friendsData = await friendsRes.json();

      if (!profileRes.ok || !profileData.success) {
        if (profileRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(profileData.message || 'Failed to load profile');
      }

      const p = profileData.profile;
      setProfile(p);

      if (p?.avatarUrl) {
        try {
          localStorage.setItem('campusconnect_avatar_' + p.userId, p.avatarUrl);
          localStorage.setItem('campusconnect_avatar', p.avatarUrl);
        } catch {}
      }

      if (authData.authenticated && authData.user) {
        setCredits(authData.user.credits || 0);
      }
      if (friendsData.success && Array.isArray(friendsData.friends)) {
        setFriendsCount(friendsData.friends.length);
        setFriendsList(friendsData.friends);
      }

      // Initialize edit form
      setEditForm({
        displayName: p.displayName || '',
        username: p.username || (p.email ? p.email.split('@')[0] : ''),
        relationshipStatus: p.relationshipStatus || 'Single',
        relationshipVisible: Boolean(p.relationshipVisible),
        gender: p.gender || 'PREFER_NOT_TO_SAY',
        bio: p.bio || '',
        course: p.course || '',
        branch: p.branch || '',
        academicYear: p.academicYear || '',
        semester: p.semester || '',
        language: p.language || 'English',
        interestsInput: Array.isArray(p.interests) ? p.interests.join(', ') : '',
        skillsInput: Array.isArray(p.skills) ? p.skills.join(', ') : '',
        github: p.socialLinks?.github || '',
        linkedin: p.socialLinks?.linkedin || '',
        instagram: p.socialLinks?.instagram || '',
        twitter: p.socialLinks?.twitter || '',
        website: p.socialLinks?.website || '',
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error loading profile.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file (JPEG, PNG, WebP).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image file size must be less than 5MB.' });
      return;
    }

    const previousAvatar = profile?.avatarUrl;
    // Show instant local preview while uploading
    const previewUrl = URL.createObjectURL(file);
    setProfile((prev: any) => ({ ...prev, avatarUrl: previewUrl }));

    setUploadingPhoto(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch('/api/profile/photo', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to upload photo');
      }

      setProfile((prev: any) => ({ ...prev, avatarUrl: data.avatarUrl }));
      try {
        if (profile?.userId) {
          localStorage.setItem('campusconnect_avatar_' + profile.userId, data.avatarUrl);
        }
        localStorage.setItem('campusconnect_avatar', data.avatarUrl);
      } catch {}
      setMessage({ type: 'success', text: 'Profile photo updated successfully!' });
    } catch (err: any) {
      setProfile((prev: any) => ({ ...prev, avatarUrl: previousAvatar }));
      setMessage({ type: 'error', text: err.message || 'Failed to upload photo.' });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!confirm('Are you sure you want to remove your profile photo?')) return;
    setUploadingPhoto(true);
    setMessage(null);

    try {
      const res = await fetch('/api/profile/photo', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove photo');
      }

      setProfile((prev: any) => ({ ...prev, avatarUrl: null }));
      try {
        if (profile?.userId) {
          localStorage.removeItem('campusconnect_avatar_' + profile.userId);
        }
        localStorage.removeItem('campusconnect_avatar');
      } catch {}
      setMessage({ type: 'success', text: 'Profile photo removed.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to remove photo.' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.displayName.trim() || editForm.displayName.trim().length < 2) {
      setMessage({ type: 'error', text: 'Full name must be at least 2 characters.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        displayName: editForm.displayName.trim(),
        username: editForm.username.trim(),
        relationshipStatus: editForm.relationshipStatus,
        relationshipVisible: editForm.relationshipVisible,
        gender: editForm.gender,
        bio: editForm.bio.trim(),
        course: editForm.course.trim(),
        branch: editForm.branch.trim(),
        academicYear: editForm.academicYear.trim(),
        semester: editForm.semester.trim(),
        language: editForm.language.trim(),
        interests: editForm.interestsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        skills: editForm.skillsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        socialLinks: {
          github: editForm.github.trim(),
          linkedin: editForm.linkedin.trim(),
          instagram: editForm.instagram.trim(),
          twitter: editForm.twitter.trim(),
          website: editForm.website.trim(),
          relationshipStatus: editForm.relationshipStatus,
          relationshipVisible: editForm.relationshipVisible,
          username: editForm.username.trim(),
        },
      };

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update profile');
      }

      setProfile((prev: any) => ({
        ...prev,
        ...data.profile,
        displayName: editForm.displayName.trim(),
        username: editForm.username.trim(),
        relationshipStatus: editForm.relationshipStatus,
        relationshipVisible: editForm.relationshipVisible,
        bio: editForm.bio.trim(),
        course: editForm.course.trim(),
        branch: editForm.branch.trim(),
        academicYear: editForm.academicYear.trim(),
        semester: editForm.semester.trim(),
        interests: payload.interests,
        skills: payload.skills,
        socialLinks: payload.socialLinks,
      }));
      setIsEditModalOpen(false);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-brand-purple" />
        <p className="text-xs">Loading student profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between shadow-sm transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="p-1 hover:opacity-80 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Profile Header Card */}
      <div className="bg-white dark:bg-navy-900 rounded-3xl border border-slate-200 dark:border-navy-800 shadow-sm relative overflow-hidden">
        {/* Cover Banner */}
        <div className="h-32 sm:h-44 w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-800 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px] opacity-70" />
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <ThemeToggle className="bg-white/20 hover:bg-white/30 text-white border-white/20 backdrop-blur-md" />
            <div className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>CC Verified Campus</span>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0 relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 -mt-16 sm:-mt-20">
            {/* Circular Profile Avatar Container */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-white dark:border-navy-900 bg-slate-100 dark:bg-navy-800 shadow-xl relative flex items-center justify-center">
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.displayName || 'Profile Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-3xl sm:text-4xl shadow-inner select-none">
                    {profile?.displayName?.[0]?.toUpperCase() || 'S'}
                  </div>
                )}

                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-xs">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  </div>
                )}
              </div>

              {/* Photo Action Buttons */}
              <div className="flex items-center justify-center gap-2 mt-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-750 border border-slate-300 dark:border-navy-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer active:scale-95"
                  title="Change Profile Photo"
                >
                  <Camera className="w-3.5 h-3.5 text-brand-purple" />
                  <span>{profile?.avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
                </button>

                {profile?.avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={uploadingPhoto}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 border border-slate-300 dark:border-navy-700 text-slate-500 dark:text-slate-400 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                    title="Remove Profile Photo"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                )}
              </div>
            </div>

            {/* Student Overview Details */}
            <div className="flex-1 text-center md:text-left space-y-3 pt-2 w-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {profile?.displayName}
                    </h1>
                    {profile?.isVerified && (
                      <span
                        title="Verified University Student"
                        className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Verified</span>
                      </span>
                    )}
                    {profile?.relationshipVisible && profile?.relationshipStatus && (
                      <span
                        className="px-2.5 py-0.5 rounded-full bg-pink-50 dark:bg-pink-500/15 border border-pink-200 dark:border-pink-500/30 text-pink-700 dark:text-pink-300 text-xs font-semibold flex items-center gap-1"
                        title="Relationship Status"
                      >
                        <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500/30" />
                        <span>{profile.relationshipStatus}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-2.5 mt-1">
                    <span className="text-xs font-bold text-brand-purple dark:text-electric-400 font-mono">
                      @{profile?.username || profile?.email?.split('@')[0]}
                    </span>
                    <span className="text-slate-400 dark:text-slate-600 text-xs">•</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>{profile?.email}</span>
                    </p>
                  </div>
                </div>

                {/* Edit Profile Button */}
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 transition-all cursor-pointer self-center md:self-auto"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
              </div>

              {/* University & Degree Badges */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1 text-xs">
                <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-750 flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-medium">
                  <GraduationCap className="w-4 h-4 text-brand-purple shrink-0" />
                  <span>{profile?.universityName || 'University Student'}</span>
                </span>

                {profile?.course && (
                  <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-750 flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>{profile?.course}</span>
                  </span>
                )}

                {profile?.branch && (
                  <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-750 flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{profile?.branch}</span>
                  </span>
                )}

                {(profile?.academicYear || profile?.semester) && (
                  <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-750 flex items-center gap-1.5 font-mono text-slate-600 dark:text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {[profile?.academicYear, profile?.semester].filter(Boolean).join(' • ')}
                    </span>
                  </span>
                )}
              </div>

              {/* Bio Content */}
              {profile?.bio ? (
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 pt-1 leading-relaxed max-w-2xl">
                  {profile.bio}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic pt-1">
                  No bio added yet. Click &quot;Edit Profile&quot; to introduce yourself to campus peers!
                </p>
              )}

              {/* Social Links Row */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
                {profile?.socialLinks?.github && (
                  <a
                    href={
                      profile.socialLinks.github.startsWith('http')
                        ? profile.socialLinks.github
                        : `https://github.com/${profile.socialLinks.github}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-750 border border-slate-200 dark:border-navy-750 text-slate-700 dark:text-slate-300 transition-colors"
                    title="GitHub Profile"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                )}
                {profile?.socialLinks?.linkedin && (
                  <a
                    href={
                      profile.socialLinks.linkedin.startsWith('http')
                        ? profile.socialLinks.linkedin
                        : `https://linkedin.com/in/${profile.socialLinks.linkedin}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-750 border border-slate-200 dark:border-navy-750 text-slate-700 dark:text-slate-300 transition-colors"
                    title="LinkedIn Profile"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                )}
                {profile?.socialLinks?.instagram && (
                  <a
                    href={
                      profile.socialLinks.instagram.startsWith('http')
                        ? profile.socialLinks.instagram
                        : `https://instagram.com/${profile.socialLinks.instagram.replace('@', '')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-750 border border-slate-200 dark:border-navy-750 text-slate-700 dark:text-slate-300 transition-colors"
                    title="Instagram Profile"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {profile?.socialLinks?.twitter && (
                  <a
                    href={
                      profile.socialLinks.twitter.startsWith('http')
                        ? profile.socialLinks.twitter
                        : `https://x.com/${profile.socialLinks.twitter.replace('@', '')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-750 border border-slate-200 dark:border-navy-750 text-slate-700 dark:text-slate-300 transition-colors"
                    title="Twitter / X Profile"
                  >
                    <Twitter className="w-4 h-4" />
                  </a>
                )}
                {profile?.socialLinks?.website && (
                  <a
                    href={
                      profile.socialLinks.website.startsWith('http')
                        ? profile.socialLinks.website
                        : `https://${profile.socialLinks.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-750 border border-slate-200 dark:border-navy-750 text-slate-700 dark:text-slate-300 transition-colors"
                    title="Personal Portfolio / Website"
                  >
                    <Globe className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-6 mt-6 border-t border-slate-200 dark:border-navy-800">
            <Link
              href="/pricing"
              className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-850 border border-slate-200 dark:border-navy-800 hover:border-amber-400/50 transition-colors flex items-center gap-3 group"
            >
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Chat Credits</p>
                <p className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                  <span>{credits}</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Add More →</span>
                </p>
              </div>
            </Link>

            <button
              onClick={() => setShowFriendsModal(true)}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-850 border border-slate-200 dark:border-navy-800 hover:border-indigo-400/50 transition-colors flex items-center gap-3 group text-left cursor-pointer"
            >
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Campus Friends</p>
                <p className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                  <span>{friendsCount}</span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">View Connections →</span>
                </p>
              </div>
            </button>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-850 border border-slate-200 dark:border-navy-800 flex items-center gap-3 col-span-2 sm:col-span-1">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Account Status</p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {profile?.isVerified ? 'Verified Student' : 'Standard Student'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Skills & Interests Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Academic Skills */}
        <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-purple" />
              <span>Skills & Technologies</span>
            </h3>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
              {profile?.skills?.length || 0} Listed
            </span>
          </div>

          {Array.isArray(profile?.skills) && profile.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill: string, idx: number) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-purple-700 dark:text-purple-300 text-xs font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              No skills added yet. Add skills like Python, React, CAD, UI/UX in Edit Profile.
            </p>
          )}
        </div>

        {/* Campus Interests */}
        <div className="bg-white dark:bg-navy-900 rounded-3xl p-6 border border-slate-200 dark:border-navy-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Hobbies & Campus Interests</span>
            </h3>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
              {profile?.interests?.length || 0} Listed
            </span>
          </div>

          {Array.isArray(profile?.interests) && profile.interests.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((interest: string, idx: number) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium"
                >
                  {interest}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              No interests added yet. Add topics like Hackathons, Music, Football, Photography.
            </p>
          )}
        </div>
      </div>

      {/* Friends Modal */}
      {showFriendsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-navy-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-navy-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-purple" />
                <h3 className="text-sm font-bold">Campus Friends ({friendsCount})</h3>
              </div>
              <button
                onClick={() => setShowFriendsModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2.5">
              {friendsList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <p>No campus friends yet. Browse student profiles or use Match Room to connect!</p>
                </div>
              ) : (
                friendsList.map((f: any) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {f.avatarUrl ? (
                        <img
                          src={f.avatarUrl}
                          alt={f.displayName}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-navy-700 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-purple to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {f.displayName?.[0] || 'S'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate text-slate-900 dark:text-white">{f.displayName}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{f.universityName || 'Student'}</p>
                      </div>
                    </div>
                    <Link
                      href="/messages"
                      className="px-3 py-1.5 rounded-xl bg-brand-purple text-white text-[11px] font-semibold hover:opacity-95"
                    >
                      Chat
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Interactive Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-navy-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-navy-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-brand-purple" />
                <h3 className="text-lg font-bold">Edit Student Profile</h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              {/* Full Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-750 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white focus:outline-none focus:border-brand-purple"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Username / Handle</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">@</span>
                    <input
                      type="text"
                      placeholder="username"
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value.replace(/^@/, '') })}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-750 text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:bg-white focus:outline-none focus:border-brand-purple"
                    />
                  </div>
                </div>
              </div>

              {/* Gender & Relationship Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Gender</label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-750 text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:border-brand-purple"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="NON_BINARY">Non-Binary</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Relationship Status</label>
                  <select
                    value={editForm.relationshipStatus}
                    onChange={(e) => setEditForm({ ...editForm, relationshipStatus: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-750 text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:border-brand-purple"
                  >
                    <option value="Single">Single</option>
                    <option value="Committed">Committed</option>
                    <option value="Non-committed">Non-committed</option>
                  </select>
                  <label className="mt-2 flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={editForm.relationshipVisible}
                      onChange={(e) => setEditForm({ ...editForm, relationshipVisible: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-purple border-slate-300 dark:border-navy-750 focus:ring-0"
                    />
                    <span className="text-[11px]">Show relationship status on public profile</span>
                  </label>
                </div>
              </div>

              {/* Course & Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Degree / Course</label>
                  <input
                    type="text"
                    placeholder="e.g. B.Tech Computer Science"
                    value={editForm.course}
                    onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-750 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white focus:outline-none focus:border-brand-purple"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Branch / Specialization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AI & Data Science"
                    value={editForm.branch}
                    onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-750 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white focus:outline-none focus:border-brand-purple"
                  />
                </div>
              </div>

              {/* Year & Semester */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Academic Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 3rd Year"
                    value={editForm.academicYear}
                    onChange={(e) => setEditForm({ ...editForm, academicYear: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-750 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white focus:outline-none focus:border-brand-purple"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Semester</label>
                  <input
                    type="text"
                    placeholder="e.g. 5th Semester"
                    value={editForm.semester}
                    onChange={(e) => setEditForm({ ...editForm, semester: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-750 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white focus:outline-none focus:border-brand-purple"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Bio (Max 500 characters)
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Tell campus peers about yourself, what you study, projects you are building..."
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-750 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white focus:outline-none focus:border-brand-purple"
                />
                <span className="text-[10px] text-slate-400 text-right block mt-0.5">
                  {editForm.bio.length} / 500
                </span>
              </div>

              {/* Skills & Interests Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Skills (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. React, Python, Figma, DSA"
                    value={editForm.skillsInput}
                    onChange={(e) => setEditForm({ ...editForm, skillsInput: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-750 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white focus:outline-none focus:border-brand-purple"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Interests / Hobbies (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hackathons, Robotics, Music"
                    value={editForm.interestsInput}
                    onChange={(e) => setEditForm({ ...editForm, interestsInput: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-navy-750 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white focus:outline-none focus:border-brand-purple"
                  />
                </div>
              </div>

              {/* Social Profiles */}
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-navy-800">
                <label className="block text-slate-700 dark:text-slate-300 font-semibold">Social Links (Optional)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-navy-950 px-3 py-2 rounded-xl border border-slate-300 dark:border-navy-750">
                    <Github className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="GitHub username"
                      value={editForm.github}
                      onChange={(e) => setEditForm({ ...editForm, github: e.target.value })}
                      className="w-full bg-transparent text-slate-900 dark:text-white focus:outline-none text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-navy-950 px-3 py-2 rounded-xl border border-slate-300 dark:border-navy-750">
                    <Linkedin className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="LinkedIn username"
                      value={editForm.linkedin}
                      onChange={(e) => setEditForm({ ...editForm, linkedin: e.target.value })}
                      className="w-full bg-transparent text-slate-900 dark:text-white focus:outline-none text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-navy-950 px-3 py-2 rounded-xl border border-slate-300 dark:border-navy-750">
                    <Instagram className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Instagram @handle"
                      value={editForm.instagram}
                      onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                      className="w-full bg-transparent text-slate-900 dark:text-white focus:outline-none text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-navy-950 px-3 py-2 rounded-xl border border-slate-300 dark:border-navy-750">
                    <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Portfolio / Website URL"
                      value={editForm.website}
                      onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                      className="w-full bg-transparent text-slate-900 dark:text-white focus:outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-navy-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-navy-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold flex items-center gap-2 shadow-md shadow-purple-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
