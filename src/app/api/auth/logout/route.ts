import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (session) {
      await db.profile.update({
        where: { userId: session.userId },
        data: { isOnline: false, lastSeenAt: new Date() },
      });
      // Also remove from any active waiting queue
      await db.matchQueue.delete({ where: { userId: session.userId } });
    }
    const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
    await clearSessionCookie(response);
    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Error logging out.' }, { status: 500 });
  }
}
