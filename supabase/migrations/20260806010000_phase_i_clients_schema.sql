-- Migration: Phase I Feature 2 — Clients Table Schema & Plan Quotas

-- 1. Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    client_type TEXT NOT NULL DEFAULT 'company' CHECK (client_type IN ('individual', 'company')),
    email TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    drive_folders JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);

-- 3. Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS tenant_isolation_clients_select ON public.clients;
DROP POLICY IF EXISTS tenant_isolation_clients_insert ON public.clients;
DROP POLICY IF EXISTS tenant_isolation_clients_update ON public.clients;
DROP POLICY IF EXISTS tenant_isolation_clients_delete ON public.clients;

CREATE POLICY tenant_isolation_clients_select ON public.clients
    FOR SELECT
    TO authenticated
    USING (
        tenant_id = get_my_tenant_id() OR is_super_admin() OR is_platform_role()
    );

CREATE POLICY tenant_isolation_clients_insert ON public.clients
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (tenant_id = get_my_tenant_id() OR is_super_admin() OR is_platform_role())
        AND (is_platform_role() OR can_perform('team:manage') OR can_perform('team:invite') OR has_permission('branding:customize'))
    );

CREATE POLICY tenant_isolation_clients_update ON public.clients
    FOR UPDATE
    TO authenticated
    USING (
        (tenant_id = get_my_tenant_id() OR is_super_admin() OR is_platform_role())
    )
    WITH CHECK (
        (tenant_id = get_my_tenant_id() OR is_super_admin() OR is_platform_role())
    );

CREATE POLICY tenant_isolation_clients_delete ON public.clients
    FOR DELETE
    TO authenticated
    USING (
        (tenant_id = get_my_tenant_id() OR is_super_admin() OR is_platform_role())
    );

-- 5. Seed plan_limits key 'max_clients' for all existing plans
INSERT INTO public.plan_limits (plan_id, limit_key, limit_value)
SELECT id, 'max_clients',
  CASE
    WHEN slug IN ('trial', 'essai') THEN 3
    WHEN slug = 'starter' THEN 10
    WHEN slug = 'pro' THEN 50
    WHEN slug = 'enterprise' THEN -1
    ELSE 10
  END
FROM public.plans
ON CONFLICT (plan_id, limit_key) DO UPDATE
SET limit_value = EXCLUDED.limit_value;
