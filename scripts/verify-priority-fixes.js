const BASE_URL = process.env.BASE_URL || 'https://x-campus.vercel.app';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, headers: res.headers, data: json };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function run() {
  console.log(`🚀 Starting Comprehensive Production Verification on ${BASE_URL}...\n`);

  // --- Test 0: Service Health & Universities ---
  console.log('--- TEST 0: Health & University Data ---');
  const uniRes = await request('/api/universities');
  assert(uniRes.status === 200 && uniRes.data.success, 'Universities endpoint reachable');
  const lpu = uniRes.data.universities.find((u) => u.code === 'LPU') || uniRes.data.universities[0];
  assert(Boolean(lpu), `Found default university: ${lpu?.name}`);

  // --- Test 1: Student Account Logins ---
  console.log('\n--- TEST 1: Authentication & User Persistence ---');
  let userAEmail = `student_a_${Date.now()}@lpu.in`;
  let userBEmail = `student_b_${Date.now()}@lpu.in`;

  // Register Student A
  const regARes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: userAEmail,
      password: 'StudentPass123!',
      displayName: 'Arjun Verma',
      dateOfBirth: '2003-05-15',
      universityId: lpu.id,
      gender: 'MALE',
      course: 'B.Tech CSE',
      academicYear: '2nd Year',
      language: 'English',
      interests: ['Coding', 'Robotics'],
      termsAccepted: true,
    }),
  });
  assert(regARes.status === 201 && regARes.data.success, 'Student A registered successfully');
  const cookieA = regARes.headers.get('set-cookie');

  // Register Student B
  const regBRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: userBEmail,
      password: 'StudentPass123!',
      displayName: 'Pooja Nair',
      dateOfBirth: '2004-02-20',
      universityId: lpu.id,
      gender: 'FEMALE',
      course: 'B.Tech CSE',
      academicYear: '1st Year',
      language: 'English',
      interests: ['Design', 'AI'],
      termsAccepted: true,
    }),
  });
  assert(regBRes.status === 201 && regBRes.data.success, 'Student B registered successfully');
  const cookieB = regBRes.headers.get('set-cookie');

  // Verify Student A profile & credit balance
  const meARes = await request('/api/auth/me', { headers: { Cookie: cookieA } });
  assert(meARes.status === 200 && meARes.data.user.credits >= 5, 'Student A starts with 5 credits');

  // --- Test 2: Priority 1 — Real-Time Matchmaking Queue ---
  console.log('\n--- TEST 2: Priority 1 — Real-Time Matchmaking Queue & Atomic Pairing ---');
  // Student A enters queue
  const queueARes = await request('/api/match/queue', {
    method: 'POST',
    headers: { Cookie: cookieA },
    body: JSON.stringify({
      targetUniversityId: null,
      userGender: 'MALE',
      preferredPartnerGender: 'EVERYONE',
      language: 'English',
      course: null,
    }),
  });
  assert(queueARes.status === 200 && queueARes.data.success, 'Student A joined match queue');

  // Student B enters queue and pairs atomically with Student A
  const queueBRes = await request('/api/match/queue', {
    method: 'POST',
    headers: { Cookie: cookieB },
    body: JSON.stringify({
      targetUniversityId: null,
      userGender: 'FEMALE',
      preferredPartnerGender: 'EVERYONE',
      language: 'English',
      course: null,
    }),
  });
  assert(queueBRes.status === 200 && queueBRes.data.success, 'Student B entered matchmaking request');
  assert(queueBRes.data.matched === true, 'Student B paired immediately with Student A');
  const conversationId = queueBRes.data.conversationId;
  assert(Boolean(conversationId), `Matched Conversation ID created: ${conversationId}`);

  // Verify Student A polling also sees the match
  const queueCheckARes = await request('/api/match/queue', { headers: { Cookie: cookieA } });
  assert(
    queueCheckARes.data.matched === true && queueCheckARes.data.conversationId === conversationId,
    'Student A polling retrieved identical conversation ID'
  );

  // Verify credit deduction happened exactly once
  const meAAfterMatch = await request('/api/auth/me', { headers: { Cookie: cookieA } });
  assert(meAAfterMatch.data.user.credits === meARes.data.user.credits - 1, 'Student A deducted exactly 1 credit for match');

  // Cancel search test (0 credit deduction)
  console.log('\n--- TEST 2b: Match Cancellation Without Credit Deduction ---');
  const userCRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `student_c_${Date.now()}@lpu.in`,
      password: 'StudentPass123!',
      displayName: 'Kabir Das',
      dateOfBirth: '2003-01-01',
      universityId: lpu.id,
      gender: 'MALE',
      termsAccepted: true,
    }),
  });
  const cookieC = userCRes.headers.get('set-cookie');
  const meCInit = await request('/api/auth/me', { headers: { Cookie: cookieC } });
  const initialCreditsC = meCInit.data.user.credits;

  // C joins queue
  await request('/api/match/queue', {
    method: 'POST',
    headers: { Cookie: cookieC },
    body: JSON.stringify({
      targetUniversityId: 'non-existent-uni',
      userGender: 'MALE',
      preferredPartnerGender: 'EVERYONE',
    }),
  });

  // C cancels search
  const cancelRes = await request('/api/match/queue', {
    method: 'DELETE',
    headers: { Cookie: cookieC },
  });
  assert(cancelRes.status === 200 && cancelRes.data.success, 'Student C successfully cancelled queue search');
  const meCAfterCancel = await request('/api/auth/me', { headers: { Cookie: cookieC } });
  assert(meCAfterCancel.data.user.credits === initialCreditsC, 'Student C retained all credits upon cancellation (zero deduction)');

  // --- Test 3: Priority 2 — Video Calling WebRTC Signaling ---
  console.log('\n--- TEST 3: Priority 2 — WebRTC Signaling (Offer, Answer, ICE Candidates) ---');
  const signalStartTime = Date.now();

  // Student A sends WebRTC Offer
  const offerRes = await request(`/api/chat/${conversationId}/signaling`, {
    method: 'POST',
    headers: { Cookie: cookieA },
    body: JSON.stringify({
      type: 'offer',
      data: { sdp: 'v=0\r\no=StudentA 123456 IN IP4 0.0.0.0\r\ns=CampusConnect Call', type: 'offer' },
    }),
  });
  assert(offerRes.status === 200 && offerRes.data.success, 'Student A WebRTC offer pushed to signaling');

  // Student B fetches signals
  const signalsForB = await request(`/api/chat/${conversationId}/signaling?since=${signalStartTime - 5000}`, {
    headers: { Cookie: cookieB },
  });
  assert(signalsForB.status === 200 && signalsForB.data.success, 'Student B polled signaling exchange');
  const receivedOffer = signalsForB.data.signals.find((s) => s.type === 'offer');
  assert(Boolean(receivedOffer), 'Student B successfully received Student A WebRTC offer');

  // Student B sends WebRTC Answer
  const answerRes = await request(`/api/chat/${conversationId}/signaling`, {
    method: 'POST',
    headers: { Cookie: cookieB },
    body: JSON.stringify({
      type: 'answer',
      data: { sdp: 'v=0\r\no=StudentB 654321 IN IP4 0.0.0.0\r\ns=CampusConnect Call Answer', type: 'answer' },
    }),
  });
  assert(answerRes.status === 200 && answerRes.data.success, 'Student B WebRTC answer pushed to signaling');

  // Student A fetches answer
  const signalsForA = await request(`/api/chat/${conversationId}/signaling?since=${signalStartTime - 5000}`, {
    headers: { Cookie: cookieA },
  });
  const receivedAnswer = signalsForA.data.signals.find((s) => s.type === 'answer');
  assert(Boolean(receivedAnswer), 'Student A successfully received Student B WebRTC answer');

  // Student A sends ICE candidate
  const iceRes = await request(`/api/chat/${conversationId}/signaling`, {
    method: 'POST',
    headers: { Cookie: cookieA },
    body: JSON.stringify({
      type: 'ice-candidate',
      data: { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.5 54321 typ host', sdpMid: '0', sdpMLineIndex: 0 },
    }),
  });
  assert(iceRes.status === 200 && iceRes.data.success, 'ICE candidate successfully sent');

  // --- Test 4: Priority 3 — Messaging Endpoint & Partner Conversation ---
  console.log('\n--- TEST 4: Priority 3 — Messaging & Conversation Chat ---');
  const sendMsgRes = await request(`/api/chat/${conversationId}/messages`, {
    method: 'POST',
    headers: { Cookie: cookieA },
    body: JSON.stringify({ content: 'Hello Pooja! Excited to connect on CampusConnect.' }),
  });
  assert(sendMsgRes.status === 200 && sendMsgRes.data.success, 'Student A sent message to partner');

  const getMsgsRes = await request(`/api/chat/${conversationId}/messages`, {
    headers: { Cookie: cookieB },
  });
  assert(getMsgsRes.status === 200 && getMsgsRes.data.success, 'Student B retrieved conversation messages');
  assert(getMsgsRes.data.messages.length >= 1, 'Partner message exists in history');

  // --- Test 5: Priority 4 — Profile Photo Upload & Management ---
  console.log('\n--- TEST 5: Priority 4 — Profile Photo Upload & Deletion ---');
  // Upload a base64 png photo via multipart formData
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const fakePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  
  const formHeader = `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="avatar.png"\r\nContent-Type: image/png\r\n\r\n`;
  const formFooter = `\r\n--${boundary}--\r\n`;
  const multipartBody = Buffer.concat([
    Buffer.from(formHeader, 'utf-8'),
    fakePngBuffer,
    Buffer.from(formFooter, 'utf-8'),
  ]);

  const uploadPhotoRes = await fetch(`${BASE_URL}/api/profile/photo`, {
    method: 'POST',
    headers: {
      Cookie: cookieA,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  const uploadPhotoData = await uploadPhotoRes.json();
  assert(uploadPhotoRes.status === 200 && uploadPhotoData.success, 'Profile photo upload succeeded');
  assert(Boolean(uploadPhotoData.avatarUrl), `Received avatarUrl: ${uploadPhotoData.avatarUrl.slice(0, 35)}...`);

  // Verify avatarUrl is reflected in /api/auth/me
  const meWithPhoto = await request('/api/auth/me', { headers: { Cookie: cookieA } });
  assert(meWithPhoto.data.user.profile.avatarUrl === uploadPhotoData.avatarUrl, 'Profile avatar updated in database');

  // Delete profile photo
  const deletePhotoRes = await request('/api/profile/photo', {
    method: 'DELETE',
    headers: { Cookie: cookieA },
  });
  assert(deletePhotoRes.status === 200 && deletePhotoRes.data.success, 'Profile photo removal succeeded');

  const meWithoutPhoto = await request('/api/auth/me', { headers: { Cookie: cookieA } });
  assert(meWithoutPhoto.data.user.profile.avatarUrl === null, 'Profile avatar reset to null in database');

  console.log('\n🎉 ALL PRODUCTION BUGFIX TESTS PASSED SUCCESSFULLY! 🚀');
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
