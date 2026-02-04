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
import { getCreditNotes, getInvoices, getMatters, getClients, formatCents, getCabinetSettings } from '@/lib/storage';
import { createCreditNote } from '@/lib/invoicing';
import { printCreditNotePDF } from '@/lib/pdf';
import { exportCreditNotesCSV } from '@/lib/exports';
import { FileMinus2, Plus, Download, Printer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function CreditNotes() {
  const { user } = useAuth();
  const [creditNotes, setCreditNotes] = useState(getCreditNotes);
  const invoices = getInvoices();
  const matters = getMatters();
  const clients = getClients();
  const settings = getCabinetSettings();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [reason, setReason] = useState('');
  const [isPartial, setIsPartial] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');

  const canEdit = user?.role === 'owner' || user?.role === 'assistant';

  const refreshCreditNotes = () => setCreditNotes(getCreditNotes());

  // Only issued invoices can have credit notes
  const eligibleInvoices = invoices.filter(i => i.status === 'issued');

  const getInvoiceNumber = (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    return invoice?.number || 'N/A';
  };

  const getSelectedInvoice = () => invoices.find(i => i.id === selectedInvoiceId);

  const handleCreateCreditNote = () => {
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
    if (isPartial && partialAmountCents && selectedInvoice && partialAmountCents > selectedInvoice.totalTtcCents) {
      toast.error('Le montant ne peut pas dépasser le total de la facture');
      return;
    }

    const result = createCreditNote(selectedInvoiceId, reason.trim(), partialAmountCents);
    if (result) {
      toast.success(`Avoir ${result.number} créé avec succès`);
      setIsCreateDialogOpen(false);
      resetForm();
      refreshCreditNotes();
    } else {
      toast.error('Erreur lors de la création de l\'avoir');
    }
  };

  const resetForm = () => {
    setSelectedInvoiceId('');
    setReason('');
    setIsPartial(false);
    setPartialAmount('');
  };

  const handlePrintPDF = (creditNoteId: string) => {
    const creditNote = creditNotes.find(cn => cn.id === creditNoteId);
    if (!creditNote) return;

    const invoice = invoices.find(i => i.id === creditNote.invoiceId);
    if (!invoice) return;

    const matter = matters.find(m => m.id === invoice.matterId);
    const client = clients.find(c => c.id === invoice.clientId);
    if (!matter || !client) return;

    printCreditNotePDF({ creditNote, invoice, settings, client, matter });
  };

  const handleExportCSV = () => {
    exportCreditNotesCSV(creditNotes);
    toast.success('Export CSV téléchargé');
  };

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
              -{formatCents(creditNotes.reduce((sum, cn) => sum + cn.totalTtcCents, 0))}
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
                      {getInvoiceNumber(cn.invoiceId)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(cn.issueDate).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      -{formatCents(cn.totalHtCents)}
                    </TableCell>
                    <TableCell className="text-right">
                      -{formatCents(cn.totalVatCents)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      -{formatCents(cn.totalTtcCents)}
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
                      const matter = matters.find(m => m.id === invoice.matterId);
                      return (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.number} - {matter?.code} ({formatCents(invoice.totalTtcCents)})
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
                    Total TTC: {formatCents(getSelectedInvoice()!.totalTtcCents)}
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
            <Button onClick={handleCreateCreditNote}>
              Créer l'avoir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
