-- Migration: Phase 0 — Plans, Plan Permissions, and Plan Limits Schema
-- 1. Adds 'scope' column to permissions table ('platform' | 'cabinet' | 'plan')
-- 2. Creates plans, plan_permissions, and plan_limits tables
-- 3. Seeds plans (trial, starter, pro, enterprise) and their respective limits and feature flags
-- 4. Configures RLS policies for new tables

-- 1. Add scope column to permissions table
ALTER TABLE public.permissions
ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'cabinet'
CHECK (scope IN ('platform', 'cabinet', 'plan'));

-- Update scope for existing permissions
UPDATE public.permissions SET scope = 'platform' WHERE key IN ('tenants:manage', 'tenants:view_all', 'logs:view_platform');
UPDATE public.permissions SET scope = 'plan' WHERE key IN ('drive:connect', 'drive:disconnect');
UPDATE public.permissions SET scope = 'cabinet' WHERE scope IS NULL OR scope NOT IN ('platform', 'plan');

-- 2. Create plans table
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'EUR',
    tier_rank INT NOT NULL UNIQUE, -- Spaced increments: 0, 10, 20, 30
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create plan_permissions junction table
CREATE TABLE IF NOT EXISTS public.plan_permissions (
    plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (plan_id, permission_id)
);

-- 4. Create plan_limits table
CREATE TABLE IF NOT EXISTS public.plan_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    limit_key TEXT NOT NULL,
    limit_value INT NOT NULL, -- -1 denotes unlimited
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(plan_id, limit_key)
);

-- Indexes for fast query execution
CREATE INDEX IF NOT EXISTS idx_plan_permissions_permission_id ON public.plan_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_plan_limits_plan_id_key ON public.plan_limits(plan_id, limit_key);

-- 5. Seed Plans Data
INSERT INTO public.plans (name, slug, description, price_monthly, currency, tier_rank, is_active)
VALUES
  ('Essai', 'trial', 'Offre d’essai gratuite de 14 jours', 0.00, 'EUR', 0, true),
  ('Starter', 'starter', 'Idéal pour les petits cabinets en démarrage', 29.00, 'EUR', 10, true),
  ('Pro', 'pro', 'Pour les cabinets en croissance nécessitant BYOS et plus de collaborateurs', 79.00, 'EUR', 20, true),
  ('Enterprise', 'enterprise', 'Accès illimité et support dédié pour grands cabinets', 199.00, 'EUR', 30, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  tier_rank = EXCLUDED.tier_rank;

-- 6. Seed Plan Limits & Feature Permissions
DO $$
DECLARE
    v_trial_id UUID;
    v_starter_id UUID;
    v_pro_id UUID;
    v_enterprise_id UUID;
    v_drive_connect_id UUID;
    v_drive_disconnect_id UUID;
    v_subs_view_id UUID;
    v_team_invite_id UUID;
    v_team_view_id UUID;
    v_team_update_id UUID;
BEGIN
    SELECT id INTO v_trial_id FROM public.plans WHERE slug = 'trial';
    SELECT id INTO v_starter_id FROM public.plans WHERE slug = 'starter';
    SELECT id INTO v_pro_id FROM public.plans WHERE slug = 'pro';
    SELECT id INTO v_enterprise_id FROM public.plans WHERE slug = 'enterprise';

    SELECT id INTO v_drive_connect_id FROM public.permissions WHERE key = 'drive:connect';
    SELECT id INTO v_drive_disconnect_id FROM public.permissions WHERE key = 'drive:disconnect';
    SELECT id INTO v_subs_view_id FROM public.permissions WHERE key = 'subscriptions:view';
    SELECT id INTO v_team_invite_id FROM public.permissions WHERE key = 'team:invite';
    SELECT id INTO v_team_view_id FROM public.permissions WHERE key = 'team:view';
    SELECT id INTO v_team_update_id FROM public.permissions WHERE key = 'team:update_title';

    -- Seed Limits (max_accountants & max_storage_gb)
    -- Trial Plan Limits
    INSERT INTO public.plan_limits (plan_id, limit_key, limit_value) VALUES
      (v_trial_id, 'max_accountants', 2),
      (v_trial_id, 'max_storage_gb', 5)
    ON CONFLICT (plan_id, limit_key) DO UPDATE SET limit_value = EXCLUDED.limit_value;

    -- Starter Plan Limits
    INSERT INTO public.plan_limits (plan_id, limit_key, limit_value) VALUES
      (v_starter_id, 'max_accountants', 2),
      (v_starter_id, 'max_storage_gb', 5)
    ON CONFLICT (plan_id, limit_key) DO UPDATE SET limit_value = EXCLUDED.limit_value;

    -- Pro Plan Limits
    INSERT INTO public.plan_limits (plan_id, limit_key, limit_value) VALUES
      (v_pro_id, 'max_accountants', 10),
      (v_pro_id, 'max_storage_gb', 50)
    ON CONFLICT (plan_id, limit_key) DO UPDATE SET limit_value = EXCLUDED.limit_value;

    -- Enterprise Plan Limits (-1 = unlimited)
    INSERT INTO public.plan_limits (plan_id, limit_key, limit_value) VALUES
      (v_enterprise_id, 'max_accountants', -1),
      (v_enterprise_id, 'max_storage_gb', 500)
    ON CONFLICT (plan_id, limit_key) DO UPDATE SET limit_value = EXCLUDED.limit_value;

    -- Seed Plan Permissions
    -- Trial Plan Permissions (base permissions, no drive:connect)
    IF v_subs_view_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_trial_id, v_subs_view_id) ON CONFLICT DO NOTHING; END IF;
    IF v_team_invite_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_trial_id, v_team_invite_id) ON CONFLICT DO NOTHING; END IF;
    IF v_team_view_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_trial_id, v_team_view_id) ON CONFLICT DO NOTHING; END IF;
    IF v_team_update_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_trial_id, v_team_update_id) ON CONFLICT DO NOTHING; END IF;

    -- Starter Plan Permissions (base permissions, no drive:connect)
    IF v_subs_view_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_starter_id, v_subs_view_id) ON CONFLICT DO NOTHING; END IF;
    IF v_team_invite_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_starter_id, v_team_invite_id) ON CONFLICT DO NOTHING; END IF;
    IF v_team_view_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_starter_id, v_team_view_id) ON CONFLICT DO NOTHING; END IF;
    IF v_team_update_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_starter_id, v_team_update_id) ON CONFLICT DO NOTHING; END IF;

    -- Pro Plan Permissions (includes drive:connect and drive:disconnect)
    IF v_subs_view_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_pro_id, v_subs_view_id) ON CONFLICT DO NOTHING; END IF;
    IF v_team_invite_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_pro_id, v_team_invite_id) ON CONFLICT DO NOTHING; END IF;
    IF v_team_view_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_pro_id, v_team_view_id) ON CONFLICT DO NOTHING; END IF;
    IF v_team_update_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_pro_id, v_team_update_id) ON CONFLICT DO NOTHING; END IF;
    IF v_drive_connect_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_pro_id, v_drive_connect_id) ON CONFLICT DO NOTHING; END IF;
    IF v_drive_disconnect_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_pro_id, v_drive_disconnect_id) ON CONFLICT DO NOTHING; END IF;

    -- Enterprise Plan Permissions (all permissions)
    IF v_subs_view_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_enterprise_id, v_subs_view_id) ON CONFLICT DO NOTHING; END IF;
    IF v_team_invite_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_enterprise_id, v_team_invite_id) ON CONFLICT DO NOTHING; END IF;
    IF v_team_view_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_enterprise_id, v_team_view_id) ON CONFLICT DO NOTHING; END IF;
    IF v_team_update_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_enterprise_id, v_team_update_id) ON CONFLICT DO NOTHING; END IF;
    IF v_drive_connect_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_enterprise_id, v_drive_connect_id) ON CONFLICT DO NOTHING; END IF;
    IF v_drive_disconnect_id IS NOT NULL THEN INSERT INTO public.plan_permissions (plan_id, permission_id) VALUES (v_enterprise_id, v_drive_disconnect_id) ON CONFLICT DO NOTHING; END IF;
END $$;

-- 7. Enable RLS and Configure Policies
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read plans, plan_permissions, and plan_limits
CREATE POLICY authenticated_select_plans ON public.plans
    FOR SELECT TO authenticated USING (true);

CREATE POLICY authenticated_select_plan_permissions ON public.plan_permissions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY authenticated_select_plan_limits ON public.plan_limits
    FOR SELECT TO authenticated USING (true);

-- Super admin bypass for mutation
CREATE POLICY super_admin_all_plans ON public.plans
    FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY super_admin_all_plan_permissions ON public.plan_permissions
    FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY super_admin_all_plan_limits ON public.plan_limits
    FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
