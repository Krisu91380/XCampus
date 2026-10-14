const fs = require('fs');

const sql = fs.readFileSync('prisma/prisma_schema_safe.sql', 'utf-8');

// Split up to '-- AddForeignKey'
const fkSplitIndex = sql.indexOf('-- AddForeignKey');
if (fkSplitIndex === -1) {
  console.error('Could not find -- AddForeignKey in sql');
  process.exit(1);
}

const baseDdl = sql.substring(0, fkSplitIndex).trim();
const rawFkSection = sql.substring(fkSplitIndex);

// Parse all ALTER TABLE ... ADD CONSTRAINT statements
const fkRegex = /ALTER\s+TABLE\s+"([^"]+)"\s+ADD\s+CONSTRAINT\s+"([^"]+)"\s+FOREIGN\s+KEY\s+\("([^"]+)"\)\s+REFERENCES\s+"([^"]+)"\("([^"]+)"\)\s+ON\s+DELETE\s+([A-Za-z ]+)\s+ON\s+UPDATE\s+([A-Za-z ]+);/gi;

let m;
const constraints = [];
while ((m = fkRegex.exec(rawFkSection)) !== null) {
  constraints.push({
    table: m[1],
    conname: m[2],
    col: m[3],
    refTable: m[4],
    refCol: m[5],
    onDelete: m[6].trim(),
    onUpdate: m[7].trim()
  });
}

console.log(`Found ${constraints.length} foreign key constraints to make idempotent.`);

let fkBlock = `-- ==============================================================================
-- AddForeignKeys (wrapped in DO $$ BEGIN ... END $$ for 100% idempotency)
-- ==============================================================================
DO $$ BEGIN
`;

for (const c of constraints) {
  fkBlock += `  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${c.conname}') THEN\n`;
  fkBlock += `    ALTER TABLE "${c.table}" ADD CONSTRAINT "${c.conname}" FOREIGN KEY ("${c.col}") REFERENCES "${c.refTable}"("${c.refCol}") ON DELETE ${c.onDelete} ON UPDATE ${c.onUpdate};\n`;
  fkBlock += `  END IF;\n`;
}

fkBlock += `END $$;\n`;

const banner = `-- ==============================================================================
-- CAMPUSCONNECT: SAFE SUPABASE POSTGRESQL INITIALIZATION DDL
-- IDEMPOTENT: SAFE TO RUN REPEATEDLY WITHOUT DELETING OR OVERWRITING ANY DATA
-- ALL TABLES USE: CREATE TABLE IF NOT EXISTS
-- ALL INDEXES USE: CREATE INDEX IF NOT EXISTS
-- ALL CONSTRAINTS CHECK IF NOT EXISTS BEFORE CREATING
-- ==============================================================================

`;

const finalSql = banner + baseDdl + '\n\n' + fkBlock;

fs.writeFileSync('prisma/prisma_schema_safe.sql', finalSql, 'utf-8');
console.log('Successfully wrote updated prisma/prisma_schema_safe.sql (' + finalSql.length + ' bytes)');

// Also sync with src/lib/schema-sql.ts
const tsContent = 'export const PRISMA_SCHEMA_SAFE_SQL = ' + JSON.stringify(finalSql) + ';\n';
fs.writeFileSync('src/lib/schema-sql.ts', tsContent, 'utf-8');
console.log('Successfully synced src/lib/schema-sql.ts (' + tsContent.length + ' bytes)');
