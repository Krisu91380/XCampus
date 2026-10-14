const fs = require('fs');

const PROD_URL = process.env.TEST_URL || 'https://x-campus.vercel.app';

async function request(url, options = {}, cookies = '') {
  const headers = {
    ...(options.headers || {}),
    ...(cookies ? { Cookie: cookies } : {}),
  };
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { res, text, json, headers: res.headers };
}

function extractCookie(res) {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return '';
  return setCookie.split(';')[0];
}

async function run() {
  console.log('====================================================');
  console.log('   CC PRODUCTION LIVE TRANSFORMATION VERIFICATION   ');
  console.log('   Target: ' + PROD_URL);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Production Branding Check
  console.log('--- 1. Testing Branding & HTML Metadata ---');
  const home = await request(PROD_URL);
  assert(home.res.status === 200, `Homepage returns 200 OK (${home.res.status})`);
  assert(home.text.includes('CC') || home.text.includes('cc_theme'), 'Homepage contains CC branding and theme loader');
  assert(!home.text.includes('Money Room'), 'No visible legacy "Money Room" on landing page');
  assert(home.text.includes('Monkey Room'), 'Monkey Room navigation link present');

  // 2. Authentication with 2 Student Accounts + Admin
  console.log('\n--- 2. Authenticating Student A & Student B & Admin ---');
  let loginA = await request(`${PROD_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'krishbarak@lpu.in', password: 'StudentPass123!' }),
  });

  if (!loginA.json?.success && !loginA.json?.authenticated) {
    // Try registration if not seeded
    loginA = await request(`${PROD_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'krishbarak@lpu.in',
        password: 'StudentPass123!',
        displayName: 'Krish Barak',
        dateOfBirth: '2003-05-10',
        gender: 'MALE',
        universityCode: 'LPU',
      }),
    });
  }
  assert(loginA.res.status === 200 && (loginA.json?.success || loginA.json?.authenticated), 'Student A authenticated');
  const cookieA = extractCookie(loginA.res);
  const userA = loginA.json?.user;

  let loginB = await request(`${PROD_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.sharma@lpu.in', password: 'StudentPass123!' }),
  });

  if (!loginB.json?.success && !loginB.json?.authenticated) {
    loginB = await request(`${PROD_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'aarav.sharma@lpu.in',
        password: 'StudentPass123!',
        displayName: 'Aarav Sharma',
        dateOfBirth: '2002-09-15',
        gender: 'MALE',
        universityCode: 'LPU',
        universityId: 'uni-lpu',
        termsAccepted: true,
      }),
    });
  }
  assert(loginB.res.status === 200 && (loginB.json?.success || loginB.json?.authenticated), 'Student B authenticated');
  const cookieB = extractCookie(loginB.res);
  const userB = loginB.json?.user;

  // Admin Login Check
  const loginAdmin = await request(`${PROD_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@campusconnect.edu', password: 'AdminSecurePassword123!' }),
  });
  assert(loginAdmin.res.status === 200 && (loginAdmin.json?.success || loginAdmin.json?.authenticated), 'Super Admin authenticated');
  const adminCookie = extractCookie(loginAdmin.res);

  // 3. Instagram-Inspired Profile Verification
  console.log('\n--- 3. Testing Profile Updates & Relationship Status ---');
  const testBio = `LPU Computer Science student testing CC profile at ${new Date().toISOString()}`;
  const updateProfile = await request(`${PROD_URL}/api/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: 'Krish Barak',
      username: 'krish_cc',
      relationshipStatus: 'Committed',
      relationshipVisible: true,
      bio: testBio,
      course: 'B.Tech CSE',
      branch: 'Full Stack & Cloud',
      academicYear: '3rd Year',
      interests: ['AI', 'Next.js', 'WebRTC'],
    }),
  }, cookieA);

  assert(updateProfile.res.status === 200 && updateProfile.json?.success, 'Profile PUT returned 200 OK');

  // Fetch back Profile to ensure PostgreSQL persistence
  const getProfile = await request(`${PROD_URL}/api/profile`, {}, cookieA);
  assert(getProfile.res.status === 200, 'Profile GET returned 200 OK');
  const prof = getProfile.json?.profile;
  assert(prof?.username === 'krish_cc', `Username persisted: @${prof?.username}`);
  assert(prof?.relationshipStatus === 'Committed', `Relationship status persisted: ${prof?.relationshipStatus}`);
  assert(prof?.relationshipVisible === true, `Relationship visibility flag: ${prof?.relationshipVisible}`);
  assert(prof?.course === 'B.Tech CSE', `Course persisted: ${prof?.course}`);

  // 4. Supabase Storage Avatar Verification
  console.log('\n--- 4. Testing Supabase Storage Avatar Upload & Persistence ---');
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const imgBuffer = Buffer.from(pngBase64, 'base64');
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="avatar.png"\r\nContent-Type: image/png\r\n\r\n`),
    imgBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await fetch(`${PROD_URL}/api/profile/photo`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Cookie: cookieA,
    },
    body: multipartBody,
  });

  const uploadJson = await uploadRes.json();
  assert(uploadRes.status === 200 && uploadJson.success, 'Avatar upload to Supabase returned 200');
  const avatarUrl = uploadJson.avatarUrl;
  assert(avatarUrl && (avatarUrl.includes('/storage/v1/object/public/avatars/') || avatarUrl.includes('/storage/v1/object/sign/avatars/')), `Avatar stored in Supabase avatars bucket: ${avatarUrl}`);

  // Fetch avatar image directly from Supabase CDN
  if (avatarUrl) {
    const cdnCheck = await fetch(avatarUrl);
    assert(cdnCheck.status === 200, `Supabase storage avatar is accessible (HTTP ${cdnCheck.status})`);
  }

  // 5. Deterministic Conversation & Persistent Messaging
  console.log('\n--- 5. Testing Persistent Messaging (Student A -> Student B) ---');
  // Ensure friendship exists between Student A and Student B
  await request(`${PROD_URL}/api/friends/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId: userB.id }),
  }, cookieA);

  await request(`${PROD_URL}/api/friends/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderId: userA.id, action: 'ACCEPT' }),
  }, cookieB);

  // Compute conversation ID
  const listAfter = await request(`${PROD_URL}/api/chat/conversations`, {}, cookieA);
  assert(listAfter.res.status === 200, 'Conversations list loaded');
  let convId = listAfter.json?.conversations?.find((c) => c.partner?.id === userB.id)?.id;
  if (!convId) {
    const sorted = [userA.id, userB.id].sort();
    convId = `conv_${sorted[0]}__${sorted[1]}__verified`;
  }

  const testMessageContent = `Hello from CC Production test at ${Date.now()}`;
  const sendMsg = await request(`${PROD_URL}/api/chat/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: testMessageContent, clientMessageId: `cmid_${Date.now()}` }),
  }, cookieA);

  assert(sendMsg.res.status === 200 && sendMsg.json?.success, `Message sent successfully (HTTP ${sendMsg.res.status})`);
  const actualConvId = sendMsg.json?.message?.conversationId || convId;

  // Read message from Student B's session
  const readMsgB = await request(`${PROD_URL}/api/chat/${actualConvId}/messages`, {}, cookieB);
  assert(readMsgB.res.status === 200, 'Student B retrieved messages');
  const msgs = readMsgB.json?.messages || [];
  const foundSent = msgs.some((m) => m.content === testMessageContent);
  assert(foundSent, `Message persisted in PostgreSQL and retrieved by Student B: "${testMessageContent.slice(0, 35)}..."`);

  // 6. WebRTC Cross-Container Signaling Test in PostgreSQL
  console.log('\n--- 6. Testing WebRTC Signaling Persistence in PostgreSQL ---');
  const testSignal = await request(`${PROD_URL}/api/chat/${actualConvId}/signaling`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'call-request',
      payload: { isVideo: true, testId: Date.now() },
    }),
  }, cookieA);

  assert(testSignal.res.status === 200 && testSignal.json?.success, `WebRTC signal pushed to PostgreSQL (Signal ID: ${testSignal.json?.signalId})`);

  // Student B receives the signal
  const pollSignalsB = await request(`${PROD_URL}/api/chat/${actualConvId}/signaling?since=${Date.now() - 30000}`, {}, cookieB);
  assert(pollSignalsB.res.status === 200, 'Student B polled signaling');
  const signals = pollSignalsB.json?.signals || [];
  const hasCallRequest = signals.some((s) => s.type === 'call-request' && s.fromUserId === userA.id);
  assert(hasCallRequest, 'Student B received call-request signal across serverless containers');

  // Clean terminate WebRTC session
  await request(`${PROD_URL}/api/chat/${actualConvId}/signaling`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'call-end' }),
  }, cookieA);
  console.log('WebRTC session cleanly terminated.');

  // 7. Admin Panel & Logout Check
  console.log('\n--- 7. Testing Admin Dashboard & Operations ---');
  const adminStats = await request(`${PROD_URL}/api/admin/stats`, {}, adminCookie);
  assert(adminStats.res.status === 200 && adminStats.json?.success, `Admin stats loaded (Total Users: ${adminStats.json?.stats?.totalUsers})`);

  const logoutAdmin = await request(`${PROD_URL}/api/auth/logout`, { method: 'POST' }, adminCookie);
  assert(logoutAdmin.res.status === 200, 'Admin successfully logged out');

  // 8. Testing Pricing, Monkey Room & Banner Endpoints
  console.log('\n--- 8. Testing Pricing, Monkey Room & Banner Endpoints ---');
  const pricingPage = await request(`${PROD_URL}/pricing`);
  assert(pricingPage.res.status === 200, 'Pricing page returns 200 OK');
  assert(pricingPage.text.includes('Pricing') || pricingPage.text.includes('CampusConnect') || pricingPage.text.includes('CC'), 'Pricing page renders immediately');

  const matchPage = await request(`${PROD_URL}/match`);
  assert(matchPage.res.status === 200, 'Monkey Room /match page returns 200 OK');
  assert(matchPage.text.includes('Monkey Room'), 'Monkey Room branding rendered on /match');

  const bannerAuthCheck = await request(`${PROD_URL}/api/profile/banner`, { method: 'POST' });
  assert(bannerAuthCheck.res.status === 401, 'Profile banner endpoint requires authentication (401)');

  const bannerDeleteAuth = await request(`${PROD_URL}/api/profile/banner`, { method: 'DELETE' }, cookieA);
  assert(bannerDeleteAuth.res.status === 200, 'Profile banner reset/DELETE returned 200 OK');

  console.log('\n====================================================');
  console.log(`   FINAL VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED   `);
  console.log('====================================================');

  if (failed === 0) {
    console.log('🎉 ALL PRODUCTION FIXES AND FEATURES ARE 100% OPERATIONAL!');
  } else {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
