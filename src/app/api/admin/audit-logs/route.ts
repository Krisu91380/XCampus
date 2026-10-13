import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const logs = await db.adminAuditLog.findMany();

    const populated = [];
    for (const log of logs) {
      const admin = await db.user.findUnique({ where: { id: log.adminId } });
      populated.push({
        ...log,
        adminEmail: admin?.email || 'System',
      });
    }

    return NextResponse.json({ success: true, logs: populated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 403 });
  }
}
