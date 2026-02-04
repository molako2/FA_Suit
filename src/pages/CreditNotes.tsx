import { Card, CardContent } from '@/components/ui/card';
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
import { getCreditNotes, getInvoices, formatCents } from '@/lib/storage';
import { FileMinus2, Plus, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function CreditNotes() {
  const { user } = useAuth();
  const creditNotes = getCreditNotes();
  const invoices = getInvoices();

  const canEdit = user?.role === 'owner' || user?.role === 'assistant';

  const getInvoiceNumber = (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    return invoice?.number || 'N/A';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Avoirs</h1>
          <p className="text-muted-foreground">Gestion des avoirs sur factures émises</p>
        </div>

        {canEdit && (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nouvel avoir
          </Button>
        )}
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
                      <Button variant="ghost" size="icon">
                        <Download className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
