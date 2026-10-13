import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const { targetUserId } = body;

    if (!targetUserId || targetUserId === session.userId) {
      return NextResponse.json(
        { success: false, message: 'Invalid target student.' },
        { status: 400 }
      );
    }

    // Verify target user exists
    const targetUser = await db.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser || targetUser.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, message: 'Target student not found or account is not active.' },
        { status: 404 }
      );
    }

    // Check blocks (both directions)
    const blockedByTarget = await db.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: targetUserId,
          blockedId: session.userId,
        },
      },
    });
    const blockedByUser = await db.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: session.userId,
          blockedId: targetUserId,
        },
      },
    });
    if (blockedByTarget || blockedByUser) {
      return NextResponse.json(
        { success: false, message: 'Unable to send friend request to this user.' },
        { status: 403 }
      );
    }

    // Check existing request between these two users (either direction)
    const existing = await db.friendRequest.findFirst({
      where: {
        senderId: session.userId,
        receiverId: targetUserId,
      },
    }) || await db.friendRequest.findFirst({
      where: {
        senderId: targetUserId,
        receiverId: session.userId,
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return NextResponse.json({
          success: true,
          status: 'ACCEPTED',
          message: 'You are already connected as friends!',
        });
      }

      if (existing.status === 'PENDING') {
        if (existing.senderId === session.userId) {
          return NextResponse.json({
            success: true,
            status: 'PENDING',
            message: 'Friend request is already pending.',
          });
        } else {
          // The other user already sent a request to current user! Automatically accept!
          await db.friendRequest.update({
            where: { id: existing.id },
            data: { status: 'ACCEPTED' },
          });
          return NextResponse.json({
            success: true,
            status: 'ACCEPTED',
            message: 'Mutual request accepted! You are now connected.',
          });
        }
      }

      if (existing.status === 'DECLINED') {
        // Reset to PENDING if re-sending
        const updated = await db.friendRequest.update({
          where: { id: existing.id },
          data: {
            senderId: session.userId,
            receiverId: targetUserId,
            status: 'PENDING',
          },
        });
        return NextResponse.json({
          success: true,
          status: 'PENDING',
          message: 'Friend request sent.',
          request: updated,
        });
      }
    }

    // Create new friend request
    const newReq = await db.friendRequest.create({
      data: {
        senderId: session.userId,
        receiverId: targetUserId,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      status: 'PENDING',
      message: 'Friend request sent successfully.',
      request: newReq,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
