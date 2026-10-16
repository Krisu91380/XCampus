import { db } from '../src/lib/db';
import { generateSignedConversationId, ensureConversationAndParticipants, isConnectionPermitted } from '../src/lib/conversation';
import { pushSignal, getSignalsForUser, getActiveCallSignal, clearSignals } from '../src/lib/signaling';

async function runTests() {
  console.log('=== STARTING CC VIDEO CALLING & CONVERSATION DELETION VERIFICATION ===\n');
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
  console.log('--- 1. Setting Up Student Accounts ---');
  let studentA = await db.user.findUnique({ where: { email: 'student_vc_a@campusconnect.test' } });
  if (!studentA) {
    studentA = await db.user.create({
      data: {
        email: 'student_vc_a@campusconnect.test',
        passwordHash: 'hash',
        role: 'VERIFIED_STUDENT',
        status: 'ACTIVE',
        isAgeVerified: true,
        universityId: 'uni-lpu-01',
      },
    });
  }

  let studentB = await db.user.findUnique({ where: { email: 'student_vc_b@campusconnect.test' } });
  if (!studentB) {
    studentB = await db.user.create({
      data: {
        email: 'student_vc_b@campusconnect.test',
        passwordHash: 'hash',
        role: 'VERIFIED_STUDENT',
        status: 'ACTIVE',
        isAgeVerified: true,
        universityId: 'uni-lpu-01',
      },
    });
  }

  await db.profile.upsert({
    where: { userId: studentA.id },
    create: {
      userId: studentA.id,
      displayName: 'Call Student A',
      gender: 'FEMALE',
      course: 'B.Tech CSE',
      academicYear: '3rd Year',
      bio: 'Ready for video calls.',
      interests: ['WebRTC', 'Next.js'],
      skills: ['TypeScript'],
    },
    update: { displayName: 'Call Student A' },
  });

  await db.profile.upsert({
    where: { userId: studentB.id },
    create: {
      userId: studentB.id,
      displayName: 'Call Student B',
      gender: 'MALE',
      course: 'B.Tech IT',
      academicYear: '2nd Year',
      bio: 'Enthusiastic collaborator.',
      interests: ['P2P', 'React'],
      skills: ['Go'],
    },
    update: { displayName: 'Call Student B' },
  });

  // Ensure friendship
  let existingFr = await db.friendRequest.findFirst({
    where: { senderId: studentA.id, receiverId: studentB.id },
  });
  if (existingFr) {
    await db.friendRequest.update({ where: { id: existingFr.id }, data: { status: 'ACCEPTED' } });
  } else {
    await db.friendRequest.create({
      data: {
        senderId: studentA.id,
        receiverId: studentB.id,
        status: 'ACCEPTED',
      },
    });
  }

  const convId = generateSignedConversationId(studentA.id, studentB.id);
  await ensureConversationAndParticipants(convId, studentA.id, studentB.id);
  await clearSignals(convId);

  // ==========================================
  // TEST 1: Video Calling Call Initiation & Incoming Notification
  // ==========================================
  console.log('\n--- 2. Testing Video Call Flow (Account A -> Account B) ---');

  // Student A sends call-request
  const callRequestSignal = await pushSignal({
    conversationId: convId,
    fromUserId: studentA.id,
    toUserId: studentB.id,
    type: 'call-request',
    payload: { isVideo: true, sessionId: 'session_test_1' },
  });
  assert(Boolean(callRequestSignal.id), 'Student A successfully initiates call-request');

  // Student B polls incoming calls
  const incoming = await getActiveCallSignal(convId, studentB.id);
  assert(incoming !== null, 'Student B receives incoming call notification');
  assert(incoming?.fromUserId === studentA.id, 'Incoming call correctly identifies Student A as caller');

  // Student B accepts call
  await pushSignal({
    conversationId: convId,
    fromUserId: studentB.id,
    toUserId: studentA.id,
    type: 'call-accept',
    payload: { sessionId: 'session_test_1' },
  });

  // After accept, incoming signal is cleared so ringtone stops
  const incomingAfterAccept = await getActiveCallSignal(convId, studentB.id);
  assert(incomingAfterAccept === null, 'Active incoming alert clears once call is answered');

  // ==========================================
  // TEST 2: SDP Offer, Answer & ICE Candidate Exchange
  // ==========================================
  console.log('\n--- 3. Testing SDP Offer/Answer and ICE Negotiation ---');

  // Student A (offerer) sends offer
  const testOffer = { type: 'offer', sdp: 'v=0\r\no=alice 123 456 IN IP4 127.0.0.1\r\ns=test\r\n' };
  await pushSignal({
    conversationId: convId,
    fromUserId: studentA.id,
    toUserId: studentB.id,
    type: 'offer',
    payload: { sessionId: 'session_test_1', data: testOffer },
  });

  // Student B fetches signals and receives offer
  const signalsForB = await getSignalsForUser(convId, studentB.id, 0);
  const receivedOffer = signalsForB.find((s) => s.type === 'offer');
  assert(Boolean(receivedOffer), 'Student B successfully receives SDP offer');
  assert(receivedOffer?.payload?.data?.type === 'offer', 'Received offer contains valid SDP description');

  // Student B creates and sends answer
  const testAnswer = { type: 'answer', sdp: 'v=0\r\no=bob 789 101 IN IP4 127.0.0.1\r\ns=test\r\n' };
  await pushSignal({
    conversationId: convId,
    fromUserId: studentB.id,
    toUserId: studentA.id,
    type: 'answer',
    payload: { sessionId: 'session_test_1', data: testAnswer },
  });

  // Student A receives answer
  const signalsForA = await getSignalsForUser(convId, studentA.id, 0);
  const receivedAnswer = signalsForA.find((s) => s.type === 'answer');
  assert(Boolean(receivedAnswer), 'Student A successfully receives SDP answer');

  // Both exchange ICE candidates
  const candA = { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 };
  const candB = { candidate: 'candidate:2 1 UDP 2130706431 192.168.1.101 50001 typ host', sdpMid: '0', sdpMLineIndex: 0 };
  await pushSignal({
    conversationId: convId,
    fromUserId: studentA.id,
    toUserId: studentB.id,
    type: 'ice-candidate',
    payload: { sessionId: 'session_test_1', data: candA },
  });
  await pushSignal({
    conversationId: convId,
    fromUserId: studentB.id,
    toUserId: studentA.id,
    type: 'ice-candidate',
    payload: { sessionId: 'session_test_1', data: candB },
  });

  const updatedSignalsB = await getSignalsForUser(convId, studentB.id, 0);
  const receivedCandB = updatedSignalsB.find((s) => s.type === 'ice-candidate' && s.fromUserId === studentA.id);
  assert(Boolean(receivedCandB), 'Student B receives ICE candidates from Student A');

  // ==========================================
  // TEST 3: Hangup and Clean Re-initiation
  // ==========================================
  console.log('\n--- 4. Testing Call Hangup & Immediate Fresh Re-call ---');
  // Student B ends call
  await pushSignal({
    conversationId: convId,
    fromUserId: studentB.id,
    toUserId: studentA.id,
    type: 'call-end',
    payload: { sessionId: 'session_test_1' },
  });

  const activeCallAfterEnd = await getActiveCallSignal(convId, studentB.id);
  assert(activeCallAfterEnd === null, 'No active incoming call remains after call-end');

  // Start fresh second call without stale state
  await clearSignals(convId);
  const freshCall = await pushSignal({
    conversationId: convId,
    fromUserId: studentB.id,
    toUserId: studentA.id,
    type: 'call-request',
    payload: { isVideo: true, sessionId: 'session_test_2' },
  });
  assert(Boolean(freshCall.id), 'A fresh second call can be initiated immediately');
  const freshIncoming = await getActiveCallSignal(convId, studentA.id);
  assert(freshIncoming?.fromUserId === studentB.id, 'Student A sees fresh incoming call from Student B');

  // Clean up fresh call
  await pushSignal({
    conversationId: convId,
    fromUserId: studentA.id,
    toUserId: studentB.id,
    type: 'call-end',
    payload: { sessionId: 'session_test_2' },
  });
  await clearSignals(convId);

  // ==========================================
  // TEST 4: Conversation Deletion (Per-User)
  // ==========================================
  console.log('\n--- 5. Testing Delete Conversation (Per-User Isolation) ---');
  // Add test messages
  const msg1 = await db.message.create({
    data: {
      id: `msg_del_test_1_${Date.now()}`,
      conversationId: convId,
      senderId: studentA.id,
      content: 'Hey Bob, this message should hide for Alice when deleted.',
      isRead: true,
    },
  });
  const msg2 = await db.message.create({
    data: {
      id: `msg_del_test_2_${Date.now()}`,
      conversationId: convId,
      senderId: studentB.id,
      content: 'Sure Alice, but I should still see it!',
      isRead: true,
    },
  });

  // Student A deletes the conversation
  const deleteTimestamp = new Date();
  await db.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId: convId, userId: studentA.id },
      conversationId: convId,
      userId: studentA.id,
    },
    data: {
      hidden: true,
      leftAt: deleteTimestamp,
      clearedAt: deleteTimestamp,
      hasUnread: false,
    },
  });

  // Check Student A's participant state
  const partA = await db.conversationParticipant.findFirst({
    where: { conversationId: convId, userId: studentA.id },
  });
  const partB = await db.conversationParticipant.findFirst({
    where: { conversationId: convId, userId: studentB.id },
  });

  assert(Boolean(partA?.hidden), "Student A's participation is marked hidden");
  assert(Boolean(partA?.leftAt), "Student A has leftAt deletion timestamp recorded");
  assert(!partB?.hidden, "Student B's participation remains completely visible (hidden = false)");
  assert(!partB?.leftAt, "Student B has no leftAt deletion timestamp");

  // Verify message history isolation
  // Student A queries messages with afterTimestamp: partA.leftAt
  const messagesForA = await db.message.findMany({
    where: {
      conversationId: convId,
      afterTimestamp: partA?.clearedAt || partA?.leftAt || undefined,
    },
  });
  assert(messagesForA.length === 0, 'Old messages are hidden from Student A after deletion');

  // Student B queries messages with afterTimestamp: partB.leftAt (null)
  const messagesForB = await db.message.findMany({
    where: {
      conversationId: convId,
      afterTimestamp: partB?.clearedAt || partB?.leftAt || undefined,
    },
  });
  assert(messagesForB.length >= 2, 'Student B still sees all original messages');

  // Verify friendship is UNCHANGED
  const fr = await db.friendRequest.findFirst({
    where: { senderId: studentA.id, receiverId: studentB.id },
  });
  assert(fr?.status === 'ACCEPTED', 'Friendship is preserved and NOT deleted');

  // If Student B sends a NEW message after Alice deleted:
  const newMsg = await db.message.create({
    data: {
      id: `msg_del_test_new_${Date.now()}`,
      conversationId: convId,
      senderId: studentB.id,
      content: 'A new message after deletion!',
      isRead: false,
    },
  });

  const messagesForAAfterNew = await db.message.findMany({
    where: {
      conversationId: convId,
      afterTimestamp: partA?.clearedAt || partA?.leftAt || undefined,
    },
  });
  assert(messagesForAAfterNew.length === 1, 'Only new messages sent after deletion appear for Student A');
  assert(messagesForAAfterNew[0].id === newMsg.id, 'New message content matches');

  console.log(`\n=== ALL TESTS COMPLETED: ${passed}/${total} PASSED ===`);
  if (passed === total) {
    console.log('SUCCESS: Video calling, signaling, hangup, and per-user conversation deletion passed perfectly!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
