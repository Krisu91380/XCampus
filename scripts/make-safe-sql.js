const fs = require('fs');

const originalSql = fs.readFileSync('prisma/prisma_schema.sql', 'utf8');

let safeSql = originalSql;
safeSql = safeSql.split('CREATE TABLE "').join('CREATE TABLE IF NOT EXISTS "');
safeSql = safeSql.split('CREATE UNIQUE INDEX "').join('CREATE UNIQUE INDEX IF NOT EXISTS "');
safeSql = safeSql.split('CREATE INDEX "').join('CREATE INDEX IF NOT EXISTS "');

// Prepend uuid-ossp extension
safeSql = 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n' + safeSql;

fs.writeFileSync('prisma/prisma_schema_safe.sql', safeSql, 'utf8');
console.log('Successfully written prisma/prisma_schema_safe.sql with length:', safeSql.length);
