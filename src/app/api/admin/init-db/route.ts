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

async function withTimeout<T>(promise: Promise<T>, ms: number = 2000): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Connection timeout after ${ms}ms`)), ms);
  });
  try {
    const res = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
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

    // 1. Test Supabase JS Client (HTTPS PostgREST API) first - fast and reliable
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

    let testDbUrlResult: { success: boolean; error?: string; tables?: string[]; rowCounts?: Record<string, any> } = { success: false };
    let testSessionPoolerResult: { success: boolean; error?: string; tables?: string[]; rowCounts?: Record<string, any> } = { success: false };
    let testDirectUrlResult: { success: boolean; error?: string; tables?: string[]; rowCounts?: Record<string, any> } = { success: false };

    // 2. Test DATABASE_URL (Transaction pooler) with fast timeout
    if (process.env.DATABASE_URL) {
      let poolerUrl = process.env.DATABASE_URL;
      if (!poolerUrl.includes('pgbouncer=true')) {
        poolerUrl += (poolerUrl.includes('?') ? '&' : '?') + 'pgbouncer=true&connection_limit=1';
      }
      const client = new PrismaClient({ datasources: { db: { url: poolerUrl } } });
      try {
        const rows: any = await withTimeout(
          client.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`,
          2000
        );
        testDbUrlResult = {
          success: true,
          tables: Array.isArray(rows) ? rows.map((r: any) => r.table_name) : [],
        };
      } catch (e: any) {
        testDbUrlResult = { success: false, error: e.message };
      } finally {
        await client.$disconnect().catch(() => {});
      }
    }

    // 3. Test Session Pooler with fast timeout
    if (process.env.DATABASE_URL) {
      try {
        const u = new URL(process.env.DATABASE_URL);
        u.port = '5432';
        u.search = '';
        const sessionClient = new PrismaClient({ datasources: { db: { url: u.toString() } } });
        try {
          const rows: any = await withTimeout(
            sessionClient.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`,
            2000
          );
          testSessionPoolerResult = {
            success: true,
            tables: Array.isArray(rows) ? rows.map((r: any) => r.table_name) : [],
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

    // 4. Test DIRECT_URL with fast timeout
    if (process.env.DIRECT_URL) {
      const directClient = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
      try {
        const rows: any = await withTimeout(
          directClient.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`,
          2000
        );
        testDirectUrlResult = {
          success: true,
          tables: Array.isArray(rows) ? rows.map((r: any) => r.table_name) : [],
        };
      } catch (e: any) {
        testDirectUrlResult = { success: false, error: e.message };
      } finally {
        await directClient.$disconnect().catch(() => {});
      }
    }

    const supabaseUrlMeta = process.env.SUPABASE_URL ? {
      rawLength: process.env.SUPABASE_URL.length,
      protocol: (() => { try { return new URL(process.env.SUPABASE_URL.trim()).protocol; } catch { return 'invalid'; } })(),
      hostname: (() => { try { return new URL(process.env.SUPABASE_URL.trim()).hostname; } catch { return 'invalid'; } })(),
      pathname: (() => { try { return new URL(process.env.SUPABASE_URL.trim()).pathname; } catch { return 'invalid'; } })(),
      hasQuotes: /^["']|["']$/.test(process.env.SUPABASE_URL.trim()),
    } : null;

    return NextResponse.json({
      success: true,
      admin: session.email,
      diagnostics: {
        DATABASE_URL: dbUrlMeta,
        DIRECT_URL: directUrlMeta,
        SUPABASE_URL: supabaseUrlMeta,
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
      supabaseMigrationAttempted: boolean;
      supabaseMigrationSuccess: boolean;
      supabaseMigrationDetails?: any;
      prismaAttempted: boolean;
      prismaSuccess: boolean;
      ddlSuccess: boolean;
      ddlStatementsRun: number;
      ddlErrors: string[];
      prismaMigrationSuccess?: boolean;
      rowCounts: { users: number; profiles: number; conversations: number; messages: number; friendRequests: number };
    } = {
      supabaseMigrationAttempted: false,
      supabaseMigrationSuccess: false,
      prismaAttempted: false,
      prismaSuccess: false,
      ddlSuccess: false,
      ddlStatementsRun: 0,
      ddlErrors: [],
      rowCounts: { users: 0, profiles: 0, conversations: 0, messages: 0, friendRequests: 0 },
    };

    // 1. Supabase PostgREST Migration (over HTTPS port 443 - executed first so migration is fast and never blocked by TCP timeouts)
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

    // 2. Try Prisma direct / pooler connection if available (with 1500ms timeout per URL)
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
          await withTimeout(p.$queryRaw`SELECT 1`, 1500);
          prisma = p;
          break;
        } catch {}
      }

      if (prisma) {
        try {
          results.prismaSuccess = true;
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
