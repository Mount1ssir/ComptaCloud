-- Migration: Phase B — Backfill subscriptions.plan_id Foreign Key with Audit Logging
-- 1. Add plan_id column to subscriptions table referencing plans(id)
-- 2. Backfill subscriptions.plan_id by matching LOWER(TRIM(subscriptions.plan)) with plans.slug
-- 3. Fallback unmapped subscription rows to 'starter' plan_id AND log a permanent audit entry into public.logs for super_admin review

-- 1. Add plan_id column to subscriptions table
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id);

-- 2. Backfill plan_id matching normalized slug
UPDATE public.subscriptions s
SET plan_id = p.id
FROM public.plans p
WHERE LOWER(TRIM(s.plan)) = p.slug;

-- 3. Process unrecognized plan rows: fallback to 'starter' plan AND insert audit log into public.logs
DO $$
DECLARE
    r RECORD;
    v_starter_plan_id UUID;
BEGIN
    SELECT id INTO v_starter_plan_id FROM public.plans WHERE slug = 'starter' LIMIT 1;

    FOR r IN 
        SELECT s.id AS sub_id, s.tenant_id, s.plan AS raw_plan, t.name AS tenant_name
        FROM public.subscriptions s
        JOIN public.tenants t ON t.id = s.tenant_id
        WHERE s.plan_id IS NULL
    LOOP
        -- Update subscription to starter fallback
        UPDATE public.subscriptions
        SET plan_id = v_starter_plan_id
        WHERE id = r.sub_id;

        -- Insert loud audit log entry into public.logs
        INSERT INTO public.logs (user_id, action)
        VALUES (
            NULL,
            'plan_backfill_fallback: tenant "' || r.tenant_name || '" (id=' || r.tenant_id || ') had unrecognized plan string "' || r.raw_plan || '", defaulted to "starter" (id=' || v_starter_plan_id || ')'
        );
    END LOOP;
END $$;

-- 4. Create index on subscriptions.plan_id for fast query joins
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions(plan_id);
