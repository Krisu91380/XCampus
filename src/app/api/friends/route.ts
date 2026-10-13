import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateSignedConversationId } from '@/lib/conversation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const userId = session.userId;

    const allRequests = await db.friendRequest.findMany();
    const universities = await db.university.findMany({ where: { isActive: true } });
    const uniMap = new Map(universities.map((u) => [u.id, u]));

    const users = await db.user.findMany({ where: { status: 'ACTIVE' } });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const profiles = await db.profile.findMany();
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    const incoming = [];
    const outgoing = [];
    const friends = [];

    for (const r of allRequests) {
      if (r.receiverId === userId) {
        const sender = userMap.get(r.senderId);
        const senderProf = profileMap.get(r.senderId);
        const senderUni = sender?.universityId ? uniMap.get(sender.universityId) : null;

        const senderDetails = {
          userId: r.senderId,
          displayName: senderProf?.displayName || 'Student',
          avatarUrl: senderProf?.avatarUrl || null,
          gender: senderProf?.gender || 'OTHER',
          course: senderProf?.course || '',
          academicYear: senderProf?.academicYear || '',
          universityName: senderUni?.name || 'University',
          isOnline: senderProf?.isOnline || false,
        };

        if (r.status === 'PENDING') {
          incoming.push({
            id: r.id,
            status: r.status,
            createdAt: r.createdAt,
            sender: senderDetails,
            fromUser: senderDetails,
          });
        } else if (r.status === 'ACCEPTED') {
          const convId = generateSignedConversationId(r.senderId, r.receiverId);
          friends.push({
            requestId: r.id,
            partner: senderDetails,
            conversationId: convId,
            connectedAt: r.updatedAt,
          });
        }
      } else if (r.senderId === userId) {
        const receiver = userMap.get(r.receiverId);
        const receiverProf = profileMap.get(r.receiverId);
        const receiverUni = receiver?.universityId ? uniMap.get(receiver.universityId) : null;

        const receiverDetails = {
          userId: r.receiverId,
          displayName: receiverProf?.displayName || 'Student',
          avatarUrl: receiverProf?.avatarUrl || null,
          gender: receiverProf?.gender || 'OTHER',
          course: receiverProf?.course || '',
          academicYear: receiverProf?.academicYear || '',
          universityName: receiverUni?.name || 'University',
          isOnline: receiverProf?.isOnline || false,
        };

        outgoing.push({
          id: r.id,
          status: r.status,
          createdAt: r.createdAt,
          receiver: receiverDetails,
          toUser: receiverDetails,
        });

        if (r.status === 'ACCEPTED') {
          const convId = generateSignedConversationId(r.senderId, r.receiverId);
          friends.push({
            requestId: r.id,
            partner: receiverDetails,
            conversationId: convId,
            connectedAt: r.updatedAt,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      incoming,
      outgoing,
      friends,
      incomingCount: incoming.length,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
