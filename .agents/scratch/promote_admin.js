import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false
  }
});

async function main() {
  const email = 'admin@cabinetsplatform.com';
  const userId = 'e9ac71dc-4217-475f-bc1e-1f3012fad328';

  // 1. Check if user already exists in public.users
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (checkError) {
    console.error('Error checking user in public.users:', checkError);
    process.exit(1);
  }

  if (existingUser) {
    console.log('User already exists in public.users:', existingUser);
    console.log('Performing UPDATE to set role to super_admin...');
    const { data, error } = await supabase
      .from('users')
      .update({ role: 'super_admin', tenant_id: null })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('Error updating user:', error);
      process.exit(1);
    }
    console.log('Update successful:', data);
  } else {
    console.log('User does not exist in public.users.');
    console.log('Performing INSERT to create super_admin...');
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: email,
        role: 'super_admin',
        tenant_id: null
      })
      .select();

    if (error) {
      console.error('Error inserting user:', error);
      process.exit(1);
    }
    console.log('Insert successful:', data);
  }
}

main();
