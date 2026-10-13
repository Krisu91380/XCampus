import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { reportUserSchema } from '@/validators/chat';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(req);
    const conversationId = params.id;
    const body = await req.json();
    const validated = reportUserSchema.safeParse({ ...body, conversationId });

    if (!validated.success) {
      return NextResponse.json(
        { success: false, errors: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { reportedUserId, reason, details } = validated.data;
    if (reportedUserId === session.userId) {
      return NextResponse.json({ success: false, message: 'You cannot report yourself.' }, { status: 400 });
    }

    const report = await db.abuseReport.create({
      data: {
        reporterId: session.userId,
        reportedUserId,
        conversationId,
        reason,
        details,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Abuse report submitted. Our safety team will review this incident promptly.',
      reportId: report.id,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
