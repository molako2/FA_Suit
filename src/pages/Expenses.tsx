 import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
 import { useAuth } from '@/contexts/AuthContext';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Checkbox } from '@/components/ui/checkbox';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
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
   DialogTrigger,
 } from '@/components/ui/dialog';
 import { useExpenses, useCreateExpense, useDeleteExpense, formatCentsTTC } from '@/hooks/useExpenses';
 import { useClients } from '@/hooks/useClients';
 import { useMatters } from '@/hooks/useMatters';
import { useProfiles } from '@/hooks/useProfiles';
import { Plus, Trash2, Loader2, Receipt, Download } from 'lucide-react';
 import { toast } from 'sonner';
 
 export default function Expenses() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   
   // Form state
   const [selectedClientId, setSelectedClientId] = useState('');
   const [selectedMatterId, setSelectedMatterId] = useState('');
   const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
   const [nature, setNature] = useState('');
   const [amountTTC, setAmountTTC] = useState('');
   const [billable, setBillable] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');

  // Initialize selectedUserId when dialog opens
  const handleOpenDialog = (open: boolean) => {
    if (open && !selectedUserId && user) {
      setSelectedUserId(user.id);
    }
    setIsDialogOpen(open);
  };
 
   // Data hooks
  const canViewAll = role === 'owner' || role === 'sysadmin';
  const canAddForOthers = role === 'owner' || role === 'sysadmin';
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(canViewAll ? undefined : user?.id);
   const { data: clients = [], isLoading: clientsLoading } = useClients();
   const { data: matters = [], isLoading: mattersLoading } = useMatters();
  const { data: profiles = [] } = useProfiles();
   const createExpense = useCreateExpense();
   const deleteExpense = useDeleteExpense();
 
   const isLoading = expensesLoading || clientsLoading || mattersLoading;
 
   // Filter matters by selected client
   const filteredMatters = useMemo(() => {
     if (!selectedClientId) return [];
     return matters.filter(m => m.client_id === selectedClientId && m.status === 'open');
   }, [matters, selectedClientId]);
 
   // Get selected client/matter names for display
   const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name || '';
   const getClientCode = (clientId: string) => clients.find(c => c.id === clientId)?.code || '';
   const getMatterLabel = (matterId: string) => matters.find(m => m.id === matterId)?.label || '';
   const getMatterCode = (matterId: string) => matters.find(m => m.id === matterId)?.code || '';
  const getUserName = (userId: string) => profiles.find(p => p.id === userId)?.name || '';
 
   const resetForm = () => {
     setSelectedClientId('');
     setSelectedMatterId('');
     setExpenseDate(new Date().toISOString().split('T')[0]);
     setNature('');
     setAmountTTC('');
     setBillable(true);
    setSelectedUserId(user?.id || '');
   };
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     if (!user) {
      toast.error(t('errors.userNotConnected'));
       return;
     }
 
     if (!selectedClientId || !selectedMatterId || !expenseDate || !nature || !amountTTC) {
      toast.error(t('errors.fillRequired'));
       return;
     }
 
     if (nature.length > 100) {
      toast.error(t('expenses.nature') + ' ' + t('errors.maxCharacters', { max: 100 }));
       return;
     }
 
     const amountCents = Math.round(parseFloat(amountTTC) * 100);
     if (isNaN(amountCents) || amountCents <= 0) {
      toast.error(t('errors.invalidAmount'));
       return;
     }
 
    const targetUserId = canAddForOthers && selectedUserId ? selectedUserId : user.id;

     try {
       await createExpense.mutateAsync({
        user_id: targetUserId,
         client_id: selectedClientId,
         matter_id: selectedMatterId,
         expense_date: expenseDate,
         nature,
         amount_ttc_cents: amountCents,
         billable,
       });
      toast.success(t('expenses.expenseAdded'));
       resetForm();
       setIsDialogOpen(false);
     } catch (error: any) {
      toast.error(error.message || t('errors.saveError'));
     }
   };
 
   const handleDelete = async (expenseId: string) => {
    if (!confirm(t('expenses.confirmDelete'))) return;
     
     try {
       await deleteExpense.mutateAsync(expenseId);
      toast.success(t('expenses.expenseDeleted'));
     } catch (error: any) {
      toast.error(error.message || t('errors.deleteError'));
     }
   };
 
  // Export to CSV
  const handleExportCSV = () => {
    if (expenses.length === 0) {
      toast.error(t('errors.noDataToExport'));
      return;
    }

    const headers = ['Date', 'Collaborateur', 'Code Client', 'Client', 'Code Dossier', 'Dossier', 'Nature', 'Montant TTC', 'Facturable', 'Verrouillé'];
    const rows = expenses.map(exp => [
      exp.expense_date,
      getUserName(exp.user_id),
      getClientCode(exp.client_id),
      getClientName(exp.client_id),
      getMatterCode(exp.matter_id),
      getMatterLabel(exp.matter_id),
      exp.nature,
      (exp.amount_ttc_cents / 100).toFixed(2),
      exp.billable ? 'Oui' : 'Non',
      exp.locked ? 'Oui' : 'Non',
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `frais_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exportCSV'));
  };

   // When client changes, reset matter
   const handleClientChange = (clientId: string) => {
     setSelectedClientId(clientId);
     setSelectedMatterId('');
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
            <h1 className="text-3xl font-bold">{canViewAll ? t('expenses.allTitle') : t('expenses.title')}</h1>
            <p className="text-muted-foreground">{t('expenses.subtitle')}</p>
         </div>
         
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
               {t('common.exportCSV')}
            </Button>
          <Dialog open={isDialogOpen} onOpenChange={handleOpenDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                   {t('expenses.newExpense')}
                </Button>
              </DialogTrigger>
           <DialogContent className="sm:max-w-[500px]">
             <DialogHeader>
                <DialogTitle>{t('expenses.newExpense')}</DialogTitle>
               <DialogDescription>
                  {t('expenses.subtitle')}
               </DialogDescription>
             </DialogHeader>
             <form onSubmit={handleSubmit} className="space-y-4">
              {canAddForOthers && (
                <div className="grid gap-2">
                    <Label htmlFor="userSelect">{t('expenses.collaborator')}</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                        <SelectValue placeholder={t('expenses.selectCollaborator')} />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.filter(p => p.active).map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} ({profile.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

               {/* Client Code */}
               <div className="grid gap-2">
                  <Label htmlFor="clientCode">{t('expenses.clientCode')}</Label>
                 <Select value={selectedClientId} onValueChange={handleClientChange}>
                   <SelectTrigger>
                      <SelectValue placeholder={t('expenses.selectClient')} />
                   </SelectTrigger>
                   <SelectContent>
                     {clients.filter(c => c.active).map(client => (
                       <SelectItem key={client.id} value={client.id}>
                         {client.code}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
 
               {/* Client Name (read-only display) */}
               {selectedClientId && (
                 <div className="grid gap-2">
                    <Label>{t('expenses.clientName')}</Label>
                   <Input value={getClientName(selectedClientId)} disabled />
                 </div>
               )}
 
               {/* Matter Code */}
               <div className="grid gap-2">
                  <Label htmlFor="matterCode">{t('expenses.matterCode')}</Label>
                 <Select 
                   value={selectedMatterId} 
                   onValueChange={setSelectedMatterId}
                   disabled={!selectedClientId}
                 >
                   <SelectTrigger>
                      <SelectValue placeholder={selectedClientId ? t('expenses.selectMatter') : t('expenses.selectClientFirst')} />
                   </SelectTrigger>
                   <SelectContent>
                     {filteredMatters.map(matter => (
                       <SelectItem key={matter.id} value={matter.id}>
                         {matter.code}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
 
               {/* Matter Name (read-only display) */}
               {selectedMatterId && (
                 <div className="grid gap-2">
                    <Label>{t('expenses.matterName')}</Label>
                   <Input value={getMatterLabel(selectedMatterId)} disabled />
                 </div>
               )}
 
               {/* Expense Date */}
               <div className="grid gap-2">
                  <Label htmlFor="expenseDate">{t('expenses.expenseDate')}</Label>
                 <Input
                   id="expenseDate"
                   type="date"
                   value={expenseDate}
                   onChange={(e) => setExpenseDate(e.target.value)}
                   required
                 />
               </div>
 
               {/* Nature */}
               <div className="grid gap-2">
                  <Label htmlFor="nature">{t('expenses.nature')}</Label>
                 <Input
                   id="nature"
                   value={nature}
                   onChange={(e) => setNature(e.target.value.slice(0, 100))}
                    placeholder={t('expenses.naturePlaceholder')}
                   maxLength={100}
                   required
                 />
                  <p className="text-xs text-muted-foreground">{nature.length}/100 {t('expenses.charactersCount')}</p>
               </div>
 
               {/* Amount TTC */}
               <div className="grid gap-2">
                  <Label htmlFor="amountTTC">{t('expenses.amountTTC')}</Label>
                 <Input
                   id="amountTTC"
                   type="number"
                   step="0.01"
                   min="0"
                   value={amountTTC}
                   onChange={(e) => setAmountTTC(e.target.value)}
                   placeholder="0.00"
                   required
                 />
               </div>
 
               {/* Billable */}
               <div className="flex items-center space-x-2">
                 <Checkbox
                   id="billable"
                   checked={billable}
                   onCheckedChange={(checked) => setBillable(checked === true)}
                 />
                  <Label htmlFor="billable" className="cursor-pointer">{t('common.billable')}</Label>
               </div>
 
               <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => handleOpenDialog(false)}>
                    {t('common.cancel')}
                 </Button>
                 <Button type="submit" disabled={createExpense.isPending}>
                   {createExpense.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('common.add')}
                 </Button>
               </DialogFooter>
             </form>
           </DialogContent>
            </Dialog>
          </div>
       </div>
 
       {/* Expenses Table */}
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Receipt className="w-5 h-5" />
              {t('expenses.expenseList')}
           </CardTitle>
           <CardDescription>
              {t('expenses.subtitle')}
           </CardDescription>
         </CardHeader>
         <CardContent>
           <Table>
             <TableHeader>
               <TableRow>
                  <TableHead>{t('common.date')}</TableHead>
                   {canViewAll && <TableHead>{t('expenses.collaborator')}</TableHead>}
                  <TableHead>{t('clients.title')}</TableHead>
                  <TableHead>{t('matters.title')}</TableHead>
                  <TableHead>{t('expenses.nature')}</TableHead>
                  <TableHead className="text-right">{t('expenses.amountTTC')}</TableHead>
                  <TableHead className="text-center">{t('common.billable')}</TableHead>
                   <TableHead className="text-center">{t('common.status')}</TableHead>
                 <TableHead></TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {expenses.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={canViewAll ? 9 : 8} className="text-center text-muted-foreground py-8">
                      {t('expenses.noExpenses')}
                   </TableCell>
                 </TableRow>
               ) : (
                 expenses.map((expense) => (
                   <TableRow key={expense.id}>
                     <TableCell>{new Date(expense.expense_date).toLocaleDateString('fr-FR')}</TableCell>
                      {canViewAll && (
                        <TableCell className="font-medium">{getUserName(expense.user_id)}</TableCell>
                      )}
                     <TableCell>
                       <div className="text-sm">
                         <span className="font-medium">{getClientCode(expense.client_id)}</span>
                         <span className="text-muted-foreground ml-2">{getClientName(expense.client_id)}</span>
                       </div>
                     </TableCell>
                     <TableCell>
                       <div className="text-sm">
                         <span className="font-medium">{getMatterCode(expense.matter_id)}</span>
                         <span className="text-muted-foreground ml-2">{getMatterLabel(expense.matter_id)}</span>
                       </div>
                     </TableCell>
                     <TableCell className="max-w-[200px] truncate">{expense.nature}</TableCell>
                     <TableCell className="text-right font-medium">
                       {formatCentsTTC(expense.amount_ttc_cents)}
                     </TableCell>
                     <TableCell className="text-center">
                       {expense.billable ? '✓' : '—'}
                     </TableCell>
                      <TableCell className="text-center">
                        {expense.locked ? (
                           <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{t('common.invoiced')}</span>
                        ) : (
                           <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">{t('common.available')}</span>
                        )}
                      </TableCell>
                     <TableCell>
                        {!expense.locked && (canViewAll || expense.user_id === user?.id) && (
                         <Button
                           variant="ghost"
                           size="icon"
                           onClick={() => handleDelete(expense.id)}
                           className="text-destructive hover:text-destructive"
                         >
                           <Trash2 className="w-4 h-4" />
                         </Button>
                       )}
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