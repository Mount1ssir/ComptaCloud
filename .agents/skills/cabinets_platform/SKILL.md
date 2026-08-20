---
name: cabinets_platform_audit
description: Comprehensive technical architecture, database schema, completed features, recent changes, and next technical steps for Cabinets Platform.
---

# Cabinets Platform — Complete Technical Audit & Architecture Reference

## 1. Project Architecture & Tech Stack

### Core Technologies
- **Framework**: Next.js 16.2.6 (App Router, Turbopack)
- **Backend / Database**: PostgreSQL 15 on Supabase (Local Docker environment)
- **State & Auth**: Supabase Auth (`@supabase/supabase-js`, `@supabase/ssr`), SSR cookie session handling via `proxy.ts` middleware.
- **Language & Styling**: TypeScript (Strict Mode), Vanilla CSS with Tailwind Tokens / Shadcn UI components.

### Security & Access Control Primitives
1. **Dynamic RBAC Tables**:
   - `public.roles` (`id`, `name`, `is_system`, `is_platform_role`)
   - `public.permissions` (`id`, `key`, `label`, `category`, `scope`)
   - `public.role_permissions` (`role_id`, `permission_id`)
   - `users.role_id` (FK to `public.roles.id`)
2. **Subscription Plans & Quota Tables**:
   - `public.plans` (`id`, `name`, `slug`, `tier_rank`, `description`)
   - `public.plan_permissions` (`plan_id`, `permission_id`)
   - `public.plan_limits` (`plan_id`, `limit_key`, `limit_value`)
   - `public.subscriptions` (`tenant_id`, `plan`, `plan_id`, `status`)
3. **Database SECURITY DEFINER RPC Primitives**:
   - `is_super_admin()`: Returns `true` if `users.role_id` points to `super_admin` (`is_platform_role = true`).
   - `is_platform_role()`: Checks if caller holds a platform-level role.
   - `has_permission(perm_key TEXT)`: Evaluates role-based permissions (`role_permissions`).
   - `has_plan_permission(p_perm_key TEXT)`: Evaluates subscription plan authorization for `scope = 'plan'` permissions.
   - `check_plan_limit(p_limit_key TEXT)`: Evaluates live tenant usage (e.g. `max_accountants`) against `plan_limits.limit_value`. Returns JSON payload `{ allowed, current_count, limit_value, remaining, message }`. Throws exception `42883` on invalid limit keys.
   - `can_perform_with_plan(p_perm_key TEXT)`: Scope-aware RPC function:
     - `scope IN ('cabinet', 'platform')` $\rightarrow$ Evaluates **role-only** via `has_permission()`.
     - `scope = 'plan'` $\rightarrow$ Evaluates **dual-gated** via `has_permission() AND has_plan_permission()`.
4. **Permissions Generator & Drift Protection**:
   - Generator: `scripts/local-only/generate_permissions_reference.js` writing to `lib/permissions.gen.ts`.
   - Drift Check: `scripts/local-only/verify_permissions_drift.js` (`npm run permissions:verify`).

---

## 2. Completed Features

### Tenant Onboarding & Team Invites
- **RPC `create_tenant_with_admin_invite`**: Atomic creation of tenant, pending subscription, and initial invited `cabinet_admin` user.
- **Invite Accept Flow**: Tenant transitions from `pending` to `active` upon cabinet admin first sign-in (`app/accept-invite/actions.ts`).

### Dynamic Roles & Permissions Migration (Phases 0 – F)
- System roles seeded (`super_admin`, `cabinet_admin`, `accountant`, `client`).
- RLS policy `authenticated_select_roles` updated: non-super-admins cannot query platform roles (`is_platform_role = true`).

### Plans & Plan Enforcement Migration (Phases 0 – E.2.4)
- **Phase 0**: Data model schema & scope definition (`platform`, `cabinet`, `plan`).
- **Phase A**: Applied `20260802000000_phase0_plans_and_limits_schema.sql` (seeded `trial`, `starter`, `pro`, `enterprise`).
- **Phase B**: Backfilled `subscriptions.plan_id` foreign keys with loud audit logging for missing/custom plan slugs.
- **Phase C**: Auto-generated centralized TS permissions reference `lib/permissions.gen.ts`.
- **Phase D**: Tightened `public.roles` RLS policy to enforce platform-role structural isolation.
- **Phase E.0 – E.1**: Created and applied SECURITY DEFINER primitives (`has_plan_permission`, `check_plan_limit`, `can_perform_with_plan`) in `20260802030000_plan_enforcement_primitives.sql`. Tested across boundary limits, unlimited plans, and loud exceptions.
- **Phase E.2.1**: Converted `app/api/drive/connect/route.ts` to `can_perform_with_plan('drive:connect')`.
- **Phase E.2.2**: Converted `app/api/drive/callback/route.ts` to `can_perform_with_plan('drive:connect')`.
- **Phase E.2.3**: Converted `disconnectDriveAction` in `app/dashboard/actions.ts` to `can_perform_with_plan('drive:disconnect')`.
- **Phase E.2.4**: Applied migration `20260803000000_phase_e_save_tenant_drive_token_rpc.sql` updating `save_tenant_drive_token` RPC to use `can_perform_with_plan('drive:connect')`. Verified across 5 isolation test scenarios (including `service_role` bypass).

---

## 3. Dedicated Test Accounts

| Role | Email | Password | Tenant / Plan |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `walkthrough.superadmin@cabinetsplatform.com` | `Password123!` | Platform-wide (`tenant_id = null`) |
| **Cabinet Admin** | `user.admin@cabinet.com` | `Password123!` | Cabinet User Platform (`pro` plan) |
| **Accountant** | `user.accountant@cabinet.com` | `Password123!` | Cabinet User Platform (`pro` plan) |
| **Client** | `user.client@cabinet.com` | `Password123!` | Cabinet User Platform (`pro` plan) |

*Re-seed script*: `node scripts/local-only/create_user_requested_accounts.js`

---

## 4. Recent Changes & Context

1. **RPC Signature PostgREST Alignment**:
   - Fixed `PGRST202` schema cache error by ensuring all RPC calls explicitly match PostgreSQL argument names: `{ p_perm_key: "drive:connect" }`.
2. **Super Admin Null Tenant ID Guard Fix**:
   - Removed `!profile.tenant_id` from API route guards so Super Admin (who has `tenant_id = null`) is not blocked when `isAuthorized` returns `true`.
3. **Database Migration Applied**:
   - [`20260803000000_phase_e_save_tenant_drive_token_rpc.sql`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/supabase/migrations/20260803000000_phase_e_save_tenant_drive_token_rpc.sql) updating `save_tenant_drive_token` RPC authorization check to use `can_perform_with_plan('drive:connect')`.

---

## 5. Current Issues & Bugs

- **Failing Tests / Lints**: **0 Errors**. `npx tsc --noEmit` and all 15 verification scripts pass cleanly.
- **Tracked Backlog Items**:
  - OAuth `state` CSRF nonce validation in `app/api/drive/callback/route.ts` queued for future hardening sprint.
  - `max_storage_gb` limit key is a confirmed placeholder (storage managed directly via Google Drive BYOS).

---

## 6. Next Technical Steps (Immediate Roadmap)

1. **Step E.2.5 (IMMEDIATE NEXT)**:
   - Convert `tenant_isolation_tenants_update_drive` RLS policy on `public.tenants` (the 5th and final `drive:connect` call site) to use `can_perform_with_plan('drive:connect')`.
2. **Step E.3**:
   - Wire `check_plan_limit('max_accountants')` into `inviteStaffAction` in `app/dashboard/actions.ts` using the **authenticated user client** (`supabase = await createServerSupabaseClient()`).
3. **Step E.4**:
   - Add UI quota indicators and plan upgrade warnings to cabinet team management pages (`/dashboard/team`).
