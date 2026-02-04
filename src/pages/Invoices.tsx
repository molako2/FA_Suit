import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getInvoices, getMatters, getClients, formatCents } from '@/lib/storage';
import { FileText, Plus, Download, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Invoices() {
  const { user } = useAuth();
  const invoices = getInvoices();
  const matters = getMatters();
  const clients = getClients();

  const canEdit = user?.role === 'owner' || user?.role === 'assistant';

  const getMatterInfo = (matterId: string) => {
    const matter = matters.find(m => m.id === matterId);
    return matter ? `${matter.code} - ${matter.label}` : 'Inconnu';
  };

  const getClientInfo = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Inconnu';
  };

  const statusColors = {
    draft: 'bg-secondary text-secondary-foreground',
    issued: 'bg-success text-success-foreground',
    cancelled: 'bg-destructive text-destructive-foreground',
  };

  const statusLabels = {
    draft: 'Brouillon',
    issued: 'Émise',
    cancelled: 'Annulée',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Factures</h1>
          <p className="text-muted-foreground">Facturation des prestations par dossier</p>
        </div>

        {canEdit && (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle facture
          </Button>
        )}
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
            <CardTitle className="text-sm font-medium">Émises (ce mois)</CardTitle>
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
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {invoice.status === 'issued' && (
                          <Button variant="ghost" size="icon">
                            <Download className="w-4 h-4" />
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

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Créer une facture</CardTitle>
            <CardDescription>
              Sélectionnez un dossier et une période pour facturer les temps enregistrés.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              La création de facture sera disponible prochainement. Les temps facturables seront automatiquement regroupés.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
