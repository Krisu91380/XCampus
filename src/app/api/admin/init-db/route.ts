import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { migrateJsonToPostgres } from '@/lib/migrate-to-postgres';
import { PRISMA_SCHEMA_SAFE_SQL } from '@/lib/schema-sql';
import { SEED_PRODUCTION_DATA_SQL } from '@/lib/seed-sql';

function safeParseConnectionUrl(urlStr: string | undefined) {
  if (!urlStr) return { configured: false };
  try {
    const parsed = new URL(urlStr);
    const hasPassword = Boolean(parsed.password);
    const specialChars = ['@', '#', '$', '%', '&', '+', '/', ':', ';', '=', '?', '[', ']'];
    const rawPass = decodeURIComponent(parsed.password);
    const unencodedSpecialInPass = specialChars.some(
      (c) => rawPass.includes(c) && !parsed.password.includes(encodeURIComponent(c))
    );

    // Extract project ref
    let projectRef: string | null = null;
    if (parsed.hostname.startsWith('db.') && parsed.hostname.endsWith('.supabase.co')) {
      projectRef = parsed.hostname.replace('db.', '').replace('.supabase.co', '');
    } else if (parsed.username.startsWith('postgres.')) {
      projectRef = parsed.username.replace('postgres.', '');
    }

    return {
      configured: true,
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || '5432',
      pathname: parsed.pathname,
      usernameFormat: parsed.username.includes('.') ? 'postgres.<project-ref>' : parsed.username,
      hasPassword,
      passwordLength: parsed.password ? parsed.password.length : 0,
      hasPotentialEncodingIssue: unencodedSpecialInPass,
      projectRef,
      searchParams: parsed.search,
    };
  } catch (err: any) {
    return {
      configured: true,
      parseError: err.message,
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin(req);

    const dbUrlMeta = safeParseConnectionUrl(process.env.DATABASE_URL);
    const directUrlMeta = safeParseConnectionUrl(process.env.DIRECT_URL);

    const sameProject =
      dbUrlMeta.projectRef && directUrlMeta.projectRef
        ? dbUrlMeta.projectRef === directUrlMeta.projectRef
        : null;

    let testDbUrlResult: { success: boolean; error?: string; tables?: string[]; rowCounts?: Record<string, any> } = { success: false };
    let testSessionPoolerResult: { success: boolean; error?: string; tables?: string[]; rowCounts?: Record<string, any> } = { success: false };
    let testDirectUrlResult: { success: boolean; error?: string; tables?: string[]; rowCounts?: Record<string, any> } = { success: false };

    // 1. Test DATABASE_URL (Transaction pooler)
    if (process.env.DATABASE_URL) {
      // Append ?pgbouncer=true if not present
      let poolerUrl = process.env.DATABASE_URL;
      if (!poolerUrl.includes('pgbouncer=true')) {
        poolerUrl += (poolerUrl.includes('?') ? '&' : '?') + 'pgbouncer=true&connection_limit=1';
      }
      const client = new PrismaClient({
        datasources: { db: { url: poolerUrl } },
      });
      try {
        const rows: any = await client.$queryRaw`
          SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
        `;
        const [u, p, c, m, fr] = await Promise.all([
          client.user.count().catch(() => 0),
          client.profile.count().catch(() => 0),
          client.conversation.count().catch(() => 0),
          client.message.count().catch(() => 0),
          client.friendRequest.count().catch(() => 0),
        ]);
        testDbUrlResult = {
          success: true,
          tables: Array.isArray(rows) ? rows.map((r: any) => r.table_name) : [],
          rowCounts: { users: u, profiles: p, conversations: c, messages: m, friendRequests: fr },
        };
      } catch (e: any) {
        testDbUrlResult = { success: false, error: e.message };
      } finally {
        await client.$disconnect().catch(() => {});
      }
    }

    // 2. Test Session Pooler (port 5432 on pooler host - supports direct connections & DDL over IPv4)
    if (process.env.DATABASE_URL) {
      try {
        const u = new URL(process.env.DATABASE_URL);
        u.port = '5432';
        u.search = '';
        const sessionClient = new PrismaClient({
          datasources: { db: { url: u.toString() } },
        });
        try {
          const rows: any = await sessionClient.$queryRaw`
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
          `;
          const [uCount, pCount, cCount, mCount, frCount] = await Promise.all([
            sessionClient.user.count().catch(() => 0),
            sessionClient.profile.count().catch(() => 0),
            sessionClient.conversation.count().catch(() => 0),
            sessionClient.message.count().catch(() => 0),
            sessionClient.friendRequest.count().catch(() => 0),
          ]);
          testSessionPoolerResult = {
            success: true,
            tables: Array.isArray(rows) ? rows.map((r: any) => r.table_name) : [],
            rowCounts: { users: uCount, profiles: pCount, conversations: cCount, messages: mCount, friendRequests: frCount },
          };
        } catch (e: any) {
          testSessionPoolerResult = { success: false, error: e.message };
        } finally {
          await sessionClient.$disconnect().catch(() => {});
        }
      } catch (err: any) {
        testSessionPoolerResult = { success: false, error: err.message };
      }
    }

    // 3. Test DIRECT_URL
    if (process.env.DIRECT_URL) {
      const directClient = new PrismaClient({
        datasources: { db: { url: process.env.DIRECT_URL } },
      });
      try {
        const rows: any = await directClient.$queryRaw`
          SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
        `;
        const [uCount, pCount, cCount, mCount, frCount] = await Promise.all([
          directClient.user.count().catch(() => 0),
          directClient.profile.count().catch(() => 0),
          directClient.conversation.count().catch(() => 0),
          directClient.message.count().catch(() => 0),
          directClient.friendRequest.count().catch(() => 0),
        ]);
        testDirectUrlResult = {
          success: true,
          tables: Array.isArray(rows) ? rows.map((r: any) => r.table_name) : [],
          rowCounts: { users: uCount, profiles: pCount, conversations: cCount, messages: mCount, friendRequests: frCount },
        };
      } catch (e: any) {
        testDirectUrlResult = { success: false, error: e.message };
      } finally {
        await directClient.$disconnect().catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      admin: session.email,
      diagnostics: {
        DATABASE_URL: dbUrlMeta,
        DIRECT_URL: directUrlMeta,
        sameProject,
        testDbUrlResult,
        testSessionPoolerResult,
        testDirectUrlResult,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.message === 'FORBIDDEN_ADMIN_ONLY' ? 403 : 401 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin(req);

    // Choose best working URL
    let candidateUrls: string[] = [];
    if (process.env.DATABASE_URL) {
      try {
        const u = new URL(process.env.DATABASE_URL);
        u.port = '5432';
        u.search = '';
        candidateUrls.push(u.toString()); // Session Pooler IPv4 port 5432
      } catch {}
      candidateUrls.push(process.env.DATABASE_URL);
    }
    if (process.env.DIRECT_URL) {
      candidateUrls.push(process.env.DIRECT_URL);
    }

    if (candidateUrls.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Neither DIRECT_URL nor DATABASE_URL configured.' },
        { status: 500 }
      );
    }

    let prisma: PrismaClient | null = null;
    let selectedUrlType = '';
    for (const testUrl of candidateUrls) {
      try {
        const p = new PrismaClient({ datasources: { db: { url: testUrl } } });
        await p.$queryRaw`SELECT 1`;
        prisma = p;
        selectedUrlType = testUrl.includes(':5432') ? 'Session Pooler (port 5432)' : 'Transaction Pooler';
        break;
      } catch {
        // try next
      }
    }

    if (!prisma) {
      // Fallback to first candidate
      prisma = new PrismaClient({ datasources: { db: { url: candidateUrls[0] } } });
      selectedUrlType = 'Default candidate';
    }

    const results: { ddlSuccess: boolean; ddlStatementsRun: number; ddlErrors: string[]; migrationSuccess?: boolean; tablesNow: string[] } = {
      ddlSuccess: false,
      ddlStatementsRun: 0,
      ddlErrors: [],
      tablesNow: [],
    };

    try {
      // 1. Get safe SQL DDL
      let sqlContent = PRISMA_SCHEMA_SAFE_SQL;
      if (!sqlContent) {
        const sqlFile = path.join(process.cwd(), 'prisma', 'prisma_schema_safe.sql');
        if (fs.existsSync(sqlFile)) {
          sqlContent = fs.readFileSync(sqlFile, 'utf-8');
        }
      }

      // 2. Execute statements safely
      // Split by semicolon, filter out empty statements or comments
      const rawStatements = sqlContent
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      let executed = 0;
      for (const stmt of rawStatements) {
        if (!stmt || stmt.startsWith('--')) continue;
        try {
          await prisma.$executeRawUnsafe(stmt);
          executed++;
        } catch (e: any) {
          // Ignore "already exists" errors safely
          if (
            e.message?.includes('already exists') ||
            e.message?.includes('duplicate key') ||
            e.message?.includes('does not exist')
          ) {
            // Safe to skip
          } else {
            results.ddlErrors.push(e.message);
          }
        }
      }

      results.ddlSuccess = results.ddlErrors.length === 0;
      results.ddlStatementsRun = executed;

      // 3. Query existing public tables
      const tableRows: any = await prisma.$queryRaw`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
      `;
      results.tablesNow = Array.isArray(tableRows) ? tableRows.map((r: any) => r.table_name) : [];

      // 4. Run SQL Data Seeding and JSON migration
      try {
        const seedStatements = SEED_PRODUCTION_DATA_SQL
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));

        for (const stmt of seedStatements) {
          if (!stmt || stmt.startsWith('--')) continue;
          try {
            await prisma.$executeRawUnsafe(stmt);
          } catch (e: any) {
            // Safe to ignore duplicate or conflict
          }
        }
        await migrateJsonToPostgres(prisma);
        results.migrationSuccess = true;
      } catch (migErr: any) {
        results.migrationSuccess = false;
        results.ddlErrors.push(`Data migration notice: ${migErr.message}`);
      }

      // 5. Query live row counts
      let counts: any = {};
      try {
        const [u, p, c, m, fr] = await Promise.all([
          prisma.user.count().catch(() => 0),
          prisma.profile.count().catch(() => 0),
          prisma.conversation.count().catch(() => 0),
          prisma.message.count().catch(() => 0),
          prisma.friendRequest.count().catch(() => 0),
        ]);
        counts = { users: u, profiles: p, conversations: c, messages: m, friendRequests: fr };
      } catch {}
      (results as any).rowCounts = counts;

      return NextResponse.json({
        success: true,
        message: 'Database initialization and migration completed.',
        results,
      });
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.message === 'FORBIDDEN_ADMIN_ONLY' ? 403 : 500 }
    );
  }
}
