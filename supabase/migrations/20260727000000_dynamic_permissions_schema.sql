-- Migration: Dynamic Permissions Schema (Phase A)
-- Creates permissions, roles, and role_permissions tables
-- Adds role_id column to users table
-- Seeds system roles and initial permissions catalog
-- Migrates existing users.role enum values to users.role_id FK references
-- Configures RLS policies for new tables

-- 1. Create Tables
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_platform_role BOOLEAN NOT NULL DEFAULT false,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE public.users ADD COLUMN role_id UUID REFERENCES public.roles(id);

CREATE INDEX idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX idx_roles_tenant_id ON public.roles(tenant_id);
CREATE INDEX idx_users_role_id ON public.users(role_id);

-- 2. Seed System Roles
INSERT INTO public.roles (name, is_system, is_platform_role, tenant_id) VALUES
  ('super_admin', true, true, NULL),
  ('cabinet_admin', true, false, NULL),
  ('accountant', true, false, NULL),
  ('client', true, false, NULL);

-- 3. Seed Permissions Catalog
INSERT INTO public.permissions (key, label, category) VALUES
  ('tenants:manage', 'Gérer les cabinets (création, suspension, abonnements)', 'tenants'),
  ('tenants:view_all', 'Voir tous les cabinets de la plateforme', 'tenants'),
  ('team:invite', 'Inviter des membres dans l’équipe du cabinet', 'team'),
  ('team:view', 'Voir l’équipe du cabinet', 'team'),
  ('team:update_title', 'Modifier le titre d’un membre de l’équipe', 'team'),
  ('drive:connect', 'Connecter un compte Google Drive (BYOS)', 'storage'),
  ('drive:disconnect', 'Déconnecter le compte Google Drive (BYOS)', 'storage'),
  ('subscriptions:view', 'Voir l’abonnement du cabinet', 'subscriptions'),
  ('logs:view_platform', 'Voir les journaux d’audit de la plateforme', 'audit');

-- 4. Populate role_permissions for cabinet_admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'cabinet_admin'
  AND p.key IN (
    'team:invite',
    'team:view',
    'team:update_title',
    'drive:connect',
    'drive:disconnect',
    'subscriptions:view'
  );

-- 5. Data Migration: Populate users.role_id from users.role
UPDATE public.users u
SET role_id = r.id
FROM public.roles r
WHERE r.name = u.role::text AND r.is_system = true;

-- 6. Enable RLS on new tables
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Super admin bypass policies for new tables
CREATE POLICY super_admin_bypass_permissions ON public.permissions
    FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY super_admin_bypass_roles ON public.roles
    FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY super_admin_bypass_role_permissions ON public.role_permissions
    FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
