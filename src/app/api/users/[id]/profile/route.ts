import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(req);
    const targetUserId = params.id;

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required.' },
        { status: 400 }
      );
    }

    // Check bidirectional blocks
    const [blockedByMe, blockedByTarget] = await Promise.all([
      db.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: session.userId,
            blockedId: targetUserId,
          },
        },
      }),
      db.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: targetUserId,
            blockedId: session.userId,
          },
        },
      }),
    ]);

    // If target blocked current user, do not reveal profile
    if (blockedByTarget) {
      return NextResponse.json(
        { success: false, message: 'This user is unavailable.' },
        { status: 404 }
      );
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: 'Student profile not found.' },
        { status: 404 }
      );
    }

    const profile = await db.profile.findUnique({
      where: { userId: targetUserId },
    });

    const uni = targetUser.universityId
      ? await db.university.findUnique({ where: { id: targetUser.universityId } })
      : null;

    // Check friendship status
    const friendRequests = await db.friendRequest.findMany({
      where: {
        OR: [
          { senderId: session.userId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: session.userId },
        ],
      },
    });

    const acceptedReq = friendRequests.find((r) => r.status === 'ACCEPTED');
    const pendingOutgoing = friendRequests.find(
      (r) => r.senderId === session.userId && r.status === 'PENDING'
    );
    const pendingIncoming = friendRequests.find(
      (r) => r.receiverId === session.userId && r.status === 'PENDING'
    );

    let friendshipStatus: 'NONE' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' = 'NONE';
    let friendRequestId: string | null = null;

    if (acceptedReq) {
      friendshipStatus = 'FRIENDS';
      friendRequestId = acceptedReq.id;
    } else if (pendingOutgoing) {
      friendshipStatus = 'REQUEST_SENT';
      friendRequestId = pendingOutgoing.id;
    } else if (pendingIncoming) {
      friendshipStatus = 'REQUEST_RECEIVED';
      friendRequestId = pendingIncoming.id;
    }

    const profileSocial = (profile?.socialLinks as any) || {};
    const username = profileSocial.username || (targetUser.email ? targetUser.email.split('@')[0] : '');
    const relationshipStatus = profileSocial.relationshipVisible && profileSocial.relationshipStatus
      ? profileSocial.relationshipStatus
      : null;

    return NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        displayName: profile?.displayName || 'Student Peer',
        username,
        avatarUrl: profile?.avatarUrl || null,
        bio: profile?.bio || '',
        course: profile?.course || '',
        branch: profile?.branch || '',
        academicYear: profile?.academicYear || '',
        semester: profile?.semester || '',
        language: profile?.language || 'English',
        interests: Array.isArray(profile?.interests) ? profile.interests : [],
        skills: Array.isArray(profile?.skills) ? profile.skills : [],
        relationshipStatus,
        relationshipVisible: Boolean(profileSocial.relationshipVisible),
        socialLinks: {
          github: profileSocial.github || '',
          linkedin: profileSocial.linkedin || '',
          instagram: profileSocial.instagram || '',
          twitter: profileSocial.twitter || '',
          website: profileSocial.website || '',
        },
        universityName: uni?.name || 'Lovely Professional University',
        universityCode: uni?.code || 'LPU',
        isVerified: targetUser.role === 'VERIFIED_STUDENT',
        isOnline: profile?.isOnline ?? true,
        isFriend: friendshipStatus === 'FRIENDS',
        friendshipStatus,
        friendRequestId,
        isBlockedByMe: Boolean(blockedByMe),
        isSelf: session.userId === targetUser.id,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch user profile.' },
      { status: 500 }
    );
  }
}
