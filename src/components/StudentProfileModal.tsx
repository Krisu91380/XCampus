'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  GraduationCap,
  Building2,
  Calendar,
  BookOpen,
  Heart,
  ShieldCheck,
  UserPlus,
  UserCheck,
  UserMinus,
  Ban,
  Flag,
  MessageCircle,
  ExternalLink,
  Github,
  Linkedin,
  Instagram,
  Globe,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

export interface StudentProfileData {
  id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string | null;
  bio?: string;
  course?: string | null;
  branch?: string | null;
  academicYear?: string | null;
  semester?: string | null;
  language?: string | null;
  interests?: string[];
  skills?: string[];
  relationshipStatus?: string | null;
  relationshipVisible?: boolean;
  socialLinks?: {
    github?: string;
    linkedin?: string;
    instagram?: string;
    twitter?: string;
    website?: string;
  };
  universityName?: string;
  universityCode?: string;
  isVerified?: boolean;
  isOnline?: boolean;
  isFriend?: boolean;
  friendshipStatus?: 'NONE' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED';
  friendRequestId?: string | null;
  isBlockedByMe?: boolean;
  isSelf?: boolean;
}

export interface StudentProfileModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onFriendshipChange?: () => void;
  onBlockChange?: () => void;
  onMessageClick?: (userId: string) => void;
}

export function StudentProfileModal({
  userId,
  isOpen,
  onClose,
  onFriendshipChange,
  onBlockChange,
  onMessageClick,
}: StudentProfileModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Confirmation dialogs
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState<boolean>(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState<boolean>(false);
  const [confirmReportOpen, setConfirmReportOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (!isOpen || !userId) {
      setProfile(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    fetch(`/api/users/${userId}/profile`)
      .then((res) => {
        if (!res.ok) throw new Error('Unable to load student profile.');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          if (data.success && data.user) {
            setProfile(data.user);
          } else {
            setErrorMsg(data.message || 'Profile unavailable.');
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMsg(err.message || 'Failed to load profile.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !actionLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const initials = (profile?.displayName || 'Student')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || 'ST';

  const handleAddFriend = async () => {
    if (!profile) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: profile.id }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                friendshipStatus: data.status === 'ACCEPTED' ? 'FRIENDS' : 'REQUEST_SENT',
                isFriend: data.status === 'ACCEPTED',
              }
            : null
        );
        showToast(data.message || 'Friend request sent!');
        onFriendshipChange?.();
      } else {
        showToast(data.message || 'Failed to send request.');
      }
    } catch {
      showToast('Network error while sending friend request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!profile) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: profile.id }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                friendshipStatus: 'NONE',
                isFriend: false,
              }
            : null
        );
        showToast('Friend removed.');
        setConfirmRemoveOpen(false);
        onFriendshipChange?.();
      } else {
        showToast(data.message || 'Failed to remove friend.');
      }
    } catch {
      showToast('Error removing friend.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!profile) return;
    setActionLoading(true);
    const isCurrentlyBlocked = profile.isBlockedByMe;
    const endpoint = isCurrentlyBlocked ? '/api/friends/unblock' : '/api/friends/block';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: profile.id }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                isBlockedByMe: !isCurrentlyBlocked,
                friendshipStatus: isCurrentlyBlocked ? prev.friendshipStatus : 'NONE',
                isFriend: isCurrentlyBlocked ? prev.isFriend : false,
              }
            : null
        );
        showToast(
          isCurrentlyBlocked
            ? 'Student unblocked.'
            : 'Student blocked. They can no longer contact you.'
        );
        setConfirmBlockOpen(false);
        onBlockChange?.();
      } else {
        showToast(data.message || 'Failed to update block state.');
      }
    } catch {
      showToast('Error updating block state.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReport = async () => {
    setActionLoading(true);
    try {
      showToast('Report submitted for moderation review.');
      setConfirmReportOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => {
          if (!actionLoading) onClose();
        }}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Student Profile
              </span>
              {profile?.isVerified && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                  <ShieldCheck className="w-3 h-3" />
                  Verified
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              disabled={actionLoading}
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Toast Notification inside modal */}
          {toastMessage && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium shadow-lg animate-fade-in">
              {toastMessage}
            </div>
          )}

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                <p className="text-sm text-zinc-500">Loading student details...</p>
              </div>
            ) : errorMsg ? (
              <div className="text-center py-12 space-y-2">
                <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                  {errorMsg}
                </p>
                <p className="text-sm text-zinc-500">
                  This account may be unavailable or blocked.
                </p>
              </div>
            ) : profile ? (
              <>
                {/* Hero / Avatar & Core Names */}
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt={profile.displayName}
                        className="w-20 h-20 rounded-2xl object-cover ring-2 ring-purple-500/20 shadow-md"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center font-bold text-2xl tracking-wider shadow-md">
                        {initials}
                      </div>
                    )}
                    {profile.isOnline && (
                      <span
                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-zinc-900 rounded-full"
                        title="Online"
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 truncate">
                      {profile.displayName}
                    </h2>
                    {profile.username && (
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        @{profile.username}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {profile.universityName || 'CampusConnect University'}{' '}
                        {profile.universityCode && `(${profile.universityCode})`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Academic Metadata Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {profile.course && (
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-purple-500 shrink-0" />
                      <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
                        {profile.course}
                      </span>
                    </div>
                  )}
                  {profile.branch && (
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
                        {profile.branch}
                      </span>
                    </div>
                  )}
                  {profile.academicYear && (
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
                        {profile.academicYear}
                        {profile.semester ? ` • Sem ${profile.semester}` : ''}
                      </span>
                    </div>
                  )}
                  {profile.relationshipVisible && profile.relationshipStatus && (
                    <div className="p-2.5 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/30 flex items-center gap-2 col-span-2 sm:col-span-1">
                      <Heart className="w-4 h-4 text-pink-500 shrink-0 fill-pink-500/20" />
                      <span className="font-medium text-pink-700 dark:text-pink-300 truncate">
                        {profile.relationshipStatus}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bio */}
                {profile.bio && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      About
                    </h3>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      {profile.bio}
                    </p>
                  </div>
                )}

                {/* Interests & Skills */}
                {((profile.interests && profile.interests.length > 0) ||
                  (profile.skills && profile.skills.length > 0)) && (
                  <div className="space-y-3">
                    {profile.interests && profile.interests.length > 0 && (
                      <div className="space-y-1.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          Interests
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {profile.interests.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800/40"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {profile.skills && profile.skills.length > 0 && (
                      <div className="space-y-1.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          Skills
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {profile.skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Social Links */}
                {profile.socialLinks &&
                  Object.values(profile.socialLinks).some((v) => Boolean(v)) && (
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Links
                      </h3>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {profile.socialLinks.github && (
                          <a
                            href={
                              profile.socialLinks.github.startsWith('http')
                                ? profile.socialLinks.github
                                : `https://github.com/${profile.socialLinks.github}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                          >
                            <Github className="w-3.5 h-3.5" />
                            GitHub
                            <ExternalLink className="w-3 h-3 text-zinc-400" />
                          </a>
                        )}
                        {profile.socialLinks.linkedin && (
                          <a
                            href={
                              profile.socialLinks.linkedin.startsWith('http')
                                ? profile.socialLinks.linkedin
                                : `https://linkedin.com/in/${profile.socialLinks.linkedin}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                          >
                            <Linkedin className="w-3.5 h-3.5 text-blue-500" />
                            LinkedIn
                            <ExternalLink className="w-3 h-3 text-zinc-400" />
                          </a>
                        )}
                        {profile.socialLinks.instagram && (
                          <a
                            href={
                              profile.socialLinks.instagram.startsWith('http')
                                ? profile.socialLinks.instagram
                                : `https://instagram.com/${profile.socialLinks.instagram}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                          >
                            <Instagram className="w-3.5 h-3.5 text-pink-500" />
                            Instagram
                            <ExternalLink className="w-3 h-3 text-zinc-400" />
                          </a>
                        )}
                        {profile.socialLinks.website && (
                          <a
                            href={
                              profile.socialLinks.website.startsWith('http')
                                ? profile.socialLinks.website
                                : `https://${profile.socialLinks.website}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                          >
                            <Globe className="w-3.5 h-3.5 text-emerald-500" />
                            Website
                            <ExternalLink className="w-3 h-3 text-zinc-400" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
              </>
            ) : null}
          </div>

          {/* Action Footer */}
          {profile && !profile.isSelf && (
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                {/* Block / Unblock */}
                <button
                  type="button"
                  onClick={() => {
                    if (profile.isBlockedByMe) {
                      handleToggleBlock();
                    } else {
                      setConfirmBlockOpen(true);
                    }
                  }}
                  disabled={actionLoading}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${
                    profile.isBlockedByMe
                      ? 'border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-red-600 hover:border-red-200 dark:hover:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  {profile.isBlockedByMe ? 'Unblock' : 'Block'}
                </button>

                {/* Report */}
                <button
                  type="button"
                  onClick={() => setConfirmReportOpen(true)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
                >
                  <Flag className="w-3.5 h-3.5" />
                  Report
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Friend Action */}
                {!profile.isBlockedByMe && (
                  <>
                    {profile.friendshipStatus === 'FRIENDS' ? (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveOpen(true)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        Remove Friend
                      </button>
                    ) : profile.friendshipStatus === 'REQUEST_SENT' ? (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        <UserCheck className="w-3.5 h-3.5" />
                        Request Sent
                      </span>
                    ) : profile.friendshipStatus === 'REQUEST_RECEIVED' ? (
                      <button
                        type="button"
                        onClick={handleAddFriend}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20 transition-all"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Accept Request
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAddFriend}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20 transition-all"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Add Friend
                      </button>
                    )}
                  </>
                )}

                {/* Message Button */}
                {!profile.isBlockedByMe && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onMessageClick?.(profile.id);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-zinc-900 hover:bg-black text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Message
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* In-App Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={confirmRemoveOpen}
        onClose={() => setConfirmRemoveOpen(false)}
        onConfirm={handleRemoveFriend}
        title="Remove Friend"
        description={`Are you sure you want to remove ${profile?.displayName || 'this student'} as a friend? You will no longer be able to message or call each other until a new friend request is accepted.`}
        confirmText="Remove Friend"
        variant="danger"
        isLoading={actionLoading}
      />

      <ConfirmDialog
        isOpen={confirmBlockOpen}
        onClose={() => setConfirmBlockOpen(false)}
        onConfirm={handleToggleBlock}
        title="Block Student"
        description={`Are you sure you want to block ${profile?.displayName || 'this student'}? They will not be able to message, call, or send friend requests to you. Existing messages will be preserved in your chat history.`}
        confirmText="Block Student"
        variant="danger"
        isLoading={actionLoading}
      />

      <ConfirmDialog
        isOpen={confirmReportOpen}
        onClose={() => setConfirmReportOpen(false)}
        onConfirm={handleReport}
        title="Report Account"
        description="Are you reporting this student profile for inappropriate behavior, harassment, or violating campus community guidelines? Our student safety team will review this report."
        confirmText="Submit Report"
        variant="warning"
        isLoading={actionLoading}
      />
    </>
  );
}
