import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { migrateJsonToPostgres } from '@/lib/migrate-to-postgres';
import { PRISMA_SCHEMA_SAFE_SQL } from '@/lib/schema-sql';

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

    let testDbUrlResult: { success: boolean; error?: string; tables?: string[] } = { success: false };
    let testDirectUrlResult: { success: boolean; error?: string; tables?: string[] } = { success: false };

    // Test DATABASE_URL
    if (process.env.DATABASE_URL) {
      const client = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL } },
      });
      try {
        const rows: any = await client.$queryRaw`
          SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
        `;
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

    // Test DIRECT_URL
    if (process.env.DIRECT_URL) {
      const directClient = new PrismaClient({
        datasources: { db: { url: process.env.DIRECT_URL } },
      });
      try {
        const rows: any = await directClient.$queryRaw`
          SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
        `;
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

    return NextResponse.json({
      success: true,
      admin: session.email,
      diagnostics: {
        DATABASE_URL: dbUrlMeta,
        DIRECT_URL: directUrlMeta,
        sameProject,
        testDbUrlResult,
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

    // Choose best working URL (prefer DIRECT_URL for DDL migrations, fallback to DATABASE_URL)
    const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!migrationUrl) {
      return NextResponse.json(
        { success: false, message: 'Neither DIRECT_URL nor DATABASE_URL configured.' },
        { status: 500 }
      );
    }

    const prisma = new PrismaClient({
      datasources: { db: { url: migrationUrl } },
    });

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

      // 4. Run JSON-to-PostgreSQL migration
      try {
        await migrateJsonToPostgres(prisma);
        results.migrationSuccess = true;
      } catch (migErr: any) {
        results.migrationSuccess = false;
        results.ddlErrors.push(`Data migration notice: ${migErr.message}`);
      }

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
