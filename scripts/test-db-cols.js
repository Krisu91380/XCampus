const fs = require('fs');

const data = JSON.parse(fs.readFileSync('prisma/data_store.json', 'utf8'));
console.log('Keys in data_store.json:', Object.keys(data));
console.log('--- PROFILES ---');
for (const [id, prof] of data.profiles) {
  console.log('Profile ID:', id, 'userId:', prof.userId, 'displayName:', prof.displayName, 'avatarUrl:', prof.avatarUrl);
}
console.log('--- BLOCKS ---');
console.log(data.blocks);
console.log('--- CONVERSATION PARTICIPANTS ---');
console.log(data.conversationParticipants.slice(0, 5));
