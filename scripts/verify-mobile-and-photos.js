const fs = require('fs');

const BASE_URL = process.env.TEST_URL || 'https://x-campus.vercel.app';

async function main() {
  console.log(`\n======================================================`);
  console.log(`🧪 RUNNING LIVE PRODUCTION VERIFICATION ON: ${BASE_URL}`);
  console.log(`======================================================\n`);

  // 1. Check deployment version
  console.log('1️⃣ Checking deployment status & footer suppression...');
  const chatPageRes = await fetch(`${BASE_URL}/chat`);
  const chatPageHtml = await chatPageRes.text();
  const footerInChat = chatPageHtml.includes('Safety & Governance') || chatPageHtml.includes('Built with student safety first');
  console.log(`   - /chat footer present: ${footerInChat} (Expected: false)`);

  const browsePageRes = await fetch(`${BASE_URL}/browse`);
  const browseHtml = await browsePageRes.text();
  const footerInBrowse = browseHtml.includes('Safety & Governance');
  console.log(`   - /browse footer present: ${footerInBrowse} (Expected: true for normal pages)`);

  // 2. Authenticate Student 1
  console.log('\n2️⃣ Authenticating Student 1 (krishbarak@lpu.in)...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'krishbarak@lpu.in',
      password: 'StudentPass123!',
    }),
  });
  const loginData = await loginRes.json();
  const cookieHeader = loginRes.headers.get('set-cookie');
  console.log(`   - Login result: ${loginData.success ? 'SUCCESS' : 'FAILED'}`);
  if (!cookieHeader) {
    console.error('   ❌ No session cookie returned.');
    return;
  }
  const sessionCookie = cookieHeader.split(';')[0];

  // 3. Test Profile Photo Upload (Priority 2)
  console.log('\n3️⃣ Testing Profile Photo Upload with a sample image...');
  // Create a minimal 1x1 PNG image buffer
  const samplePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );

  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const multipartBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="avatar_test.png"\r\nContent-Type: image/png\r\n\r\n`
    ),
    samplePngBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await fetch(`${BASE_URL}/api/profile/photo`, {
    method: 'POST',
    headers: {
      Cookie: sessionCookie,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const uploadData = await uploadRes.json();
  console.log(`   - Upload status: ${uploadRes.status}`);
  console.log(`   - Upload response:`, uploadData);

  const initialAvatarUrl = uploadData.avatarUrl;

  // Verify persistence via GET /api/profile
  console.log('\n4️⃣ Verifying Profile Avatar Persistence across re-fetch...');
  const profRes = await fetch(`${BASE_URL}/api/profile`, {
    headers: { Cookie: sessionCookie },
  });
  const profData = await profRes.json();
  console.log(`   - Saved avatarUrl: ${profData.profile?.avatarUrl?.substring(0, 60)}...`);
  const isPersisted = Boolean(profData.profile?.avatarUrl && profData.profile.avatarUrl === initialAvatarUrl);
  console.log(`   - Persistence verified: ${isPersisted ? '✅ YES' : '❌ NO'}`);

  // 5. Test Removing Photo (DELETE /api/profile/photo)
  console.log('\n5️⃣ Testing Profile Photo Removal (DELETE)...');
  const deleteRes = await fetch(`${BASE_URL}/api/profile/photo`, {
    method: 'DELETE',
    headers: { Cookie: sessionCookie },
  });
  const deleteData = await deleteRes.json();
  console.log(`   - Delete status: ${deleteRes.status}`);
  console.log(`   - Delete response:`, deleteData);

  const profAfterDelete = await (await fetch(`${BASE_URL}/api/profile`, {
    headers: { Cookie: sessionCookie },
  })).json();
  console.log(`   - Avatar after removal: ${profAfterDelete.profile?.avatarUrl}`);
  console.log(`   - Removal verified: ${profAfterDelete.profile?.avatarUrl === null ? '✅ YES' : '❌ NO'}`);

  // Re-upload photo for persistent avatar state
  console.log('\n6️⃣ Re-uploading avatar to leave student profile in active state...');
  const reUploadRes = await fetch(`${BASE_URL}/api/profile/photo`, {
    method: 'POST',
    headers: {
      Cookie: sessionCookie,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  const reUploadData = await reUploadRes.json();
  console.log(`   - Re-upload success: ${reUploadData.success}, URL: ${reUploadData.avatarUrl?.substring(0, 60)}...`);

  // 7. Verify Two-Account Messaging & Persistence
  console.log('\n7️⃣ Verifying Active Conversation & Instant Messaging...');
  const convsRes = await fetch(`${BASE_URL}/api/chat/conversations`, {
    headers: { Cookie: sessionCookie },
  });
  const convsData = await convsRes.json();
  const testConv = convsData.conversations?.[0];
  if (!testConv) {
    console.log('   - No existing conversation found to test message persistence.');
  } else {
    console.log(`   - Active conversation found: ${testConv.id} with ${testConv.partner?.displayName}`);
    const testMsgContent = `[Mobile UI E2E Test] Instagram DM layout verified at ${new Date().toISOString()}`;
    const sendRes = await fetch(`${BASE_URL}/api/chat/${testConv.id}/messages`, {
      method: 'POST',
      headers: {
        Cookie: sessionCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: testMsgContent }),
    });
    const sendData = await sendRes.json();
    console.log(`   - Send message result: ${sendData.success ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Fetch messages to confirm PostgreSQL persistence
    const fetchMsgsRes = await fetch(`${BASE_URL}/api/chat/${testConv.id}/messages`, {
      headers: { Cookie: sessionCookie },
    });
    const fetchMsgsData = await fetchMsgsRes.json();
    const found = fetchMsgsData.messages?.find((m) => m.content === testMsgContent);
    console.log(`   - Message retrieved from server: ${found ? '✅ PERSISTED IN DB' : '❌ NOT FOUND'}`);
  }

  console.log('\n======================================================');
  console.log('🎉 ALL INTEGRATION AND PERSISTENCE TESTS COMPLETED!');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('Fatal test error:', err);
});
