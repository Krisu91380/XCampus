import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { migrateJsonToPostgres, migrateJsonToSupabase } from '@/lib/migrate-to-postgres';
import { PRISMA_SCHEMA_SAFE_SQL } from '@/lib/schema-sql';
import { SEED_PRODUCTION_DATA_SQL } from '@/lib/seed-sql';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

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

    // 4. Test Supabase JS Client (HTTPS PostgREST API)
    let testSupabaseClientResult: any = { configured: isSupabaseConfigured() };
    const sb = getSupabaseClient();
    if (sb) {
      try {
        const [uRes, pRes, cRes, mRes, frRes] = await Promise.all([
          sb.from('User').select('*', { count: 'exact', head: true }),
          sb.from('Profile').select('*', { count: 'exact', head: true }),
          sb.from('Conversation').select('*', { count: 'exact', head: true }),
          sb.from('Message').select('*', { count: 'exact', head: true }),
          sb.from('FriendRequest').select('*', { count: 'exact', head: true }),
        ]);
        testSupabaseClientResult = {
          success: !mRes.error,
          error: mRes.error ? mRes.error.message : undefined,
          rowCounts: {
            users: uRes.count ?? 0,
            profiles: pRes.count ?? 0,
            conversations: cRes.count ?? 0,
            messages: mRes.count ?? 0,
            friendRequests: frRes.count ?? 0,
          },
        };
      } catch (sbErr: any) {
        testSupabaseClientResult = { success: false, error: sbErr.message };
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
        testSupabaseClientResult,
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

    const results: {
      prismaAttempted: boolean;
      prismaSuccess: boolean;
      ddlSuccess: boolean;
      ddlStatementsRun: number;
      ddlErrors: string[];
      prismaMigrationSuccess?: boolean;
      supabaseMigrationAttempted: boolean;
      supabaseMigrationSuccess: boolean;
      supabaseMigrationDetails?: any;
      rowCounts: { users: number; profiles: number; conversations: number; messages: number; friendRequests: number };
    } = {
      prismaAttempted: false,
      prismaSuccess: false,
      ddlSuccess: false,
      ddlStatementsRun: 0,
      ddlErrors: [],
      supabaseMigrationAttempted: false,
      supabaseMigrationSuccess: false,
      rowCounts: { users: 0, profiles: 0, conversations: 0, messages: 0, friendRequests: 0 },
    };

    // 1. Try Prisma direct / pooler connection if available
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

    if (candidateUrls.length > 0) {
      results.prismaAttempted = true;
      let prisma: PrismaClient | null = null;
      for (const testUrl of candidateUrls) {
        try {
          const p = new PrismaClient({ datasources: { db: { url: testUrl } } });
          await p.$queryRaw`SELECT 1`;
          prisma = p;
          break;
        } catch {}
      }

      if (prisma) {
        try {
          results.prismaSuccess = true;
          // Execute safe DDL
          let sqlContent = PRISMA_SCHEMA_SAFE_SQL;
          if (!sqlContent) {
            const sqlFile = path.join(process.cwd(), 'prisma', 'prisma_schema_safe.sql');
            if (fs.existsSync(sqlFile)) {
              sqlContent = fs.readFileSync(sqlFile, 'utf-8');
            }
          }

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

          // Prisma Seed & Migration
          try {
            const seedStatements = SEED_PRODUCTION_DATA_SQL
              .split(';')
              .map((s) => s.trim())
              .filter((s) => s.length > 0 && !s.startsWith('--'));

            for (const stmt of seedStatements) {
              if (!stmt || stmt.startsWith('--')) continue;
              try {
                await prisma.$executeRawUnsafe(stmt);
              } catch {}
            }
            await migrateJsonToPostgres(prisma);
            results.prismaMigrationSuccess = true;
          } catch (migErr: any) {
            results.prismaMigrationSuccess = false;
            results.ddlErrors.push(`Prisma data migration notice: ${migErr.message}`);
          }
        } finally {
          await prisma.$disconnect().catch(() => {});
        }
      }
    }

    // 2. Supabase PostgREST Migration (over HTTPS port 443 - works even when TCP pooler 6543 is blocked)
    const sb = getSupabaseClient();
    if (sb) {
      results.supabaseMigrationAttempted = true;
      try {
        const sbMigrationRes = await migrateJsonToSupabase(sb);
        results.supabaseMigrationSuccess = sbMigrationRes.errors.length === 0;
        results.supabaseMigrationDetails = sbMigrationRes;
      } catch (sbErr: any) {
        results.supabaseMigrationSuccess = false;
        results.ddlErrors.push(`Supabase client migration exception: ${sbErr.message}`);
      }

      // Query live row counts directly from Supabase
      try {
        const [uRes, pRes, cRes, mRes, frRes] = await Promise.all([
          sb.from('User').select('*', { count: 'exact', head: true }),
          sb.from('Profile').select('*', { count: 'exact', head: true }),
          sb.from('Conversation').select('*', { count: 'exact', head: true }),
          sb.from('Message').select('*', { count: 'exact', head: true }),
          sb.from('FriendRequest').select('*', { count: 'exact', head: true }),
        ]);
        results.rowCounts = {
          users: uRes.count ?? 0,
          profiles: pRes.count ?? 0,
          conversations: cRes.count ?? 0,
          messages: mRes.count ?? 0,
          friendRequests: frRes.count ?? 0,
        };
      } catch {}
    }

    if (!results.prismaSuccess && !results.supabaseMigrationAttempted) {
      return NextResponse.json(
        { success: false, message: 'Neither Prisma TCP connection nor Supabase HTTPS client is available.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Database initialization and data migration completed.',
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.message === 'FORBIDDEN_ADMIN_ONLY' ? 403 : 500 }
    );
  }
}
