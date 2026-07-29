-- Migration: Team Management
-- Adds title column to users table
-- Ensures handle_new_user trigger is present
-- Configures column-level UPDATE (title) privilege and RLS policy for cabinet_admin

-- 1. Add title column to users table
ALTER TABLE users ADD COLUMN title TEXT;

-- 2. Trigger function to handle user creation sync from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role, tenant_id)
  VALUES (
    new.id,
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'client'::public.user_role),
    (new.raw_user_meta_data->>'tenant_id')::uuid
  );
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Column-level UPDATE privilege configuration
-- Revoke table-level UPDATE on users from authenticated role to enforce column-level restriction
REVOKE UPDATE ON users FROM authenticated;

-- Grant UPDATE ONLY on the title column of users table to authenticated role
GRANT UPDATE (title) ON users TO authenticated;

-- 4. RLS Policy for Cabinet Admin to update title of users in their own tenant
CREATE POLICY tenant_isolation_users_update_title_cabinet_admin ON users
    FOR UPDATE
    USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'cabinet_admin')
    WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'cabinet_admin');
