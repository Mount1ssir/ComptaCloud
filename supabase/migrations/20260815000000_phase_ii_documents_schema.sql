-- Migration: Phase II GED Foundation — Documents Table & Permissions Schema

-- 1. Create public.documents table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('charges', 'salaires', 'comptes', 'contrats', 'documents_generaux')),
    drive_file_id TEXT NOT NULL,
    drive_web_view_link TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type TEXT,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON public.documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);

-- 3. Enable Row-Level Security (RLS)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 4. Seed system permissions with scope='cabinet' (Role-only, no plan_permissions gate)
INSERT INTO public.permissions (key, label, category, scope)
VALUES 
    ('documents:upload', 'Téléverser des documents clients dans Google Drive', 'GED', 'cabinet'),
    ('documents:delete', 'Supprimer des documents clients', 'GED', 'cabinet')
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, scope = EXCLUDED.scope;

-- 5. Assign permissions to cabinet staff system roles (cabinet_admin + accountant)
DO $$
DECLARE
    v_admin_role_id UUID;
    v_accountant_role_id UUID;
    v_perm_upload_id UUID;
    v_perm_delete_id UUID;
BEGIN
    SELECT id INTO v_admin_role_id FROM public.roles WHERE name = 'cabinet_admin' AND is_platform_role = false LIMIT 1;
    SELECT id INTO v_accountant_role_id FROM public.roles WHERE name = 'accountant' AND is_platform_role = false LIMIT 1;
    
    SELECT id INTO v_perm_upload_id FROM public.permissions WHERE key = 'documents:upload' LIMIT 1;
    SELECT id INTO v_perm_delete_id FROM public.permissions WHERE key = 'documents:delete' LIMIT 1;

    -- Grant documents:upload to cabinet_admin and accountant
    IF v_admin_role_id IS NOT NULL AND v_perm_upload_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (v_admin_role_id, v_perm_upload_id)
        ON CONFLICT DO NOTHING;
    END IF;

    IF v_accountant_role_id IS NOT NULL AND v_perm_upload_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (v_accountant_role_id, v_perm_upload_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Grant documents:delete ONLY to cabinet_admin
    IF v_admin_role_id IS NOT NULL AND v_perm_delete_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (v_admin_role_id, v_perm_delete_id)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 6. RLS Policies
DROP POLICY IF EXISTS tenant_isolation_documents_select ON public.documents;
DROP POLICY IF EXISTS tenant_isolation_documents_insert ON public.documents;
DROP POLICY IF EXISTS tenant_isolation_documents_delete ON public.documents;

CREATE POLICY tenant_isolation_documents_select ON public.documents
    FOR SELECT
    TO authenticated
    USING (
        tenant_id = get_my_tenant_id() OR is_super_admin() OR is_platform_role()
    );

CREATE POLICY tenant_isolation_documents_insert ON public.documents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (tenant_id = get_my_tenant_id() OR is_super_admin() OR is_platform_role())
        AND (is_platform_role() OR has_permission('documents:upload'))
    );

CREATE POLICY tenant_isolation_documents_delete ON public.documents
    FOR DELETE
    TO authenticated
    USING (
        (tenant_id = get_my_tenant_id() OR is_super_admin() OR is_platform_role())
        AND (is_platform_role() OR has_permission('documents:delete'))
    );

-- 7. Column Grants
GRANT SELECT, INSERT, DELETE ON public.documents TO authenticated;
