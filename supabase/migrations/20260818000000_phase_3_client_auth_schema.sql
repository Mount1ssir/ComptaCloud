-- Migration: Phase 3.0 Client Authentication & Portal Shell Schema

-- 1. Add client_id column to public.users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- 2. Add auth_user_id column to public.clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Indexes for fast client linkage lookups
CREATE INDEX IF NOT EXISTS idx_users_client_id ON public.users(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON public.clients(auth_user_id);

-- 4. Helper function: get_my_client_id()
CREATE OR REPLACE FUNCTION public.get_my_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT client_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- 5. Helper function: is_client_role()
CREATE OR REPLACE FUNCTION public.is_client_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() AND r.name = 'client'
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_my_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_client_role() TO authenticated;

-- 6. Update handle_new_user trigger function to preserve client_id metadata & handle user_role enum
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_name TEXT;
    v_role_id UUID;
    v_tenant_id UUID;
    v_client_id UUID;
BEGIN
    v_role_name := COALESCE(NEW.raw_user_meta_data->>'role', 'cabinet_admin');
    
    IF NEW.raw_user_meta_data->>'tenant_id' IS NOT NULL AND NEW.raw_user_meta_data->>'tenant_id' != '' THEN
        v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
    ELSE
        v_tenant_id := NULL;
    END IF;

    IF NEW.raw_user_meta_data->>'client_id' IS NOT NULL AND NEW.raw_user_meta_data->>'client_id' != '' THEN
        v_client_id := (NEW.raw_user_meta_data->>'client_id')::UUID;
    ELSE
        v_client_id := NULL;
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE name = v_role_name LIMIT 1;

    INSERT INTO public.users (id, email, role_legacy, role_id, tenant_id, client_id)
    VALUES (
        NEW.id,
        NEW.email,
        CASE 
          WHEN v_role_name IN ('super_admin', 'cabinet_admin', 'accountant', 'client') THEN v_role_name::public.user_role 
          ELSE 'client'::public.user_role 
        END,
        v_role_id,
        v_tenant_id,
        v_client_id
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role_legacy = EXCLUDED.role_legacy,
        role_id = EXCLUDED.role_id,
        tenant_id = EXCLUDED.tenant_id,
        client_id = COALESCE(EXCLUDED.client_id, public.users.client_id);

    RETURN NEW;
END;
$$;

-- 7. Update RLS policies for public.documents
DROP POLICY IF EXISTS tenant_isolation_documents_select ON public.documents;

CREATE POLICY tenant_isolation_documents_select ON public.documents
    FOR SELECT
    TO authenticated
    USING (
        (tenant_id = get_my_tenant_id() AND is_client_role() AND client_id = get_my_client_id())
        OR
        (tenant_id = get_my_tenant_id() AND NOT is_client_role())
        OR is_super_admin() OR is_platform_role()
    );

-- 8. Update RLS policies for public.clients
DROP POLICY IF EXISTS tenant_isolation_clients_select ON public.clients;

CREATE POLICY tenant_isolation_clients_select ON public.clients
    FOR SELECT
    TO authenticated
    USING (
        (tenant_id = get_my_tenant_id() AND is_client_role() AND id = get_my_client_id())
        OR
        (tenant_id = get_my_tenant_id() AND NOT is_client_role())
        OR is_super_admin() OR is_platform_role()
    );

-- 9. Column Grants
GRANT UPDATE (auth_user_id) ON public.clients TO authenticated;
GRANT UPDATE (client_id) ON public.users TO authenticated;
