import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { getInvoices, getMatters, getClients, formatCents, deleteInvoice, getCabinetSettings, formatMinutesToHours } from '@/lib/storage';
import { getBillableEntries, createDraftInvoice, issueInvoice, type GroupingMode } from '@/lib/invoicing';
import { printInvoicePDF } from '@/lib/pdf';
import { exportInvoicesCSV } from '@/lib/exports';
import { FileText, Plus, Download, Eye, Send, Trash2, Printer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState(getInvoices);
  const matters = getMatters();
  const clients = getClients();
  const settings = getCabinetSettings();

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

  const canEdit = user?.role === 'owner' || user?.role === 'assistant';

  const refreshInvoices = () => setInvoices(getInvoices());

  // Preview billable entries for selected matter/period
  const previewEntries = useMemo(() => {
    if (!selectedMatterId) return [];
    return getBillableEntries(selectedMatterId, periodFrom, periodTo);
  }, [selectedMatterId, periodFrom, periodTo]);

  const previewTotalMinutes = previewEntries.reduce((sum, e) => sum + e.minutesRounded, 0);

  const getMatterInfo = (matterId: string) => {
    const matter = matters.find(m => m.id === matterId);
    return matter ? `${matter.code} - ${matter.label}` : 'Inconnu';
  };

  const getClientInfo = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Inconnu';
  };

  const getSelectedMatter = () => matters.find(m => m.id === selectedMatterId);

  const statusColors: Record<string, string> = {
    draft: 'bg-secondary text-secondary-foreground',
    issued: 'bg-success text-success-foreground',
    cancelled: 'bg-destructive text-destructive-foreground',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Brouillon',
    issued: 'Émise',
    cancelled: 'Annulée',
  };

  const handleCreateDraft = () => {
    if (!selectedMatterId) {
      toast.error('Veuillez sélectionner un dossier');
      return;
    }

    if (previewEntries.length === 0) {
      toast.error('Aucune entrée facturable pour cette période');
      return;
    }

    const matter = getSelectedMatter();
    if (!matter) return;

    const groupingMode: GroupingMode = groupByCollaborator ? 'by_collaborator' : 'single';
    createDraftInvoice(selectedMatterId, matter.clientId, periodFrom, periodTo, groupingMode);
    
    toast.success('Brouillon de facture créé');
    setIsCreateDialogOpen(false);
    refreshInvoices();
  };

  const handleIssueInvoice = (invoiceId: string) => {
    const result = issueInvoice(invoiceId);
    if (result) {
      toast.success(`Facture ${result.number} émise avec succès`);
      setIsIssueDialogOpen(false);
      setSelectedInvoice(null);
      refreshInvoices();
    } else {
      toast.error('Erreur lors de l\'émission de la facture');
    }
  };

  const handleDeleteDraft = (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (invoice?.status !== 'draft') {
      toast.error('Seuls les brouillons peuvent être supprimés');
      return;
    }
    deleteInvoice(invoiceId);
    toast.success('Brouillon supprimé');
    refreshInvoices();
  };

  const handlePrintPDF = (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return;

    const matter = matters.find(m => m.id === invoice.matterId);
    const client = clients.find(c => c.id === invoice.clientId);
    if (!matter || !client) return;

    printInvoicePDF({ invoice, settings, client, matter });
  };

  const handleExportCSV = () => {
    exportInvoicesCSV(invoices);
    toast.success('Export CSV téléchargé');
  };

  const openPreview = (invoiceId: string) => {
    setSelectedInvoice(invoiceId);
    setIsPreviewDialogOpen(true);
  };

  const getPreviewInvoice = () => invoices.find(i => i.id === selectedInvoice);

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
              {formatCents(invoices.filter(i => i.status === 'issued').reduce((sum, i) => sum + i.totalTtcCents, 0))}
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
                      {getMatterInfo(invoice.matterId)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getClientInfo(invoice.clientId)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {invoice.periodFrom} → {invoice.periodTo}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCents(invoice.totalHtCents)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCents(invoice.totalTtcCents)}
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
                    const client = clients.find(c => c.id === matter.clientId);
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
              />
            </div>

            {selectedMatterId && (
              <Card className="bg-muted">
                <CardContent className="p-4">
                  <div className="text-sm font-medium mb-2">Aperçu</div>
                  <p className="text-muted-foreground text-sm">
                    {previewEntries.length} entrée(s) facturable(s) pour un total de{' '}
                    <span className="font-semibold">{formatMinutesToHours(previewTotalMinutes)}</span>
                  </p>
                  {previewEntries.length === 0 && (
                    <p className="text-destructive text-sm mt-2">
                      Aucune entrée facturable non facturée pour cette période.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateDraft} disabled={previewEntries.length === 0}>
              Créer le brouillon
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
                  <span className="font-medium">{getMatterInfo(getPreviewInvoice()!.matterId)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Client:</span>{' '}
                  <span className="font-medium">{getClientInfo(getPreviewInvoice()!.clientId)}</span>
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
                      <TableCell className="text-right">{formatCents(line.rateCents)}</TableCell>
                      <TableCell className="text-right">{line.vatRate}%</TableCell>
                      <TableCell className="text-right font-medium">{formatCents(line.amountTtcCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end">
                <div className="space-y-1 text-right">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total HT:</span>{' '}
                    {formatCents(getPreviewInvoice()!.totalHtCents)}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">TVA:</span>{' '}
                    {formatCents(getPreviewInvoice()!.totalVatCents)}
                  </div>
                  <div className="text-lg font-bold">
                    <span className="text-muted-foreground">TTC:</span>{' '}
                    {formatCents(getPreviewInvoice()!.totalTtcCents)}
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
