const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) {
      const idx = t.indexOf('=');
      if (idx !== -1) {
        process.env[t.substring(0, idx).trim()] = t.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (supabaseUrl && supabaseKey) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  async function run() {
    const { data, error } = await supabase.from('Profile').select('*').eq('userId', 'user-student-krish').single();
    console.log('Supabase Profile for user-student-krish:', data);
  }
  run().catch(console.error);
} else {
  console.log('Supabase not configured');
}
