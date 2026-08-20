-- Migration: Phase I Feature 1 — White-Labeling & Branding Schema

-- 1. Add branding columns to public.tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS brand_logo_url TEXT,
ADD COLUMN IF NOT EXISTS brand_primary_color TEXT,
ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT;

-- 2. Insert permission 'branding:customize' (category 'cabinet', scope 'plan')
INSERT INTO public.permissions (key, label, category, scope)
VALUES ('branding:customize', 'Personnalisation de la marque', 'cabinet', 'plan')
ON CONFLICT (key) DO NOTHING;

-- 3. Wire 'branding:customize' into plan_permissions for pro and enterprise plans
INSERT INTO public.plan_permissions (plan_id, permission_id)
SELECT p.id, perm.id
FROM public.plans p
CROSS JOIN public.permissions perm
WHERE p.slug IN ('pro', 'enterprise')
  AND perm.key = 'branding:customize'
ON CONFLICT (plan_id, permission_id) DO NOTHING;

-- 4. Wire 'branding:customize' into role_permissions for cabinet_admin system role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, perm.id
FROM public.roles r
CROSS JOIN public.permissions perm
WHERE r.name = 'cabinet_admin'
  AND perm.key = 'branding:customize'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. Issue explicit column-level GRANT UPDATE for non-restricted tenant columns to authenticated
GRANT UPDATE (
  google_drive_connected,
  google_drive_refresh_token_encrypted,
  google_drive_connected_at,
  google_drive_account_email,
  brand_logo_url,
  brand_primary_color,
  brand_secondary_color
) ON public.tenants TO authenticated;

-- 6. Add RLS policy for tenant branding updates
DROP POLICY IF EXISTS tenant_isolation_tenants_update_branding ON public.tenants;

CREATE POLICY tenant_isolation_tenants_update_branding ON public.tenants
    FOR UPDATE
    TO authenticated
    USING (
        id = get_my_tenant_id()
        AND (is_platform_role() OR can_perform_with_plan('branding:customize'))
    )
    WITH CHECK (
        id = get_my_tenant_id()
        AND (is_platform_role() OR can_perform_with_plan('branding:customize'))
    );

-- 7. Storage Bucket setup for tenant-branding
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-branding', 'tenant-branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS Policies for tenant-branding
DROP POLICY IF EXISTS tenant_branding_public_select ON storage.objects;
DROP POLICY IF EXISTS tenant_branding_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS tenant_branding_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS tenant_branding_authenticated_delete ON storage.objects;

CREATE POLICY tenant_branding_public_select ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'tenant-branding');

CREATE POLICY tenant_branding_authenticated_insert ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'tenant-branding'
        AND (storage.foldername(name))[1] = get_my_tenant_id()::text
        AND (is_platform_role() OR can_perform_with_plan('branding:customize'))
    );

CREATE POLICY tenant_branding_authenticated_update ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'tenant-branding'
        AND (storage.foldername(name))[1] = get_my_tenant_id()::text
        AND (is_platform_role() OR can_perform_with_plan('branding:customize'))
    );

CREATE POLICY tenant_branding_authenticated_delete ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'tenant-branding'
        AND (storage.foldername(name))[1] = get_my_tenant_id()::text
        AND (is_platform_role() OR can_perform_with_plan('branding:customize'))
    );
