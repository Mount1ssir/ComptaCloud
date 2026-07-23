-- Trigger to automatically insert a row into public.users when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_role public.user_role;
    meta_role text;
    meta_tenant_id text;
    assigned_tenant_id uuid;
BEGIN
    -- Extract role and tenant_id from raw_user_meta_data
    meta_role := new.raw_user_meta_data->>'role';
    meta_tenant_id := new.raw_user_meta_data->>'tenant_id';

    -- Resolve user role
    IF meta_role IS NOT NULL AND meta_role IN ('super_admin', 'cabinet_admin', 'accountant', 'client') THEN
        default_role := meta_role::public.user_role;
    ELSE
        default_role := 'client'::public.user_role;
    END IF;

    -- Resolve tenant ID
    IF meta_tenant_id IS NOT NULL AND meta_tenant_id <> '' THEN
        assigned_tenant_id := meta_tenant_id::uuid;
    ELSE
        assigned_tenant_id := NULL;
    END IF;

    -- Validate tenant_id for non-super_admin roles
    IF default_role <> 'super_admin'::public.user_role AND assigned_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id is required for role %', default_role;
    END IF;

    INSERT INTO public.users (id, email, role, tenant_id)
    VALUES (
        new.id,
        new.email,
        default_role,
        assigned_tenant_id
    );
    RETURN new;
END;
$$;

-- Create the trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
