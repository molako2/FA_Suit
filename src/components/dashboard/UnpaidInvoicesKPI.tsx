import { useMemo } from 'react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from '@/components/ui/table';
import { AlertCircle, Download } from 'lucide-react';
 
 interface Invoice {
   id: string;
   number: string | null;
   matter_id: string;
   status: string;
   issue_date: string | null;
   total_ht_cents: number;
   total_ttc_cents: number;
   paid: boolean;
   payment_date: string | null;
 }
 
 interface Matter {
   id: string;
   code: string;
   label: string;
   client_id: string;
 }
 
 interface Client {
   id: string;
   code: string;
   name: string;
 }
 
 interface UnpaidInvoicesKPIProps {
   invoices: Invoice[];
   matters: Matter[];
   clients: Client[];
 }
 
 function formatCents(cents: number): string {
   return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
 }
 
function getDaysOverdue(issueDate: string | null): number {
  if (!issueDate) return 0;
  const issue = new Date(issueDate);
  const today = new Date();
  const diffTime = today.getTime() - issue.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

interface AgingBucket {
  under30: number;
  from30to60: number;
  from60to90: number;
  over90: number;
}

function getAgingBucket(issueDate: string | null, amountCents: number): AgingBucket {
  const days = getDaysOverdue(issueDate);
  return {
    under30: days < 30 ? amountCents : 0,
    from30to60: days >= 30 && days < 60 ? amountCents : 0,
    from60to90: days >= 60 && days < 90 ? amountCents : 0,
    over90: days >= 90 ? amountCents : 0,
  };
}

 export function UnpaidInvoicesKPI({ invoices, matters, clients }: UnpaidInvoicesKPIProps) {
   // Filter unpaid issued invoices
   const unpaidInvoices = useMemo(() => {
     return invoices
       .filter(inv => inv.status === 'issued' && !inv.paid)
       .sort((a, b) => (a.issue_date || '').localeCompare(b.issue_date || ''));
   }, [invoices]);
 
   const totalUnpaid = useMemo(() => {
     return unpaidInvoices.reduce((sum, inv) => sum + inv.total_ttc_cents, 0);
   }, [unpaidInvoices]);
 
  const agingTotals = useMemo(() => {
    return unpaidInvoices.reduce(
      (acc, inv) => {
        const bucket = getAgingBucket(inv.issue_date, inv.total_ttc_cents);
        return {
          under30: acc.under30 + bucket.under30,
          from30to60: acc.from30to60 + bucket.from30to60,
          from60to90: acc.from60to90 + bucket.from60to90,
          over90: acc.over90 + bucket.over90,
        };
      },
      { under30: 0, from30to60: 0, from60to90: 0, over90: 0 }
    );
  }, [unpaidInvoices]);

   const getMatterInfo = (matterId: string) => {
     const matter = matters.find(m => m.id === matterId);
     return matter ? { code: matter.code, label: matter.label, clientId: matter.client_id } : null;
   };
 
   const getClientName = (clientId: string) => {
     const client = clients.find(c => c.id === clientId);
     return client?.name || 'Inconnu';
   };
 
  const handleExportCSV = () => {
    const headers = [
      'N° Facture',
      'Date émission',
      'Client',
      'Dossier Code',
      'Dossier Libellé',
      'Montant TTC',
      '< 30 J',
      '30-60 J',
      '60-90 J',
      '> 90 J',
    ];

    const escapeCSV = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatAmount = (cents: number) => (cents / 100).toFixed(2);

    const rows = unpaidInvoices.map((invoice) => {
      const matterInfo = getMatterInfo(invoice.matter_id);
      const clientName = matterInfo ? getClientName(matterInfo.clientId) : '';
      const bucket = getAgingBucket(invoice.issue_date, invoice.total_ttc_cents);

      return [
        invoice.number || '',
        invoice.issue_date || '',
        clientName,
        matterInfo?.code || '',
        matterInfo?.label || '',
        formatAmount(invoice.total_ttc_cents),
        bucket.under30 ? formatAmount(bucket.under30) : '',
        bucket.from30to60 ? formatAmount(bucket.from30to60) : '',
        bucket.from60to90 ? formatAmount(bucket.from60to90) : '',
        bucket.over90 ? formatAmount(bucket.over90) : '',
      ].map(escapeCSV);
    });

    rows.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      formatAmount(totalUnpaid),
      formatAmount(agingTotals.under30),
      formatAmount(agingTotals.from30to60),
      formatAmount(agingTotals.from60to90),
      formatAmount(agingTotals.over90),
    ]);

    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `balance_agee_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

   return (
     <Card>
       <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            <div>
              <CardTitle>Factures en attente de règlement</CardTitle>
              <CardDescription>Factures émises non payées à ce jour</CardDescription>
            </div>
           </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={unpaidInvoices.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
         </div>
       </CardHeader>
       <CardContent className="space-y-4">
         {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
           <div className="bg-warning/10 rounded-lg p-4">
             <div className="text-sm text-muted-foreground">Nombre de factures</div>
             <div className="text-2xl font-bold">{unpaidInvoices.length}</div>
           </div>
           <div className="bg-destructive/10 rounded-lg p-4">
             <div className="text-sm text-muted-foreground">Montant total TTC</div>
             <div className="text-2xl font-bold text-destructive">{formatCents(totalUnpaid)}</div>
           </div>
          <div className="bg-green-500/10 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">&lt; 30 J</div>
            <div className="text-lg font-semibold text-green-600">{formatCents(agingTotals.under30)}</div>
          </div>
          <div className="bg-yellow-500/10 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">30-60 J</div>
            <div className="text-lg font-semibold text-yellow-600">{formatCents(agingTotals.from30to60)}</div>
          </div>
          <div className="bg-orange-500/10 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">60-90 J</div>
            <div className="text-lg font-semibold text-orange-600">{formatCents(agingTotals.from60to90)}</div>
          </div>
          <div className="bg-red-500/10 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">&gt; 90 J</div>
            <div className="text-lg font-semibold text-red-600">{formatCents(agingTotals.over90)}</div>
          </div>
         </div>
 
         {/* Table */}
         <div className="border rounded-md overflow-auto">
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>N° Facture</TableHead>
                 <TableHead>Date émission</TableHead>
                 <TableHead>Client</TableHead>
                 <TableHead>Dossier</TableHead>
                 <TableHead className="text-right">Montant TTC</TableHead>
                <TableHead className="text-right text-green-600">&lt; 30 J</TableHead>
                <TableHead className="text-right text-yellow-600">30-60 J</TableHead>
                <TableHead className="text-right text-orange-600">60-90 J</TableHead>
                <TableHead className="text-right text-red-600">&gt; 90 J</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {unpaidInvoices.length === 0 ? (
                 <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                     Aucune facture en attente de règlement 🎉
                   </TableCell>
                 </TableRow>
               ) : (
                <>
                  {unpaidInvoices.map((invoice) => {
                    const matterInfo = getMatterInfo(invoice.matter_id);
                    const bucket = getAgingBucket(invoice.issue_date, invoice.total_ttc_cents);
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <Badge variant="outline">{invoice.number}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {invoice.issue_date || '-'}
                        </TableCell>
                        <TableCell>
                          {matterInfo ? getClientName(matterInfo.clientId) : '-'}
                        </TableCell>
                        <TableCell>
                          {matterInfo ? (
                            <span className="text-sm">
                              <span className="font-medium">{matterInfo.code}</span>
                              <span className="text-muted-foreground ml-1">
                                {matterInfo.label.length > 20 ? matterInfo.label.slice(0, 20) + '...' : matterInfo.label}
                              </span>
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCents(invoice.total_ttc_cents)}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {bucket.under30 ? formatCents(bucket.under30) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-yellow-600">
                          {bucket.from30to60 ? formatCents(bucket.from30to60) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-orange-600">
                          {bucket.from60to90 ? formatCents(bucket.from60to90) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {bucket.over90 ? formatCents(bucket.over90) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={4}>TOTAL</TableCell>
                    <TableCell className="text-right">{formatCents(totalUnpaid)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCents(agingTotals.under30)}</TableCell>
                    <TableCell className="text-right text-yellow-600">{formatCents(agingTotals.from30to60)}</TableCell>
                    <TableCell className="text-right text-orange-600">{formatCents(agingTotals.from60to90)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatCents(agingTotals.over90)}</TableCell>
                  </TableRow>
                </>
               )}
             </TableBody>
           </Table>
         </div>
       </CardContent>
     </Card>
   );
 }