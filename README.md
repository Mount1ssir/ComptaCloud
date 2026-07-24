# ComptaCloud ☁️

> A robust, multi-tenant B2B SaaS platform designed for accounting firms to securely manage clients, staff, and documents.

ComptaCloud is built with a focus on data privacy, seamless team collaboration, and scalable architecture. It features strict tenant isolation, customizable role-based access control (RBAC), and a "Bring Your Own Storage" (BYOS) approach via Google Drive integration.

## ✨ Key Features

*   **Hermetic Multi-Tenancy:** Strict Row-Level Security (RLS) policies implemented at the database level to ensure zero cross-tenant data leakage.
*   **Team Management & RBAC:** Secure onboarding via Magic Links. Flexible role-mapping utilizing base enums with scalable staff profiles for varied organizational hierarchies.
*   **Google Drive BYOS:** Secure OAuth 2.0 integration allowing accounting firms to connect their own Google Drive for automated, encrypted document storage and client folder generation.
*   **Modern User Interface:** Highly responsive and accessible UI built with Tailwind CSS and Shadcn/UI components.
*   **Secure Authentication:** Passwordless and magic-link authentication flows powered by Supabase.

## 🛠️ Tech Stack

*   **Framework:** [Next.js](https://nextjs.org/) (App Router)
*   **Backend as a Service:** [Supabase](https://supabase.com/) (PostgreSQL, Auth, RLS, Storage)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components:** [Shadcn/UI](https://ui.shadcn.com/)
*   **Icons:** `@reui/icon-stack`
*   **Integrations:** Google Drive API (OAuth 2.0)

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:
*   [Node.js](https://nodejs.org/) (v18 or higher)
*   npm, yarn, or pnpm
*   A Supabase project
*   Google Cloud Console account (for OAuth credentials)

### FOR Local Development Setup
Ensure you have the following installed:
*   DOCKER
*   USE THE CMD npx supabase start THEN npx supabase migration up
