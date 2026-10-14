const fs = require('fs');

const prismaSchema = fs.readFileSync('prisma/schema.prisma', 'utf-8');
const sql = fs.readFileSync('prisma/prisma_schema_safe.sql', 'utf-8');

// Extract all models from schema.prisma
const models = [];
const modelRegex = /model\s+([A-Za-z0-9_]+)\s*\{([^}]+)\}/g;
let m;
while ((m = modelRegex.exec(prismaSchema)) !== null) {
  const modelName = m[1];
  const body = m[2];
  const fields = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const fieldName = parts[0];
      const fieldType = parts[1];
      // Skip relation fields
      if (fieldType.endsWith('[]') || parts.some(p => p.includes('@relation'))) {
        continue;
      }
      fields.push({ fieldName, fieldType });
    }
  }
  models.push({ modelName, fields });
}

console.log('Prisma Models found:', models.length);
models.forEach(mod => console.log(' - ' + mod.modelName + ' (' + mod.fields.length + ' scalar fields)'));

// Check which tables are created in the SQL
const createdTables = [];
const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([A-Za-z0-9_]+)["']?\s*\(/gi;
while ((m = createTableRegex.exec(sql)) !== null) {
  createdTables.push(m[1]);
}
console.log('\nSQL Created Tables:', createdTables.length);
createdTables.forEach(t => console.log(' - ' + t));

// Compare models
const missingInSql = models.filter(mod => !createdTables.includes(mod.modelName));
console.log('\nMissing in SQL:', missingInSql.map(m => m.modelName));

// Check every model's fields in SQL
console.log('\nChecking field completeness for each table:');
for (const mod of models) {
  // Find table definition in SQL
  const tableDefRegex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["']?${mod.modelName}["']?\\s*\\(([\\s\\S]*?)\\);`, 'i');
  const match = sql.match(tableDefRegex);
  if (!match) {
    console.error(`Table ${mod.modelName} definition NOT found in SQL!`);
    continue;
  }
  const tableBody = match[1];
  const missingFields = [];
  for (const f of mod.fields) {
    const fieldRegex = new RegExp(`["']?${f.fieldName}["']?\\s+`, 'i');
    if (!fieldRegex.test(tableBody)) {
      missingFields.push(f.fieldName);
    }
  }
  if (missingFields.length > 0) {
    console.warn(`[WARNING] Table ${mod.modelName} missing fields in SQL:`, missingFields);
  } else {
    console.log(`✓ Table ${mod.modelName}: all ${mod.fields.length} scalar fields present in SQL.`);
  }
}
