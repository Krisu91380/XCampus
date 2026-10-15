// Uses native Node fetch
const PROD_URL = 'https://x-campus.vercel.app';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

function extractCookie(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    const cookies = res.headers.getSetCookie();
    if (cookies && cookies.length > 0) {
      return cookies.map((c) => c.split(';')[0]).join('; ');
    }
  }
  const raw = res.headers.get('set-cookie');
  if (!raw) return '';
  return raw.split(',').map((c) => c.split(';')[0].trim()).join('; ');
}

async function request(url, options = {}, cookie = '') {
  const headers = { ...options.headers };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(url, { ...options, headers });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { res, json };
}

async function run() {
  console.log('====================================================');
  console.log('   VERIFYING NAVIGATION, DELETION, BLOCKING & AVATAR');
  console.log('   Target: ' + PROD_URL);
  console.log('====================================================\n');

  // 1. Authenticate Student A & Student B
  let loginA = await request(`${PROD_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'krishbarak@lpu.in', password: 'StudentPass123!' }),
  });
  if (!loginA.json?.success && !loginA.json?.authenticated) {
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

  const loginB = await request(`${PROD_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.sharma@lpu.in', password: 'StudentPass123!' }),
  });
  assert(loginB.res.status === 200, 'Student B login successful');
  const cookieB = extractCookie(loginB.res);
  const userB = loginB.json?.user;

  // 2. Profile Avatar Verification
  console.log('\n--- 1. Profile Avatar Integrity ---');
  const profRes = await request(`${PROD_URL}/api/profile`, {}, cookieA);
  assert(profRes.res.status === 200, 'Profile GET returned 200');
  const avatarUrl = profRes.json?.profile?.avatarUrl;
  console.log('Current Avatar URL:', avatarUrl);
  assert(!avatarUrl || !avatarUrl.includes('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'), 'Avatar is not a 1x1 green test image');

  // 3. User Blocking & Enforcement
  console.log('\n--- 2. User Blocking & Unblocking API ---');
  // Student A blocks Student B
  const blockRes = await request(`${PROD_URL}/api/friends/block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId: userB.id }),
  }, cookieA);
  assert(blockRes.res.status === 200 && blockRes.json?.success, 'Student A successfully blocked Student B');

  // Verify blocked users list
  const blockedListRes = await request(`${PROD_URL}/api/friends/blocked`, {}, cookieA);
  assert(blockedListRes.res.status === 200 && blockedListRes.json?.success, 'Blocked list fetched');
  const isBBlocked = blockedListRes.json?.blockedUsers?.some((b) => b.userId === userB.id);
  assert(isBBlocked, 'Student B appears in Student A blocked list');

  // Verify Student B cannot send friend request to Student A
  const frBlockedRes = await request(`${PROD_URL}/api/friends/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId: userA.id }),
  }, cookieB);
  assert(frBlockedRes.res.status === 403, 'Blocked student B cannot send friend request to Student A (HTTP 403)');

  // Student A unblocks Student B
  const unblockRes = await request(`${PROD_URL}/api/friends/unblock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId: userB.id }),
  }, cookieA);
  assert(unblockRes.res.status === 200 && unblockRes.json?.success, 'Student A successfully unblocked Student B');

  // 4. Delete Conversation & Inbox Isolation
  console.log('\n--- 3. Delete Conversation & Inbox Isolation ---');
  // Re-establish friendship so they have an active conversation
  const frReq = await request(`${PROD_URL}/api/friends/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUserId: userB.id }),
  }, cookieA);

  const frListB = await request(`${PROD_URL}/api/friends`, {}, cookieB);
  const pendingReq = frListB.json?.incoming?.find((r) => r.senderId === userA.id || r.fromUser?.id === userA.id);
  if (pendingReq) {
    await request(`${PROD_URL}/api/friends/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: pendingReq.id, action: 'ACCEPT' }),
    }, cookieB);
  }

  // Get conversations for Student A
  const convsARes = await request(`${PROD_URL}/api/chat/conversations`, {}, cookieA);
  assert(convsARes.res.status === 200 && convsARes.json?.success, 'Student A conversations loaded');
  const convWithB = convsARes.json?.conversations?.find((c) => c.partner?.id === userB.id);
  assert(Boolean(convWithB), 'Conversation with Student B exists');

  if (convWithB) {
    // Delete conversation from Student A's view
    const delRes = await request(`${PROD_URL}/api/chat/${convWithB.id}/delete`, {
      method: 'POST',
    }, cookieA);
    assert(delRes.res.status === 200 && delRes.json?.success, 'Student A deleted conversation');

    // Verify conversation no longer appears in Student A's inbox
    const convsAAfter = await request(`${PROD_URL}/api/chat/conversations`, {}, cookieA);
    const stillPresentA = convsAAfter.json?.conversations?.some((c) => c.id === convWithB.id);
    assert(!stillPresentA, 'Deleted conversation does NOT appear in Student A inbox');

    // Verify Student B still has their conversation intact
    const convsB = await request(`${PROD_URL}/api/chat/conversations`, {}, cookieB);
    const presentInB = convsB.json?.conversations?.some((c) => c.id === convWithB.id);
    assert(presentInB, 'Conversation remains intact in Student B inbox');
  }

  console.log('\n====================================================');
  console.log('   ALL SPECIFIC TARGET CHECKS PASSED SUCCESSFULLY!   ');
  console.log('====================================================');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
