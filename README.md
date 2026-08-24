# ComptaCloud or Cabinet Platform

> Multi-tenant SaaS platform for accounting firms (*cabinets comptables*) — role-based team management, subscription-tiered feature gating, Google Drive-backed client document management, and a dedicated client portal.

Built with **Next.js**, **Supabase (PostgreSQL)**, and a fully dynamic RBAC + entitlements engine — no hardcoded roles, no hardcoded plan logic.

---

## ✨ Features

### 🏢 Multi-Tenant Cabinet Management
- Each accounting firm (*cabinet*) operates in full data isolation via PostgreSQL Row-Level Security.
- Super Admin console for platform-wide tenant provisioning, suspension, and oversight.
- White-labeling: cabinets can customize their logo and brand colors, applied live across their workspace.

### 🔐 Dynamic Role & Permission System
- Fully database-driven RBAC — no hardcoded role strings in application logic.
- Custom roles definable per platform, scoped as either **platform-level** or **cabinet-level**.
- Granular permission catalog (`permissions` table) with category and scope classification.
- Defense-in-depth: every sensitive action is checked at the RLS layer, the RPC layer, *and* the application layer.

### 💳 Subscription Plans & Entitlements
- Configurable plan catalog (Trial, Starter, Pro, Enterprise) managed entirely from the Super Admin UI.
- Dual-gated feature access: some capabilities require both a **role permission** and an **active plan entitlement**.
- Usage-based quotas (e.g. max team members) enforced live, with clear, localized rejection messages.

### 📁 Google Drive BYOS (Bring Your Own Storage)
- Cabinets connect their own Google Drive account via OAuth — no centralized file storage, no vendor lock-in.
- Automatic folder-tree provisioning per client (root folder + standardized subfolders).
- Document upload pipeline with atomic rollback: a failed Drive operation never leaves an orphaned database record.

### 👥 Client Management & Portal
- Cabinets manage a full client roster with contact details and status tracking.
- Clients can be invited to a dedicated, isolated **Client Portal** to securely view their own documents.
- Strict RLS isolation ensures a client can never see another client's records — even within the same cabinet.

### 🧾 Team Management
- Staff invitation flow with role assignment, secure email-based onboarding, and session-safe account activation.
- Per-cabinet team member management independent of platform administration.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, Server Actions) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| Authorization | Custom dynamic RBAC + Row-Level Security |
| Storage | Google Drive API v3 (BYOS model) |
| UI | Tailwind CSS + shadcn/ui |
| Language | TypeScript |

---

## 📂 Project Structure




---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Google Cloud project with Drive API OAuth credentials

### Setup

```bash
# Install dependencies
npm install

# Start the local Supabase stack
supabase start

# Apply all database migrations
supabase db reset

# Configure environment variables
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET

# Run the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## 🧩 Authorization Model (Quick Reference)

| Concept | Where it lives |
|---|---|
| Roles | `public.roles` (`is_platform_role` distinguishes platform vs. cabinet roles) |
| Permissions | `public.permissions` (`category`, `scope`) |
| Role → Permission mapping | `public.role_permissions` |
| Plan → Permission mapping | `public.plan_permissions` |
| Plan quotas | `public.plan_limits` |
| Core check functions | `has_permission()`, `can_perform()`, `can_perform_with_plan()`, `check_plan_limit()`, `is_super_admin()`, `is_platform_role()` |

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the complete authorization and schema reference.

---

## 📖 Documentation

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — full system architecture, schema reference, and authorization model.
- [`docs/ROADMAP_AND_RECOMMENDATIONS.md`](./docs/ROADMAP_AND_RECOMMENDATIONS.md) — planned features and known gaps.

---

## ⚠️ Known Limitations

This project is under active development. Notable current gaps are tracked in the roadmap doc, including:
- Client-to-staff assignment (all staff currently see all cabinet clients)
- Storage quota is defined but not yet enforced against real Drive usage
- No multi-language support yet (French-only UI)

---
