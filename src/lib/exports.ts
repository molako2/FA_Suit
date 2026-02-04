// CSV Export utilities for FlowAssist

import type { TimesheetEntry, Invoice, CreditNote, KPIByUser, KPIByMatter, Matter, Client, User } from '@/types';

function escapeCSV(value: string | number | boolean | undefined | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: (string | number | boolean | undefined | null)[][]): string {
  const lines = [headers.join(';')];
  for (const row of rows) {
    lines.push(row.map(escapeCSV).join(';'));
  }
  return lines.join('\n');
}

function downloadCSV(content: string, filename: string): void {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export Timesheet entries - now accepts data as parameters
export function exportTimesheetCSV(
  entries: TimesheetEntry[],
  matters: Matter[],
  clients: Client[],
  users: User[],
  invoices: Invoice[],
  filename?: string
): void {
  const headers = [
    'Date',
    'Collaborateur Email',
    'Dossier Code',
    'Dossier Libellé',
    'Client Code',
    'Minutes Arrondies',
    'Heures',
    'Facturable',
    'Description',
    'Verrouillé',
    'N° Facture'
  ];

  const rows = entries.map(e => {
    const user = users.find(u => u.id === e.userId);
    const matter = matters.find(m => m.id === e.matterId);
    const client = clients.find(c => c.id === matter?.clientId);
    const invoice = e.invoiceId ? invoices.find(i => i.id === e.invoiceId) : null;

    return [
      e.date,
      user?.email || '',
      matter?.code || '',
      matter?.label || '',
      client?.code || '',
      e.minutesRounded,
      (e.minutesRounded / 60).toFixed(2),
      e.billable ? 'Oui' : 'Non',
      e.description,
      e.locked ? 'Oui' : 'Non',
      invoice?.number || ''
    ];
  });

  downloadCSV(toCSV(headers, rows), filename || `timesheet_${new Date().toISOString().split('T')[0]}.csv`);
}

// Export KPI by User
export function exportKPIByUserCSV(data: KPIByUser[], periodFrom: string, periodTo: string): void {
  const headers = [
    'Collaborateur Email',
    'Collaborateur Nom',
    'Minutes Facturables',
    'Heures Facturables'
  ];

  const rows = data.map(d => [
    d.userEmail,
    d.userName,
    d.billableMinutes,
    (d.billableMinutes / 60).toFixed(2)
  ]);

  downloadCSV(toCSV(headers, rows), `kpi_par_collaborateur_${periodFrom}_${periodTo}.csv`);
}

// Export KPI by Matter
export function exportKPIByMatterCSV(data: KPIByMatter[], periodFrom: string, periodTo: string): void {
  const headers = [
    'Dossier Code',
    'Dossier Libellé',
    'Client Code',
    'Minutes Facturables',
    'Heures Facturables'
  ];

  const rows = data.map(d => [
    d.matterCode,
    d.matterLabel,
    d.clientCode,
    d.billableMinutes,
    (d.billableMinutes / 60).toFixed(2)
  ]);

  downloadCSV(toCSV(headers, rows), `kpi_par_dossier_${periodFrom}_${periodTo}.csv`);
}

// Export Invoices - now accepts matters and clients as parameters
export function exportInvoicesCSV(invoices: Invoice[], matters: Matter[], clients: Client[]): void {
  const headers = [
    'N° Facture',
    'Date Émission',
    'Dossier Code',
    'Client Code',
    'Client Nom',
    'Période Du',
    'Période Au',
    'Total HT',
    'Total TVA',
    'Total TTC',
    'Statut'
  ];

  const statusLabels: Record<string, string> = {
    draft: 'Brouillon',
    issued: 'Émise',
    cancelled: 'Annulée'
  };

  const rows = invoices.map(i => {
    const matter = matters.find(m => m.id === i.matterId);
    const client = clients.find(c => c.id === i.clientId);

    return [
      i.number || 'Brouillon',
      i.issueDate || '',
      matter?.code || '',
      client?.code || '',
      client?.name || '',
      i.periodFrom,
      i.periodTo,
      (i.totalHtCents / 100).toFixed(2),
      (i.totalVatCents / 100).toFixed(2),
      (i.totalTtcCents / 100).toFixed(2),
      statusLabels[i.status] || i.status
    ];
  });

  downloadCSV(toCSV(headers, rows), `factures_${new Date().toISOString().split('T')[0]}.csv`);
}

// Export Credit Notes - now accepts invoices as parameter
export function exportCreditNotesCSV(creditNotes: CreditNote[], invoices: Invoice[]): void {
  const headers = [
    'N° Avoir',
    'Date Émission',
    'N° Facture Liée',
    'Total HT',
    'Total TVA',
    'Total TTC',
    'Raison'
  ];

  const rows = creditNotes.map(cn => {
    const invoice = invoices.find(i => i.id === cn.invoiceId);

    return [
      cn.number || '',
      cn.issueDate,
      invoice?.number || '',
      (cn.totalHtCents / 100).toFixed(2),
      (cn.totalVatCents / 100).toFixed(2),
      (cn.totalTtcCents / 100).toFixed(2),
      cn.reason || ''
    ];
  });

  downloadCSV(toCSV(headers, rows), `avoirs_${new Date().toISOString().split('T')[0]}.csv`);
}

// Export Clients
export interface ClientExport {
  code: string;
  name: string;
  address?: string | null;
  billingEmail?: string | null;
  vatNumber?: string | null;
  active: boolean;
}

export function exportClientsCSV(clients: ClientExport[]): void {
  const headers = [
    'Code',
    'Nom',
    'Adresse',
    'Email Facturation',
    'N° TVA',
    'Statut'
  ];

  const rows = clients.map(c => [
    c.code,
    c.name,
    c.address || '',
    c.billingEmail || '',
    c.vatNumber || '',
    c.active ? 'Actif' : 'Inactif'
  ]);

  downloadCSV(toCSV(headers, rows), `clients_${new Date().toISOString().split('T')[0]}.csv`);
}

// Export Matters
export interface MatterExport {
  code: string;
  label: string;
  clientId: string;
  status: 'open' | 'closed';
  rateCents?: number | null;
  vatRate: number;
}

export interface ClientForMatterExport {
  id: string;
  code: string;
  name: string;
}

export function exportMattersCSV(matters: MatterExport[], clients: ClientForMatterExport[]): void {
  const headers = [
    'Code',
    'Libellé',
    'Client Code',
    'Client Nom',
    'Taux Horaire (MAD)',
    'TVA (%)',
    'Statut'
  ];

  const rows = matters.map(m => {
    const client = clients.find(c => c.id === m.clientId);
    return [
      m.code,
      m.label,
      client?.code || '',
      client?.name || '',
      m.rateCents ? (m.rateCents / 100).toFixed(2) : '',
      m.vatRate,
      m.status === 'open' ? 'Ouvert' : 'Clôturé'
    ];
  });

  downloadCSV(toCSV(headers, rows), `dossiers_${new Date().toISOString().split('T')[0]}.csv`);
}

// Export Collaborators
export interface CollaboratorExport {
  email: string;
  name: string;
  role: string;
  rateCents?: number | null;
  active: boolean;
}

export function exportCollaboratorsCSV(users: CollaboratorExport[]): void {
  const headers = [
    'Email',
    'Nom',
    'Rôle',
    'Taux Horaire (MAD)',
    'Statut'
  ];

  const roleLabels: Record<string, string> = {
    sysadmin: 'Sysadmin',
    owner: 'Associé',
    assistant: 'Assistant',
    collaborator: 'Collaborateur'
  };

  const rows = users.map(u => [
    u.email,
    u.name,
    roleLabels[u.role] || u.role,
    u.rateCents ? (u.rateCents / 100).toFixed(2) : '',
    u.active ? 'Actif' : 'Inactif'
  ]);

  downloadCSV(toCSV(headers, rows), `collaborateurs_${new Date().toISOString().split('T')[0]}.csv`);
}
