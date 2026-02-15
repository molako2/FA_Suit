# CLAUDE.md — FlowAssist Suite

## Project Overview

FlowAssist Suite is a professional services firm management SaaS application for consulting, law, accounting, tax advisory, and other business consulting firms. It manages clients, matters, invoices, timesheets, expenses, and team collaboration. It was bootstrapped with the Lovable platform.

**Tech stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase (PostgreSQL + Auth + Edge Functions)

## Commands

```bash
npm run dev          # Start dev server on http://localhost:8080
npm run build        # Production build (vite build)
npm run build:dev    # Development mode build
npm run lint         # Run ESLint
npm run test         # Run tests once (vitest run)
npm run test:watch   # Run tests in watch mode (vitest)
npm run preview      # Preview production build
```

## Project Structure

```
src/
├── main.tsx                     # React entry point
├── App.tsx                      # Root component: providers + routing
├── index.css                    # Global styles (Tailwind directives, CSS variables)
├── components/
│   ├── ui/                      # shadcn/ui components (30+, do not edit manually)
│   ├── dashboard/               # Dashboard KPI widgets
│   ├── invoices/                # Invoice-related components
│   ├── layout/                  # AppLayout with collapsible sidebar
│   ├── messages/                # Messaging components
│   ├── timesheet/               # Timesheet entry dialog
│   ├── ProtectedRoute.tsx       # Auth + role-based route guard
│   ├── DateRangeFilter.tsx      # Reusable date range filter
│   ├── ColumnHeaderFilter.tsx   # Filterable table column header
│   └── NavLink.tsx              # Sidebar navigation link
├── pages/                       # Route page components (~17 pages)
├── hooks/                       # Custom React hooks (one per domain entity)
├── contexts/
│   └── AuthContext.tsx           # Auth state, user profile, role
├── integrations/supabase/
│   ├── client.ts                # Supabase client initialization
│   └── types.ts                 # Auto-generated database types (do not edit)
├── lib/
│   ├── utils.ts                 # cn() — Tailwind class merging utility
│   ├── pdf.ts                   # PDF invoice generation
│   ├── word.ts                  # Word document export
│   ├── invoicing.ts             # Invoice calculation logic
│   └── exports.ts               # CSV export utilities
├── types/
│   └── index.ts                 # Shared TypeScript type definitions
├── i18n/
│   ├── index.ts                 # i18next configuration
│   └── locales/
│       ├── en.json              # English translations
│       └── fr.json              # French translations (fallback language)
└── test/
    ├── setup.ts                 # Vitest setup (matchMedia mock)
    └── example.test.ts          # Example test

supabase/
├── config.toml                  # Supabase project configuration
├── migrations/                  # 21 SQL migration files (schema history)
└── functions/                   # Supabase Edge Functions
    ├── admin-create-user/       # Admin user creation endpoint
    └── admin-reset-password/    # Admin password reset endpoint
```

## Architecture & Patterns

### Data flow

1. **Supabase** — PostgreSQL backend with Row Level Security (RLS) on all tables
2. **Custom hooks** (`src/hooks/`) — Each domain entity has a hook using `@tanstack/react-query` for fetching (`useQuery`) and mutations (`useMutation` + `invalidateQueries`)
3. **Page components** (`src/pages/`) — Compose hooks and UI; handle local state with `useState`
4. **Auth context** (`src/contexts/AuthContext.tsx`) — Provides `user`, `role`, `profile`, `session`

### Role-based access control

Four roles: `sysadmin`, `owner`, `assistant`, `collaborator`

- `ProtectedRoute` wraps routes with optional `allowedRoles` prop
- Supabase RLS policies enforce server-side access using helper functions: `has_role()`, `is_owner()`, `is_owner_or_assistant()`, `user_is_assigned_to_matter()`
- Sidebar navigation is filtered by role in `AppLayout`

### Routing

All routes defined in `src/App.tsx`. Public routes: `/login`, `/reset-password`. All other routes wrapped in `ProtectedRoute` + `AppLayout`.

- Owner/sysadmin home: `/` (Dashboard)
- Collaborator home: `/timesheet`

### Internationalization

- i18next with `fr` (French) as fallback language, `en` (English) also supported
- Detection order: localStorage > browser language
- Translation files in `src/i18n/locales/`

## Conventions

### Naming

- **Components/pages:** PascalCase filenames (`Dashboard.tsx`, `ProtectedRoute.tsx`)
- **Hooks/utilities:** camelCase filenames (`useTimesheet.ts`, `invoicing.ts`)
- **Database columns:** snake_case (`user_id`, `matter_id`, `created_at`)
- **TypeScript interfaces:** camelCase properties mapping to snake_case DB fields

### Currency & time

- **Currency:** Stored in cents (integer). 100 = 1 MAD. Use `formatCents()` for display.
- **Time entries:** Stored as integer minutes, rounded to 15-minute increments. Use `roundMinutes()` and `formatMinutesToHours()` for display.

### UI components

- Use shadcn/ui components from `src/components/ui/` — do not modify these directly
- Use `cn()` from `src/lib/utils.ts` for conditional Tailwind class merging
- Toast notifications via Sonner (`sonner` library)
- Icons from `lucide-react`

### Styling

- Tailwind CSS with HSL CSS variables for theming (defined in `src/index.css`)
- Dark mode via class strategy (`darkMode: ["class"]`)
- Design system: deep navy primary, warm grays, golden accents, Inter font

### Forms

- React Hook Form + Zod validation via `@hookform/resolvers`
- Dialog-based CRUD forms are the standard pattern

## Configuration Notes

### TypeScript

Loose strictness — `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`. Path alias: `@/` maps to `./src/`.

### ESLint

Flat config format. `@typescript-eslint/no-unused-vars` is turned **off**. React hooks and react-refresh rules are active.

### Vite

Dev server on port 8080 with IPv6 (`::`) host binding. HMR overlay disabled. `lovable-tagger` plugin active in dev mode.

### Testing

Vitest with jsdom environment. Setup file mocks `window.matchMedia`. Test files match `src/**/*.{test,spec}.{ts,tsx}`.

## Database Schema (Key Tables)

| Table | Purpose |
|---|---|
| `profiles` | User profiles (id, email, name, rate_cents, active) |
| `user_roles` | Role assignments (owner/assistant/collaborator) |
| `clients` | Client records (code, name, address, billing info) |
| `matters` | Matters/engagements linked to clients (code, label, status, rate) |
| `assignments` | User-to-matter assignments with date ranges |
| `timesheet_entries` | Time logs (user, matter, date, minutes, billable, locked) |
| `invoices` | Invoice records with JSONB lines |
| `credit_notes` | Credit notes linked to invoices |
| `expenses` | Expense entries (user, matter, amount, billable, locked) |
| `purchases` | Supplier purchase records |
| `todos` | Task items with priority and assignment |
| `messages` | Internal messaging between users |
| `cabinet_settings` | Global cabinet configuration (rates, VAT, sequences) |
| `audit_logs` | Activity audit trail |

Schema migrations are in `supabase/migrations/`. The auto-generated types in `src/integrations/supabase/types.ts` should not be edited manually.

## Environment Variables

Required in `.env` (already configured):
```
VITE_SUPABASE_PROJECT_ID
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
```

All prefixed with `VITE_` to be exposed to the client bundle.
