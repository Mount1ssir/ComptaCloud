-- Migration: Tenant Isolation RLS Policies
-- Adds get_my_tenant_id() and get_my_role() SECURITY DEFINER functions to avoid RLS recursion
-- Adds SELECT policies for cabinet_admin, accountant, and client roles to isolate tenant data

-- 1. Helper Function: get_my_tenant_id()
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM users WHERE id = auth.uid();
    RETURN v_tenant_id;
END;
$$;

-- 2. Helper Function: get_my_role()
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role FROM users WHERE id = auth.uid();
    RETURN v_role;
END;
$$;

-- 3. Policy on tenants
CREATE POLICY tenant_isolation_tenants_select ON tenants
    FOR SELECT
    USING (id = get_my_tenant_id());

-- 4. Policy on subscriptions
CREATE POLICY tenant_isolation_subscriptions_select ON subscriptions
    FOR SELECT
    USING (
        tenant_id = get_my_tenant_id()
        AND get_my_role() = 'cabinet_admin'
    );

-- 5. Policy on users
CREATE POLICY tenant_isolation_users_select_cabinet_admin ON users
    FOR SELECT
    USING (
        tenant_id = get_my_tenant_id()
        AND get_my_role() = 'cabinet_admin'
    );
