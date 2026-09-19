# ApplyFeed 📬🎯

> **Intelligent, privacy-centric email sync & tracking engine for your job search pipeline.**

ApplyFeed connects directly with your inbox (Google / Microsoft OAuth), automatically detects job application updates, interviews, assessments, recruiter outreach, and offer letters using high-precision deterministic classification, and organizes them into an actionable application tracking pipeline.

---

## ✨ Features

- **📬 Direct Mailbox Synchronization**:
  - Secure integration with **Gmail** and **Outlook / Microsoft 365** via OAuth 2.0.
  - Paginated streaming across large mailboxes (5,000+ emails) with zero artificial ceiling limits.
  - Safe cursor checkpointing that prevents data loss or desync on transient connection issues.
  - Automatic, reactive token refresh handling with seamless auth rotation.

- **🧠 Deterministic & AI-Powered Classification**:
  - High-precision deterministic classifier detecting ATS signatures (Greenhouse, Lever, Workday, Ashby, Taleo, etc.).
  - Automatic categorization: `APPLICATION_RECEIVED`, `ASSESSMENT`, `INTERVIEW_SCHEDULE`, `OFFER`, `REJECTION`, and `RECRUITER`.
  - Manual overrides and transparency diagnostics modal detailing classification evidence and score confidence.
  - Optional OpenAI fallback integration for complex, non-standard recruiter threads.

- **📊 Pipeline & Workspace Views**:
  - **Inbox View**: Focused feed of incoming recruitment communication, filterable by attention needed, status, and company.
  - **Jobs Board**: Structured application lifecycle stages and status tracking.
  - **Resume Matcher**: Targeted resume analysis and alignment.
  - **Sync Diagnostics**: Real-time modal with comprehensive filter stats and sync telemetry.

- **🔒 Privacy & Multi-Tenant Isolation**:
  - Strict tenant isolation guarantees that user data, tokens, and mail streams never leak between accounts.
  - AES-256 encrypted access and refresh tokens at rest.
  - Sandboxed demo mode with dedicated tables ensuring zero synthetic mock injection into real user mailboxes.

---

## 🏛 Architecture

```text
               ┌─────────────────────────────────────────┐
               │         Gmail / Outlook OAuth           │
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │        Safe Cursor Sync Engine          │
               │   (Paginated Streaming, Auto-Refresh)   │
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │    Deterministic Classifier & ATS Match │
               │   (Greenhouse, Lever, Ashby, Workday)   │
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │       Drizzle ORM + PostgreSQL          │
               │   (Encrypted Tokens, Multi-Tenant RLS)  │
               └────────────────────┬────────────────────┘
                                    │
                                    ▼
               ┌─────────────────────────────────────────┐
               │    Next.js 16 App Router UI (React 19)  │
               │    /inbox  •  /jobs  •  /resume         │
               └─────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server Components & Route Handlers)
- **Frontend**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/)
- **State & Data Fetching**: [TanStack Query v5](https://tanstack.com/query/latest)
- **Database & ORM**: [Drizzle ORM](https://orm.drizzle.team/) with [PostgreSQL](https://www.postgresql.org/) / [Supabase](https://supabase.com/)
- **Forms & Validation**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Testing**: [Vitest](https://vitest.dev/), Testing Library, JSDOM
- **Package Manager**: [pnpm](https://pnpm.io/)

---

## 🚀 Quick Start

### 1. Prerequisites

- Node.js `>= 20`
- `pnpm` (`corepack enable pnpm`)
- A PostgreSQL instance (local or Supabase)

### 2. Installation

```bash
git clone https://github.com/vedant48/apply-feed.git
cd apply-feed
pnpm install
```

### 3. Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env.local
```

Fill in your configuration keys:

```env
# Database (Supabase or direct PostgreSQL)
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# Supabase Credentials (optional for Auth/Storage)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# AES-256 Token Encryption Secret (minimum 32 characters)
ENCRYPTION_SECRET="applyinbox-secure-secret-key-32b-min!"

# Optional: Google & Microsoft OAuth App Keys
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
MICROSOFT_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"

# Optional: OpenAI LLM for advanced summarization
OPENAI_API_KEY="sk-..."
```

### 4. Database Setup & Migrations

```bash
# Push schema to database
pnpm drizzle-kit push
```

### 5. Running in Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

---

## 🧪 Testing

ApplyFeed includes an extensive Vitest test suite covering multi-tenant isolation, safe cursor pagination, token expiration & refresh handling, ATS classification accuracy, and date filtering:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

---

## 📁 Project Structure

```text
apply-feed/
├── app/
│   ├── api/             # REST Route Handlers (auth, sync, email, accounts)
│   ├── inbox/           # Unified recruitment email inbox
│   ├── jobs/            # Job application tracking board
│   ├── login/           # Authentication portal
│   ├── resume/          # Resume analysis & matcher
│   ├── settings/        # Account & sync settings
│   ├── globals.css      # Tailwind v4 styles
│   └── layout.tsx       # Root layout & providers
├── components/          # Reusable UI components & modals
├── drizzle/             # Database migrations & schemas
├── lib/
│   ├── ai/              # Classification models & scoring rules
│   ├── auth/            # Multi-tenant auth & session management
│   ├── db/              # Drizzle client, schema definitions, repository
│   └── email/           # Gmail & Microsoft OAuth sync engine
├── scripts/             # Database migration and utility scripts
└── tests/
    └── unit/            # Vitest unit & integration test suites
```

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
