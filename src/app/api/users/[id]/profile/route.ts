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

    if (blockedByMe || blockedByTarget) {
      return NextResponse.json(
        { success: false, message: 'User profile is not accessible.' },
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

    return NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        displayName: profile?.displayName || 'Student Peer',
        avatarUrl: profile?.avatarUrl || null,
        bio: profile?.bio || '',
        course: profile?.course || '',
        branch: profile?.branch || '',
        academicYear: profile?.academicYear || '',
        semester: profile?.semester || '',
        language: profile?.language || 'English',
        interests: profile?.interests || [],
        skills: profile?.skills || [],
        socialLinks: profile?.socialLinks || {},
        universityName: uni?.name || 'Lovely Professional University',
        universityCode: uni?.code || 'LPU',
        isVerified: targetUser.role === 'VERIFIED_STUDENT',
        isOnline: profile?.isOnline ?? true,
        isFriend: friendshipStatus === 'FRIENDS',
        friendshipStatus,
        friendRequestId,
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
