# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Solo Cabinet Flow — Law Firm Management Platform

**Version:** 1.0
**Date:** 2025-02-10
**Product Name:** FlowAssist (Solo Cabinet Flow)
**Company:** CM2A Consulting
**Currency:** MAD (Moroccan Dirham)
**Languages:** French (default), English

---

## 1. PRODUCT OVERVIEW

### 1.1 What It Is
A full-stack SaaS web application for small/solo law firms (cabinets d'avocats) in Morocco. It handles timesheet tracking, client/matter management, invoicing, credit notes, expense tracking, supplier purchase management, task management, internal messaging, and business analytics — all behind a role-based access control system.

### 1.2 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite 5 |
| UI Library | shadcn/ui (60+ Radix-based components) |
| Styling | TailwindCSS 3.4 + CSS variables (HSL) |
| State/Data | TanStack React Query 5 |
| Routing | React Router DOM 6 |
| Backend/DB | Supabase (PostgreSQL + Auth + RLS + Edge Functions + Realtime) |
| i18n | i18next + react-i18next + browser language detector |
| Charts | Recharts |
| PDF | Browser print dialog with HTML templates |
| Word Export | docx library + file-saver |
| CSV Export | Custom UTF-8 BOM generators |
| Icons | lucide-react |
| Font | Inter (Google Fonts) |

### 1.3 Key Dependencies (package.json)
```
react: 18.3, react-router-dom: 6.30, @supabase/supabase-js: 2.94
@tanstack/react-query: 5.83, tailwindcss: 3.4, recharts: 2.15
date-fns: 3.6, docx: 9.5, i18next: 25.8, zod: 3.25
lucide-react: 0.462, sonner: 1.7, react-hook-form: 7.61
react-day-picker: 8.10, file-saver: 2.0, class-variance-authority: 0.7
```

---

## 2. ROLES & PERMISSIONS (RBAC)

### 2.1 Four Roles
| Role | Description |
|------|------------|
| `sysadmin` | Super admin — full access to everything, can reset passwords, delete users |
| `owner` | Firm owner — full access except password reset |
| `assistant` | Office assistant — manages clients, matters, invoices, expenses; cannot manage collaborators or settings |
| `collaborator` | Lawyer/worker — can only manage own timesheet, expenses, todos, messages; read-only on assigned matters |

### 2.2 Role Assignment Logic
- First user to sign up → `owner`
- Hardcoded email `chtioui@gmail.com` → `sysadmin`
- All other users → `collaborator`
- Roles changed manually by owner/sysadmin in Collaborators page

### 2.3 Route Access Matrix

| Route | sysadmin | owner | assistant | collaborator |
|-------|----------|-------|-----------|-------------|
| `/` (Dashboard) | Dashboard | Dashboard | → /timesheet | → /timesheet |
| `/dashboard-charts` | Yes | Yes | No | No |
| `/timesheet` | Yes | Yes | Yes | Yes |
| `/expenses` | Yes | Yes | Yes | Yes |
| `/clients` | Yes | Yes | Yes | No |
| `/matters` | Yes | Yes | Yes | No |
| `/collaborators` | Yes | Yes | No | No |
| `/invoices` | Yes | Yes | Yes | No |
| `/credit-notes` | Yes | Yes | Yes | No |
| `/purchases` | Yes | Yes | Yes | No |
| `/todos` | Yes | Yes | Yes | Yes (own only) |
| `/messages` | Yes | Yes | Yes | Yes |
| `/settings` | Yes | Yes | No | No |

---

## 3. DATABASE SCHEMA (15 Tables)

### 3.1 Enum
```sql
app_role = ('owner', 'assistant', 'collaborator', 'sysadmin')
```

### 3.2 Tables

#### `profiles`
```
id              UUID PK (FK → auth.users)
email           TEXT
name            TEXT
rate_cents      INTEGER (nullable — hourly rate in centimes)
active          BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### `user_roles`
```
id              UUID PK
user_id         UUID FK → auth.users (UNIQUE with role)
role            app_role
```

#### `clients`
```
id              UUID PK
code            TEXT UNIQUE (format: CLI-0001)
name            TEXT
address         TEXT
billing_email   TEXT
vat_number      TEXT
contact_name    TEXT
contact_phone   TEXT
active          BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### `matters`
```
id                  UUID PK
code                TEXT UNIQUE (format: CLI-0001-DOS0001)
label               TEXT
client_id           UUID FK → clients
status              TEXT ('open' / 'closed')
billing_type        TEXT ('time_based' / 'flat_fee') DEFAULT 'time_based'
rate_cents          INTEGER (nullable — override per matter)
vat_rate            NUMERIC(5,2)
flat_fee_cents      INTEGER (nullable — for flat_fee type)
max_amount_ht_cents INTEGER (nullable — budget ceiling)
intervention_nature TEXT
client_sector       TEXT
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

#### `assignments`
```
id          UUID PK
matter_id   UUID FK → matters
user_id     UUID FK → auth.users
start_date  DATE
end_date    DATE (nullable)
UNIQUE(matter_id, user_id)
```

#### `timesheet_entries`
```
id              UUID PK
user_id         UUID FK → auth.users
matter_id       UUID FK → matters
date            DATE
minutes_rounded INTEGER
description     TEXT
billable        BOOLEAN
locked          BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### `expenses`
```
id              UUID PK
user_id         UUID FK → auth.users
client_id       UUID FK → clients
matter_id       UUID FK → matters
expense_date    DATE
nature          TEXT (max 100 chars)
amount_ttc_cents INTEGER
billable        BOOLEAN
locked          BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### `invoices`
```
id              UUID PK
number          TEXT UNIQUE (format: 2025-0001)
matter_id       UUID FK → matters
status          TEXT ('draft' / 'issued' / 'cancelled')
period_from     DATE
period_to       DATE
issue_date      DATE
lines           JSONB (array of InvoiceLine objects)
total_ht_cents  INTEGER
total_vat_cents INTEGER
total_ttc_cents INTEGER
paid            BOOLEAN DEFAULT false
payment_date    DATE (nullable)
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

**InvoiceLine JSONB structure:**
```json
{
  "id": "uuid",
  "description": "string",
  "quantity": "number (minutes)",
  "unit_price_cents": "number (rate per hour in cents)",
  "amount_ht_cents": "number",
  "collaborator_name": "string (optional)"
}
```

#### `credit_notes`
```
id              UUID PK
number          TEXT UNIQUE (format: AV-2025-0001)
invoice_id      UUID FK → invoices
issue_date      DATE
reason          TEXT
total_ht_cents  INTEGER
total_vat_cents INTEGER
total_ttc_cents INTEGER
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### `purchases`
```
id              UUID PK
invoice_number  TEXT
designation     TEXT
amount_ht_cents INTEGER
amount_tva_cents INTEGER
amount_ttc_cents INTEGER
num_if          TEXT
supplier        TEXT
ice             TEXT
rate            NUMERIC
prorata         NUMERIC
payment_mode    INTEGER DEFAULT 1
payment_date    DATE
invoice_date    DATE
created_by      UUID FK → auth.users
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

**Payment Modes:**
```
1=Especes, 2=Cheque, 3=Prelevement, 4=Virement,
5=Effets, 6=Compensation, 7=Autres
```

#### `todos`
```
id              UUID PK
assigned_to     UUID FK → profiles
created_by      UUID FK → profiles
title           TEXT
deadline        DATE
status          TEXT DEFAULT 'pending' ('pending'/'in_progress'/'done'/'blocked')
blocked_reason  TEXT (nullable)
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### `messages`
```
id              UUID PK
sender_id       UUID
recipient_id    UUID (NULL = broadcast to all)
content         TEXT (max 256 chars)
read            BOOLEAN DEFAULT false
reply_to        UUID FK → messages (nullable, for threading)
created_at      TIMESTAMPTZ
```

#### `message_reads`
```
id          UUID PK
message_id  UUID FK → messages
user_id     UUID
created_at  TIMESTAMPTZ
UNIQUE(message_id, user_id)
```

#### `cabinet_settings`
```
id                  TEXT PK ('default')
name                TEXT
address             TEXT
iban                TEXT
mentions            TEXT
rate_cabinet_cents  INTEGER
vat_default         NUMERIC(5,2)
invoice_seq_year    INTEGER
invoice_seq_next    INTEGER
credit_seq_year     INTEGER
credit_seq_next     INTEGER
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

#### `audit_logs`
```
id          UUID PK
user_id     UUID FK → auth.users (nullable)
action      TEXT
entity_type TEXT
entity_id   UUID
details     JSONB
created_at  TIMESTAMPTZ
```

### 3.3 Database Functions
```sql
has_role(_user_id UUID, _role app_role) → BOOLEAN
is_owner() → BOOLEAN (includes sysadmin)
is_sysadmin() → BOOLEAN
is_owner_or_assistant() → BOOLEAN (includes sysadmin)
user_is_assigned_to_matter(_matter_id UUID) → BOOLEAN
update_updated_at_column() → TRIGGER FUNCTION
handle_new_user() → creates profile on auth.user signup
handle_new_user_role() → assigns role on auth.user signup
```

### 3.4 RLS Summary
All 15 tables have Row Level Security enabled. Key rules:
- **profiles**: All authenticated can view; users update own; owner/sysadmin manage all
- **clients/matters/invoices/credit_notes**: owner/assistant/sysadmin full access; collaborators read assigned only
- **timesheet_entries/expenses**: users manage own (unlocked); owner/assistant see all
- **purchases**: owner/assistant/sysadmin only
- **todos**: owner/sysadmin create/delete; collaborators update own status only
- **messages**: sender/recipient access; broadcasts visible to all
- **cabinet_settings**: owner/sysadmin view+update
- **audit_logs**: owner/assistant/sysadmin view+create

---

## 4. SUPABASE EDGE FUNCTIONS

### 4.1 `admin-create-user`
- **Method:** POST
- **Auth:** Requires owner or sysadmin role
- **Body:** `{ email, password, name, role?, rateCents? }`
- **Logic:** Uses service_role_key to call `auth.admin.createUser()`, auto-confirms email, creates profile + user_role records
- **Returns:** `{ success, userId, message }`

### 4.2 `admin-reset-password`
- **Method:** POST
- **Auth:** Requires sysadmin role only
- **Body:** `{ userId, newPassword }`
- **Validation:** Password min 6 chars
- **Logic:** Uses service_role_key to call `auth.admin.updateUserById()`
- **Returns:** `{ success, message }`

---

## 5. AUTHENTICATION FLOW

### 5.1 Sign Up
1. User enters name, email, password (min 6 chars)
2. Supabase `auth.signUp()` called
3. DB trigger `handle_new_user()` auto-creates profile
4. DB trigger `handle_new_user_role()` assigns role (owner if first user, else collaborator)
5. Redirect to app

### 5.2 Sign In
1. User enters email, password
2. Supabase `auth.signInWithPassword()` called
3. AuthContext fetches profile + role from DB
4. Redirect based on role (owner/sysadmin → Dashboard, others → Timesheet)

### 5.3 Password Reset
1. User clicks "Forgot password" on login page
2. Enters email → Supabase `auth.resetPasswordForEmail()`
3. Email sent with reset link to `/reset-password`
4. User enters new password (min 6 chars, must match confirmation)
5. Supabase `auth.updateUser({ password })` called
6. Redirect to login after 2 seconds

### 5.4 Admin Password Reset (sysadmin only)
1. Sysadmin opens Collaborators page
2. Clicks reset password button on a user
3. Enters new password
4. Calls Edge Function `admin-reset-password`

### 5.5 Session Management
- Tokens stored in localStorage
- Auto-refresh enabled
- AuthContext listens to `onAuthStateChange`
- Settings page allows owner to logout all sessions for any user

---

## 6. PAGES — DETAILED SPECIFICATIONS

### 6.1 Login Page (`/login`)
- **Tabs:** Sign In / Sign Up
- **Fields (Sign In):** email, password (with show/hide toggle)
- **Fields (Sign Up):** name, email, password
- **Features:** Forgot password dialog, language selector (FR/EN), CM2A branding banner
- **Validation:** Email regex, password min 6 chars

### 6.2 Reset Password Page (`/reset-password`)
- **Fields:** New password, confirm password (both with show/hide)
- **Validation:** min 6 chars, must match
- **Flow:** Validates recovery session → update → success screen → redirect to login after 2s

### 6.3 Dashboard (`/`) — owner/sysadmin only
- **Date Range Picker:** From/To for filtering
- **4 Summary Cards:**
  - WIP Hours (billable, unlocked, time-based entries x effective rate)
  - Flat Fee Billable (sum of flat_fee_cents for matters with no issued invoices)
  - Invoiced Revenue HT (issued invoices in period)
  - Collected Revenue HT (paid invoices in period)
- **Sub-components:**
  - `WIPAgingAnalysis` — aging buckets: <30d, 30-60d, 60-90d, 90-120d, >120d with CSV export
  - `KPIAnalytics` — groupable by collaborator/client/matter, filterable, with preview table and CSV export
  - `KPIAnalyticsFlatFee` — same but for flat-fee matters
  - `UnpaidInvoicesKPI` — unpaid issued invoices with aging breakdown
  - `TimesheetExport` — filter by user + date range, preview + CSV export

### 6.4 Dashboard Charts (`/dashboard-charts`) — owner/sysadmin only
- **Date Range Picker**
- **6 Charts:**
  1. Horizontal bar: Hours by collaborator (billable vs non-billable stacked)
  2. Horizontal bar: Top 10 clients by hours
  3. Horizontal bar: Top 10 matters by hours
  4. Grouped bar: Monthly revenue evolution (WIP / Invoiced / Collected)
  5. Donut/Pie: Billing type distribution (time-based vs flat-fee by count + amount)
  6. Bar: Recovery rate by month (collected/invoiced %)

### 6.5 Timesheet (`/timesheet`)
- **Date range filter** (default: last 7 days to today)
- **Collaborator filter** (admin only — dropdown of active profiles)
- **Summary cards:** Total hours, Billable hours
- **Table columns:** Date, Collaborator (admin), Matter code+label, Client, Description, Duration (HH:MM), Billable badge, Locked badge, Actions
- **Create/Edit Dialog:**
  - Date picker
  - Matter selector (collaborators: only assigned open matters; admins: all open matters with client filter)
  - Duration input (auto-rounded to 15-min ceiling)
  - Description textarea
  - Billable toggle
  - Collaborator selector (admin only)
- **Rules:** Locked entries cannot be edited or deleted. Duration rounds up to nearest 15 min.

### 6.6 Expenses (`/expenses`)
- **Table columns:** Date, Collaborator, Client, Matter, Nature, Amount TTC, Billable badge, Locked badge, Actions
- **Create Dialog:**
  - Client dropdown → cascading Matter dropdown (open only)
  - Expense date, Nature (max 100 chars), Amount TTC
  - Billable checkbox
  - Collaborator selector (admin only)
- **Rules:** Non-admins see only own. Locked expenses cannot be deleted. Amounts in cents (MAD).

### 6.7 Clients (`/clients`) — owner/assistant/sysadmin
- **Search bar** (name or code)
- **Column filters** on every column (code, name, address, billing_email, vat_number, contact_name, contact_phone, status)
- **Table columns:** Code, Name, Address, Billing Email, VAT Number, Contact Name, Contact Phone, Status, Actions
- **Create/Edit Dialog:** All fields. Code auto-generated (CLI-####). VAT must be exactly 15 digits.
- **Toggle active/inactive**
- **CSV export**

### 6.8 Matters (`/matters`) — owner/assistant/sysadmin
- **Search bar** (code or label)
- **Column filters** on all columns
- **Table columns:** Code, Label, Client, Intervention Nature, Client Sector, Billing Type, Amount (rate or flat fee), Hours Used, Budget Consumption (progress bar), VAT%, Status, Actions
- **Create/Edit Dialog:**
  - Client selector (only on create, locked after)
  - Label, Intervention Nature dropdown, Client Sector dropdown
  - Billing Type radio (time_based / flat_fee)
  - Rate (time_based only)
  - Flat Fee Amount (flat_fee only)
  - Max Amount HT / Budget Ceiling (time_based only)
  - VAT Rate selector
- **Budget consumption** = (billable hours x weighted rate) / max_amount_ht_cents. Color: green <75%, orange >=75%, red >100%.
- **CSV export**

### 6.9 Invoices (`/invoices`) — owner/assistant/sysadmin
- **Summary cards:** Draft count, Issued count, Invoiced Revenue HT, Collected Revenue HT
- **Filters:** Status, Client, Matter, Date range, Search
- **Table columns:** Number, Client, Matter, Status, Period, Issue Date, HT, VAT, TTC, Paid, Payment Date, Actions
- **Create Draft Dialog:**
  1. Select matter
  2. Set period (from/to dates)
  3. Toggle "Group by collaborator"
  4. For time_based: `TimesheetEntrySelector` component with per-entry override for minutes + rate
  5. For flat_fee: Auto-populate from matter's flat_fee_cents
  6. Optional: Add billable expenses to invoice
  7. Optional: Override total HT amount (custom amount)
  8. Creates draft invoice with calculated lines
- **Issue Flow:**
  - Confirmation dialog
  - Generates sequential number (YYYY-####, resets yearly)
  - Locks all included timesheet entries + expenses
  - Audit log entry
- **Payment Tracking:** Inline paid checkbox + payment date input
- **Export:** PDF (print dialog), Word (.docx), CSV
- **Delete:** Draft only

**Rate Hierarchy:** Matter rate → Profile rate → Cabinet default rate

**Invoice Line Calculation:**
```
For time_based + single grouping:
  totalMinutes = sum of selected entries minutes
  weightedRate = sum(entry.minutes x effectiveRate) / totalMinutes
  amount_ht = round(totalMinutes / 60 x weightedRate)

For time_based + by_collaborator grouping:
  One line per collaborator with their specific rate

For flat_fee:
  Single line with flat_fee_cents amount

VAT: round(amount_ht x vat_rate / 100)
TTC: amount_ht + vat
```

### 6.10 Credit Notes (`/credit-notes`) — owner/assistant/sysadmin
- **Summary cards:** Total count, Total HT value
- **Table columns:** Number, Invoice Number, Client, Matter, Reason, HT, VAT, TTC, Issue Date, Actions
- **Create Dialog:**
  - Select from issued invoices only
  - Toggle: Full / Partial credit note
  - Partial: enter custom amount (proportional VAT/TTC calculated)
  - Full: uses invoice totals, marks invoice as cancelled
  - Reason textarea
  - Sequential number: AV-YYYY-####
  - Audit log entry
- **PDF print** for each credit note
- **CSV export**

### 6.11 Purchases (`/purchases`) — owner/assistant/sysadmin
- **Search** (invoice number, designation, supplier)
- **Date range filter** on invoice_date
- **Table columns:** Invoice#, Invoice Date, Supplier, Designation, HT, TVA, TTC, Tax ID, ICE, Rate, Prorata, Payment Mode, Payment Date, Actions
- **Create/Edit Dialog:**
  - Invoice number, Invoice date, Supplier (required)
  - Designation textarea
  - Amount HT, TVA, TTC (TTC auto-calculated as HT+TVA)
  - Tax ID (num_if), ICE
  - Rate, Prorata
  - Payment mode dropdown (7 modes)
  - Payment date
- **Delete** with confirmation
- **CSV export**

### 6.12 Collaborators (`/collaborators`) — owner/sysadmin
- **Search** by name or email
- **Card layout** (not table — shows avatar with initials, name, email, role badge, rate)
- **Create User Dialog:**
  - Name, Email, Password (auto-generated temp), Role selector, Hourly Rate
  - Calls Edge Function `admin-create-user`
- **Edit Dialog:** Name, Hourly Rate (role changed separately)
- **Role Change:** Dropdown to change role
- **Assign to Matters Dialog:**
  - Shows current assignments
  - Add new: Matter dropdown (open only) + Start Date + End Date
  - Delete existing assignments
- **Password Reset** (sysadmin only): Calls Edge Function `admin-reset-password`
- **Delete User** (sysadmin only): Cascading delete from profiles + user_roles + auth
- **Toggle active/inactive**
- **CSV export**

### 6.13 Todos (`/todos`)
- **Assignee filter** (admin only)
- **Table columns:** Title, Deadline, Assigned To, Status, Blocked Reason, Actions
- **Status badges:** pending (gray), in_progress (blue), done (green), blocked (red)
- **Overdue alert:** Red badge when deadline passed and status != done
- **Create Dialog** (admin only): Title (max 500), Deadline (calendar), Assign To
- **Status Changes:**
  - Admin: can set any status
  - Collaborator: can change own task status only
  - Blocked: requires blocked_reason (max 128 chars)
- **Admin actions:** Edit, Delete, Unblock
- **CSV export**

### 6.14 Messages (`/messages`)
- **New Message Dialog:**
  - Type: Direct / Broadcast (owner only for broadcast)
  - Recipient selector (for direct)
  - Content textarea (max 256 chars) + emoji picker
  - Character counter
- **Message List:** ScrollArea showing threaded messages
- **Each MessageItem:**
  - Avatar (sender initials), sender name, timestamp
  - Content text
  - Broadcast badge (if applicable)
  - Unread indicator (blue background)
  - Reply button → InlineReplyForm
  - Delete button (sender or owner can delete)
  - Delete confirmation dialog
- **Read Tracking:**
  - Direct messages: `read` field on message
  - Broadcasts: `message_reads` table per user
  - Auto-mark as read on view
- **Realtime:** Supabase channel subscription for live updates
- **Unread count** in sidebar badge (polled every 30 seconds)
- **Emoji Picker:** 65 emojis in 3 categories (Smileys, Gestures, Symbols)

### 6.15 Settings (`/settings`) — owner/sysadmin
- **Two Tabs:** Cabinet / Security
- **Cabinet Tab:**
  - Cabinet Info Card: name, address, IBAN
  - Billing Settings Card: default hourly rate (MAD), default VAT%, legal mentions textarea
  - Numbering Card: Invoice sequence (year + next number), Credit note sequence
  - Preview Card: formatted display of current settings
- **Security Tab:**
  - User Sessions Table: Logout all sessions per user
  - Audit Log Table: timestamp, user, action, entity_type, entity_id, details (JSON)
- **Save:** Updates `cabinet_settings` table + audit log entry

---

## 7. DESIGN SYSTEM

### 7.1 Color Palette (HSL CSS Variables)

**Light Mode:**
| Token | Value | Description |
|-------|-------|-------------|
| `--primary` | 222 47% 20% | Deep Navy Blue |
| `--background` | 40 20% 98% | Warm off-white |
| `--card` | 0 0% 100% | Pure white |
| `--accent` | 38 92% 50% | Golden/amber highlights |
| `--destructive` | 0 84% 60% | Red |
| `--success` | 142 76% 36% | Green |
| `--warning` | 38 92% 50% | Amber |
| `--muted` | 220 14% 95% | Soft gray |
| `--sidebar-background` | 222 47% 15% | Dark navy sidebar |
| `--sidebar-primary` | 38 92% 50% | Golden sidebar accents |

**Dark Mode:** Inverts — primary becomes golden, background becomes deep navy, sidebar goes darker.

### 7.2 Typography
- **Font:** Inter (300, 400, 500, 600, 700 weights)
- **Headings:** `font-semibold tracking-tight`
- **Body:** `antialiased`

### 7.3 Border Radius
- `--radius`: 0.5rem (lg: 0.5rem, md: calc-2px, sm: calc-4px)

### 7.4 Animations
- `accordion-down/up`: 0.2s ease-out
- `fade-in`: 0.3s ease-out (translateY 10px)
- `slide-in`: 0.3s ease-out (translateX -10px)

---

## 8. SIDEBAR NAVIGATION

### 8.1 Structure
Dark navy sidebar with golden accent highlights. Collapsible with keyboard shortcut (Cmd+B).

### 8.2 Nav Items (13 items, filtered by role)

| Icon | Label (FR) | Route | Roles | Badge |
|------|-----------|-------|-------|-------|
| LayoutDashboard | Tableau de bord | / | owner, sysadmin | — |
| BarChart3 | Graphiques | /dashboard-charts | owner, sysadmin | — |
| Clock | Feuille de temps | /timesheet | all | — |
| Receipt | Depenses | /expenses | all | — |
| Users | Clients | /clients | owner, assistant, sysadmin | — |
| Briefcase | Dossiers | /matters | owner, assistant, sysadmin | — |
| UserCog | Collaborateurs | /collaborators | owner, sysadmin | — |
| FileText | Factures | /invoices | owner, assistant, sysadmin | — |
| FileX | Avoirs | /credit-notes | owner, assistant, sysadmin | — |
| ShoppingCart | Achats | /purchases | owner, assistant, sysadmin | — |
| ListTodo | Taches | /todos | all | pending+in_progress+blocked count |
| MessageSquare | Messages | /messages | all | unread count |
| Settings | Parametres | /settings | owner, sysadmin | — |

### 8.3 Sidebar Footer
User avatar (initials) + name + role badge + dropdown menu with Sign Out option.

---

## 9. BUSINESS LOGIC RULES

### 9.1 Rate Hierarchy
```
Effective Rate = Matter.rate_cents ?? Profile.rate_cents ?? CabinetSettings.rate_cabinet_cents
```

### 9.2 Timesheet Rounding
```
roundMinutes(m) = Math.ceil(m / 15) * 15
```
All entries rounded UP to nearest 15-minute increment.

### 9.3 Invoice Numbering
```
Format: {YYYY}-{0001}  (e.g., 2025-0001)
Resets to 0001 each new year.
Stored in cabinet_settings: invoice_seq_year + invoice_seq_next
```

### 9.4 Credit Note Numbering
```
Format: AV-{YYYY}-{0001}  (e.g., AV-2025-0001)
Same reset logic as invoices.
Stored in: credit_seq_year + credit_seq_next
```

### 9.5 Client Code Generation
```
Format: CLI-{0001}  (sequential from existing max)
```

### 9.6 Matter Code Generation
```
Format: {ClientCode}-DOS{0001}  (e.g., CLI-0001-DOS0001)
Sequential per client from existing max.
```

### 9.7 Locking
- When an invoice is **issued**, all included timesheet entries + expenses get `locked = true`
- Locked entries cannot be edited or deleted
- Only issuing locks; deleting a draft does NOT lock

### 9.8 Budget Ceiling
- Matters can have `max_amount_ht_cents` (optional)
- Consumption = sum of (billable entry minutes x effective rate / 60)
- Progress bar: green <75%, orange >=75%, red >100%
- Warning shown when creating invoice if ceiling would be exceeded

### 9.9 Flat Fee Invoicing
- Flat fee matters have `flat_fee_cents` amount
- Invoice uses that fixed amount regardless of timesheet hours
- KPI tracks flat fee matters separately from time-based

---

## 10. EXPORT CAPABILITIES

### 10.1 PDF Export
- Uses HTML templates rendered in new window with `window.print()`
- CM2A Consulting branded header/footer
- French number-to-words for total amount
- Logo loaded as base64
- Applied to: Invoices, Credit Notes

### 10.2 Word Export (.docx)
- Uses `docx` library to generate .docx files
- Professional formatting with colored header/footer bars
- Company branding, line items table, totals
- Status badges
- Payment info section with IBAN
- Applied to: Invoices

### 10.3 CSV Export
- UTF-8 BOM (`\uFEFF`) for Excel compatibility
- Proper CSV escaping (double-quote fields with commas/quotes)
- Applied to: Timesheet, Expenses, Clients, Matters, Invoices, Credit Notes, Collaborators, Todos, Purchases, KPI Analytics, WIP Aging, Unpaid Invoices

---

## 11. i18n (INTERNATIONALIZATION)

### 11.1 Configuration
- **Default language:** French (fr)
- **Supported:** French, English
- **Detection:** localStorage → browser navigator → fallback to FR
- **Library:** i18next + react-i18next + i18next-browser-languagedetector

### 11.2 Translation Namespaces
```
common, auth, nav, charts, dashboard, timesheet, expenses,
clients, matters, invoices, creditNotes, collaborators,
settings, todos, messages, errors
```

### 11.3 Language Selector
Available on Login page as a dropdown in the top area.

---

## 12. REALTIME FEATURES

### 12.1 Messages
- `messages` table added to Supabase realtime publication
- Frontend subscribes to Supabase channel for live message updates
- Unread count badge polled every 30 seconds

---

## 13. CUSTOM HOOKS INVENTORY (15 hooks)

| Hook | Table | Operations |
|------|-------|-----------|
| `useClients` | clients | CRUD + generateClientCode |
| `useMatters` | matters | CRUD + generateMatterCode |
| `useTimesheet` | timesheet_entries | CRUD + lock + roundMinutes + formatMinutesToHours |
| `useExpenses` | expenses | CRUD + lock + formatCentsTTC |
| `useInvoices` | invoices | CRUD |
| `useCreditNotes` | credit_notes | Read + Create |
| `usePurchases` | purchases | CRUD + formatCentsToMAD + PAYMENT_MODES |
| `useProfiles` | profiles + user_roles | Read + UpdateProfile + UpdateRole |
| `useAssignments` | assignments | CRUD + useUserAssignments (active only) |
| `useTodos` | todos | CRUD + 3 count hooks (pending/in_progress/blocked) |
| `useMessages` | messages + message_reads | Read + Send + Delete + MarkAsRead + UnreadCount |
| `useCabinetSettings` | cabinet_settings | Read + Update + IncrementInvoiceSeq + IncrementCreditSeq |
| `useAuditLog` | audit_logs | Read + Create |
| `useIsMobile` | — | Viewport detection (<768px) |
| `useToast` | — | Toast notification state |

All data hooks use TanStack React Query with query keys for cache invalidation on mutations.

---

## 14. COMPONENT INVENTORY

### 14.1 Custom Feature Components (15)
1. `AppLayout` — Main layout with sidebar + header + content
2. `ProtectedRoute` — Role-based route guard with loading spinner
3. `NavLink` — Enhanced React Router NavLink
4. `ColumnHeaderFilter` — Multi-select column filter popover + `useColumnFilters` hook
5. `DateRangeFilter` — Date from/to picker with calendars
6. `KPIAnalytics` — Timesheet KPI with grouping, filtering, CSV export
7. `KPIAnalyticsFlatFee` — Flat fee KPI analytics
8. `WIPAgingAnalysis` — WIP aging buckets table
9. `UnpaidInvoicesKPI` — Unpaid invoices aging analysis
10. `TimesheetExport` — Timesheet CSV exporter with preview
11. `TimesheetEntrySelector` — Entry selection table for invoicing with overrides
12. `TimesheetEntryDialog` — Create/edit timesheet entry modal
13. `MessageItem` — Single message display with reply/delete
14. `EmojiPicker` — 65-emoji picker in 3 categories
15. `InlineReplyForm` — Reply textarea with emoji support

### 14.2 shadcn/ui Components (60+)
Full set: Accordion, Alert, AlertDialog, AspectRatio, Avatar, Badge, Breadcrumb, Button, Calendar, Card, Carousel, Chart, Checkbox, Collapsible, Command, ContextMenu, Currency, Dialog, Drawer, DropdownMenu, Form, HoverCard, Input, InputOTP, Label, Menubar, NavigationMenu, Pagination, Popover, Progress, RadioGroup, ResizablePanel, ScrollArea, Select, Separator, Sheet, Sidebar (18 sub-components), Skeleton, Slider, Sonner, Switch, Table, Tabs, Textarea, Toast, Toggle, ToggleGroup, Tooltip

---

## 15. FILE STRUCTURE

```
src/
├── App.tsx                          # Routing + providers
├── main.tsx                         # Entry point
├── index.css                        # Design system CSS variables
├── components/
│   ├── layout/AppLayout.tsx         # Main layout
│   ├── ProtectedRoute.tsx           # Auth guard
│   ├── NavLink.tsx                  # Enhanced NavLink
│   ├── ColumnHeaderFilter.tsx       # Column filters
│   ├── DateRangeFilter.tsx          # Date range picker
│   ├── dashboard/
│   │   ├── KPIAnalytics.tsx
│   │   ├── KPIAnalyticsFlatFee.tsx
│   │   ├── WIPAgingAnalysis.tsx
│   │   ├── UnpaidInvoicesKPI.tsx
│   │   └── TimesheetExport.tsx
│   ├── invoices/
│   │   └── TimesheetEntrySelector.tsx
│   ├── timesheet/
│   │   └── TimesheetEntryDialog.tsx
│   ├── messages/
│   │   ├── MessageItem.tsx
│   │   ├── EmojiPicker.tsx
│   │   └── InlineReplyForm.tsx
│   └── ui/                          # 60+ shadcn/ui components
├── contexts/
│   └── AuthContext.tsx               # Auth state + methods
├── hooks/
│   ├── useClients.ts
│   ├── useMatters.ts
│   ├── useTimesheet.ts
│   ├── useExpenses.ts
│   ├── useInvoices.ts
│   ├── useCreditNotes.ts
│   ├── usePurchases.ts
│   ├── useProfiles.ts
│   ├── useAssignments.ts
│   ├── useTodos.ts
│   ├── useMessages.ts
│   ├── useCabinetSettings.ts
│   ├── useAuditLog.ts
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── integrations/supabase/
│   ├── client.ts                    # Supabase client init
│   └── types.ts                     # Full DB TypeScript types
├── i18n/
│   ├── index.ts                     # i18next config
│   └── locales/
│       ├── fr.json                  # French translations
│       └── en.json                  # English translations
├── lib/
│   ├── utils.ts                     # cn() class merge
│   ├── pdf.ts                       # PDF generation (invoice + credit note)
│   ├── word.ts                      # Word .docx generation
│   ├── invoicing.ts                 # Rate calc + line generation
│   └── exports.ts                   # All CSV export functions
└── pages/
    ├── Login.tsx
    ├── ResetPassword.tsx
    ├── Dashboard.tsx
    ├── DashboardCharts.tsx
    ├── Timesheet.tsx
    ├── Expenses.tsx
    ├── Clients.tsx
    ├── Matters.tsx
    ├── Invoices.tsx
    ├── CreditNotes.tsx
    ├── Purchases.tsx
    ├── Collaborators.tsx
    ├── Todos.tsx
    ├── Messages.tsx
    ├── Settings.tsx
    ├── Index.tsx
    └── NotFound.tsx

supabase/
├── migrations/                      # 21 SQL migration files
│   ├── 20260204132736_*.sql         # Initial schema
│   ├── ... (19 more)
│   └── 20260208134118_*.sql         # Matter budget cap
└── functions/
    ├── admin-create-user/index.ts   # Edge function: create user
    └── admin-reset-password/index.ts # Edge function: reset password
```

---

## 16. ENVIRONMENT VARIABLES

```
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<supabase-anon-key>
```

Edge functions use (auto-provided by Supabase):
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## 17. BUILD & DEVELOPMENT

```bash
npm run dev          # Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint
npm run test         # Vitest
```

---

## 18. RECONSTRUCTION GUIDE

To recreate this project from scratch without Lovable:

### Step 1: Scaffold
```bash
npm create vite@latest solo-cabinet-flow -- --template react-ts
cd solo-cabinet-flow
npx shadcn-ui@latest init
```

### Step 2: Install Dependencies
```bash
npm install @supabase/supabase-js @tanstack/react-query react-router-dom \
  date-fns docx file-saver i18next react-i18next i18next-browser-languagedetector \
  recharts sonner react-day-picker react-hook-form @hookform/resolvers zod \
  lucide-react class-variance-authority clsx tailwind-merge tailwindcss-animate \
  cmdk input-otp vaul react-resizable-panels embla-carousel-react
```

### Step 3: Add shadcn/ui Components
```bash
npx shadcn-ui@latest add accordion alert alert-dialog aspect-ratio avatar badge \
  breadcrumb button calendar card carousel chart checkbox collapsible command \
  context-menu dialog drawer dropdown-menu form hover-card input input-otp \
  label menubar navigation-menu pagination popover progress radio-group \
  resizable scroll-area select separator sheet sidebar skeleton slider \
  sonner switch table tabs textarea toast toggle toggle-group tooltip
```

### Step 4: Supabase Setup
1. Create Supabase project
2. Run all 21 migration files in order
3. Deploy 2 edge functions
4. Enable realtime on `messages` table
5. Set environment variables

### Step 5: Build in Order
1. Design system (index.css + tailwind.config.ts)
2. Supabase client + types
3. AuthContext
4. i18n configuration + translation files
5. Utility libraries (utils, invoicing, pdf, word, exports)
6. Custom hooks (15 hooks)
7. UI components (shadcn/ui)
8. Custom feature components (15 components)
9. Pages (17 pages)
10. App.tsx routing
11. main.tsx entry point
