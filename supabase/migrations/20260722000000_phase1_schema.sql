
CREATE TYPE user_role AS ENUM ('super_admin', 'cabinet_admin', 'accountant', 'client');
CREATE TYPE tenant_status AS ENUM ('active', 'suspended');
CREATE TYPE subscription_status AS ENUM ('active', 'trial', 'suspended');

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subdomain TEXT NOT NULL UNIQUE,
    status tenant_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);


CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan TEXT NOT NULL,
    status subscription_status NOT NULL DEFAULT 'trial',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role user_role NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    -- Enforce that tenant_id can only be NULL for 'super_admin' role, and MUST be present for all other roles
    CONSTRAINT check_tenant_id_null_for_super_admin CHECK (
        (role = 'super_admin') OR (tenant_id IS NOT NULL)
    )
);

-- logs Table
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Indexes (excluding unique constraint indexes like tenants.subdomain)
CREATE INDEX idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_logs_user_id ON logs(user_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- 5. Create Reusable Function for Checking Super Admin
-- SECURITY DEFINER and SET search_path are used to execute with definer's privileges
-- and bypass RLS recursion on the users table.
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM users
        WHERE id = auth.uid()
          AND role = 'super_admin'::user_role
    );
END;
$$;


CREATE POLICY super_admin_bypass_tenants ON tenants
    FOR ALL
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Subscriptions Policy
CREATE POLICY super_admin_bypass_subscriptions ON subscriptions
    FOR ALL
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Users Policy
CREATE POLICY super_admin_bypass_users ON users
    FOR ALL
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Logs Policy
CREATE POLICY super_admin_bypass_logs ON logs
    FOR ALL
    USING (is_super_admin())
    WITH CHECK (is_super_admin());
