// localStorage-based persistence layer for FlowAssist MVP

import type {
  User,
  Client,
  Matter,
  Assignment,
  TimesheetEntry,
  Invoice,
  CreditNote,
  CabinetSettings,
  AuditLog,
} from '@/types';

const STORAGE_KEYS = {
  currentUser: 'flowassist_current_user',
  users: 'flowassist_users',
  clients: 'flowassist_clients',
  matters: 'flowassist_matters',
  assignments: 'flowassist_assignments',
  timesheetEntries: 'flowassist_timesheet',
  invoices: 'flowassist_invoices',
  creditNotes: 'flowassist_credit_notes',
  cabinetSettings: 'flowassist_cabinet',
  auditLogs: 'flowassist_audit',
} as const;

// Generic helpers
function getItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generate sequential code
export function generateCode(prefix: string, items: { code: string }[]): string {
  const existingCodes = items.map(i => i.code);
  let num = items.length + 1;
  let code = `${prefix}${String(num).padStart(4, '0')}`;
  while (existingCodes.includes(code)) {
    num++;
    code = `${prefix}${String(num).padStart(4, '0')}`;
  }
  return code;
}

// Round minutes to 15-minute increments (ceiling)
export function roundMinutes(minutes: number): number {
  if (minutes <= 0) return 15;
  return Math.ceil(minutes / 15) * 15;
}

// Format cents to euros
export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' MAD';
}

// Format minutes to hours display
export function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins}`;
}

// Current User
export function getCurrentUser(): User | null {
  return getItem<User | null>(STORAGE_KEYS.currentUser, null);
}

export function setCurrentUser(user: User | null): void {
  setItem(STORAGE_KEYS.currentUser, user);
}

// Users CRUD
export function getUsers(): User[] {
  return getItem<User[]>(STORAGE_KEYS.users, []);
}

export function saveUser(user: User): void {
  const users = getUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index >= 0) {
    users[index] = user;
  } else {
    users.push(user);
  }
  setItem(STORAGE_KEYS.users, users);
}

export function deleteUser(userId: string): void {
  const users = getUsers().filter(u => u.id !== userId);
  setItem(STORAGE_KEYS.users, users);
}

// Clients CRUD
export function getClients(): Client[] {
  return getItem<Client[]>(STORAGE_KEYS.clients, []);
}

export function saveClient(client: Client): void {
  const clients = getClients();
  const index = clients.findIndex(c => c.id === client.id);
  if (index >= 0) {
    clients[index] = client;
  } else {
    clients.push(client);
  }
  setItem(STORAGE_KEYS.clients, clients);
}

export function deleteClient(clientId: string): void {
  const clients = getClients().filter(c => c.id !== clientId);
  setItem(STORAGE_KEYS.clients, clients);
}

// Matters CRUD
export function getMatters(): Matter[] {
  return getItem<Matter[]>(STORAGE_KEYS.matters, []);
}

export function saveMatter(matter: Matter): void {
  const matters = getMatters();
  const index = matters.findIndex(m => m.id === matter.id);
  if (index >= 0) {
    matters[index] = matter;
  } else {
    matters.push(matter);
  }
  setItem(STORAGE_KEYS.matters, matters);
}

export function deleteMatter(matterId: string): void {
  const matters = getMatters().filter(m => m.id !== matterId);
  setItem(STORAGE_KEYS.matters, matters);
}

// Assignments CRUD
export function getAssignments(): Assignment[] {
  return getItem<Assignment[]>(STORAGE_KEYS.assignments, []);
}

export function saveAssignment(assignment: Assignment): void {
  const assignments = getAssignments();
  const index = assignments.findIndex(a => a.id === assignment.id);
  if (index >= 0) {
    assignments[index] = assignment;
  } else {
    assignments.push(assignment);
  }
  setItem(STORAGE_KEYS.assignments, assignments);
}

export function deleteAssignment(assignmentId: string): void {
  const assignments = getAssignments().filter(a => a.id !== assignmentId);
  setItem(STORAGE_KEYS.assignments, assignments);
}

export function getUserAssignedMatters(userId: string): Matter[] {
  const assignments = getAssignments();
  const matters = getMatters();
  const today = new Date().toISOString().split('T')[0];
  
  const activeAssignments = assignments.filter(a => 
    a.userId === userId &&
    a.startDate <= today &&
    (!a.endDate || a.endDate >= today)
  );
  
  const assignedMatterIds = new Set(activeAssignments.map(a => a.matterId));
  return matters.filter(m => assignedMatterIds.has(m.id) && m.status === 'open');
}

// Timesheet Entries CRUD
export function getTimesheetEntries(): TimesheetEntry[] {
  return getItem<TimesheetEntry[]>(STORAGE_KEYS.timesheetEntries, []);
}

export function saveTimesheetEntry(entry: TimesheetEntry): void {
  const entries = getTimesheetEntries();
  const index = entries.findIndex(e => e.id === entry.id);
  if (index >= 0) {
    entries[index] = entry;
  } else {
    entries.push(entry);
  }
  setItem(STORAGE_KEYS.timesheetEntries, entries);
}

export function deleteTimesheetEntry(entryId: string): void {
  const entries = getTimesheetEntries().filter(e => e.id !== entryId);
  setItem(STORAGE_KEYS.timesheetEntries, entries);
}

export function getUserTimesheetEntries(userId: string, from?: string, to?: string): TimesheetEntry[] {
  let entries = getTimesheetEntries().filter(e => e.userId === userId);
  if (from) entries = entries.filter(e => e.date >= from);
  if (to) entries = entries.filter(e => e.date <= to);
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

// Invoices CRUD
export function getInvoices(): Invoice[] {
  return getItem<Invoice[]>(STORAGE_KEYS.invoices, []);
}

export function saveInvoice(invoice: Invoice): void {
  const invoices = getInvoices();
  const index = invoices.findIndex(i => i.id === invoice.id);
  if (index >= 0) {
    invoices[index] = invoice;
  } else {
    invoices.push(invoice);
  }
  setItem(STORAGE_KEYS.invoices, invoices);
}

export function deleteInvoice(invoiceId: string): void {
  const invoices = getInvoices().filter(i => i.id !== invoiceId);
  setItem(STORAGE_KEYS.invoices, invoices);
}

// Credit Notes CRUD
export function getCreditNotes(): CreditNote[] {
  return getItem<CreditNote[]>(STORAGE_KEYS.creditNotes, []);
}

export function saveCreditNote(creditNote: CreditNote): void {
  const creditNotes = getCreditNotes();
  const index = creditNotes.findIndex(c => c.id === creditNote.id);
  if (index >= 0) {
    creditNotes[index] = creditNote;
  } else {
    creditNotes.push(creditNote);
  }
  setItem(STORAGE_KEYS.creditNotes, creditNotes);
}

// Cabinet Settings
export function getCabinetSettings(): CabinetSettings {
  return getItem<CabinetSettings>(STORAGE_KEYS.cabinetSettings, {
    id: 'cabinet-1',
    name: 'Mon Cabinet',
    rateCabinetCents: 15000, // 150€/h default
    vatDefault: 20,
    invoiceSeqYear: new Date().getFullYear(),
    invoiceSeqNext: 1,
    creditSeqYear: new Date().getFullYear(),
    creditSeqNext: 1,
  });
}

export function saveCabinetSettings(settings: CabinetSettings): void {
  setItem(STORAGE_KEYS.cabinetSettings, settings);
}

// Audit Log
export function getAuditLogs(): AuditLog[] {
  return getItem<AuditLog[]>(STORAGE_KEYS.auditLogs, []);
}

export function addAuditLog(log: Omit<AuditLog, 'id' | 'createdAt'>): void {
  const logs = getAuditLogs();
  logs.push({
    ...log,
    id: generateId(),
    createdAt: new Date().toISOString(),
  });
  setItem(STORAGE_KEYS.auditLogs, logs);
}

// Initialize demo data
export function initializeDemoData(): void {
  if (getUsers().length > 0) return; // Already initialized

  const now = new Date().toISOString();
  const today = now.split('T')[0];

  // Create demo users
  const owner: User = {
    id: 'user-owner',
    email: 'associe@cabinet.fr',
    name: 'Marie Dupont',
    role: 'owner',
    active: true,
    createdAt: now,
    rateCents: 20000,
  };

  const assistant: User = {
    id: 'user-assistant',
    email: 'assistant@cabinet.fr',
    name: 'Jean Martin',
    role: 'assistant',
    active: true,
    createdAt: now,
  };

  const collaborator: User = {
    id: 'user-collab',
    email: 'collaborateur@cabinet.fr',
    name: 'Sophie Bernard',
    role: 'collaborator',
    active: true,
    createdAt: now,
    rateCents: 12000,
  };

  saveUser(owner);
  saveUser(assistant);
  saveUser(collaborator);

  // Create demo clients
  const client1: Client = {
    id: 'client-1',
    code: 'CLI0001',
    name: 'Entreprise ABC',
    address: '123 Rue de Paris, 75001 Paris',
    billingEmail: 'compta@abc.fr',
    active: true,
    createdAt: now,
  };

  const client2: Client = {
    id: 'client-2',
    code: 'CLI0002',
    name: 'Société XYZ',
    address: '456 Avenue des Champs, 69001 Lyon',
    billingEmail: 'facturation@xyz.fr',
    active: true,
    createdAt: now,
  };

  saveClient(client1);
  saveClient(client2);

  // Create demo matters
  const matter1: Matter = {
    id: 'matter-1',
    code: 'DOS0001',
    label: 'Contentieux commercial ABC',
    clientId: 'client-1',
    status: 'open',
    rateCents: 18000,
    vatRate: 20,
    createdAt: now,
  };

  const matter2: Matter = {
    id: 'matter-2',
    code: 'DOS0002',
    label: 'Conseil juridique XYZ',
    clientId: 'client-2',
    status: 'open',
    vatRate: 20,
    createdAt: now,
  };

  saveMatter(matter1);
  saveMatter(matter2);

  // Create assignments
  const assignment1: Assignment = {
    id: 'assign-1',
    matterId: 'matter-1',
    userId: 'user-collab',
    startDate: '2026-01-01',
  };

  const assignment2: Assignment = {
    id: 'assign-2',
    matterId: 'matter-2',
    userId: 'user-collab',
    startDate: '2026-01-15',
  };

  const assignment3: Assignment = {
    id: 'assign-3',
    matterId: 'matter-1',
    userId: 'user-owner',
    startDate: '2026-01-01',
  };

  saveAssignment(assignment1);
  saveAssignment(assignment2);
  saveAssignment(assignment3);

  // Create demo timesheet entries
  const entries: Omit<TimesheetEntry, 'id' | 'createdAt'>[] = [
    {
      userId: 'user-collab',
      matterId: 'matter-1',
      date: '2026-02-03',
      minutesRounded: 120,
      description: 'Rédaction conclusions',
      billable: true,
      locked: false,
    },
    {
      userId: 'user-collab',
      matterId: 'matter-1',
      date: '2026-02-02',
      minutesRounded: 90,
      description: 'Recherches jurisprudence',
      billable: true,
      locked: false,
    },
    {
      userId: 'user-collab',
      matterId: 'matter-2',
      date: '2026-02-01',
      minutesRounded: 60,
      description: 'Appel client - point situation',
      billable: true,
      locked: false,
    },
    {
      userId: 'user-owner',
      matterId: 'matter-1',
      date: '2026-02-03',
      minutesRounded: 45,
      description: 'Supervision dossier',
      billable: true,
      locked: false,
    },
  ];

  entries.forEach(entry => {
    saveTimesheetEntry({
      ...entry,
      id: generateId(),
      createdAt: now,
    });
  });
}
