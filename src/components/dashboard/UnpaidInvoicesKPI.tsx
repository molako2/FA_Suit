 import { useMemo } from 'react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from '@/components/ui/table';
 import { AlertCircle } from 'lucide-react';
 
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
 
   const getMatterInfo = (matterId: string) => {
     const matter = matters.find(m => m.id === matterId);
     return matter ? { code: matter.code, label: matter.label, clientId: matter.client_id } : null;
   };
 
   const getClientName = (clientId: string) => {
     const client = clients.find(c => c.id === clientId);
     return client?.name || 'Inconnu';
   };
 
   return (
     <Card>
       <CardHeader>
         <div className="flex items-center gap-2">
           <AlertCircle className="h-5 w-5 text-warning" />
           <div>
             <CardTitle>Factures en attente de règlement</CardTitle>
             <CardDescription>Factures émises non payées à ce jour</CardDescription>
           </div>
         </div>
       </CardHeader>
       <CardContent className="space-y-4">
         {/* Summary */}
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           <div className="bg-warning/10 rounded-lg p-4">
             <div className="text-sm text-muted-foreground">Nombre de factures</div>
             <div className="text-2xl font-bold">{unpaidInvoices.length}</div>
           </div>
           <div className="bg-destructive/10 rounded-lg p-4">
             <div className="text-sm text-muted-foreground">Montant total TTC</div>
             <div className="text-2xl font-bold text-destructive">{formatCents(totalUnpaid)}</div>
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
               </TableRow>
             </TableHeader>
             <TableBody>
               {unpaidInvoices.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                     Aucune facture en attente de règlement 🎉
                   </TableCell>
                 </TableRow>
               ) : (
                 unpaidInvoices.map((invoice) => {
                   const matterInfo = getMatterInfo(invoice.matter_id);
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
                     </TableRow>
                   );
                 })
               )}
             </TableBody>
           </Table>
         </div>
       </CardContent>
     </Card>
   );
 }