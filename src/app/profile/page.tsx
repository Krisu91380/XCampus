'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
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

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [credits, setCredits] = useState<number>(0);
  const [friendsCount, setFriendsCount] = useState<number>(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Form Fields
  const [editForm, setEditForm] = useState({
    displayName: '',
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

      setProfile(profileData.profile);
      if (authData.authenticated && authData.user) {
        setCredits(authData.user.credits || 0);
      }
      if (friendsData.success && Array.isArray(friendsData.friends)) {
        setFriendsCount(friendsData.friends.length);
      }

      // Initialize edit form
      const p = profileData.profile;
      setEditForm({
        displayName: p.displayName || '',
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
      setMessage({ type: 'success', text: 'Profile photo updated successfully!' });
    } catch (err: any) {
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

      setProfile(data.profile);
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
      <div className="max-w-4xl mx-auto px-4 py-24 text-center text-slate-400">
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
          className={`p-4 rounded-2xl text-xs flex items-center justify-between shadow-md transition-all ${
            message.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="p-1 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Profile Header Card */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-navy-750 relative overflow-hidden shadow-2xl">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/4 right-1/4 h-1 bg-gradient-to-r from-brand-purple via-electric-400 to-brand-purple opacity-80" />

        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
          {/* Avatar with Upload Control */}
          <div className="relative group shrink-0">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border-2 border-brand-purple/40 bg-navy-900 shadow-xl relative flex items-center justify-center">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-brand-purple to-electric-500 flex items-center justify-center text-white font-extrabold text-4xl shadow-inner">
                  {profile?.displayName?.[0] || 'S'}
                </div>
              )}

              {uploadingPhoto && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              )}
            </div>

            {/* Photo Action Overlay / Pill */}
            <div className="flex items-center justify-center gap-2 mt-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="px-2.5 py-1 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                title="Change Profile Photo"
              >
                <Camera className="w-3.5 h-3.5 text-electric-400" />
                <span>Upload</span>
              </button>

              {profile?.avatarUrl && (
                <button
                  onClick={handleRemovePhoto}
                  disabled={uploadingPhoto}
                  className="p-1 rounded-xl bg-navy-850 hover:bg-rose-950/50 hover:text-rose-400 border border-navy-700 text-slate-400 transition-colors cursor-pointer"
                  title="Remove Profile Photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Student Overview Info */}
          <div className="flex-1 text-center md:text-left space-y-2.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                    {profile?.displayName}
                  </h1>
                  {profile?.isVerified && (
                    <span
                      title="Verified University Student"
                      className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Verified Student</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 flex items-center justify-center md:justify-start gap-1.5 mt-1 font-mono">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>{profile?.email}</span>
                </p>
              </div>

              {/* Edit Profile Button */}
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-brand-purple/20 transition-all cursor-pointer self-center md:self-auto"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            </div>

            {/* University & Degree Pill */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1 text-xs text-slate-300">
              <span className="px-3 py-1 rounded-xl bg-navy-900 border border-navy-750 flex items-center gap-1.5 text-electric-300">
                <GraduationCap className="w-4 h-4 text-electric-400" />
                <span>{profile?.universityName}</span>
              </span>

              {profile?.course && (
                <span className="px-3 py-1 rounded-xl bg-navy-900 border border-navy-750 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-brand-purple" />
                  <span>{profile?.course}</span>
                </span>
              )}

              {profile?.branch && (
                <span className="px-3 py-1 rounded-xl bg-navy-900 border border-navy-750 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>{profile?.branch}</span>
                </span>
              )}

              {(profile?.academicYear || profile?.semester) && (
                <span className="px-3 py-1 rounded-xl bg-navy-900 border border-navy-750 flex items-center gap-1.5 font-mono text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {[profile?.academicYear, profile?.semester].filter(Boolean).join(' • ')}
                  </span>
                </span>
              )}
            </div>

            {/* Bio */}
            {profile?.bio ? (
              <p className="text-xs text-slate-300 pt-2 leading-relaxed max-w-2xl">
                {profile.bio}
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic pt-1">
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
                  className="p-2 rounded-xl bg-navy-900 hover:bg-navy-800 border border-navy-750 text-slate-300 hover:text-white transition-colors"
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
                  className="p-2 rounded-xl bg-navy-900 hover:bg-navy-800 border border-navy-750 text-slate-300 hover:text-white transition-colors"
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
                  className="p-2 rounded-xl bg-navy-900 hover:bg-navy-800 border border-navy-750 text-slate-300 hover:text-white transition-colors"
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
                  className="p-2 rounded-xl bg-navy-900 hover:bg-navy-800 border border-navy-750 text-slate-300 hover:text-white transition-colors"
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
                  className="p-2 rounded-xl bg-navy-900 hover:bg-navy-800 border border-navy-750 text-slate-300 hover:text-white transition-colors"
                  title="Personal Portfolio / Website"
                >
                  <Globe className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-6 mt-6 border-t border-navy-800/80">
          <Link
            href="/pricing"
            className="p-4 rounded-2xl bg-navy-900/60 border border-navy-800 hover:border-amber-500/40 transition-colors flex items-center gap-3 group"
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Chat Credits</p>
              <p className="text-base font-extrabold text-white flex items-center gap-1">
                <span>{credits}</span>
                <span className="text-[10px] text-amber-400 font-normal">Add More →</span>
              </p>
            </div>
          </Link>

          <Link
            href="/messages"
            className="p-4 rounded-2xl bg-navy-900/60 border border-navy-800 hover:border-electric-500/40 transition-colors flex items-center gap-3 group"
          >
            <div className="p-2.5 rounded-xl bg-electric-500/10 text-electric-400 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Campus Friends</p>
              <p className="text-base font-extrabold text-white flex items-center gap-1">
                <span>{friendsCount}</span>
                <span className="text-[10px] text-electric-400 font-normal">View In Chat →</span>
              </p>
            </div>
          </Link>

          <div className="p-4 rounded-2xl bg-navy-900/60 border border-navy-800 flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Verification Status</p>
              <p className="text-xs font-bold text-emerald-400">
                {profile?.isVerified ? 'Verified Student' : 'Standard Account'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Skills & Interests Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Academic Skills */}
        <div className="glass-card rounded-3xl p-6 border border-navy-750 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-electric-400" />
              <span>Skills & Technologies</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              {profile?.skills?.length || 0} Listed
            </span>
          </div>

          {Array.isArray(profile?.skills) && profile.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill: string, idx: number) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-electric-500/10 border border-electric-500/30 text-electric-300 text-xs font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              No skills added yet. Add skills like Python, React, CAD, UI/UX in Edit Profile.
            </p>
          )}
        </div>

        {/* Campus Interests */}
        <div className="glass-card rounded-3xl p-6 border border-navy-750 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-purple" />
              <span>Hobbies & Campus Interests</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              {profile?.interests?.length || 0} Listed
            </span>
          </div>

          {Array.isArray(profile?.interests) && profile.interests.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((interest: string, idx: number) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-brand-purple/10 border border-brand-purple/30 text-purple-300 text-xs font-medium"
                >
                  {interest}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">
              No interests added yet. Add topics like Hackathons, Music, Football, Photography.
            </p>
          )}
        </div>
      </div>

      {/* Edit Profile Interactive Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-navy-900 border border-navy-750 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-navy-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-brand-purple" />
                <h3 className="text-lg font-bold text-white">Edit Student Profile</h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-navy-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-navy-750 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Gender</label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-navy-750 text-white focus:outline-none focus:border-brand-purple"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="NON_BINARY">Non-Binary</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                  </select>
                </div>
              </div>

              {/* Course & Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Degree / Course</label>
                  <input
                    type="text"
                    placeholder="e.g. B.Tech Computer Science"
                    value={editForm.course}
                    onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-navy-750 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Branch / Specialization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AI & Data Science"
                    value={editForm.branch}
                    onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-navy-750 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
                  />
                </div>
              </div>

              {/* Year & Semester */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Academic Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 3rd Year"
                    value={editForm.academicYear}
                    onChange={(e) => setEditForm({ ...editForm, academicYear: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-navy-750 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Semester</label>
                  <input
                    type="text"
                    placeholder="e.g. 5th Semester"
                    value={editForm.semester}
                    onChange={(e) => setEditForm({ ...editForm, semester: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-navy-750 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Bio (Max 500 characters)
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Tell campus peers about yourself, what you study, projects you are building..."
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-navy-750 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
                />
              </div>

              {/* Skills & Interests Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Skills (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. React, Python, Figma, DSA"
                    value={editForm.skillsInput}
                    onChange={(e) => setEditForm({ ...editForm, skillsInput: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-navy-750 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Interests / Hobbies (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hackathons, Robotics, Music"
                    value={editForm.interestsInput}
                    onChange={(e) => setEditForm({ ...editForm, interestsInput: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-navy-950 border border-navy-750 text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
                  />
                </div>
              </div>

              {/* Social Profiles */}
              <div className="space-y-3 pt-2 border-t border-navy-800">
                <label className="block text-slate-300 font-semibold">Social Links (Optional)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 bg-navy-950 px-3 py-2 rounded-xl border border-navy-750">
                    <Github className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="GitHub username or link"
                      value={editForm.github}
                      onChange={(e) => setEditForm({ ...editForm, github: e.target.value })}
                      className="w-full bg-transparent text-white focus:outline-none text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-navy-950 px-3 py-2 rounded-xl border border-navy-750">
                    <Linkedin className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="LinkedIn username or URL"
                      value={editForm.linkedin}
                      onChange={(e) => setEditForm({ ...editForm, linkedin: e.target.value })}
                      className="w-full bg-transparent text-white focus:outline-none text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-navy-950 px-3 py-2 rounded-xl border border-navy-750">
                    <Instagram className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Instagram @handle"
                      value={editForm.instagram}
                      onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                      className="w-full bg-transparent text-white focus:outline-none text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-navy-950 px-3 py-2 rounded-xl border border-navy-750">
                    <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Portfolio / Website URL"
                      value={editForm.website}
                      onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                      className="w-full bg-transparent text-white focus:outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-navy-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-navy-700 text-slate-300 font-semibold hover:bg-navy-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-purple to-electric-500 hover:opacity-95 text-white font-bold flex items-center gap-2 shadow-lg shadow-brand-purple/20 transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
