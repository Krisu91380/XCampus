const BASE_URL = 'http://localhost:3000';

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
  console.log('🚀 Starting CampusConnect End-to-End Verification...\n');

  // 1. Login as Admin
  console.log('--- 1. Admin Authentication ---');
  const adminLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@campusconnect.edu', password: 'AdminSecurePassword123!' }),
  });
  assert(adminLoginRes.status === 200 && adminLoginRes.data.success, 'Admin login succeeded');
  const adminCookie = adminLoginRes.headers.get('set-cookie');
  assert(Boolean(adminCookie), 'Admin received session cookie');

  // 2. Test Payment Settings API (Admin GET & POST)
  console.log('\n--- 2. Custom QR Payment Settings ---');
  const getSettingsRes = await request('/api/admin/payment-settings', {
    headers: { Cookie: adminCookie },
  });
  assert(getSettingsRes.status === 200 && getSettingsRes.data.success, 'Admin can fetch payment settings');
  assert(getSettingsRes.data.settings.receiverName === 'KRISH SO ANIL KUMAR', 'Default receiver name is KRISH SO ANIL KUMAR');
  assert(getSettingsRes.data.settings.qrImageUrl === '/uploads/payment/custom_qr.png', 'QR image URL is /uploads/payment/custom_qr.png');

  // 3. Register a test student & verify 5 INITIAL FREE CREDITS
  console.log('\n--- 3. Student Registration & 5 Free Signup Credits ---');
  const studentEmail = `student_${Date.now()}@lpu.in`;
  const unisRes = await request('/api/universities');
  const lpuUni = unisRes.data.universities.find((u) => u.code === 'LPU');
  assert(Boolean(lpuUni), 'LPU university exists');

  const regRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: studentEmail,
      password: 'StudentPassword@123',
      displayName: 'Rohan Sharma',
      dateOfBirth: '2003-04-12',
      universityId: lpuUni.id,
      gender: 'MALE',
      course: 'B.Tech CSE',
      academicYear: '2nd Year',
      language: 'English',
      interests: ['Coding', 'Music'],
      termsAccepted: true,
    }),
  });
  assert(regRes.status === 201 && regRes.data.success, 'Student registered successfully');
  const studentCookie = regRes.headers.get('set-cookie');

  // Verify exactly 5 free signup credits
  const meRes = await request('/api/auth/me', { headers: { Cookie: studentCookie } });
  assert(meRes.status === 200 && meRes.data.user.credits === 5, 'New student starts with exactly 5 free signup credits');

  // 4. Student creates QR payment order (Amount strictly determined on server)
  console.log('\n--- 4. QR Order Creation with Package-Locked Amount ---');
  const pkgsRes = await request('/api/payments/packages');
  const pkg5 = pkgsRes.data.packages.find((p) => p.credits === 5) || pkgsRes.data.packages[0];
  assert(Boolean(pkg5), 'Found credit package for purchase');

  const createOrderRes = await request('/api/payments/create-qr-order', {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({ packageId: pkg5.id }),
  });
  assert(createOrderRes.status === 200 && createOrderRes.data.success, 'Payment order created');
  assert(createOrderRes.data.amountInInr === pkg5.priceInInr, `Order amount is locked to ₹${pkg5.priceInInr} on server`);
  assert(createOrderRes.data.receiverName === 'KRISH SO ANIL KUMAR', 'Order returns custom receiver name');
  assert(createOrderRes.data.customQrImageUrl === '/uploads/payment/custom_qr.png', 'Order returns custom QR image path');
  assert(createOrderRes.data.status === 'CREATED', 'Order status initialized to CREATED');
  const orderId1 = createOrderRes.data.orderId;

  // 5. Student clicks "I have paid" -> Transitions to PENDING_VERIFICATION (No UTR or screenshot required)
  console.log('\n--- 5. Simplified "I have paid" Confirmation (No manual UTR required) ---');
  const submitPaidRes = await request('/api/payments/submit-utr', {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({ orderId: orderId1 }),
  });
  assert(submitPaidRes.status === 200 && submitPaidRes.data.success, 'I have paid confirmation submitted successfully');
  assert(submitPaidRes.data.status === 'PENDING_VERIFICATION', 'Order transitioned to PENDING_VERIFICATION');

  // Verify credits are NOT added yet while pending
  const checkBalanceWhilePending = await request('/api/auth/me', { headers: { Cookie: studentCookie } });
  assert(checkBalanceWhilePending.data.user.credits === 5, 'Credits remain at initial 5 while order is pending verification');

  // 6. Admin Rejection Test (on a new order)
  console.log('\n--- 6. Admin Payment Rejection ---');
  const createOrder2Res = await request('/api/payments/create-qr-order', {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({ packageId: pkg5.id }),
  });
  const orderId2 = createOrder2Res.data.orderId;
  await request('/api/payments/submit-utr', {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({ orderId: orderId2 }),
  });

  const rejectRes = await request('/api/admin/orders/reject', {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: JSON.stringify({ orderId: orderId2, reason: 'Payment not found in bank statement.' }),
  });
  assert(rejectRes.status === 200 && rejectRes.data.success, 'Admin rejected invalid payment');

  const checkBalanceAfterReject = await request('/api/auth/me', { headers: { Cookie: studentCookie } });
  assert(checkBalanceAfterReject.data.user.credits === 5, 'Zero credits added after payment rejection');

  // 7. Admin Approval Test (on orderId1) -> Grants exactly pkg.credits (5 credits added to initial 5 = 10)
  console.log('\n--- 7. Admin Payment Approval & Idempotent Credit Grant ---');
  const approveRes = await request('/api/admin/orders/approve', {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: JSON.stringify({ orderId: orderId1 }),
  });
  assert(approveRes.status === 200 && approveRes.data.success, 'Admin approved valid payment');
  assert(approveRes.data.creditsGranted === pkg5.credits, `Granted exact credits (${pkg5.credits})`);

  const checkBalanceAfterApprove = await request('/api/auth/me', { headers: { Cookie: studentCookie } });
  assert(checkBalanceAfterApprove.data.user.credits === 10, 'Student ledger balance updated to 10 credits (5 free + 5 purchased)');

  // Idempotency test: Attempt duplicate approval
  const duplicateApproveRes = await request('/api/admin/orders/approve', {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: JSON.stringify({ orderId: orderId1 }),
  });
  assert(duplicateApproveRes.status === 400, 'Duplicate approval prevented (idempotent protection)');

  // 8. Student Matching Engine & Dev Simulation
  console.log('\n--- 8. Student Matching Engine ---');
  const matchSimRes = await request('/api/match/dev-simulate', {
    method: 'POST',
    headers: { 'x-dev-test': 'true' },
  });
  assert(matchSimRes.status === 200 && matchSimRes.data.success, 'Dev match simulation succeeded');
  assert(Boolean(matchSimRes.data.conversationId), `Paired into Conversation ID: ${matchSimRes.data.conversationId}`);
  assert(matchSimRes.data.participantsCount === 2, 'Exactly 2 participants attached to conversation');
  const convId = matchSimRes.data.conversationId;

  // 9. Real Conversation Messaging & Dedicated Messages Section API
  console.log('\n--- 9. Real Conversation Messaging & Messages List ---');
  // Login as Student 1 (Aarav)
  const student1Login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'dev.aarav@lpu.in', password: 'Student@1234' }),
  });
  assert(student1Login.status === 200, 'Logged in as Aarav (Student 1)');
  const s1Cookie = student1Login.headers.get('set-cookie');

  // Student 1 sends message
  const sendMsgRes = await request(`/api/chat/${convId}/messages`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
    body: JSON.stringify({ content: 'Hey Pooja! Welcome to the new Messages section.' }),
  });
  assert((sendMsgRes.status === 200 || sendMsgRes.status === 201) && sendMsgRes.data.success, 'Student 1 sent message into mutual conversation');

  // Login as Student 2 (Pooja)
  const student2Login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'dev.pooja@lpu.in', password: 'Student@1234' }),
  });
  assert(student2Login.status === 200, 'Logged in as Pooja (Student 2)');
  const s2Cookie = student2Login.headers.get('set-cookie');

  // Student 2 fetches conversations list for Messages section
  const convListRes = await request('/api/chat/conversations', { headers: { Cookie: s2Cookie } });
  assert(convListRes.status === 200 && convListRes.data.success, 'Student 2 fetched conversations list');
  const targetConv = convListRes.data.conversations.find((c) => c.id === convId);
  assert(Boolean(targetConv), 'Mutual conversation present in Student 2 Messages list');
  assert(targetConv.lastMessage?.content.includes('Messages section'), 'Latest message snippet matches sent content');

  // 10. WebRTC Video Calling & Top-of-Website Incoming Call Detection
  console.log('\n--- 10. WebRTC Video Calling & Top-of-Website Call Notification ---');
  // Student 1 initiates video call request
  const callReqRes = await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
    body: JSON.stringify({ type: 'call-request' }),
  });
  assert(callReqRes.status === 200 && callReqRes.data.success, 'Student 1 sent WebRTC call-request signal');

  // Verify Student 2 receives incoming call notification via global incoming call endpoint
  const incomingCallCheckRes = await request('/api/calls/incoming', {
    headers: { Cookie: s2Cookie },
  });
  assert(incomingCallCheckRes.status === 200 && incomingCallCheckRes.data.hasIncomingCall, 'Global incoming call detection endpoint detected active incoming call');
  assert(incomingCallCheckRes.data.call.conversationId === convId, 'Incoming call matches active conversation room');

  // Student 1 generates SDP offer and ICE candidate
  await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
    body: JSON.stringify({ type: 'offer', payload: { type: 'offer', sdp: 'v=0\r\no=caller 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n' } }),
  });
  await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
    body: JSON.stringify({
      type: 'ice-candidate',
      payload: { candidate: 'candidate:1 1 UDP 2122260223 192.168.1.100 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 },
    }),
  });

  // Student 2 accepts call and sends answer
  const callAcceptRes = await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s2Cookie },
    body: JSON.stringify({ type: 'call-accept' }),
  });
  assert(callAcceptRes.status === 200 && callAcceptRes.data.success, 'Student 2 accepted call');

  const answerRes = await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s2Cookie },
    body: JSON.stringify({ type: 'answer', payload: { type: 'answer', sdp: 'v=0\r\no=callee 54321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n' } }),
  });
  assert(answerRes.status === 200 && answerRes.data.success, 'Student 2 sent WebRTC answer signal');

  // Student 1 ends call
  const callEndRes = await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
    body: JSON.stringify({ type: 'call-end' }),
  });
  assert(callEndRes.status === 200 && callEndRes.data.success, 'WebRTC call terminated cleanly');

  // Verify incoming call notification dismisses once call terminates
  const incomingCallAfterEndRes = await request('/api/calls/incoming', {
    headers: { Cookie: s2Cookie },
  });
  assert(incomingCallAfterEndRes.status === 200 && !incomingCallAfterEndRes.data.hasIncomingCall, 'Global incoming call banner dismissed automatically after call ended');

  // 11. Rigorous Email/Password Authentication & Credential Resolution
  console.log('\n--- 11. Email/Password Authentication & Credential Resolution ---');
  // Valid student login (case-insensitive & trimmed)
  const validLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: `  ${studentEmail.toUpperCase()}  `, password: 'StudentPassword@123' }),
  });
  assert(validLoginRes.status === 200 && validLoginRes.data.success, 'Valid student credentials logged in successfully with case-insensitivity & whitespace trimming');

  // Incorrect password rejection
  const wrongPasswordRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: studentEmail, password: 'WrongPassword999!' }),
  });
  assert(wrongPasswordRes.status === 401 && !wrongPasswordRes.data.success, 'Incorrect password securely rejected with 401');
  assert(wrongPasswordRes.data.message.includes('Invalid email or password credentials'), 'Helpful error message returned without leaking private data');

  // Non-existent email rejection
  const wrongEmailRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'nonexistent_student_999@lpu.in', password: 'SomePassword123!' }),
  });
  assert(wrongEmailRes.status === 401 && !wrongEmailRes.data.success, 'Non-existent account rejected with 401');

  // 12. Google OAuth Routes & Error States
  console.log('\n--- 12. Google OAuth Routes & Security Validation ---');
  // Initiate Google OAuth without credentials configured
  const googleInitRes = await fetch(`${BASE_URL}/api/auth/google`, { redirect: 'manual' });
  const initLocation = googleInitRes.headers.get('location') || '';
  assert(
    initLocation.includes('/login?error=google_not_configured'),
    'Unconfigured Google OAuth cleanly redirects to /login?error=google_not_configured'
  );

  // Test OAuth cancelled callback
  const googleCancelRes = await fetch(`${BASE_URL}/api/auth/callback/google?error=access_denied`, { redirect: 'manual' });
  const cancelLocation = googleCancelRes.headers.get('location') || '';
  assert(
    cancelLocation.includes('/login?error=cancelled'),
    'Cancelled Google authorization redirects to /login?error=cancelled'
  );

  // Test OAuth invalid CSRF state callback
  const googleStateRes = await fetch(`${BASE_URL}/api/auth/callback/google?code=fake_code&state=fake_state`, { redirect: 'manual' });
  const stateLocation = googleStateRes.headers.get('location') || '';
  assert(
    stateLocation.includes('/login?error=invalid_state'),
    'Tampered or expired OAuth state redirects to /login?error=invalid_state'
  );

  console.log('\n🎉 ALL 12 VERIFICATION PHASES PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
