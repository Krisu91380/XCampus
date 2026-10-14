import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin(req);

    const users = await db.user.findMany();
    const totalUsers = users.length;
    const verifiedUsers = users.filter((u) => u.role === 'VERIFIED_STUDENT').length;
    const suspendedUsers = users.filter((u) => u.status === 'SUSPENDED').length;

    const profiles = await db.profile.findMany();
    const onlineUsers = profiles.filter((p) => p.isOnline).length;

    const conversations = await db.conversation.findMany();
    const activeConversations = conversations.filter((c) => c.status === 'ACTIVE').length;
    const totalConversations = conversations.length;

    const orders = await db.paymentOrder.findMany();
    const paidOrders = orders.filter((o) => o.status === 'PAID');
    const totalRevenueInPaise = paidOrders.reduce((acc, curr) => acc + curr.amountInPaise, 0);
    const totalRevenueInInr = totalRevenueInPaise / 100;

    const pendingVerifications = (await db.verification.findMany({ where: { status: 'PENDING' } })).length;
    const pendingReports = (await db.abuseReport.findMany({ where: { status: 'PENDING' } })).length;

    let pgTables: string[] = [];
    let pgConnectionError: string | null = null;
    let isPrismaActive = Boolean(db.prisma);

    if (db.prisma) {
      try {
        const rows: any = await db.prisma.$queryRaw`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          ORDER BY table_name;
        `;
        pgTables = Array.isArray(rows) ? rows.map((r: any) => r.table_name) : [];
      } catch (e: any) {
        pgConnectionError = e.message;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        verifiedUsers,
        onlineUsers,
        suspendedUsers,
        activeConversations,
        totalConversations,
        totalRevenueInInr,
        confirmedTransactionsCount: paidOrders.length,
        pendingVerifications,
        pendingReports,
      },
      currentAdmin: {
        id: session.userId,
        email: session.email,
        role: session.role,
      },
      dbDiagnostics: {
        isPrismaActive,
        pgTablesCount: pgTables.length,
        pgTables,
        pgConnectionError,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        hasDirectUrl: Boolean(process.env.DIRECT_URL),
        databaseUrlScheme: process.env.DATABASE_URL ? process.env.DATABASE_URL.split(':')[0] : null,
        isVercel: Boolean(process.env.VERCEL),
        userCount: users.length,
        userEmails: users.map((u) => u.email),
      },
    });
  } catch (error: any) {
    if (error.message === 'FORBIDDEN_ADMIN_ONLY') {
      return NextResponse.json({ success: false, message: 'Forbidden. Admin privileges required.' }, { status: 403 });
    }
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
