const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || process.env.DIRECT_URL,
    },
  },
});

async function test() {
  console.log('Querying PostgreSQL Profile table directly with Prisma...');
  const userId = 'user-student-krish';
  const prof = await prisma.profile.findUnique({ where: { userId } });
  console.log('Current DB row for user-student-krish:', prof);
  await prisma.$disconnect();
}

test().catch((err) => {
  console.error('Prisma test error:', err);
  prisma.$disconnect();
});

