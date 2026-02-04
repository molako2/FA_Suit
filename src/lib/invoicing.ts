// Invoicing business logic for FlowAssist
// Note: Most invoice logic is now handled in components with Supabase hooks
// This file contains pure utility functions that don't depend on storage

import type { InvoiceLine, TimesheetEntry, Matter, User, CabinetSettings } from '@/types';

export type GroupingMode = 'single' | 'by_collaborator';

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get effective rate for a matter/user combination (priority: matter > user > cabinet)
export function getEffectiveRate(
  matterId: string,
  userId: string,
  matters: Matter[],
  users: User[],
  settings: CabinetSettings
): number {
  const matter = matters.find(m => m.id === matterId);
  const user = users.find(u => u.id === userId);

  // Priority: matter rate > user rate > cabinet rate
  return matter?.rateCents || user?.rateCents || settings.rateCabinetCents;
}

// Calculate line amount (HT, TVA, TTC) - all in cents
export function calculateLineAmounts(
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

// Create invoice lines based on grouping mode - now accepts data as parameters
export function createInvoiceLines(
  entries: TimesheetEntry[],
  matterId: string,
  matters: Matter[],
  users: User[],
  settings: CabinetSettings,
  groupingMode: GroupingMode = 'single'
): InvoiceLine[] {
  const matter = matters.find(m => m.id === matterId);
  const vatRate = (matter?.vatRate ?? 20) as 0 | 20;
  const lines: InvoiceLine[] = [];

  if (groupingMode === 'single') {
    // Single line: "Prestations"
    const totalMinutes = entries.reduce((sum, e) => sum + e.minutesRounded, 0);
    
    // Calculate weighted average rate
    let totalWeightedRate = 0;
    entries.forEach(e => {
      const rate = getEffectiveRate(matterId, e.userId, matters, users, settings);
      totalWeightedRate += rate * e.minutesRounded;
    });
    const avgRateCents = totalMinutes > 0 
      ? Math.round(totalWeightedRate / totalMinutes) 
      : getEffectiveRate(matterId, entries[0]?.userId || '', matters, users, settings);

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
      const rateCents = getEffectiveRate(matterId, userId, matters, users, settings);
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
