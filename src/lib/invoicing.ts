// Invoicing business logic for FlowAssist

import type { Invoice, InvoiceLine, CreditNote, TimesheetEntry, Matter, User } from '@/types';
import {
  getTimesheetEntries,
  saveTimesheetEntry,
  getMatters,
  getUsers,
  getCabinetSettings,
  saveCabinetSettings,
  saveInvoice,
  saveCreditNote,
  generateId,
  addAuditLog,
  getCurrentUser,
} from './storage';

export type GroupingMode = 'single' | 'by_collaborator';

// Get effective rate for a matter/user combination (priority: matter > user > cabinet)
export function getEffectiveRate(matterId: string, userId: string): number {
  const matter = getMatters().find(m => m.id === matterId);
  const user = getUsers().find(u => u.id === userId);
  const settings = getCabinetSettings();

  // Priority: matter rate > user rate > cabinet rate
  return matter?.rateCents || user?.rateCents || settings.rateCabinetCents;
}

// Get billable entries for a matter in a period (not yet invoiced)
export function getBillableEntries(
  matterId: string,
  periodFrom: string,
  periodTo: string
): TimesheetEntry[] {
  const entries = getTimesheetEntries();
  return entries.filter(e =>
    e.matterId === matterId &&
    e.billable &&
    !e.locked &&
    !e.invoiceId &&
    e.date >= periodFrom &&
    e.date <= periodTo
  );
}

// Calculate line amount (HT, TVA, TTC) - all in cents
function calculateLineAmounts(
  minutes: number,
  rateCents: number,
  vatRate: 0 | 20
): { amountHtCents: number; vatCents: number; amountTtcCents: number } {
  // montant_ht_cents = round_half_up(minutes * taux_cents_par_heure / 60)
  const amountHtCents = Math.round((minutes * rateCents) / 60);
  // tva_cents = round_half_up(montant_ht_cents * taux_tva)
  const vatCents = Math.round((amountHtCents * vatRate) / 100);
  const amountTtcCents = amountHtCents + vatCents;

  return { amountHtCents, vatCents, amountTtcCents };
}

// Create invoice lines based on grouping mode
export function createInvoiceLines(
  entries: TimesheetEntry[],
  matterId: string,
  groupingMode: GroupingMode = 'single'
): InvoiceLine[] {
  const matter = getMatters().find(m => m.id === matterId);
  const users = getUsers();
  const vatRate = matter?.vatRate ?? 20;
  const lines: InvoiceLine[] = [];

  if (groupingMode === 'single') {
    // Single line: "Prestations"
    const totalMinutes = entries.reduce((sum, e) => sum + e.minutesRounded, 0);
    
    // Calculate weighted average rate
    let totalWeightedRate = 0;
    entries.forEach(e => {
      const rate = getEffectiveRate(matterId, e.userId);
      totalWeightedRate += rate * e.minutesRounded;
    });
    const avgRateCents = totalMinutes > 0 ? Math.round(totalWeightedRate / totalMinutes) : getEffectiveRate(matterId, entries[0]?.userId || '');

    const amounts = calculateLineAmounts(totalMinutes, avgRateCents, vatRate);

    lines.push({
      id: generateId(),
      invoiceId: '', // Will be set when saving
      label: 'Prestations juridiques',
      minutes: totalMinutes,
      rateCents: avgRateCents,
      vatRate,
      ...amounts,
    });
  } else {
    // Group by collaborator
    const groupedByUser = new Map<string, TimesheetEntry[]>();
    entries.forEach(e => {
      const current = groupedByUser.get(e.userId) || [];
      current.push(e);
      groupedByUser.set(e.userId, current);
    });

    groupedByUser.forEach((userEntries, userId) => {
      const user = users.find(u => u.id === userId);
      const totalMinutes = userEntries.reduce((sum, e) => sum + e.minutesRounded, 0);
      const rateCents = getEffectiveRate(matterId, userId);
      const amounts = calculateLineAmounts(totalMinutes, rateCents, vatRate);

      lines.push({
        id: generateId(),
        invoiceId: '',
        label: `Prestations - ${user?.name || 'Collaborateur'}`,
        minutes: totalMinutes,
        rateCents,
        vatRate,
        ...amounts,
      });
    });
  }

  return lines;
}

// Create a draft invoice
export function createDraftInvoice(
  matterId: string,
  clientId: string,
  periodFrom: string,
  periodTo: string,
  groupingMode: GroupingMode = 'single'
): Invoice {
  const entries = getBillableEntries(matterId, periodFrom, periodTo);
  const lines = createInvoiceLines(entries, matterId, groupingMode);

  // Calculate totals
  const totalHtCents = lines.reduce((sum, l) => sum + l.amountHtCents, 0);
  const totalVatCents = lines.reduce((sum, l) => sum + l.vatCents, 0);
  const totalTtcCents = lines.reduce((sum, l) => sum + l.amountTtcCents, 0);

  const invoice: Invoice = {
    id: generateId(),
    year: new Date().getFullYear(),
    matterId,
    clientId,
    periodFrom,
    periodTo,
    status: 'draft',
    totalHtCents,
    totalVatCents,
    totalTtcCents,
    lines: lines.map(l => ({ ...l, invoiceId: '' })),
    createdAt: new Date().toISOString(),
  };

  // Update line invoiceIds
  invoice.lines = invoice.lines.map(l => ({ ...l, invoiceId: invoice.id }));

  saveInvoice(invoice);
  return invoice;
}

// Issue an invoice (assign number, lock entries)
export function issueInvoice(invoiceId: string): Invoice | null {
  const settings = getCabinetSettings();
  const currentYear = new Date().getFullYear();

  // Check if we need to reset sequence for new year
  if (settings.invoiceSeqYear !== currentYear) {
    settings.invoiceSeqYear = currentYear;
    settings.invoiceSeqNext = 1;
  }

  // Get invoice
  const invoices = JSON.parse(localStorage.getItem('flowassist_invoices') || '[]');
  const invoice = invoices.find((i: Invoice) => i.id === invoiceId);
  
  if (!invoice || invoice.status !== 'draft') {
    return null;
  }

  // Assign number
  const number = `${currentYear}-${String(settings.invoiceSeqNext).padStart(4, '0')}`;
  settings.invoiceSeqNext++;
  saveCabinetSettings(settings);

  // Update invoice
  invoice.number = number;
  invoice.status = 'issued';
  invoice.issueDate = new Date().toISOString().split('T')[0];

  // Lock timesheet entries
  const entries = getBillableEntries(invoice.matterId, invoice.periodFrom, invoice.periodTo);
  entries.forEach(entry => {
    saveTimesheetEntry({
      ...entry,
      locked: true,
      invoiceId: invoice.id,
    });
  });

  saveInvoice(invoice);

  // Audit log
  const currentUser = getCurrentUser();
  if (currentUser) {
    addAuditLog({
      actorUserId: currentUser.id,
      action: 'issue_invoice',
      entityType: 'invoice',
      entityId: invoice.id,
      metadata: { invoiceNumber: number },
    });
  }

  return invoice;
}

// Create a credit note (total or partial)
export function createCreditNote(
  invoiceId: string,
  reason: string,
  partialAmountCents?: number // If undefined, creates total credit note
): CreditNote | null {
  const settings = getCabinetSettings();
  const currentYear = new Date().getFullYear();

  // Check if we need to reset sequence for new year
  if (settings.creditSeqYear !== currentYear) {
    settings.creditSeqYear = currentYear;
    settings.creditSeqNext = 1;
  }

  // Get invoice
  const invoices = JSON.parse(localStorage.getItem('flowassist_invoices') || '[]');
  const invoice = invoices.find((i: Invoice) => i.id === invoiceId);
  
  if (!invoice || invoice.status !== 'issued') {
    return null;
  }

  // Calculate credit note amounts
  let totalHtCents: number;
  let totalVatCents: number;
  let totalTtcCents: number;

  if (partialAmountCents !== undefined) {
    // Partial: proportional calculation
    const ratio = partialAmountCents / invoice.totalTtcCents;
    totalHtCents = Math.round(invoice.totalHtCents * ratio);
    totalVatCents = Math.round(invoice.totalVatCents * ratio);
    totalTtcCents = partialAmountCents;
  } else {
    // Total credit note
    totalHtCents = invoice.totalHtCents;
    totalVatCents = invoice.totalVatCents;
    totalTtcCents = invoice.totalTtcCents;

    // Mark invoice as cancelled
    invoice.status = 'cancelled';
    saveInvoice(invoice);
  }

  // Assign number
  const number = `AV-${currentYear}-${String(settings.creditSeqNext).padStart(4, '0')}`;
  settings.creditSeqNext++;
  saveCabinetSettings(settings);

  const creditNote: CreditNote = {
    id: generateId(),
    number,
    year: currentYear,
    invoiceId,
    issueDate: new Date().toISOString().split('T')[0],
    status: 'issued',
    totalHtCents,
    totalVatCents,
    totalTtcCents,
    reason,
    createdAt: new Date().toISOString(),
  };

  saveCreditNote(creditNote);

  // Audit log
  const currentUser = getCurrentUser();
  if (currentUser) {
    addAuditLog({
      actorUserId: currentUser.id,
      action: 'create_credit_note',
      entityType: 'credit_note',
      entityId: creditNote.id,
      metadata: { creditNumber: number, invoiceId, reason },
    });
  }

  return creditNote;
}
