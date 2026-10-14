const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('prisma/data_store.json', 'utf-8'));

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function dateEsc(val) {
  if (!val) return 'NOW()';
  return `'${new Date(val).toISOString()}'`;
}

let sql = `-- ==============================================================================
-- CAMPUSCONNECT: SEED PRODUCTION DATA INTO SUPABASE POSTGRESQL
-- IDEMPOTENT: Uses ON CONFLICT DO NOTHING so no existing or newer data is replaced
-- ==============================================================================

`;

// 1. Universities
sql += `-- 1. Universities\n`;
if (Array.isArray(data.universities)) {
  for (const [id, u] of data.universities) {
    sql += `INSERT INTO "University" ("id", "name", "code", "city", "state", "country", "approvedDomains", "isActive", "logoUrl", "verificationRequirements", "createdAt", "updatedAt")\n`;
    sql += `VALUES (${esc(u.id)}, ${esc(u.name)}, ${esc(u.code)}, ${esc(u.city)}, ${esc(u.state)}, ${esc(u.country || 'India')}, ${esc(JSON.stringify(u.approvedDomains || []))}, ${u.isActive !== false ? 'TRUE' : 'FALSE'}, ${esc(u.logoUrl || null)}, ${esc(u.verificationRequirements || 'Institutional email or ID')}, ${dateEsc(u.createdAt)}, ${dateEsc(u.updatedAt)})\n`;
    sql += `ON CONFLICT ("code") DO NOTHING;\n\n`;
  }
}

// 2. Users
sql += `-- 2. Users\n`;
if (Array.isArray(data.users)) {
  for (const [id, u] of data.users) {
    sql += `INSERT INTO "User" ("id", "email", "passwordHash", "role", "status", "isAgeVerified", "dateOfBirth", "universityId", "createdAt", "updatedAt")\n`;
    sql += `VALUES (${esc(u.id)}, ${esc(u.email.toLowerCase().trim())}, ${esc(u.passwordHash)}, ${esc(u.role || 'USER')}, ${esc(u.status || 'ACTIVE')}, ${u.isAgeVerified !== false ? 'TRUE' : 'FALSE'}, ${u.dateOfBirth ? dateEsc(u.dateOfBirth) : 'NULL'}, ${esc(u.universityId || null)}, ${dateEsc(u.createdAt)}, ${dateEsc(u.updatedAt)})\n`;
    sql += `ON CONFLICT ("email") DO NOTHING;\n\n`;
  }
}

// 3. Profiles
sql += `-- 3. Profiles\n`;
if (Array.isArray(data.profiles)) {
  for (const [userId, p] of data.profiles) {
    const profileId = p.id || `profile-${userId}`;
    sql += `INSERT INTO "Profile" ("id", "userId", "displayName", "gender", "avatarUrl", "bio", "course", "academicYear", "language", "interests", "isOnline", "isDiscoverable", "lastSeenAt", "createdAt", "updatedAt")\n`;
    sql += `VALUES (${esc(profileId)}, ${esc(userId)}, ${esc(p.displayName || 'Student')}, ${esc(p.gender || 'PREFER_NOT_TO_SAY')}, ${esc(p.avatarUrl || null)}, ${esc(p.bio || null)}, ${esc(p.course || null)}, ${esc(p.academicYear || null)}, ${esc(p.language || 'English')}, ${esc(JSON.stringify(p.interests || []))}, ${p.isOnline ? 'TRUE' : 'FALSE'}, ${p.isDiscoverable !== false ? 'TRUE' : 'FALSE'}, ${dateEsc(p.lastSeenAt)}, ${dateEsc(p.createdAt)}, ${dateEsc(p.updatedAt)})\n`;
    sql += `ON CONFLICT ("userId") DO NOTHING;\n\n`;
  }
}

// 4. Credit Packages
sql += `-- 4. Credit Packages\n`;
if (Array.isArray(data.creditPackages)) {
  for (const [id, pkg] of data.creditPackages) {
    sql += `INSERT INTO "CreditPackage" ("id", "name", "credits", "priceInInr", "description", "isPopular", "isActive", "createdAt", "updatedAt")\n`;
    sql += `VALUES (${esc(pkg.id)}, ${esc(pkg.name)}, ${pkg.credits}, ${pkg.priceInInr}, ${esc(pkg.description || '')}, ${pkg.isPopular ? 'TRUE' : 'FALSE'}, ${pkg.isActive !== false ? 'TRUE' : 'FALSE'}, ${dateEsc(pkg.createdAt)}, ${dateEsc(pkg.updatedAt)})\n`;
    sql += `ON CONFLICT ("id") DO NOTHING;\n\n`;
  }
}

// 5. Credit Balances
sql += `-- 5. User Credit Balances\n`;
if (Array.isArray(data.creditBalances)) {
  for (const [userId, bal] of data.creditBalances) {
    const balId = bal.id || `bal-${userId}`;
    sql += `INSERT INTO "UserCreditBalance" ("id", "userId", "credits", "updatedAt")\n`;
    sql += `VALUES (${esc(balId)}, ${esc(userId)}, ${bal.credits || 5}, ${dateEsc(bal.updatedAt)})\n`;
    sql += `ON CONFLICT ("userId") DO NOTHING;\n\n`;
  }
}

// 6. Conversations
sql += `-- 6. Conversations\n`;
if (Array.isArray(data.conversations)) {
  for (const [id, conv] of data.conversations) {
    sql += `INSERT INTO "Conversation" ("id", "status", "startedAt", "endedAt", "endedByUserId", "endReason", "creditDeducted")\n`;
    sql += `VALUES (${esc(conv.id)}, ${esc(conv.status || 'ACTIVE')}, ${dateEsc(conv.startedAt)}, ${conv.endedAt ? dateEsc(conv.endedAt) : 'NULL'}, ${esc(conv.endedByUserId || null)}, ${esc(conv.endReason || null)}, ${conv.creditDeducted !== false ? 'TRUE' : 'FALSE'})\n`;
    sql += `ON CONFLICT ("id") DO NOTHING;\n\n`;
  }
}

// 7. Conversation Participants
sql += `-- 7. Conversation Participants\n`;
if (Array.isArray(data.conversationParticipants)) {
  for (const [id, p] of data.conversationParticipants) {
    sql += `INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId", "joinedAt", "leftAt", "hasUnread")\n`;
    sql += `VALUES (${esc(p.id)}, ${esc(p.conversationId)}, ${esc(p.userId)}, ${dateEsc(p.joinedAt)}, ${p.leftAt ? dateEsc(p.leftAt) : 'NULL'}, ${p.hasUnread ? 'TRUE' : 'FALSE'})\n`;
    sql += `ON CONFLICT ("conversationId", "userId") DO NOTHING;\n\n`;
  }
}

// 8. Messages
sql += `-- 8. Messages\n`;
if (Array.isArray(data.messages)) {
  for (const [id, m] of data.messages) {
    sql += `INSERT INTO "Message" ("id", "conversationId", "senderId", "content", "isRead", "createdAt")\n`;
    sql += `VALUES (${esc(m.id)}, ${esc(m.conversationId)}, ${esc(m.senderId)}, ${esc(m.content)}, ${m.isRead ? 'TRUE' : 'FALSE'}, ${dateEsc(m.createdAt)})\n`;
    sql += `ON CONFLICT ("id") DO NOTHING;\n\n`;
  }
}

// 9. Friend Requests
sql += `-- 9. Friend Requests\n`;
if (Array.isArray(data.friendRequests)) {
  for (const [id, fr] of data.friendRequests) {
    sql += `INSERT INTO "FriendRequest" ("id", "senderId", "receiverId", "status", "createdAt", "updatedAt")\n`;
    sql += `VALUES (${esc(fr.id)}, ${esc(fr.senderId)}, ${esc(fr.receiverId)}, ${esc(fr.status || 'ACCEPTED')}, ${dateEsc(fr.createdAt)}, ${dateEsc(fr.updatedAt)})\n`;
    sql += `ON CONFLICT ("senderId", "receiverId") DO NOTHING;\n\n`;
  }
}

fs.writeFileSync('prisma/seed_production_data.sql', sql, 'utf-8');
console.log('Successfully generated prisma/seed_production_data.sql with ' + sql.length + ' bytes');
