import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMatters } from '@/hooks/useMatters';
import { useClients } from '@/hooks/useClients';
import { useInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, type Invoice, type InvoiceLine } from '@/hooks/useInvoices';
import { useCabinetSettings, useIncrementInvoiceSeq } from '@/hooks/useCabinetSettings';
import { useTimesheetEntries, useLockTimesheetEntries, formatMinutesToHours } from '@/hooks/useTimesheet';
import { useProfiles } from '@/hooks/useProfiles';
import { printInvoicePDF } from '@/lib/pdf';
import { exportInvoicesCSV } from '@/lib/exports';
import { FileText, Plus, Download, Eye, Send, Trash2, Printer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Format cents to currency
function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' MAD';
}

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

  // Create form state
  const [selectedMatterId, setSelectedMatterId] = useState('');
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [groupByCollaborator, setGroupByCollaborator] = useState(false);

  // Fetch timesheet entries for preview
  const { data: allTimesheetEntries = [] } = useTimesheetEntries(undefined, periodFrom, periodTo);

  const canEdit = role === 'owner' || role === 'assistant' || role === 'sysadmin';

  // Preview billable entries for selected matter/period
  const previewEntries = useMemo(() => {
    if (!selectedMatterId) return [];
    return allTimesheetEntries.filter(e => 
      e.matter_id === selectedMatterId &&
      e.billable &&
      !e.locked &&
      e.date >= periodFrom &&
      e.date <= periodTo
    );
  }, [selectedMatterId, periodFrom, periodTo, allTimesheetEntries]);

  const previewTotalMinutes = previewEntries.reduce((sum, e) => sum + e.minutes_rounded, 0);

  const getMatterInfo = (matterId: string) => {
    const matter = matters.find(m => m.id === matterId);
    return matter ? `${matter.code} - ${matter.label}` : 'Inconnu';
  };

  const getClientInfo = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Inconnu';
  };

  const getClientIdFromMatter = (matterId: string) => {
    const matter = matters.find(m => m.id === matterId);
    return matter?.client_id || '';
  };

  const getSelectedMatter = () => matters.find(m => m.id === selectedMatterId);

  const statusColors: Record<string, string> = {
    draft: 'bg-secondary text-secondary-foreground',
    issued: 'bg-green-500/20 text-green-700',
    cancelled: 'bg-destructive text-destructive-foreground',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Brouillon',
    issued: 'Émise',
    cancelled: 'Annulée',
  };

  const handleCreateDraft = async () => {
    if (!selectedMatterId) {
      toast.error('Veuillez sélectionner un dossier');
      return;
    }

    const matter = getSelectedMatter();
    if (!matter || !settings) return;

    const isFlatFee = matter.billing_type === 'flat_fee';

    // For time-based billing, require entries
    if (!isFlatFee && previewEntries.length === 0) {
      toast.error('Aucune entrée facturable pour cette période');
      return;
    }

    // For flat fee, require flat_fee_cents to be set
    if (isFlatFee && !matter.flat_fee_cents) {
      toast.error('Le montant du forfait n\'est pas défini pour ce dossier');
      return;
    }

    const rateCents = matter.rate_cents || settings.rate_cabinet_cents;
    const vatRate = matter.vat_rate;

    let lines: InvoiceLine[];

    if (isFlatFee) {
      // Flat fee billing - single line with fixed amount
      const amountHt = matter.flat_fee_cents!;
      const vatCents = Math.round(amountHt * vatRate / 100);
      lines = [{
        id: crypto.randomUUID(),
        label: `Forfait - ${matter.label}`,
        minutes: 0,
        rate_cents: 0,
        vat_rate: vatRate,
        amount_ht_cents: amountHt,
        vat_cents: vatCents,
        amount_ttc_cents: amountHt + vatCents,
      }];
    } else if (groupByCollaborator) {
      // Group by collaborator (time-based)
      const grouped = previewEntries.reduce((acc, entry) => {
        const userId = entry.user_id;
        if (!acc[userId]) {
          acc[userId] = { minutes: 0, entries: [] };
        }
        acc[userId].minutes += entry.minutes_rounded;
        acc[userId].entries.push(entry);
        return acc;
      }, {} as Record<string, { minutes: number; entries: typeof previewEntries }>);

      lines = Object.entries(grouped).map(([userId, data]) => {
        const profile = profiles.find(p => p.id === userId);
        const userRate = profile?.rate_cents || rateCents;
        const amountHt = Math.round((data.minutes / 60) * userRate);
        const vatCents = Math.round(amountHt * vatRate / 100);
        return {
          id: crypto.randomUUID(),
          label: `Prestations - ${profile?.name || 'Collaborateur'}`,
          minutes: data.minutes,
          rate_cents: userRate,
          vat_rate: vatRate,
          amount_ht_cents: amountHt,
          vat_cents: vatCents,
          amount_ttc_cents: amountHt + vatCents,
        };
      });
    } else {
      // Single line (time-based)
      const totalMinutes = previewEntries.reduce((sum, e) => sum + e.minutes_rounded, 0);
      const amountHt = Math.round((totalMinutes / 60) * rateCents);
      const vatCents = Math.round(amountHt * vatRate / 100);
      lines = [{
        id: crypto.randomUUID(),
        label: `Prestations juridiques - ${matter.label}`,
        minutes: totalMinutes,
        rate_cents: rateCents,
        vat_rate: vatRate,
        amount_ht_cents: amountHt,
        vat_cents: vatCents,
        amount_ttc_cents: amountHt + vatCents,
      }];
    }

    const totalHt = lines.reduce((sum, l) => sum + l.amount_ht_cents, 0);
    const totalVat = lines.reduce((sum, l) => sum + l.vat_cents, 0);
    const totalTtc = lines.reduce((sum, l) => sum + l.amount_ttc_cents, 0);

    try {
      await createInvoiceMutation.mutateAsync({
        matter_id: selectedMatterId,
        status: 'draft',
        period_from: periodFrom,
        period_to: periodTo,
        issue_date: null,
        number: null,
        lines,
        total_ht_cents: totalHt,
        total_vat_cents: totalVat,
        total_ttc_cents: totalTtc,
      });
      toast.success('Brouillon de facture créé');
      setIsCreateDialogOpen(false);
      setSelectedMatterId('');
    } catch (error) {
      toast.error('Erreur lors de la création de la facture');
    }
  };

  const handleIssueInvoice = async (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return;

    try {
      // Generate invoice number
      const invoiceNumber = await incrementInvoiceSeq.mutateAsync();

      // Update invoice to issued status
      await updateInvoiceMutation.mutateAsync({
        id: invoiceId,
        status: 'issued',
        number: invoiceNumber,
        issue_date: new Date().toISOString().split('T')[0],
      });

      // Lock the associated timesheet entries
      const entriesToLock = allTimesheetEntries.filter(e =>
        e.matter_id === invoice.matter_id &&
        e.billable &&
        !e.locked &&
        e.date >= invoice.period_from &&
        e.date <= invoice.period_to
      );

      if (entriesToLock.length > 0) {
        await lockEntriesMutation.mutateAsync(entriesToLock.map(e => e.id));
      }

      toast.success(`Facture ${invoiceNumber} émise avec succès`);
      setIsIssueDialogOpen(false);
      setSelectedInvoice(null);
    } catch (error) {
      toast.error('Erreur lors de l\'émission de la facture');
    }
  };

  const handleDeleteDraft = async (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (invoice?.status !== 'draft') {
      toast.error('Seuls les brouillons peuvent être supprimés');
      return;
    }
    try {
      await deleteInvoiceMutation.mutateAsync(invoiceId);
      toast.success('Brouillon supprimé');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handlePrintPDF = (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice || !settings) return;

    const matter = matters.find(m => m.id === invoice.matter_id);
    const client = clients.find(c => c.id === matter?.client_id);
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
      lines: invoice.lines.map(l => ({
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
      status: matter.status as 'open' | 'closed',
      rateCents: matter.rate_cents,
      vatRate: matter.vat_rate as 0 | 20,
      createdAt: matter.created_at,
    };

    printInvoicePDF({ invoice: invoiceData, settings: settingsData, client: clientData, matter: matterData });
  };

  const handleExportCSV = () => {
    const exportData = invoices.map(inv => ({
      id: inv.id,
      number: inv.number,
      year: new Date().getFullYear(),
      matterId: inv.matter_id,
      clientId: getClientIdFromMatter(inv.matter_id),
      status: inv.status,
      periodFrom: inv.period_from,
      periodTo: inv.period_to,
      issueDate: inv.issue_date,
      lines: inv.lines.map(l => ({
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
    
    const mappedMatters = matters.map(m => ({
      id: m.id,
      code: m.code,
      label: m.label,
      clientId: m.client_id,
      status: m.status as 'open' | 'closed',
      rateCents: m.rate_cents,
      vatRate: m.vat_rate as 0 | 20,
      createdAt: m.created_at,
    }));
    
    const mappedClients = clients.map(c => ({
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
    toast.success('Export CSV téléchargé');
  };

  const openPreview = (invoiceId: string) => {
    setSelectedInvoice(invoiceId);
    setIsPreviewDialogOpen(true);
  };

  const getPreviewInvoice = () => invoices.find(i => i.id === selectedInvoice);

  if (isLoadingInvoices) {
    return <div className="flex items-center justify-center h-64">Chargement...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Factures</h1>
          <p className="text-muted-foreground">Facturation des prestations par dossier</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          {canEdit && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle facture
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Brouillons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {invoices.filter(i => i.status === 'draft').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Émises</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {invoices.filter(i => i.status === 'issued').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CA Facturé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCents(invoices.filter(i => i.status === 'issued').reduce((sum, i) => sum + i.total_ttc_cents, 0))}
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
                <TableHead>N° Facture</TableHead>
                <TableHead>Dossier</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Période</TableHead>
                <TableHead className="text-right">HT</TableHead>
                <TableHead className="text-right">TTC</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Aucune facture</p>
                    <p className="text-sm mt-1">
                      Créez une facture à partir des temps saisis sur un dossier.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {invoice.number || 'Brouillon'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {getMatterInfo(invoice.matter_id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getClientInfo(getClientIdFromMatter(invoice.matter_id))}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {invoice.period_from} → {invoice.period_to}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCents(invoice.total_ht_cents)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCents(invoice.total_ttc_cents)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusColors[invoice.status]}>
                        {statusLabels[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openPreview(invoice.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {invoice.status === 'draft' && canEdit && (
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
                        {invoice.status === 'issued' && (
                          <Button variant="ghost" size="icon" onClick={() => handlePrintPDF(invoice.id)}>
                            <Printer className="w-4 h-4" />
                          </Button>
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Créer une facture</DialogTitle>
            <DialogDescription>
              Sélectionnez un dossier et une période pour facturer les temps enregistrés.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Dossier</Label>
              <Select value={selectedMatterId} onValueChange={setSelectedMatterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un dossier" />
                </SelectTrigger>
                <SelectContent>
                  {matters.filter(m => m.status === 'open').map((matter) => {
                    const client = clients.find(c => c.id === matter.client_id);
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
                <Input
                  type="date"
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Au</Label>
                <Input
                  type="date"
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Regrouper par collaborateur</Label>
              <Switch
                checked={groupByCollaborator}
                onCheckedChange={setGroupByCollaborator}
                disabled={getSelectedMatter()?.billing_type === 'flat_fee'}
              />
            </div>

            {selectedMatterId && (
              <Card className="bg-muted">
                <CardContent className="p-4">
                  <div className="text-sm font-medium mb-2">Aperçu</div>
                  {getSelectedMatter()?.billing_type === 'flat_fee' ? (
                    <>
                      <p className="text-muted-foreground text-sm">
                        <Badge variant="secondary" className="mr-2">Forfait</Badge>
                        Montant HT : <span className="font-semibold">{formatCents(getSelectedMatter()?.flat_fee_cents || 0)}</span>
                      </p>
                      <p className="text-muted-foreground text-xs mt-2">
                        Ce dossier est facturé au forfait. Le montant défini lors de la création du dossier sera utilisé.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground text-sm">
                        {previewEntries.length} entrée(s) facturable(s) pour un total de{' '}
                        <span className="font-semibold">{formatMinutesToHours(previewTotalMinutes)}</span>
                      </p>
                      {previewEntries.length === 0 && (
                        <p className="text-destructive text-sm mt-2">
                          Aucune entrée facturable non facturée pour cette période.
                        </p>
                      )}
                    </>
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
                (getSelectedMatter()?.billing_type !== 'flat_fee' && previewEntries.length === 0) ||
                createInvoiceMutation.isPending
              }
            >
              {createInvoiceMutation.isPending ? 'Création...' : 'Créer le brouillon'}
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
                  <span className="text-muted-foreground">N° Facture:</span>{' '}
                  <span className="font-medium">{getPreviewInvoice()!.number || 'Brouillon'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut:</span>{' '}
                  <Badge className={statusColors[getPreviewInvoice()!.status]}>
                    {statusLabels[getPreviewInvoice()!.status]}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Dossier:</span>{' '}
                  <span className="font-medium">{getMatterInfo(getPreviewInvoice()!.matter_id)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Client:</span>{' '}
                  <span className="font-medium">{getClientInfo(getClientIdFromMatter(getPreviewInvoice()!.matter_id))}</span>
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
                    <span className="text-muted-foreground">Total HT:</span>{' '}
                    {formatCents(getPreviewInvoice()!.total_ht_cents)}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">TVA:</span>{' '}
                    {formatCents(getPreviewInvoice()!.total_vat_cents)}
                  </div>
                  <div className="text-lg font-bold">
                    <span className="text-muted-foreground">TTC:</span>{' '}
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
            {getPreviewInvoice()?.status === 'issued' && (
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
