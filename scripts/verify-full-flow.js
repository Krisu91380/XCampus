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
    body: JSON.stringify({ type: 'call-request' }),
  });
  assert(callReqRes.status === 200 && callReqRes.data.success, 'Student 1 sent WebRTC call-request signal');

  // Student 1 generates SDP offer
  const offerRes = await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
    body: JSON.stringify({ type: 'offer', payload: { type: 'offer', sdp: 'v=0\r\no=caller 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n' } }),
  });
  assert(offerRes.status === 200 && offerRes.data.success, 'Student 1 sent WebRTC offer signal');

  // Student 1 generates ICE candidate
  const iceCand1Res = await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
    body: JSON.stringify({
      type: 'ice-candidate',
      payload: { candidate: 'candidate:1 1 UDP 2122260223 192.168.1.100 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 },
    }),
  });
  assert(iceCand1Res.status === 200 && iceCand1Res.data.success, 'Student 1 sent local ICE candidate');

  // Student 2 receives call-request, offer, and ICE candidate signals
  const getSignalsRes = await request(`/api/chat/${convId}/signaling?since=0`, {
    headers: { Cookie: s2Cookie },
  });
  assert(getSignalsRes.status === 200 && getSignalsRes.data.success, 'Student 2 received signaling events');
  const incomingReq = getSignalsRes.data.signals.find((s) => s.type === 'call-request');
  const incomingOffer = getSignalsRes.data.signals.find((s) => s.type === 'offer');
  const incomingCand = getSignalsRes.data.signals.find((s) => s.type === 'ice-candidate');
  assert(Boolean(incomingReq), 'Student 2 received incoming call-request from Student 1');
  assert(Boolean(incomingOffer) && incomingOffer.payload.type === 'offer', 'Student 2 received SDP offer from Student 1');
  assert(Boolean(incomingCand) && Boolean(incomingCand.payload.candidate), 'Student 2 received ICE candidate from Student 1');

  // Student 2 accepts call and sends SDP answer
  const callAcceptRes = await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s2Cookie },
    body: JSON.stringify({ type: 'call-accept' }),
  });
  assert(callAcceptRes.status === 200 && callAcceptRes.data.success, 'Student 2 sent WebRTC call-accept signal');

  const answerRes = await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s2Cookie },
    body: JSON.stringify({ type: 'answer', payload: { type: 'answer', sdp: 'v=0\r\no=callee 54321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n' } }),
  });
  assert(answerRes.status === 200 && answerRes.data.success, 'Student 2 sent WebRTC answer signal');

  // Student 2 sends ICE candidate
  const iceCand2Res = await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s2Cookie },
    body: JSON.stringify({
      type: 'ice-candidate',
      payload: { candidate: 'candidate:2 1 UDP 2122260223 192.168.1.101 50001 typ host', sdpMid: '0', sdpMLineIndex: 0 },
    }),
  });
  assert(iceCand2Res.status === 200 && iceCand2Res.data.success, 'Student 2 sent local ICE candidate');

  // Student 1 fetches answer and candidate
  const getS1SignalsRes = await request(`/api/chat/${convId}/signaling?since=0`, {
    headers: { Cookie: s1Cookie },
  });
  assert(getS1SignalsRes.status === 200 && getS1SignalsRes.data.success, 'Student 1 received signaling response');
  const incomingAnswer = getS1SignalsRes.data.signals.find((s) => s.type === 'answer');
  const incomingCand2 = getS1SignalsRes.data.signals.find((s) => s.type === 'ice-candidate' && s.payload.candidate.includes('192.168.1.101'));
  assert(Boolean(incomingAnswer) && incomingAnswer.payload.type === 'answer', 'Student 1 received SDP answer from Student 2');
  assert(Boolean(incomingCand2), 'Student 1 received ICE candidate from Student 2');

  // Student 1 ends call
  const callEndRes = await request(`/api/chat/${convId}/signaling`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
    body: JSON.stringify({ type: 'call-end' }),
  });
  assert(callEndRes.status === 200 && callEndRes.data.success, 'WebRTC call terminated cleanly');

  // Verify Student 2 receives call-end
  const getS2EndSignalsRes = await request(`/api/chat/${convId}/signaling?since=0`, {
    headers: { Cookie: s2Cookie },
  });
  const incomingEnd = getS2EndSignalsRes.data.signals.find((s) => s.type === 'call-end');
  assert(Boolean(incomingEnd), 'Student 2 received call-end signal successfully');

  console.log('\n🎉 ALL 10 VERIFICATION PHASES PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
