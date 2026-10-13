import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const reports = await db.abuseReport.findMany();

    const populated = [];
    for (const r of reports) {
      const reporter = await db.profile.findUnique({ where: { userId: r.reporterId } });
      const reportedUser = await db.user.findUnique({ where: { id: r.reportedUserId } });
      const reportedProfile = await db.profile.findUnique({ where: { userId: r.reportedUserId } });

      populated.push({
        ...r,
        reporterName: reporter?.displayName || 'Anonymous Reporter',
        reportedUserName: reportedProfile?.displayName || reportedUser?.email,
        reportedUserEmail: reportedUser?.email,
        reportedUserStatus: reportedUser?.status,
      });
    }

    const users = await db.user.findMany();
    const userProfiles = [];
    for (const u of users) {
      const p = await db.profile.findUnique({ where: { userId: u.id } });
      userProfiles.push({
        id: u.id,
        email: u.email,
        displayName: p?.displayName || 'Student',
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
      });
    }

    return NextResponse.json({ success: true, reports: populated, users: userProfiles });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin(req);
    const body = await req.json();
    const { action, targetUserId, reportId, resolutionNotes } = body;

    if (action === 'SUSPEND_USER' || action === 'REINSTATE_USER') {
      const newStatus = action === 'SUSPEND_USER' ? 'SUSPENDED' : 'ACTIVE';
      await db.user.update({
        where: { id: targetUserId },
        data: { status: newStatus },
      });

      // If suspended, also make offline and remove from queue
      if (newStatus === 'SUSPENDED') {
        await db.profile.update({
          where: { userId: targetUserId },
          data: { isOnline: false, isDiscoverable: false },
        });
        await db.matchQueue.delete({ where: { userId: targetUserId } });
      }

      await logAdminAction({
        adminId: session.userId,
        action: newStatus === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REINSTATED',
        targetType: 'User',
        targetId: targetUserId,
        details: { action, reason: resolutionNotes },
      });

      return NextResponse.json({
        success: true,
        message: `User status changed to ${newStatus}.`,
      });
    }

    if (action === 'RESOLVE_REPORT' || action === 'DISMISS_REPORT') {
      if (!reportId) {
        return NextResponse.json({ success: false, message: 'Report ID required.' }, { status: 400 });
      }

      const newStatus = action === 'RESOLVE_REPORT' ? 'RESOLVED' : 'DISMISSED';
      await db.abuseReport.update({
        where: { id: reportId },
        data: {
          status: newStatus,
          resolutionNotes: resolutionNotes || null,
          resolvedBy: session.userId,
          resolvedAt: new Date(),
        },
      });

      await logAdminAction({
        adminId: session.userId,
        action: `REPORT_${newStatus}`,
        targetType: 'AbuseReport',
        targetId: reportId,
        details: { resolutionNotes },
      });

      return NextResponse.json({ success: true, message: `Report marked as ${newStatus}.` });
    }

    return NextResponse.json({ success: false, message: 'Unknown action.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 403 });
  }
}
