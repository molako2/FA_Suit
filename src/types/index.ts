// FlowAssist Types

export type UserRole = 'sysadmin' | 'owner' | 'assistant' | 'collaborator';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
  rateCents?: number; // hourly rate in cents
}

export interface Client {
  id: string;
  code: string;
  name: string;
  address?: string;
  billingEmail?: string;
  vatNumber?: string;
  active: boolean;
  createdAt: string;
}

export interface Matter {
  id: string;
  code: string;
  label: string;
  clientId: string;
  status: 'open' | 'closed';
  rateCents?: number; // hourly rate in cents (overrides client/cabinet rate)
  vatRate: 0 | 20; // TVA rate
  createdAt: string;
}

export interface Assignment {
  id: string;
  matterId: string;
  userId: string;
  startDate: string;
  endDate?: string;
}

export interface TimesheetEntry {
  id: string;
  userId: string;
  matterId: string;
  date: string;
  minutesRounded: number; // always multiple of 15
  minutesOriginal?: number;
  description: string;
  billable: boolean;
  locked: boolean;
  invoiceId?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  number?: string; // YYYY-#### format, assigned on issue
  year: number;
  matterId: string;
  clientId: string;
  periodFrom: string;
  periodTo: string;
  issueDate?: string;
  status: 'draft' | 'issued' | 'cancelled';
  totalHtCents: number;
  totalVatCents: number;
  totalTtcCents: number;
  lines: InvoiceLine[];
  createdAt: string;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  label: string;
  minutes: number;
  rateCents: number;
  vatRate: 0 | 20;
  amountHtCents: number;
  vatCents: number;
  amountTtcCents: number;
}

export interface CreditNote {
  id: string;
  number?: string; // AV-YYYY-#### format
  year: number;
  invoiceId: string;
  issueDate: string;
  status: 'issued';
  totalHtCents: number;
  totalVatCents: number;
  totalTtcCents: number;
  reason?: string;
  createdAt: string;
}

export interface CabinetSettings {
  id: string;
  name: string;
  rateCabinetCents: number; // default hourly rate
  vatDefault: 0 | 20;
  logoUrl?: string;
  address?: string;
  mentions?: string; // legal mentions
  iban?: string;
  invoiceSeqYear: number;
  invoiceSeqNext: number;
  creditSeqYear: number;
  creditSeqNext: number;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// KPI Types
export interface KPISummary {
  totalMinutes: number;
  totalBillableMinutes: number;
  periodFrom: string;
  periodTo: string;
}

export interface KPIByUser {
  userId: string;
  userName: string;
  userEmail: string;
  billableMinutes: number;
}

export interface KPIByMatter {
  matterId: string;
  matterCode: string;
  matterLabel: string;
  clientCode: string;
  billableMinutes: number;
}
