const BASE_URL = 'https://x-campus.vercel.app';

async function testPersistence() {
  console.log('--- 1. Supabase Database Status via Production Admin API ---');
  
  // 1. Log in as Admin
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@campusconnect.edu',
      password: 'AdminSecurePassword123!'
    })
  });
  
  if (!adminLoginRes.ok) {
    console.error('Failed to log in as admin:', await adminLoginRes.text());
    return;
  }
  
  const adminCookie = adminLoginRes.headers.get('set-cookie') || '';

  // 2. Query /api/admin/init-db
  const dbStatusRes = await fetch(`${BASE_URL}/api/admin/init-db`, {
    headers: { Cookie: adminCookie }
  });
  
  const dbStatus = await dbStatusRes.json();
  console.log('Supabase PostgREST Connection:');
  console.log(JSON.stringify(dbStatus?.diagnostics?.testSupabaseClientResult, null, 2));

  // 3. Test latency and persistence: Login as Krish Barak
  console.log('\n--- 2. Logging in as Krish Barak (Student 1) ---');
  const krishLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'krishbarak@lpu.in',
      password: 'StudentPass123!'
    })
  });
  const krishCookie = krishLoginRes.headers.get('set-cookie') || '';

  const CONV_ID = 'conv_user-student-1__user-student-krish__5f26ba590eb70a6f';

  // 4. Send a verified message
  const testMsg = `Verified Supabase Persistence: ${new Date().toISOString()}`;
  console.log(`Sending message from Krish: "${testMsg}"`);
  const startSend = Date.now();
  const sendRes = await fetch(`${BASE_URL}/api/chat/${CONV_ID}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: krishCookie
    },
    body: JSON.stringify({ content: testMsg })
  });
  const sendTime = Date.now() - startSend;
  const sendData = await sendRes.json();
  console.log(`Sent message in ${sendTime}ms. Status: ${sendRes.status}, Message ID: ${sendData.data?.id || sendData.id}`);

  // 5. Fetch messages as Aarav Sharma
  console.log('\n--- 3. Logging in as Aarav Sharma (Student 2) ---');
  const aaravLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'aarav.sharma@lpu.in',
      password: 'StudentPass123!'
    })
  });
  const aaravCookie = aaravLoginRes.headers.get('set-cookie') || '';

  const startFetch = Date.now();
  const fetchRes = await fetch(`${BASE_URL}/api/chat/${CONV_ID}/messages`, {
    headers: { Cookie: aaravCookie }
  });
  const fetchTime = Date.now() - startFetch;
  const fetchJson = await fetchRes.json();
  const messages = fetchJson.messages || [];
  console.log(`Fetched messages in ${fetchTime}ms. Status: ${fetchRes.status}, Total messages in conversation: ${messages.length}`);

  const found = messages.find((m) => m.content === testMsg);
  console.log('✅ Sent message retrieved by Aarav in real-time?', Boolean(found));
  if (found) {
    console.log(`✅ Verified Message Details: ID=${found.id}, senderId=${found.senderId}, content="${found.content}"`);
  }

  // 6. Query /api/admin/init-db again to see Supabase row count increment
  const updatedDbStatusRes = await fetch(`${BASE_URL}/api/admin/init-db`, {
    headers: { Cookie: adminCookie }
  });
  const updatedDbStatus = await updatedDbStatusRes.json();
  console.log('\n--- 4. Live Supabase PostgreSQL Row Counts ---');
  console.log(JSON.stringify(updatedDbStatus?.diagnostics?.testSupabaseClientResult?.rowCounts, null, 2));
}

testPersistence().catch(console.error);
