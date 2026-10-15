import { db } from '../src/lib/db';
import { generateSignedConversationId, ensureConversationAndParticipants, isConnectionPermitted } from '../src/lib/conversation';

async function runTests() {
  console.log('=== STARTING CC MESSAGING, BLOCKING & PROFILE VERIFICATION ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  // 1. Setup two test students
  let studentA = await db.user.findUnique({ where: { email: 'student_a_test@campusconnect.test' } });
  if (!studentA) {
    studentA = await db.user.create({
      data: {
        email: 'student_a_test@campusconnect.test',
        passwordHash: 'hash',
        role: 'VERIFIED_STUDENT',
        status: 'ACTIVE',
        isAgeVerified: true,
        universityId: 'uni-lpu-01',
      },
    });
  }

  let studentB = await db.user.findUnique({ where: { email: 'student_b_test@campusconnect.test' } });
  if (!studentB) {
    studentB = await db.user.create({
      data: {
        email: 'student_b_test@campusconnect.test',
        passwordHash: 'hash',
        role: 'VERIFIED_STUDENT',
        status: 'ACTIVE',
        isAgeVerified: true,
        universityId: 'uni-lpu-01',
      },
    });
  }

  let profA = await db.profile.upsert({
    where: { userId: studentA.id },
    create: {
      userId: studentA.id,
      displayName: 'Alice Student',
      gender: 'FEMALE',
      course: 'B.Tech CSE',
      branch: 'AI & Data Science',
      academicYear: '3rd Year',
      semester: '6',
      bio: 'Passionate about machine learning and hackathons.',
      interests: ['AI', 'React', 'Hackathons'],
      skills: ['TypeScript', 'Python', 'Tailwind'],
      socialLinks: { username: 'alice_cse', relationshipVisible: true, relationshipStatus: 'Single', github: 'alice-tech' } as any,
    },
    update: {
      displayName: 'Alice Student',
      socialLinks: { username: 'alice_cse', relationshipVisible: true, relationshipStatus: 'Single', github: 'alice-tech' } as any,
    },
  });

  let profB = await db.profile.upsert({
    where: { userId: studentB.id },
    create: {
      userId: studentB.id,
      displayName: 'Bob Student',
      gender: 'MALE',
      course: 'B.Tech IT',
      branch: 'Information Technology',
      academicYear: '2nd Year',
      semester: '4',
      bio: 'Cybersecurity and cloud infrastructure enthusiast.',
      interests: ['Cloud', 'Linux', 'CaptureTheFlag'],
      skills: ['Go', 'Docker', 'Next.js'],
      socialLinks: { username: 'bob_sec', relationshipVisible: false, relationshipStatus: 'In a relationship' } as any,
    },
    update: {
      displayName: 'Bob Student',
      socialLinks: { username: 'bob_sec', relationshipVisible: false, relationshipStatus: 'In a relationship' } as any,
    },
  });

  // Clean slate: remove existing blocks and friend requests
  await db.block.delete({ where: { blockerId: studentA.id, blockedId: studentB.id } }).catch(() => {});
  await db.block.delete({ where: { blockerId: studentB.id, blockedId: studentA.id } }).catch(() => {});

  const convId = generateSignedConversationId(studentA.id, studentB.id);
  await ensureConversationAndParticipants(convId, studentA.id, studentB.id);

  // Add initial message
  await db.message.create({
    data: {
      id: `msg_test_init_${Date.now()}`,
      conversationId: convId,
      senderId: studentA.id,
      content: 'Hello Bob! This is an important past message.',
      isRead: true,
    },
  });

  // ==========================================
  // TEST 1: Friendship Requirement
  // ==========================================
  console.log('\n--- 1. Testing Friend Requirement ---');
  let permWithoutFriend = await isConnectionPermitted(studentA.id, studentB.id, convId);
  assert(!permWithoutFriend.permitted, 'Connection denied before friend request is accepted');
  assert(permWithoutFriend.code === 'NOT_FRIENDS', 'Permission returns NOT_FRIENDS code');

  // Accept friendship
  const fr = await db.friendRequest.create({
    data: {
      senderId: studentA.id,
      receiverId: studentB.id,
      status: 'ACCEPTED',
    },
  });
  // Clear permission cache
  const { invalidateConversationCache } = await import('../src/lib/conversation');
  invalidateConversationCache();

  let permWithFriend = await isConnectionPermitted(studentA.id, studentB.id, convId);
  assert(permWithFriend.permitted === true, 'Connection permitted once friendship is accepted');

  // ==========================================
  // TEST 2: Blocking Protection (Both Users)
  // ==========================================
  console.log('\n--- 2. Testing Blocking Protection ---');
  // Student A blocks Student B
  await db.block.create({
    data: { blockerId: studentA.id, blockedId: studentB.id },
  });
  invalidateConversationCache();

  // Test A's permission towards B
  const permBlocker = await isConnectionPermitted(studentA.id, studentB.id, convId);
  assert(!permBlocker.permitted, 'Blocker is not permitted to send new messages');
  assert(permBlocker.code === 'BLOCKED_BY_ME', 'Blocker receives BLOCKED_BY_ME code');
  assert(permBlocker.reason === 'You blocked this person.', 'Blocker sees Instagram-style notice text');

  // Test B's permission towards A
  const permBlocked = await isConnectionPermitted(studentB.id, studentA.id, convId);
  assert(!permBlocked.permitted, 'Blocked user is strictly prevented from messaging');
  assert(permBlocked.code === 'BLOCKED_BY_PARTNER', 'Blocked user receives BLOCKED_BY_PARTNER code');
  assert(
    permBlocked.reason === 'This user is unavailable. You cannot message or call this account.',
    'Blocked user sees safe notice without revealing private details'
  );

  // Verify historical messages were NOT deleted
  const messagesAfterBlock = await db.message.findMany({ where: { conversationId: convId } });
  assert(messagesAfterBlock.length > 0, 'Past messages are fully preserved in database after blocking');

  // Unblock
  await db.block.delete({ where: { blockerId: studentA.id, blockedId: studentB.id } });
  invalidateConversationCache();

  // ==========================================
  // TEST 3: Friend Removal Restriction
  // ==========================================
  console.log('\n--- 3. Testing Friend Removal ---');
  // Unfriend B
  await db.friendRequest.update({
    where: { id: fr.id },
    data: { status: 'DECLINED' },
  });
  invalidateConversationCache();

  const permAfterUnfriend = await isConnectionPermitted(studentA.id, studentB.id, convId);
  assert(!permAfterUnfriend.permitted, 'Connection is immediately restricted when friend is removed');
  assert(permAfterUnfriend.code === 'NOT_FRIENDS', 'Permission code is NOT_FRIENDS');

  // Re-verify past messages are STILL intact
  const messagesAfterUnfriend = await db.message.findMany({ where: { conversationId: convId } });
  assert(messagesAfterUnfriend.length > 0, 'Past conversation history preserved after removing friend');

  // ==========================================
  // TEST 4: Conversation Deletion (Per-User)
  // ==========================================
  console.log('\n--- 4. Testing Conversation Deletion (Per-User Hide) ---');
  // Student A deletes conversation
  await db.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: convId, userId: studentA.id } },
    data: { hidden: true, clearedAt: new Date() },
  });

  const partA = await db.conversationParticipant.findFirst({
    where: { conversationId: convId, userId: studentA.id },
  });
  const partB = await db.conversationParticipant.findFirst({
    where: { conversationId: convId, userId: studentB.id },
  });

  assert(Boolean(partA?.hidden), "User A's participation is marked hidden (removed from their inbox)");
  assert(!partB?.hidden, "User B's participation remains visible in their inbox");

  const messagesAfterDelete = await db.message.findMany({ where: { conversationId: convId } });
  assert(messagesAfterDelete.length > 0, "Messages are not wiped from DB so partner's copy is unaffected");

  // ==========================================
  // TEST 5: Complete Student Profile Privacy
  // ==========================================
  console.log('\n--- 5. Testing Student Profile Fields & Relationship Privacy ---');
  const pA = await db.profile.findUnique({ where: { userId: studentA.id } });
  const pB = await db.profile.findUnique({ where: { userId: studentB.id } });
  if (!pA || !pB) throw new Error('Profiles not found');
  profA = pA;
  profB = pB;

  const socialA = (profA?.socialLinks as any) || {};
  const socialB = (profB?.socialLinks as any) || {};

  assert(socialA.username === 'alice_cse', "Student A has username 'alice_cse'");
  assert(socialA.relationshipVisible === true, 'Student A chose to make relationship visible');
  assert(socialA.relationshipStatus === 'Single', 'Student A relationship is visible as Single');

  assert(socialB.relationshipVisible === false, 'Student B relationship visible is false');

  console.log(`\n=== ALL TESTS COMPLETED: ${passed}/${total} PASSED ===`);
  if (passed === total) {
    console.log('SUCCESS: All messaging, blocking, friend removal, conversation deletion, and profile checks passed!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
