import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useCreditNotes, useCreateCreditNote } from '@/hooks/useCreditNotes';
import { useInvoices, useUpdateInvoice } from '@/hooks/useInvoices';
import { useMatters } from '@/hooks/useMatters';
import { useClients } from '@/hooks/useClients';
import { useCabinetSettings, useIncrementCreditSeq } from '@/hooks/useCabinetSettings';
import { useCreateAuditLog } from '@/hooks/useAuditLog';
import { printCreditNotePDF } from '@/lib/pdf';
import { exportCreditNotesCSV } from '@/lib/exports';
import { FileMinus2, Plus, Download, Printer, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Format cents to MAD
function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' MAD';
}

export default function CreditNotes() {
  const { role, user } = useAuth();
  const { data: creditNotes = [], isLoading: creditNotesLoading } = useCreditNotes();
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices();
  const { data: matters = [], isLoading: mattersLoading } = useMatters();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: settings, isLoading: settingsLoading } = useCabinetSettings();

  const createCreditNote = useCreateCreditNote();
  const updateInvoice = useUpdateInvoice();
  const incrementCreditSeq = useIncrementCreditSeq();
  const createAuditLog = useCreateAuditLog();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [reason, setReason] = useState('');
  const [isPartial, setIsPartial] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const canEdit = role === 'owner' || role === 'assistant' || role === 'sysadmin';
  const isLoading = creditNotesLoading || invoicesLoading || mattersLoading || clientsLoading || settingsLoading;

  // Only issued invoices can have credit notes
  const eligibleInvoices = invoices.filter(i => i.status === 'issued');

  const getInvoiceNumber = (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    return invoice?.number || 'N/A';
  };

  const getSelectedInvoice = () => invoices.find(i => i.id === selectedInvoiceId);

  const handleCreateCreditNote = async () => {
    if (isCreating) return;

    if (!selectedInvoiceId) {
      toast.error('Veuillez sélectionner une facture');
      return;
    }

    if (!reason.trim()) {
      toast.error('Veuillez indiquer un motif');
      return;
    }

    const partialAmountCents = isPartial && partialAmount 
      ? Math.round(parseFloat(partialAmount) * 100) 
      : undefined;

    if (isPartial && (!partialAmountCents || partialAmountCents <= 0)) {
      toast.error('Montant partiel invalide');
      return;
    }

    const selectedInvoice = getSelectedInvoice();
    if (isPartial && partialAmountCents && selectedInvoice && partialAmountCents > selectedInvoice.total_ttc_cents) {
      toast.error('Le montant ne peut pas dépasser le total de la facture');
      return;
    }

    if (!selectedInvoice) {
      toast.error('Facture non trouvée');
      return;
    }

    setIsCreating(true);

    try {
      // Get credit note number
      const creditNoteNumber = await incrementCreditSeq.mutateAsync();

      // Calculate credit note amounts
      let totalHtCents: number;
      let totalVatCents: number;
      let totalTtcCents: number;

      if (partialAmountCents !== undefined) {
        // Partial: proportional calculation
        const ratio = partialAmountCents / selectedInvoice.total_ttc_cents;
        totalHtCents = Math.round(selectedInvoice.total_ht_cents * ratio);
        totalVatCents = Math.round(selectedInvoice.total_vat_cents * ratio);
        totalTtcCents = partialAmountCents;
      } else {
        // Total credit note
        totalHtCents = selectedInvoice.total_ht_cents;
        totalVatCents = selectedInvoice.total_vat_cents;
        totalTtcCents = selectedInvoice.total_ttc_cents;

        // Mark invoice as cancelled
        await updateInvoice.mutateAsync({
          id: selectedInvoice.id,
          status: 'cancelled',
        });
      }

      // Create credit note
      await createCreditNote.mutateAsync({
        number: creditNoteNumber,
        invoice_id: selectedInvoiceId,
        issue_date: new Date().toISOString().split('T')[0],
        reason: reason.trim(),
        total_ht_cents: totalHtCents,
        total_vat_cents: totalVatCents,
        total_ttc_cents: totalTtcCents,
      });

      // Audit log
      createAuditLog.mutate({
        action: 'create_credit_note',
        entity_type: 'credit_note',
        entity_id: creditNoteNumber,
        details: { invoiceId: selectedInvoiceId, reason: reason.trim() },
      });

      toast.success(`Avoir ${creditNoteNumber} créé avec succès`);
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Erreur lors de la création de l\'avoir');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setSelectedInvoiceId('');
    setReason('');
    setIsPartial(false);
    setPartialAmount('');
  };

  const handlePrintPDF = async (creditNoteId: string) => {
    const creditNote = creditNotes.find(cn => cn.id === creditNoteId);
    if (!creditNote || !settings) return;

    const invoice = invoices.find(i => i.id === creditNote.invoice_id);
    if (!invoice) return;

    const matter = matters.find(m => m.id === invoice.matter_id);
    const client = matter ? clients.find(c => c.id === matter.client_id) : null;
    if (!matter || !client) return;

    // Map to expected format
    const mappedLines = invoice.lines.map(l => ({
      id: l.id,
      invoiceId: invoice.id,
      label: l.label,
      minutes: l.minutes,
      rateCents: l.rate_cents,
      vatRate: (l.vat_rate as 0 | 20),
      amountHtCents: l.amount_ht_cents,
      vatCents: l.vat_cents,
      amountTtcCents: l.amount_ttc_cents,
    }));

    await printCreditNotePDF({
      creditNote: {
        id: creditNote.id,
        number: creditNote.number,
        year: new Date(creditNote.issue_date).getFullYear(),
        invoiceId: creditNote.invoice_id,
        issueDate: creditNote.issue_date,
        status: 'issued',
        totalHtCents: creditNote.total_ht_cents,
        totalVatCents: creditNote.total_vat_cents,
        totalTtcCents: creditNote.total_ttc_cents,
        reason: creditNote.reason,
        createdAt: creditNote.created_at,
      },
      invoice: {
        id: invoice.id,
        number: invoice.number,
        year: new Date(invoice.period_from).getFullYear(),
        matterId: invoice.matter_id,
        clientId: matter.client_id,
        periodFrom: invoice.period_from,
        periodTo: invoice.period_to,
        status: invoice.status,
        issueDate: invoice.issue_date,
        totalHtCents: invoice.total_ht_cents,
        totalVatCents: invoice.total_vat_cents,
        totalTtcCents: invoice.total_ttc_cents,
        lines: mappedLines,
        createdAt: invoice.created_at,
      },
      settings: {
        id: settings.id,
        name: settings.name,
        address: settings.address,
        iban: settings.iban,
        mentions: settings.mentions,
        rateCabinetCents: settings.rate_cabinet_cents,
        vatDefault: (settings.vat_default as 0 | 20),
        invoiceSeqYear: settings.invoice_seq_year,
        invoiceSeqNext: settings.invoice_seq_next,
        creditSeqYear: settings.credit_seq_year,
        creditSeqNext: settings.credit_seq_next,
      },
      client: {
        id: client.id,
        code: client.code,
        name: client.name,
        address: client.address,
        billingEmail: client.billing_email,
        vatNumber: client.vat_number,
        active: client.active,
        createdAt: client.created_at,
      },
      matter: {
        id: matter.id,
        code: matter.code,
        label: matter.label,
        clientId: matter.client_id,
        status: matter.status as 'open' | 'closed',
        rateCents: matter.rate_cents,
        vatRate: (matter.vat_rate as 0 | 20),
        createdAt: matter.created_at,
      },
    });
  };

  const handleExportCSV = () => {
    // Map credit notes to expected format
    const mappedCreditNotes = creditNotes.map(cn => ({
      id: cn.id,
      number: cn.number,
      year: new Date(cn.issue_date).getFullYear(),
      invoiceId: cn.invoice_id,
      issueDate: cn.issue_date,
      status: 'issued' as const,
      totalHtCents: cn.total_ht_cents,
      totalVatCents: cn.total_vat_cents,
      totalTtcCents: cn.total_ttc_cents,
      reason: cn.reason,
      createdAt: cn.created_at,
    }));

    // Map invoices for export
    const mappedInvoices = invoices.map(i => {
      const mappedLines = i.lines.map(l => ({
        id: l.id,
        invoiceId: i.id,
        label: l.label,
        minutes: l.minutes,
        rateCents: l.rate_cents,
        vatRate: (l.vat_rate as 0 | 20),
        amountHtCents: l.amount_ht_cents,
        vatCents: l.vat_cents,
        amountTtcCents: l.amount_ttc_cents,
      }));
      
      return {
        id: i.id,
        number: i.number,
        year: new Date(i.period_from).getFullYear(),
        matterId: i.matter_id,
        clientId: '',
        periodFrom: i.period_from,
        periodTo: i.period_to,
        status: i.status,
        issueDate: i.issue_date,
        totalHtCents: i.total_ht_cents,
        totalVatCents: i.total_vat_cents,
        totalTtcCents: i.total_ttc_cents,
        lines: mappedLines,
        createdAt: i.created_at,
      };
    });

    exportCreditNotesCSV(mappedCreditNotes, mappedInvoices);
    toast.success('Export CSV téléchargé');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Avoirs</h1>
          <p className="text-muted-foreground">Gestion des avoirs sur factures émises</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          {canEdit && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel avoir
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Nombre d'avoirs</div>
            <div className="text-2xl font-bold">{creditNotes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total crédité</div>
            <div className="text-2xl font-bold text-destructive">
              -{formatCents(creditNotes.reduce((sum, cn) => sum + cn.total_ttc_cents, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Notes Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Avoir</TableHead>
                <TableHead>Facture liée</TableHead>
                <TableHead>Date d'émission</TableHead>
                <TableHead className="text-right">HT</TableHead>
                <TableHead className="text-right">TVA</TableHead>
                <TableHead className="text-right">TTC</TableHead>
                <TableHead>Raison</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <FileMinus2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Aucun avoir</p>
                    <p className="text-sm mt-1">
                      Les avoirs permettent d'annuler partiellement ou totalement une facture émise.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                creditNotes.map((cn) => (
                  <TableRow key={cn.id}>
                    <TableCell>
                      <Badge variant="outline">{cn.number}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {getInvoiceNumber(cn.invoice_id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(cn.issue_date).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      -{formatCents(cn.total_ht_cents)}
                    </TableCell>
                    <TableCell className="text-right">
                      -{formatCents(cn.total_vat_cents)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      -{formatCents(cn.total_ttc_cents)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {cn.reason || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handlePrintPDF(cn.id)}>
                        <Printer className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Credit Note Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Créer un avoir</DialogTitle>
            <DialogDescription>
              Créez un avoir partiel ou total sur une facture émise.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Facture</Label>
              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une facture" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleInvoices.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Aucune facture émise
                    </SelectItem>
                  ) : (
                    eligibleInvoices.map((invoice) => {
                      const matter = matters.find(m => m.id === invoice.matter_id);
                      return (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.number} - {matter?.code} ({formatCents(invoice.total_ttc_cents)})
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedInvoiceId && getSelectedInvoice() && (
              <Card className="bg-muted">
                <CardContent className="p-4 text-sm">
                  <div className="font-medium mb-1">Facture sélectionnée</div>
                  <div className="text-muted-foreground">
                    Total TTC: {formatCents(getSelectedInvoice()!.total_ttc_cents)}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <Label>Avoir partiel</Label>
              <Switch checked={isPartial} onCheckedChange={setIsPartial} />
            </div>

            {isPartial && (
              <div className="grid gap-2">
                <Label>Montant TTC de l'avoir (MAD)</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Ex: 500.00"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label>Motif de l'avoir *</Label>
              <Textarea
                placeholder="Indiquez la raison de cet avoir..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              resetForm();
            }}>
              Annuler
            </Button>
            <Button onClick={handleCreateCreditNote} disabled={isCreating}>
              {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer l'avoir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
