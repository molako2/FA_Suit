# FlowAssist Suite

## Professional Services Firm Management Platform

FlowAssist Suite is a full-stack SaaS web application designed for professional services firms — including consulting, law, accounting, tax advisory, and other business consulting firms. It provides comprehensive management of clients, matters, invoicing, timesheets, expenses, and team collaboration.

**Company:** CM2A Consulting
**Currency:** MAD (Moroccan Dirham)
**Languages:** French (default), English

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **UI:** shadcn/ui + Tailwind CSS
- **State:** TanStack React Query
- **Backend:** Supabase (PostgreSQL + Auth + RLS + Edge Functions + Realtime)
- **i18n:** i18next (FR/EN)
- **Charts:** Recharts
- **Exports:** PDF (print), Word (.docx), CSV

## Features

- **Timesheet Tracking** — Time entries with 15-minute rounding, billable/non-billable, locking
- **Client & Matter Management** — Client records, matters/engagements with budget ceilings
- **Invoicing** — Draft/issue workflow, time-based and flat-fee billing, sequential numbering
- **Credit Notes** — Full or partial credit notes on issued invoices
- **Expense Tracking** — Per-matter expenses, billable flag, locking on invoice
- **Purchases** — Supplier purchase records with VAT tracking
- **Task Management** — Assignable todos with deadlines, status tracking, attachments
- **Internal Messaging** — Direct and broadcast messages with threading and read tracking
- **Dashboard & Analytics** — KPIs, WIP aging, revenue charts, budget consumption
- **Role-Based Access** — Four roles: sysadmin, owner, assistant, collaborator
- **Multi-language** — French and English with browser detection

## Getting Started

```sh
# Install dependencies
npm install

# Start development server
npm run dev
```

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

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_PROJECT_ID
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL
```
