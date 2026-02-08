import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMatters } from "@/hooks/useMatters";
import { useClients } from "@/hooks/useClients";
import {
  useInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  type Invoice,
  type InvoiceLine,
} from "@/hooks/useInvoices";
import { useCabinetSettings, useIncrementInvoiceSeq } from "@/hooks/useCabinetSettings";
import { useTimesheetEntries, useLockTimesheetEntries, formatMinutesToHours } from "@/hooks/useTimesheet";
import { useProfiles } from "@/hooks/useProfiles";
import { useExpensesByMatter, useLockExpenses, formatCentsTTC, type Expense } from "@/hooks/useExpenses";
import { printInvoicePDF } from "@/lib/pdf";
import { exportInvoicesCSV } from "@/lib/exports";
import { exportInvoiceWord } from "@/lib/word";
import { FileText, Plus, Download, Eye, Send, Trash2, Printer, FileDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Currency, formatAmount } from "@/components/ui/currency";
import DateRangeFilter from "@/components/DateRangeFilter";
import { ColumnHeaderFilter, useColumnFilters, type FilterOption } from "@/components/ColumnHeaderFilter";
import TimesheetEntrySelector, { type TimesheetEntryOverride } from "@/components/invoices/TimesheetEntrySelector";

// Format cents to currency
function formatCentsText(cents: number): string {
  return formatAmount(cents) + " MAD";
}

// Alias for backwards compatibility
const formatCents = formatCentsText;

export default function Invoices() {
  const { role } = useAuth();
  const { data: invoices = [], isLoading: isLoadingInvoices } = useInvoices();
  const { data: matters = [] } = useMatters();
  const { data: clients = [] } = useClients();
  const { data: settings } = useCabinetSettings();
  const { data: profiles = [] } = useProfiles();

  const createInvoiceMutation = useCreateInvoice();
  const updateInvoiceMutation = useUpdateInvoice();
  const deleteInvoiceMutation = useDeleteInvoice();
  const incrementInvoiceSeq = useIncrementInvoiceSeq();
  const lockEntriesMutation = useLockTimesheetEntries();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const { filters, setFilter, passesFilter } = useColumnFilters([
    'matter', 'client', 'status', 'paid', 'invoiceNumber', 'period', 'issueDate', 'ht', 'ttc', 'paymentDate'
  ] as const);

  const matterFilterOptions: FilterOption[] = useMemo(() => {
    const uniqueMatterIds = [...new Set(invoices.map((i) => i.matter_id))];
    return uniqueMatterIds.map((id) => {
      const matter = matters.find((m) => m.id === id);
      return { label: matter ? `${matter.code} - ${matter.label}` : 'Inconnu', value: id };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [invoices, matters]);

  const clientFilterOptions: FilterOption[] = useMemo(() => {
    const uniqueClientIds = [...new Set(invoices.map((i) => {
      const matter = matters.find((m) => m.id === i.matter_id);
      return matter?.client_id || '';
    }).filter(Boolean))];
    return uniqueClientIds.map((id) => {
      const client = clients.find((c) => c.id === id);
      return { label: client?.name || 'Inconnu', value: id };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [invoices, matters, clients]);

  const statusFilterOptions: FilterOption[] = [
    { label: 'Brouillon', value: 'draft' },
    { label: 'Émise', value: 'issued' },
    { label: 'Annulée', value: 'cancelled' },
  ];

  const paidFilterOptions: FilterOption[] = [
    { label: 'Oui', value: 'true' },
    { label: 'Non', value: 'false' },
  ];

  const invoiceNumberFilterOptions: FilterOption[] = useMemo(() => {
    return [...new Set(invoices.map(i => i.number || 'Brouillon'))].sort().map(v => ({ label: v, value: v }));
  }, [invoices]);

  const periodFilterOptions: FilterOption[] = useMemo(() => {
    return [...new Set(invoices.map(i => `${i.period_from} → ${i.period_to}`))].sort().map(v => ({ label: v, value: v }));
  }, [invoices]);

  const issueDateFilterOptions: FilterOption[] = useMemo(() => {
    const vals = [...new Set(invoices.map(i => i.issue_date).filter(Boolean))] as string[];
    const opts: FilterOption[] = vals.sort().map(v => ({
      label: new Date(v).toLocaleDateString('fr-FR'),
      value: v,
    }));
    if (invoices.some(i => !i.issue_date)) opts.push({ label: '(Vide)', value: '__empty__' });
    return opts;
  }, [invoices]);

  const htFilterOptions: FilterOption[] = useMemo(() => {
    return [...new Set(invoices.map(i => String(Number(i.total_ht_cents))))].sort((a, b) => Number(a) - Number(b)).map(v => ({
      label: formatCentsText(Number(v)),
      value: v,
    }));
  }, [invoices]);

  const ttcFilterOptions: FilterOption[] = useMemo(() => {
    return [...new Set(invoices.map(i => String(Number(i.total_ttc_cents))))].sort((a, b) => Number(a) - Number(b)).map(v => ({
      label: formatCentsText(Number(v)),
      value: v,
    }));
  }, [invoices]);

  const paymentDateFilterOptions: FilterOption[] = useMemo(() => {
    const vals = [...new Set(invoices.map(i => i.payment_date).filter(Boolean))] as string[];
    const opts: FilterOption[] = vals.sort().map(v => ({
      label: new Date(v).toLocaleDateString('fr-FR'),
      value: v,
    }));
    if (invoices.some(i => !i.payment_date)) opts.push({ label: '(Vide)', value: '__empty__' });
    return opts;
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const dateRef = inv.issue_date || inv.period_from;
      const matchesFrom = !filterDateFrom || dateRef >= filterDateFrom;
      const matchesTo = !filterDateTo || dateRef <= filterDateTo;
      const matchesMatter = passesFilter('matter', inv.matter_id);
      const clientId = matters.find((m) => m.id === inv.matter_id)?.client_id || '';
      const matchesClient = passesFilter('client', clientId);
      const matchesStatus = passesFilter('status', inv.status);
      const matchesPaid = passesFilter('paid', String(inv.paid));
      const matchesNumber = passesFilter('invoiceNumber', inv.number || 'Brouillon');
      const matchesPeriod = passesFilter('period', `${inv.period_from} → ${inv.period_to}`);
      const matchesIssueDate = passesFilter('issueDate', inv.issue_date || '__empty__');
      const matchesHt = passesFilter('ht', String(Number(inv.total_ht_cents)));
      const matchesTtc = passesFilter('ttc', String(Number(inv.total_ttc_cents)));
      const matchesPaymentDate = passesFilter('paymentDate', inv.payment_date || '__empty__');
      return matchesFrom && matchesTo && matchesMatter && matchesClient && matchesStatus && matchesPaid && matchesNumber && matchesPeriod && matchesIssueDate && matchesHt && matchesTtc && matchesPaymentDate;
    });
  }, [invoices, filterDateFrom, filterDateTo, filters, matters]);

  // Create form state
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [groupByCollaborator, setGroupByCollaborator] = useState(false);

  // Editable amount override (HT in cents, null = auto-calculated)
  const [customAmountHtCents, setCustomAmountHtCents] = useState<number | null>(null);

  // Timesheet entry selection/override state (for time-based matters)
  const [timesheetOverrides, setTimesheetOverrides] = useState<Record<string, TimesheetEntryOverride>>({});

  // Expense selection state
  const [selectedExpenses, setSelectedExpenses] = useState<
    Record<string, { selected: boolean; customAmount: number | null }>
  >({});

  // Fetch timesheet entries for preview
  const { data: allTimesheetEntries = [] } = useTimesheetEntries(undefined, periodFrom, periodTo);

  // Fetch expenses for selected matter
  const { data: matterExpenses = [] } = useExpensesByMatter(selectedMatterId);
  const lockExpensesMutation = useLockExpenses();

  const canEdit = role === "owner" || role === "assistant" || role === "sysadmin";

  // Preview billable entries for selected matter/period
  const previewEntries = useMemo(() => {
    if (!selectedMatterId) return [];
    return allTimesheetEntries.filter(
      (e) => e.matter_id === selectedMatterId && e.billable && !e.locked && e.date >= periodFrom && e.date <= periodTo,
    );
  }, [selectedMatterId, periodFrom, periodTo, allTimesheetEntries]);

  const previewTotalMinutes = previewEntries.reduce((sum, e) => sum + e.minutes_rounded, 0);

  // Reset overrides when preview entries change (all selected by default)
  useEffect(() => {
    const newOverrides: Record<string, TimesheetEntryOverride> = {};
    previewEntries.forEach((e) => {
      newOverrides[e.id] = { selected: true, minutesOverride: null, rateOverride: null };
    });
    setTimesheetOverrides(newOverrides);
  }, [previewEntries]);

  // Entries selected for invoicing (filtered by overrides)
  const selectedPreviewEntries = useMemo(() => {
    return previewEntries.filter((e) => {
      const override = timesheetOverrides[e.id];
      return override ? override.selected : true;
    });
  }, [previewEntries, timesheetOverrides]);
  // Calculate selected expenses total
  const selectedExpensesTotal = useMemo(() => {
    return matterExpenses.reduce((sum, exp) => {
      const selection = selectedExpenses[exp.id];
      if (!selection?.selected) return sum;
      const amount = selection.customAmount !== null ? selection.customAmount : exp.amount_ttc_cents;
      return sum + amount;
    }, 0);
  }, [matterExpenses, selectedExpenses]);

  // Handle expense selection
  const handleExpenseToggle = (expenseId: string, checked: boolean) => {
    setSelectedExpenses((prev) => ({
      ...prev,
      [expenseId]: { selected: checked, customAmount: prev[expenseId]?.customAmount ?? null },
    }));
  };

  const handleExpenseAmountChange = (expenseId: string, amount: string) => {
    const cents = amount ? Math.round(parseFloat(amount) * 100) : null;
    setSelectedExpenses((prev) => ({
      ...prev,
      [expenseId]: { selected: prev[expenseId]?.selected ?? false, customAmount: cents },
    }));
  };

  // Reset expense selection when matter changes
  const handleMatterChange = (matterId: string) => {
    setSelectedMatterId(matterId);
    setSelectedExpenses({});
    setTimesheetOverrides({});
  };

  const getMatterInfo = (matterId: string) => {
    const matter = matters.find((m) => m.id === matterId);
    return matter ? `${matter.code} - ${matter.label}` : "Inconnu";
  };

  const getClientInfo = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || "Inconnu";
  };

  const getClientIdFromMatter = (matterId: string) => {
    const matter = matters.find((m) => m.id === matterId);
    return matter?.client_id || "";
  };

  const getSelectedMatter = () => matters.find((m) => m.id === selectedMatterId);

  const statusColors: Record<string, string> = {
    draft: "bg-secondary text-secondary-foreground",
    issued: "bg-green-500/20 text-green-700",
    cancelled: "bg-destructive text-destructive-foreground",
  };

  const statusLabels: Record<string, string> = {
    draft: "Brouillon",
    issued: "Émise",
    cancelled: "Annulée",
  };

  const handleCreateDraft = async () => {
    if (!selectedMatterId) {
      toast.error("Veuillez sélectionner un dossier");
      return;
    }

    const matter = getSelectedMatter();
    if (!matter || !settings) return;

    const isFlatFee = matter.billing_type === "flat_fee";

    // For time-based billing, require selected entries
    if (!isFlatFee && selectedPreviewEntries.length === 0) {
      toast.error("Aucune entrée facturable sélectionnée");
      return;
    }

    // For flat fee, require flat_fee_cents to be set
    if (isFlatFee && !matter.flat_fee_cents) {
      toast.error("Le montant du forfait n'est pas défini pour ce dossier");
      return;
    }

    const rateCents = matter.rate_cents || settings.rate_cabinet_cents;
    const vatRate = matter.vat_rate;

    // Helper to get effective minutes/rate from overrides
    const getEntryMinutes = (entry: typeof previewEntries[0]) => {
      const override = timesheetOverrides[entry.id];
      return override?.minutesOverride !== null && override?.minutesOverride !== undefined
        ? override.minutesOverride
        : entry.minutes_rounded;
    };

    const getEntryRate = (entry: typeof previewEntries[0]) => {
      const override = timesheetOverrides[entry.id];
      if (override?.rateOverride !== null && override?.rateOverride !== undefined) return override.rateOverride;
      const profile = profiles.find((p) => p.id === entry.user_id);
      return profile?.rate_cents || rateCents;
    };

    let lines: InvoiceLine[];

    if (isFlatFee) {
      // Flat fee billing - single line with fixed amount
      const amountHt = matter.flat_fee_cents!;
      const vatCents = Math.round((amountHt * vatRate) / 100);
      lines = [
        {
          id: crypto.randomUUID(),
          label: `Forfait - ${matter.label}`,
          minutes: 0,
          rate_cents: 0,
          vat_rate: vatRate,
          amount_ht_cents: amountHt,
          vat_cents: vatCents,
          amount_ttc_cents: amountHt + vatCents,
        },
      ];
    } else if (groupByCollaborator) {
      // Group by collaborator (time-based) - using selected entries only
      const grouped = selectedPreviewEntries.reduce(
        (acc, entry) => {
          const userId = entry.user_id;
          if (!acc[userId]) {
            acc[userId] = { minutes: 0, entries: [], entryIds: [] };
          }
          acc[userId].minutes += getEntryMinutes(entry);
          acc[userId].entries.push(entry);
          acc[userId].entryIds.push(entry.id);
          return acc;
        },
        {} as Record<string, { minutes: number; entries: typeof previewEntries; entryIds: string[] }>,
      );

      lines = Object.entries(grouped).map(([userId, data]) => {
        const profile = profiles.find((p) => p.id === userId);
        // Use the rate from the first entry override or default
        const userRate = getEntryRate(data.entries[0]);
        const amountHt = Math.round((data.minutes / 60) * userRate);
        const vatCents = Math.round((amountHt * vatRate) / 100);
        return {
          id: crypto.randomUUID(),
          label: `Prestations - ${profile?.name || "Collaborateur"}`,
          minutes: data.minutes,
          rate_cents: userRate,
          vat_rate: vatRate,
          amount_ht_cents: amountHt,
          vat_cents: vatCents,
          amount_ttc_cents: amountHt + vatCents,
          timesheet_entry_ids: data.entryIds,
        };
      });
    } else {
      // Single line (time-based) - using selected entries only
      const totalMinutes = selectedPreviewEntries.reduce((sum, e) => sum + getEntryMinutes(e), 0);
      // Weighted average rate
      let totalWeightedRate = 0;
      selectedPreviewEntries.forEach((e) => {
        const mins = getEntryMinutes(e);
        const rate = getEntryRate(e);
        totalWeightedRate += rate * mins;
      });
      const avgRate = totalMinutes > 0 ? Math.round(totalWeightedRate / totalMinutes) : rateCents;
      const amountHt = Math.round((totalMinutes / 60) * avgRate);
      const vatCents = Math.round((amountHt * vatRate) / 100);
      lines = [
        {
          id: crypto.randomUUID(),
          label: `Prestations juridiques - ${matter.label}`,
          minutes: totalMinutes,
          rate_cents: avgRate,
          vat_rate: vatRate,
          amount_ht_cents: amountHt,
          vat_cents: vatCents,
          amount_ttc_cents: amountHt + vatCents,
          timesheet_entry_ids: selectedPreviewEntries.map((e) => e.id),
        },
      ];
    }

    // Add expense lines if any selected
    const expenseLinesToAdd: InvoiceLine[] = [];

    matterExpenses.forEach((exp) => {
      const selection = selectedExpenses[exp.id];
      if (selection?.selected) {
        const amountTTC = selection.customAmount !== null ? selection.customAmount : exp.amount_ttc_cents;
        // Convert TTC to HT (assuming expenses are TTC and we back-calculate HT)
        const amountHt = Math.round(amountTTC / (1 + vatRate / 100));
        const vatCents = amountTTC - amountHt;

        expenseLinesToAdd.push({
          id: crypto.randomUUID(),
          label: `Frais - ${exp.nature}`,
          minutes: 0,
          rate_cents: 0,
          vat_rate: vatRate,
          amount_ht_cents: amountHt,
          vat_cents: vatCents,
          amount_ttc_cents: amountTTC,
          expense_id: exp.id,
        });
      }
    });

    lines = [...lines, ...expenseLinesToAdd];

    const calculatedHt = lines.reduce((sum, l) => sum + l.amount_ht_cents, 0);
    const finalHt = customAmountHtCents !== null ? customAmountHtCents : calculatedHt;

    // If custom amount, adjust the first line proportionally
    if (customAmountHtCents !== null && calculatedHt > 0 && lines.length > 0) {
      const ratio = customAmountHtCents / calculatedHt;
      lines = lines.map(l => {
        const newHt = Math.round(l.amount_ht_cents * ratio);
        const newVat = Math.round((newHt * l.vat_rate) / 100);
        return { ...l, amount_ht_cents: newHt, vat_cents: newVat, amount_ttc_cents: newHt + newVat };
      });
    }

    const totalHt = lines.reduce((sum, l) => sum + l.amount_ht_cents, 0);
    const totalVat = lines.reduce((sum, l) => sum + l.vat_cents, 0);
    const totalTtc = lines.reduce((sum, l) => sum + l.amount_ttc_cents, 0);

    try {
      await createInvoiceMutation.mutateAsync({
        matter_id: selectedMatterId,
        status: "draft",
        period_from: periodFrom,
        period_to: periodTo,
        issue_date: null,
        number: null,
        lines,
        total_ht_cents: totalHt,
        total_vat_cents: totalVat,
        total_ttc_cents: totalTtc,
        paid: false,
        payment_date: null,
      });
      toast.success("Brouillon de facture créé");
      setIsCreateDialogOpen(false);
      setSelectedMatterId("");
      setSelectedExpenses({});
      setCustomAmountHtCents(null);
      setTimesheetOverrides({});
    } catch (error) {
      toast.error("Erreur lors de la création de la facture");
    }
  };

  const handleIssueInvoice = async (invoiceId: string) => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return;

    try {
      // Generate invoice number
      const invoiceNumber = await incrementInvoiceSeq.mutateAsync();

      // Update invoice to issued status
      await updateInvoiceMutation.mutateAsync({
        id: invoiceId,
        status: "issued",
        number: invoiceNumber,
        issue_date: new Date().toISOString().split("T")[0],
      });

      // Lock the associated timesheet entries (only those tracked in invoice lines)
      const trackedEntryIds = invoice.lines
        .flatMap((l) => l.timesheet_entry_ids || []);
      
      if (trackedEntryIds.length > 0) {
        await lockEntriesMutation.mutateAsync(trackedEntryIds);
      } else {
        // Fallback for older invoices without timesheet_entry_ids
        const entriesToLock = allTimesheetEntries.filter(
          (e) =>
            e.matter_id === invoice.matter_id &&
            e.billable &&
            !e.locked &&
            e.date >= invoice.period_from &&
            e.date <= invoice.period_to,
        );

        if (entriesToLock.length > 0) {
          await lockEntriesMutation.mutateAsync(entriesToLock.map((e) => e.id));
        }
      }

      // Lock the associated expenses (from invoice lines with expense_id)
      const expenseIdsToLock = invoice.lines.filter((l) => l.expense_id).map((l) => l.expense_id!);

      if (expenseIdsToLock.length > 0) {
        await lockExpensesMutation.mutateAsync(expenseIdsToLock);
      }

      toast.success(`Facture ${invoiceNumber} émise avec succès`);
      setIsIssueDialogOpen(false);
      setSelectedInvoice(null);
    } catch (error) {
      toast.error("Erreur lors de l'émission de la facture");
    }
  };

  const handleDeleteDraft = async (invoiceId: string) => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (invoice?.status !== "draft") {
      toast.error("Seuls les brouillons peuvent être supprimés");
      return;
    }
    try {
      await deleteInvoiceMutation.mutateAsync(invoiceId);
      toast.success("Brouillon supprimé");
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handlePrintPDF = async (invoiceId: string) => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice || !settings) return;

    const matter = matters.find((m) => m.id === invoice.matter_id);
    const client = clients.find((c) => c.id === matter?.client_id);
    if (!matter || !client) return;

    // Map to the format expected by printInvoicePDF (camelCase)
    const invoiceData = {
      id: invoice.id,
      number: invoice.number,
      year: new Date().getFullYear(),
      matterId: invoice.matter_id,
      clientId: matter.client_id,
      status: invoice.status,
      periodFrom: invoice.period_from,
      periodTo: invoice.period_to,
      issueDate: invoice.issue_date,
      lines: invoice.lines.map((l) => ({
        id: l.id,
        invoiceId: invoice.id,
        label: l.label,
        minutes: l.minutes,
        rateCents: l.rate_cents,
        vatRate: l.vat_rate as 0 | 20,
        amountHtCents: l.amount_ht_cents,
        vatCents: l.vat_cents,
        amountTtcCents: l.amount_ttc_cents,
      })),
      totalHtCents: invoice.total_ht_cents,
      totalVatCents: invoice.total_vat_cents,
      totalTtcCents: invoice.total_ttc_cents,
      createdAt: invoice.created_at,
    };

    const settingsData = {
      id: settings.id,
      name: settings.name,
      address: settings.address,
      iban: settings.iban,
      mentions: settings.mentions,
      rateCabinetCents: settings.rate_cabinet_cents,
      vatDefault: settings.vat_default as 0 | 20,
      invoiceSeqYear: settings.invoice_seq_year,
      invoiceSeqNext: settings.invoice_seq_next,
      creditSeqYear: settings.credit_seq_year,
      creditSeqNext: settings.credit_seq_next,
    };

    const clientData = {
      id: client.id,
      code: client.code,
      name: client.name,
      address: client.address,
      billingEmail: client.billing_email,
      vatNumber: client.vat_number,
      active: client.active,
      createdAt: client.created_at,
    };

    const matterData = {
      id: matter.id,
      code: matter.code,
      label: matter.label,
      clientId: matter.client_id,
      status: matter.status as "open" | "closed",
      rateCents: matter.rate_cents,
      vatRate: matter.vat_rate as 0 | 20,
      createdAt: matter.created_at,
    };

    await printInvoicePDF({ invoice: invoiceData, settings: settingsData, client: clientData, matter: matterData });
  };

  const handleExportWord = async (invoiceId: string) => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice || !settings) return;
    const matter = matters.find((m) => m.id === invoice.matter_id);
    const client = clients.find((c) => c.id === matter?.client_id);
    if (!matter || !client) return;

    await exportInvoiceWord({
      invoice,
      cabinetName: settings.name,
      cabinetAddress: settings.address,
      cabinetIban: settings.iban,
      cabinetMentions: settings.mentions,
      clientName: client.name,
      clientAddress: client.address,
      clientVatNumber: client.vat_number,
      matterCode: matter.code,
      matterLabel: matter.label,
    });
    toast.success("Export Word téléchargé");
  };

  const handleExportCSV = () => {
    const exportData = invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      year: new Date().getFullYear(),
      matterId: inv.matter_id,
      clientId: getClientIdFromMatter(inv.matter_id),
      status: inv.status,
      periodFrom: inv.period_from,
      periodTo: inv.period_to,
      issueDate: inv.issue_date,
      lines: inv.lines.map((l) => ({
        id: l.id,
        invoiceId: inv.id,
        label: l.label,
        minutes: l.minutes,
        rateCents: l.rate_cents,
        vatRate: l.vat_rate as 0 | 20,
        amountHtCents: l.amount_ht_cents,
        vatCents: l.vat_cents,
        amountTtcCents: l.amount_ttc_cents,
      })),
      totalHtCents: inv.total_ht_cents,
      totalVatCents: inv.total_vat_cents,
      totalTtcCents: inv.total_ttc_cents,
      createdAt: inv.created_at,
    }));

    const mappedMatters = matters.map((m) => ({
      id: m.id,
      code: m.code,
      label: m.label,
      clientId: m.client_id,
      status: m.status as "open" | "closed",
      rateCents: m.rate_cents,
      vatRate: m.vat_rate as 0 | 20,
      createdAt: m.created_at,
    }));

    const mappedClients = clients.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      address: c.address,
      billingEmail: c.billing_email,
      vatNumber: c.vat_number,
      active: c.active,
      createdAt: c.created_at,
    }));

    exportInvoicesCSV(exportData, mappedMatters, mappedClients);
    toast.success("Export CSV téléchargé");
  };

  const openPreview = (invoiceId: string) => {
    setSelectedInvoice(invoiceId);
    setIsPreviewDialogOpen(true);
  };

  const getPreviewInvoice = () => invoices.find((i) => i.id === selectedInvoice);

  if (isLoadingInvoices) {
    return <div className="flex items-center justify-center h-64">Chargement...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Factures</h1>
          <p className="text-muted-foreground">Facturation des prestations par dossier</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter
            dateFrom={filterDateFrom}
            dateTo={filterDateTo}
            onDateFromChange={setFilterDateFrom}
            onDateToChange={setFilterDateTo}
            onClear={() => {
              setFilterDateFrom("");
              setFilterDateTo("");
            }}
          />
          <Button variant="outline" onClick={() => handleExportCSV()} disabled={filteredInvoices.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle facture
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Brouillons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredInvoices.filter((i) => i.status === "draft").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Émises</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredInvoices.filter((i) => i.status === "issued").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CA Facturé HT</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Currency
                cents={filteredInvoices
                  .filter((i) => i.status === "issued")
                  .reduce((sum, i) => sum + i.total_ht_cents, 0)}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CA Encaissé HT</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Currency
                cents={filteredInvoices
                  .filter((i) => i.status === "issued" && i.paid)
                  .reduce((sum, i) => sum + i.total_ht_cents, 0)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <ColumnHeaderFilter
                    title="N° Facture"
                    options={invoiceNumberFilterOptions}
                    selectedValues={filters.invoiceNumber}
                    onFilterChange={(v) => setFilter('invoiceNumber', v)}
                  />
                </TableHead>
                <TableHead>
                  <ColumnHeaderFilter
                    title="Dossier"
                    options={matterFilterOptions}
                    selectedValues={filters.matter}
                    onFilterChange={(v) => setFilter('matter', v)}
                  />
                </TableHead>
                <TableHead>
                  <ColumnHeaderFilter
                    title="Client"
                    options={clientFilterOptions}
                    selectedValues={filters.client}
                    onFilterChange={(v) => setFilter('client', v)}
                  />
                </TableHead>
                <TableHead>
                  <ColumnHeaderFilter
                    title="Période"
                    options={periodFilterOptions}
                    selectedValues={filters.period}
                    onFilterChange={(v) => setFilter('period', v)}
                  />
                </TableHead>
                <TableHead>
                  <ColumnHeaderFilter
                    title="Date d'émission"
                    options={issueDateFilterOptions}
                    selectedValues={filters.issueDate}
                    onFilterChange={(v) => setFilter('issueDate', v)}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <ColumnHeaderFilter
                    title="HT"
                    options={htFilterOptions}
                    selectedValues={filters.ht}
                    onFilterChange={(v) => setFilter('ht', v)}
                    align="end"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <ColumnHeaderFilter
                    title="TTC"
                    options={ttcFilterOptions}
                    selectedValues={filters.ttc}
                    onFilterChange={(v) => setFilter('ttc', v)}
                    align="end"
                  />
                </TableHead>
                <TableHead className="text-center">
                  <ColumnHeaderFilter
                    title="Statut"
                    options={statusFilterOptions}
                    selectedValues={filters.status}
                    onFilterChange={(v) => setFilter('status', v)}
                    align="center"
                  />
                </TableHead>
                <TableHead className="text-center">
                  <ColumnHeaderFilter
                    title="Payée"
                    options={paidFilterOptions}
                    selectedValues={filters.paid}
                    onFilterChange={(v) => setFilter('paid', v)}
                    align="center"
                  />
                </TableHead>
                <TableHead>
                  <ColumnHeaderFilter
                    title="Date règlement"
                    options={paymentDateFilterOptions}
                    selectedValues={filters.paymentDate}
                    onFilterChange={(v) => setFilter('paymentDate', v)}
                  />
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Aucune facture</p>
                    <p className="text-sm mt-1">Créez une facture à partir des temps saisis sur un dossier.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Badge variant="outline">{invoice.number || "Brouillon"}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{getMatterInfo(invoice.matter_id)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {getClientInfo(getClientIdFromMatter(invoice.matter_id))}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {invoice.period_from} → {invoice.period_to}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {invoice.issue_date
                        ? new Date(invoice.issue_date).toLocaleDateString('fr-FR')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Currency cents={invoice.total_ht_cents} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <Currency cents={invoice.total_ttc_cents} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusColors[invoice.status]}>{statusLabels[invoice.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={invoice.paid}
                        disabled={!canEdit || invoice.status !== "issued"}
                        onCheckedChange={(checked) => {
                          updateInvoiceMutation.mutate({
                            id: invoice.id,
                            paid: checked === true,
                            payment_date: checked === true ? new Date().toISOString().split("T")[0] : null,
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {invoice.status === "issued" && canEdit ? (
                        <Input
                          type="date"
                          value={invoice.payment_date || ""}
                          className="w-36"
                          onChange={(e) => {
                            updateInvoiceMutation.mutate({
                              id: invoice.id,
                              payment_date: e.target.value || null,
                              paid: !!e.target.value,
                            });
                          }}
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">{invoice.payment_date || "-"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openPreview(invoice.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {invoice.status === "draft" && canEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedInvoice(invoice.id);
                                setIsIssueDialogOpen(true);
                              }}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => handleDeleteDraft(invoice.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {invoice.status === "issued" && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handlePrintPDF(invoice.id)} title="PDF">
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleExportWord(invoice.id)} title="Word">
                              <FileDown className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[950px]">
          <DialogHeader>
            <DialogTitle>Créer une facture</DialogTitle>
            <DialogDescription>
              Sélectionnez un dossier et une période pour facturer les temps enregistrés.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Dossier</Label>
              <Select value={selectedMatterId} onValueChange={handleMatterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un dossier" />
                </SelectTrigger>
                <SelectContent>
                  {matters
                    .filter((m) => m.status === "open")
                    .map((matter) => {
                      const client = clients.find((c) => c.id === matter.client_id);
                      return (
                        <SelectItem key={matter.id} value={matter.id}>
                          {matter.code} - {matter.label} ({client?.name})
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Période du</Label>
                <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Au</Label>
                <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Regrouper par collaborateur</Label>
              <Switch
                checked={groupByCollaborator}
                onCheckedChange={setGroupByCollaborator}
                disabled={getSelectedMatter()?.billing_type === "flat_fee"}
              />
            </div>

            {selectedMatterId && (
              <Card className="bg-muted">
                <CardContent className="p-4">
                  <div className="text-sm font-medium mb-2">Aperçu</div>
                  {getSelectedMatter()?.billing_type === "flat_fee" ? (
                    <>
                      <p className="text-muted-foreground text-sm">
                        <Badge variant="secondary" className="mr-2">
                          Forfait
                        </Badge>
                        Montant HT :{" "}
                        <span className="font-semibold">{formatCents(getSelectedMatter()?.flat_fee_cents || 0)}</span>
                      </p>
                      <p className="text-muted-foreground text-xs mt-2">
                        Ce dossier est facturé au forfait. Le montant défini lors de la création du dossier sera
                        utilisé.
                      </p>
                    </>
                  ) : (
                    <TimesheetEntrySelector
                      entries={previewEntries}
                      profiles={profiles}
                      defaultRateCents={getSelectedMatter()?.rate_cents || settings?.rate_cabinet_cents || 0}
                      vatRate={getSelectedMatter()?.vat_rate || 20}
                      overrides={timesheetOverrides}
                      onOverridesChange={setTimesheetOverrides}
                      canEditRatesAndMinutes={canEdit}
                    />
                  )}

                  {/* Editable amount override */}
                  <div className="mt-3 pt-3 border-t">
                    <Label className="text-xs text-muted-foreground">Montant HT personnalisé (optionnel)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Laisser vide = montant calculé"
                        value={customAmountHtCents !== null ? (customAmountHtCents / 100).toFixed(2) : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomAmountHtCents(val ? Math.round(parseFloat(val) * 100) : null);
                        }}
                        className="w-48 h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">MAD</span>
                    </div>
                  </div>

                  {/* Expenses Section */}
                  {matterExpenses.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Frais disponibles ({matterExpenses.length})</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {matterExpenses.map((exp) => {
                          const selection = selectedExpenses[exp.id];
                          const isSelected = selection?.selected ?? false;
                          const customAmount = selection?.customAmount;
                          return (
                            <div key={exp.id} className="flex items-center gap-2 p-2 rounded border bg-background">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleExpenseToggle(exp.id, checked === true)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{exp.nature}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(exp.expense_date).toLocaleDateString("fr-FR")} - Original:{" "}
                                  {formatCentsTTC(exp.amount_ttc_cents)}
                                </p>
                              </div>
                              {isSelected && (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="100%"
                                    value={customAmount !== null ? (customAmount / 100).toFixed(2) : ""}
                                    onChange={(e) => handleExpenseAmountChange(exp.id, e.target.value)}
                                    className="w-24 h-8 text-sm"
                                  />
                                  <span className="text-xs text-muted-foreground">MAD</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {selectedExpensesTotal > 0 && (
                        <p className="text-sm mt-2 text-right">
                          Total frais sélectionnés:{" "}
                          <span className="font-semibold">{formatCentsTTC(selectedExpensesTotal)}</span>
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateDraft}
              disabled={
                !selectedMatterId ||
                (getSelectedMatter()?.billing_type !== "flat_fee" && selectedPreviewEntries.length === 0) ||
                createInvoiceMutation.isPending
              }
            >
              {createInvoiceMutation.isPending ? "Création..." : "Créer le brouillon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Détail de la facture</DialogTitle>
          </DialogHeader>
          {getPreviewInvoice() && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">N° Facture:</span>{" "}
                  <span className="font-medium">{getPreviewInvoice()!.number || "Brouillon"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut:</span>{" "}
                  <Badge className={statusColors[getPreviewInvoice()!.status]}>
                    {statusLabels[getPreviewInvoice()!.status]}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Dossier:</span>{" "}
                  <span className="font-medium">{getMatterInfo(getPreviewInvoice()!.matter_id)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Client:</span>{" "}
                  <span className="font-medium">
                    {getClientInfo(getClientIdFromMatter(getPreviewInvoice()!.matter_id))}
                  </span>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Heures</TableHead>
                    <TableHead className="text-right">Taux</TableHead>
                    <TableHead className="text-right">TVA</TableHead>
                    <TableHead className="text-right">TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getPreviewInvoice()!.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.label}</TableCell>
                      <TableCell className="text-right">{formatMinutesToHours(line.minutes)}</TableCell>
                      <TableCell className="text-right">{formatCents(line.rate_cents)}</TableCell>
                      <TableCell className="text-right">{line.vat_rate}%</TableCell>
                      <TableCell className="text-right font-medium">{formatCents(line.amount_ttc_cents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end">
                <div className="space-y-1 text-right">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total HT:</span>{" "}
                    {formatCents(getPreviewInvoice()!.total_ht_cents)}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">TVA:</span>{" "}
                    {formatCents(getPreviewInvoice()!.total_vat_cents)}
                  </div>
                  <div className="text-lg font-bold">
                    <span className="text-muted-foreground">TTC:</span>{" "}
                    {formatCents(getPreviewInvoice()!.total_ttc_cents)}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Fermer
            </Button>
            {getPreviewInvoice()?.status === "issued" && (
              <Button onClick={() => handlePrintPDF(selectedInvoice!)}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimer PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Confirmation Dialog */}
      <AlertDialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Émettre la facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va attribuer un numéro définitif à la facture et verrouiller les entrées de temps associées.
              Cette opération est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedInvoice && handleIssueInvoice(selectedInvoice)}>
              Émettre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
