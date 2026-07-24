import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function main() {
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false
    }
  });

  console.log('Logging in as admin@cabinetsplatform.com...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@cabinetsplatform.com',
    password: 'SuperAdminPassword123!'
  });

  if (authError) {
    console.error('Auth login failed:', authError);
    process.exit(1);
  }

  console.log('Login successful! Session user ID:', authData.user.id);

  // Now, the client will send the user's JWT in subsequent requests.
  // Let's query the users table to verify RLS policy lets them read their own row.
  const { data: usersData, error: queryError } = await supabase
    .from('users')
    .select('role, email, tenant_id');

  if (queryError) {
    console.error('Querying users table failed:', queryError);
    process.exit(1);
  }

  console.log('Query successful! Retrieved row:', usersData);
  if (usersData.length === 1 && usersData[0].role === 'super_admin') {
    console.log('VERIFICATION SUCCESSFUL: The user can read their own row and their role is "super_admin".');
  } else {
    console.error('Verification failed: Unexpected row content.');
    process.exit(1);
  }
}

main();
