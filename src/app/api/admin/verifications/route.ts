import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { reviewVerificationSchema } from '@/validators/verification';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const verifications = await db.verification.findMany();

    // Attach student and university details
    const populated = [];
    for (const v of verifications) {
      const user = await db.user.findUnique({ where: { id: v.userId } });
      const profile = await db.profile.findUnique({ where: { userId: v.userId } });
      const uni = await db.university.findUnique({ where: { id: v.universityId } });
      populated.push({
        ...v,
        studentName: profile?.displayName || user?.email,
        studentEmail: user?.email,
        universityName: uni?.name || 'Unknown University',
      });
    }

    return NextResponse.json({ success: true, verifications: populated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin(req);
    const body = await req.json();
    const validated = reviewVerificationSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, errors: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { verificationId, action, rejectionReason } = validated.data;
    const record = await db.verification.findUnique({ where: { id: verificationId } });

    if (!record) {
      return NextResponse.json({ success: false, message: 'Verification record not found.' }, { status: 404 });
    }

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await db.verification.update({
      where: { id: verificationId },
      data: {
        status: newStatus,
        rejectionReason: action === 'REJECT' ? rejectionReason || 'Documentation insufficient' : null,
        reviewedBy: session.userId,
        reviewedAt: new Date(),
      },
    });

    // Update user role if approved
    if (action === 'APPROVE') {
      await db.user.update({
        where: { id: record.userId },
        data: {
          role: 'VERIFIED_STUDENT',
          universityId: record.universityId,
        },
      });
    }

    await logAdminAction({
      adminId: session.userId,
      action: action === 'APPROVE' ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
      targetType: 'StudentVerification',
      targetId: verificationId,
      details: { targetUserId: record.userId, action, rejectionReason },
    });

    return NextResponse.json({
      success: true,
      message: `Verification ${newStatus.toLowerCase()} successfully.`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 403 });
  }
}
