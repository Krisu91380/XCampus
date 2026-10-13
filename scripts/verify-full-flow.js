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

  // Update Settings
  const saveSettingsRes = await request('/api/admin/payment-settings', {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: JSON.stringify({
      isEnabled: true,
      receiverName: 'KRISH SO ANIL KUMAR',
      upiId: '9138060466@naviaxis',
      qrImageUrl: '/uploads/payment/custom_qr.png',
      instructions: '1. Scan Navi QR code.\n2. Pay amount.\n3. Submit 12-digit UTR.',
    }),
  });
  assert(saveSettingsRes.status === 200 && saveSettingsRes.data.success, 'Admin can update payment settings');

  // Test Public Payment Settings Endpoint
  const publicSettingsRes = await request('/api/payment-settings');
  assert(publicSettingsRes.status === 200 && publicSettingsRes.data.success, 'Public payment-settings endpoint accessible');
  assert(publicSettingsRes.data.settings.receiverName === 'KRISH SO ANIL KUMAR', 'Public endpoint returns saved receiver name');
  assert(publicSettingsRes.data.settings.upiId === '9138060466@naviaxis', 'Public endpoint returns saved UPI ID');

  // 3. Register a test student for payment testing
  console.log('\n--- 3. Student Registration & Zero Initial Credits ---');
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

  // Check initial credit balance
  const meRes = await request('/api/auth/me', { headers: { Cookie: studentCookie } });
  assert(meRes.status === 200 && meRes.data.user.credits === 0, 'New student starts with strictly 0 credits');

  // 4. Student creates QR payment order
  console.log('\n--- 4. QR Order Creation with Custom QR Code ---');
  const pkgsRes = await request('/api/payments/packages');
  const pkg5 = pkgsRes.data.packages.find((p) => p.credits === 5) || pkgsRes.data.packages[0];
  assert(Boolean(pkg5), 'Found credit package for purchase');

  const createOrderRes = await request('/api/payments/create-qr-order', {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({ packageId: pkg5.id }),
  });
  assert(createOrderRes.status === 200 && createOrderRes.data.success, 'Payment order created');
  assert(createOrderRes.data.receiverName === 'KRISH SO ANIL KUMAR', 'Order returns custom receiver name');
  assert(createOrderRes.data.customQrImageUrl === '/uploads/payment/custom_qr.png', 'Order returns custom QR image path');
  assert(createOrderRes.data.status === 'CREATED', 'Order status initialized to CREATED');
  const orderId1 = createOrderRes.data.orderId;

  // 5. Student submits UTR reference -> Transitions to PENDING_VERIFICATION
  console.log('\n--- 5. UTR Submission & Zero Credits Granted While Pending ---');
  const testUtr = '423188992011';
  const submitUtrRes = await request('/api/payments/submit-utr', {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({
      orderId: orderId1,
      utrNumber: testUtr,
      receiptUrl: '/uploads/payment/custom_qr.png',
    }),
  });
  assert(submitUtrRes.status === 200 && submitUtrRes.data.success, 'UTR reference submitted successfully');
  assert(submitUtrRes.data.status === 'PENDING_VERIFICATION', 'Order transitioned to PENDING_VERIFICATION');

  // Verify credits are NOT added yet
  const checkBalanceWhilePending = await request('/api/auth/me', { headers: { Cookie: studentCookie } });
  assert(checkBalanceWhilePending.data.user.credits === 0, 'Strictly 0 credits granted while order is pending verification');

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
    body: JSON.stringify({ orderId: orderId2, utrNumber: 'INVALID_UTR_999' }),
  });

  const rejectRes = await request('/api/admin/orders/reject', {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: JSON.stringify({ orderId: orderId2, reason: 'UTR not found in bank statement.' }),
  });
  assert(rejectRes.status === 200 && rejectRes.data.success, 'Admin rejected invalid payment');

  const checkBalanceAfterReject = await request('/api/auth/me', { headers: { Cookie: studentCookie } });
  assert(checkBalanceAfterReject.data.user.credits === 0, 'Zero credits granted after payment rejection');

  // 7. Admin Approval Test (on orderId1)
  console.log('\n--- 7. Admin Payment Approval & Idempotent Credit Grant ---');
  const approveRes = await request('/api/admin/orders/approve', {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: JSON.stringify({ orderId: orderId1 }),
  });
  assert(approveRes.status === 200 && approveRes.data.success, 'Admin approved valid payment');
  assert(approveRes.data.creditsGranted === pkg5.credits, `Granted exact credits (${pkg5.credits})`);

  const checkBalanceAfterApprove = await request('/api/auth/me', { headers: { Cookie: studentCookie } });
  assert(checkBalanceAfterApprove.data.user.credits === pkg5.credits, `Student ledger balance updated to ${pkg5.credits} credits`);

  // Idempotency test: Attempt duplicate approval
  const duplicateApproveRes = await request('/api/admin/orders/approve', {
    method: 'POST',
    headers: { Cookie: adminCookie },
    body: JSON.stringify({ orderId: orderId1 }),
  });
  assert(duplicateApproveRes.status === 400, 'Duplicate approval prevented (idempotent protection)');

  // 8. Student Matching Engine & Dev Simulation
  const matchSimRes = await request('/api/match/dev-simulate', {
    method: 'POST',
    headers: { 'x-dev-test': 'true' },
  });
  assert(matchSimRes.status === 200 && matchSimRes.data.success, 'Dev match simulation succeeded');
  assert(Boolean(matchSimRes.data.conversationId), `Paired into Conversation ID: ${matchSimRes.data.conversationId}`);
  assert(matchSimRes.data.participantsCount === 2, 'Exactly 2 participants attached to conversation');
  assert(Boolean(matchSimRes.data.student1) && Boolean(matchSimRes.data.student2), 'Both male and female students identified');
  const convId = matchSimRes.data.conversationId;

  // 9. Real-Time Chat Message Exchange in Paired Conversation
  console.log('\n--- 9. Real Conversation Messaging ---');
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
    body: JSON.stringify({ content: 'Hey Pooja! Nice to connect on CampusConnect.' }),
  });
  assert((sendMsgRes.status === 200 || sendMsgRes.status === 201) && sendMsgRes.data.success, 'Student 1 sent message into mutual conversation');

  // Login as Student 2 (Pooja)
  const student2Login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'dev.pooja@lpu.in', password: 'Student@1234' }),
  });
  assert(student2Login.status === 200, 'Logged in as Pooja (Student 2)');
  const s2Cookie = student2Login.headers.get('set-cookie');

  // Student 2 reads messages
  const readMsgRes = await request(`/api/chat/${convId}/messages`, {
    headers: { Cookie: s2Cookie },
  });
  assert(readMsgRes.status === 200 && readMsgRes.data.success, 'Student 2 fetched conversation messages');
  const receivedMsg = readMsgRes.data.messages.find((m) => m.content.includes('Nice to connect'));
  assert(Boolean(receivedMsg), 'Student 2 received the exact message sent by Student 1');

  // 10. WebRTC Video Calling Signaling Verification
  console.log('\n--- 10. WebRTC Video Calling Signaling Exchange ---');
  // Student 1 initiates video call request
  const callReqRes = await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
    body: JSON.stringify({ type: 'call-request', payload: { sdp: 'dummy-offer-sdp-test' } }),
  });
  assert(callReqRes.status === 200 && callReqRes.data.success, 'Student 1 sent WebRTC call-request signal');

  // Student 2 receives call-request signal
  const getSignalsRes = await request(`/api/chat/${convId}/signaling`, {
    headers: { Cookie: s2Cookie },
  });
  assert(getSignalsRes.status === 200 && getSignalsRes.data.success, 'Student 2 received signaling events');
  const incomingSignal = getSignalsRes.data.signals.find((s) => s.type === 'call-request');
  assert(Boolean(incomingSignal), 'Student 2 received incoming call-request from Student 1');

  // Student 2 accepts call
  const callAcceptRes = await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s2Cookie },
    body: JSON.stringify({ type: 'call-accept', payload: { sdp: 'dummy-answer-sdp-test' } }),
  });
  assert(callAcceptRes.status === 200 && callAcceptRes.data.success, 'Student 2 sent WebRTC call-accept signal');

  // Student 1 ends call
  const callEndRes = await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
    body: JSON.stringify({ type: 'call-end' }),
  });
  assert(callEndRes.status === 200 && callEndRes.data.success, 'WebRTC call terminated cleanly');

  console.log('\n🎉 ALL 10 VERIFICATION PHASES PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
