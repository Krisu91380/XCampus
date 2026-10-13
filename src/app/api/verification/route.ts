import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { submitVerificationSchema } from '@/validators/verification';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = await req.json();
    const validated = submitVerificationSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, errors: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { universityId, documentType, institutionalEmail, idCardUrl } = validated.data;

    const uni = await db.university.findUnique({ where: { id: universityId } });
    if (!uni) {
      return NextResponse.json({ success: false, message: 'University not found.' }, { status: 404 });
    }

    // Check if institutional email domain matches automatically
    let status = 'PENDING';
    let reviewedBy: string | null = null;
    let reviewedAt: Date | null = null;

    if (institutionalEmail && documentType === 'INSTITUTION_EMAIL') {
      const domain = institutionalEmail.split('@')[1]?.toLowerCase();
      if (domain && uni.approvedDomains.includes(domain)) {
        status = 'APPROVED';
        reviewedBy = 'SYSTEM_DOMAIN_VERIFICATION';
        reviewedAt = new Date();

        // Upgrade user role to VERIFIED_STUDENT
        await db.user.update({
          where: { id: session.userId },
          data: { role: 'VERIFIED_STUDENT', universityId: uni.id },
        });
      }
    }

    const record = await db.verification.create({
      data: {
        userId: session.userId,
        universityId,
        institutionalEmail: institutionalEmail || null,
        idCardUrl: idCardUrl || null,
        documentType,
        status: status as any,
        reviewedBy,
        reviewedAt,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        status === 'APPROVED'
          ? 'Congratulations! Your student status was instantly verified.'
          : 'Verification request submitted. Our team will review your student credentials shortly.',
      verification: record,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const verifications = await db.verification.findMany({ where: { userId: session.userId } });
    return NextResponse.json({ success: true, verifications });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
}
